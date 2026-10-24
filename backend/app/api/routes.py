import json
import uuid
from typing import Optional
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.config import settings
from app.database.session import get_db
from app.models import (
    Case, Evidence, IntegrityVerification, MetadataRecord, Analysis, Finding, Report, ActivityLog
)
from app.schemas import (
    CaseCreate, CaseUpdate, CaseSummary, CaseDetail,
    EvidenceResponse, IntegrityVerificationResponse, MetadataRecordResponse,
    ElaRequest, CopyMoveRequest, NoiseRequest, AnalysisResponse,
    FindingCreate, FindingUpdate, FindingResponse,
    ReportResponse, DashboardStats, ActivityLogResponse
)
from app.services.evidence_service import acquire_evidence, get_evidence_file_path
from app.services.integrity_service import verify_evidence_integrity
from app.services.metadata_service import examine_metadata
from app.services.ela_service import perform_ela
from app.services.copy_move_service import perform_copy_move_detection
from app.services.noise_service import perform_noise_analysis
from app.services.report_service import generate_pdf_report

router = APIRouter()

# ----------------- HEALTH CHECK -----------------
@router.get("/health", tags=["System"])
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "storage_initialized": settings.STORAGE_DIR.exists()
    }

# ----------------- DASHBOARD -----------------
@router.get("/dashboard/stats", response_model=DashboardStats, tags=["Dashboard"])
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_cases = db.query(Case).count()
    total_evidence = db.query(Evidence).count()
    total_analyses = db.query(Analysis).count()
    total_anomalies = db.query(Finding).filter(
        Finding.category.in_(["POTENTIAL_ANOMALY", "INTEGRITY_FAILURE"])
    ).count()

    recent_cases_db = db.query(Case).order_by(Case.created_at.desc()).limit(5).all()
    recent_cases = []
    for c in recent_cases_db:
        ev_count = len(c.evidence_items)
        anl_count = sum(len(e.analyses) for e in c.evidence_items)
        anom_count = sum(
            len([f for f in e.findings if f.category in ("POTENTIAL_ANOMALY", "INTEGRITY_FAILURE")])
            for e in c.evidence_items
        )
        recent_cases.append(CaseSummary(
            id=c.id,
            case_id=c.case_id,
            title=c.title,
            description=c.description,
            examiner_name=c.examiner_name,
            evidence_ref=c.evidence_ref,
            acquisition_notes=c.acquisition_notes,
            created_at=c.created_at,
            updated_at=c.updated_at,
            evidence_count=ev_count,
            analysis_count=anl_count,
            anomalies_count=anom_count
        ))

    recent_logs = db.query(ActivityLog).order_by(ActivityLog.timestamp.desc()).limit(15).all()

    return DashboardStats(
        total_cases=total_cases,
        total_evidence=total_evidence,
        total_analyses=total_analyses,
        total_anomalies=total_anomalies,
        recent_cases=recent_cases,
        recent_activity=recent_logs
    )

# ----------------- CASES -----------------
@router.get("/cases", response_model=list[CaseSummary], tags=["Cases"])
def list_cases(db: Session = Depends(get_db)):
    cases = db.query(Case).order_by(Case.created_at.desc()).all()
    result = []
    for c in cases:
        ev_count = len(c.evidence_items)
        anl_count = sum(len(e.analyses) for e in c.evidence_items)
        anom_count = sum(
            len([f for f in e.findings if f.category in ("POTENTIAL_ANOMALY", "INTEGRITY_FAILURE")])
            for e in c.evidence_items
        )
        result.append(CaseSummary(
            id=c.id,
            case_id=c.case_id,
            title=c.title,
            description=c.description,
            examiner_name=c.examiner_name,
            evidence_ref=c.evidence_ref,
            acquisition_notes=c.acquisition_notes,
            created_at=c.created_at,
            updated_at=c.updated_at,
            evidence_count=ev_count,
            analysis_count=anl_count,
            anomalies_count=anom_count
        ))
    return result

@router.post("/cases", response_model=CaseSummary, status_code=status.HTTP_201_CREATED, tags=["Cases"])
def create_case(case_in: CaseCreate, db: Session = Depends(get_db)):
    case_uid = uuid.uuid4().hex[:6].upper()
    case_id_str = f"CASE-{case_uid}"

    case = Case(
        case_id=case_id_str,
        title=case_in.title,
        description=case_in.description,
        examiner_name=case_in.examiner_name,
        evidence_ref=case_in.evidence_ref,
        acquisition_notes=case_in.acquisition_notes
    )
    db.add(case)
    db.add(ActivityLog(
        case_id=None,
        action_type="CASE_CREATED",
        description=f"Investigation case {case_id_str} ('{case_in.title}') opened."
    ))
    db.commit()
    db.refresh(case)

    return CaseSummary(
        id=case.id,
        case_id=case.case_id,
        title=case.title,
        description=case.description,
        examiner_name=case.examiner_name,
        evidence_ref=case.evidence_ref,
        acquisition_notes=case.acquisition_notes,
        created_at=case.created_at,
        updated_at=case.updated_at,
        evidence_count=0,
        analysis_count=0,
        anomalies_count=0
    )

@router.get("/cases/{case_id}", tags=["Cases"])
def get_case(case_id: int, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    evidence_items = []
    for ev in case.evidence_items:
        latest_verif = db.query(IntegrityVerification).filter(
            IntegrityVerification.evidence_id == ev.id
        ).order_by(IntegrityVerification.verified_at.desc()).first()

        evidence_items.append({
            "id": ev.id,
            "evidence_id": ev.evidence_id,
            "case_id": ev.case_id,
            "original_filename": ev.original_filename,
            "stored_filename": ev.stored_filename,
            "file_size_bytes": ev.file_size_bytes,
            "detected_format": ev.detected_format,
            "mime_type": ev.mime_type,
            "width": ev.width,
            "height": ev.height,
            "sha256_hash": ev.sha256_hash,
            "acquisition_notes": ev.acquisition_notes,
            "created_at": ev.created_at,
            "latest_integrity_status": latest_verif.status if latest_verif else "PASS",
            "preview_url": f"/api/files/evidence/{ev.stored_filename}",
            "analyses_count": len(ev.analyses),
            "findings_count": len(ev.findings)
        })

    logs = db.query(ActivityLog).filter(ActivityLog.case_id == case.id).order_by(ActivityLog.timestamp.desc()).all()

    return {
        "id": case.id,
        "case_id": case.case_id,
        "title": case.title,
        "description": case.description,
        "examiner_name": case.examiner_name,
        "evidence_ref": case.evidence_ref,
        "acquisition_notes": case.acquisition_notes,
        "created_at": case.created_at,
        "updated_at": case.updated_at,
        "evidence_count": len(case.evidence_items),
        "evidence_items": evidence_items,
        "activity_logs": [
            {
                "id": l.id,
                "case_id": l.case_id,
                "evidence_id": l.evidence_id,
                "action_type": l.action_type,
                "description": l.description,
                "timestamp": l.timestamp
            } for l in logs
        ]
    }

@router.delete("/cases/{case_id}", tags=["Cases"])
def delete_case(case_id: int, confirm: bool = False, db: Session = Depends(get_db)):
    if not confirm:
        raise HTTPException(status_code=400, detail="Explicit confirmation required to remove investigation record.")
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Safe deletion: remove evidence files from storage
    for ev in case.evidence_items:
        path = settings.EVIDENCE_DIR / ev.stored_filename
        if path.exists():
            try: path.unlink()
            except Exception: pass
        for anl in ev.analyses:
            if anl.output_image_path:
                anl_p = settings.DERIVED_DIR / anl.output_image_path
                if anl_p.exists():
                    try: anl_p.unlink()
                    except Exception: pass

    db.delete(case)
    db.commit()
    return {"message": f"Case {case.case_id} and associated records successfully removed."}

# ----------------- EVIDENCE ACQUISITION -----------------
@router.post("/cases/{case_id}/evidence", response_model=EvidenceResponse, tags=["Evidence"])
def upload_evidence(
    case_id: int,
    file: UploadFile = File(...),
    acquisition_notes: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    ev = acquire_evidence(db, case_id=case_id, file=file, acquisition_notes=acquisition_notes)
    # Perform immediate initial integrity check and automatic initial metadata extraction
    verify_evidence_integrity(db, ev)
    examine_metadata(db, ev.id)

    return EvidenceResponse(
        id=ev.id,
        evidence_id=ev.evidence_id,
        case_id=ev.case_id,
        original_filename=ev.original_filename,
        stored_filename=ev.stored_filename,
        file_size_bytes=ev.file_size_bytes,
        detected_format=ev.detected_format,
        mime_type=ev.mime_type,
        width=ev.width,
        height=ev.height,
        sha256_hash=ev.sha256_hash,
        acquisition_notes=ev.acquisition_notes,
        created_at=ev.created_at,
        latest_integrity_status="PASS"
    )

@router.get("/evidence/{evidence_id}", tags=["Evidence"])
def get_evidence_detail(evidence_id: int, db: Session = Depends(get_db)):
    ev = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found")

    latest_verif = db.query(IntegrityVerification).filter(
        IntegrityVerification.evidence_id == ev.id
    ).order_by(IntegrityVerification.verified_at.desc()).first()

    return {
        "id": ev.id,
        "evidence_id": ev.evidence_id,
        "case_id": ev.case_id,
        "case_title": ev.case.title,
        "case_number": ev.case.case_id,
        "original_filename": ev.original_filename,
        "stored_filename": ev.stored_filename,
        "file_size_bytes": ev.file_size_bytes,
        "detected_format": ev.detected_format,
        "mime_type": ev.mime_type,
        "width": ev.width,
        "height": ev.height,
        "sha256_hash": ev.sha256_hash,
        "acquisition_notes": ev.acquisition_notes,
        "created_at": ev.created_at,
        "latest_integrity_status": latest_verif.status if latest_verif else "PASS",
        "preview_url": f"/api/files/evidence/{ev.stored_filename}"
    }

# ----------------- INTEGRITY VERIFICATION -----------------
@router.post("/evidence/{evidence_id}/verify-integrity", response_model=IntegrityVerificationResponse, tags=["Integrity"])
def reverify_integrity(evidence_id: int, db: Session = Depends(get_db)):
    verif = verify_evidence_integrity(db, evidence_id)
    return IntegrityVerificationResponse(
        id=verif.id,
        evidence_id=verif.evidence_id,
        recorded_hash=verif.recorded_hash,
        calculated_hash=verif.calculated_hash,
        status=verif.status,
        verified_at=verif.verified_at,
        verification_notes=verif.verification_notes,
        is_match=(verif.status == "PASS")
    )

@router.get("/evidence/{evidence_id}/integrity-history", response_model=list[IntegrityVerificationResponse], tags=["Integrity"])
def get_integrity_history(evidence_id: int, db: Session = Depends(get_db)):
    history = db.query(IntegrityVerification).filter(
        IntegrityVerification.evidence_id == evidence_id
    ).order_by(IntegrityVerification.verified_at.desc()).all()
    return [
        IntegrityVerificationResponse(
            id=h.id,
            evidence_id=h.evidence_id,
            recorded_hash=h.recorded_hash,
            calculated_hash=h.calculated_hash,
            status=h.status,
            verified_at=h.verified_at,
            verification_notes=h.verification_notes,
            is_match=(h.status == "PASS")
        ) for h in history
    ]

# ----------------- METADATA EXAMINATION -----------------
@router.get("/evidence/{evidence_id}/metadata", response_model=MetadataRecordResponse, tags=["Metadata"])
def get_metadata(evidence_id: int, db: Session = Depends(get_db)):
    record = db.query(MetadataRecord).filter(MetadataRecord.evidence_id == evidence_id).first()
    if not record:
        record = examine_metadata(db, evidence_id)

    return MetadataRecordResponse(
        id=record.id,
        evidence_id=record.evidence_id,
        tool_used=record.tool_used,
        raw_metadata=json.loads(record.raw_metadata),
        extracted_summary=json.loads(record.extracted_summary),
        potential_anomalies=json.loads(record.potential_anomalies),
        extracted_at=record.extracted_at
    )

@router.post("/evidence/{evidence_id}/metadata/reexamine", response_model=MetadataRecordResponse, tags=["Metadata"])
def reexamine_metadata_endpoint(evidence_id: int, db: Session = Depends(get_db)):
    record = examine_metadata(db, evidence_id)
    return MetadataRecordResponse(
        id=record.id,
        evidence_id=record.evidence_id,
        tool_used=record.tool_used,
        raw_metadata=json.loads(record.raw_metadata),
        extracted_summary=json.loads(record.extracted_summary),
        potential_anomalies=json.loads(record.potential_anomalies),
        extracted_at=record.extracted_at
    )

# ----------------- ANALYTICAL MODULES -----------------
@router.post("/evidence/{evidence_id}/analyze/ela", response_model=AnalysisResponse, tags=["Analysis"])
def run_ela(evidence_id: int, body: ElaRequest, db: Session = Depends(get_db)):
    anl = perform_ela(db, evidence_id, quality=body.quality, amplification=body.amplification)
    return AnalysisResponse(
        id=anl.id,
        analysis_id=anl.analysis_id,
        evidence_id=anl.evidence_id,
        analysis_type=anl.analysis_type,
        status=anl.status,
        parameters=json.loads(anl.parameters) if anl.parameters else {},
        metrics=json.loads(anl.metrics) if anl.metrics else {},
        output_image_url=f"/api/files/derived/{anl.output_image_path}" if anl.output_image_path else None,
        duration_ms=anl.duration_ms,
        interpretation_notes=anl.interpretation_notes,
        created_at=anl.created_at
    )

@router.post("/evidence/{evidence_id}/analyze/copy-move", response_model=AnalysisResponse, tags=["Analysis"])
def run_copy_move(evidence_id: int, body: CopyMoveRequest, db: Session = Depends(get_db)):
    anl = perform_copy_move_detection(
        db, evidence_id,
        method=body.method,
        max_keypoints=body.max_keypoints,
        ratio=body.ratio,
        min_distance=body.min_distance
    )
    return AnalysisResponse(
        id=anl.id,
        analysis_id=anl.analysis_id,
        evidence_id=anl.evidence_id,
        analysis_type=anl.analysis_type,
        status=anl.status,
        parameters=json.loads(anl.parameters) if anl.parameters else {},
        metrics=json.loads(anl.metrics) if anl.metrics else {},
        output_image_url=f"/api/files/derived/{anl.output_image_path}" if anl.output_image_path else None,
        duration_ms=anl.duration_ms,
        interpretation_notes=anl.interpretation_notes,
        created_at=anl.created_at
    )

@router.post("/evidence/{evidence_id}/analyze/noise", response_model=AnalysisResponse, tags=["Analysis"])
def run_noise(evidence_id: int, body: NoiseRequest, db: Session = Depends(get_db)):
    anl = perform_noise_analysis(
        db, evidence_id,
        window_size=body.window_size,
        method=body.method
    )
    return AnalysisResponse(
        id=anl.id,
        analysis_id=anl.analysis_id,
        evidence_id=anl.evidence_id,
        analysis_type=anl.analysis_type,
        status=anl.status,
        parameters=json.loads(anl.parameters) if anl.parameters else {},
        metrics=json.loads(anl.metrics) if anl.metrics else {},
        output_image_url=f"/api/files/derived/{anl.output_image_path}" if anl.output_image_path else None,
        duration_ms=anl.duration_ms,
        interpretation_notes=anl.interpretation_notes,
        created_at=anl.created_at
    )

@router.get("/evidence/{evidence_id}/analyses", response_model=list[AnalysisResponse], tags=["Analysis"])
def list_analyses(evidence_id: int, db: Session = Depends(get_db)):
    items = db.query(Analysis).filter(Analysis.evidence_id == evidence_id).order_by(Analysis.created_at.desc()).all()
    return [
        AnalysisResponse(
            id=a.id,
            analysis_id=a.analysis_id,
            evidence_id=a.evidence_id,
            analysis_type=a.analysis_type,
            status=a.status,
            parameters=json.loads(a.parameters) if a.parameters else {},
            metrics=json.loads(a.metrics) if a.metrics else {},
            output_image_url=f"/api/files/derived/{a.output_image_path}" if a.output_image_path else None,
            duration_ms=a.duration_ms,
            interpretation_notes=a.interpretation_notes,
            created_at=a.created_at
        ) for a in items
    ]

# ----------------- FINDINGS -----------------
@router.get("/evidence/{evidence_id}/findings", response_model=list[FindingResponse], tags=["Findings"])
def list_findings(evidence_id: int, db: Session = Depends(get_db)):
    items = db.query(Finding).filter(Finding.evidence_id == evidence_id).order_by(Finding.created_at.desc()).all()
    return items

@router.post("/evidence/{evidence_id}/findings", response_model=FindingResponse, status_code=status.HTTP_201_CREATED, tags=["Findings"])
def create_finding(evidence_id: int, body: FindingCreate, db: Session = Depends(get_db)):
    ev = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found")

    finding_uid = uuid.uuid4().hex[:6].upper()
    fnd = Finding(
        finding_id=f"FND-MAN-{ev.id}-{finding_uid}",
        evidence_id=evidence_id,
        analysis_id=None,
        category=body.category,
        description=body.description,
        supporting_data=body.supporting_data,
        severity=body.severity,
        examiner_notes=body.examiner_notes,
        review_status=body.review_status
    )
    db.add(fnd)
    db.commit()
    db.refresh(fnd)
    return fnd

@router.put("/findings/{finding_id}", response_model=FindingResponse, tags=["Findings"])
def update_finding(finding_id: int, body: FindingUpdate, db: Session = Depends(get_db)):
    fnd = db.query(Finding).filter(Finding.id == finding_id).first()
    if not fnd:
        raise HTTPException(status_code=404, detail="Finding not found")

    if body.category is not None: fnd.category = body.category
    if body.description is not None: fnd.description = body.description
    if body.supporting_data is not None: fnd.supporting_data = body.supporting_data
    if body.severity is not None: fnd.severity = body.severity
    if body.examiner_notes is not None: fnd.examiner_notes = body.examiner_notes
    if body.review_status is not None: fnd.review_status = body.review_status

    db.commit()
    db.refresh(fnd)
    return fnd

# ----------------- REPORTS -----------------
@router.post("/cases/{case_id}/evidence/{evidence_id}/reports", response_model=ReportResponse, tags=["Reports"])
def generate_report(case_id: int, evidence_id: int, db: Session = Depends(get_db)):
    rep = generate_pdf_report(db, case_id=case_id, evidence_id=evidence_id)
    return ReportResponse(
        id=rep.id,
        report_id=rep.report_id,
        case_id=rep.case_id,
        evidence_id=rep.evidence_id,
        title=rep.title,
        file_path=rep.file_path,
        created_at=rep.created_at,
        download_url=f"/api/reports/{rep.id}/download"
    )

@router.get("/reports", response_model=list[ReportResponse], tags=["Reports"])
def list_reports(db: Session = Depends(get_db)):
    reps = db.query(Report).order_by(Report.created_at.desc()).all()
    return [
        ReportResponse(
            id=r.id,
            report_id=r.report_id,
            case_id=r.case_id,
            evidence_id=r.evidence_id,
            title=r.title,
            file_path=r.file_path,
            created_at=r.created_at,
            download_url=f"/api/reports/{r.id}/download"
        ) for r in reps
    ]

@router.get("/reports/{report_id}/download", tags=["Reports"])
def download_report(report_id: int, db: Session = Depends(get_db)):
    rep = db.query(Report).filter(Report.id == report_id).first()
    if not rep:
        raise HTTPException(status_code=404, detail="Report not found")

    path = settings.REPORTS_DIR / rep.file_path
    if not path.exists():
        raise HTTPException(status_code=404, detail="PDF report file missing on disk")

    return FileResponse(
        path=str(path),
        filename=rep.file_path,
        media_type="application/pdf"
    )

# ----------------- SAFE FILE ACCESS ENDPOINTS -----------------
@router.get("/files/evidence/{filename}", tags=["Files"])
def get_evidence_image(filename: str):
    # Prevent directory traversal
    clean_name = Path(filename).name
    path = settings.EVIDENCE_DIR / clean_name
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Evidence file not found")

    suffix = path.suffix.lower()
    media_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
    media_type = media_map.get(suffix, "application/octet-stream")
    return FileResponse(path=str(path), media_type=media_type)

@router.get("/files/derived/{filename}", tags=["Files"])
def get_derived_image(filename: str):
    # Prevent directory traversal
    clean_name = Path(filename).name
    path = settings.DERIVED_DIR / clean_name
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Derived analysis file not found")

    return FileResponse(path=str(path), media_type="image/png")

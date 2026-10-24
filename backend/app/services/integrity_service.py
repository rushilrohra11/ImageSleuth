from pathlib import Path
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models import Evidence, IntegrityVerification, ActivityLog, Finding
from app.services.evidence_service import calculate_file_sha256, get_evidence_file_path

def verify_evidence_integrity(db: Session, evidence_id_or_model: int | Evidence) -> IntegrityVerification:
    """
    Forensically reverifies the SHA-256 hash of an evidence file on demand.
    Compares the newly calculated hash with the acquisition hash.
    Records the verification event in the audit trail.
    """
    if isinstance(evidence_id_or_model, int):
        evidence = db.query(Evidence).filter(Evidence.id == evidence_id_or_model).first()
        if not evidence:
            raise HTTPException(status_code=404, detail="Evidence not found")
    else:
        evidence = evidence_id_or_model

    try:
        file_path = get_evidence_file_path(evidence)
        calculated_hash = calculate_file_sha256(file_path)
    except FileNotFoundError as e:
        # Integrity Failure: File missing
        verification = IntegrityVerification(
            evidence_id=evidence.id,
            recorded_hash=evidence.sha256_hash,
            calculated_hash="FILE_NOT_FOUND",
            status="FAIL",
            verification_notes=f"INTEGRITY VIOLATION: Evidence file missing from storage ({str(e)})"
        )
        db.add(verification)
        db.add(ActivityLog(
            case_id=evidence.case_id,
            evidence_id=evidence.id,
            action_type="INTEGRITY_FAIL",
            description=f"CRITICAL: Integrity verification failed for {evidence.evidence_id} - File missing!"
        ))
        db.commit()
        db.refresh(verification)
        return verification

    is_match = (calculated_hash.lower() == evidence.sha256_hash.lower())
    status = "PASS" if is_match else "FAIL"

    if is_match:
        notes = "Integrity check passed. Calculated SHA-256 matches acquisition record byte-for-byte."
    else:
        notes = (
            f"INTEGRITY MISMATCH DETECTED! Recorded: {evidence.sha256_hash[:16]}... "
            f"Calculated: {calculated_hash[:16]}... Original evidence bytes have been altered!"
        )
        # Create an Integrity Failure finding
        finding = Finding(
            finding_id=f"FND-INT-{evidence.id}-{calculated_hash[:6]}",
            evidence_id=evidence.id,
            category="INTEGRITY_FAILURE",
            description="The SHA-256 hash of the stored evidence file does not match the acquisition hash.",
            supporting_data=f"Recorded: {evidence.sha256_hash}\nCalculated: {calculated_hash}",
            severity="HIGH",
            examiner_notes="Potential tampering or disk corruption detected. Evidence chain of custody compromised.",
            review_status="UNREVIEWED"
        )
        db.add(finding)

    verification = IntegrityVerification(
        evidence_id=evidence.id,
        recorded_hash=evidence.sha256_hash,
        calculated_hash=calculated_hash,
        status=status,
        verification_notes=notes
    )
    db.add(verification)

    db.add(ActivityLog(
        case_id=evidence.case_id,
        evidence_id=evidence.id,
        action_type="INTEGRITY_VERIFY",
        description=f"Integrity check for {evidence.evidence_id}: {status}"
    ))

    db.commit()
    db.refresh(verification)
    return verification

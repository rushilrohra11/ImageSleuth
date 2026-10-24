import os
import json
import uuid
import datetime
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.core.config import settings
from app.models import Case, Evidence, MetadataRecord, Analysis, Finding, Report, ActivityLog, IntegrityVerification

class NumberedCanvas(canvas.Canvas):
    """Custom canvas that computes total page count dynamically."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header banner
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(40, letter[1] - 40, letter[0] - 40, letter[1] - 40)
        self.drawString(40, letter[1] - 35, "ImageSleuth Forensics Lab — Official Investigation Report")
        
        # Footer
        self.line(40, 45, letter[0] - 40, 45)
        self.drawString(40, 32, "CONFIDENTIAL & PRIVILEGED FORENSIC WORK PRODUCT — FOR EDUCATIONAL & INVESTIGATIVE REVIEW ONLY")
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(letter[0] - 40, 32, page_text)
        self.restoreState()

def generate_pdf_report(db: Session, case_id: int, evidence_id: int) -> Report:
    """
    Generates a forensic PDF investigation report via ReportLab.
    Includes case data, evidence integrity verification, metadata analysis,
    derived algorithm visualizations (ELA, Copy-Move, Noise), findings registry,
    and methodological limitations.
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    evidence = db.query(Evidence).filter(Evidence.id == evidence_id, Evidence.case_id == case_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found in the specified case")

    # Fetch latest integrity verification
    latest_integrity = db.query(IntegrityVerification).filter(
        IntegrityVerification.evidence_id == evidence.id
    ).order_by(IntegrityVerification.verified_at.desc()).first()

    # Fetch metadata record
    metadata_rec = db.query(MetadataRecord).filter(MetadataRecord.evidence_id == evidence.id).first()
    meta_summary = json.loads(metadata_rec.extracted_summary) if metadata_rec else {}
    meta_anomalies = json.loads(metadata_rec.potential_anomalies) if metadata_rec else []

    # Fetch analyses
    analyses = db.query(Analysis).filter(Analysis.evidence_id == evidence.id).order_by(Analysis.created_at.asc()).all()

    # Fetch findings
    findings = db.query(Finding).filter(Finding.evidence_id == evidence.id).order_by(Finding.created_at.asc()).all()

    report_uuid = uuid.uuid4().hex[:8].upper()
    report_id_str = f"REP-{report_uuid}"
    output_filename = f"{report_id_str}.pdf"
    output_path = settings.REPORTS_DIR / output_filename

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=50,
        bottomMargin=55
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#0284C7'),
        spaceAfter=15
    )
    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=colors.HexColor('#1E293B'),
        spaceBefore=14,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155')
    )
    body_bold = ParagraphStyle(
        'BodyBold',
        parent=body_style,
        fontName='Helvetica-Bold'
    )
    code_style = ParagraphStyle(
        'HashStyle',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#0F172A')
    )

    story = []

    # Title & Header
    story.append(Paragraph("ImageSleuth Digital Image Forensics Report", title_style))
    story.append(Paragraph(f"Official Forensic Examination Report &bull; Document Reference: {report_id_str}", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0284C7"), spaceBefore=2, spaceAfter=12))

    # Case & Evidence Overview Table
    verif_status = latest_integrity.status if latest_integrity else "NOT RECORDED"
    verif_color = colors.HexColor("#16A34A") if verif_status == "PASS" else colors.HexColor("#DC2626")
    
    case_info_data = [
        [
            Paragraph("<b>Case Number:</b>", body_style), Paragraph(case.case_id, body_style),
            Paragraph("<b>Examination Date:</b>", body_style), Paragraph(datetime.datetime.now().strftime("%Y-%m-%d %H:%M UTC"), body_style)
        ],
        [
            Paragraph("<b>Case Title:</b>", body_style), Paragraph(case.title, body_style),
            Paragraph("<b>Examiner Name:</b>", body_style), Paragraph(case.examiner_name or "Not Specified", body_style)
        ],
        [
            Paragraph("<b>Evidence ID:</b>", body_style), Paragraph(evidence.evidence_id, body_style),
            Paragraph("<b>Original Filename:</b>", body_style), Paragraph(evidence.original_filename, body_style)
        ],
        [
            Paragraph("<b>Dimensions & Size:</b>", body_style), Paragraph(f"{evidence.width}x{evidence.height} px &bull; {evidence.file_size_bytes / 1024:.1f} KB", body_style),
            Paragraph("<b>Format / MIME:</b>", body_style), Paragraph(f"{evidence.detected_format} ({evidence.mime_type})", body_style)
        ],
        [
            Paragraph("<b>Acquisition Date:</b>", body_style), Paragraph(evidence.created_at.strftime("%Y-%m-%d %H:%M:%S UTC"), body_style),
            Paragraph("<b>Integrity Status:</b>", body_style), Paragraph(f"<font color='{verif_color.hexval()}'><b>{verif_status}</b></font>", body_style)
        ]
    ]

    t_case = Table(case_info_data, colWidths=[105, 160, 110, 155])
    t_case.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#E2E8F0")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_case)
    story.append(Spacer(1, 10))

    # Evidence Integrity Section
    story.append(Paragraph("1. Evidence Acquisition & Integrity Verification", h2_style))
    integrity_text = (
        f"The original evidence file was acquired and immediately hashed using the cryptographic SHA-256 algorithm. "
        f"All subsequent analytical processes were performed strictly on isolated working copies, preserving the original bytes unchanged."
    )
    story.append(Paragraph(integrity_text, body_style))
    story.append(Spacer(1, 5))

    integrity_table_data = [
        [Paragraph("<b>Acquisition SHA-256 Hash:</b>", body_style), Paragraph(evidence.sha256_hash, code_style)],
        [
            Paragraph("<b>Latest Recalculated Hash:</b>", body_style),
            Paragraph(latest_integrity.calculated_hash if latest_integrity else "Pending verification", code_style)
        ],
        [
            Paragraph("<b>Integrity Verification Result:</b>", body_style),
            Paragraph(
                f"<font color='{verif_color.hexval()}'><b>{verif_status}</b></font> — {latest_integrity.verification_notes if latest_integrity else 'No verification executed'}",
                body_style
            )
        ]
    ]
    t_integrity = Table(integrity_table_data, colWidths=[150, 380])
    t_integrity.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F1F5F9")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_integrity)
    story.append(Spacer(1, 12))

    # Metadata Examination Section
    story.append(Paragraph("2. Metadata Examination & Consistency Review", h2_style))
    meta_desc = (
        f"Extraction performed using <b>{metadata_rec.tool_used if metadata_rec else 'Pillow Fallback'}</b>. "
        "Metadata provides historical context regarding capture hardware, software modification stamps, and spatial tags."
    )
    story.append(Paragraph(meta_desc, body_style))
    story.append(Spacer(1, 5))

    meta_rows = [
        [Paragraph("<b>Field</b>", body_bold), Paragraph("<b>Extracted Value</b>", body_bold), Paragraph("<b>Forensic Note</b>", body_bold)]
    ]
    key_fields = [
        ("Camera Make / Model", f"{meta_summary.get('Camera Make', 'N/A')} / {meta_summary.get('Camera Model', 'N/A')}", "Identifies capture hardware if present"),
        ("Software / Editor", meta_summary.get("Software", "Not available"), "May reveal editing or conversion software"),
        ("Capture Timestamp", meta_summary.get("DateTime Original", "Not available"), "Embedded original sensor timestamp"),
        ("Modification Timestamp", meta_summary.get("DateTime Modified", "Not available"), "File modification or re-save timestamp"),
        ("Lens Info", meta_summary.get("Lens Info", "Not available"), "Optical equipment signature"),
        ("GPS Coordinates", meta_summary.get("GPS Coordinates", "Not available"), "Approximate geospatial location"),
    ]
    for field, val, note in key_fields:
        meta_rows.append([Paragraph(field, body_style), Paragraph(str(val), body_style), Paragraph(note, body_style)])

    t_meta = Table(meta_rows, colWidths=[140, 200, 190])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#E2E8F0")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_meta)

    if meta_anomalies:
        story.append(Spacer(1, 6))
        story.append(Paragraph("<b>Metadata Potential Observations:</b>", body_bold))
        for a in meta_anomalies:
            story.append(Paragraph(f"&bull; <b>[{a.get('severity', 'INFO')}]</b> {a.get('description', '')}", body_style))

    story.append(Spacer(1, 12))

    # Analytical Forensic Modules Section
    story.append(Paragraph("3. Analytical Forensic Modules & Algorithm Visualizations", h2_style))
    if not analyses:
        story.append(Paragraph("<i>No forensic algorithmic analyses were executed for this evidence record prior to report generation.</i>", body_style))
    else:
        for idx, anl in enumerate(analyses, 1):
            anl_params = json.loads(anl.parameters) if anl.parameters else {}
            anl_metrics = json.loads(anl.metrics) if anl.metrics else {}
            
            anl_box = []
            anl_box.append(Paragraph(f"<b>3.{idx} Forensic Module: {anl.analysis_type} ({anl.analysis_id})</b>", body_bold))
            anl_box.append(Spacer(1, 4))
            anl_box.append(Paragraph(f"<b>Methodology & Notes:</b> {anl.interpretation_notes}", body_style))
            anl_box.append(Spacer(1, 4))

            # Parameters and metrics summary
            param_str = ", ".join([f"{k}: {v}" for k, v in anl_params.items()])
            metric_str = ", ".join([f"{k}: {v}" for k, v in anl_metrics.items()])
            anl_box.append(Paragraph(f"<b>Parameters:</b> {param_str}", body_style))
            anl_box.append(Paragraph(f"<b>Metrics:</b> {metric_str} (Processed in {anl.duration_ms} ms)", body_style))
            anl_box.append(Spacer(1, 6))

            # Embed visualization image if it exists
            if anl.output_image_path:
                img_path = settings.DERIVED_DIR / anl.output_image_path
                if img_path.exists():
                    try:
                        # Constrain image size neatly to fit page
                        rl_img = RLImage(str(img_path), width=340, height=210)
                        anl_box.append(rl_img)
                        anl_box.append(Paragraph(f"<i>Figure 3.{idx}: Derived visualization output for {anl.analysis_type}</i>", ParagraphStyle('Cap', parent=body_style, fontSize=7, textColor=colors.HexColor('#64748B'))))
                    except Exception:
                        pass

            anl_box.append(Spacer(1, 10))
            story.append(KeepTogether(anl_box))

    # Findings Registry
    story.append(Paragraph("4. Findings Registry & Examiner Notes", h2_style))
    if not findings:
        story.append(Paragraph("<i>No individual findings were recorded for this evidence item.</i>", body_style))
    else:
        fnd_rows = [
            [Paragraph("<b>Finding ID</b>", body_bold), Paragraph("<b>Category</b>", body_bold), Paragraph("<b>Severity</b>", body_bold), Paragraph("<b>Description & Notes</b>", body_bold), Paragraph("<b>Status</b>", body_bold)]
        ]
        for f in findings:
            sev_color = colors.HexColor("#DC2626") if f.severity in ("HIGH", "CRITICAL") else (colors.HexColor("#D97706") if f.severity == "MEDIUM" else colors.HexColor("#2563EB"))
            desc_cell = f"{f.description}<br/><b>Notes:</b> {f.examiner_notes or 'None'}"
            fnd_rows.append([
                Paragraph(f.finding_id, code_style),
                Paragraph(f.category, body_style),
                Paragraph(f"<font color='{sev_color.hexval()}'><b>{f.severity}</b></font>", body_style),
                Paragraph(desc_cell, body_style),
                Paragraph(f.review_status, body_style)
            ])
        t_fnd = Table(fnd_rows, colWidths=[90, 85, 55, 230, 70])
        t_fnd.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#E2E8F0")),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E1")),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
            ('TOPPADDING', (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ('LEFTPADDING', (0,0), (-1,-1), 5),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ]))
        story.append(t_fnd)

    story.append(Spacer(1, 14))

    # Forensic Limitations & Caveats
    story.append(Paragraph("5. Forensic Limitations & Methodological Caveats", h2_style))
    disclaimer_text = (
        "<b>IMPORTANT NOTICE:</b> This report was generated by ImageSleuth for academic research, educational demonstration, "
        "and preliminary investigative triage. Automated algorithms identify statistical, geometric, or compression discrepancies; "
        "they do <b>not</b> constitute definitive proof of intentional manipulation or forensic certainty. "
        "Absence of detected anomalies does not certify authenticity. Factors such as repeated social media compression, "
        "lens aberrations, natural textures, and low-light sensor noise frequently produce anomalies in authentic images. "
        "Findings must be independently corroborated by a qualified digital forensic examiner."
    )
    story.append(Paragraph(disclaimer_text, body_style))
    story.append(Spacer(1, 15))

    # Examiner Sign-Off Block
    sign_block = [
        [
            Paragraph("<b>Examiner Signature:</b> ___________________________", body_style),
            Paragraph("<b>Verification Date:</b> ___________________________", body_style)
        ],
        [
            Paragraph(f"<b>Printed Name:</b> {case.examiner_name or 'Forensic Investigator'}", body_style),
            Paragraph("<b>Affiliation / Lab:</b> ImageSleuth Digital Forensics", body_style)
        ]
    ]
    t_sign = Table(sign_block, colWidths=[270, 260])
    t_sign.setStyle(TableStyle([
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(KeepTogether([t_sign]))

    # Build the document
    doc.build(story, canvasmaker=NumberedCanvas)

    # Save Report record in database
    report_record = Report(
        report_id=report_id_str,
        case_id=case.id,
        evidence_id=evidence.id,
        title=f"Forensic Report for {evidence.evidence_id} ({evidence.original_filename})",
        file_path=output_filename
    )
    db.add(report_record)
    db.add(ActivityLog(
        case_id=case.id,
        evidence_id=evidence.id,
        action_type="REPORT_GENERATION",
        description=f"Forensic Report {report_id_str} compiled and exported to PDF."
    ))
    db.commit()
    db.refresh(report_record)

    return report_record

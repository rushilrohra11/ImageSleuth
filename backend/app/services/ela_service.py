import io
import time
import json
import uuid
import numpy as np
from PIL import Image, ImageChops, ImageEnhance
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.core.config import settings
from app.models import Evidence, Analysis, Finding, ActivityLog
from app.services.evidence_service import get_evidence_file_path

def perform_ela(
    db: Session,
    evidence_id: int,
    quality: int = 90,
    amplification: int = 15
) -> Analysis:
    """
    Executes Error Level Analysis (ELA):
    1. Loads the original image from evidence storage (read-only).
    2. Re-encodes a working copy in-memory at target JPEG quality.
    3. Calculates absolute pixel-by-pixel difference: abs(original - recompressed).
    4. Scales error by visualization amplification factor.
    5. Saves derived forensic visualization to storage/derived.
    6. Extracts quantitative diagnostic error metrics.
    """
    start_time = time.time()

    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    if not (30 <= quality <= 99):
        raise HTTPException(status_code=400, detail="JPEG quality must be between 30 and 99")
    if not (1 <= amplification <= 50):
        raise HTTPException(status_code=400, detail="Amplification scale must be between 1 and 50")

    file_path = get_evidence_file_path(evidence)

    # 1. Load original decoded image in RGB
    try:
        with Image.open(file_path) as original_img:
            original_rgb = original_img.convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read evidence image: {str(e)}")

    # 2. Recompress in memory at specified quality
    buffer = io.BytesIO()
    original_rgb.save(buffer, format="JPEG", quality=quality)
    buffer.seek(0)
    recompressed_rgb = Image.open(buffer)

    # 3. Calculate difference using ImageChops.difference
    diff_img = ImageChops.difference(original_rgb, recompressed_rgb)

    # 4. Extract metrics from NumPy arrays
    orig_np = np.array(original_rgb, dtype=np.float32)
    recomp_np = np.array(recompressed_rgb, dtype=np.float32)
    diff_np = np.abs(orig_np - recomp_np)

    mean_error = float(np.mean(diff_np))
    max_error = float(np.max(diff_np))
    std_error = float(np.std(diff_np))

    # Calculate 95th percentile error
    p95_error = float(np.percentile(diff_np, 95))

    # 5. Amplify difference for visualization
    # Multiply by amplification factor and clip to 255
    amplified_np = np.clip(diff_np * amplification, 0, 255).astype(np.uint8)
    amplified_img = Image.fromarray(amplified_np)

    # 6. Save derived output
    analysis_uuid = uuid.uuid4().hex[:8].upper()
    analysis_id_str = f"ANL-ELA-{analysis_uuid}"
    output_filename = f"{analysis_id_str}.png"
    output_path = settings.DERIVED_DIR / output_filename

    amplified_img.save(output_path, format="PNG")

    duration_ms = round((time.time() - start_time) * 1000, 2)

    is_jpeg = evidence.detected_format == "JPEG"
    format_note = ""
    if not is_jpeg:
        format_note = (
            f"NOTE: The original evidence is {evidence.detected_format} (lossless/non-JPEG). "
            "ELA relies on DCT block quantization grid properties specific to JPEG recompression. "
            "Differences shown here reflect the introduction of lossy JPEG compression rather than historical compression levels."
        )

    interpretation = (
        f"ELA completed with recompression quality {quality}% and {amplification}x amplification. "
        f"Mean pixel error: {mean_error:.2f}, Max error: {max_error:.1f}, Std Dev: {std_error:.2f}. "
        "Brighter regions indicate areas where recompression created higher error levels compared to surrounding areas. "
        "However, high frequency edges, complex textures, saturated colors, and previous resaves naturally exhibit higher error. "
        "Findings should be cross-verified with copy-move and noise analyses."
    )
    if format_note:
        interpretation = f"{format_note} {interpretation}"

    parameters = {
        "quality": quality,
        "amplification": amplification,
        "original_format": evidence.detected_format,
        "algorithm": "JPEG Recompression Error Level Analysis"
    }

    metrics = {
        "mean_error": round(mean_error, 3),
        "max_error": round(max_error, 2),
        "std_error": round(std_error, 3),
        "p95_error": round(p95_error, 2),
        "is_lossless_source": not is_jpeg
    }

    analysis = Analysis(
        analysis_id=analysis_id_str,
        evidence_id=evidence.id,
        analysis_type="ELA",
        status="COMPLETED",
        parameters=json.dumps(parameters),
        metrics=json.dumps(metrics),
        output_image_path=output_filename,
        duration_ms=duration_ms,
        interpretation_notes=interpretation
    )
    db.add(analysis)

    # If there is noticeable variance or high localized error, record a finding
    if std_error > 8.0:
        db.add(Finding(
            finding_id=f"FND-ELA-{evidence.id}-{analysis_uuid}",
            evidence_id=evidence.id,
            analysis_id=None,
            category="POTENTIAL_ANOMALY" if is_jpeg else "OBSERVATION",
            description=f"Elevated compression error divergence observed (Std Dev: {std_error:.2f}, 95th Percentile: {p95_error:.1f}). Inspect localized high-contrast clusters.",
            supporting_data=f"Quality: {quality}%, Scale: {amplification}x, Max Error: {max_error:.1f}",
            severity="MEDIUM" if is_jpeg else "LOW",
            examiner_notes="Potential inconsistent compression grid. Confirm whether high error coincides with sharp image edges or inserted elements.",
            review_status="UNREVIEWED"
        ))

    if not is_jpeg:
        db.add(Finding(
            finding_id=f"FND-ELA-LIMIT-{evidence.id}-{analysis_uuid}",
            evidence_id=evidence.id,
            analysis_id=None,
            category="ANALYSIS_LIMITATION",
            description=f"Evidence is in {evidence.detected_format} format. Standard JPEG ELA is intended for JPEG compression history analysis.",
            supporting_data="Format: " + evidence.detected_format,
            severity="INFO",
            examiner_notes="Methodological limitation noted for examiner review.",
            review_status="CONFIRMED"
        ))

    db.add(ActivityLog(
        case_id=evidence.case_id,
        evidence_id=evidence.id,
        action_type="ANALYSIS_ELA",
        description=f"ELA executed on {evidence.evidence_id}. Mean Error: {mean_error:.2f}, Quality: {quality}%"
    ))

    db.commit()
    db.refresh(analysis)
    return analysis

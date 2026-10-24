import time
import json
import uuid
import cv2
import numpy as np
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.core.config import settings
from app.models import Evidence, Analysis, Finding, ActivityLog
from app.services.evidence_service import get_evidence_file_path

def perform_noise_analysis(
    db: Session,
    evidence_id: int,
    window_size: int = 9,
    method: str = "residual_variance"
) -> Analysis:
    """
    Executes Noise and Residual Consistency Analysis:
    1. Reads original evidence in read-only mode.
    2. Converts to high-precision grayscale float32.
    3. Suppresses high-frequency camera noise with Gaussian smoothing.
    4. Computes high-frequency residual: residual = original - smoothed.
    5. Estimates local residual variance using a box filter of size (window_size x window_size).
    6. Normalizes variance map and maps to an Inferno forensic false-color heatmap.
    7. Generates a composite visualization (original, residual, and variance heatmap).
    8. Records quantitative noise floor metrics and forensic caveats.
    """
    start_time = time.time()

    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    if window_size not in [5, 7, 9, 11, 13, 15, 21]:
        raise HTTPException(status_code=400, detail="Window size must be an odd integer between 5 and 21")

    file_path = get_evidence_file_path(evidence)

    img_bgr = cv2.imread(str(file_path))
    if img_bgr is None:
        raise HTTPException(status_code=500, detail="OpenCV failed to read the image file.")

    orig_h, orig_w = img_bgr.shape[:2]

    # Safe resizing to prevent memory exhaustion on giant images
    scale = 1.0
    max_dim = 1600
    if max(orig_h, orig_w) > max_dim:
        scale = max_dim / float(max(orig_h, orig_w))
        target_w = int(orig_w * scale)
        target_h = int(orig_h * scale)
        img_work = cv2.resize(img_bgr, (target_w, target_h), interpolation=cv2.INTER_AREA)
    else:
        img_work = img_bgr.copy()

    # 1. Convert to float32 grayscale [0, 1]
    gray = cv2.cvtColor(img_work, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0

    # 2. Gaussian smoothing to estimate underlying signal
    blurred = cv2.GaussianBlur(gray, (5, 5), sigmaX=1.0)

    # 3. High-frequency residual
    residual = gray - blurred

    # 4. Local variance estimation via box filter: Var(X) = E[X^2] - (E[X])^2
    res_sq = residual ** 2
    ksize = (window_size, window_size)
    mean_res = cv2.boxFilter(residual, -1, ksize, borderType=cv2.BORDER_REFLECT)
    mean_res_sq = cv2.boxFilter(res_sq, -1, ksize, borderType=cv2.BORDER_REFLECT)
    local_var = np.maximum(0.0, mean_res_sq - (mean_res ** 2))

    # Standard deviation map (noise amplitude)
    local_std = np.sqrt(local_var)

    # Compute global quantitative statistics
    mean_noise_level = float(np.mean(local_std))
    max_noise_level = float(np.max(local_std))
    min_noise_level = float(np.min(local_std))
    std_noise_level = float(np.std(local_std))
    p95_noise = float(np.percentile(local_std, 95))

    # 5. Normalize variance map for visualization [0, 255]
    if max_noise_level > min_noise_level:
        # Use 98th percentile for robust contrast stretching against extreme specular highlights
        p98 = float(np.percentile(local_std, 98))
        norm_std = np.clip((local_std / (p98 + 1e-6)) * 255.0, 0, 255).astype(np.uint8)
    else:
        norm_std = np.zeros_like(local_std, dtype=np.uint8)

    # Apply INFERNO false-color palette
    heatmap_bgr = cv2.applyColorMap(norm_std, cv2.COLORMAP_INFERNO)

    # Residual visualization [0, 255] centered at 128
    res_display = np.clip((residual * 5.0 + 0.5) * 255.0, 0, 255).astype(np.uint8)
    res_bgr = cv2.cvtColor(res_display, cv2.COLOR_GRAY2BGR)

    # Save output visualization (heatmap)
    analysis_uuid = uuid.uuid4().hex[:8].upper()
    analysis_id_str = f"ANL-NSE-{analysis_uuid}"
    output_filename = f"{analysis_id_str}.png"
    output_path = settings.DERIVED_DIR / output_filename

    # Blend original slightly with heatmap (70% heatmap + 30% original) or save side-by-side
    # Side-by-side: original | residual | heatmap
    # Let's save the high-resolution false-color heatmap directly so user can inspect overlays
    cv2.imwrite(str(output_path), heatmap_bgr)

    duration_ms = round((time.time() - start_time) * 1000, 2)

    parameters = {
        "window_size": window_size,
        "method": method,
        "filter": "Gaussian 5x5 (sigma=1.0)",
        "colormap": "INFERNO (low=black/purple, high=yellow/white)",
        "scale_applied": round(scale, 3)
    }

    metrics = {
        "mean_noise_std": round(mean_noise_level, 5),
        "max_noise_std": round(max_noise_level, 5),
        "std_noise_variation": round(std_noise_level, 5),
        "p95_noise_level": round(p95_noise, 5),
        "processing_resolution": f"{img_work.shape[1]}x{img_work.shape[0]}"
    }

    interpretation = (
        f"Local residual noise analysis completed with {window_size}x{window_size} window. "
        f"Mean noise amplitude: {mean_noise_level:.4f}, Spatial variance std: {std_noise_level:.4f}. "
        "Warmer colors (orange/yellow/white) depict regions with higher local high-frequency residual energy. "
        "Cooler colors (dark purple/black) represent smoother or low-noise regions. "
        "LIMITATION: This is a high-frequency residual variance map, not sensor PRNU fingerprinting. "
        "Depth of field (bokeh blur), motion blur, flat skies, and texture differences naturally produce large noise floor variations."
    )

    analysis = Analysis(
        analysis_id=analysis_id_str,
        evidence_id=evidence.id,
        analysis_type="NOISE",
        status="COMPLETED",
        parameters=json.dumps(parameters),
        metrics=json.dumps(metrics),
        output_image_path=output_filename,
        duration_ms=duration_ms,
        interpretation_notes=interpretation
    )
    db.add(analysis)

    # Flag anomaly if noise variation across regions is abnormally heterogeneous
    if std_noise_level > 0.04:
        db.add(Finding(
            finding_id=f"FND-NSE-{evidence.id}-{analysis_uuid}",
            evidence_id=evidence.id,
            analysis_id=None,
            category="POTENTIAL_ANOMALY",
            description=f"Significant spatial heterogeneity in local noise variance (Std Dev: {std_noise_level:.4f}). Distinct regions exhibit divergent noise floors.",
            supporting_data=f"Window: {window_size}x{window_size}, Mean: {mean_noise_level:.4f}, 95th Percentile: {p95_noise:.4f}",
            severity="LOW",
            examiner_notes="Examine whether noise boundaries correlate with semantic edges or pasted objects versus natural depth-of-field blur.",
            review_status="UNREVIEWED"
        ))
    else:
        db.add(Finding(
            finding_id=f"FND-NSE-HOMO-{evidence.id}-{analysis_uuid}",
            evidence_id=evidence.id,
            analysis_id=None,
            category="OBSERVATION",
            description=f"Relatively homogeneous residual noise distribution across the image plane (Std Dev: {std_noise_level:.4f}).",
            supporting_data=f"Mean Noise: {mean_noise_level:.4f}",
            severity="INFO",
            examiner_notes="Uniform noise floor observed under current spatial parameters.",
            review_status="CONFIRMED"
        ))

    db.add(ActivityLog(
        case_id=evidence.case_id,
        evidence_id=evidence.id,
        action_type="ANALYSIS_NOISE",
        description=f"Noise consistency analysis executed on {evidence.evidence_id}. Window: {window_size}x{window_size}"
    ))

    db.commit()
    db.refresh(analysis)
    return analysis

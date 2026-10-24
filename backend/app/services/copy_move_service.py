import time
import json
import uuid
from pathlib import Path
import cv2
import numpy as np
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.core.config import settings
from app.models import Evidence, Analysis, Finding, ActivityLog
from app.services.evidence_service import get_evidence_file_path

def perform_copy_move_detection(
    db: Session,
    evidence_id: int,
    method: str = "SIFT",  # SIFT or ORB
    max_keypoints: int = 2500,
    ratio: float = 0.75,
    min_distance: int = 35
) -> Analysis:
    """
    Executes Copy-Move Forgery Detection:
    1. Reads original evidence image in read-only mode.
    2. Resizes safely if dimension exceeds 1600px for computational bounds.
    3. Detects keypoints and computes local invariant descriptors using SIFT or ORB.
    4. Performs self-matching using k-NN with spatial separation pruning.
    5. Filters candidate matches using Lowe's ratio test and geometric distance.
    6. Overlays retained vector matches and keypoint circles.
    7. Saves derived forensic visualization to storage/derived.
    8. Records diagnostic counts and methodological limitations.
    """
    start_time = time.time()

    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    file_path = get_evidence_file_path(evidence)

    # Load image using OpenCV
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

    gray = cv2.cvtColor(img_work, cv2.COLOR_BGR2GRAY)

    # Initialize feature detector
    method_upper = method.upper()
    detector = None
    matcher = None

    if method_upper == "SIFT":
        try:
            detector = cv2.SIFT_create(nfeatures=max_keypoints)
            matcher = cv2.BFMatcher(cv2.NORM_L2)
        except Exception:
            # Fallback to ORB if SIFT not available in current build
            method_upper = "ORB"

    if method_upper == "ORB":
        detector = cv2.ORB_create(nfeatures=max_keypoints)
        matcher = cv2.BFMatcher(cv2.NORM_HAMMING)

    keypoints, descriptors = detector.detectAndCompute(gray, None)
    num_keypoints = len(keypoints) if keypoints is not None else 0

    retained_matches: list[tuple[cv2.KeyPoint, cv2.KeyPoint, float]] = []
    candidate_matches_count = 0

    if descriptors is not None and len(descriptors) > 5:
        # We need k-nearest neighbors within the same descriptor set.
        # k=4 because:
        # neighbor 0 is identical descriptor itself (distance = 0)
        # neighbor 1 is nearest other keypoint
        # neighbor 2 is second nearest (used for ratio test)
        # neighbor 3 is third nearest
        knn_matches = matcher.knnMatch(descriptors, descriptors, k=min(4, len(descriptors)))

        # Adjust minimum distance in scaled pixels
        scaled_min_dist = max(10.0, float(min_distance) * scale)

        visited_pairs = set()

        for match_group in knn_matches:
            if len(match_group) < 3:
                continue
            # match_group[0] is self-match (dist 0)
            # Find the first neighbor that is spatially separated beyond scaled_min_dist
            first_match = None
            second_match = None

            query_kp = keypoints[match_group[0].queryIdx]
            q_pt = np.array(query_kp.pt)

            for m in match_group[1:]:
                train_kp = keypoints[m.trainIdx]
                t_pt = np.array(train_kp.pt)
                spatial_dist = float(np.linalg.norm(q_pt - t_pt))

                if spatial_dist >= scaled_min_dist:
                    if first_match is None:
                        first_match = (m, spatial_dist)
                    elif second_match is None:
                        second_match = m
                        break

            if first_match is not None:
                candidate_matches_count += 1
                m1, sp_dist = first_match

                # Ratio test
                is_valid_ratio = False
                if second_match is not None and second_match.distance > 0:
                    if (m1.distance / second_match.distance) < ratio:
                        is_valid_ratio = True
                elif m1.distance < 50.0:  # low distance threshold if no 2nd neighbor
                    is_valid_ratio = True

                if is_valid_ratio:
                    idx1 = min(m1.queryIdx, m1.trainIdx)
                    idx2 = max(m1.queryIdx, m1.trainIdx)
                    if (idx1, idx2) not in visited_pairs:
                        visited_pairs.add((idx1, idx2))
                        kp1 = keypoints[m1.queryIdx]
                        kp2 = keypoints[m1.trainIdx]
                        retained_matches.append((kp1, kp2, sp_dist))

    # Draw visualization overlay
    vis_img = img_work.copy()

    # Draw all keypoints subtly in dim cyan
    for kp in (keypoints or [])[:800]:
        x, y = int(kp.pt[0]), int(kp.pt[1])
        cv2.circle(vis_img, (x, y), 2, (180, 180, 60), 1)

    # Draw retained matching pairs with distinct colored lines & circles
    palette = [
        (0, 240, 255),    # Cyan/Yellow
        (0, 165, 255),    # Orange
        (50, 205, 50),    # Lime green
        (255, 105, 180),  # Pink
        (255, 215, 0),    # Gold
        (138, 43, 226)    # Purple
    ]

    for i, (kp1, kp2, sp_dist) in enumerate(retained_matches[:120]):
        color = palette[i % len(palette)]
        pt1 = (int(kp1.pt[0]), int(kp1.pt[1]))
        pt2 = (int(kp2.pt[0]), int(kp2.pt[1]))

        # Line connecting paired regions
        cv2.line(vis_img, pt1, pt2, color, 2, cv2.LINE_AA)
        # Endpoints
        cv2.circle(vis_img, pt1, 5, color, -1)
        cv2.circle(vis_img, pt2, 5, color, -1)
        cv2.circle(vis_img, pt1, 7, (255, 255, 255), 1)
        cv2.circle(vis_img, pt2, 7, (255, 255, 255), 1)

    # Save derived visualization
    analysis_uuid = uuid.uuid4().hex[:8].upper()
    analysis_id_str = f"ANL-CPM-{analysis_uuid}"
    output_filename = f"{analysis_id_str}.png"
    output_path = settings.DERIVED_DIR / output_filename
    cv2.imwrite(str(output_path), vis_img)

    duration_ms = round((time.time() - start_time) * 1000, 2)
    num_retained = len(retained_matches)

    parameters = {
        "method": method_upper,
        "max_keypoints": max_keypoints,
        "ratio_threshold": ratio,
        "min_spatial_distance_px": min_distance,
        "scale_applied": round(scale, 3)
    }

    metrics = {
        "total_keypoints": num_keypoints,
        "candidate_matches": candidate_matches_count,
        "retained_matches": num_retained,
        "processing_resolution": f"{img_work.shape[1]}x{img_work.shape[0]}"
    }

    if num_retained >= 15:
        verdict = "Multiple geometrically separated feature clusters identified. Potential region duplication / copy-move anomaly requiring detailed manual review."
    elif num_retained >= 5:
        verdict = f"{num_retained} isolated feature matches retained. Could indicate repetitive natural textures (e.g. windows, leaves, tiles) or partial cloned patches."
    else:
        verdict = "No convincing duplicated feature clusters identified under current parameters. Does not prove the absence of manipulation or seamless blending."

    interpretation = (
        f"{method_upper} feature matching completed. {num_keypoints} keypoints detected, {num_retained} candidate pairs retained. "
        f"{verdict} "
        "LIMITATION: Natural scene self-similarity, symmetric architecture, repetitive wallpapers, and foliage naturally produce matching features. "
        "Automated matching alone is not conclusive evidence of forgery."
    )

    analysis = Analysis(
        analysis_id=analysis_id_str,
        evidence_id=evidence.id,
        analysis_type="COPY_MOVE",
        status="COMPLETED",
        parameters=json.dumps(parameters),
        metrics=json.dumps(metrics),
        output_image_path=output_filename,
        duration_ms=duration_ms,
        interpretation_notes=interpretation
    )
    db.add(analysis)

    # Auto-generate finding if retained matches exceed threshold
    if num_retained >= 15:
        db.add(Finding(
            finding_id=f"FND-CPM-{evidence.id}-{analysis_uuid}",
            evidence_id=evidence.id,
            analysis_id=None,
            category="POTENTIAL_ANOMALY",
            description=f"Significant feature duplication detected: {num_retained} retained {method_upper} keypoint pairs with spatial separation.",
            supporting_data=f"Method: {method_upper}, Retained: {num_retained}, Total Keypoints: {num_keypoints}",
            severity="MEDIUM",
            examiner_notes="Investigate whether duplicated clusters align with identical objects or cloned image areas.",
            review_status="UNREVIEWED"
        ))
    elif num_retained > 0:
        db.add(Finding(
            finding_id=f"FND-CPM-OBS-{evidence.id}-{analysis_uuid}",
            evidence_id=evidence.id,
            analysis_id=None,
            category="OBSERVATION",
            description=f"{num_retained} localized feature match pairs detected. Potential texture self-similarity.",
            supporting_data=f"Method: {method_upper}, Matches: {num_retained}",
            severity="LOW",
            examiner_notes="Verify if matches correspond to natural patterns or architectural repetition.",
            review_status="UNREVIEWED"
        ))
    else:
        db.add(Finding(
            finding_id=f"FND-CPM-NONE-{evidence.id}-{analysis_uuid}",
            evidence_id=evidence.id,
            analysis_id=None,
            category="INFORMATIONAL",
            description=f"No matching feature clusters detected by {method_upper} with spatial separation >= {min_distance}px.",
            supporting_data=f"Keypoints evaluated: {num_keypoints}",
            severity="INFO",
            examiner_notes="No copy-move regions identified under these parameters. Advanced retouching with rotation or scaling may evade detection.",
            review_status="CONFIRMED"
        ))

    db.add(ActivityLog(
        case_id=evidence.case_id,
        evidence_id=evidence.id,
        action_type="ANALYSIS_COPY_MOVE",
        description=f"Copy-Move analysis ({method_upper}) on {evidence.evidence_id}: {num_retained} matches found."
    ))

    db.commit()
    db.refresh(analysis)
    return analysis

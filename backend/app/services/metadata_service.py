import json
import subprocess
import shutil
from pathlib import Path
from PIL import Image, ExifTags
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models import Evidence, MetadataRecord, Finding, ActivityLog
from app.services.evidence_service import get_evidence_file_path

EDITING_SOFTWARE_KEYWORDS = [
    "photoshop", "gimp", "canva", "lightroom", "snapseed", "affinity",
    "corel", "paint.net", "vsco", "pixlr", "picsart", "adobe", "apple photos"
]

def format_gps_coordinates(gps_info: dict) -> dict | None:
    """Safely parse and format EXIF GPS tags into decimal and DMS representation."""
    try:
        def convert_to_degrees(value):
            if isinstance(value, tuple) or isinstance(value, list):
                d = float(value[0])
                m = float(value[1])
                s = float(value[2])
                return d + (m / 60.0) + (s / 3600.0)
            return float(value)

        lat = None
        lon = None

        # GPS Tag IDs
        # 1: GPSLatitudeRef, 2: GPSLatitude, 3: GPSLongitudeRef, 4: GPSLongitude
        lat_ref = gps_info.get(1) or gps_info.get("GPSLatitudeRef")
        raw_lat = gps_info.get(2) or gps_info.get("GPSLatitude")
        lon_ref = gps_info.get(3) or gps_info.get("GPSLongitudeRef")
        raw_lon = gps_info.get(4) or gps_info.get("GPSLongitude")

        if raw_lat and raw_lon:
            lat = convert_to_degrees(raw_lat)
            if lat_ref and str(lat_ref).upper() == "S":
                lat = -lat
            lon = convert_to_degrees(raw_lon)
            if lon_ref and str(lon_ref).upper() == "W":
                lon = -lon

            return {
                "latitude": round(lat, 6),
                "longitude": round(lon, 6),
                "dms_display": f"{abs(lat):.4f}° {'N' if lat >= 0 else 'S'}, {abs(lon):.4f}° {'E' if lon >= 0 else 'W'}",
                "privacy_note": "Coordinates approximate. Exact location should be handled under confidentiality protocols."
            }
    except Exception:
        pass
    return None

def extract_with_exiftool(file_path: Path) -> dict | None:
    """Attempt extraction using ExifTool CLI if installed."""
    exiftool_cmd = shutil.which("exiftool")
    if not exiftool_cmd:
        return None

    try:
        cmd = [exiftool_cmd, "-j", "-G", str(file_path)]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            data = json.loads(result.stdout)
            if data and len(data) > 0:
                return data[0]
    except Exception:
        pass
    return None

def extract_with_pillow(file_path: Path, evidence: Evidence) -> tuple[dict, dict, list]:
    """
    Forensic fallback metadata extraction using Pillow.
    Extracts standard EXIF, IPTC, XMP and file structural properties.
    """
    raw_metadata: dict = {}
    extracted_summary: dict = {
        "File Format": evidence.detected_format,
        "MIME Type": evidence.mime_type,
        "Dimensions": f"{evidence.width} x {evidence.height} px",
        "Color Mode": "Unknown",
        "Camera Make": "Not available",
        "Camera Model": "Not available",
        "Lens Info": "Not available",
        "Software": "Not available",
        "DateTime Original": "Not available",
        "DateTime Digitized": "Not available",
        "DateTime Modified": "Not available",
        "Orientation": "Normal (1)",
        "Color Space": "Not available",
        "Focal Length": "Not available",
        "Exposure Time": "Not available",
        "F-Number": "Not available",
        "ISO Speed": "Not available",
        "Flash": "Not available",
        "GPS Coordinates": "Not available"
    }
    anomalies: list[dict] = []

    try:
        with Image.open(file_path) as img:
            extracted_summary["Color Mode"] = img.mode

            # Structural properties
            info = img.info or {}
            for k, v in info.items():
                if k != "exif":
                    raw_metadata[f"Info:{k}"] = str(v)[:500]

            # EXIF extraction
            exif_raw = img.getexif()
            if exif_raw:
                for tag_id, val in exif_raw.items():
                    tag_name = ExifTags.TAGS.get(tag_id, f"Tag_{tag_id}")
                    if isinstance(val, bytes):
                        val_str = f"<{len(val)} bytes binary data>"
                    else:
                        val_str = str(val)
                    raw_metadata[f"EXIF:{tag_name}"] = val_str

                # Detailed EXIF tags
                make = exif_raw.get(271)  # Make
                model = exif_raw.get(272)  # Model
                software = exif_raw.get(305)  # Software
                date_time = exif_raw.get(306)  # DateTime
                orientation = exif_raw.get(274)  # Orientation

                if make: extracted_summary["Camera Make"] = str(make).strip()
                if model: extracted_summary["Camera Model"] = str(model).strip()
                if software: extracted_summary["Software"] = str(software).strip()
                if date_time: extracted_summary["DateTime Modified"] = str(date_time).strip()
                if orientation: extracted_summary["Orientation"] = str(orientation)

                # SubIFD (ExifOffset: 34665)
                try:
                    for ifd_id in (34665, 34853):  # ExifIFD, GPSIFD
                        ifd_data = exif_raw.get_ifd(ifd_id)
                        if ifd_data:
                            prefix = "EXIF_SUB" if ifd_id == 34665 else "GPS"
                            for sub_tag_id, sub_val in ifd_data.items():
                                sub_name = ExifTags.TAGS.get(sub_tag_id, ExifTags.GPSTAGS.get(sub_tag_id, f"SubTag_{sub_tag_id}"))
                                raw_metadata[f"{prefix}:{sub_name}"] = str(sub_val)[:500]

                            if ifd_id == 34665:
                                dt_orig = ifd_data.get(36867)  # DateTimeOriginal
                                dt_dig = ifd_data.get(36868)   # DateTimeDigitized
                                lens = ifd_data.get(42036)     # LensModel
                                if dt_orig: extracted_summary["DateTime Original"] = str(dt_orig).strip()
                                if dt_dig: extracted_summary["DateTime Digitized"] = str(dt_dig).strip()
                                if lens: extracted_summary["Lens Info"] = str(lens).strip()

                            if ifd_id == 34853:
                                gps_coords = format_gps_coordinates(ifd_data)
                                if gps_coords:
                                    extracted_summary["GPS Coordinates"] = gps_coords["dms_display"]
                                    raw_metadata["Parsed_GPS"] = gps_coords
                except Exception:
                    pass

    except Exception as e:
        anomalies.append({
            "type": "METADATA_READ_ERROR",
            "field": "Header",
            "description": f"Encountered non-critical warning during metadata parsing: {str(e)}",
            "severity": "LOW"
        })

    # Anomaly Review Logic
    # 1. Check software tags for image editing tools
    soft = extracted_summary.get("Software", "").lower()
    if soft != "not available":
        for kw in EDITING_SOFTWARE_KEYWORDS:
            if kw in soft:
                anomalies.append({
                    "type": "EDITING_SOFTWARE_DETECTED",
                    "field": "Software",
                    "description": f"Image metadata references editing/export software: '{extracted_summary['Software']}'. Does not confirm malicious manipulation, but indicates the image was processed or re-saved.",
                    "severity": "MEDIUM"
                })
                break

    # 2. Check timestamp discrepancy
    dt_orig = extracted_summary.get("DateTime Original")
    dt_mod = extracted_summary.get("DateTime Modified")
    if dt_orig != "Not available" and dt_mod != "Not available" and dt_orig != dt_mod:
        anomalies.append({
            "type": "TIMESTAMP_DISCREPANCY",
            "field": "Timestamps",
            "description": f"Original capture timestamp ({dt_orig}) differs from modification timestamp ({dt_mod}). Indicates post-capture modification or export.",
            "severity": "LOW"
        })

    # 3. Stripped metadata observation
    if extracted_summary.get("Camera Make") == "Not available" and extracted_summary.get("DateTime Original") == "Not available":
        anomalies.append({
            "type": "STRIPPED_OR_MISSING_EXIF",
            "field": "EXIF",
            "description": "No camera hardware or original capture timestamps found. Common in images downloaded from social media platforms, messaging apps, or saved via web export.",
            "severity": "INFO"
        })

    return raw_metadata, extracted_summary, anomalies

def examine_metadata(db: Session, evidence_id: int) -> MetadataRecord:
    """
    Executes forensic metadata examination.
    Uses ExifTool if available; otherwise falls back gracefully to Pillow extraction.
    Creates or updates the MetadataRecord and records associated Findings.
    """
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    file_path = get_evidence_file_path(evidence)

    exiftool_res = extract_with_exiftool(file_path)
    tool_used = "exiftool" if exiftool_res else "pillow_fallback"

    if exiftool_res:
        # Exiftool output
        raw_metadata = {str(k): str(v) for k, v in exiftool_res.items()}
        extracted_summary = {
            "File Format": exiftool_res.get("File:FileType", evidence.detected_format),
            "MIME Type": exiftool_res.get("File:MIMEType", evidence.mime_type),
            "Dimensions": f"{exiftool_res.get('File:ImageWidth', evidence.width)} x {exiftool_res.get('File:ImageHeight', evidence.height)} px",
            "Color Mode": str(exiftool_res.get("File:ColorComponents", "Unknown")),
            "Camera Make": str(exiftool_res.get("EXIF:Make", "Not available")),
            "Camera Model": str(exiftool_res.get("EXIF:Model", "Not available")),
            "Lens Info": str(exiftool_res.get("EXIF:LensModel", "Not available")),
            "Software": str(exiftool_res.get("EXIF:Software", "Not available")),
            "DateTime Original": str(exiftool_res.get("EXIF:DateTimeOriginal", "Not available")),
            "DateTime Digitized": str(exiftool_res.get("EXIF:CreateDate", "Not available")),
            "DateTime Modified": str(exiftool_res.get("File:FileModifyDate", "Not available")),
            "Orientation": str(exiftool_res.get("EXIF:Orientation", "Normal")),
            "GPS Coordinates": str(exiftool_res.get("Composite:GPSPosition", "Not available")),
        }
        anomalies = []
        soft = extracted_summary.get("Software", "").lower()
        if soft != "not available":
            for kw in EDITING_SOFTWARE_KEYWORDS:
                if kw in soft:
                    anomalies.append({
                        "type": "EDITING_SOFTWARE_DETECTED",
                        "field": "Software",
                        "description": f"ExifTool detected editing software signature: '{extracted_summary['Software']}'.",
                        "severity": "MEDIUM"
                    })
                    break
    else:
        raw_metadata, extracted_summary, anomalies = extract_with_pillow(file_path, evidence)

    # Save or update MetadataRecord
    record = db.query(MetadataRecord).filter(MetadataRecord.evidence_id == evidence.id).first()
    if not record:
        record = MetadataRecord(
            evidence_id=evidence.id,
            tool_used=tool_used,
            raw_metadata=json.dumps(raw_metadata),
            extracted_summary=json.dumps(extracted_summary),
            potential_anomalies=json.dumps(anomalies)
        )
        db.add(record)
    else:
        record.tool_used = tool_used
        record.raw_metadata = json.dumps(raw_metadata)
        record.extracted_summary = json.dumps(extracted_summary)
        record.potential_anomalies = json.dumps(anomalies)

    # Auto-generate findings for detected anomalies
    for idx, anomaly in enumerate(anomalies):
        fnd_id = f"FND-META-{evidence.id}-{idx+1}"
        existing_fnd = db.query(Finding).filter(Finding.finding_id == fnd_id).first()
        if not existing_fnd:
            db.add(Finding(
                finding_id=fnd_id,
                evidence_id=evidence.id,
                category="POTENTIAL_ANOMALY" if anomaly.get("severity") in ("MEDIUM", "HIGH") else "OBSERVATION",
                description=anomaly["description"],
                supporting_data=f"Field: {anomaly.get('field')} | Tool: {tool_used}",
                severity=anomaly.get("severity", "INFO"),
                examiner_notes="Flagged during automated metadata extraction review.",
                review_status="UNREVIEWED"
            ))

    db.add(ActivityLog(
        case_id=evidence.case_id,
        evidence_id=evidence.id,
        action_type="METADATA_EXAMINATION",
        description=f"Metadata examined using {tool_used}. {len(anomalies)} potential observation(s) noted."
    ))

    db.commit()
    db.refresh(record)
    return record

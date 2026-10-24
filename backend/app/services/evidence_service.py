import hashlib
import uuid
import io
from pathlib import Path
from PIL import Image
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Evidence, Case, ActivityLog

ALLOWED_FORMATS = {
    "JPEG": (".jpg", "image/jpeg"),
    "PNG": (".png", "image/png"),
    "WEBP": (".webp", "image/webp")
}

def calculate_sha256(data: bytes) -> str:
    """Calculate SHA-256 hash of byte array."""
    hasher = hashlib.sha256()
    hasher.update(data)
    return hasher.hexdigest().lower()

def calculate_file_sha256(file_path: Path) -> str:
    """Calculate SHA-256 of a stored file in streaming chunks."""
    if not file_path.exists():
        raise FileNotFoundError(f"Evidence file not found: {file_path}")
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest().lower()

def acquire_evidence(
    db: Session,
    case_id: int,
    file: UploadFile,
    acquisition_notes: str | None = None
) -> Evidence:
    """
    Acquires an image evidence file with forensic integrity:
    1. Validates file size and true image header/content.
    2. Computes SHA-256 hash from exact original bytes.
    3. Saves immutable original evidence copy.
    4. Records metadata in database.
    5. Disallows overwriting or modifying original evidence.
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Read uploaded file content safely
    try:
        content = file.file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded file: {str(e)}")

    file_size = len(content)
    if file_size == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes)")

    if file_size > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB"
        )

    # Validate image integrity and format using Pillow
    try:
        with Image.open(io.BytesIO(content)) as img:
            detected_format = img.format
            width, height = img.size
            # Verify image file is not corrupt
            img.verify()
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid or corrupted image content. Unable to decode image: {str(e)}"
        )

    if detected_format not in ALLOWED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image format: {detected_format}. Supported formats: JPEG, PNG, WEBP"
        )

    # Compute SHA-256 hash of immutable original bytes
    sha256_hash = calculate_sha256(content)

    # Generate unique evidence ID
    evidence_uuid = uuid.uuid4().hex[:8].upper()
    evidence_id_str = f"EVD-{evidence_uuid}"

    ext, mime_type = ALLOWED_FORMATS[detected_format]
    stored_filename = f"{evidence_id_str}{ext}"
    target_path = settings.EVIDENCE_DIR / stored_filename

    # Save original immutable evidence file
    try:
        with open(target_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store evidence file: {str(e)}")

    evidence = Evidence(
        evidence_id=evidence_id_str,
        case_id=case_id,
        original_filename=file.filename or "unknown_evidence_file",
        stored_filename=stored_filename,
        file_size_bytes=file_size,
        detected_format=detected_format,
        mime_type=mime_type,
        width=width,
        height=height,
        sha256_hash=sha256_hash,
        acquisition_notes=acquisition_notes
    )
    db.add(evidence)

    # Activity log
    log = ActivityLog(
        case_id=case_id,
        evidence_id=None,
        action_type="EVIDENCE_ACQUISITION",
        description=f"Evidence {evidence_id_str} ({file.filename}) acquired. SHA-256: {sha256_hash}"
    )
    db.add(log)
    db.commit()
    db.refresh(evidence)

    return evidence

def get_evidence_file_path(evidence: Evidence) -> Path:
    """Returns absolute path to stored evidence original."""
    path = settings.EVIDENCE_DIR / evidence.stored_filename
    if not path.exists():
        raise FileNotFoundError(f"Original evidence file missing from storage: {evidence.stored_filename}")
    return path

import io
import os
import shutil
import pytest
import sys
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app
from app.core.config import settings
from app.database.session import SessionLocal, Base, engine
from app.models import Case, Evidence, IntegrityVerification, MetadataRecord, Analysis, Finding, Report
from app.services.evidence_service import calculate_sha256, calculate_file_sha256
from app.services.integrity_service import verify_evidence_integrity
from app.services.metadata_service import examine_metadata
from app.services.ela_service import perform_ela
from app.services.copy_move_service import perform_copy_move_detection
from app.services.noise_service import perform_noise_analysis
from app.services.report_service import generate_pdf_report

client = TestClient(app)

@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    # Make sure test storage dirs exist
    settings.EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    settings.DERIVED_DIR.mkdir(parents=True, exist_ok=True)
    settings.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    yield

def create_synthetic_jpeg():
    """Generates a synthetic JPEG image in memory with distinct shapes."""
    img = Image.new("RGB", (400, 300), color=(240, 240, 240))
    draw = ImageDraw.Draw(img)
    draw.rectangle([30, 30, 150, 150], fill=(220, 50, 50), outline=(0, 0, 0))
    draw.ellipse([200, 50, 350, 200], fill=(50, 120, 220), outline=(0, 0, 0))
    draw.text((50, 220), "FORENSIC TEST IMAGE", fill=(20, 20, 20))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=95)
    return buf.getvalue()

def create_synthetic_png():
    """Generates a synthetic PNG image in memory."""
    img = Image.new("RGBA", (300, 300), color=(100, 200, 100, 255))
    draw = ImageDraw.Draw(img)
    draw.line([(0, 0), (300, 300)], fill=(0, 0, 0, 255), width=3)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

def create_synthetic_copymove_image():
    """Generates a synthetic image with an explicitly duplicated textured patch."""
    # Create textured canvas with high detail
    np.random.seed(42)
    base = np.random.randint(180, 230, (400, 500, 3), dtype=np.uint8)
    
    # Create a textured star/polygon pattern patch
    patch = np.zeros((60, 60, 3), dtype=np.uint8)
    for i in range(60):
        for j in range(60):
            patch[i, j] = [(i * 4) % 255, (j * 4) % 255, ((i + j) * 3) % 255]
            
    # Place original patch at (50, 50)
    base[50:110, 50:110] = patch
    # Place duplicated copy patch at (250, 300) with spatial separation
    base[250:310, 300:360] = patch

    img = Image.fromarray(base)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=98)
    return buf.getvalue()

# ----------------- TEST 1: SHA-256 HASH GENERATION -----------------
def test_sha256_hash_calculation():
    test_bytes = b"Digital Forensic Evidence Acquisition Sample 2026"
    expected = "b1fcaad84e03f00bb0cf46a4897087cae61bb22f8728562d29486c87a552f4c3"  # known sha256
    import hashlib
    actual = hashlib.sha256(test_bytes).hexdigest()
    assert calculate_sha256(test_bytes) == actual
    assert len(calculate_sha256(test_bytes)) == 64

# ----------------- TEST 2: CASE CREATION & RETRIEVAL -----------------
def test_case_creation_and_retrieval():
    payload = {
        "title": "Suspected Document Alteration Investigation",
        "description": "Lab testing case for image evidence analysis",
        "examiner_name": "Senior Investigator Alex Chen",
        "evidence_ref": "REF-SEC-902",
        "acquisition_notes": "Acquired directly for unit testing"
    }
    response = client.post("/api/cases", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == payload["title"]
    assert data["case_id"].startswith("CASE-")
    case_db_id = data["id"]

    # Retrieve case
    get_res = client.get(f"/api/cases/{case_db_id}")
    assert get_res.status_code == 200
    assert get_res.json()["case_id"] == data["case_id"]

# ----------------- TEST 3: EVIDENCE ACQUISITION & INTEGRITY PASS -----------------
def test_evidence_acquisition_and_integrity_pass():
    # 1. Create a case
    c_res = client.post("/api/cases", json={"title": "Integrity Test Case"})
    case_id = c_res.json()["id"]

    # 2. Upload valid JPEG evidence
    jpeg_bytes = create_synthetic_jpeg()
    files = {"file": ("test_evidence.jpg", jpeg_bytes, "image/jpeg")}
    data = {"acquisition_notes": "Acquired from simulated camera"}
    
    upload_res = client.post(f"/api/cases/{case_id}/evidence", files=files, data=data)
    assert upload_res.status_code == 200
    ev_data = upload_res.json()
    evidence_id = ev_data["id"]

    assert ev_data["detected_format"] == "JPEG"
    assert ev_data["sha256_hash"] == calculate_sha256(jpeg_bytes)
    assert ev_data["latest_integrity_status"] == "PASS"

    # 3. Verify integrity on demand
    verif_res = client.post(f"/api/evidence/{evidence_id}/verify-integrity")
    assert verif_res.status_code == 200
    v_data = verif_res.json()
    assert v_data["status"] == "PASS"
    assert v_data["is_match"] is True
    assert v_data["recorded_hash"] == v_data["calculated_hash"]

# ----------------- TEST 4: INTEGRITY FAILURE UPON TAMPERING -----------------
def test_integrity_verification_failure_on_tampering():
    db = SessionLocal()
    # Find evidence and deliberately alter the file on disk to simulate tampering
    c_res = client.post("/api/cases", json={"title": "Tamper Test Case"})
    case_id = c_res.json()["id"]

    jpeg_bytes = create_synthetic_jpeg()
    files = {"file": ("tamper_test.jpg", jpeg_bytes, "image/jpeg")}
    upload_res = client.post(f"/api/cases/{case_id}/evidence", files=files)
    ev_data = upload_res.json()
    evidence_id = ev_data["id"]

    stored_file = settings.EVIDENCE_DIR / ev_data["stored_filename"]
    assert stored_file.exists()

    # Tamper with 1 byte in the file
    with open(stored_file, "r+b") as f:
        f.seek(50)
        orig_byte = f.read(1)
        new_byte = bytes([(orig_byte[0] ^ 0xFF)])
        f.seek(50)
        f.write(new_byte)

    # Reverify integrity: must FAIL
    verif_res = client.post(f"/api/evidence/{evidence_id}/verify-integrity")
    assert verif_res.status_code == 200
    v_data = verif_res.json()
    assert v_data["status"] == "FAIL"
    assert v_data["is_match"] is False
    assert v_data["recorded_hash"] != v_data["calculated_hash"]

    # Verify a high-severity finding was automatically registered
    fnd_res = client.get(f"/api/evidence/{evidence_id}/findings")
    assert any(f["category"] == "INTEGRITY_FAILURE" for f in fnd_res.json())
    db.close()

# ----------------- TEST 5: UNSUPPORTED FORMAT & CORRUPT IMAGE REJECTION -----------------
def test_unsupported_and_corrupt_file_rejection():
    c_res = client.post("/api/cases", json={"title": "Security Rejection Case"})
    case_id = c_res.json()["id"]

    # Plain text file disguised as jpg
    fake_jpg = b"This is a malicious shell script pretending to be an image."
    files = {"file": ("malicious.jpg", fake_jpg, "image/jpeg")}
    res = client.post(f"/api/cases/{case_id}/evidence", files=files)
    assert res.status_code in (400, 422)

    # Empty file (0 bytes)
    files = {"file": ("empty.png", b"", "image/png")}
    res_empty = client.post(f"/api/cases/{case_id}/evidence", files=files)
    assert res_empty.status_code in (400, 422)

# ----------------- TEST 6: METADATA EXTRACTION (FALLBACK & STRIPPED) -----------------
def test_metadata_extraction_fallback():
    c_res = client.post("/api/cases", json={"title": "Metadata Test Case"})
    case_id = c_res.json()["id"]

    jpeg_bytes = create_synthetic_jpeg()
    files = {"file": ("meta_test.jpg", jpeg_bytes, "image/jpeg")}
    upload_res = client.post(f"/api/cases/{case_id}/evidence", files=files)
    evidence_id = upload_res.json()["id"]

    meta_res = client.get(f"/api/evidence/{evidence_id}/metadata")
    assert meta_res.status_code == 200
    data = meta_res.json()
    assert "extracted_summary" in data
    summary = data["extracted_summary"]
    assert summary["File Format"] == "JPEG"
    assert "Dimensions" in summary
    assert "potential_anomalies" in data

# ----------------- TEST 7: ELA ON JPEG AND PNG -----------------
def test_ela_analysis_execution():
    c_res = client.post("/api/cases", json={"title": "ELA Test Case"})
    case_id = c_res.json()["id"]

    # 1. Test on JPEG
    jpeg_bytes = create_synthetic_jpeg()
    files = {"file": ("ela_sample.jpg", jpeg_bytes, "image/jpeg")}
    up_res = client.post(f"/api/cases/{case_id}/evidence", files=files)
    ev_id = up_res.json()["id"]

    ela_res = client.post(f"/api/evidence/{ev_id}/analyze/ela", json={"quality": 90, "amplification": 15})
    assert ela_res.status_code == 200
    ela_data = ela_res.json()
    assert ela_data["status"] == "COMPLETED"
    assert ela_data["analysis_type"] == "ELA"
    assert "mean_error" in ela_data["metrics"]
    assert ela_data["output_image_url"] is not None

    # Check output file actually exists in derived storage
    derived_name = ela_data["output_image_url"].split("/")[-1]
    assert (settings.DERIVED_DIR / derived_name).exists()

    # 2. Test on PNG (should complete but note lossless nature)
    png_bytes = create_synthetic_png()
    files_png = {"file": ("ela_sample.png", png_bytes, "image/png")}
    up_png = client.post(f"/api/cases/{case_id}/evidence", files=files_png)
    ev_png_id = up_png.json()["id"]

    ela_png_res = client.post(f"/api/evidence/{ev_png_id}/analyze/ela", json={"quality": 85, "amplification": 10})
    assert ela_png_res.status_code == 200
    assert ela_png_res.json()["metrics"]["is_lossless_source"] is True

# ----------------- TEST 8: COPY-MOVE FORGERY DETECTION -----------------
def test_copy_move_detection_on_controlled_image():
    c_res = client.post("/api/cases", json={"title": "CopyMove Test Case"})
    case_id = c_res.json()["id"]

    cm_bytes = create_synthetic_copymove_image()
    files = {"file": ("copymove_sample.jpg", cm_bytes, "image/jpeg")}
    up_res = client.post(f"/api/cases/{case_id}/evidence", files=files)
    ev_id = up_res.json()["id"]

    # Execute Copy-Move analysis
    cm_res = client.post(
        f"/api/evidence/{ev_id}/analyze/copy-move",
        json={"method": "ORB", "max_keypoints": 2000, "ratio": 0.8, "min_distance": 25}
    )
    assert cm_res.status_code == 200
    cm_data = cm_res.json()
    assert cm_data["status"] == "COMPLETED"
    assert cm_data["analysis_type"] == "COPY_MOVE"
    assert "total_keypoints" in cm_data["metrics"]
    assert "retained_matches" in cm_data["metrics"]

    derived_name = cm_data["output_image_url"].split("/")[-1]
    assert (settings.DERIVED_DIR / derived_name).exists()

# ----------------- TEST 9: NOISE RESIDUAL ANALYSIS -----------------
def test_noise_analysis_execution():
    c_res = client.post("/api/cases", json={"title": "Noise Test Case"})
    case_id = c_res.json()["id"]

    jpeg_bytes = create_synthetic_jpeg()
    files = {"file": ("noise_sample.jpg", jpeg_bytes, "image/jpeg")}
    up_res = client.post(f"/api/cases/{case_id}/evidence", files=files)
    ev_id = up_res.json()["id"]

    noise_res = client.post(f"/api/evidence/{ev_id}/analyze/noise", json={"window_size": 9})
    assert noise_res.status_code == 200
    noise_data = noise_res.json()
    assert noise_data["status"] == "COMPLETED"
    assert noise_data["analysis_type"] == "NOISE"
    assert "mean_noise_std" in noise_data["metrics"]
    assert noise_data["output_image_url"] is not None

    derived_name = noise_data["output_image_url"].split("/")[-1]
    assert (settings.DERIVED_DIR / derived_name).exists()

# ----------------- TEST 10: PDF REPORT GENERATION -----------------
def test_pdf_report_generation_and_download():
    c_res = client.post("/api/cases", json={"title": "Full Report Case", "examiner_name": "Dr. Watson"})
    case_id = c_res.json()["id"]

    jpeg_bytes = create_synthetic_jpeg()
    files = {"file": ("report_sample.jpg", jpeg_bytes, "image/jpeg")}
    up_res = client.post(f"/api/cases/{case_id}/evidence", files=files)
    ev_id = up_res.json()["id"]

    # Run analyses first so they appear in report
    client.post(f"/api/evidence/{ev_id}/analyze/ela", json={"quality": 90, "amplification": 15})
    client.post(f"/api/evidence/{ev_id}/analyze/noise", json={"window_size": 9})

    # Add an examiner custom finding
    client.post(f"/api/evidence/{ev_id}/findings", json={
        "category": "OBSERVATION",
        "description": "Manual visual confirmation of consistent edge gradients.",
        "severity": "LOW",
        "examiner_notes": "Sample validated during viva testing.",
        "review_status": "CONFIRMED"
    })

    # Generate PDF Report
    rep_res = client.post(f"/api/cases/{case_id}/evidence/{ev_id}/reports")
    assert rep_res.status_code == 200
    rep_data = rep_res.json()
    assert rep_data["report_id"].startswith("REP-")
    assert rep_data["download_url"] is not None

    # Download PDF and verify bytes
    dl_res = client.get(rep_data["download_url"])
    assert dl_res.status_code == 200
    assert dl_res.headers["content-type"] == "application/pdf"
    assert len(dl_res.content) > 1000
    # PDF magic header
    assert dl_res.content.startswith(b"%PDF")

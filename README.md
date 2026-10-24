# ImageSleuth — Digital Image Forensics & Evidence Analyzer

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.3+-61DAFB.svg?style=flat&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0+-38B2AC.svg?style=flat&logo=tailwind-css)](https://tailwindcss.com)
[![OpenCV](https://img.shields.io/badge/OpenCV-Headless-5C3EE8.svg?style=flat&logo=opencv)](https://opencv.org)
[![ReportLab](https://img.shields.io/badge/ReportLab-4.0+-CC0000.svg?style=flat)](https://www.reportlab.com)
[![Pytest](https://img.shields.io/badge/pytest-Passing%20(10/10)-brightgreen.svg?style=flat)](https://pytest.org)

**ImageSleuth** is an open-source, locally runnable Digital Image Forensics & Evidence Analyzer built for a college micro-project in **Digital Forensics**. It provides digital forensic examiners and students with an integrated workstation to acquire image evidence, enforce cryptographic SHA-256 chain of custody, inspect structural and EXIF metadata, perform Error Level Analysis (ELA), execute SIFT/ORB copy-move feature matching, visualize high-frequency noise variance heatmaps, and compile formal forensic PDF reports via ReportLab.

---

## 1. Core Capabilities & Forensic Workflow

1. **Evidence Ingestion & Integrity Preservation**:
   - Ingests image evidence (JPEG, PNG, WebP) with strict format validation (magic bytes verification) and a 20 MB size threshold.
   - Computes the cryptographic **SHA-256 hash** directly from raw uploaded bytes.
   - Stores immutable originals in `storage/evidence/` and strictly isolates all image processing to working copies.
   - On-demand **SHA-256 reverification** detects bit-flipping, file replacement, or disk tampering with automatic audit logging.

2. **Metadata Examination & Anomaly Review**:
   - Dual-engine extraction: utilizes system **ExifTool** if installed, with a comprehensive **Pillow fallback** parser.
   - Extracts camera hardware make, model, lens profile, capture dates, modification dates, and GPS coordinates.
   - Automated anomaly detection for image editing signatures (`Photoshop`, `GIMP`, `Canva`), timestamp divergence, and stripped EXIF.

3. **Error Level Analysis (ELA)**:
   - Configurable JPEG recompression quality ($50\% - 98\%$) and visualization amplification scale ($5\times - 40\times$).
   - Calculates pixel-wise error across 8x8 DCT compression blocks to expose regions with divergent compression histories.
   - Extracts quantitative metrics: mean pixel error, max error, standard deviation, and 95th percentile error.

4. **Copy-Move Forgery Detection**:
   - Feature-based keypoint detection using **SIFT** (Scale-Invariant Feature Transform) and **ORB**.
   - $k$-Nearest Neighbor descriptor matching with **Lowe's ratio test** ($0.75$) and **spatial separation pruning** ($> 35\text{ px}$) to eliminate trivial adjacent texture matches.
   - Renders visual overlays connecting duplicated regions with colored displacement vectors.

5. **Noise & Residual Consistency Analysis**:
   - Separates high-frequency sensor noise from image content via Gaussian filtering ($\sigma = 1.0$).
   - Computes local residual variance over a configurable sliding window ($7\times7, 9\times9, 11\times11, 15\times15$).
   - Visualizes noise floor heterogeneity using an **Inferno false-color heatmap** (black/purple = smooth, yellow/white = high residual energy).

6. **Interactive Comparative Forensics**:
   - Side-by-side comparative inspection.
   - Dynamic split-slider with interactive wipe curtain.
   - Rapid blink toggle comparison with configurable digital magnification ($50\% - 300\%$).

7. **Findings Registry & Examiner Notes**:
   - Structured registry categorizing observations into *Informational*, *Observation*, *Potential Anomaly*, *Integrity Failure*, and *Analysis Limitation*.
   - Severity tracking (*INFO*, *LOW*, *MEDIUM*, *HIGH*) with examiner review status (*Unreviewed*, *Confirmed*, *Dismissed*).

8. **Publication-Grade PDF Forensic Report**:
   - One-click compilation using **ReportLab Platypus**.
   - Includes case metadata, evidence specifications, recorded SHA-256 hash, latest reverification status, metadata summary table, embedded derived visualizations for executed analyses, findings registry, methodological caveats, and examiner sign-off block.

---

## 2. Technology Stack

- **Frontend**:
  - React.js 19 + TypeScript (Strict mode)
  - Vite 8.3
  - Tailwind CSS v4
  - Lucide React (Forensic iconography)
  - Recharts (Statistical telemetry visualization)
- **Backend**:
  - Python 3.11
  - FastAPI (REST API with OpenAPI / Swagger UI)
  - Uvicorn (ASGI server)
  - SQLAlchemy 2.0 + SQLite (Database persistence)
  - OpenCV Headless (Computer vision & feature matching)
  - Pillow 10+ (Image processing & EXIF parsing)
  - NumPy (Matrix arithmetic & residual variance calculations)
  - ReportLab 4+ (PDF report compiler with dynamic page numbering)
- **Testing**:
  - Pytest 8+ (Automated unit and integration test suite with synthetic image fixtures)

---

## 3. Project Directory Structure

```
ImageSleuth/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes.py            # FastAPI endpoints
│   │   ├── core/
│   │   │   └── config.py            # Server settings & storage paths
│   │   ├── database/
│   │   │   └── session.py           # SQLite connection & session
│   │   ├── models/
│   │   │   └── __init__.py          # SQLAlchemy models
│   │   ├── schemas/
│   │   │   └── __init__.py          # Pydantic validation schemas
│   │   ├── services/
│   │   │   ├── evidence_service.py  # Acquisition, hashing, storage
│   │   │   ├── integrity_service.py # SHA-256 verification
│   │   │   ├── metadata_service.py  # ExifTool & Pillow extraction
│   │   │   ├── ela_service.py       # Error Level Analysis
│   │   │   ├── copy_move_service.py # SIFT/ORB feature matching
│   │   │   ├── noise_service.py     # Gaussian residual variance
│   │   │   └── report_service.py    # ReportLab PDF compiler
│   │   └── main.py                  # App entry point & CORS
│   ├── tests/
│   │   └── test_forensics.py        # Automated test suite
│   ├── requirements.txt
│   └── pytest.ini
├── frontend/
│   ├── src/
│   │   ├── components/              # Sidebar, Header, ComparisonModal
│   │   ├── pages/                   # Dashboard, NewCase, Library, Workspace, Reports, Viva
│   │   ├── services/
│   │   │   └── api.ts               # Typed client API wrapper
│   │   ├── types/
│   │   │   └── index.ts             # TypeScript definitions
│   │   ├── App.tsx                  # Root navigation & state
│   │   └── index.css                # Forensic styling & Tailwind
│   ├── package.json
│   └── vite.config.ts
├── storage/
│   ├── evidence/                    # Immutable original evidence files
│   ├── derived/                     # Derived ELA, CopyMove & Noise maps
│   ├── reports/                     # Generated PDF report work products
│   └── imagesleuth.db               # SQLite database
├── docs/
│   ├── architecture.md              # System design & custody model
│   ├── methodology.md               # Scientific algorithms & formulas
│   └── limitations.md               # Forensic caveats & false positives
├── .gitignore
└── README.md
```

---

## 4. Prerequisites

- **Python**: Version 3.11 or compatible installed Python 3.x.
- **Node.js**: Version 18.0 or newer (Node v20/v22/v25 supported).
- **Git**: Installed for version management.
- *(Optional)* **ExifTool**: If ExifTool is installed and present in system `PATH`, ImageSleuth will automatically leverage it for deep MakerNote extraction; otherwise, it seamlessly utilizes the built-in Pillow fallback.

---

## 5. Quickstart & Installation Instructions

### Step 1: Clone or Navigate to the Workspace
```bash
cd "d:\DF micro project"
```

### Step 2: Backend Setup
1. Create and activate a Python virtual environment:
   ```powershell
   # Windows PowerShell:
   python -m venv backend/venv
   .\backend\venv\Scripts\Activate.ps1
   ```
2. Upgrade `pip` and install dependencies:
   ```powershell
   pip install --upgrade pip
   pip install -r backend/requirements.txt
   ```

### Step 3: Frontend Setup
1. Open a new terminal and install frontend packages:
   ```powershell
   cd frontend
   npm install
   ```

---

## 6. Running the Application Locally

### 1. Launch Backend API Server
From the root workspace directory or `backend/`:
```powershell
.\backend\venv\Scripts\uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```
- The backend API will start on `http://127.0.0.1:8000`.
- Interactive Swagger documentation will be accessible at: **`http://127.0.0.1:8000/docs`**.

### 2. Launch Frontend Development Server
In a second terminal window:
```powershell
cd frontend
npm run dev
```
- The frontend will start at **`http://localhost:5173`** (or `http://127.0.0.1:5173`).
- All API requests to `/api` are automatically proxied to the FastAPI server at `http://127.0.0.1:8000`.

---

## 7. Running the Automated Test Suite

ImageSleuth includes a dedicated test suite with synthetic image generators covering hashing, file corruption handling, tampering detection, ELA, copy-move detection, noise analysis, and PDF report generation.

Run pytest using the virtual environment:
```powershell
.\backend\venv\Scripts\pytest backend/tests/test_forensics.py -v
```

All 10 tests will execute and pass:
```text
backend\tests\test_forensics.py::test_sha256_hash_calculation PASSED     [ 10%]
backend\tests\test_forensics.py::test_case_creation_and_retrieval PASSED [ 20%]
backend\tests\test_forensics.py::test_evidence_acquisition_and_integrity_pass PASSED [ 30%]
backend\tests\test_forensics.py::test_integrity_verification_failure_on_tampering PASSED [ 40%]
backend\tests\test_forensics.py::test_unsupported_and_corrupt_file_rejection PASSED [ 50%]
backend\tests\test_forensics.py::test_metadata_extraction_fallback PASSED [ 60%]
backend\tests\test_forensics.py::test_ela_analysis_execution PASSED      [ 70%]
backend\tests\test_forensics.py::test_copy_move_detection_on_controlled_image PASSED [ 80%]
backend\tests\test_forensics.py::test_noise_analysis_execution PASSED    [ 90%]
backend\tests\test_forensics.py::test_pdf_report_generation_and_download PASSED [100%]
======================== 10 passed in 6.59s ========================
```

---

## 8. Step-by-Step Investigation Walkthrough

1. **Dashboard Overview**: View database metrics summarizing total investigations, acquired evidence files, and flagged anomalies.
2. **New Investigation**: Click **New Investigation** to open a case with a unique Case ID, examiner credentials, and case title.
3. **Evidence Acquisition**: Drag and drop an image file (JPEG, PNG, or WebP). The system validates magic bytes, streams the file into immutable storage, calculates the SHA-256 hash, and performs automatic initial metadata extraction.
4. **Integrity Re-verification**: In the **Forensic Workspace**, click **Reverify** anytime to recalculate the on-disk SHA-256 hash and audit the result against the acquisition record.
5. **Metadata Inspection**: View camera hardware, capture timestamps, software tags, and privacy-safe GPS coordinates.
6. **Error Level Analysis**: Adjust the recompression quality slider ($90\%$) and amplification factor ($15\times$) to inspect compression error distribution and launch the interactive split-slider modal.
7. **Copy-Move Detection**: Configure the SIFT detector, keypoint limit, and spatial distance threshold to locate duplicated clusters with displacement vectors.
8. **Noise Floor Analysis**: Select a window size ($9\times9$) to render an Inferno heatmap showing spatial variations in high-frequency residual noise.
9. **Record Examiner Findings**: Add custom notes or adjust the review status of automated findings (*Unreviewed*, *Confirmed*, *Dismissed*).
10. **Compile Forensic PDF Report**: Switch to the **Report Generation** tab and compile an official PDF report complete with metadata tables, embedded derived images, findings, caveats, and signature lines.

---

## 9. College Viva Guide & Theoretical Highlights

For a college Digital Forensics viva or micro-project presentation:
- **Why calculate SHA-256 before decoding?** Decoding through libraries decompresses and strips file structure; calculating hash on raw incoming bytes guarantees exact bit-level evidence authentication.
- **Why do algorithms report "Potential Anomalies" rather than "Fake"?** Forensic science distinguishes mathematical deviations from human intent. Benign resaves or social media compression create similar deviations.
- **What is the spatial separation filter in Copy-Move?** Prevents trivial self-matches between adjacent pixels on the same physical object by enforcing a minimum Euclidean pixel distance (e.g. $> 35\text{ px}$).
- **Why does ELA differ for PNG vs JPEG?** JPEG is discrete-cosine-transform block quantized; PNG is lossless LZ77/deflate filtered. ELA on PNG visualizes the introduction of lossy JPEG compression, not historical quantization.

For further reading, see [`docs/architecture.md`](docs/architecture.md), [`docs/methodology.md`](docs/methodology.md), and [`docs/limitations.md`](docs/limitations.md).

# ImageSleuth — System Architecture & Design

## 1. Architectural Overview

**ImageSleuth** is a specialized Digital Image Forensics & Evidence Analyzer application built following a decoupled, layered client-server architecture. It provides an isolated, local investigation environment ensuring evidence preservation, reproducible analysis pipelines, and automated forensic report compilation.

```
+-------------------------------------------------------------------------+
|                         CLIENT TIER (React + TypeScript)                 |
|  +-----------------+  +----------------------+  +---------------------+ |
|  | Dashboard View  |  | Evidence Ingestion   |  | Forensic Workspace  | |
|  | - SQLite Stats  |  | - Drag & Drop Upload |  | - ELA Interactive   | |
|  | - Activity Log  |  | - Immediate SHA-256  |  | - SIFT Copy-Move    | |
|  | - Recharts Viz  |  | - MIME/Header Check  |  | - Noise Heatmaps    | |
|  +-----------------+  +----------------------+  +---------------------+ |
|         |                        |                         |            |
|         +------------------------+-------------------------+            |
|                                  |                                      |
|                       REST API / JSON Payloads                          |
+----------------------------------|--------------------------------------+
                                   |
                                   v
+-------------------------------------------------------------------------+
|                       SERVER TIER (FastAPI + Python 3.11)               |
|  +-------------------------------------------------------------------+  |
|  | API Router (`app.api.routes`)                                      |  |
|  | - /cases, /evidence, /analyze/*, /findings, /reports               |  |
|  +-------------------------------------------------------------------+  |
|         |                         |                        |            |
|         v                         v                        v            |
|  +----------------+     +-------------------+    +-------------------+  |
|  | Forensics Core |     | Data Persistence  |    | Report Engine     |  |
|  | - evidence_svc |     | - SQLAlchemy ORM  |    | - ReportLab PDF   |  |
|  | - integrity_svc|     | - SQLite Database |    | - NumberedCanvas  |  |
|  | - metadata_svc |     | - SessionLocal    |    | - Visual Embeds   |  |
|  | - ela_svc      |     +-------------------+    +-------------------+  |
|  | - copy_move_svc|                                                     |
|  | - noise_svc    |                                                     |
|  +----------------+                                                     |
+----------------------------------|--------------------------------------+
                                   |
                                   v
+-------------------------------------------------------------------------+
|                          STORAGE REPOSITORY                             |
|  +--------------------+  +--------------------+  +--------------------+ |
|  | /storage/evidence/ |  | /storage/derived/  |  | /storage/reports/  | |
|  | - Immutable raw    |  | - ELA PNG maps     |  | - PDF documents    | |
|  |   original files   |  | - Copy-Move vectors|  | - Case reports     | |
|  | - Read-only access |  | - Noise heatmaps   |  +--------------------+ |
|  +--------------------+  +--------------------+                         |
+-------------------------------------------------------------------------+
```

---

## 2. Evidence Custody & Storage Model

Forensic integrity requires strict adherence to chain-of-custody protocols:

1. **Immutable Ingestion**:
   - When an investigator uploads an image, the raw bytes are streamed directly into `storage/evidence/EVD-{UUID}.{ext}`.
   - The SHA-256 cryptographic digest is computed on the exact byte sequence during transfer.
   - Pillow and OpenCV are strictly prohibited from saving back into the evidence repository.

2. **Isolated Derived Outputs**:
   - All analyses (recompressed JPEG differences, keypoint vector visualizations, and false-color variance heatmaps) are saved into `storage/derived/ANL-{TYPE}-{UUID}.png`.
   - The original evidence file remains unchanged on disk.

3. **On-Demand Cryptographic Verification**:
   - The system re-reads the stored evidence file from disk in 64 KB streaming buffers, calculates the new SHA-256 hash, and compares it byte-for-byte with the acquisition hash.
   - If the hashes match, an `INTEGRITY_VERIFY` event is logged with status `PASS`.
   - If even a single byte differs or the file is missing, an `INTEGRITY_FAIL` event is logged, and a critical finding is automatically registered.

---

## 3. Database Schema (SQLite & SQLAlchemy)

ImageSleuth utilizes an embedded SQLite database (`storage/imagesleuth.db`) managed through SQLAlchemy 2.0 ORM:

- **`cases`**: Investigation identifier (`CASE-YYYY-XXXX`), title, description, examiner name, acquisition notes, timestamps.
- **`evidence`**: Evidence reference (`EVD-XXXX`), original filename, stored filename, file size, dimensions, detected format, MIME type, SHA-256 hash.
- **`integrity_verifications`**: Historical audit log of every reverification attempt with recorded hash, calculated hash, status (`PASS`/`FAIL`), and timestamp.
- **`metadata_records`**: Tool used (`exiftool` or `pillow_fallback`), raw JSON properties, normalized summary dictionary, detected anomaly list.
- **`analyses`**: Unique execution ID (`ANL-XXXX`), algorithm type (`ELA`, `COPY_MOVE`, `NOISE`), parameters JSON, metrics JSON, output file path, duration in milliseconds, interpretation notes.
- **`findings`**: Finding ID (`FND-XXXX`), category (`INFORMATIONAL`, `OBSERVATION`, `POTENTIAL_ANOMALY`, `INTEGRITY_FAILURE`, `ANALYSIS_LIMITATION`), description, severity (`INFO`, `LOW`, `MEDIUM`, `HIGH`), examiner notes, review status (`UNREVIEWED`, `CONFIRMED`, `DISMISSED`).
- **`reports`**: Generated PDF document ID, file reference, timestamps.
- **`activity_logs`**: Chronological event log tracking acquisitions, analyses, and report compilation.

---

## 4. API Endpoints Specification

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Service health status and storage initialization check |
| `GET` | `/api/dashboard/stats` | Aggregated case, evidence, analysis, and anomaly telemetry |
| `GET` | `/api/cases` | List all investigation cases |
| `POST` | `/api/cases` | Create a new investigation case |
| `GET` | `/api/cases/{id}` | Detailed case inspection with attached evidence and logs |
| `DELETE` | `/api/cases/{id}` | Permanently delete case and purge related storage files |
| `POST` | `/api/cases/{id}/evidence` | Securely acquire and hash an evidence image |
| `GET` | `/api/evidence/{id}` | Detailed evidence inspection and metadata overview |
| `POST` | `/api/evidence/{id}/verify-integrity` | Recalculate on-disk SHA-256 hash and audit comparison |
| `GET` | `/api/evidence/{id}/integrity-history` | Retrieve full chain-of-custody reverification timeline |
| `GET` | `/api/evidence/{id}/metadata` | Fetch extracted EXIF/structural metadata and anomaly flags |
| `POST` | `/api/evidence/{id}/analyze/ela` | Run Error Level Analysis with quality and amplification controls |
| `POST` | `/api/evidence/{id}/analyze/copy-move` | Run SIFT/ORB feature matching copy-move detection |
| `POST` | `/api/evidence/{id}/analyze/noise` | Run high-frequency residual noise variance estimation |
| `GET` | `/api/evidence/{id}/analyses` | Retrieve list of all completed forensic analyses |
| `GET` | `/api/evidence/{id}/findings` | Retrieve registered forensic findings and examiner notes |
| `POST` | `/api/evidence/{id}/findings` | Register a new manual or algorithmic finding |
| `PUT` | `/api/findings/{id}` | Update finding status (`CONFIRMED`, `DISMISSED`) and notes |
| `POST` | `/api/cases/{id}/evidence/{id}/reports` | Compile comprehensive PDF investigation report via ReportLab |
| `GET` | `/api/reports` | List all compiled reports |
| `GET` | `/api/reports/{id}/download` | Stream downloadable PDF file |
| `GET` | `/api/files/evidence/{filename}` | Stream protected evidence image preview |
| `GET` | `/api/files/derived/{filename}` | Stream derived analysis visualization artifact |

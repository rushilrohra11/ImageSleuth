# ImageSleuth — Forensic Limitations & Caveats

This document articulates the technical boundaries, common false-positive sources, and ethical constraints governing digital image forensics in ImageSleuth.

---

## 1. Ethical & Epistemological Boundaries

### Anomaly Detection vs. Forgery Proof
A foundational rule of forensic engineering is that **an algorithm detects statistical or mathematical deviations, not human intent**. 

- An anomaly (e.g., elevated ELA error or a Photoshop software tag) proves only that a technical difference exists.
- It does **not** prove malicious tampering, falsification, or deceptive intent.
- Benign operations—such as social media platform compression, format conversion, thumbnail generation, brightness adjustments, and watermark overlays—routinely create the exact same anomalies.

### Prohibition of Arbitrary "Authenticity Scores"
ImageSleuth explicitly rejects simplistic percentage scores such as *"92% Authentic"* or *"100% Fake"*. 
- Such scores are statistically uncalibrated and scientifically misleading.
- Forensic standards mandate transparent reporting of individual findings, specific metrics, and test parameters rather than aggregate probabilistic declarations.

### Approved Forensic Terminology
Investigators must avoid conclusive accusations based solely on automated tools. ImageSleuth enforces the following terminology:
- **Approved**: *"Potential Anomaly"*, *"Inconsistent Metadata"*, *"Suspicious Feature Cluster"*, *"Divergent Compression Residual"*, *"Requires Further Examination"*.
- **Prohibited**: *"Definite Forgery"*, *"Proven Fake"*, *"100% Authentic"*, *"Tamper-Proof System"*.

---

## 2. Module-Specific Technical Limitations & False Positives

### Error Level Analysis (ELA) Limitations
1. **High-Frequency Natural Edges**: High-contrast boundaries (e.g., a dark silhouette against a bright sky, text, or intricate geometric patterns) naturally contain high DCT frequencies that lose more information during recompression, appearing bright in the difference map even in authentic images.
2. **Lossless Formats (PNG / WebP)**: Applying JPEG ELA to lossless PNG files is not meaningful for historical compression analysis because PNG does not use DCT block quantization. The resulting difference reflects the initial lossy compression artifact of JPEG, not historical editing.
3. **Repeated Resaves**: An authentic image resaved multiple times on different editing platforms will exhibit complex, non-uniform compression grids that can be easily misinterpreted as splicing.

### Copy-Move Forgery Detection Limitations
1. **Architectural & Natural Repetition**: Windows on an office building, rows of bricks, tiled roofs, wallpaper patterns, foliage, and ripples on water naturally contain hundreds of geometrically identical keypoints. The algorithm will identify these as matches, creating false positives.
2. **Post-Duplication Transformations**: If a copied region was significantly scaled, rotated, distorted, or smoothed with Gaussian blur before insertion, standard keypoint descriptors may fail to identify the match (false negative).
3. **Small Patch Splicing**: Cloned regions smaller than the descriptor patch size (typically $16 \times 16$ or $32 \times 32$ pixels) do not contain sufficient gradient detail to generate keypoints.

### Noise & Residual Consistency Limitations
1. **Depth of Field (Bokeh)**: Objects outside the camera lens focus plane are optically blurred, suppressing high-frequency texture and drastically reducing the local residual variance. This produces sharp variance differences between foreground and background that mimic spliced edges.
2. **Uniform Lighting & Shadows**: Smooth areas such as blue skies, blank walls, or deep shadows have low gradient energy, resulting in low noise amplitude compared to textured objects.
3. **Not Sensor Fingerprinting (PRNU)**: The lightweight Gaussian residual analysis implemented in ImageSleuth measures local variance, not Photo-Response Non-Uniformity (PRNU). It cannot match an image to a specific camera sensor serial number.

### Metadata Examination Limitations
1. **Social Media Stripping**: Almost all major messaging apps (WhatsApp, Telegram, Signal) and social networks (Facebook, Twitter/X, Instagram) automatically strip EXIF metadata to protect user privacy and minimize file size. Missing EXIF does not indicate tampering.
2. **Software Tags on Authentic Photos**: Professional photographers routinely use Adobe Lightroom or Apple Photos to adjust exposure, crop, or export camera RAW files. The presence of an Adobe tag does not establish that the contents were manipulated.
3. **Header Forgery**: Any metadata tag (including camera make, serial number, and capture date) can be edited or spoofed with basic command-line tools without changing image pixels.

---

## 3. Legal and Operational Scope

- **Intended Use**: ImageSleuth is designed exclusively as an educational micro-project and preliminary investigative triage workstation for students and researchers in Digital Forensics.
- **Legal Admissibility**: Findings and PDF reports generated by this software do not constitute legally certified forensic expert testimony. In a court of law, evidence must be analyzed using ISO/IEC 17025 accredited procedures by a certified forensic practitioner.
- **Chain of Custody Guarantee**: While SHA-256 hashes guarantee that files have not changed since acquisition in this software, local audit logs stored on a workstation do not independently prevent root-level host operating system manipulation.

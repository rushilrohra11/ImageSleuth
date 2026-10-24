# ImageSleuth — Forensic Methodology & Algorithmic Foundations

This document details the scientific principles, mathematical formulations, and engineering implementations of the digital forensic techniques utilized in ImageSleuth.

---

## 1. Cryptographic Evidence Hashing (SHA-256)

### Purpose
To guarantee the evidentiary integrity of digital files, establishing that no alteration, bit flipping, or forensic processing has compromised the original item since acquisition.

### Formulation
SHA-256 belongs to the Secure Hash Algorithm 2 family standardized by NIST (FIPS 180-4). It produces a 256-bit (32-byte, 64-hexadecimal character) one-way cryptographic digest:

$$H = \text{SHA-256}(M)$$

Properties:
- **Pre-image resistance**: Computationally infeasible to reverse $M$ given $H$.
- **Second pre-image resistance**: Infeasible to find $M' \neq M$ such that $\text{SHA-256}(M') = \text{SHA-256}(M)$.
- **Collision resistance**: Infeasible to find any pair $(M_1, M_2)$ where $\text{SHA-256}(M_1) = \text{SHA-256}(M_2)$.

### Implementation Detail
- Directly computed over the raw uploaded byte stream before file parsing.
- Streaming verification buffer of 65,536 bytes (64 KB) prevents memory spikes on large files.
- Original files are stored in `storage/evidence/` with file system read-only permissions where supported.

---

## 2. Metadata Examination & Consistency Review

### Purpose
To extract embedded provenance information, compare timestamps, check optical/camera attributes, and identify editing software signatures.

### Methodology
1. **Extraction Tier 1 (ExifTool)**:
   - When ExifTool is installed on the host system, ImageSleuth queries it via structured JSON output (`exiftool -j -G <path>`).
   - Retrieves comprehensive EXIF, MakerNotes, IPTC, and XMP trees.
2. **Extraction Tier 2 (Pillow Fallback)**:
   - When ExifTool is unavailable, ImageSleuth employs Pillow's `getexif()` and `get_ifd()` APIs.
   - Parses ExifIFD (0x8769), GPSIFD (0x8825), and structural image properties (color mode, bits per pixel, format headers).
3. **Automated Anomaly Review**:
   - **Software Signatures**: Scans for known editing software keywords (`Photoshop`, `GIMP`, `Canva`, `Lightroom`, `Affinity`, `Snapseed`).
   - **Timestamp Discrepancies**: Compares `DateTimeOriginal` (sensor capture) with `ModifyDate` (file edit).
   - **Stripped Metadata Detection**: Flags images completely devoid of camera make, model, or lens data.

---

## 3. Error Level Analysis (ELA)

### Purpose
To visualize non-uniform JPEG compression error across 8x8 DCT grid blocks, highlighting regions that have undergone different compression histories.

### Methodology
JPEG compression divides the image into $8 \times 8$ pixel blocks, transforms them using the 2D Discrete Cosine Transform (DCT), quantizes coefficients with a quantization table, and applies Huffman encoding.

When an image is repeatedly saved at a fixed quality $Q$, the difference between successive saves diminishes toward an equilibrium:
$$\Delta(x, y) = |I_{\text{orig}}(x, y) - I_{\text{recompressed}}(x, y)|$$

If a spliced object from an uncompressed or high-quality source is pasted into a JPEG image and resaved, the spliced region is undergoing its first compression, whereas the surrounding image is undergoing multiple recompressions. As a result:
$$\Delta_{\text{spliced}}(x, y) \gg \Delta_{\text{background}}(x, y)$$

### Algorithmic Pipeline:
1. Decode original evidence into RGB array $I_{\text{orig}}$.
2. Encode working copy in memory to JPEG format with target quality $Q$ (default $90$).
3. Decode recompressed image to RGB array $I_{\text{recomp}}$.
4. Compute absolute difference: $\text{Diff} = |I_{\text{orig}} - I_{\text{recomp}}|$.
5. Apply visualization amplification scale $S$ (default $15\times$):
   $$\text{Vis}(x, y) = \min(255, \text{Diff}(x, y) \cdot S)$$
6. Calculate error distribution metrics: mean error $\mu$, maximum error, standard deviation $\sigma$, and 95th percentile error.

---

## 4. Copy-Move Forgery Detection (Feature-Based)

### Purpose
To identify duplicated, cloned, or disguised regions within the same image by matching local invariant visual descriptors.

### Methodology
ImageSleuth implements a scale- and rotation-invariant feature-matching approach using SIFT (Scale-Invariant Feature Transform) with an automated fallback to ORB (Oriented FAST and Rotated BRIEF).

### Algorithmic Pipeline:
1. **Scale Normalization**: Downscales images with max dimension $> 1600\text{ px}$ to maintain bounded memory and predictable CPU latency.
2. **Keypoint & Descriptor Extraction**:
   - Computes keypoints $K = \{k_1, k_2, \dots, k_n\}$ and descriptors $D \in \mathbb{R}^{n \times 128}$ (for SIFT) or $\mathbb{R}^{n \times 32}$ (for ORB).
3. **Descriptor Self-Matching**:
   - Matches descriptors within the image using $k$-Nearest Neighbors ($k=4$).
   - The first match ($m_0$) is the trivial self-match with distance $0$.
4. **Spatial Separation Filter**:
   - Computes Euclidean distance between keypoint coordinates:
     $$d_{\text{spatial}}(k_i, k_j) = \sqrt{(x_i - x_j)^2 + (y_i - y_j)^2}$$
   - Rejects candidate pairs where $d_{\text{spatial}} < \text{min\_distance}$ (default $35\text{ px}$) to prevent matching adjacent pixels on the same object.
5. **Lowe's Ratio Test**:
   - Evaluates descriptor ambiguity against the next nearest neighbor:
     $$\frac{\text{dist}(m_1)}{\text{dist}(m_2)} < \text{ratio\_threshold} \quad (\text{default } 0.75)$$
6. **Vector Visualization Overlay**:
   - Draws retained keypoint pairs and connecting colored displacement vectors on the working copy.

---

## 5. Noise and Residual Consistency Analysis

### Purpose
To extract the high-frequency residual signal of the image and compute local variance heatmaps, identifying inconsistencies in the underlying sensor noise floor.

### Methodology
In an authentic photograph, camera sensor noise (photon shot noise and read noise) adheres to physical sensor characteristics across the frame. Splicing an object from an external image or pasting an AI-generated element introduces a discordant local noise floor.

### Algorithmic Pipeline:
1. **Grayscale Normalization**: Converts image to float32 grayscale $I_{\text{gray}} \in [0, 1]$.
2. **Signal-Noise Separation**:
   - Smooths the underlying signal with a 2D Gaussian filter ($\text{kernel}=5 \times 5, \sigma=1.0$):
     $$I_{\text{smooth}} = G_{\sigma} * I_{\text{gray}}$$
3. **High-Frequency Residual Extraction**:
   $$R(x, y) = I_{\text{gray}}(x, y) - I_{\text{smooth}}(x, y)$$
4. **Local Variance Estimation**:
   - Uses a sliding box filter of size $W \times W$ (default $9 \times 9$) to compute local mean and local mean of squares:
     $$\mu_R = \frac{1}{W^2} \sum_{W} R, \quad \mu_{R^2} = \frac{1}{W^2} \sum_{W} R^2$$
     $$\text{Var}_R = \max(0, \mu_{R^2} - (\mu_R)^2)$$
5. **Standard Deviation Mapping**:
   $$\sigma_R = \sqrt{\text{Var}_R}$$
6. **False-Color Heatmap Rendering**:
   - Normalizes $\sigma_R$ against the 98th percentile for robust dynamic range.
   - Maps normalized amplitudes using OpenCV's `COLORMAP_INFERNO`:
     - Low residual variance (smooth / blurred regions) $\to$ Dark purple / black.
     - Moderate variance $\to$ Orange / red.
     - High residual variance $\to$ Yellow / white.

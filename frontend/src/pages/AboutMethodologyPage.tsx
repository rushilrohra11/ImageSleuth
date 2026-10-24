import React from 'react';
import {
  Shield,
  Camera,
  Zap,
  Layers,
  Sparkles,
  HelpCircle,
  Scale
} from 'lucide-react';

export const AboutMethodologyPage: React.FC = () => {
  return (
    <div className="flex-1 p-8 overflow-y-auto space-y-8 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="pb-4 border-b border-[#1E293B]">
        <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center space-x-2">
          <span>Digital Image Forensics: Methodology & Viva Examination Guide</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Theoretical foundations, mathematical algorithms, forensic principles, and viva preparation guide for ImageSleuth.
        </p>
      </div>

      {/* Core Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Module 1: SHA-256 */}
        <div className="p-5 rounded-xl bg-[#0F172A] border border-[#1E293B] space-y-3">
          <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
            <Shield className="w-5 h-5" />
            <span>1. Cryptographic Evidence Integrity (SHA-256)</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            The foundation of digital forensics is the <em>Chain of Custody</em>. Once acquired, original image bytes must remain completely immutable.
          </p>
          <div className="p-3 rounded-lg bg-[#0A0D15] border border-[#1A2436] font-mono text-[11px] text-cyan-300 space-y-1">
            <div>Formula: H = SHA256(RawBytes) &isin; &#123;0..1&#125;<sup>256</sup></div>
            <div className="text-slate-500">Output: 64 hexadecimal characters</div>
          </div>
          <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
            <li><strong>Collision Resistance:</strong> Unlike MD5 and SHA-1, SHA-256 is cryptographically secure against practical collision attacks.</li>
            <li><strong>Strict Isolation:</strong> Working copies are spawned for Pillow/OpenCV analysis; original files are opened solely in read-only streams.</li>
            <li><strong>Re-verification:</strong> Hash recalculation is executed on-demand against disk bytes to detect tamper or disk bit-rot.</li>
          </ul>
        </div>

        {/* Module 2: Metadata */}
        <div className="p-5 rounded-xl bg-[#0F172A] border border-[#1E293B] space-y-3">
          <div className="flex items-center space-x-2 text-cyan-400 font-bold text-sm">
            <Camera className="w-5 h-5" />
            <span>2. EXIF Structural & Consistency Examination</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Standard digital cameras embed metadata compliant with the Exchangeable Image File (EXIF), IPTC, and XMP specifications.
          </p>
          <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
            <li><strong>Software Tags:</strong> Presence of tags mentioning Adobe Photoshop, GIMP, or Canva indicates re-encoding or exporting by editing software.</li>
            <li><strong>Timestamp Divergence:</strong> Discrepancies between <code>DateTimeOriginal</code> (sensor capture) and <code>ModifyDate</code> reveal post-capture alteration.</li>
            <li><strong>Privacy Notice:</strong> Stripped metadata does not prove forgery; social media platforms (WhatsApp, Twitter/X) routinely strip EXIF by design.</li>
          </ul>
        </div>

        {/* Module 3: ELA */}
        <div className="p-5 rounded-xl bg-[#0F172A] border border-[#1E293B] space-y-3">
          <div className="flex items-center space-x-2 text-yellow-400 font-bold text-sm">
            <Zap className="w-5 h-5" />
            <span>3. Error Level Analysis (ELA)</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            JPEG is a lossy format utilizing Discrete Cosine Transform (DCT) on 8x8 pixel blocks. When an image is resaved, high-frequency coefficients lose information at a predictable rate.
          </p>
          <div className="p-3 rounded-lg bg-[#0A0D15] border border-[#1A2436] font-mono text-[11px] text-cyan-300 space-y-1">
            <div>Error(x, y) = |Original(x, y) - Recompressed<sub>Q=90</sub>(x, y)|</div>
            <div>Visualization(x, y) = min(255, Error(x, y) &times; Scale)</div>
          </div>
          <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
            <li><strong>Uniform Compression:</strong> An authentic JPEG resaved once should exhibit a consistent error floor across similar textures.</li>
            <li><strong>Spliced Anomaly:</strong> An object pasted from another image often has a different compression history, appearing noticeably brighter or darker in the amplified difference map.</li>
            <li><strong>Lossless Caveat:</strong> ELA on PNG images tests artificial re-encoding rather than historical DCT quantization.</li>
          </ul>
        </div>

        {/* Module 4: Copy-Move */}
        <div className="p-5 rounded-xl bg-[#0F172A] border border-[#1E293B] space-y-3">
          <div className="flex items-center space-x-2 text-purple-400 font-bold text-sm">
            <Layers className="w-5 h-5" />
            <span>4. Copy-Move Forgery Detection (SIFT / ORB)</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Copy-Move (cloning) involves duplicating a region within the same image to conceal an object or multiply elements.
          </p>
          <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
            <li><strong>Feature Descriptors:</strong> SIFT (Scale-Invariant Feature Transform) and ORB extract scale- and rotation-invariant keypoints.</li>
            <li><strong>Spatial Pruning:</strong> Self-matches within a radius <em>d &lt; min_dist</em> are eliminated to suppress adjacent texture matches.</li>
            <li><strong>Lowe's Ratio Test:</strong> Rejects ambiguous matches: <code>d<sub>1</sub> &lt; 0.75 &times; d<sub>2</sub></code>.</li>
            <li><strong>Limitation:</strong> Repetitive building facades, wallpaper, or foliage naturally produce high match counts without forgery.</li>
          </ul>
        </div>

        {/* Module 5: Noise Analysis */}
        <div className="p-5 rounded-xl bg-[#0F172A] border border-[#1E293B] space-y-3">
          <div className="flex items-center space-x-2 text-cyan-400 font-bold text-sm">
            <Sparkles className="w-5 h-5" />
            <span>5. High-Frequency Noise Consistency</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Camera sensor noise (photon shot noise and read noise) is uniformly distributed across the image sensor during acquisition.
          </p>
          <div className="p-3 rounded-lg bg-[#0A0D15] border border-[#1A2436] font-mono text-[11px] text-cyan-300 space-y-1">
            <div>Residual: R = I - GaussianFilter(I, &sigma;=1.0)</div>
            <div>Local Variance: Var(R) = E[R<sup>2</sup>] - (E[R])<sup>2</sup></div>
          </div>
          <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
            <li><strong>Spliced Patch Mismatch:</strong> Pasting content from a different camera or a computer-generated rendering often introduces a mismatched noise floor.</li>
            <li><strong>Inferno False-Color:</strong> Maps variance amplitudes into intuitive heatmaps (purple = low variance, yellow = high variance).</li>
            <li><strong>Limitation:</strong> Depth of field (bokeh blur) and flat skies naturally have low variance, while rough textures have high variance.</li>
          </ul>
        </div>

        {/* Module 6: Neutral Terminology */}
        <div className="p-5 rounded-xl bg-[#0F172A] border border-[#1E293B] space-y-3">
          <div className="flex items-center space-x-2 text-rose-400 font-bold text-sm">
            <Scale className="w-5 h-5" />
            <span>6. Neutral Forensic Standards & Terminology</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Forensic engineering ethics strictly forbid declaring an image "100% Fake" or "Guaranteed Authentic" through automated heuristic thresholds.
          </p>
          <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
            <li><strong>Approved Terms:</strong> <em>"Potential Anomaly"</em>, <em>"Suspicious Region"</em>, <em>"Inconsistent Metadata"</em>, and <em>"Requires Further Review"</em>.</li>
            <li><strong>Corroboration:</strong> No single algorithm is conclusive on its own. An investigation synthesizes integrity hashes, metadata, ELA, copy-move vectors, and noise maps.</li>
            <li><strong>Legal Distinction:</strong> Technical discrepancies can occur through benign social media uploads, recompression, or camera firmware updates.</li>
          </ul>
        </div>
      </div>

      {/* College Viva Questions & Answers Section */}
      <div className="p-6 rounded-xl bg-[#0F172A] border border-[#1E293B] space-y-4">
        <div className="flex items-center space-x-2 text-slate-100 font-bold text-sm">
          <HelpCircle className="w-5 h-5 text-cyan-400" />
          <span>High-Yield College Viva Examination Q&A</span>
        </div>

        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-lg bg-[#0A0D15] border border-[#1A2436] space-y-1">
            <div className="font-bold text-cyan-300">
              Q1: Why is SHA-256 calculated on the raw incoming bytes rather than after decoding in Pillow?
            </div>
            <p className="text-slate-300 leading-relaxed">
              <strong>Answer:</strong> Image decoders (like Pillow or OpenCV) parse compressed JPEG/PNG streams into raw RGB pixel arrays. Saving them back would re-encode the file with different quantization tables, destroying the original byte integrity. Calculating SHA-256 directly on the raw uploaded byte stream preserves the exact cryptographic footprint for chain-of-custody verification.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-[#0A0D15] border border-[#1A2436] space-y-1">
            <div className="font-bold text-cyan-300">
              Q2: What is the core principle behind Error Level Analysis (ELA)?
            </div>
            <p className="text-slate-300 leading-relaxed">
              <strong>Answer:</strong> In JPEG compression, repeated resaves at a given quality reach an error equilibrium where further losses diminish. If an element from an uncompressed or differently compressed source is inserted into an existing JPEG, its compression error rate will diverge significantly from surrounding blocks during intentional recompression at 90%, highlighting the anomaly in the amplified difference map.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-[#0A0D15] border border-[#1A2436] space-y-1">
            <div className="font-bold text-cyan-300">
              Q3: Why does Copy-Move detection require a spatial separation threshold?
            </div>
            <p className="text-slate-300 leading-relaxed">
              <strong>Answer:</strong> Neighboring keypoints on the same physical object share similar gradients and textures. Without filtering matches based on minimum Euclidean distance (e.g. &gt; 35 px), thousands of trivial self-matches would occur between adjacent pixels on the same object, causing severe false positives.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-[#0A0D15] border border-[#1A2436] space-y-1">
            <div className="font-bold text-cyan-300">
              Q4: Can metadata alone confirm image forgery?
            </div>
            <p className="text-slate-300 leading-relaxed">
              <strong>Answer:</strong> No. Metadata can easily be forged, stripped, or altered with hex editors or command-line utilities. Software tags like "Adobe Photoshop" merely confirm the file was processed by that application (which is common for color grading, resizing, or digital watermarking), not that pixels were maliciously cloned or spliced.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

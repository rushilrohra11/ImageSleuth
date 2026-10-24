import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Maximize2,
  Plus,
  FileDown,
  Clock,
  Sparkles,
  Camera,
  Layers,
  Copy,
  Check,
  Zap
} from 'lucide-react';
import type {
  EvidenceItem,
  MetadataRecord,
  AnalysisRecord,
  Finding,
  IntegrityVerification,
  ReportItem
} from '../types';
import { api } from '../services/api';
import { ImageComparisonModal } from '../components/ImageComparisonModal';

interface ForensicWorkspacePageProps {
  caseId: number | null;
  evidenceId: number | null;
  onSelectEvidence: (evidenceId: number) => void;
  onRefreshTelemetry?: () => void;
}

export const ForensicWorkspacePage: React.FC<ForensicWorkspacePageProps> = ({
  caseId,
  evidenceId,
  onRefreshTelemetry,
}) => {
  const [evidence, setEvidence] = useState<EvidenceItem | null>(null);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [activeTab, setActiveTab] = useState<'metadata' | 'ela' | 'copymove' | 'noise' | 'findings' | 'report'>('metadata');

  // Integrity State
  const [integrityVerif, setIntegrityVerif] = useState<IntegrityVerification | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [integrityHistory, setIntegrityHistory] = useState<IntegrityVerification[]>([]);
  const [showIntegrityHistory, setShowIntegrityHistory] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  // Metadata State
  const [metadata, setMetadata] = useState<MetadataRecord | null>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [metadataSearch, setMetadataSearch] = useState('');

  // ELA State
  const [elaQuality, setElaQuality] = useState<number>(90);
  const [elaAmp, setElaAmp] = useState<number>(15);
  const [latestEla, setLatestEla] = useState<AnalysisRecord | null>(null);
  const [runningEla, setRunningEla] = useState(false);

  // Copy-Move State
  const [cmMethod, setCmMethod] = useState<string>('SIFT');
  const [cmMaxKp, setCmMaxKp] = useState<number>(2500);
  const [cmRatio, setCmRatio] = useState<number>(0.75);
  const [cmMinDist, setCmMinDist] = useState<number>(35);
  const [latestCm, setLatestCm] = useState<AnalysisRecord | null>(null);
  const [runningCm, setRunningCm] = useState(false);

  // Noise State
  const [noiseWindow, setNoiseWindow] = useState<number>(9);
  const [latestNoise, setLatestNoise] = useState<AnalysisRecord | null>(null);
  const [runningNoise, setRunningNoise] = useState(false);

  // Findings State
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loadingFindings, setLoadingFindings] = useState(false);
  const [newFindingModalOpen, setNewFindingModalOpen] = useState(false);
  const [newFindingCategory, setNewFindingCategory] = useState<'INFORMATIONAL' | 'OBSERVATION' | 'POTENTIAL_ANOMALY' | 'INTEGRITY_FAILURE' | 'ANALYSIS_LIMITATION'>('OBSERVATION');
  const [newFindingDesc, setNewFindingDesc] = useState('');
  const [newFindingSeverity, setNewFindingSeverity] = useState<'INFO' | 'LOW' | 'MEDIUM' | 'HIGH'>('LOW');
  const [newFindingNotes, setNewFindingNotes] = useState('');

  // Report State
  const [generatingReport, setGeneratingReport] = useState(false);
  const [latestReport, setLatestReport] = useState<ReportItem | null>(null);

  // Comparison Modal
  const [comparisonModal, setComparisonModal] = useState<{
    open: boolean;
    derivedUrl: string;
    title: string;
    subtitle: string;
  }>({
    open: false,
    derivedUrl: '',
    title: '',
    subtitle: '',
  });

  // Load Evidence & Active Data
  const loadEvidenceData = async (evId: number) => {
    try {
      setLoadingEvidence(true);
      const ev = await api.getEvidence(evId);
      setEvidence(ev);

      // Fetch analyses
      const analyses = await api.listAnalyses(evId);
      const ela = analyses.find((a) => a.analysis_type === 'ELA');
      if (ela) setLatestEla(ela);
      const cm = analyses.find((a) => a.analysis_type === 'COPY_MOVE');
      if (cm) setLatestCm(cm);
      const nse = analyses.find((a) => a.analysis_type === 'NOISE');
      if (nse) setLatestNoise(nse);

      // Fetch metadata
      setLoadingMetadata(true);
      const meta = await api.getMetadata(evId);
      setMetadata(meta);
      setLoadingMetadata(false);

      // Fetch findings
      setLoadingFindings(true);
      const fnds = await api.listFindings(evId);
      setFindings(fnds);
      setLoadingFindings(false);

      // Fetch integrity history
      const history = await api.getIntegrityHistory(evId);
      setIntegrityHistory(history);
      if (history.length > 0) setIntegrityVerif(history[0]);
    } catch (err: any) {
      console.error('Error loading evidence:', err);
    } finally {
      setLoadingEvidence(false);
    }
  };

  useEffect(() => {
    if (evidenceId) {
      loadEvidenceData(evidenceId);
    }
  }, [evidenceId]);

  // Actions
  const handleVerifyIntegrity = async () => {
    if (!evidence) return;
    try {
      setIsVerifying(true);
      const res = await api.verifyIntegrity(evidence.id);
      setIntegrityVerif(res);
      const history = await api.getIntegrityHistory(evidence.id);
      setIntegrityHistory(history);
      const updatedFindings = await api.listFindings(evidence.id);
      setFindings(updatedFindings);
      if (onRefreshTelemetry) onRefreshTelemetry();
    } catch (err: any) {
      alert(`Integrity verification failed: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRunEla = async () => {
    if (!evidence) return;
    try {
      setRunningEla(true);
      const res = await api.runEla(evidence.id, { quality: elaQuality, amplification: elaAmp });
      setLatestEla(res);
      const updatedFindings = await api.listFindings(evidence.id);
      setFindings(updatedFindings);
      if (onRefreshTelemetry) onRefreshTelemetry();
    } catch (err: any) {
      alert(`ELA execution failed: ${err.message}`);
    } finally {
      setRunningEla(false);
    }
  };

  const handleRunCopyMove = async () => {
    if (!evidence) return;
    try {
      setRunningCm(true);
      const res = await api.runCopyMove(evidence.id, {
        method: cmMethod,
        max_keypoints: cmMaxKp,
        ratio: cmRatio,
        min_distance: cmMinDist,
      });
      setLatestCm(res);
      const updatedFindings = await api.listFindings(evidence.id);
      setFindings(updatedFindings);
      if (onRefreshTelemetry) onRefreshTelemetry();
    } catch (err: any) {
      alert(`Copy-Move execution failed: ${err.message}`);
    } finally {
      setRunningCm(false);
    }
  };

  const handleRunNoise = async () => {
    if (!evidence) return;
    try {
      setRunningNoise(true);
      const res = await api.runNoise(evidence.id, { window_size: noiseWindow });
      setLatestNoise(res);
      const updatedFindings = await api.listFindings(evidence.id);
      setFindings(updatedFindings);
      if (onRefreshTelemetry) onRefreshTelemetry();
    } catch (err: any) {
      alert(`Noise analysis failed: ${err.message}`);
    } finally {
      setRunningNoise(false);
    }
  };

  const handleCreateFinding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidence || !newFindingDesc.trim()) return;
    try {
      const created = await api.createFinding(evidence.id, {
        category: newFindingCategory,
        description: newFindingDesc,
        severity: newFindingSeverity,
        examiner_notes: newFindingNotes,
        review_status: 'UNREVIEWED',
      });
      setFindings((prev) => [created, ...prev]);
      setNewFindingModalOpen(false);
      setNewFindingDesc('');
      setNewFindingNotes('');
      if (onRefreshTelemetry) onRefreshTelemetry();
    } catch (err: any) {
      alert(`Failed to add finding: ${err.message}`);
    }
  };

  const handleUpdateFindingStatus = async (findingId: number, status: 'UNREVIEWED' | 'CONFIRMED' | 'DISMISSED') => {
    try {
      const updated = await api.updateFinding(findingId, { review_status: status });
      setFindings((prev) => prev.map((f) => (f.id === findingId ? updated : f)));
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  };

  const handleGenerateReport = async () => {
    if (!evidence || !caseId) return;
    try {
      setGeneratingReport(true);
      const rep = await api.generateReport(caseId, evidence.id);
      setLatestReport(rep);
      if (onRefreshTelemetry) onRefreshTelemetry();
    } catch (err: any) {
      alert(`Report compilation failed: ${err.message}`);
    } finally {
      setGeneratingReport(false);
    }
  };

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  if (loadingEvidence) {
    return (
      <div className="flex-1 p-12 flex flex-col items-center justify-center text-slate-400 space-y-4">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <h2 className="text-sm font-semibold text-slate-300">Loading Forensic Evidence...</h2>
      </div>
    );
  }

  if (!evidenceId || !evidence) {
    return (
      <div className="flex-1 p-12 flex flex-col items-center justify-center text-slate-400 space-y-4">
        <Layers className="w-12 h-12 text-slate-600 animate-pulse" />
        <h2 className="text-base font-semibold text-slate-300">No Evidence Item Selected</h2>
        <p className="text-xs text-slate-500 max-w-sm text-center">
          Select an evidence file from the Evidence Library or ingest a new image in New Investigation to load the forensic workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Top Evidence Inspector Header */}
      <div className="bg-[#0B0F17] border-b border-[#1E293B] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
        <div className="flex items-start sm:items-center space-x-3.5">
          <img
            src={evidence.preview_url}
            alt={evidence.original_filename}
            className="w-14 h-14 object-cover rounded-lg border border-[#273549] bg-black/40 shrink-0"
          />
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold text-cyan-400">{evidence.evidence_id}</span>
              <span className="text-xs font-bold text-slate-100">{evidence.original_filename}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                {evidence.detected_format}
              </span>
            </div>

            <div className="flex items-center space-x-3 text-[11px] text-slate-400 mt-1">
              <span>{evidence.width} x {evidence.height} px</span>
              <span>&bull;</span>
              <span>{(evidence.file_size_bytes / 1024).toFixed(1)} KB</span>
              <span>&bull;</span>
              <span>Acquired: {new Date(evidence.created_at).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* SHA-256 Hash & Reverify Button */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-2 bg-[#101726] px-3 py-1.5 rounded-lg border border-[#223047] text-xs">
            <span className="text-[10px] text-slate-500 font-mono">SHA-256:</span>
            <span className="font-mono text-cyan-300 text-[11px] truncate max-w-[200px]" title={evidence.sha256_hash}>
              {evidence.sha256_hash}
            </span>
            <button
              onClick={() => copyHash(evidence.sha256_hash)}
              className="text-slate-400 hover:text-cyan-300 cursor-pointer"
              title="Copy SHA-256 hash"
            >
              {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {integrityVerif?.status === 'PASS' ? (
              <span className="inline-flex items-center space-x-1 text-xs px-2.5 py-1 rounded-md badge-pass font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>INTEGRITY PASS</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 text-xs px-2.5 py-1 rounded-md badge-fail font-medium">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>HASH MISMATCH</span>
              </span>
            )}

            <button
              onClick={handleVerifyIntegrity}
              disabled={isVerifying}
              className="px-3 py-1 text-xs rounded-md bg-[#162032] hover:bg-[#202E46] text-cyan-300 border border-[#273549] transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className={`w-3 h-3 ${isVerifying ? 'animate-spin' : ''}`} />
              <span>{isVerifying ? 'Verifying...' : 'Reverify'}</span>
            </button>

            <button
              onClick={() => setShowIntegrityHistory(!showIntegrityHistory)}
              className="p-1.5 text-xs text-slate-400 hover:text-slate-200 rounded-md bg-[#131C2E] border border-[#273549]"
              title="View audit trail of integrity checks"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Integrity Audit History Dropdown / Banner */}
      {showIntegrityHistory && (
        <div className="bg-[#080C14] border-b border-[#1E293B] p-4 text-xs space-y-2">
          <div className="flex items-center justify-between text-slate-300 font-semibold text-[11px]">
            <span>Integrity Verification Audit History ({integrityHistory.length} events recorded)</span>
            <button onClick={() => setShowIntegrityHistory(false)} className="text-slate-500 hover:text-slate-300">
              Close
            </button>
          </div>
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {integrityHistory.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between p-2 rounded bg-[#0F172A] border border-[#1E293B] font-mono text-[11px]"
              >
                <div className="flex items-center space-x-2">
                  <span className={h.status === 'PASS' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    [{h.status}]
                  </span>
                  <span className="text-slate-400">Calculated: {h.calculated_hash.slice(0, 16)}...</span>
                </div>
                <span className="text-slate-500">{new Date(h.verified_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="bg-[#0D131F] border-b border-[#1E293B] px-6 flex items-center space-x-1 shrink-0 overflow-x-auto">
        {[
          { id: 'metadata', label: 'Metadata Examination', icon: Camera },
          { id: 'ela', label: 'Error Level Analysis (ELA)', icon: Zap },
          { id: 'copymove', label: 'Copy-Move Detection', icon: Layers },
          { id: 'noise', label: 'Noise & Consistency', icon: Sparkles },
          { id: 'findings', label: `Findings Registry (${findings.length})`, icon: AlertTriangle },
          { id: 'report', label: 'Report Generation', icon: FileDown },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-3 text-xs font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#131C2E]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents Viewport */}
      <div className="flex-1 p-6 overflow-y-auto bg-[#090D15]">
        {/* ================= TAB 1: METADATA ================= */}
        {activeTab === 'metadata' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#0F172A] border border-[#1E293B]">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <span>EXIF & Image Structural Metadata</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">
                    Engine: {metadata?.tool_used || 'Pillow Fallback'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Extracted camera specifications, capture timestamps, software tags, and embedded properties.
                </p>
              </div>

              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter metadata fields..."
                  value={metadataSearch}
                  onChange={(e) => setMetadataSearch(e.target.value)}
                  className="w-full bg-[#131C2E] border border-[#273549] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Potential Anomaly Banners */}
            {metadata?.potential_anomalies && metadata.potential_anomalies.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-amber-400 flex items-center space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Metadata Inconsistency & Potential Observations ({metadata.potential_anomalies.length})</span>
                </h4>
                {metadata.potential_anomalies.map((anom, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start space-x-3"
                  >
                    <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono text-[10px]">
                      {anom.type}
                    </span>
                    <div className="flex-1">
                      <p>{anom.description}</p>
                      <span className="text-[10px] text-amber-400/80 mt-1 block">
                        Affected field: <strong>{anom.field}</strong> | Severity: <strong>{anom.severity}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Structured Metadata Table */}
            {loadingMetadata ? (
              <div className="p-8 text-center text-xs text-slate-500 font-mono">Loading metadata records...</div>
            ) : (
            <div className="rounded-xl bg-[#0F172A] border border-[#1E293B] overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-[#1E293B] bg-[#0C121E] text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-4 w-1/3">Field Name</th>
                    <th className="py-2.5 px-4">Extracted Forensic Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A2436]">
                  {metadata?.extracted_summary &&
                    Object.entries(metadata.extracted_summary)
                      .filter(
                        ([key, val]) =>
                          key.toLowerCase().includes(metadataSearch.toLowerCase()) ||
                          String(val).toLowerCase().includes(metadataSearch.toLowerCase())
                      )
                      .map(([key, val]) => (
                        <tr key={key} className="hover:bg-[#131C2E] transition-colors">
                          <td className="py-2.5 px-4 font-medium text-slate-300">{key}</td>
                          <td className="py-2.5 px-4 font-mono text-cyan-300 text-[11px]">{String(val)}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
            )}

            {/* Caveat Notice */}
            <div className="p-3.5 rounded-lg bg-[#0C121D] border border-[#1A263A] text-[11px] text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">Forensic Methodology Note:</p>
              <p>
                Metadata absence does not establish manipulation; many web services and social platforms strip EXIF automatically for user privacy. Similarly, software tags indicate post-processing or re-encoding, but not necessarily malicious forgery.
              </p>
            </div>
          </div>
        )}

        {/* ================= TAB 2: ERROR LEVEL ANALYSIS ================= */}
        {activeTab === 'ela' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            {/* Control Panel */}
            <div className="p-5 rounded-xl bg-[#0F172A] border border-[#1E293B] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                    <span>Error Level Analysis (ELA) Configuration</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Recompresses a working copy and visualizes compression loss discrepancies across 8x8 DCT grid blocks.
                  </p>
                </div>

                <button
                  onClick={handleRunEla}
                  disabled={runningEla}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 flex items-center space-x-2 transition-all cursor-pointer shadow-md shadow-cyan-950 disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{runningEla ? 'Recompressing & Computing Error...' : 'Execute ELA Analysis'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* JPEG Quality Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">Recompression Quality:</span>
                    <span className="font-mono text-cyan-400 font-bold">{elaQuality}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="98"
                    value={elaQuality}
                    onChange={(e) => setElaQuality(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>50% (High compression)</span>
                    <span>90% (Forensic Standard)</span>
                    <span>98% (Low compression)</span>
                  </div>
                </div>

                {/* Amplification Scale Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">Visualization Amplification:</span>
                    <span className="font-mono text-cyan-400 font-bold">{elaAmp}x</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="40"
                    value={elaAmp}
                    onChange={(e) => setElaAmp(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>5x (Subtle)</span>
                    <span>15x (Recommended)</span>
                    <span>40x (Maximum)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Results Section */}
            {latestEla ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Original Card */}
                  <div className="p-4 rounded-xl bg-[#0F172A] border border-[#1E293B] flex flex-col items-center">
                    <span className="text-xs font-semibold text-slate-300 mb-2">Original Evidence Image</span>
                    <div className="h-64 flex items-center justify-center overflow-hidden w-full">
                      <img
                        src={evidence.preview_url}
                        alt="Original"
                        className="max-h-64 max-w-full object-contain rounded border border-[#273549]"
                      />
                    </div>
                  </div>

                  {/* ELA Difference Card */}
                  <div className="p-4 rounded-xl bg-[#0F172A] border border-cyan-500/30 flex flex-col items-center">
                    <div className="flex items-center justify-between w-full mb-2">
                      <span className="text-xs font-semibold text-cyan-400">Amplified ELA Difference Map</span>
                      <button
                        onClick={() =>
                          setComparisonModal({
                            open: true,
                            derivedUrl: latestEla.output_image_url!,
                            title: 'Error Level Analysis (ELA) Comparison',
                            subtitle: `Recompression Quality: ${elaQuality}% | Scale: ${elaAmp}x`,
                          })
                        }
                        className="flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 text-xs font-medium cursor-pointer"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Interactive Compare</span>
                      </button>
                    </div>
                    <div className="h-64 flex items-center justify-center overflow-hidden w-full">
                      <img
                        src={latestEla.output_image_url}
                        alt="ELA Output"
                        className="max-h-64 max-w-full object-contain rounded border border-cyan-900/50"
                      />
                    </div>
                  </div>
                </div>

                {/* Quantitative Metrics & Interpretation */}
                <div className="p-4 rounded-xl bg-[#0F172A] border border-[#1E293B] space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Quantitative Compression Metrics & Interpretation
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-2.5 rounded bg-[#0A0D15] border border-[#1A2436]">
                      <span className="text-slate-500 text-[10px]">Mean Pixel Error:</span>
                      <div className="text-cyan-400 font-mono font-bold text-sm mt-0.5">
                        {latestEla.metrics?.mean_error}
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#0A0D15] border border-[#1A2436]">
                      <span className="text-slate-500 text-[10px]">Max Pixel Error:</span>
                      <div className="text-slate-200 font-mono font-bold text-sm mt-0.5">
                        {latestEla.metrics?.max_error}
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#0A0D15] border border-[#1A2436]">
                      <span className="text-slate-500 text-[10px]">Error Std Dev:</span>
                      <div className="text-amber-400 font-mono font-bold text-sm mt-0.5">
                        {latestEla.metrics?.std_error}
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#0A0D15] border border-[#1A2436]">
                      <span className="text-slate-500 text-[10px]">Execution Time:</span>
                      <div className="text-slate-300 font-mono text-sm mt-0.5">
                        {latestEla.duration_ms} ms
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed bg-[#0B0F17] p-3 rounded border border-[#1E293B]">
                    {latestEla.interpretation_notes}
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center rounded-xl bg-[#0F172A] border border-[#1E293B] text-slate-500 space-y-2">
                <Zap className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs">Click "Execute ELA Analysis" to generate the compression error map.</p>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: COPY-MOVE FORGERY ================= */}
        {activeTab === 'copymove' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            {/* Control Panel */}
            <div className="p-5 rounded-xl bg-[#0F172A] border border-[#1E293B] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                    <span>Copy-Move Forgery Detection (SIFT / ORB)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Extracts invariant feature descriptors and filters spatial self-matches to detect cloned regions.
                  </p>
                </div>

                <button
                  onClick={handleRunCopyMove}
                  disabled={runningCm}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 flex items-center space-x-2 transition-all cursor-pointer shadow-md shadow-cyan-950 disabled:opacity-50"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{runningCm ? 'Extracting & Matching Features...' : 'Run Copy-Move Detection'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2 text-xs">
                {/* Method */}
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Detector Algorithm:</label>
                  <select
                    value={cmMethod}
                    onChange={(e) => setCmMethod(e.target.value)}
                    className="w-full bg-[#131C2E] border border-[#273549] rounded-lg px-2.5 py-1.5 text-slate-200"
                  >
                    <option value="SIFT">SIFT (Scale-Invariant)</option>
                    <option value="ORB">ORB (Oriented FAST)</option>
                  </select>
                </div>

                {/* Max Keypoints */}
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Max Keypoints: {cmMaxKp}</label>
                  <input
                    type="range"
                    min="1000"
                    max="5000"
                    step="500"
                    value={cmMaxKp}
                    onChange={(e) => setCmMaxKp(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                {/* Ratio Test */}
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Ratio Threshold: {cmRatio}</label>
                  <input
                    type="range"
                    min="0.60"
                    max="0.85"
                    step="0.05"
                    value={cmRatio}
                    onChange={(e) => setCmRatio(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                {/* Min Spatial Distance */}
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Min Spatial Dist: {cmMinDist}px</label>
                  <input
                    type="range"
                    min="20"
                    max="80"
                    step="5"
                    value={cmMinDist}
                    onChange={(e) => setCmMinDist(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Results Section */}
            {latestCm ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#0F172A] border border-cyan-500/30 flex flex-col items-center">
                  <div className="flex items-center justify-between w-full mb-2">
                    <span className="text-xs font-semibold text-cyan-400">
                      Feature Detection & Spatial Vector Overlay
                    </span>
                    <button
                      onClick={() =>
                        setComparisonModal({
                          open: true,
                          derivedUrl: latestCm.output_image_url!,
                          title: 'Copy-Move Feature Matching Comparison',
                          subtitle: `Algorithm: ${cmMethod} | Retained Matches: ${latestCm.metrics?.retained_matches}`,
                        })
                      }
                      className="flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 text-xs font-medium cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Full Resolution View</span>
                    </button>
                  </div>
                  <div className="max-h-96 flex items-center justify-center overflow-hidden w-full">
                    <img
                      src={latestCm.output_image_url}
                      alt="Copy Move Overlay"
                      className="max-h-96 max-w-full object-contain rounded border border-cyan-900/50"
                    />
                  </div>
                </div>

                {/* Diagnostic counts */}
                <div className="p-4 rounded-xl bg-[#0F172A] border border-[#1E293B] space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-2.5 rounded bg-[#0A0D15] border border-[#1A2436]">
                      <span className="text-slate-500 text-[10px]">Total Keypoints:</span>
                      <div className="text-cyan-400 font-mono font-bold text-sm mt-0.5">
                        {latestCm.metrics?.total_keypoints}
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#0A0D15] border border-[#1A2436]">
                      <span className="text-slate-500 text-[10px]">Candidate Matches:</span>
                      <div className="text-slate-200 font-mono font-bold text-sm mt-0.5">
                        {latestCm.metrics?.candidate_matches}
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#0A0D15] border border-[#1A2436]">
                      <span className="text-slate-500 text-[10px]">Retained Matches:</span>
                      <div
                        className={`font-mono font-bold text-sm mt-0.5 ${
                          (latestCm.metrics?.retained_matches || 0) > 10 ? 'text-amber-400' : 'text-emerald-400'
                        }`}
                      >
                        {latestCm.metrics?.retained_matches}
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#0A0D15] border border-[#1A2436]">
                      <span className="text-slate-500 text-[10px]">Processing Time:</span>
                      <div className="text-slate-300 font-mono text-sm mt-0.5">
                        {latestCm.duration_ms} ms
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed bg-[#0B0F17] p-3 rounded border border-[#1E293B]">
                    {latestCm.interpretation_notes}
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center rounded-xl bg-[#0F172A] border border-[#1E293B] text-slate-500 space-y-2">
                <Layers className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs">Click "Run Copy-Move Detection" to search for duplicated region clusters.</p>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 4: NOISE CONSISTENCY ================= */}
        {activeTab === 'noise' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            {/* Control Panel */}
            <div className="p-5 rounded-xl bg-[#0F172A] border border-[#1E293B] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                    <span>Noise and Residual Consistency Analysis</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Analyzes high-frequency residual variance via Gaussian signal subtraction and sliding-window estimation.
                  </p>
                </div>

                <button
                  onClick={handleRunNoise}
                  disabled={runningNoise}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 flex items-center space-x-2 transition-all cursor-pointer shadow-md shadow-cyan-950 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{runningNoise ? 'Estimating Residual Variance...' : 'Run Noise Analysis'}</span>
                </button>
              </div>

              <div className="flex items-center space-x-4 pt-2 text-xs">
                <span className="text-slate-300 font-medium">Window Size:</span>
                {[7, 9, 11, 15].map((w) => (
                  <button
                    key={w}
                    onClick={() => setNoiseWindow(w)}
                    className={`px-3 py-1.5 rounded-md font-mono transition-all ${
                      noiseWindow === w
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                        : 'bg-[#131C2E] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {w}x{w}
                  </button>
                ))}
              </div>
            </div>

            {/* Results Section */}
            {latestNoise ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Original Card */}
                  <div className="p-4 rounded-xl bg-[#0F172A] border border-[#1E293B] flex flex-col items-center">
                    <span className="text-xs font-semibold text-slate-300 mb-2">Original Evidence</span>
                    <div className="h-64 flex items-center justify-center overflow-hidden w-full">
                      <img
                        src={evidence.preview_url}
                        alt="Original"
                        className="max-h-64 max-w-full object-contain rounded border border-[#273549]"
                      />
                    </div>
                  </div>

                  {/* Noise Heatmap Card */}
                  <div className="p-4 rounded-xl bg-[#0F172A] border border-cyan-500/30 flex flex-col items-center">
                    <div className="flex items-center justify-between w-full mb-2">
                      <span className="text-xs font-semibold text-cyan-400">
                        Inferno Residual Variance Heatmap
                      </span>
                      <button
                        onClick={() =>
                          setComparisonModal({
                            open: true,
                            derivedUrl: latestNoise.output_image_url!,
                            title: 'Noise Floor Variance Heatmap Comparison',
                            subtitle: `Window Size: ${noiseWindow}x${noiseWindow} | Colormap: INFERNO`,
                          })
                        }
                        className="flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 text-xs font-medium cursor-pointer"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Interactive Compare</span>
                      </button>
                    </div>
                    <div className="h-64 flex items-center justify-center overflow-hidden w-full">
                      <img
                        src={latestNoise.output_image_url}
                        alt="Noise Output"
                        className="max-h-64 max-w-full object-contain rounded border border-cyan-900/50"
                      />
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="p-4 rounded-xl bg-[#0F172A] border border-[#1E293B] space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-2.5 rounded bg-[#0A0D15] border border-[#1A2436]">
                      <span className="text-slate-500 text-[10px]">Mean Noise Amplitude:</span>
                      <div className="text-cyan-400 font-mono font-bold text-sm mt-0.5">
                        {latestNoise.metrics?.mean_noise_std}
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#0A0D15] border border-[#1A2436]">
                      <span className="text-slate-500 text-[10px]">Spatial Variance Std:</span>
                      <div className="text-amber-400 font-mono font-bold text-sm mt-0.5">
                        {latestNoise.metrics?.std_noise_variation}
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#0A0D15] border border-[#1A2436]">
                      <span className="text-slate-500 text-[10px]">95th Percentile:</span>
                      <div className="text-slate-200 font-mono font-bold text-sm mt-0.5">
                        {latestNoise.metrics?.p95_noise_level}
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#0A0D15] border border-[#1A2436]">
                      <span className="text-slate-500 text-[10px]">Execution Time:</span>
                      <div className="text-slate-300 font-mono text-sm mt-0.5">
                        {latestNoise.duration_ms} ms
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed bg-[#0B0F17] p-3 rounded border border-[#1E293B]">
                    {latestNoise.interpretation_notes}
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center rounded-xl bg-[#0F172A] border border-[#1E293B] text-slate-500 space-y-2">
                <Sparkles className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs">Click "Run Noise Analysis" to compute local residual noise variance maps.</p>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 5: FINDINGS REGISTRY ================= */}
        {activeTab === 'findings' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between p-4 rounded-xl bg-[#0F172A] border border-[#1E293B]">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <span>Forensic Findings Registry</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    {findings.length} entries
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Chronological record of observations, anomalies, limitations, and examiner determinations.
                </p>
              </div>

              <button
                onClick={() => setNewFindingModalOpen(true)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Examiner Finding</span>
              </button>
            </div>

            {loadingFindings ? (
              <div className="p-8 text-center text-xs text-slate-500 font-mono">Loading findings records...</div>
            ) : findings.length > 0 ? (
              <div className="space-y-3">
                {findings.map((f) => {
                  const isHigh = f.severity === 'HIGH';
                  const isMed = f.severity === 'MEDIUM';
                  return (
                    <div
                      key={f.id}
                      className="p-4 rounded-xl bg-[#0F172A] border border-[#1E293B] space-y-3 text-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-cyan-400 text-xs">{f.finding_id}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide ${
                              isHigh
                                ? 'badge-fail'
                                : isMed
                                ? 'badge-anomaly'
                                : 'badge-info'
                            }`}
                          >
                            {f.category} &bull; {f.severity}
                          </span>
                        </div>

                        {/* Status selector */}
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[10px] text-slate-500">Status:</span>
                          <select
                            value={f.review_status}
                            onChange={(e) => handleUpdateFindingStatus(f.id, e.target.value as any)}
                            className="bg-[#131C2E] border border-[#273549] text-slate-200 text-[11px] rounded px-2 py-0.5 focus:outline-none focus:border-cyan-500"
                          >
                            <option value="UNREVIEWED">Unreviewed</option>
                            <option value="CONFIRMED">Confirmed</option>
                            <option value="DISMISSED">Dismissed</option>
                          </select>
                        </div>
                      </div>

                      <p className="text-slate-200 leading-relaxed">{f.description}</p>

                      {f.supporting_data && (
                        <div className="p-2 rounded bg-[#0A0D15] border border-[#1A2436] font-mono text-[10px] text-slate-400">
                          {f.supporting_data}
                        </div>
                      )}

                      {f.examiner_notes && (
                        <p className="text-[11px] text-slate-400 italic">
                          Examiner Note: {f.examiner_notes}
                        </p>
                      )}

                      <div className="text-[10px] text-slate-500 font-mono">
                        Logged: {new Date(f.created_at).toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center rounded-xl bg-[#0F172A] border border-[#1E293B] text-slate-500 space-y-2">
                <AlertTriangle className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs">No findings recorded yet. Run forensic modules or add a custom examiner note.</p>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 6: REPORT GENERATION ================= */}
        {activeTab === 'report' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="p-6 rounded-xl bg-[#0F172A] border border-[#1E293B] space-y-4">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <FileDown className="w-5 h-5 text-cyan-400" />
                <span>Forensic Investigation Report Compiler</span>
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Generate an official, publication-grade digital image forensics report in PDF format.
                The document compiles acquisition hashes, chain of custody records, EXIF metadata tables,
                derived visualization artifacts (ELA, Copy-Move, Noise), findings registry, and explicit methodological limitations.
              </p>

              <div className="p-4 rounded-lg bg-[#0A0D15] border border-[#1E293B] space-y-2 text-xs">
                <div className="font-semibold text-slate-300">Report Package Includes:</div>
                <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                  <li>Case metadata & Examiner credentials</li>
                  <li>Original SHA-256 hash & Latest integrity verification event</li>
                  <li>Metadata summary & Editing software signatures</li>
                  <li>ELA recompression parameters, error metrics & derived image</li>
                  <li>Copy-Move SIFT/ORB feature matching metrics & vector visualization</li>
                  <li>High-frequency residual variance metrics & Inferno heatmap</li>
                  <li>Findings registry & Legal disclaimer caveats</li>
                  <li>Examiner signature block</li>
                </ul>
              </div>

              <div className="pt-2 flex items-center space-x-4">
                <button
                  onClick={handleGenerateReport}
                  disabled={generatingReport}
                  className="px-6 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs tracking-wide shadow-md shadow-cyan-950 flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <FileDown className="w-4 h-4" />
                  <span>{generatingReport ? 'Compiling Forensic PDF via ReportLab...' : 'Compile & Export Forensic Report (PDF)'}</span>
                </button>
              </div>
            </div>

            {/* Generated Report Link */}
            {latestReport && (
              <div className="p-5 rounded-xl bg-[#0D1829] border border-cyan-500/40 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-lg bg-cyan-500/20 text-cyan-400">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-100">{latestReport.title}</h4>
                    <span className="font-mono text-cyan-300 text-[11px]">{latestReport.report_id}</span>
                  </div>
                </div>

                <a
                  href={latestReport.download_url}
                  download={latestReport.file_path}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center space-x-1.5 transition-colors"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Download PDF Document</span>
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Custom Finding Modal */}
      {newFindingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateFinding}
            className="bg-[#0F172A] border border-[#273549] max-w-lg w-full p-6 rounded-xl shadow-2xl space-y-4 text-xs"
          >
            <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <Plus className="w-4 h-4 text-cyan-400" />
              <span>Record New Examiner Finding</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Category</label>
                <select
                  value={newFindingCategory}
                  onChange={(e) => setNewFindingCategory(e.target.value as any)}
                  className="w-full bg-[#131C2E] border border-[#273549] rounded-lg px-2.5 py-2 text-slate-200"
                >
                  <option value="INFORMATIONAL">Informational</option>
                  <option value="OBSERVATION">Observation</option>
                  <option value="POTENTIAL_ANOMALY">Potential Anomaly</option>
                  <option value="INTEGRITY_FAILURE">Integrity Failure</option>
                  <option value="ANALYSIS_LIMITATION">Analysis Limitation</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Severity</label>
                <select
                  value={newFindingSeverity}
                  onChange={(e) => setNewFindingSeverity(e.target.value as any)}
                  className="w-full bg-[#131C2E] border border-[#273549] rounded-lg px-2.5 py-2 text-slate-200"
                >
                  <option value="INFO">Info</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-medium">Description</label>
              <textarea
                required
                rows={3}
                placeholder="Specific forensic observation or anomaly observed..."
                value={newFindingDesc}
                onChange={(e) => setNewFindingDesc(e.target.value)}
                className="w-full bg-[#131C2E] border border-[#273549] rounded-lg px-3 py-2 text-slate-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-medium">Examiner Notes / Technical Reasoning</label>
              <textarea
                rows={2}
                placeholder="Technical context, corroborating tools, or follow-up instructions..."
                value={newFindingNotes}
                onChange={(e) => setNewFindingNotes(e.target.value)}
                className="w-full bg-[#131C2E] border border-[#273549] rounded-lg px-3 py-2 text-slate-200"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setNewFindingModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-[#162032] hover:bg-[#202E46] text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold"
              >
                Save Finding
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Comparison Modal */}
      <ImageComparisonModal
        isOpen={comparisonModal.open}
        onClose={() => setComparisonModal((prev) => ({ ...prev, open: false }))}
        originalUrl={evidence.preview_url}
        derivedUrl={comparisonModal.derivedUrl}
        title={comparisonModal.title}
        subtitle={comparisonModal.subtitle}
      />
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Search,
  FolderOpen,
  Trash2,
  ExternalLink,
  Shield,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  HardDrive
} from 'lucide-react';
import type { CaseSummary, CaseDetail } from '../types';
import { api } from '../services/api';

interface EvidenceLibraryPageProps {
  onOpenWorkspace: (caseId: number, evidenceId?: number) => void;
  onRefreshCases?: () => void;
}

export const EvidenceLibraryPage: React.FC<EvidenceLibraryPageProps> = ({
  onOpenWorkspace,
  onRefreshCases,
}) => {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Expanded case details
  const [expandedCaseId, setExpandedCaseId] = useState<number | null>(null);
  const [caseDetails, setCaseDetails] = useState<Record<number, CaseDetail>>({});
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Deletion modal
  const [caseToDelete, setCaseToDelete] = useState<CaseSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const fetchCases = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listCases();
      setCases(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const toggleExpand = async (caseId: number) => {
    if (expandedCaseId === caseId) {
      setExpandedCaseId(null);
      return;
    }

    setExpandedCaseId(caseId);
    if (!caseDetails[caseId]) {
      try {
        setLoadingDetails(true);
        const details = await api.getCase(caseId);
        setCaseDetails((prev) => ({ ...prev, [caseId]: details }));
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingDetails(false);
      }
    }
  };

  const handleDeleteCase = async () => {
    if (!caseToDelete) return;
    try {
      setIsDeleting(true);
      await api.deleteCase(caseToDelete.id);
      setCaseToDelete(null);
      await fetchCases();
      if (onRefreshCases) onRefreshCases();
    } catch (err: any) {
      alert(`Deletion failed: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const filteredCases = cases.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.case_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.examiner_name && c.examiner_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex-1 p-8 overflow-y-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-[#1E293B]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center space-x-2">
            <span>Evidence Repository & Case Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse registered digital investigation cases, inspect custody records, and access verified evidence files.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by Case ID, Title, or Examiner..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#131C2E] border border-[#273549] rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-3 text-slate-400">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono">Loading evidence library...</span>
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-[#0F172A] border border-[#1E293B] space-y-3">
          <FolderOpen className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-300">No matching investigation cases found</h3>
          <p className="text-xs text-slate-500">
            {searchQuery ? 'Adjust your search query.' : 'Initialize a new investigation to ingest evidence.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCases.map((c) => {
            const isExpanded = expandedCaseId === c.id;
            const detail = caseDetails[c.id];

            return (
              <div
                key={c.id}
                className="rounded-xl bg-[#0F172A] border border-[#1E293B] overflow-hidden transition-all shadow-sm"
              >
                {/* Case Summary Row */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0D1424]">
                  <div className="flex items-start sm:items-center space-x-3">
                    <button
                      onClick={() => toggleExpand(c.id)}
                      className="p-1.5 rounded-lg bg-[#162032] hover:bg-[#202E46] text-slate-300 transition-colors"
                      title="Expand evidence files"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono font-bold text-cyan-400">{c.case_id}</span>
                        <h3 className="text-xs font-bold text-slate-100">{c.title}</h3>
                      </div>
                      <div className="flex items-center space-x-3 text-[11px] text-slate-400 mt-1">
                        <span>Examiner: <strong className="text-slate-300">{c.examiner_name || 'Unassigned'}</strong></span>
                        <span>&bull;</span>
                        <span>Opened: {new Date(c.created_at).toLocaleDateString()}</span>
                        {c.evidence_ref && (
                          <>
                            <span>&bull;</span>
                            <span className="font-mono">Ref: {c.evidence_ref}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                        {c.evidence_count} file(s)
                      </span>
                      {c.anomalies_count > 0 && (
                        <span className="px-2 py-0.5 rounded badge-anomaly font-mono text-[11px]">
                          {c.anomalies_count} Anomalies
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => onOpenWorkspace(c.id)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 flex items-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      <span>Workspace</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setCaseToDelete(c)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Delete case records"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded Evidence Sub-table */}
                {isExpanded && (
                  <div className="p-4 bg-[#090D15] border-t border-[#1A263A] space-y-3">
                    {loadingDetails && !detail ? (
                      <div className="py-4 text-center text-xs text-slate-500 font-mono">
                        Querying evidence files...
                      </div>
                    ) : detail && detail.evidence_items.length > 0 ? (
                      <div className="space-y-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                          <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Acquired Evidence Files ({detail.evidence_items.length})</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2.5">
                          {detail.evidence_items.map((ev) => (
                            <div
                              key={ev.id}
                              className="p-3 rounded-lg bg-[#0F172A] border border-[#1E293B] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-center space-x-3">
                                <img
                                  src={ev.preview_url}
                                  alt={ev.original_filename}
                                  className="w-12 h-12 object-cover rounded border border-[#273549] shrink-0"
                                />
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <span className="font-mono font-semibold text-cyan-400 text-xs">
                                      {ev.evidence_id}
                                    </span>
                                    <span className="font-medium text-slate-200">{ev.original_filename}</span>
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                                      {ev.detected_format}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-1">
                                    <span>{ev.width} x {ev.height} px</span>
                                    <span>&bull;</span>
                                    <span>{(ev.file_size_bytes / 1024).toFixed(1)} KB</span>
                                  </div>
                                </div>
                              </div>

                              {/* SHA-256 Hash Display */}
                              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                                <div className="flex items-center space-x-1.5 bg-[#090D15] px-2 py-1 rounded border border-[#1A263A]">
                                  <span className="text-[10px] text-slate-500 font-mono">SHA-256:</span>
                                  <span className="text-[10px] text-cyan-300 font-mono truncate max-w-[170px]">
                                    {ev.sha256_hash}
                                  </span>
                                  <button
                                    onClick={() => copyHash(ev.sha256_hash)}
                                    className="text-slate-400 hover:text-cyan-300 cursor-pointer"
                                    title="Copy full SHA-256 hash"
                                  >
                                    {copiedHash === ev.sha256_hash ? (
                                      <Check className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>

                                <div className="flex items-center space-x-2">
                                  <span className="inline-flex items-center space-x-1 text-[10px] px-2 py-0.5 rounded badge-pass font-medium">
                                    <Shield className="w-2.5 h-2.5" />
                                    <span>VERIFIED</span>
                                  </span>

                                  <button
                                    onClick={() => onOpenWorkspace(c.id, ev.id)}
                                    className="px-2.5 py-1 rounded bg-[#162032] hover:bg-[#202E46] text-cyan-300 text-[11px] font-medium transition-colors cursor-pointer"
                                  >
                                    Analyze
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 py-2">
                        No evidence files attached to this case yet.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {caseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0F172A] border border-[#273549] max-w-md w-full p-6 rounded-xl shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <Trash2 className="w-5 h-5 text-rose-400" />
              <span>Confirm Case Deletion</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete case{' '}
              <strong className="text-rose-400 font-mono">{caseToDelete.case_id}</strong> (
              {caseToDelete.title})?
            </p>
            <p className="text-[11px] text-slate-400 bg-rose-500/10 p-2.5 rounded border border-rose-500/20">
              This will remove all associated evidence records, analytical results, and derived visualization files from the local storage.
            </p>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setCaseToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs rounded-lg bg-[#162032] hover:bg-[#202E46] text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCase}
                disabled={isDeleting}
                className="px-4 py-2 text-xs rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium shadow-md shadow-rose-950 flex items-center space-x-1.5"
              >
                {isDeleting ? <span>Deleting...</span> : <span>Delete Case Permanently</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

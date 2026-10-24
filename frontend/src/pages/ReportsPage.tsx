import React, { useState, useEffect } from 'react';
import { FileText, Download, FolderOpen } from 'lucide-react';
import type { ReportItem } from '../types';
import { api } from '../services/api';

interface ReportsPageProps {
  onOpenWorkspace: (caseId: number, evidenceId: number) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ onOpenWorkspace }) => {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listReports();
      setReports(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  return (
    <div className="flex-1 p-8 overflow-y-auto space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between pb-4 border-b border-[#1E293B]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center space-x-2">
            <span>Forensic Investigation Reports</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Official PDF work products compiled using ReportLab for academic review and investigative case files.
          </p>
        </div>

        <button
          onClick={fetchReports}
          className="px-3 py-1.5 text-xs rounded-lg bg-[#131C2E] hover:bg-[#1B273E] text-slate-300 border border-[#273549] transition-colors"
        >
          Refresh List
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-3 text-slate-400">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono">Loading reports registry...</span>
        </div>
      ) : reports.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-[#0F172A] border border-[#1E293B] space-y-3">
          <FileText className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-300">No PDF reports compiled yet</h3>
          <p className="text-xs text-slate-500">
            Open an evidence file in the Forensic Workspace and click "Compile & Export Forensic Report (PDF)" to generate an official document.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {reports.map((rep) => (
            <div
              key={rep.id}
              className="p-4 rounded-xl bg-[#0F172A] border border-[#1E293B] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs hover:border-[#273549] transition-all"
            >
              <div className="flex items-start sm:items-center space-x-3.5">
                <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-cyan-400 text-xs">{rep.report_id}</span>
                    <h3 className="font-semibold text-slate-200">{rep.title}</h3>
                  </div>
                  <div className="flex items-center space-x-3 text-[11px] text-slate-400 mt-1">
                    <span>Compiled: {new Date(rep.created_at).toLocaleString()}</span>
                    <span>&bull;</span>
                    <span className="font-mono text-slate-500">{rep.file_path}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <button
                  onClick={() => onOpenWorkspace(rep.case_id, rep.evidence_id)}
                  className="px-3 py-1.5 rounded-lg bg-[#131C2E] hover:bg-[#1B273E] text-slate-300 border border-[#273549] flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Workspace</span>
                </button>

                <a
                  href={rep.download_url}
                  download={rep.file_path}
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold flex items-center space-x-1.5 transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

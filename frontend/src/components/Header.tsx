import React from 'react';
import { Shield, ShieldAlert, Cpu, HardDrive } from 'lucide-react';
import type { CaseSummary, EvidenceItem } from '../types';

interface HeaderProps {
  cases: CaseSummary[];
  selectedCaseId: number | null;
  onSelectCase: (caseId: number) => void;
  activeEvidence: EvidenceItem | null;
  backendOnline: boolean;
  onVerifyCurrentIntegrity?: () => void;
  isVerifying?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  cases,
  selectedCaseId,
  onSelectCase,
  activeEvidence,
  backendOnline,
  onVerifyCurrentIntegrity,
  isVerifying = false,
}) => {
  const currentCase = cases.find((c) => c.id === selectedCaseId);

  return (
    <header className="h-14 bg-[#0B0F17] border-b border-[#1E293B] px-6 flex items-center justify-between z-10 shrink-0">
      {/* Case Context Selector */}
      <div className="flex items-center space-x-3">
        <span className="text-xs font-medium text-slate-400">Active Case:</span>
        <select
          value={selectedCaseId || ''}
          onChange={(e) => onSelectCase(Number(e.target.value))}
          className="bg-[#131C2E] border border-[#273549] text-slate-200 text-xs rounded-md px-3 py-1.5 focus:outline-none focus:border-cyan-500 font-medium"
        >
          {cases.length === 0 ? (
            <option value="">No investigations registered</option>
          ) : (
            cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.case_id} — {c.title}
              </option>
            ))
          )}
        </select>

        {currentCase?.examiner_name && (
          <span className="text-[11px] text-slate-500 bg-[#162032] px-2 py-1 rounded border border-[#23334d]">
            Examiner: <strong className="text-slate-300">{currentCase.examiner_name}</strong>
          </span>
        )}
      </div>

      {/* Right details & indicators */}
      <div className="flex items-center space-x-4">
        {/* Active Evidence Badge */}
        {activeEvidence ? (
          <div className="flex items-center space-x-2 bg-[#131C2E] border border-[#273549] px-2.5 py-1 rounded-md text-xs">
            <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-300 font-mono text-[11px] truncate max-w-[130px]">
              {activeEvidence.evidence_id}
            </span>
            {activeEvidence.latest_integrity_status === 'PASS' ? (
              <span className="inline-flex items-center space-x-1 text-[10px] px-1.5 py-0.5 rounded badge-pass font-medium">
                <Shield className="w-2.5 h-2.5" />
                <span>INTEGRITY OK</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 text-[10px] px-1.5 py-0.5 rounded badge-fail font-medium">
                <ShieldAlert className="w-2.5 h-2.5" />
                <span>HASH MISMATCH</span>
              </span>
            )}
            {onVerifyCurrentIntegrity && (
              <button
                onClick={onVerifyCurrentIntegrity}
                disabled={isVerifying}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-medium pl-1 cursor-pointer disabled:opacity-50"
              >
                {isVerifying ? 'Verifying...' : 'Reverify'}
              </button>
            )}
          </div>
        ) : (
          <span className="text-[11px] text-slate-500 italic">No evidence loaded</span>
        )}

        {/* Backend Connectivity Status */}
        <div className="flex items-center space-x-1.5 pl-2 border-l border-[#1E293B]">
          <span
            className={`w-2 h-2 rounded-full ${
              backendOnline ? 'bg-emerald-400 shadow-sm shadow-emerald-500/50' : 'bg-rose-500 animate-pulse'
            }`}
          />
          <span className="text-[11px] font-mono text-slate-400 flex items-center space-x-1">
            <Cpu className="w-3 h-3 text-slate-500" />
            <span>{backendOnline ? 'FastAPI 127.0.0.1:8000' : 'Disconnected'}</span>
          </span>
        </div>
      </div>
    </header>
  );
};

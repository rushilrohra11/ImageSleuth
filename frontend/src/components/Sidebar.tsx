import React from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  Database,
  Microscope,
  FileText,
  BookOpen,
  ShieldCheck,
  Fingerprint
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  activeEvidenceCount?: number;
  anomalyCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  anomalyCount = 0
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'new-investigation', label: 'New Investigation', icon: PlusCircle },
    { id: 'evidence-library', label: 'Evidence Library', icon: Database },
    { id: 'workspace', label: 'Forensic Workspace', icon: Microscope, badge: anomalyCount > 0 ? anomalyCount : undefined },
    { id: 'reports', label: 'Investigation Reports', icon: FileText },
    { id: 'methodology', label: 'Methodology & Viva Guide', icon: BookOpen },
  ];

  return (
    <aside className="w-64 bg-[#0B0F17] border-r border-[#1E293B] flex flex-col h-screen select-none shrink-0">
      {/* Brand & Logo */}
      <div className="p-5 border-b border-[#1E293B] flex items-center space-x-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-sm shadow-cyan-950">
          <Fingerprint className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h1 className="font-bold text-base tracking-wide text-slate-100 flex items-center space-x-1.5">
            <span>ImageSleuth</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800 font-mono">v1.0</span>
          </h1>
          <p className="text-[11px] text-slate-400 tracking-tight">Forensic Evidence Analyzer</p>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase px-3 py-1.5">
          Investigation Tools
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#131C2E]'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* System Status Footer */}
      <div className="p-3.5 border-t border-[#1E293B] bg-[#090D15]">
        <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-medium text-slate-300 text-[11px]">Evidence Protection Active</span>
        </div>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          SHA-256 integrity hashing enforced. Write-protected evidence store.
        </p>
      </div>
    </aside>
  );
};

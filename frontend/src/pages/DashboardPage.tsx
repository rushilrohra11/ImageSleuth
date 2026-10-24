import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  Image as ImageIcon,
  Cpu,
  AlertTriangle,
  PlusCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Microscope,
  CheckCircle2,
  FileText
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from 'recharts';
import type { DashboardStats } from '../types';
import { api } from '../services/api';

interface DashboardPageProps {
  onNavigate: (tab: string, caseId?: number, evidenceId?: number) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getDashboardStats();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3 text-slate-400">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono">Loading investigation telemetry...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-8">
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          <strong>Backend Sync Error:</strong> {error}. Ensure FastAPI server is running on 127.0.0.1:8000.
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Investigations',
      value: stats?.total_cases ?? 0,
      icon: FolderOpen,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/30',
      desc: 'Active digital forensic cases',
    },
    {
      label: 'Evidence Files Acquired',
      value: stats?.total_evidence ?? 0,
      icon: ImageIcon,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      desc: 'Cryptographically hashed originals',
    },
    {
      label: 'Analyses Completed',
      value: stats?.total_analyses ?? 0,
      icon: Cpu,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      desc: 'ELA, Copy-Move & Noise executions',
    },
    {
      label: 'Anomalies Under Review',
      value: stats?.total_anomalies ?? 0,
      icon: AlertTriangle,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      desc: 'Potential manipulation markers flagged',
    },
  ];

  // Chart data from real telemetry
  const chartData = [
    { name: 'Cases', count: stats?.total_cases ?? 0, color: '#06B6D4' },
    { name: 'Evidence', count: stats?.total_evidence ?? 0, color: '#38BDF8' },
    { name: 'Analyses', count: stats?.total_analyses ?? 0, color: '#10B981' },
    { name: 'Anomalies', count: stats?.total_anomalies ?? 0, color: '#F59E0B' },
  ];

  return (
    <div className="flex-1 p-8 space-y-6 overflow-y-auto">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-[#1E293B]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center space-x-2">
            <span>Investigation Station Dashboard</span>
            <span className="text-xs px-2 py-0.5 rounded bg-[#131C2E] text-slate-400 border border-[#273549] font-mono">
              Live SQLite Data
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time status of evidence custody, forensic algorithmic pipelines, and investigation audit trails.
          </p>
        </div>

        <button
          onClick={() => onNavigate('new-investigation')}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs tracking-wide shadow-md shadow-cyan-950 transition-all cursor-pointer"
        >
          <PlusCircle className="w-4 h-4 text-slate-950" />
          <span>New Investigation</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className={`p-5 rounded-xl bg-[#0F172A] border ${card.borderColor} shadow-sm flex flex-col justify-between`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{card.label}</span>
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <div className="mt-4">
                <div className={`text-2xl font-bold font-mono tracking-tight ${card.color}`}>
                  {card.value}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{card.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Analytics Chart & Case Summary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Forensics Workload Chart */}
        <div className="lg:col-span-1 p-5 rounded-xl bg-[#0F172A] border border-[#1E293B] flex flex-col">
          <h2 className="text-sm font-semibold text-slate-200 mb-1">Investigation Distribution</h2>
          <p className="text-[11px] text-slate-400 mb-4">Volume breakdown across database records</p>
          <div className="flex-1 w-full h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B0F17',
                    borderColor: '#273549',
                    borderRadius: '0.375rem',
                    fontSize: '11px',
                  }}
                  itemStyle={{ color: '#E2E8F0' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Cases */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-[#0F172A] border border-[#1E293B] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Recent Cases</h2>
              <p className="text-[11px] text-slate-400">Investigations registered in the local repository</p>
            </div>
            <button
              onClick={() => onNavigate('evidence-library')}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center space-x-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-x-auto">
            {stats?.recent_cases && stats.recent_cases.length > 0 ? (
              <table className="w-full text-left text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-[#1E293B] text-slate-500 uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Case ID</th>
                    <th className="py-2.5 px-3">Title</th>
                    <th className="py-2.5 px-3">Examiner</th>
                    <th className="py-2.5 px-3 text-center">Evidence</th>
                    <th className="py-2.5 px-3 text-center">Anomalies</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A2436]">
                  {stats.recent_cases.map((c) => (
                    <tr key={c.id} className="hover:bg-[#131C2E] transition-colors">
                      <td className="py-3 px-3 font-mono font-medium text-cyan-400">{c.case_id}</td>
                      <td className="py-3 px-3 font-medium text-slate-200">{c.title}</td>
                      <td className="py-3 px-3 text-slate-400">{c.examiner_name || 'Unassigned'}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[11px]">
                          {c.evidence_count}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {c.anomalies_count > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-[11px]">
                            {c.anomalies_count} Flagged
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">None</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => onNavigate('workspace', c.id)}
                          className="px-2.5 py-1 rounded bg-[#1A263B] hover:bg-[#253654] text-cyan-300 text-[11px] font-medium transition-colors"
                        >
                          Open Workspace
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center text-slate-500 space-y-2">
                <FolderOpen className="w-8 h-8 text-slate-600" />
                <p className="text-xs">No investigation cases recorded in database yet.</p>
                <button
                  onClick={() => onNavigate('new-investigation')}
                  className="text-xs text-cyan-400 underline"
                >
                  Create your first investigation case
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="p-5 rounded-xl bg-[#0F172A] border border-[#1E293B]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-200">Investigation Activity & Audit Log</h2>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">Immutable audit timeline</span>
        </div>

        {stats?.recent_activity && stats.recent_activity.length > 0 ? (
          <div className="space-y-3">
            {stats.recent_activity.map((log) => {
              const isAcq = log.action_type.includes('ACQUISITION');
              const isVerif = log.action_type.includes('VERIFY');
              const isAnl = log.action_type.includes('ANALYSIS');
              const isRep = log.action_type.includes('REPORT');

              return (
                <div
                  key={log.id}
                  className="flex items-start space-x-3 p-3 rounded-lg bg-[#0A0E17] border border-[#1A2436] text-xs"
                >
                  <div className="mt-0.5">
                    {isAcq && <ImageIcon className="w-4 h-4 text-blue-400" />}
                    {isVerif && <ShieldCheck className="w-4 h-4 text-emerald-400" />}
                    {isAnl && <Microscope className="w-4 h-4 text-cyan-400" />}
                    {isRep && <FileText className="w-4 h-4 text-purple-400" />}
                    {!isAcq && !isVerif && !isAnl && !isRep && <CheckCircle2 className="w-4 h-4 text-slate-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 font-medium">{log.description}</p>
                    <div className="flex items-center space-x-2 mt-1 text-[10px] text-slate-500">
                      <span className="font-mono">{log.action_type}</span>
                      <span>&bull;</span>
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-center text-slate-500 text-xs">
            No audit activities logged yet. Acquire evidence to initiate timeline.
          </div>
        )}
      </div>
    </div>
  );
};

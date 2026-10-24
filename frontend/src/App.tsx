import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardPage } from './pages/DashboardPage';
import { NewInvestigationPage } from './pages/NewInvestigationPage';
import { EvidenceLibraryPage } from './pages/EvidenceLibraryPage';
import { ForensicWorkspacePage } from './pages/ForensicWorkspacePage';
import { ReportsPage } from './pages/ReportsPage';
import { AboutMethodologyPage } from './pages/AboutMethodologyPage';
import type { CaseSummary, EvidenceItem } from './types';
import { api } from './services/api';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [activeEvidence, setActiveEvidence] = useState<EvidenceItem | null>(null);
  const [activeEvidenceId, setActiveEvidenceId] = useState<number | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [isVerifyingHeader, setIsVerifyingHeader] = useState<boolean>(false);

  // Poll / Check Backend Health
  const checkHealth = async () => {
    try {
      await api.getHealth();
      setBackendOnline(true);
    } catch (_) {
      setBackendOnline(false);
    }
  };

  const fetchCases = async () => {
    try {
      const data = await api.listCases();
      setCases(data);
      if (data.length > 0 && !selectedCaseId) {
        setSelectedCaseId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    checkHealth();
    fetchCases();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  // When selectedCaseId changes, load first evidence if none selected
  useEffect(() => {
    if (selectedCaseId) {
      api.getCase(selectedCaseId).then((caseDetail) => {
        if (caseDetail.evidence_items.length > 0) {
          // If current active evidence doesn't belong to this case, switch to first
          if (!activeEvidence || activeEvidence.case_id !== selectedCaseId) {
            setActiveEvidence(caseDetail.evidence_items[0]);
            setActiveEvidenceId(caseDetail.evidence_items[0].id);
          }
        } else {
          setActiveEvidence(null);
          setActiveEvidenceId(null);
        }
      }).catch(console.error);
    }
  }, [selectedCaseId]);

  // When activeEvidenceId changes specifically, reload its details
  useEffect(() => {
    if (activeEvidenceId) {
      api.getEvidence(activeEvidenceId).then((ev) => {
        setActiveEvidence(ev);
      }).catch(console.error);
    }
  }, [activeEvidenceId]);

  const handleSelectCase = (id: number) => {
    setSelectedCaseId(id);
  };

  const handleNavigate = (tab: string, caseId?: number, evidenceId?: number) => {
    if (caseId) setSelectedCaseId(caseId);
    if (evidenceId) setActiveEvidenceId(evidenceId);
    setCurrentTab(tab);
  };

  const handleInvestigationCreated = (caseId: number, evidenceId: number) => {
    fetchCases();
    setSelectedCaseId(caseId);
    setActiveEvidenceId(evidenceId);
    setCurrentTab('workspace');
  };

  const handleHeaderReverify = async () => {
    if (!activeEvidence) return;
    try {
      setIsVerifyingHeader(true);
      const res = await api.verifyIntegrity(activeEvidence.id);
      setActiveEvidence((prev) => prev ? { ...prev, latest_integrity_status: res.status } : null);
    } catch (err: any) {
      alert(`Integrity verification failed: ${err.message}`);
    } finally {
      setIsVerifyingHeader(false);
    }
  };

  const totalAnomalies = cases.reduce((acc, c) => acc + (c.anomalies_count || 0), 0);

  return (
    <div className="flex h-screen bg-[#090D16] text-slate-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        anomalyCount={totalAnomalies}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <Header
          cases={cases}
          selectedCaseId={selectedCaseId}
          onSelectCase={handleSelectCase}
          activeEvidence={activeEvidence}
          backendOnline={backendOnline}
          onVerifyCurrentIntegrity={handleHeaderReverify}
          isVerifying={isVerifyingHeader}
        />

        {/* Dynamic Pages */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {currentTab === 'dashboard' && (
            <DashboardPage onNavigate={handleNavigate} />
          )}

          {currentTab === 'new-investigation' && (
            <NewInvestigationPage onInvestigationCreated={handleInvestigationCreated} />
          )}

          {currentTab === 'evidence-library' && (
            <EvidenceLibraryPage
              onOpenWorkspace={(caseId, evidenceId) => handleNavigate('workspace', caseId, evidenceId)}
              onRefreshCases={fetchCases}
            />
          )}

          {currentTab === 'workspace' && (
            <ForensicWorkspacePage
              caseId={selectedCaseId}
              evidenceId={activeEvidenceId}
              onSelectEvidence={(evId) => setActiveEvidenceId(evId)}
              onRefreshTelemetry={fetchCases}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsPage
              onOpenWorkspace={(caseId, evidenceId) => handleNavigate('workspace', caseId, evidenceId)}
            />
          )}

          {currentTab === 'methodology' && (
            <AboutMethodologyPage />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;

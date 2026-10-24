import type {
  CaseSummary, CaseDetail, EvidenceItem, IntegrityVerification,
  MetadataRecord, AnalysisRecord, Finding, ReportItem, DashboardStats
} from '../types';

const BASE_URL = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Accept': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    let errorDetail = `Request failed: ${res.statusText}`;
    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorDetail;
    } catch (_) {}
    throw new Error(errorDetail);
  }

  return res.json() as Promise<T>;
}

export const api = {
  // System Health
  getHealth: () => request<{ status: string; service: string; version: string }>('/health'),

  // Dashboard
  getDashboardStats: () => request<DashboardStats>('/dashboard/stats'),

  // Cases
  listCases: () => request<CaseSummary[]>('/cases'),
  getCase: (id: number) => request<CaseDetail>(`/cases/${id}`),
  createCase: (data: {
    title: string;
    description?: string;
    examiner_name?: string;
    evidence_ref?: string;
    acquisition_notes?: string;
  }) => request<CaseSummary>('/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
  deleteCase: (id: number) => request<{ message: string }>(`/cases/${id}?confirm=true`, {
    method: 'DELETE',
  }),

  // Evidence
  uploadEvidence: async (caseId: number, file: File, acquisitionNotes?: string): Promise<EvidenceItem> => {
    const formData = new FormData();
    formData.append('file', file);
    if (acquisitionNotes) {
      formData.append('acquisition_notes', acquisitionNotes);
    }
    const res = await fetch(`${BASE_URL}/cases/${caseId}/evidence`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Evidence upload failed');
    }
    return res.json();
  },
  getEvidence: (id: number) => request<EvidenceItem>(`/evidence/${id}`),

  // Integrity
  verifyIntegrity: (evidenceId: number) =>
    request<IntegrityVerification>(`/evidence/${evidenceId}/verify-integrity`, {
      method: 'POST',
    }),
  getIntegrityHistory: (evidenceId: number) =>
    request<IntegrityVerification[]>(`/evidence/${evidenceId}/integrity-history`),

  // Metadata
  getMetadata: (evidenceId: number) =>
    request<MetadataRecord>(`/evidence/${evidenceId}/metadata`),
  reexamineMetadata: (evidenceId: number) =>
    request<MetadataRecord>(`/evidence/${evidenceId}/metadata/reexamine`, {
      method: 'POST',
    }),

  // Analyses
  runEla: (evidenceId: number, params: { quality: number; amplification: number }) =>
    request<AnalysisRecord>(`/evidence/${evidenceId}/analyze/ela`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }),
  runCopyMove: (evidenceId: number, params: {
    method: string;
    max_keypoints: number;
    ratio: number;
    min_distance: number;
  }) =>
    request<AnalysisRecord>(`/evidence/${evidenceId}/analyze/copy-move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }),
  runNoise: (evidenceId: number, params: { window_size: number; method?: string }) =>
    request<AnalysisRecord>(`/evidence/${evidenceId}/analyze/noise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }),
  listAnalyses: (evidenceId: number) =>
    request<AnalysisRecord[]>(`/evidence/${evidenceId}/analyses`),

  // Findings
  listFindings: (evidenceId: number) =>
    request<Finding[]>(`/evidence/${evidenceId}/findings`),
  createFinding: (evidenceId: number, data: {
    category: string;
    description: string;
    supporting_data?: string;
    severity: string;
    examiner_notes?: string;
    review_status: string;
  }) =>
    request<Finding>(`/evidence/${evidenceId}/findings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateFinding: (findingId: number, data: Partial<Finding>) =>
    request<Finding>(`/findings/${findingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  // Reports
  generateReport: (caseId: number, evidenceId: number) =>
    request<ReportItem>(`/cases/${caseId}/evidence/${evidenceId}/reports`, {
      method: 'POST',
    }),
  listReports: () => request<ReportItem[]>('/reports'),
};

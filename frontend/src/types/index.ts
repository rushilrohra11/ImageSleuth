export interface ActivityLog {
  id: number;
  case_id?: number | null;
  evidence_id?: number | null;
  action_type: string;
  description: string;
  timestamp: string;
}

export interface CaseSummary {
  id: number;
  case_id: string;
  title: string;
  description?: string;
  examiner_name?: string;
  evidence_ref?: string;
  acquisition_notes?: string;
  created_at: string;
  updated_at: string;
  evidence_count: number;
  analysis_count: number;
  anomalies_count: number;
}

export interface CaseDetail extends CaseSummary {
  evidence_items: EvidenceItem[];
  activity_logs: ActivityLog[];
}

export interface EvidenceItem {
  id: number;
  evidence_id: string;
  case_id: number;
  case_title?: string;
  case_number?: string;
  original_filename: string;
  stored_filename: string;
  file_size_bytes: number;
  detected_format: string;
  mime_type: string;
  width: number;
  height: number;
  sha256_hash: string;
  acquisition_notes?: string;
  created_at: string;
  latest_integrity_status: 'PASS' | 'FAIL' | 'PENDING';
  preview_url: string;
  analyses_count?: number;
  findings_count?: number;
}

export interface IntegrityVerification {
  id: number;
  evidence_id: number;
  recorded_hash: string;
  calculated_hash: string;
  status: 'PASS' | 'FAIL';
  verified_at: string;
  verification_notes?: string;
  is_match: boolean;
}

export interface MetadataRecord {
  id: number;
  evidence_id: number;
  tool_used: string;
  raw_metadata: Record<string, string | number | boolean | object>;
  extracted_summary: Record<string, string>;
  potential_anomalies: {
    type: string;
    field: string;
    description: string;
    severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH';
  }[];
  extracted_at: string;
}

export interface AnalysisRecord {
  id: number;
  analysis_id: string;
  evidence_id: number;
  analysis_type: 'ELA' | 'COPY_MOVE' | 'NOISE';
  status: 'COMPLETED' | 'FAILED';
  parameters: Record<string, any>;
  metrics: Record<string, any>;
  output_image_url?: string;
  duration_ms?: number;
  interpretation_notes?: string;
  created_at: string;
}

export interface Finding {
  id: number;
  finding_id: string;
  evidence_id: number;
  analysis_id?: number | null;
  category: 'INFORMATIONAL' | 'OBSERVATION' | 'POTENTIAL_ANOMALY' | 'INTEGRITY_FAILURE' | 'ANALYSIS_LIMITATION';
  description: string;
  supporting_data?: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH';
  examiner_notes?: string;
  review_status: 'UNREVIEWED' | 'CONFIRMED' | 'DISMISSED';
  created_at: string;
}

export interface ReportItem {
  id: number;
  report_id: string;
  case_id: number;
  evidence_id: number;
  title: string;
  file_path: string;
  created_at: string;
  download_url: string;
}

export interface DashboardStats {
  total_cases: number;
  total_evidence: number;
  total_analyses: number;
  total_anomalies: number;
  recent_cases: CaseSummary[];
  recent_activity: ActivityLog[];
}

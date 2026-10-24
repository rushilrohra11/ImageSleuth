from pydantic import BaseModel, ConfigDict
from typing import Optional, Any
from datetime import datetime

# Common schemas
class ActivityLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    case_id: Optional[int] = None
    evidence_id: Optional[int] = None
    action_type: str
    description: str
    timestamp: datetime

# Case Schemas
class CaseBase(BaseModel):
    title: str
    description: Optional[str] = None
    examiner_name: Optional[str] = None
    evidence_ref: Optional[str] = None
    acquisition_notes: Optional[str] = None

class CaseCreate(CaseBase):
    pass

class CaseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    examiner_name: Optional[str] = None
    evidence_ref: Optional[str] = None
    acquisition_notes: Optional[str] = None

class CaseSummary(CaseBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    case_id: str
    created_at: datetime
    updated_at: datetime
    evidence_count: int = 0
    analysis_count: int = 0
    anomalies_count: int = 0

class CaseDetail(CaseSummary):
    evidence_items: list[Any] = []
    activity_logs: list[ActivityLogResponse] = []

# Evidence Schemas
class EvidenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    evidence_id: str
    case_id: int
    original_filename: str
    stored_filename: str
    file_size_bytes: int
    detected_format: str
    mime_type: str
    width: int
    height: int
    sha256_hash: str
    acquisition_notes: Optional[str] = None
    created_at: datetime
    latest_integrity_status: Optional[str] = "PASS"

# Integrity Verification Schemas
class IntegrityVerificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    evidence_id: int
    recorded_hash: str
    calculated_hash: str
    status: str
    verified_at: datetime
    verification_notes: Optional[str] = None
    is_match: bool

# Metadata Schemas
class MetadataRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    evidence_id: int
    tool_used: str
    raw_metadata: dict[str, Any]
    extracted_summary: dict[str, Any]
    potential_anomalies: list[dict[str, Any]]
    extracted_at: datetime

# Analysis Schemas
class ElaRequest(BaseModel):
    quality: int = 90
    amplification: int = 15

class CopyMoveRequest(BaseModel):
    method: str = "SIFT"  # SIFT or ORB
    max_keypoints: int = 2500
    ratio: float = 0.75
    min_distance: int = 35

class NoiseRequest(BaseModel):
    window_size: int = 9  # 7, 9, 11, 15
    method: str = "residual_variance"

class AnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    analysis_id: str
    evidence_id: int
    analysis_type: str
    status: str
    parameters: dict[str, Any]
    metrics: dict[str, Any]
    output_image_url: Optional[str] = None
    duration_ms: Optional[float] = None
    interpretation_notes: Optional[str] = None
    created_at: datetime

# Finding Schemas
class FindingCreate(BaseModel):
    category: str  # INFORMATIONAL, OBSERVATION, POTENTIAL_ANOMALY, INTEGRITY_FAILURE, ANALYSIS_LIMITATION
    description: str
    supporting_data: Optional[str] = None
    severity: str = "INFO"  # INFO, LOW, MEDIUM, HIGH
    examiner_notes: Optional[str] = None
    review_status: str = "UNREVIEWED"  # UNREVIEWED, CONFIRMED, DISMISSED

class FindingUpdate(BaseModel):
    category: Optional[str] = None
    description: Optional[str] = None
    supporting_data: Optional[str] = None
    severity: Optional[str] = None
    examiner_notes: Optional[str] = None
    review_status: Optional[str] = None

class FindingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    finding_id: str
    evidence_id: int
    analysis_id: Optional[int] = None
    category: str
    description: str
    supporting_data: Optional[str] = None
    severity: str
    examiner_notes: Optional[str] = None
    review_status: str
    created_at: datetime

# Report Schemas
class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    report_id: str
    case_id: int
    evidence_id: int
    title: str
    file_path: str
    created_at: datetime
    download_url: str

# Dashboard Statistics
class DashboardStats(BaseModel):
    total_cases: int
    total_evidence: int
    total_analyses: int
    total_anomalies: int
    recent_cases: list[CaseSummary]
    recent_activity: list[ActivityLogResponse]

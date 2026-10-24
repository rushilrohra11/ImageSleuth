import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Float
)
from sqlalchemy.orm import relationship
from app.database.session import Base

def utcnow():
    return datetime.datetime.now(datetime.timezone.utc)

class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    examiner_name = Column(String(100), nullable=True)
    evidence_ref = Column(String(100), nullable=True)
    acquisition_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    # Relationships
    evidence_items = relationship("Evidence", back_populates="case", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="case", cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="case", cascade="all, delete-orphan")

class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True, index=True)
    evidence_id = Column(String(50), unique=True, index=True, nullable=False)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    detected_format = Column(String(20), nullable=False)
    mime_type = Column(String(50), nullable=False)
    width = Column(Integer, nullable=False)
    height = Column(Integer, nullable=False)
    sha256_hash = Column(String(64), nullable=False)
    acquisition_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    # Relationships
    case = relationship("Case", back_populates="evidence_items")
    integrity_verifications = relationship("IntegrityVerification", back_populates="evidence", cascade="all, delete-orphan", order_by="desc(IntegrityVerification.verified_at)")
    metadata_record = relationship("MetadataRecord", back_populates="evidence", uselist=False, cascade="all, delete-orphan")
    analyses = relationship("Analysis", back_populates="evidence", cascade="all, delete-orphan", order_by="desc(Analysis.created_at)")
    findings = relationship("Finding", back_populates="evidence", cascade="all, delete-orphan", order_by="desc(Finding.created_at)")
    reports = relationship("Report", back_populates="evidence", cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="evidence", cascade="all, delete-orphan")

class IntegrityVerification(Base):
    __tablename__ = "integrity_verifications"

    id = Column(Integer, primary_key=True, index=True)
    evidence_id = Column(Integer, ForeignKey("evidence.id", ondelete="CASCADE"), nullable=False)
    recorded_hash = Column(String(64), nullable=False)
    calculated_hash = Column(String(64), nullable=False)
    status = Column(String(20), nullable=False)  # PASS or FAIL
    verified_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    verification_notes = Column(Text, nullable=True)

    evidence = relationship("Evidence", back_populates="integrity_verifications")

class MetadataRecord(Base):
    __tablename__ = "metadata_records"

    id = Column(Integer, primary_key=True, index=True)
    evidence_id = Column(Integer, ForeignKey("evidence.id", ondelete="CASCADE"), unique=True, nullable=False)
    tool_used = Column(String(50), nullable=False)  # exiftool or pillow_fallback
    raw_metadata = Column(Text, nullable=False)  # JSON string
    extracted_summary = Column(Text, nullable=False)  # JSON string
    potential_anomalies = Column(Text, nullable=False)  # JSON string
    extracted_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    evidence = relationship("Evidence", back_populates="metadata_record")

class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(String(50), unique=True, index=True, nullable=False)
    evidence_id = Column(Integer, ForeignKey("evidence.id", ondelete="CASCADE"), nullable=False)
    analysis_type = Column(String(50), nullable=False)  # ELA, COPY_MOVE, NOISE
    status = Column(String(20), nullable=False)  # COMPLETED, FAILED
    parameters = Column(Text, nullable=True)  # JSON string
    metrics = Column(Text, nullable=True)  # JSON string
    output_image_path = Column(String(255), nullable=True)
    duration_ms = Column(Float, nullable=True)
    interpretation_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    evidence = relationship("Evidence", back_populates="analyses")
    findings = relationship("Finding", back_populates="analysis")

class Finding(Base):
    __tablename__ = "findings"

    id = Column(Integer, primary_key=True, index=True)
    finding_id = Column(String(50), unique=True, index=True, nullable=False)
    evidence_id = Column(Integer, ForeignKey("evidence.id", ondelete="CASCADE"), nullable=False)
    analysis_id = Column(Integer, ForeignKey("analyses.id", ondelete="SET NULL"), nullable=True)
    category = Column(String(50), nullable=False)  # INFORMATIONAL, OBSERVATION, POTENTIAL_ANOMALY, INTEGRITY_FAILURE, ANALYSIS_LIMITATION
    description = Column(Text, nullable=False)
    supporting_data = Column(Text, nullable=True)
    severity = Column(String(20), default="INFO", nullable=False)  # INFO, LOW, MEDIUM, HIGH
    examiner_notes = Column(Text, nullable=True)
    review_status = Column(String(30), default="UNREVIEWED", nullable=False)  # UNREVIEWED, CONFIRMED, DISMISSED
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    evidence = relationship("Evidence", back_populates="findings")
    analysis = relationship("Analysis", back_populates="findings")

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(String(50), unique=True, index=True, nullable=False)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    evidence_id = Column(Integer, ForeignKey("evidence.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    file_path = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    case = relationship("Case", back_populates="reports")
    evidence = relationship("Evidence", back_populates="reports")

class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=True)
    evidence_id = Column(Integer, ForeignKey("evidence.id", ondelete="CASCADE"), nullable=True)
    action_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    case = relationship("Case", back_populates="activity_logs")
    evidence = relationship("Evidence", back_populates="activity_logs")

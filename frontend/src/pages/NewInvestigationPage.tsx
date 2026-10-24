import React, { useState } from 'react';
import {
  Upload,
  FileCheck,
  ShieldAlert,
  Copy,
  Check,
  HardDrive,
  Info
} from 'lucide-react';
import { api } from '../services/api';

interface NewInvestigationPageProps {
  onInvestigationCreated: (caseId: number, evidenceId: number) => void;
}

export const NewInvestigationPage: React.FC<NewInvestigationPageProps> = ({
  onInvestigationCreated,
}) => {
  // Case metadata form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [examinerName, setExaminerName] = useState('');
  const [evidenceRef, setEvidenceRef] = useState('');
  const [acquisitionNotes, setAcquisitionNotes] = useState('');

  // Evidence file
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileDetails, setFileDetails] = useState<{
    size: string;
    type: string;
  } | null>(null);

  // Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{
    caseId: string;
    evidenceId: string;
    sha256: string;
    internalCaseId: number;
    internalEvidenceId: number;
  } | null>(null);

  const handleFileChange = (file: File) => {
    setErrorMsg(null);
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setErrorMsg(`Unsupported file type: ${file.type}. Allowed formats: JPEG, PNG, WEBP`);
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setErrorMsg(`File size exceeds 20 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB)`);
      return;
    }

    setSelectedFile(file);
    setFileDetails({
      size: `${(file.size / 1024).toFixed(1)} KB`,
      type: file.type,
    });

    const reader = new FileReader();
    reader.onload = (e) => setFilePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Case title is required.');
      return;
    }
    if (!selectedFile) {
      setErrorMsg('Please select or drop an image evidence file to acquire.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      // 1. Create Case
      const caseRes = await api.createCase({
        title,
        description,
        examiner_name: examinerName,
        evidence_ref: evidenceRef,
        acquisition_notes: acquisitionNotes,
      });

      // 2. Upload and Acquire Evidence
      const evRes = await api.uploadEvidence(caseRes.id, selectedFile, acquisitionNotes);

      setSuccessInfo({
        caseId: caseRes.case_id,
        evidenceId: evRes.evidence_id,
        sha256: evRes.sha256_hash,
        internalCaseId: caseRes.id,
        internalEvidenceId: evRes.id,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Evidence acquisition failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-[#1E293B]">
        <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center space-x-2">
          <span>New Investigation & Evidence Acquisition</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Open a new forensic investigation case and securely ingest digital image evidence into immutable storage with cryptographic SHA-256 integrity verification.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Success Modal / Banner */}
      {successInfo ? (
        <div className="p-6 rounded-xl bg-[#0F172A] border border-emerald-500/30 space-y-4">
          <div className="flex items-center space-x-3 text-emerald-400">
            <FileCheck className="w-6 h-6" />
            <div>
              <h2 className="text-sm font-bold">Evidence Successfully Acquired & Verified</h2>
              <p className="text-xs text-slate-400">
                Case {successInfo.caseId} initialized & evidence {successInfo.evidenceId} stored immutably.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[#0A0D14] border border-[#1E293B] space-y-2">
            <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
              <span>Cryptographic Acquisition SHA-256 Hash:</span>
              <button
                onClick={() => copyToClipboard(successInfo.sha256)}
                className="flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 text-[11px] font-mono cursor-pointer"
              >
                {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedHash ? 'Copied!' : 'Copy Hash'}</span>
              </button>
            </div>
            <div className="p-2.5 rounded bg-[#07090E] border border-cyan-900/40 text-cyan-300 font-mono text-xs break-all select-all">
              {successInfo.sha256}
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              onClick={() => {
                setSuccessInfo(null);
                setSelectedFile(null);
                setFilePreview(null);
                setTitle('');
              }}
              className="px-4 py-2 text-xs rounded-lg bg-[#162032] hover:bg-[#202E46] text-slate-300 transition-colors"
            >
              Acquire Another File
            </button>
            <button
              onClick={() =>
                onInvestigationCreated(successInfo.internalCaseId, successInfo.internalEvidenceId)
              }
              className="px-5 py-2 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 transition-colors shadow-md shadow-cyan-950"
            >
              Launch Forensic Workspace &rarr;
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Case Details Card */}
            <div className="p-5 rounded-xl bg-[#0F172A] border border-[#1E293B] space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
                <HardDrive className="w-4 h-4 text-cyan-400" />
                <span>Case Information</span>
              </h2>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Case Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tampered Contract Certificate Analysis"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#131C2E] border border-[#273549] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Examiner Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Inv. R. Sharma"
                    value={examinerName}
                    onChange={(e) => setExaminerName(e.target.value)}
                    className="w-full bg-[#131C2E] border border-[#273549] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Evidence Ref Number</label>
                  <input
                    type="text"
                    placeholder="e.g. ITEM-001-A"
                    value={evidenceRef}
                    onChange={(e) => setEvidenceRef(e.target.value)}
                    className="w-full bg-[#131C2E] border border-[#273549] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Case Description</label>
                <textarea
                  rows={2}
                  placeholder="Summary of the allegation or context..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#131C2E] border border-[#273549] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Chain of Custody / Acquisition Notes</label>
                <textarea
                  rows={2}
                  placeholder="Source device, storage medium, transfer protocol..."
                  value={acquisitionNotes}
                  onChange={(e) => setAcquisitionNotes(e.target.value)}
                  className="w-full bg-[#131C2E] border border-[#273549] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Evidence Ingestion Card */}
            <div className="p-5 rounded-xl bg-[#0F172A] border border-[#1E293B] flex flex-col justify-between space-y-4">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2 mb-3">
                  <Upload className="w-4 h-4 text-cyan-400" />
                  <span>Image Evidence Acquisition</span>
                </h2>

                {/* Drag & Drop Zone */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    filePreview
                      ? 'border-cyan-500/50 bg-[#131C2E]/60'
                      : 'border-[#273549] hover:border-cyan-500/40 bg-[#0A0D15]'
                  }`}
                  onClick={() => document.getElementById('evidence-file-input')?.click()}
                >
                  <input
                    id="evidence-file-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                  />

                  {filePreview ? (
                    <div className="space-y-3">
                      <img
                        src={filePreview}
                        alt="Preview"
                        className="max-h-40 mx-auto rounded border border-[#273549] object-contain"
                      />
                      <div className="text-xs text-slate-300 font-mono">
                        {selectedFile?.name} ({fileDetails?.size})
                      </div>
                      <span className="text-[11px] text-cyan-400 underline">Click to choose different image</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div className="text-xs font-medium text-slate-200">
                        Drag and drop evidence image here, or browse
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Supports JPEG, PNG, WEBP (Max 20 MB). Safely decoded on ingestion.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Forensic Notice */}
              <div className="p-3 rounded-lg bg-[#0C121D] border border-[#1A263A] flex items-start space-x-2 text-[11px] text-slate-400">
                <Info className="w-4 h-4 shrink-0 text-cyan-400 mt-0.5" />
                <span>
                  The original file will be stored in read-only isolation and hashed immediately. All future analytical processing is executed solely on derived working copies.
                </span>
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-end space-x-4 pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !selectedFile}
              className="px-6 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs tracking-wide shadow-md shadow-cyan-950 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Acquiring & Hashing Evidence...</span>
                </>
              ) : (
                <span>Acquire Evidence & Initialize Case</span>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

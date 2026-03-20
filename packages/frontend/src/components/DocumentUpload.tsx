import { useState, useCallback, useRef, useEffect } from 'react';
import { documentsApi } from '../api/client';
import type { Document } from '../api/types';

export function DocumentUpload() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const docs = await documentsApi.list();
      setDocuments(docs);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const resume = documents.find((d) => d.type === 'resume');
  const linkedin = documents.find((d) => d.type === 'linkedin');

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-[22px] font-bold text-text-primary tracking-tight mb-1">Documents</h2>
      <p className="text-xs text-text-muted mb-6">
        Upload your resume and LinkedIn PDF to auto-extract skills, titles, and certifications.
      </p>

      {error && (
        <div className="mb-4 px-4 py-2.5 rounded-lg text-xs font-medium bg-accent-red/10 text-accent-red-light border border-accent-red/20">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <UploadZone
          label="Resume PDF"
          type="resume"
          doc={resume ?? null}
          uploading={uploading === 'resume'}
          onUpload={async (file) => {
            setUploading('resume');
            setError(null);
            try {
              await documentsApi.upload(file, 'resume');
              await fetchDocs();
            } catch {
              setError('Failed to upload resume.');
            } finally {
              setUploading(null);
            }
          }}
          onRemove={async (id) => {
            try {
              await documentsApi.remove(id);
              await fetchDocs();
            } catch {
              setError('Failed to remove document.');
            }
          }}
        />
        <UploadZone
          label="LinkedIn PDF"
          type="linkedin"
          doc={linkedin ?? null}
          uploading={uploading === 'linkedin'}
          onUpload={async (file) => {
            setUploading('linkedin');
            setError(null);
            try {
              await documentsApi.upload(file, 'linkedin');
              await fetchDocs();
            } catch {
              setError('Failed to upload LinkedIn PDF.');
            } finally {
              setUploading(null);
            }
          }}
          onRemove={async (id) => {
            try {
              await documentsApi.remove(id);
              await fetchDocs();
            } catch {
              setError('Failed to remove document.');
            }
          }}
        />
      </div>
    </div>
  );
}

/* ── Upload Zone ── */

interface UploadZoneProps {
  label: string;
  type: 'resume' | 'linkedin';
  doc: Document | null;
  uploading: boolean;
  onUpload: (file: File) => void;
  onRemove: (id: number) => void;
}

function UploadZone({ label, doc, uploading, onUpload, onRemove }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file?.type === 'application/pdf') onUpload(file);
    },
    [onUpload],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onUpload(file);
      e.target.value = '';
    },
    [onUpload],
  );

  return (
    <div className="bg-gradient-to-br from-bg-tertiary/70 to-bg-tertiary/30 border border-border-subtle rounded-xl p-5">
      <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim mb-3">{label}</div>

      {/* Drop area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-8 cursor-pointer transition-all
          ${dragOver
            ? 'border-accent-indigo/60 bg-accent-indigo/[0.06]'
            : 'border-border-subtle hover:border-accent-indigo/30 hover:bg-accent-indigo/[0.03]'
          }
          ${uploading ? 'opacity-60 pointer-events-none' : ''}
        `}
      >
        <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={handleChange} />
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-dim mb-2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {uploading ? (
          <span className="text-xs text-accent-indigo-light font-semibold">Uploading...</span>
        ) : (
          <>
            <span className="text-xs text-text-muted">
              {doc ? 'Drop to replace' : 'Drop PDF here or click'}
            </span>
          </>
        )}
      </div>

      {/* Uploaded document info */}
      {doc && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-secondary font-medium truncate max-w-[180px]">{doc.filename}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(doc.id);
              }}
              className="text-[10px] text-accent-red-light hover:text-accent-red font-medium"
            >
              Remove
            </button>
          </div>
          <div className="text-[10px] text-text-dim mb-2">
            Uploaded {doc.uploadedAt ? new Date(doc.uploadedAt.replace(' ', 'T') + 'Z').toLocaleDateString() : 'recently'}
          </div>
          <TagGroup label="Skills" tags={parseJsonArray(doc.parsedSkills)} color="indigo" />
          <TagGroup label="Titles" tags={parseJsonArray(doc.parsedTitles)} color="cyan" />
          <TagGroup label="Certs" tags={parseJsonArray(doc.parsedCerts)} color="amber" />
          <TagGroup label="Tools" tags={parseJsonArray(doc.parsedTools)} color="green" />
        </div>
      )}
    </div>
  );
}

/* ── Tag Group ── */

const TAG_COLORS: Record<string, string> = {
  indigo: 'bg-accent-indigo/10 text-accent-indigo-light border-accent-indigo/20',
  cyan: 'bg-accent-cyan/10 text-accent-cyan-light border-accent-cyan/20',
  amber: 'bg-accent-amber/10 text-accent-amber-light border-accent-amber/20',
  green: 'bg-accent-green/10 text-accent-green-light border-accent-green/20',
};

function parseJsonArray(val: string | null): string[] | null {
  if (!val) return null;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function TagGroup({ label, tags, color }: { label: string; tags: string[] | null; color: string }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="mb-2 last:mb-0">
      <div className="text-[9px] font-semibold uppercase tracking-widest text-text-dim mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {tags.map((t) => (
          <span key={t} className={`px-2 py-0.5 rounded text-[10px] font-medium border ${TAG_COLORS[color]}`}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

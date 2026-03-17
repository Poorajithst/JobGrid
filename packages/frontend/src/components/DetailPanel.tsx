import { useState, useEffect, useCallback } from 'react';
import type { JobWithOutreach } from '../api/types';
import { Pipeline } from './Pipeline';
import { ScoreBreakdown } from './ScoreBreakdown';
import { outreachApi, scoreApi } from '../api/client';

interface DetailPanelProps {
  job: JobWithOutreach;
  onStatusChange: (status: string) => void;
  onNotesChange: (notes: string) => void;
  activeProfileId?: number | null;
  onRefresh?: () => void;
}

export function DetailPanel({ job, onStatusChange, onNotesChange, activeProfileId, onRefresh }: DetailPanelProps) {
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [outreachLoading, setOutreachLoading] = useState<string | null>(null);
  const [outreachContent, setOutreachContent] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState(job.notes || '');
  const [aiValidating, setAiValidating] = useState(false);

  // Sync notes state when job changes
  useEffect(() => {
    setNotesText(job.notes || '');
    setEditingNotes(false);
    setOutreachContent(null);
    setShowFullDesc(false);
  }, [job.id]);

  const handleOutreach = async (type: 'connection' | 'email' | 'inmail') => {
    setOutreachLoading(type);
    try {
      const result = await outreachApi.generate(job.id, type);
      setOutreachContent(result.content);
    } catch (err) {
      console.error('Outreach failed:', err);
    } finally {
      setOutreachLoading(null);
    }
  };

  const handleAiValidate = useCallback(async () => {
    if (!activeProfileId) return;
    setAiValidating(true);
    try {
      await scoreApi.runAi(activeProfileId);
      onRefresh?.();
    } catch (err) {
      console.error('AI validation failed:', err);
    } finally {
      setAiValidating(false);
    }
  }, [activeProfileId, onRefresh]);

  const saveNotes = () => {
    onNotesChange(notesText);
    setEditingNotes(false);
  };

  const scores = job.job_scores;
  const displayScore = scores?.ipe_score ?? job.fit_score;

  return (
    <div className="flex-1 bg-gradient-to-b from-bg-secondary to-bg-primary overflow-y-auto p-6 px-7 scrollbar-thin scrollbar-thumb-bg-card">
      {/* Header */}
      <div className="flex justify-between items-start mb-5">
        <div>
          <h2 className="text-[22px] font-bold text-[#f1f5f9] tracking-tight">{job.title}</h2>
          <div className="text-sm text-text-muted mt-1">
            {job.company} <span className="text-text-dim mx-1.5">&middot;</span> {job.location || 'N/A'}
          </div>
          <div className="text-[11px] text-[#334155] mt-1">
            {job.posted_at ? `Posted ${job.posted_at}` : ''} {job.applicants ? `\u00b7 ${job.applicants} applicants` : ''}
          </div>
        </div>
        <a
          href={job.link}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-accent-indigo/10 text-accent-indigo-light border border-accent-indigo/25 px-4 py-2 rounded-lg text-xs font-semibold hover:bg-accent-indigo/20 hover:border-accent-indigo/40 transition-all inline-flex items-center gap-1.5"
        >
          View Original
        </a>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <MetricCard label={scores?.ipe_score != null ? 'IPE Score' : 'Fit Score'} value={String(displayScore ?? '\u2014')} color="indigo" large />
        <MetricCard label="Competition" value={job.competition ?? '\u2014'} color="green" />
        <MetricCard label="Recommendation" value={job.recommendation ?? '\u2014'} color="amber" />
        <MetricCard label="Source" value={job.source === 'google-jobs' ? 'Google' : job.source} color="cyan" />
      </div>

      {/* IPE Score Breakdown */}
      {scores && scores.ipe_score != null && (
        <div className="mb-3">
          <ScoreBreakdown scores={scores} />
        </div>
      )}

      {/* AI Validation section */}
      {scores?.ai_validated && (
        <div className="bg-gradient-to-br from-[#0f172a]/70 to-[#0f172a]/30 border border-accent-purple/20 rounded-xl p-4 px-[18px] mb-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim">AI Validation</div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${scores.ai_agrees ? 'bg-accent-green/10 text-accent-green-light border-accent-green/20' : 'bg-accent-red/10 text-accent-red-light border-accent-red/20'}`}>
              {scores.ai_agrees ? 'Agrees' : 'Disagrees'}
            </span>
          </div>
          {scores.ai_pitch && (
            <div className="text-[13px] text-accent-indigo-light leading-relaxed italic mb-2">
              &ldquo;{scores.ai_pitch}&rdquo;
            </div>
          )}
          {scores.ai_flags && scores.ai_flags.length > 0 && (
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-widest text-text-dim mb-1">Flags</div>
              <div className="flex flex-wrap gap-1.5">
                {scores.ai_flags.map((flag) => (
                  <span key={flag} className="px-2 py-0.5 rounded text-[10px] font-medium bg-accent-amber/10 text-accent-amber-light border border-accent-amber/20">
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Validate with AI button */}
      {activeProfileId && scores?.ipe_score != null && !scores.ai_validated && (
        <div className="mb-3">
          <button
            onClick={handleAiValidate}
            disabled={aiValidating}
            className="w-full py-2.5 rounded-[10px] text-xs font-semibold bg-gradient-to-br from-accent-purple to-[#7c3aed] text-white shadow-[0_2px_12px_rgba(168,85,247,0.25)] hover:shadow-[0_4px_20px_rgba(168,85,247,0.35)] hover:-translate-y-0.5 transition-all disabled:opacity-50"
          >
            {aiValidating ? 'Validating...' : 'Validate with AI'}
          </button>
        </div>
      )}

      {/* Score Reason */}
      {job.score_reason && (
        <SectionCard label="Why This Score" text={job.score_reason} />
      )}

      {/* Pitch */}
      {job.pitch && (
        <SectionCard label="Outreach Hook" text={`"${job.pitch}"`} italic />
      )}

      {/* Description */}
      {job.description && (
        <div className="bg-gradient-to-br from-[#0f172a]/70 to-[#0f172a]/30 border border-border-subtle rounded-xl p-4 px-[18px] mb-3">
          <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim mb-2">Job Description</div>
          <div className={`text-xs text-text-muted leading-relaxed ${!showFullDesc ? 'max-h-20 overflow-hidden relative' : ''}`}>
            {job.description}
            {!showFullDesc && (
              <div className="absolute bottom-0 left-0 right-0 h-[30px] bg-gradient-to-t from-[#0a0f1e]/95 to-transparent" />
            )}
          </div>
          <button
            onClick={() => setShowFullDesc(!showFullDesc)}
            className="text-accent-indigo text-[11px] font-semibold mt-1 cursor-pointer"
          >
            {showFullDesc ? 'Show less' : 'Show full description'}
          </button>
        </div>
      )}

      {/* Pipeline */}
      <div className="mb-4">
        <Pipeline status={job.status} onStatusChange={onStatusChange} />
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {(['connection', 'email', 'inmail'] as const).map((type, i) => (
          <button
            key={type}
            onClick={() => handleOutreach(type)}
            disabled={outreachLoading !== null}
            className={`py-2.5 rounded-[10px] text-xs font-semibold transition-all
              ${i === 0
                ? 'bg-gradient-to-br from-accent-indigo to-[#4f46e5] text-white shadow-[0_2px_12px_rgba(99,102,241,0.25)] hover:shadow-[0_4px_20px_rgba(99,102,241,0.35)] hover:-translate-y-0.5'
                : 'bg-bg-card/50 text-text-secondary border border-border-subtle hover:text-text-primary hover:border-border'
              } disabled:opacity-50`}
          >
            {outreachLoading === type ? 'Generating...' : `Draft ${type.charAt(0).toUpperCase() + type.slice(1)}`}
          </button>
        ))}
      </div>

      {/* Outreach Result */}
      {outreachContent && (
        <div className="bg-gradient-to-br from-[#0f172a]/70 to-[#0f172a]/30 border border-accent-indigo/20 rounded-xl p-4 px-[18px] mb-3">
          <div className="flex justify-between items-center mb-2">
            <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim">Generated Draft</div>
            <button
              onClick={() => navigator.clipboard.writeText(outreachContent)}
              className="text-accent-indigo text-[10px] font-semibold hover:text-accent-indigo-light"
            >
              Copy
            </button>
          </div>
          <div className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">{outreachContent}</div>
        </div>
      )}

      {/* Notes */}
      <div className="bg-gradient-to-br from-[#0f172a]/70 to-[#0f172a]/30 border border-border-subtle rounded-xl p-4 px-[18px]">
        <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim mb-2">Notes</div>
        {editingNotes ? (
          <div>
            <textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              className="w-full bg-bg-primary/40 border border-border-subtle rounded-lg p-3 text-xs text-text-primary outline-none focus:border-accent-indigo/40 resize-none min-h-[80px]"
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button onClick={saveNotes} className="text-accent-indigo text-[11px] font-semibold">Save</button>
              <button onClick={() => setEditingNotes(false)} className="text-text-dim text-[11px]">Cancel</button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setEditingNotes(true)}
            className={`text-xs cursor-pointer min-h-[40px] ${job.notes ? 'text-text-secondary' : 'text-[#1e293b] italic'}`}
          >
            {job.notes || 'Click to add notes...'}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, color, large }: { label: string; value: string; color: string; large?: boolean }) {
  const colorMap: Record<string, string> = {
    indigo: 'text-accent-indigo-light',
    green: 'text-accent-green-light',
    amber: 'text-accent-amber-light',
    cyan: 'text-accent-cyan-light',
  };
  const borderMap: Record<string, string> = {
    indigo: 'before:bg-gradient-to-r before:from-transparent before:via-accent-indigo/50 before:to-transparent',
    green: 'before:bg-gradient-to-r before:from-transparent before:via-accent-green/50 before:to-transparent',
    amber: 'before:bg-gradient-to-r before:from-transparent before:via-accent-amber/50 before:to-transparent',
    cyan: 'before:bg-gradient-to-r before:from-transparent before:via-accent-cyan/50 before:to-transparent',
  };

  return (
    <div className={`bg-gradient-to-br from-[#0f172a]/90 to-[#0f172a]/50 border border-border-subtle rounded-xl p-4 text-center relative overflow-hidden before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-3/5 before:h-px ${borderMap[color]}`}>
      <div className={`${large ? 'text-[28px]' : 'text-[18px]'} font-extrabold mb-0.5 ${colorMap[color]} capitalize`}>{value}</div>
      <div className="text-[10px] text-text-dim uppercase tracking-[1px] font-semibold">{label}</div>
    </div>
  );
}

function SectionCard({ label, text, italic }: { label: string; text: string; italic?: boolean }) {
  return (
    <div className="bg-gradient-to-br from-[#0f172a]/70 to-[#0f172a]/30 border border-border-subtle rounded-xl p-4 px-[18px] mb-3">
      <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim mb-2">{label}</div>
      <div className={`text-[13px] text-text-secondary leading-relaxed ${italic ? 'italic text-accent-indigo-light' : ''}`}>{text}</div>
    </div>
  );
}

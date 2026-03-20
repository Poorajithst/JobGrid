import { useState, useEffect, useCallback, useMemo } from 'react';
import type { JobWithOutreach, Profile } from '../api/types';
import { Pipeline } from './Pipeline';
import { ScoreBreakdown } from './ScoreBreakdown';
import { outreachApi, scoreApi, enrichApi, profilesApi } from '../api/client';

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
  const [enrichingJob, setEnrichingJob] = useState(false);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);

  // Fetch active profile for keyword highlighting
  useEffect(() => {
    if (activeProfileId) {
      profilesApi.get(activeProfileId).then(setActiveProfile).catch(() => setActiveProfile(null));
    } else {
      setActiveProfile(null);
    }
  }, [activeProfileId]);

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

  const handleAiValidateSingle = useCallback(async () => {
    if (!activeProfileId) return;
    setAiValidating(true);
    try {
      await scoreApi.runAiSingle(activeProfileId, job.id);
      onRefresh?.();
    } catch (err) {
      console.error('AI validation failed:', err);
    } finally {
      setAiValidating(false);
    }
  }, [activeProfileId, job.id, onRefresh]);

  const handleEnrichJob = useCallback(async () => {
    setEnrichingJob(true);
    try {
      await enrichApi.enrichJob(job.id);
      onRefresh?.();
    } catch (err) {
      console.error('Enrich failed:', err);
    } finally {
      setEnrichingJob(false);
    }
  }, [job.id, onRefresh]);

  const saveNotes = () => {
    onNotesChange(notesText);
    setEditingNotes(false);
  };

  const scores = job.job_scores;
  const displayScore = scores?.ipe_score ?? job.fit_score;

  // Build keyword sets for highlighting
  const skillWords = useMemo(() => {
    if (!activeProfile?.targetSkills) return [] as string[];
    try {
      const arr = JSON.parse(activeProfile.targetSkills);
      if (Array.isArray(arr)) return arr.map((s: string) => s.toLowerCase());
    } catch { /* not JSON */ }
    return activeProfile.targetSkills.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  }, [activeProfile]);

  const certWords = useMemo(() => {
    if (!activeProfile?.targetCerts) return [] as string[];
    try {
      const arr = JSON.parse(activeProfile.targetCerts);
      if (Array.isArray(arr)) return arr.map((s: string) => s.toLowerCase());
    } catch { /* not JSON */ }
    return activeProfile.targetCerts.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  }, [activeProfile]);

  // Highlight matching keywords in description text
  const highlightDescription = useCallback((text: string) => {
    if (skillWords.length === 0 && certWords.length === 0) return text;

    // Build a combined regex for all keywords
    const allPatterns: { pattern: string; type: 'skill' | 'cert' }[] = [
      ...skillWords.map(w => ({ pattern: w, type: 'skill' as const })),
      ...certWords.map(w => ({ pattern: w, type: 'cert' as const })),
    ];

    if (allPatterns.length === 0) return text;

    // Escape regex special chars
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      `\\b(${allPatterns.map(p => escape(p.pattern)).join('|')})\\b`,
      'gi'
    );

    const parts: (string | { text: string; type: 'skill' | 'cert' })[] = [];
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      const matched = match[0].toLowerCase();
      const type = certWords.includes(matched) ? 'cert' : 'skill';
      parts.push({ text: match[0], type });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  }, [skillWords, certWords]);

  const descriptionContent = useMemo(() => {
    if (!job.description) return null;
    const text = showFullDesc ? job.description : job.description.slice(0, 500);
    const highlighted = highlightDescription(text);

    if (typeof highlighted === 'string') {
      return <span>{highlighted}</span>;
    }

    return (
      <>
        {highlighted.map((part, i) => {
          if (typeof part === 'string') return <span key={i}>{part}</span>;
          if (part.type === 'cert') {
            return (
              <mark key={i} className="bg-accent-amber/20 text-accent-amber-light rounded px-0.5">
                {part.text}
              </mark>
            );
          }
          return (
            <mark key={i} className="bg-accent-indigo/20 text-accent-indigo-light rounded px-0.5">
              {part.text}
            </mark>
          );
        })}
        {!showFullDesc && job.description.length > 500 && '...'}
      </>
    );
  }, [job.description, showFullDesc, highlightDescription]);

  return (
    <div className="flex-1 bg-gradient-to-b from-bg-secondary to-bg-primary overflow-y-auto p-6 px-7 scrollbar-thin scrollbar-thumb-bg-card">
      {/* Header */}
      <div className="flex justify-between items-start mb-5">
        <div>
          <h2 className="text-[22px] font-bold text-text-primary tracking-tight">{job.title}</h2>
          <div className="text-sm text-text-muted mt-1">
            {job.company} <span className="text-text-dim mx-1.5">&middot;</span> {job.location || 'N/A'}
          </div>
          <div className="text-[11px] text-text-dim mt-1">
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

      {/* AI Assessment section */}
      {scores?.ai_validated && (
        <div className="bg-gradient-to-br from-bg-tertiary/70 to-bg-tertiary/30 border border-accent-purple/20 rounded-xl p-4 px-[18px] mb-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim">AI Assessment</div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${scores.ai_agrees ? 'bg-accent-green/10 text-accent-green-light border-accent-green/20' : 'bg-accent-red/10 text-accent-red-light border-accent-red/20'}`}>
              {scores.ai_agrees ? 'Agrees' : 'Disagrees'}
            </span>
          </div>
          {scores.ai_fit_assessment && (
            <div className="text-[13px] text-text-secondary leading-relaxed mb-2">
              {scores.ai_fit_assessment}
            </div>
          )}
          {scores.ai_pitch && (
            <div className="text-[13px] text-accent-indigo-light leading-relaxed italic mb-2">
              &ldquo;{scores.ai_pitch}&rdquo;
            </div>
          )}
          {scores.ai_flags && scores.ai_flags.length > 0 && (
            <div className="bg-accent-amber/5 border border-accent-amber/15 rounded-lg p-3 mt-2">
              <div className="text-[9px] font-semibold uppercase tracking-widest text-text-dim mb-1.5">Flags</div>
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
            onClick={handleAiValidateSingle}
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

      {/* Description with keyword highlighting */}
      {job.description ? (
        <div className="bg-gradient-to-br from-bg-tertiary/70 to-bg-tertiary/30 border border-border-subtle rounded-xl p-4 px-[18px] mb-3">
          <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim mb-2">Job Description</div>
          <div className={`text-xs text-text-muted leading-relaxed ${!showFullDesc && job.description.length > 500 ? 'relative' : ''}`}>
            {descriptionContent}
            {!showFullDesc && job.description.length > 500 && (
              <div className="absolute bottom-0 left-0 right-0 h-[30px] bg-gradient-to-t from-bg-secondary/95 to-transparent" />
            )}
          </div>
          {job.description.length > 500 && (
            <button
              onClick={() => setShowFullDesc(!showFullDesc)}
              className="text-accent-indigo text-[11px] font-semibold mt-1 cursor-pointer"
            >
              {showFullDesc ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-gradient-to-br from-bg-tertiary/70 to-bg-tertiary/30 border border-border-subtle rounded-xl p-4 px-[18px] mb-3">
          <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim mb-2">Job Description</div>
          <div className="text-xs text-text-dim italic mb-2">No description available</div>
          <button
            onClick={handleEnrichJob}
            disabled={enrichingJob}
            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-accent-cyan/10 text-accent-cyan-light border border-accent-cyan/20 hover:bg-accent-cyan/20 transition-all disabled:opacity-50"
          >
            {enrichingJob ? 'Fetching...' : 'Fetch Description'}
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
        <div className="bg-gradient-to-br from-bg-tertiary/70 to-bg-tertiary/30 border border-accent-indigo/20 rounded-xl p-4 px-[18px] mb-3">
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
      <div className="bg-gradient-to-br from-bg-tertiary/70 to-bg-tertiary/30 border border-border-subtle rounded-xl p-4 px-[18px]">
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
            className={`text-xs cursor-pointer min-h-[40px] ${job.notes ? 'text-text-secondary' : 'text-text-dim italic'}`}
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
    <div className={`bg-gradient-to-br from-bg-tertiary/90 to-bg-tertiary/50 border border-border-subtle rounded-xl p-4 text-center relative overflow-hidden before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-3/5 before:h-px ${borderMap[color]}`}>
      <div className={`${large ? 'text-[28px]' : 'text-[18px]'} font-extrabold mb-0.5 ${colorMap[color]} capitalize`}>{value}</div>
      <div className="text-[10px] text-text-dim uppercase tracking-[1px] font-semibold">{label}</div>
    </div>
  );
}

function SectionCard({ label, text, italic }: { label: string; text: string; italic?: boolean }) {
  return (
    <div className="bg-gradient-to-br from-bg-tertiary/70 to-bg-tertiary/30 border border-border-subtle rounded-xl p-4 px-[18px] mb-3">
      <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim mb-2">{label}</div>
      <div className={`text-[13px] text-text-secondary leading-relaxed ${italic ? 'italic text-accent-indigo-light' : ''}`}>{text}</div>
    </div>
  );
}

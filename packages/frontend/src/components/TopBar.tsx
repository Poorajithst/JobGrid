import { scrapeApi, profilesApi, scoreApi, enrichApi } from '../api/client';
import type { Stats, IpeStats, Profile } from '../api/types';
import { useState, useCallback, useEffect, useRef } from 'react';

interface TopBarProps {
  stats: (Stats & Partial<IpeStats>) | null;
  onScrapeComplete: () => void;
  activeProfileId: number | null;
  onProfileChange: (id: number | null) => void;
  userSwitcher?: React.ReactNode;
  scoreTier?: 'analytic' | 'ai';
  onScoreTierChange?: (tier: 'analytic' | 'ai' | undefined) => void;
}

export function TopBar({ stats, onScrapeComplete, activeProfileId, onProfileChange, userSwitcher, scoreTier, onScoreTierChange }: TopBarProps) {
  const [scraping, setScraping] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  // Enrichment state
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<{ enriched: number; total: number } | null>(null);
  const [enrichPending, setEnrichPending] = useState<number>(0);
  const enrichPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scoring state
  const [scoring, setScoring] = useState(false);
  const [scoreResult, setScoreResult] = useState<string | null>(null);
  const [hasScored, setHasScored] = useState(false);

  // AI validation state
  const [validating, setValidating] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  useEffect(() => {
    profilesApi.list().then(setProfiles).catch(() => {});
  }, []);

  // Auto-select active profile on first load
  useEffect(() => {
    if (activeProfileId === null && profiles.length > 0) {
      const active = profiles.find((p) => p.isActive);
      if (active) onProfileChange(active.id);
    }
  }, [profiles, activeProfileId, onProfileChange]);

  // Poll enrichment status on mount to detect already-running enrichments
  useEffect(() => {
    enrichApi.status().then((s: any) => {
      if (s.running) {
        setEnriching(true);
        startEnrichPoll();
      } else {
        setEnrichPending(s.pending ?? 0);
      }
    }).catch(() => {});
    return () => {
      if (enrichPollRef.current) clearInterval(enrichPollRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startEnrichPoll = useCallback(() => {
    if (enrichPollRef.current) clearInterval(enrichPollRef.current);
    enrichPollRef.current = setInterval(async () => {
      try {
        const s = await enrichApi.status();
        if (s.running) {
          setEnrichProgress({ enriched: s.enriched ?? 0, total: s.total ?? 0 });
        } else {
          setEnriching(false);
          setEnrichProgress(null);
          setEnrichPending(s.pending ?? 0);
          if (enrichPollRef.current) clearInterval(enrichPollRef.current);
          enrichPollRef.current = null;
          onScrapeComplete(); // refresh data
        }
      } catch {
        // ignore
      }
    }, 3000);
  }, [onScrapeComplete]);

  const handleScrape = useCallback(async () => {
    setScraping(true);
    try {
      const { runId } = await scrapeApi.trigger();
      const poll = setInterval(async () => {
        const run = await scrapeApi.getRun(runId);
        if (run.status !== 'running') {
          clearInterval(poll);
          setScraping(false);
          onScrapeComplete();
        }
      }, 3000);
    } catch (err: unknown) {
      const axErr = err as { response?: { status?: number } };
      if (axErr.response?.status === 409) {
        alert('A scrape is already running.');
      }
      setScraping(false);
    }
  }, [onScrapeComplete]);

  const handleEnrich = useCallback(async () => {
    setEnriching(true);
    setEnrichProgress(null);
    try {
      await enrichApi.trigger();
      startEnrichPoll();
    } catch {
      setEnriching(false);
    }
  }, [startEnrichPoll]);

  const handleScore = useCallback(async () => {
    if (!activeProfileId) return;
    setScoring(true);
    setScoreResult(null);
    try {
      // Force re-score all jobs (descriptions may have been enriched since last score)
      await scoreApi.runIpe(activeProfileId, true);
      // Refresh stats to get the actual scored count
      onScrapeComplete();
      // Show stats-based match count (scoredCount from the profile-scoped stats)
      setScoreResult('Scored');
      setHasScored(true);
      onScrapeComplete();
    } catch {
      setScoreResult('Error');
    } finally {
      setScoring(false);
    }
  }, [activeProfileId, onScrapeComplete]);

  const handleAiValidate = useCallback(async () => {
    if (!activeProfileId) return;
    setValidating(true);
    setAiResult(null);
    try {
      const result = await scoreApi.runAi(activeProfileId);
      const count = result?.validated ?? result?.best ?? 0;
      setAiResult(`${count} best`);
      onScrapeComplete();
    } catch {
      setAiResult('Error');
    } finally {
      setValidating(false);
    }
  }, [activeProfileId, onScrapeComplete]);

  const enrichLabel = enriching
    ? `Enriching... ${enrichProgress ? `(${enrichProgress.enriched}/${enrichProgress.total})` : ''}`
    : enrichPending > 0
      ? `Enrich (${enrichPending} pending)`
      : 'Enrich JDs';

  return (
    <div className="bg-gradient-to-b from-[#0f1629] to-[#0c1120] border-b border-accent-indigo/15 px-6 py-3.5 flex justify-between items-center relative">
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-indigo/40 to-transparent" />
      <div className="flex items-center gap-5">
        {userSwitcher}
        <span className="text-lg font-extrabold tracking-tight bg-gradient-to-br from-accent-indigo-light to-accent-indigo bg-clip-text text-transparent">
          JobGrid
        </span>

        {/* Profile selector */}
        <select
          value={activeProfileId ?? ''}
          onChange={(e) => onProfileChange(e.target.value ? Number(e.target.value) : null)}
          className="bg-[#0f172a]/80 border border-border-subtle rounded-lg py-1.5 px-2.5 text-xs text-text-primary outline-none focus:border-accent-indigo/40 appearance-none cursor-pointer min-w-[140px]"
        >
          <option value="">No profile</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.isActive ? '(active)' : ''}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <StatBadge color="indigo" value={stats?.total ?? 0} label="Jobs" />
          <StatBadge color="green" value={stats?.avgIpeScore ?? stats?.avg_fit ?? 0} label={stats?.avgIpeScore !== undefined ? 'Avg IPE' : 'Avg Fit'} />
          <StatBadge color="amber" value={stats?.scoredCount ?? stats?.low_competition ?? 0} label={stats?.scoredCount !== undefined ? 'Scored' : 'Low Comp'} />
          <StatBadge color="cyan" value={stats?.aiValidatedCount ?? stats?.new_today ?? 0} label={stats?.aiValidatedCount !== undefined ? 'AI Validated' : 'New Today'} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-text-dim text-xs">
          Last scraped{' '}
          <span className="text-text-muted">
            {stats?.last_scraped
              ? new Date(stats.last_scraped).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'never'}
          </span>
        </span>

        {/* 1. Scrape button */}
        <button
          onClick={handleScrape}
          disabled={scraping}
          className="bg-gradient-to-br from-accent-indigo to-[#4f46e5] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-[0_2px_8px_rgba(99,102,241,0.3)] hover:shadow-[0_4px_16px_rgba(99,102,241,0.4)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {scraping ? 'Scraping...' : 'Scrape'}
        </button>

        {/* 2. Enrich JDs button */}
        <button
          onClick={handleEnrich}
          disabled={enriching}
          className="bg-gradient-to-br from-accent-cyan to-[#0891b2] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-[0_2px_8px_rgba(6,182,212,0.3)] hover:shadow-[0_4px_16px_rgba(6,182,212,0.4)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {enrichLabel}
        </button>

        {/* 3. Analytic Score button — click to score, click again to filter */}
        {activeProfileId && (
          <button
            onClick={() => {
              if (hasScored && !scoring) {
                // Toggle filter
                onScoreTierChange?.(scoreTier === 'analytic' ? undefined : 'analytic');
              } else {
                handleScore();
              }
            }}
            disabled={scoring}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-[0_2px_8px_rgba(16,185,129,0.3)] hover:shadow-[0_4px_16px_rgba(16,185,129,0.4)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed
              ${scoreTier === 'analytic'
                ? 'bg-accent-green text-white ring-2 ring-accent-green-light ring-offset-1 ring-offset-[#0f1629]'
                : 'bg-gradient-to-br from-accent-green to-[#059669] text-white'
              }`}
          >
            {scoring ? 'Scoring...' : scoreResult ?? 'Analytic Score'}
          </button>
        )}

        {/* 4. AI Score button — click to validate, click again to filter */}
        {activeProfileId && (
          <button
            onClick={() => {
              if (aiResult && !validating) {
                // Toggle filter
                onScoreTierChange?.(scoreTier === 'ai' ? undefined : 'ai');
              } else {
                handleAiValidate();
              }
            }}
            disabled={validating || (!hasScored && !aiResult)}
            title={!hasScored && !aiResult ? 'Run Analytic Score first' : undefined}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-[0_2px_8px_rgba(168,85,247,0.3)] hover:shadow-[0_4px_16px_rgba(168,85,247,0.4)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed
              ${scoreTier === 'ai'
                ? 'bg-accent-purple text-white ring-2 ring-[#a78bfa] ring-offset-1 ring-offset-[#0f1629]'
                : 'bg-gradient-to-br from-accent-purple to-[#7c3aed] text-white'
              }`}
          >
            {validating ? 'Validating...' : aiResult ?? 'AI Score'}
          </button>
        )}
      </div>
    </div>
  );
}

function StatBadge({ color, value, label }: { color: string; value: number; label: string }) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-accent-indigo/12 text-accent-indigo-light border-accent-indigo/20',
    green: 'bg-accent-green/12 text-accent-green-light border-accent-green/20',
    amber: 'bg-accent-amber/12 text-accent-amber-light border-accent-amber/20',
    cyan: 'bg-accent-cyan/12 text-accent-cyan-light border-accent-cyan/20',
  };

  return (
    <div className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border backdrop-blur-sm ${colorMap[color]}`}>
      <span className="text-sm font-extrabold">{typeof value === 'number' ? Math.round(value) : value}</span>
      {label}
    </div>
  );
}

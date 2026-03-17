import { scrapeApi, profilesApi, scoreApi } from '../api/client';
import type { Stats, IpeStats, Profile } from '../api/types';
import { useState, useCallback, useEffect } from 'react';

interface TopBarProps {
  stats: (Stats & Partial<IpeStats>) | null;
  onScrapeComplete: () => void;
  activeProfileId: number | null;
  onProfileChange: (id: number | null) => void;
}

export function TopBar({ stats, onScrapeComplete, activeProfileId, onProfileChange }: TopBarProps) {
  const [scraping, setScraping] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [validating, setValidating] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    profilesApi.list().then(setProfiles).catch(() => {});
  }, []);

  // Auto-select active profile on first load
  useEffect(() => {
    if (activeProfileId === null && profiles.length > 0) {
      const active = profiles.find((p) => p.is_active);
      if (active) onProfileChange(active.id);
    }
  }, [profiles, activeProfileId, onProfileChange]);

  const handleRunNow = useCallback(async () => {
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

  const handleScore = useCallback(async () => {
    if (!activeProfileId) return;
    setScoring(true);
    try {
      await scoreApi.runIpe(activeProfileId);
      onScrapeComplete(); // refresh data
    } catch {
      /* ignore */
    } finally {
      setScoring(false);
    }
  }, [activeProfileId, onScrapeComplete]);

  const handleAiValidate = useCallback(async () => {
    if (!activeProfileId) return;
    setValidating(true);
    try {
      await scoreApi.runAi(activeProfileId);
      onScrapeComplete();
    } catch {
      /* ignore */
    } finally {
      setValidating(false);
    }
  }, [activeProfileId, onScrapeComplete]);

  return (
    <div className="bg-gradient-to-b from-[#0f1629] to-[#0c1120] border-b border-accent-indigo/15 px-6 py-3.5 flex justify-between items-center relative">
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-indigo/40 to-transparent" />
      <div className="flex items-center gap-5">
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
              {p.name} {p.is_active ? '(active)' : ''}
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
      <div className="flex items-center gap-3.5">
        <span className="text-text-dim text-xs">
          Last scraped{' '}
          <span className="text-text-muted">
            {stats?.last_scraped
              ? new Date(stats.last_scraped).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'never'}
          </span>
        </span>
        {activeProfileId && (
          <>
            <button
              onClick={handleScore}
              disabled={scoring}
              className="bg-gradient-to-br from-accent-green to-[#059669] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-[0_2px_8px_rgba(16,185,129,0.3)] hover:shadow-[0_4px_16px_rgba(16,185,129,0.4)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scoring ? 'Scoring...' : 'Score Now'}
            </button>
            <button
              onClick={handleAiValidate}
              disabled={validating}
              className="bg-gradient-to-br from-accent-purple to-[#7c3aed] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-[0_2px_8px_rgba(168,85,247,0.3)] hover:shadow-[0_4px_16px_rgba(168,85,247,0.4)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {validating ? 'Validating...' : 'AI Validate'}
            </button>
          </>
        )}
        <button
          onClick={handleRunNow}
          disabled={scraping}
          className="bg-gradient-to-br from-accent-indigo to-[#4f46e5] text-white px-4 py-1.5 rounded-lg text-xs font-semibold shadow-[0_2px_8px_rgba(99,102,241,0.3)] hover:shadow-[0_4px_16px_rgba(99,102,241,0.4)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {scraping ? 'Running...' : 'Run Now'}
        </button>
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

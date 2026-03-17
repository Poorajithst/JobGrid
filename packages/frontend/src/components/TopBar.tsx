import { scrapeApi } from '../api/client';
import type { Stats } from '../api/types';
import { useState, useCallback } from 'react';

interface TopBarProps {
  stats: Stats | null;
  onScrapeComplete: () => void;
}

export function TopBar({ stats, onScrapeComplete }: TopBarProps) {
  const [scraping, setScraping] = useState(false);

  const handleRunNow = useCallback(async () => {
    setScraping(true);
    try {
      const { runId } = await scrapeApi.trigger();
      // Poll for completion
      const poll = setInterval(async () => {
        const run = await scrapeApi.getRun(runId);
        if (run.status !== 'running') {
          clearInterval(poll);
          setScraping(false);
          onScrapeComplete();
        }
      }, 3000);
    } catch (err: any) {
      if (err.response?.status === 409) {
        alert('A scrape is already running.');
      }
      setScraping(false);
    }
  }, [onScrapeComplete]);

  return (
    <div className="bg-gradient-to-b from-[#0f1629] to-[#0c1120] border-b border-accent-indigo/15 px-6 py-3.5 flex justify-between items-center relative">
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-indigo/40 to-transparent" />
      <div className="flex items-center gap-5">
        <span className="text-lg font-extrabold tracking-tight bg-gradient-to-br from-accent-indigo-light to-accent-indigo bg-clip-text text-transparent">
          JobGrid
        </span>
        <div className="flex gap-2">
          <StatBadge color="indigo" value={stats?.total ?? 0} label="Jobs" />
          <StatBadge color="green" value={stats?.avg_fit ?? 0} label="Avg Fit" />
          <StatBadge color="amber" value={stats?.low_competition ?? 0} label="Low Comp" />
          <StatBadge color="cyan" value={stats?.new_today ?? 0} label="New Today" />
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
      <span className="text-sm font-extrabold">{value}</span>
      {label}
    </div>
  );
}

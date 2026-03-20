import type { Job } from '../api/types';

interface JobCardProps {
  job: Job;
  isActive: boolean;
  onClick: () => void;
}

const SOURCE_COLORS: Record<string, string> = {
  greenhouse: 'bg-accent-cyan/10 text-[#22d3ee] border-accent-cyan/15',
  lever: 'bg-accent-amber/10 text-[#fbbf24] border-accent-amber/15',
  indeed: 'bg-accent-red/10 text-[#f87171] border-accent-red/15',
  'google-jobs': 'bg-accent-purple/10 text-[#c084fc] border-accent-purple/15',
  ziprecruiter: 'bg-accent-green/10 text-[#34d399] border-accent-green/15',
};

const COMP_COLORS: Record<string, string> = {
  low: 'bg-accent-green/10 text-[#34d399] border-accent-green/15',
  medium: 'bg-accent-amber/10 text-[#fbbf24] border-accent-amber/15',
  high: 'bg-accent-red/10 text-[#f87171] border-accent-red/15',
};

const REC_COLORS: Record<string, string> = {
  apply: 'bg-accent-indigo/10 text-[#818cf8] border-accent-indigo/15',
  watch: 'bg-accent-amber/10 text-[#fbbf24] border-accent-amber/15',
  skip: 'bg-accent-red/10 text-[#f87171] border-accent-red/15',
};

function getScoreStyle(score: number | null) {
  if (!score) return 'border-border text-text-muted';
  if (score >= 80) return 'border-accent-indigo/40 text-accent-indigo-light shadow-[0_0_12px_rgba(99,102,241,0.2)] bg-[radial-gradient(circle,rgba(99,102,241,0.2)_0%,transparent_70%)]';
  if (score >= 60) return 'border-accent-amber/40 text-accent-amber-light shadow-[0_0_12px_rgba(245,158,11,0.2)] bg-[radial-gradient(circle,rgba(245,158,11,0.2)_0%,transparent_70%)]';
  return 'border-accent-red/40 text-accent-red-light shadow-[0_0_12px_rgba(239,68,68,0.2)] bg-[radial-gradient(circle,rgba(239,68,68,0.2)_0%,transparent_70%)]';
}

function getFreshnessDot(postedAt: string | null): { color: string; title: string } {
  if (!postedAt) return { color: 'bg-text-dim', title: 'Unknown date' };
  const hoursAgo = (Date.now() - new Date(postedAt).getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 24) return { color: 'bg-accent-green shadow-[0_0_6px_rgba(16,185,129,0.5)]', title: 'Posted < 24h ago' };
  if (hoursAgo < 48) return { color: 'bg-accent-amber shadow-[0_0_6px_rgba(245,158,11,0.5)]', title: 'Posted < 48h ago' };
  return { color: 'bg-text-dim', title: 'Posted > 48h ago' };
}

export function JobCard({ job, isActive, onClick }: JobCardProps) {
  // Prefer IPE score if available, fall back to fit_score
  const displayScore = job.job_scores?.ipe_score ?? job.fit_score;
  const freshness = getFreshnessDot(job.posted_at);

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-[10px] p-3 px-3.5 mb-1.5 cursor-pointer transition-all duration-200 border
        ${isActive
          ? 'border-accent-indigo/50 bg-gradient-to-br from-accent-indigo/[0.08] to-bg-tertiary/90 shadow-[0_0_20px_rgba(99,102,241,0.08),inset_0_0_20px_rgba(99,102,241,0.03)]'
          : 'border-border-subtle bg-gradient-to-br from-bg-tertiary/80 to-bg-tertiary/40 hover:border-accent-indigo/30 hover:bg-gradient-to-br hover:from-bg-tertiary/90 hover:to-bg-card/40 hover:translate-x-0.5'
        }`}
    >
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-accent-indigo to-accent-indigo-light rounded-l-[3px]" />
      )}
      <div className="flex justify-between items-start gap-2.5">
        <div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full shrink-0 ${freshness.color}`} title={freshness.title} />
            <div className="text-[13px] font-semibold text-text-primary leading-snug">{job.title}</div>
          </div>
          <div className="text-[11px] text-text-muted mt-0.5">
            {job.company} &middot; {job.location || 'Location N/A'}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {job.job_scores?.ai_validated && (
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold bg-accent-purple/20 text-accent-purple-light border border-accent-purple/30"
              title="AI Validated"
            >
              AI
            </div>
          )}
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-extrabold border-2 ${getScoreStyle(displayScore)}`}>
            {displayScore ?? '\u2014'}
          </div>
        </div>
      </div>
      <div className="flex gap-[5px] mt-2">
        {job.competition && (
          <span className={`px-[7px] py-0.5 rounded text-[10px] font-medium border ${COMP_COLORS[job.competition] || ''}`}>
            {job.competition === 'low' ? 'Low Comp' : job.competition === 'medium' ? 'Med Comp' : 'High Comp'}
          </span>
        )}
        {job.recommendation && (
          <span className={`px-[7px] py-0.5 rounded text-[10px] font-medium border ${REC_COLORS[job.recommendation] || ''}`}>
            {job.recommendation.charAt(0).toUpperCase() + job.recommendation.slice(1)}
          </span>
        )}
        <span className={`px-[7px] py-0.5 rounded text-[10px] font-medium border ${SOURCE_COLORS[job.source] || ''}`}>
          {job.source === 'google-jobs' ? 'Google' : job.source.charAt(0).toUpperCase() + job.source.slice(1)}
        </span>
      </div>
      {job.posted_at && (
        <div className="text-[10px] text-text-dim mt-1.5">
          Posted {job.posted_at} {job.applicants ? `\u00b7 ${job.applicants} applicants` : ''}
        </div>
      )}
    </div>
  );
}

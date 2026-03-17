import type { JobScore } from '../api/types';

interface ScoreBreakdownProps {
  scores: JobScore;
  weights?: {
    weight_title: number;
    weight_skill: number;
    weight_location: number;
    weight_experience: number;
    weight_education: number;
    weight_cert: number;
    weight_freshness: number;
  };
}

const DIMENSIONS: { key: keyof JobScore; label: string; weightKey: string }[] = [
  { key: 'title_score', label: 'Title', weightKey: 'weight_title' },
  { key: 'skill_score', label: 'Skills', weightKey: 'weight_skill' },
  { key: 'location_score', label: 'Location', weightKey: 'weight_location' },
  { key: 'experience_score', label: 'Experience', weightKey: 'weight_experience' },
  { key: 'education_score', label: 'Education', weightKey: 'weight_education' },
  { key: 'cert_score', label: 'Certifications', weightKey: 'weight_cert' },
  { key: 'freshness_score', label: 'Freshness', weightKey: 'weight_freshness' },
];

function barColor(score: number): string {
  if (score >= 70) return 'from-accent-green to-[#059669]';
  if (score >= 40) return 'from-accent-amber to-[#d97706]';
  return 'from-accent-red to-[#dc2626]';
}

function barGlow(score: number): string {
  if (score >= 70) return 'shadow-[0_0_8px_rgba(16,185,129,0.3)]';
  if (score >= 40) return 'shadow-[0_0_8px_rgba(245,158,11,0.3)]';
  return 'shadow-[0_0_8px_rgba(239,68,68,0.3)]';
}

export function ScoreBreakdown({ scores, weights }: ScoreBreakdownProps) {
  return (
    <div className="bg-gradient-to-br from-[#0f172a]/70 to-[#0f172a]/30 border border-border-subtle rounded-xl p-4 px-[18px]">
      {/* Overall IPE score */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim">IPE Score Breakdown</div>
        <div className="flex items-center gap-2">
          {scores.ai_validated && (
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold border bg-accent-green/10 text-accent-green-light border-accent-green/20">
              {scores.ai_agrees ? 'AI Agrees' : 'AI Disagrees'}
            </span>
          )}
          <span className="text-lg font-extrabold text-accent-indigo-light">
            {scores.ipe_score ?? '--'}
          </span>
        </div>
      </div>

      {/* Dimension bars */}
      <div className="space-y-2.5">
        {DIMENSIONS.map(({ key, label, weightKey }) => {
          const val = (scores[key] as number | null) ?? 0;
          const weight = weights ? (weights as Record<string, number>)[weightKey] : undefined;
          return (
            <div key={key}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] text-text-secondary font-medium">{label}</span>
                <div className="flex items-center gap-2">
                  {weight !== undefined && (
                    <span className="text-[10px] text-text-dim">{Math.round(weight * 100)}%</span>
                  )}
                  <span className="text-[11px] font-bold text-text-primary w-6 text-right">{val}</span>
                </div>
              </div>
              <div className="h-1.5 bg-bg-card/60 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${barColor(val)} ${barGlow(val)} transition-all duration-500`}
                  style={{ width: `${val}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Matched skills */}
      {scores.matched_skills && scores.matched_skills.length > 0 && (
        <div className="mt-4">
          <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim mb-2">Matched Skills</div>
          <div className="flex flex-wrap gap-1.5">
            {scores.matched_skills.map((skill) => (
              <span
                key={skill}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-accent-indigo/10 text-accent-indigo-light border border-accent-indigo/20"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

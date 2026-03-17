import { scoreJob } from './groq.js';
import type { ScoreResponse } from './prompts.js';
import type { DynamicProfile } from './prompts.js';

const BATCH_SIZE = 10;
const PAUSE_MS = 1000;

export interface ScoredJob {
  id: number;
  fitScore: number;
  competition: string;
  recommendation: string;
  pitch: string;
  scoreReason: string;
}

export async function scoreJobs(
  jobs: Array<{ id: number; title: string; company: string; source: string; description: string | null }>,
  profile?: DynamicProfile
): Promise<ScoredJob[]> {
  const results: ScoredJob[] = [];

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);
    const scored = await Promise.all(
      batch.map(async (job) => {
        const result = await scoreJob(job, profile);
        if (!result) return null;
        return {
          id: job.id,
          fitScore: result.fit_score,
          competition: result.competition,
          recommendation: result.recommendation,
          pitch: result.pitch,
          scoreReason: result.score_reason,
        };
      })
    );

    results.push(...scored.filter((s): s is ScoredJob => s !== null));

    // Pause between batches (not after the last batch)
    if (i + BATCH_SIZE < jobs.length) {
      await new Promise(r => setTimeout(r, PAUSE_MS));
    }
  }

  return results;
}

import { Router } from 'express';
import type { createQueries } from '../../db/queries.js';

export function createStatsRouter(queries: ReturnType<typeof createQueries>) {
  const router = Router();

  router.get('/', (req, res) => {
    const stats = queries.getStats();
    const profileId = req.query.profileId ? parseInt(req.query.profileId as string, 10) : undefined;

    if (!profileId) {
      res.json(stats);
      return;
    }

    // Compute profile-scoped IPE stats from job_scores
    const scores = queries.getJobScoresByProfile(profileId);
    const scoredCount = scores.length;
    const avgIpeScore = scoredCount > 0
      ? Math.round(scores.reduce((sum, s) => sum + s.ipeScore, 0) / scoredCount)
      : 0;
    const aiValidatedCount = scores.filter(s => s.aiValidated === true).length;
    const topScoredCount = scores.filter(s => s.ipeScore >= 60).length;

    res.json({
      ...stats,
      avgIpeScore,
      scoredCount,
      aiValidatedCount,
      topScoredCount,
    });
  });

  return router;
}

import { Router } from 'express';
import type { createQueries } from '../../db/queries.js';

export function createStatsRouter(queries: ReturnType<typeof createQueries>) {
  const router = Router();

  router.get('/', (_req, res) => {
    const stats = queries.getStats();
    res.json(stats);
  });

  return router;
}

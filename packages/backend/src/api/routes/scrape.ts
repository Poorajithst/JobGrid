import { Router } from 'express';
import type { createQueries } from '../../db/queries.js';

type ScrapeHandler = () => Promise<void>;

let isRunning = false;

export function createScrapeRouter(
  queries: ReturnType<typeof createQueries>,
  triggerScrape: ScrapeHandler
) {
  const router = Router();

  // GET /api/scrape/log — MUST be before /:runId to avoid "log" matching as a param
  router.get('/log', (_req, res) => {
    const runs = queries.getRecentScrapeRuns();
    res.json(runs);
  });

  // POST /api/scrape — trigger manual run
  router.post('/', (_req, res) => {
    // Check both in-memory flag and DB for running status
    if (isRunning) {
      res.status(409).json({ error: 'A scrape run is already in progress' });
      return;
    }

    const run = queries.createScrapeRun({
      startedAt: new Date().toISOString(),
      status: 'running',
    });
    isRunning = true;

    triggerScrape()
      .catch(err => console.error('Manual scrape failed:', err))
      .finally(() => { isRunning = false; });

    res.json({ runId: run.id });
  });

  // GET /api/scrape/:runId
  router.get('/:runId', (req, res) => {
    const run = queries.getScrapeRun(parseInt(req.params.runId, 10));
    if (!run) {
      res.status(404).json({ error: 'Scrape run not found' });
      return;
    }
    res.json(run);
  });

  return router;
}

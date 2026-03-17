import { Router } from 'express';
import { isNull, eq } from 'drizzle-orm';
import { jobs } from '../../db/schema.js';
import { fetchJobDescription } from '../../sources/description-fetcher.js';
import { getPage, closeBrowser } from '../../browser/instance.js';
import { randomDelay } from '../../browser/delay.js';
import type { createQueries } from '../../db/queries.js';

let isEnriching = false;

export function createEnrichRouter(queries: ReturnType<typeof createQueries>, db: any) {
  const router = Router();

  // GET /api/enrich/status
  router.get('/status', (_req, res) => {
    const allJobs = db.select().from(jobs).all();
    const withDesc = allJobs.filter((j: any) => j.description !== null);
    res.json({
      total: allJobs.length,
      enriched: withDesc.length,
      pending: allJobs.length - withDesc.length,
      running: isEnriching,
    });
  });

  // POST /api/enrich — bulk
  router.post('/', async (_req, res) => {
    if (isEnriching) {
      res.status(409).json({ error: 'Already enriching' });
      return;
    }
    isEnriching = true;
    res.json({ running: true });

    // Run in background
    (async () => {
      try {
        const nullJobs = db.select().from(jobs).where(isNull(jobs.description)).all();
        const page = await getPage();
        for (const job of nullJobs) {
          try {
            const desc = await fetchJobDescription(job.link, page);
            if (desc) {
              db.update(jobs).set({ description: desc }).where(eq(jobs.id, job.id)).run();
            }
          } catch { /* continue */ }
          await randomDelay(1000, 2000);
        }
        await page.context().close();
        await closeBrowser();
      } catch (err) {
        console.error('Enrichment failed:', err);
      } finally {
        isEnriching = false;
      }
    })();
  });

  // POST /api/enrich/:jobId — single job
  router.post('/:jobId', async (req, res) => {
    const jobId = parseInt(req.params.jobId, 10);
    const job = queries.getJobById(jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    try {
      const desc = await fetchJobDescription(job.link);
      if (desc) {
        db.update(jobs).set({ description: desc }).where(eq(jobs.id, jobId)).run();
        res.json({ enriched: true, length: desc.length });
      } else {
        res.json({ enriched: false });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

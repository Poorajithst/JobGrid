import { Router } from 'express';
import { UpdateStatusSchema, UpdateNotesSchema } from '../schemas.js';
import type { createQueries } from '../../db/queries.js';

export function createJobsRouter(queries: ReturnType<typeof createQueries>) {
  const router = Router();

  // GET /api/jobs
  router.get('/', (req, res) => {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = (page - 1) * limit;

    const filters = {
      source: req.query.source as string | undefined,
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
      minScore: req.query.minScore ? parseInt(req.query.minScore as string, 10) : undefined,
      orderBy: (req.query.sort === 'fitScore' ? 'fitScore' : 'scrapedAt') as 'fitScore' | 'scrapedAt',
      orderDir: (req.query.order as 'asc' | 'desc') || 'desc',
    };

    const profileId = req.query.profileId ? parseInt(req.query.profileId as string, 10) : undefined;
    const scoreTier = req.query.scoreTier as string | undefined; // 'analytic' | 'ai'

    // Get all matching jobs for count, then apply pagination
    const allJobs = queries.getJobs(filters);

    // If profileId is set, merge IPE score data and sort by ipeScore desc
    let enrichedJobs = allJobs.map(job => {
      if (!profileId) return job;
      const score = queries.getJobScore(job.id, profileId);
      return {
        ...job,
        ipeScore: score?.ipeScore ?? null,
        matchedSkills: score?.matchedSkills ? JSON.parse(score.matchedSkills) : null,
        aiValidated: score?.aiValidated ?? null,
        aiAgrees: score?.aiAgrees ?? null,
        aiPitch: score?.aiPitch ?? null,
        aiFlags: score?.aiFlags ? (() => { try { return JSON.parse(score.aiFlags!); } catch { return [score.aiFlags]; } })() : null,
      };
    });

    if (profileId && filters.orderBy === 'scrapedAt' && filters.orderDir === 'desc') {
      // Default sort when profileId is set: ipeScore desc
      enrichedJobs.sort((a: any, b: any) => ((b.ipeScore ?? -1) - (a.ipeScore ?? -1)));
    }

    // Apply score tier filtering
    if (profileId && scoreTier) {
      const profile = queries.getProfileById(profileId);
      if (scoreTier === 'analytic') {
        // Show only top N by IPE score (analyticTopN from profile, default 35)
        const topN = profile?.analyticTopN ?? 35;
        // Sort by ipeScore desc first, then take top N
        enrichedJobs.sort((a: any, b: any) => ((b.ipeScore ?? -1) - (a.ipeScore ?? -1)));
        enrichedJobs = enrichedJobs.filter((j: any) => j.ipeScore != null).slice(0, topN);
      } else if (scoreTier === 'ai') {
        // Show only AI-validated jobs (the top picks sent through AI review)
        enrichedJobs = enrichedJobs.filter((j: any) => j.aiValidated === true);
      }
    }

    const total = enrichedJobs.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedJobs = enrichedJobs.slice(offset, offset + limit);

    res.json({
      jobs: paginatedJobs,
      total,
      page,
      totalPages,
      hasMore: page < totalPages,
    });
  });

  // GET /api/jobs/:id
  router.get('/:id', (req, res) => {
    const job = queries.getJobById(parseInt(req.params.id, 10));
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    const outreachDrafts = queries.getOutreachByJobId(job.id);
    res.json({ ...job, outreach: outreachDrafts });
  });

  // PATCH /api/jobs/:id/status
  router.patch('/:id/status', (req, res) => {
    const parsed = UpdateStatusSchema.parse(req.body);
    const id = parseInt(req.params.id, 10);
    queries.updateJobStatus(id, parsed.status);
    const updated = queries.getJobById(id);
    res.json(updated);
  });

  // PATCH /api/jobs/:id/notes
  router.patch('/:id/notes', (req, res) => {
    const parsed = UpdateNotesSchema.parse(req.body);
    const id = parseInt(req.params.id, 10);
    queries.updateJobNotes(id, parsed.notes ?? '', parsed.nextAction);
    const updated = queries.getJobById(id);
    res.json(updated);
  });

  return router;
}

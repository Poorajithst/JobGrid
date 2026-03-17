import { Router } from 'express';
import { isNull, eq } from 'drizzle-orm';
import { jobs } from '../../db/schema.js';
import { fetchJobDescription } from '../../sources/description-fetcher.js';
import { getPage, closeBrowser } from '../../browser/instance.js';
import { randomDelay } from '../../browser/delay.js';
import { calculateIpeScore, type ProfileConfig, type JobData } from '../../ipe/index.js';
import type { createQueries } from '../../db/queries.js';

let isEnriching = false;
let enrichProgress = { enriched: 0, scored: 0, total: 0 };

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
      progress: isEnriching ? enrichProgress : null,
    });
  });

  // Score a single job against all active profiles
  function scoreJobAgainstProfiles(jobId: number) {
    const job = queries.getJobById(jobId);
    if (!job || !job.description) return 0;

    const activeProfiles = queries.getActiveProfiles();
    let scored = 0;

    for (const profile of activeProfiles) {
      const config: ProfileConfig = {
        targetTitles: JSON.parse(profile.targetTitles),
        targetSkills: JSON.parse(profile.targetSkills),
        targetCerts: profile.targetCerts ? JSON.parse(profile.targetCerts) : [],
        targetLocations: profile.targetLocations ? JSON.parse(profile.targetLocations) : [],
        experienceYears: profile.minExperienceYears || 0,
        titleSynonyms: profile.titleSynonyms ? JSON.parse(profile.titleSynonyms) : {},
        weights: {
          freshness: profile.freshnessWeight,
          skill: profile.skillWeight,
          title: profile.titleWeight,
          cert: profile.certWeight,
          competition: profile.competitionWeight,
          location: profile.locationWeight,
          experience: profile.experienceWeight,
        },
      };

      const jobData: JobData = {
        title: job.title,
        description: job.description,
        location: job.location,
        postedAt: job.postedAt,
        applicants: job.applicants,
      };

      const result = calculateIpeScore(config, jobData);

      queries.upsertJobScore({
        jobId,
        profileId: profile.id,
        ipeScore: result.ipeScore,
        freshnessScore: result.dimensions.freshnessScore,
        skillMatchScore: result.dimensions.skillMatchScore,
        titleAlignmentScore: result.dimensions.titleAlignmentScore,
        certMatchScore: result.dimensions.certMatchScore,
        competitionScore: result.dimensions.competitionScore,
        locationMatchScore: result.dimensions.locationMatchScore,
        experienceAlignScore: result.dimensions.experienceAlignScore,
        matchedSkills: JSON.stringify(result.matchedSkills),
      });
      scored++;
    }
    return scored;
  }

  // POST /api/enrich — bulk enrich + score as each job is enriched
  router.post('/', async (_req, res) => {
    if (isEnriching) {
      res.status(409).json({ error: 'Already enriching' });
      return;
    }
    isEnriching = true;
    enrichProgress = { enriched: 0, scored: 0, total: 0 };
    res.json({ running: true });

    // Run in background
    (async () => {
      try {
        const nullJobs = db.select().from(jobs).where(isNull(jobs.description)).all();
        enrichProgress.total = nullJobs.length;
        console.log(`Enriching ${nullJobs.length} jobs (enrich + score as we go)...`);

        const page = await getPage();
        for (let i = 0; i < nullJobs.length; i++) {
          const job = nullJobs[i];
          try {
            const desc = await fetchJobDescription(job.link, page);
            if (desc) {
              db.update(jobs).set({ description: desc }).where(eq(jobs.id, job.id)).run();
              enrichProgress.enriched++;

              // Score immediately against all active profiles
              const scored = scoreJobAgainstProfiles(job.id);
              enrichProgress.scored += scored;

              if (enrichProgress.enriched % 10 === 0) {
                console.log(`  [${enrichProgress.enriched}/${nullJobs.length}] enriched & scored`);
              }
            }
          } catch { /* continue */ }
          await randomDelay(1000, 2000);
        }
        await page.context().close();
        await closeBrowser();
        console.log(`Enrichment complete: ${enrichProgress.enriched} enriched, ${enrichProgress.scored} scores updated`);
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
        // Score immediately against all active profiles
        const scored = scoreJobAgainstProfiles(jobId);
        res.json({ enriched: true, length: desc.length, scored });
      } else {
        res.json({ enriched: false });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

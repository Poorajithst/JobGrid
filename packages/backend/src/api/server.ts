import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { db } from '../db/index.js';
import { createQueries } from '../db/queries.js';
import { createJobsRouter } from './routes/jobs.js';
import { createStatsRouter } from './routes/stats.js';
import { createScrapeRouter } from './routes/scrape.js';
import { createOutreachRouter } from './routes/outreach.js';
import { createCompaniesRouter } from './routes/companies.js';
import { createDocumentsRouter } from './routes/documents.js';
import { createProfilesRouter } from './routes/profiles.js';
import { createScoreRouter } from './routes/score.js';
import { createEnrichRouter } from './routes/enrich.js';
import { errorHandler } from './middleware/errors.js';
import { userContext } from './middleware/user-context.js';
import { createBootstrapMiddleware } from './middleware/bootstrap.js';
import { createUsersRouter } from './routes/users.js';
import { createSetupRouter } from './routes/setup.js';
import { runAllSources } from '../sources/index.js';
import { scoreJobs } from '../scorer/index.js';
import { calculateIpeScore, type ProfileConfig, type JobData } from '../ipe/index.js';
import { isNull, eq } from 'drizzle-orm';
import { jobs as jobsTable } from '../db/schema.js';
import { fetchJobDescription } from '../sources/description-fetcher.js';
import { getPage, closeBrowser } from '../browser/instance.js';
import { randomDelay } from '../browser/delay.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const queries = createQueries(db);

const app = express();

app.use(cors({ origin: ['http://localhost:5173'] }));
app.use(express.json());
app.use(userContext);
app.use(createBootstrapMiddleware(() => queries.getUserCount()));

async function triggerScrape() {
  const run = queries.createScrapeRun({
    startedAt: new Date().toISOString(),
    status: 'running',
  });
  const runId = run.id;

  try {
    // Get active companies from DB
    const companies = queries.getActiveCompanies().map(c => ({
      name: c.name,
      greenhouseSlug: c.greenhouseSlug ?? null,
      leverSlug: c.leverSlug ?? null,
    }));

    // Collect search queries from all active profiles
    const activeProfiles = queries.getActiveProfiles();
    const allQueries = new Set<string>();
    for (const p of activeProfiles) {
      if (p.searchQueries) {
        try {
          const pQueries: string[] = JSON.parse(p.searchQueries);
          for (const q of pQueries) allQueries.add(q);
        } catch { /* skip malformed JSON */ }
      }
    }
    const searchQueries = allQueries.size > 0 ? [...allQueries] : undefined;

    // Run all sources (returns SourceResult with jobs, sourcesRun, errors)
    const result = await runAllSources(companies, searchQueries);
    const { jobs: allJobs, sourcesRun, errors } = result;

    // Filter to only new jobs (DB-level dedup)
    const allLinks = allJobs.map(j => j.link);
    const newLinks = queries.filterNewLinks(allLinks);
    const newLinkSet = new Set(newLinks);
    const newJobs = allJobs.filter(j => newLinkSet.has(j.link));

    // Insert new jobs one at a time to get their IDs for scoring
    const insertedJobs: { id: number; title: string; company: string; source: string; description: string | null }[] = [];
    for (const j of newJobs) {
      const inserted = queries.insertJob({
        title: j.title,
        company: j.company,
        location: j.location,
        link: j.link,
        source: j.source,
        atsId: j.atsId,
        postedAt: j.postedAt,
        applicants: j.applicants,
        description: j.description,
      });
      insertedJobs.push({
        id: inserted.id,
        title: j.title,
        company: j.company,
        source: j.source,
        description: j.description,
      });
    }

    // Score new jobs
    if (insertedJobs.length > 0) {
      const scored = await scoreJobs(insertedJobs);
      for (const s of scored) {
        queries.updateJobScoring(s.id, {
          fitScore: s.fitScore,
          competition: s.competition,
          recommendation: s.recommendation,
          pitch: s.pitch,
          scoreReason: s.scoreReason,
        });
      }
    }

    // Run IPE scoring against all active profiles
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

      const unscoredIds = queries.getUnscoredJobIds(profile.id);
      for (const jobId of unscoredIds) {
        const job = queries.getJobById(jobId);
        if (!job) continue;

        const jobData: JobData = {
          title: job.title,
          description: job.description,
          location: job.location,
          postedAt: job.postedAt,
          applicants: job.applicants,
        };

        const ipeResult = calculateIpeScore(config, jobData);
        queries.upsertJobScore({
          jobId,
          profileId: profile.id,
          ipeScore: ipeResult.ipeScore,
          freshnessScore: ipeResult.dimensions.freshnessScore,
          skillMatchScore: ipeResult.dimensions.skillMatchScore,
          titleAlignmentScore: ipeResult.dimensions.titleAlignmentScore,
          certMatchScore: ipeResult.dimensions.certMatchScore,
          competitionScore: ipeResult.dimensions.competitionScore,
          locationMatchScore: ipeResult.dimensions.locationMatchScore,
          experienceAlignScore: ipeResult.dimensions.experienceAlignScore,
          matchedSkills: JSON.stringify(ipeResult.matchedSkills),
        });
      }

      if (unscoredIds.length > 0) {
        console.log(`IPE scored ${unscoredIds.length} jobs for profile "${profile.name}"`);
      }
    }

    // Auto-trigger enrichment for jobs without descriptions (runs in background)
    const nullDescJobs = db.select().from(jobsTable).where(isNull(jobsTable.description)).all();
    if (nullDescJobs.length > 0) {
      (async () => {
        try {
          const page = await getPage();
          for (const job of nullDescJobs) {
            try {
              const desc = await fetchJobDescription(job.link, page);
              if (desc) {
                db.update(jobsTable).set({ description: desc }).where(eq(jobsTable.id, job.id)).run();
              }
            } catch { /* continue */ }
            await randomDelay(1000, 2000);
          }
          await page.context().close();
          await closeBrowser();
          console.log(`Enrichment complete: processed ${nullDescJobs.length} jobs`);
        } catch (err) {
          console.error('Auto-enrichment failed:', err);
        }
      })();
    }

    // Determine status: success if no errors, partial if some, failed if all
    const status = errors.length === 0 ? 'success'
      : errors.length < sourcesRun.length ? 'partial'
      : 'failed';

    // Update scrape run
    queries.updateScrapeRun(runId, {
      finishedAt: new Date().toISOString(),
      jobsFound: allJobs.length,
      jobsNew: newJobs.length,
      status,
      error: errors.length > 0 ? errors.join('; ') : null,
    });

    console.log(`Scrape complete: ${allJobs.length} found, ${newJobs.length} new, status: ${status}`);
  } catch (err: any) {
    queries.updateScrapeRun(runId, {
      finishedAt: new Date().toISOString(),
      status: 'failed',
      error: err.message,
    });
    throw err;
  }
}

app.use('/api/users', createUsersRouter(queries));
app.use('/api/setup', createSetupRouter(queries));
app.use('/api/jobs', createJobsRouter(queries));
app.use('/api/stats', createStatsRouter(queries));
app.use('/api/scrape', createScrapeRouter(queries, triggerScrape));
app.use('/api/outreach', createOutreachRouter(queries));
app.use('/api/companies', createCompaniesRouter(queries));
app.use('/api/documents', createDocumentsRouter(queries));
app.use('/api/profiles', createProfilesRouter(queries));
app.use('/api/score', createScoreRouter(queries));
app.use('/api/enrich', createEnrichRouter(queries, db));

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  const { startScheduler } = await import('../scheduler/cron.js');
  startScheduler(triggerScrape);
}

app.listen(PORT, () => {
  console.log(`JobGrid API running on port ${PORT}`);
});

export { app, queries, triggerScrape };

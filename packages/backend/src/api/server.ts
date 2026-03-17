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
import { errorHandler } from './middleware/errors.js';
import { runAllSources } from '../sources/index.js';
import { scoreJobs } from '../scorer/index.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const queries = createQueries(db);

const app = express();

app.use(cors({ origin: ['http://localhost:5173'] }));
app.use(express.json());

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

    // Run all sources (returns SourceResult with jobs, sourcesRun, errors)
    const result = await runAllSources(companies);
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

app.use('/api/jobs', createJobsRouter(queries));
app.use('/api/stats', createStatsRouter(queries));
app.use('/api/scrape', createScrapeRouter(queries, triggerScrape));
app.use('/api/outreach', createOutreachRouter(queries));
app.use('/api/companies', createCompaniesRouter(queries));
app.use('/api/documents', createDocumentsRouter(queries));
app.use('/api/profiles', createProfilesRouter(queries));
app.use('/api/score', createScoreRouter(queries));

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  const { startScheduler } = await import('../scheduler/cron.js');
  startScheduler(triggerScrape);
}

app.listen(PORT, () => {
  console.log(`JobGrid API running on port ${PORT}`);
});

export { app, queries, triggerScrape };

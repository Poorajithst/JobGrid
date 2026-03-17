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
import { errorHandler } from './middleware/errors.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const queries = createQueries(db);

const app = express();

app.use(cors({ origin: ['http://localhost:5173'] }));
app.use(express.json());

// Placeholder scrape handler — will be wired to orchestrator in Task 24
const triggerScrape = async () => {
  console.log('Scrape triggered (handler not wired yet)');
};

app.use('/api/jobs', createJobsRouter(queries));
app.use('/api/stats', createStatsRouter(queries));
app.use('/api/scrape', createScrapeRouter(queries, triggerScrape));
app.use('/api/outreach', createOutreachRouter(queries));
app.use('/api/companies', createCompaniesRouter(queries));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`JobGrid API running on port ${PORT}`);
});

export { app, queries };

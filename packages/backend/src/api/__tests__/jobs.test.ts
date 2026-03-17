import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../db/schema.js';
import { createQueries } from '../../db/queries.js';
import { createJobsRouter } from '../routes/jobs.js';
import { errorHandler } from '../middleware/errors.js';

describe('Jobs API', () => {
  let app: express.Express;
  let sqlite: InstanceType<typeof Database>;

  beforeAll(() => {
    sqlite = new Database(':memory:');
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: './drizzle' });
    const queries = createQueries(db);

    // Seed test data
    queries.insertJob({ title: 'PM One', company: 'Co1', link: 'https://test.com/1', source: 'greenhouse' });
    queries.insertJob({ title: 'PM Two', company: 'Co2', link: 'https://test.com/2', source: 'lever' });
    queries.updateJobScoring(1, { fitScore: 90, competition: 'low', recommendation: 'apply', pitch: 'Great fit', scoreReason: 'Strong match' });

    app = express();
    app.use(express.json());
    app.use('/api/jobs', createJobsRouter(queries));
    app.use(errorHandler);
  });

  afterAll(() => sqlite.close());

  it('GET /api/jobs returns paginated list', async () => {
    const res = await request(app).get('/api/jobs');
    expect(res.status).toBe(200);
    expect(res.body.jobs).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body.hasMore).toBe(false);
  });

  it('GET /api/jobs?source=greenhouse filters by source', async () => {
    const res = await request(app).get('/api/jobs?source=greenhouse');
    expect(res.status).toBe(200);
    expect(res.body.jobs).toHaveLength(1);
    expect(res.body.jobs[0].source).toBe('greenhouse');
  });

  it('GET /api/jobs/:id returns single job', async () => {
    const res = await request(app).get('/api/jobs/1');
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('PM One');
  });

  it('GET /api/jobs/:id returns 404 for missing job', async () => {
    const res = await request(app).get('/api/jobs/999');
    expect(res.status).toBe(404);
  });

  it('PATCH /api/jobs/:id/status updates status', async () => {
    const res = await request(app)
      .patch('/api/jobs/1/status')
      .send({ status: 'applied' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('applied');
  });

  it('PATCH /api/jobs/:id/notes updates notes', async () => {
    const res = await request(app)
      .patch('/api/jobs/1/notes')
      .send({ notes: 'Follow up Monday' });
    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('Follow up Monday');
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../schema.js';
import { createQueries } from '../queries.js';

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: './drizzle' });
  return { db, sqlite, queries: createQueries(db) };
}

describe('Query Helpers', () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx = createTestDb();
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  // ── Companies ──────────────────────────────────────────────
  it('insert and retrieve a company', () => {
    const company = ctx.queries.insertCompany({
      name: 'TestCorp',
      greenhouseSlug: 'testcorp',
    });
    expect(company.id).toBe(1);
    expect(company.name).toBe('TestCorp');
    expect(company.greenhouseSlug).toBe('testcorp');
    expect(company.active).toBe(true);

    const all = ctx.queries.getCompanies();
    expect(all).toHaveLength(1);
  });

  it('getActiveCompanies filters inactive', () => {
    ctx.queries.insertCompany({ name: 'Active', active: true });
    ctx.queries.insertCompany({ name: 'Inactive', active: false });

    const active = ctx.queries.getActiveCompanies();
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe('Active');
  });

  it('updateCompany updates fields', () => {
    const company = ctx.queries.insertCompany({ name: 'Old' });
    const updated = ctx.queries.updateCompany(company.id, { name: 'New' });
    expect(updated!.name).toBe('New');
  });

  it('deleteCompany removes company', () => {
    const company = ctx.queries.insertCompany({ name: 'ToDelete' });
    ctx.queries.deleteCompany(company.id);
    expect(ctx.queries.getCompanies()).toHaveLength(0);
  });

  // ── Jobs ───────────────────────────────────────────────────
  it('insert and retrieve a job', () => {
    const job = ctx.queries.insertJob({
      title: 'Software Engineer',
      company: 'TestCorp',
      link: 'https://example.com/job/1',
      source: 'greenhouse',
    });
    expect(job.id).toBe(1);
    expect(job.status).toBe('discovered');

    const fetched = ctx.queries.getJobById(job.id);
    expect(fetched!.title).toBe('Software Engineer');
  });

  it('dedup by link via filterNewLinks', () => {
    ctx.queries.insertJob({
      title: 'Job A',
      company: 'Corp',
      link: 'https://example.com/a',
      source: 'greenhouse',
    });

    const newLinks = ctx.queries.filterNewLinks([
      'https://example.com/a',
      'https://example.com/b',
    ]);
    expect(newLinks).toEqual(['https://example.com/b']);
  });

  it('insertJobs inserts multiple jobs', () => {
    const jobs = ctx.queries.insertJobs([
      { title: 'J1', company: 'C', link: 'https://a.com/1', source: 'lever' },
      { title: 'J2', company: 'C', link: 'https://a.com/2', source: 'lever' },
    ]);
    expect(jobs).toHaveLength(2);
  });

  it('update job status', () => {
    const job = ctx.queries.insertJob({
      title: 'Engineer',
      company: 'Corp',
      link: 'https://example.com/j',
      source: 'greenhouse',
    });
    const updated = ctx.queries.updateJobStatus(job.id, 'applied', {
      appliedAt: '2025-01-01',
    });
    expect(updated!.status).toBe('applied');
    expect(updated!.appliedAt).toBe('2025-01-01');
  });

  it('update job scoring', () => {
    const job = ctx.queries.insertJob({
      title: 'Engineer',
      company: 'Corp',
      link: 'https://example.com/score',
      source: 'greenhouse',
    });
    const updated = ctx.queries.updateJobScoring(job.id, {
      fitScore: 85,
      competition: 'low',
      recommendation: 'apply',
      pitch: 'Great fit',
      scoreReason: 'Strong match',
    });
    expect(updated!.fitScore).toBe(85);
    expect(updated!.competition).toBe('low');
  });

  it('getJobs with filters', () => {
    ctx.queries.insertJob({
      title: 'Frontend Dev',
      company: 'Corp',
      link: 'https://a.com/fe',
      source: 'greenhouse',
      status: 'discovered',
    });
    ctx.queries.insertJob({
      title: 'Backend Dev',
      company: 'Corp',
      link: 'https://a.com/be',
      source: 'lever',
      status: 'applied',
    });

    const ghJobs = ctx.queries.getJobs({ source: 'greenhouse' });
    expect(ghJobs).toHaveLength(1);

    const appliedJobs = ctx.queries.getJobs({ status: 'applied' });
    expect(appliedJobs).toHaveLength(1);

    const searchJobs = ctx.queries.getJobs({ search: 'Frontend' });
    expect(searchJobs).toHaveLength(1);
  });

  // ── Outreach ───────────────────────────────────────────────
  it('insert and retrieve outreach', () => {
    const job = ctx.queries.insertJob({
      title: 'Dev',
      company: 'C',
      link: 'https://o.com/1',
      source: 'greenhouse',
    });
    ctx.queries.insertOutreach({
      jobId: job.id,
      type: 'email',
      content: 'Hello!',
    });
    const outreach = ctx.queries.getOutreachByJobId(job.id);
    expect(outreach).toHaveLength(1);
    expect(outreach[0].type).toBe('email');
  });

  // ── Scrape Runs ────────────────────────────────────────────
  it('create and update scrape run', () => {
    const run = ctx.queries.createScrapeRun({
      startedAt: '2025-01-01T00:00:00Z',
      status: 'running',
      sourcesRun: 'greenhouse,lever',
    });
    expect(run.id).toBe(1);
    expect(run.status).toBe('running');

    const updated = ctx.queries.updateScrapeRun(run.id, {
      status: 'completed',
      finishedAt: '2025-01-01T00:05:00Z',
      jobsFound: 10,
      jobsNew: 5,
    });
    expect(updated!.status).toBe('completed');
    expect(updated!.jobsNew).toBe(5);

    const recent = ctx.queries.getRecentScrapeRuns(5);
    expect(recent).toHaveLength(1);
  });

  // ── Stats ──────────────────────────────────────────────────
  it('get stats returns correct counts', () => {
    ctx.queries.insertCompany({ name: 'Corp' });
    ctx.queries.insertJob({
      title: 'J1',
      company: 'Corp',
      link: 'https://s.com/1',
      source: 'greenhouse',
      status: 'discovered',
      fitScore: 80,
    });
    ctx.queries.insertJob({
      title: 'J2',
      company: 'Corp',
      link: 'https://s.com/2',
      source: 'greenhouse',
      status: 'applied',
      fitScore: 90,
    });

    const stats = ctx.queries.getStats();
    expect(stats.totalJobs).toBe(2);
    expect(stats.totalCompanies).toBe(1);
    expect(stats.byStatus['discovered']).toBe(1);
    expect(stats.byStatus['applied']).toBe(1);
    expect(stats.avgScore).toBe(85);
  });
});

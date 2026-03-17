import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const companies = sqliteTable('companies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  greenhouseSlug: text('greenhouse_slug'),
  leverSlug: text('lever_slug'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  lastChecked: text('last_checked'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const jobs = sqliteTable('jobs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  company: text('company').notNull(),
  location: text('location'),
  applicants: integer('applicants'),
  description: text('description'),
  link: text('link').notNull().unique(),
  source: text('source').notNull(),
  atsId: text('ats_id'),
  postedAt: text('posted_at'),
  scrapedAt: text('scraped_at').notNull().default(sql`(datetime('now'))`),
  fitScore: integer('fit_score'),
  competition: text('competition'),
  recommendation: text('recommendation'),
  pitch: text('pitch'),
  scoreReason: text('score_reason'),
  status: text('status').notNull().default('discovered'),
  notes: text('notes'),
  nextAction: text('next_action'),
  appliedAt: text('applied_at'),
  interviewAt: text('interview_at'),
  offerAt: text('offer_at'),
}, (table) => [
  index('idx_jobs_source').on(table.source),
  index('idx_jobs_status').on(table.status),
  index('idx_jobs_fit_score').on(table.fitScore),
  index('idx_jobs_source_ats_id').on(table.source, table.atsId),
]);

export const outreach = sqliteTable('outreach', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobId: integer('job_id').notNull().references(() => jobs.id),
  type: text('type').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const scrapeRuns = sqliteTable('scrape_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  jobsFound: integer('jobs_found').notNull().default(0),
  jobsNew: integer('jobs_new').notNull().default(0),
  sourcesRun: text('sources_run'),
  status: text('status').notNull(),
  error: text('error'),
});

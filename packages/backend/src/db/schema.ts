import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
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

export const documents = sqliteTable('documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(), // "resume" or "linkedin"
  filename: text('filename').notNull(),
  rawText: text('raw_text').notNull(),
  parsedSkills: text('parsed_skills'), // JSON array
  parsedTitles: text('parsed_titles'), // JSON array
  parsedCerts: text('parsed_certs'), // JSON array
  parsedExperienceYears: integer('parsed_experience_years'),
  parsedLocations: text('parsed_locations'), // JSON array
  parsedIndustries: text('parsed_industries'), // JSON array
  parsedTools: text('parsed_tools'), // JSON array
  parsedEducation: text('parsed_education'), // JSON {degree, field}
  uploadedAt: text('uploaded_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const profiles = sqliteTable('profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  targetTitles: text('target_titles').notNull(), // JSON array
  targetSkills: text('target_skills').notNull(), // JSON array
  targetCerts: text('target_certs'), // JSON array
  targetLocations: text('target_locations'), // JSON array
  minExperienceYears: integer('min_experience_years'),
  maxExperienceYears: integer('max_experience_years'),
  searchQueries: text('search_queries'), // JSON array
  titleSynonyms: text('title_synonyms'), // JSON object
  freshnessWeight: real('freshness_weight').notNull().default(0.25),
  skillWeight: real('skill_weight').notNull().default(0.25),
  titleWeight: real('title_weight').notNull().default(0.15),
  certWeight: real('cert_weight').notNull().default(0.10),
  competitionWeight: real('competition_weight').notNull().default(0.10),
  locationWeight: real('location_weight').notNull().default(0.10),
  experienceWeight: real('experience_weight').notNull().default(0.05),
  aiThreshold: integer('ai_threshold').notNull().default(60),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const jobScores = sqliteTable('job_scores', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobId: integer('job_id').notNull().references(() => jobs.id),
  profileId: integer('profile_id').notNull().references(() => profiles.id),
  ipeScore: integer('ipe_score').notNull(),
  freshnessScore: integer('freshness_score').notNull(),
  skillMatchScore: integer('skill_match_score').notNull(),
  titleAlignmentScore: integer('title_alignment_score').notNull(),
  certMatchScore: integer('cert_match_score').notNull(),
  competitionScore: integer('competition_score').notNull(),
  locationMatchScore: integer('location_match_score').notNull(),
  experienceAlignScore: integer('experience_align_score').notNull(),
  matchedSkills: text('matched_skills'), // JSON array
  aiValidated: integer('ai_validated', { mode: 'boolean' }).notNull().default(false),
  aiAgrees: integer('ai_agrees', { mode: 'boolean' }),
  aiPitch: text('ai_pitch'),
  aiFlags: text('ai_flags'),
  scoredAt: text('scored_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex('idx_job_scores_unique').on(table.jobId, table.profileId),
  index('idx_job_scores_profile').on(table.profileId),
  index('idx_job_scores_ipe').on(table.profileId, table.ipeScore),
]);

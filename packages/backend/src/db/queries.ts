import { eq, sql, and, like, gte, desc, asc, inArray } from 'drizzle-orm';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

type DB = BetterSQLite3Database<typeof schema>;

export function createQueries(db: DB) {
  return {
    // ── Companies ──────────────────────────────────────────────
    getCompanies() {
      return db.select().from(schema.companies).all();
    },

    getActiveCompanies() {
      return db
        .select()
        .from(schema.companies)
        .where(eq(schema.companies.active, true))
        .all();
    },

    insertCompany(data: {
      name: string;
      greenhouseSlug?: string | null;
      leverSlug?: string | null;
      active?: boolean;
    }) {
      return db
        .insert(schema.companies)
        .values({
          name: data.name,
          greenhouseSlug: data.greenhouseSlug ?? null,
          leverSlug: data.leverSlug ?? null,
          active: data.active ?? true,
        })
        .returning()
        .get();
    },

    updateCompany(
      id: number,
      data: Partial<{
        name: string;
        greenhouseSlug: string | null;
        leverSlug: string | null;
        active: boolean;
        lastChecked: string;
      }>
    ) {
      return db
        .update(schema.companies)
        .set(data)
        .where(eq(schema.companies.id, id))
        .returning()
        .get();
    },

    deleteCompany(id: number) {
      return db
        .delete(schema.companies)
        .where(eq(schema.companies.id, id))
        .returning()
        .get();
    },

    // ── Jobs ───────────────────────────────────────────────────
    getJobs(filters?: {
      source?: string;
      status?: string;
      search?: string;
      minScore?: number;
      limit?: number;
      offset?: number;
      orderBy?: 'fitScore' | 'scrapedAt';
      orderDir?: 'asc' | 'desc';
    }) {
      const conditions = [];

      if (filters?.source) {
        conditions.push(eq(schema.jobs.source, filters.source));
      }
      if (filters?.status) {
        conditions.push(eq(schema.jobs.status, filters.status));
      }
      if (filters?.search) {
        conditions.push(like(schema.jobs.title, `%${filters.search}%`));
      }
      if (filters?.minScore !== undefined) {
        conditions.push(gte(schema.jobs.fitScore, filters.minScore));
      }

      const orderCol =
        filters?.orderBy === 'fitScore'
          ? schema.jobs.fitScore
          : schema.jobs.scrapedAt;
      const orderFn = filters?.orderDir === 'asc' ? asc : desc;

      let query = db
        .select()
        .from(schema.jobs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(orderFn(orderCol));

      if (filters?.limit) {
        query = query.limit(filters.limit) as typeof query;
      }
      if (filters?.offset) {
        query = query.offset(filters.offset) as typeof query;
      }

      return query.all();
    },

    getJobById(id: number) {
      return db
        .select()
        .from(schema.jobs)
        .where(eq(schema.jobs.id, id))
        .get();
    },

    insertJob(data: typeof schema.jobs.$inferInsert) {
      return db.insert(schema.jobs).values(data).returning().get();
    },

    insertJobs(data: (typeof schema.jobs.$inferInsert)[]) {
      if (data.length === 0) return [];
      return db.insert(schema.jobs).values(data).returning().all();
    },

    filterNewLinks(links: string[]) {
      if (links.length === 0) return [];
      const existing = db
        .select({ link: schema.jobs.link })
        .from(schema.jobs)
        .where(inArray(schema.jobs.link, links))
        .all()
        .map((r) => r.link);
      const existingSet = new Set(existing);
      return links.filter((l) => !existingSet.has(l));
    },

    updateJobStatus(id: number, status: string, extra?: Record<string, string | null>) {
      return db
        .update(schema.jobs)
        .set({ status, ...extra })
        .where(eq(schema.jobs.id, id))
        .returning()
        .get();
    },

    updateJobNotes(id: number, notes: string, nextAction?: string | null) {
      return db
        .update(schema.jobs)
        .set({ notes, nextAction: nextAction ?? null })
        .where(eq(schema.jobs.id, id))
        .returning()
        .get();
    },

    updateJobScoring(
      id: number,
      data: {
        fitScore: number;
        competition?: string | null;
        recommendation?: string | null;
        pitch?: string | null;
        scoreReason?: string | null;
      }
    ) {
      return db
        .update(schema.jobs)
        .set({
          fitScore: data.fitScore,
          competition: data.competition ?? null,
          recommendation: data.recommendation ?? null,
          pitch: data.pitch ?? null,
          scoreReason: data.scoreReason ?? null,
        })
        .where(eq(schema.jobs.id, id))
        .returning()
        .get();
    },

    // ── Outreach ───────────────────────────────────────────────
    getOutreachByJobId(jobId: number) {
      return db
        .select()
        .from(schema.outreach)
        .where(eq(schema.outreach.jobId, jobId))
        .all();
    },

    insertOutreach(data: { jobId: number; type: string; content: string }) {
      return db.insert(schema.outreach).values(data).returning().get();
    },

    // ── Scrape Runs ────────────────────────────────────────────
    createScrapeRun(data: { startedAt: string; status: string; sourcesRun?: string }) {
      return db.insert(schema.scrapeRuns).values(data).returning().get();
    },

    getScrapeRun(id: number) {
      return db
        .select()
        .from(schema.scrapeRuns)
        .where(eq(schema.scrapeRuns.id, id))
        .get();
    },

    updateScrapeRun(
      id: number,
      data: Partial<{
        finishedAt: string;
        jobsFound: number;
        jobsNew: number;
        status: string;
        error: string | null;
      }>
    ) {
      return db
        .update(schema.scrapeRuns)
        .set(data)
        .where(eq(schema.scrapeRuns.id, id))
        .returning()
        .get();
    },

    getRecentScrapeRuns(limit = 10) {
      return db
        .select()
        .from(schema.scrapeRuns)
        .orderBy(desc(schema.scrapeRuns.startedAt))
        .limit(limit)
        .all();
    },

    // ── Stats ──────────────────────────────────────────────────
    getStats() {
      const totalJobs = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.jobs)
        .get()!.count;

      const byStatus = db
        .select({
          status: schema.jobs.status,
          count: sql<number>`count(*)`,
        })
        .from(schema.jobs)
        .groupBy(schema.jobs.status)
        .all();

      const avgScore = db
        .select({
          avg: sql<number>`avg(${schema.jobs.fitScore})`,
        })
        .from(schema.jobs)
        .where(sql`${schema.jobs.fitScore} IS NOT NULL`)
        .get()!.avg;

      const totalCompanies = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.companies)
        .get()!.count;

      return {
        totalJobs,
        byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.count])),
        avgScore: avgScore ?? 0,
        totalCompanies,
      };
    },
  };
}

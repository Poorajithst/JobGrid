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

    // ── Documents ─────────────────────────────────────────────
    getDocuments() {
      return db.select().from(schema.documents).all();
    },

    getDocumentsByType(type: string) {
      return db.select().from(schema.documents).where(eq(schema.documents.type, type)).all();
    },

    insertDocument(data: {
      type: string;
      filename: string;
      rawText: string;
      parsedSkills: string | null;
      parsedTitles: string | null;
      parsedCerts: string | null;
      parsedExperienceYears: number;
      parsedLocations: string | null;
      parsedIndustries: string | null;
      parsedTools: string | null;
      parsedEducation: string | null;
    }) {
      return db.insert(schema.documents).values(data).run();
    },

    deleteDocument(id: number) {
      return db.delete(schema.documents).where(eq(schema.documents.id, id)).run();
    },

    deleteDocumentByType(type: string) {
      return db.delete(schema.documents).where(eq(schema.documents.type, type)).run();
    },

    getMergedProfile() {
      const docs = db.select().from(schema.documents).all();
      const allSkills = new Set<string>();
      const allTitles = new Set<string>();
      const allCerts = new Set<string>();
      const allLocations = new Set<string>();
      const allTools = new Set<string>();
      const allIndustries = new Set<string>();
      let maxYears = 0;

      for (const doc of docs) {
        if (doc.parsedSkills) JSON.parse(doc.parsedSkills).forEach((s: string) => allSkills.add(s));
        if (doc.parsedTitles) JSON.parse(doc.parsedTitles).forEach((t: string) => allTitles.add(t));
        if (doc.parsedCerts) JSON.parse(doc.parsedCerts).forEach((c: string) => allCerts.add(c));
        if (doc.parsedLocations) JSON.parse(doc.parsedLocations).forEach((l: string) => allLocations.add(l));
        if (doc.parsedTools) JSON.parse(doc.parsedTools).forEach((t: string) => allTools.add(t));
        if (doc.parsedIndustries) JSON.parse(doc.parsedIndustries).forEach((i: string) => allIndustries.add(i));
        if (doc.parsedExperienceYears && doc.parsedExperienceYears > maxYears) {
          maxYears = doc.parsedExperienceYears;
        }
      }

      return {
        skills: [...allSkills],
        titles: [...allTitles],
        certs: [...allCerts],
        locations: [...allLocations],
        tools: [...allTools],
        industries: [...allIndustries],
        experienceYears: maxYears,
      };
    },

    // ── Profiles ─────────────────────────────────────────────────
    getProfiles() {
      return db.select().from(schema.profiles).all();
    },

    getActiveProfiles() {
      return db.select().from(schema.profiles).where(eq(schema.profiles.isActive, true)).all();
    },

    getProfileById(id: number) {
      return db.select().from(schema.profiles).where(eq(schema.profiles.id, id)).get();
    },

    insertProfile(data: {
      name: string;
      targetTitles: string;
      targetSkills: string;
      targetCerts?: string | null;
      targetLocations?: string | null;
      minExperienceYears?: number | null;
      maxExperienceYears?: number | null;
      searchQueries?: string | null;
      titleSynonyms?: string | null;
    }) {
      return db.insert(schema.profiles).values(data).returning().get();
    },

    updateProfile(id: number, data: Partial<{
      name: string;
      targetTitles: string;
      targetSkills: string;
      targetCerts: string | null;
      targetLocations: string | null;
      searchQueries: string | null;
      titleSynonyms: string | null;
      freshnessWeight: number;
      skillWeight: number;
      titleWeight: number;
      certWeight: number;
      competitionWeight: number;
      locationWeight: number;
      experienceWeight: number;
      aiThreshold: number;
      isActive: boolean;
      updatedAt: string;
    }>) {
      return db.update(schema.profiles).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(schema.profiles.id, id)).run();
    },

    deleteProfile(id: number) {
      // Delete associated job_scores first
      db.delete(schema.jobScores).where(eq(schema.jobScores.profileId, id)).run();
      return db.delete(schema.profiles).where(eq(schema.profiles.id, id)).run();
    },

    // ── Job Scores ──────────────────────────────────────────────
    getJobScoresByProfile(profileId: number) {
      return db.select().from(schema.jobScores).where(eq(schema.jobScores.profileId, profileId)).all();
    },

    getJobScore(jobId: number, profileId: number) {
      return db.select().from(schema.jobScores)
        .where(and(eq(schema.jobScores.jobId, jobId), eq(schema.jobScores.profileId, profileId)))
        .get();
    },

    upsertJobScore(data: {
      jobId: number;
      profileId: number;
      ipeScore: number;
      freshnessScore: number;
      skillMatchScore: number;
      titleAlignmentScore: number;
      certMatchScore: number;
      competitionScore: number;
      locationMatchScore: number;
      experienceAlignScore: number;
      matchedSkills?: string | null;
    }) {
      const existing = db.select().from(schema.jobScores)
        .where(and(eq(schema.jobScores.jobId, data.jobId), eq(schema.jobScores.profileId, data.profileId)))
        .get();

      if (existing) {
        return db.update(schema.jobScores).set({ ...data, scoredAt: new Date().toISOString() })
          .where(eq(schema.jobScores.id, existing.id)).run();
      }
      return db.insert(schema.jobScores).values(data).run();
    },

    updateJobScoreAi(id: number, data: { aiValidated: boolean; aiAgrees: boolean | null; aiPitch: string | null; aiFlags: string | null }) {
      return db.update(schema.jobScores).set(data).where(eq(schema.jobScores.id, id)).run();
    },

    getUnscoredJobIds(profileId: number) {
      const scored = db.select({ jobId: schema.jobScores.jobId })
        .from(schema.jobScores)
        .where(eq(schema.jobScores.profileId, profileId))
        .all()
        .map(r => r.jobId);

      return db.select({ id: schema.jobs.id })
        .from(schema.jobs)
        .all()
        .filter(j => !scored.includes(j.id))
        .map(j => j.id);
    },

    getTopUnvalidatedScores(profileId: number, threshold: number) {
      return db.select().from(schema.jobScores)
        .where(and(
          eq(schema.jobScores.profileId, profileId),
          gte(schema.jobScores.ipeScore, threshold),
          eq(schema.jobScores.aiValidated, false),
        ))
        .orderBy(desc(schema.jobScores.ipeScore))
        .limit(50)
        .all();
    },

    recalculateIpeScores(profileId: number, weights: {
      freshness: number; skill: number; title: number; cert: number;
      competition: number; location: number; experience: number;
    }) {
      const scores = db.select().from(schema.jobScores)
        .where(eq(schema.jobScores.profileId, profileId)).all();

      for (const s of scores) {
        const newIpe = Math.round(
          s.freshnessScore * weights.freshness +
          s.skillMatchScore * weights.skill +
          s.titleAlignmentScore * weights.title +
          s.certMatchScore * weights.cert +
          s.competitionScore * weights.competition +
          s.locationMatchScore * weights.location +
          s.experienceAlignScore * weights.experience
        );
        db.update(schema.jobScores).set({ ipeScore: Math.max(0, Math.min(100, newIpe)) })
          .where(eq(schema.jobScores.id, s.id)).run();
      }
      return scores.length;
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

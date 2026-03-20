import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../db/schema.js';
import { createQueries } from '../../db/queries.js';
import { createSetupRouter } from '../routes/setup.js';
import { errorHandler } from '../middleware/errors.js';
import { userContext } from '../middleware/user-context.js';

// Mock bootstrap (uses global db singleton) and dictionary (reads from disk via global db)
vi.mock('../../db/bootstrap.js', () => ({
  hydrateUserDictionary: vi.fn().mockReturnValue(42),
  loadSeedCompanies: vi.fn().mockReturnValue(5),
}));

vi.mock('../../documents/dictionary.js', () => ({
  loadFullTemplate: vi.fn().mockReturnValue({
    label: 'Product Manager / TPM',
    defaultTitles: ['Product Manager', 'Technical Program Manager'],
    defaultSynonyms: { 'Product Manager': ['PM', 'Group PM'] },
    defaultExcludes: ['Junior PM'],
    weights: {
      freshness: 0.25,
      skill: 0.25,
      title: 0.15,
      cert: 0.10,
      competition: 0.10,
      location: 0.10,
      experience: 0.05,
    },
  }),
}));

// Mock document processing (multer + pdf parsing — not needed in these tests)
vi.mock('../../documents/parser.js', () => ({
  extractTextFromPdf: vi.fn().mockResolvedValue(''),
}));

vi.mock('../../documents/extractor.js', () => ({
  extractProfileData: vi.fn().mockReturnValue({
    skills: [],
    titles: [],
    certs: [],
    experienceYears: null,
    locations: [],
    industries: [],
    tools: [],
    education: null,
  }),
}));

describe('Setup Wizard API', () => {
  let app: express.Express;
  let sqlite: InstanceType<typeof Database>;
  let queries: ReturnType<typeof createQueries>;

  beforeAll(() => {
    sqlite = new Database(':memory:');
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: './drizzle' });
    queries = createQueries(db);

    app = express();
    app.use(express.json());
    app.use(userContext);
    app.use('/api/setup', createSetupRouter(queries));
    app.use(errorHandler);
  });

  afterAll(() => sqlite.close());

  // ── POST /setup/user ──────────────────────────────────────────
  describe('POST /api/setup/user', () => {
    it('creates a user and returns userId', async () => {
      const res = await request(app)
        .post('/api/setup/user')
        .send({ name: 'Alice', avatarColor: '#ff0000' });

      expect(res.status).toBe(201);
      expect(res.body.userId).toBeDefined();
      expect(typeof res.body.userId).toBe('number');
    });

    it('uses default avatarColor when not provided', async () => {
      const res = await request(app)
        .post('/api/setup/user')
        .send({ name: 'Bob' });

      expect(res.status).toBe(201);
      expect(res.body.userId).toBeDefined();
    });

    it('returns 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/setup/user')
        .send({ avatarColor: '#ff0000' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Name is required');
    });

    it('returns 400 when name is empty string', async () => {
      const res = await request(app)
        .post('/api/setup/user')
        .send({ name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Name is required');
    });
  });

  // ── POST /setup/archetype ─────────────────────────────────────
  describe('POST /api/setup/archetype', () => {
    let userId: number;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/setup/user')
        .send({ name: 'Archetype Tester' });
      userId = res.body.userId;
    });

    it('creates a profile with template defaults and returns profileId', async () => {
      const res = await request(app)
        .post('/api/setup/archetype')
        .send({ archetype: 'pm-tpm', userId });

      expect(res.status).toBe(201);
      expect(res.body.profileId).toBeDefined();
      expect(typeof res.body.profileId).toBe('number');
      expect(res.body.template).toBeDefined();
    });

    it('populates user_dictionary (hydrateUserDictionary is called)', async () => {
      const { hydrateUserDictionary } = await import('../../db/bootstrap.js');

      const res = await request(app)
        .post('/api/setup/archetype')
        .send({ archetype: 'pm-tpm', userId });

      expect(res.status).toBe(201);
      expect(res.body.termCount).toBe(42);
      expect(hydrateUserDictionary).toHaveBeenCalledWith(userId, 'pm-tpm');
    });

    it('returns 400 when archetype is missing', async () => {
      const res = await request(app)
        .post('/api/setup/archetype')
        .send({ userId });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/archetype/i);
    });

    it('returns 400 when userId is missing', async () => {
      const res = await request(app)
        .post('/api/setup/archetype')
        .send({ archetype: 'pm-tpm' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/userId/i);
    });
  });

  // ── POST /setup/skills ────────────────────────────────────────
  describe('POST /api/setup/skills', () => {
    let userId: number;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/setup/user')
        .send({ name: 'Skills Tester' });
      userId = res.body.userId;
    });

    it('adds dictionary terms and returns totalTerms', async () => {
      const res = await request(app)
        .post('/api/setup/skills')
        .send({
          userId,
          add: [
            { category: 'tools', term: 'Jira' },
            { category: 'methodologies', term: 'Scrum' },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.totalTerms).toBeGreaterThanOrEqual(2);
    });

    it('removes dictionary terms and updates count', async () => {
      // First add a term
      await request(app)
        .post('/api/setup/skills')
        .send({
          userId,
          add: [{ category: 'tools', term: 'Confluence' }],
        });

      const beforeRes = await request(app)
        .get('/api/setup/skills')
        .query({ userId });
      const beforeCount = beforeRes.body.terms.length;

      // Then remove it
      const removeRes = await request(app)
        .post('/api/setup/skills')
        .send({
          userId,
          remove: [{ category: 'tools', term: 'Confluence' }],
        });

      expect(removeRes.status).toBe(200);
      expect(removeRes.body.totalTerms).toBe(beforeCount - 1);
    });

    it('handles both add and remove in the same request', async () => {
      // Setup: add a term to later remove
      await request(app)
        .post('/api/setup/skills')
        .send({ userId, add: [{ category: 'domains', term: 'FinTech' }] });

      const res = await request(app)
        .post('/api/setup/skills')
        .send({
          userId,
          add: [{ category: 'domains', term: 'HealthTech' }],
          remove: [{ category: 'domains', term: 'FinTech' }],
        });

      expect(res.status).toBe(200);
      expect(typeof res.body.totalTerms).toBe('number');
    });

    it('works with empty add and remove arrays', async () => {
      const res = await request(app)
        .post('/api/setup/skills')
        .send({ userId, add: [], remove: [] });

      expect(res.status).toBe(200);
      expect(typeof res.body.totalTerms).toBe('number');
    });
  });

  // ── POST /setup/profile ───────────────────────────────────────
  describe('POST /api/setup/profile', () => {
    let userId: number;
    let profileId: number;

    beforeAll(async () => {
      const userRes = await request(app)
        .post('/api/setup/user')
        .send({ name: 'Profile Tester' });
      userId = userRes.body.userId;

      const archetypeRes = await request(app)
        .post('/api/setup/archetype')
        .send({ archetype: 'pm-tpm', userId });
      profileId = archetypeRes.body.profileId;
    });

    it('auto-generates searchQueries from targetTitles and synonyms', async () => {
      const res = await request(app)
        .post('/api/setup/profile')
        .send({
          profileId,
          targetTitles: ['Product Manager', 'Technical Program Manager'],
          titleSynonyms: { 'Product Manager': ['PM', 'Group PM'] },
          excludeTitles: ['Junior PM'],
          targetLocations: ['San Francisco', 'Remote'],
        });

      expect(res.status).toBe(200);
      expect(res.body.profileId).toBe(profileId);
      expect(res.body.generatedQueries).toBeDefined();
      expect(Array.isArray(res.body.generatedQueries)).toBe(true);
      // Should include titles and synonyms combined
      expect(res.body.generatedQueries).toContain('Product Manager');
      expect(res.body.generatedQueries).toContain('Technical Program Manager');
      expect(res.body.generatedQueries).toContain('PM');
      expect(res.body.generatedQueries).toContain('Group PM');
    });

    it('does not duplicate queries when synonyms overlap with titles', async () => {
      const res = await request(app)
        .post('/api/setup/profile')
        .send({
          profileId,
          targetTitles: ['PM'],
          titleSynonyms: { 'Product Manager': ['PM', 'Group PM'] },
        });

      expect(res.status).toBe(200);
      // "PM" should only appear once (Set deduplication)
      const pmCount = res.body.generatedQueries.filter((q: string) => q === 'PM').length;
      expect(pmCount).toBe(1);
    });

    it('uses provided searchQueries when explicitly given', async () => {
      const customQueries = ['Custom Query 1', 'Custom Query 2'];
      const res = await request(app)
        .post('/api/setup/profile')
        .send({
          profileId,
          targetTitles: ['Product Manager'],
          titleSynonyms: {},
          searchQueries: customQueries,
        });

      expect(res.status).toBe(200);
      expect(res.body.generatedQueries).toEqual(customQueries);
    });
  });

  // ── POST /setup/companies ─────────────────────────────────────
  describe('POST /api/setup/companies', () => {
    it('loads seed companies and returns counts', async () => {
      const res = await request(app)
        .post('/api/setup/companies')
        .send({});

      expect(res.status).toBe(200);
      expect(typeof res.body.activeCount).toBe('number');
      expect(typeof res.body.totalCount).toBe('number');
      expect(typeof res.body.inserted).toBe('number');
      // Our mock returns 5
      expect(res.body.inserted).toBe(5);
    });

    it('calls loadSeedCompanies', async () => {
      const { loadSeedCompanies } = await import('../../db/bootstrap.js');

      await request(app).post('/api/setup/companies').send({});

      expect(loadSeedCompanies).toHaveBeenCalled();
    });
  });

  // ── POST /setup/complete ──────────────────────────────────────
  describe('POST /api/setup/complete', () => {
    it('returns success: true', async () => {
      const res = await request(app)
        .post('/api/setup/complete')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

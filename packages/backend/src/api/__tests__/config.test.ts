import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../db/schema.js';
import { createQueries } from '../../db/queries.js';
import { createConfigRouter } from '../routes/config.js';
import { errorHandler } from '../middleware/errors.js';
import { userContext } from '../middleware/user-context.js';

// Mock bootstrap (uses global db singleton)
vi.mock('../../db/bootstrap.js', () => ({
  hydrateUserDictionary: vi.fn().mockReturnValue(30),
  loadSeedCompanies: vi.fn().mockReturnValue(0),
}));

// Minimal valid config for reuse across tests
const validConfig = {
  version: 1,
  exportedAt: '2025-01-01T00:00:00.000Z',
  name: 'Test User',
  avatarColor: '#6366f1',
  archetype: 'pm-tpm',
  targetTitles: ['Product Manager'],
  titleSynonyms: { 'Product Manager': ['PM'] },
  excludeTitles: ['Junior PM'],
  targetSkills: ['Roadmap Planning'],
  targetCerts: ['PMP'],
  targetLocations: ['San Francisco'],
  remotePreference: true,
  searchQueries: ['Product Manager', 'PM'],
  weights: {
    freshness: 0.25,
    skill: 0.25,
    title: 0.15,
    cert: 0.10,
    competition: 0.10,
    location: 0.10,
    experience: 0.05,
  },
  analyticTopN: 20,
  aiTopN: 5,
  customDictionary: [{ category: 'tools', term: 'Jira' }],
  customCompanies: [{ name: 'Acme Corp', greenhouseSlug: 'acme' }],
};

describe('Config Export/Import API', () => {
  let app: express.Express;
  let sqlite: InstanceType<typeof Database>;
  let queries: ReturnType<typeof createQueries>;
  let testUserId: number;
  let testProfileId: number;

  beforeAll(() => {
    sqlite = new Database(':memory:');
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: './drizzle' });
    queries = createQueries(db);

    // Seed test user and profile for export tests
    const user = queries.insertUser({ name: 'Export User', avatarColor: '#6366f1' });
    testUserId = user.id;

    const profile = queries.insertProfile({
      name: 'PM Profile',
      archetype: 'pm-tpm',
      targetTitles: JSON.stringify(['Product Manager', 'TPM']),
      targetSkills: JSON.stringify(['Roadmapping']),
      targetCerts: JSON.stringify(['PMP']),
      targetLocations: JSON.stringify(['San Francisco']),
      searchQueries: JSON.stringify(['Product Manager', 'PM']),
      titleSynonyms: JSON.stringify({ 'Product Manager': ['PM'] }),
      excludeTitles: JSON.stringify(['Junior PM']),
      remotePreference: true,
      freshnessWeight: 0.25,
      skillWeight: 0.25,
      titleWeight: 0.15,
      certWeight: 0.10,
      competitionWeight: 0.10,
      locationWeight: 0.10,
      experienceWeight: 0.05,
      userId: testUserId,
    });
    testProfileId = profile.id;

    // Add a manual dictionary term (should appear in export)
    queries.insertDictionaryTerm(testUserId, 'tools', 'Jira', 'manual');
    // Add a template dictionary term (should NOT appear in export customDictionary)
    queries.insertDictionaryTerm(testUserId, 'tools', 'Confluence', 'template');

    // Add a manual company (should appear in export)
    queries.insertCompany({ name: 'Manual Corp', greenhouseSlug: 'manual', source: 'manual', active: true });
    // Add a seed company (should NOT appear in export customCompanies)
    queries.insertCompany({ name: 'Seed Corp', greenhouseSlug: 'seed', source: 'seed', active: true });

    app = express();
    app.use(express.json());
    app.use(userContext);
    app.use('/api/config', createConfigRouter(queries));
    app.use(errorHandler);
  });

  afterAll(() => sqlite.close());

  // ── GET /api/config/export ────────────────────────────────────
  describe('GET /api/config/export', () => {
    it('returns valid JobGridConfig shape', async () => {
      const res = await request(app)
        .get('/api/config/export')
        .set('x-user-id', String(testUserId));

      expect(res.status).toBe(200);
      const body = res.body;

      // Required top-level fields
      expect(body.version).toBe(1);
      expect(typeof body.exportedAt).toBe('string');
      expect(body.name).toBe('Export User');
      expect(body.avatarColor).toBe('#6366f1');
      expect(body.archetype).toBe('pm-tpm');
      expect(Array.isArray(body.targetTitles)).toBe(true);
      expect(Array.isArray(body.targetSkills)).toBe(true);
      expect(Array.isArray(body.targetCerts)).toBe(true);
      expect(Array.isArray(body.targetLocations)).toBe(true);
      expect(Array.isArray(body.searchQueries)).toBe(true);
      expect(Array.isArray(body.excludeTitles)).toBe(true);
      expect(typeof body.titleSynonyms).toBe('object');
      expect(typeof body.remotePreference).toBe('boolean');
      expect(typeof body.weights).toBe('object');
      expect(Array.isArray(body.customDictionary)).toBe(true);
      expect(Array.isArray(body.customCompanies)).toBe(true);
    });

    it('weights object contains all required keys', async () => {
      const res = await request(app)
        .get('/api/config/export')
        .set('x-user-id', String(testUserId));

      expect(res.status).toBe(200);
      const w = res.body.weights;
      expect(typeof w.freshness).toBe('number');
      expect(typeof w.skill).toBe('number');
      expect(typeof w.title).toBe('number');
      expect(typeof w.cert).toBe('number');
      expect(typeof w.competition).toBe('number');
      expect(typeof w.location).toBe('number');
      expect(typeof w.experience).toBe('number');
    });

    it('does NOT include resume text or API keys', async () => {
      const res = await request(app)
        .get('/api/config/export')
        .set('x-user-id', String(testUserId));

      expect(res.status).toBe(200);
      const body = res.body;

      // These fields must be absent
      expect(body.resumeText).toBeUndefined();
      expect(body.rawText).toBeUndefined();
      expect(body.apiKey).toBeUndefined();
      expect(body.groqApiKey).toBeUndefined();
      expect(body.password).toBeUndefined();
      expect(body.token).toBeUndefined();
    });

    it('customDictionary only contains manual-source terms', async () => {
      const res = await request(app)
        .get('/api/config/export')
        .set('x-user-id', String(testUserId));

      expect(res.status).toBe(200);
      const { customDictionary } = res.body;

      // 'Jira' (manual) should be present
      expect(customDictionary.some((t: any) => t.term === 'Jira')).toBe(true);
      // 'Confluence' (template) should NOT be present
      expect(customDictionary.some((t: any) => t.term === 'Confluence')).toBe(false);
    });

    it('customCompanies only contains manual-source companies', async () => {
      const res = await request(app)
        .get('/api/config/export')
        .set('x-user-id', String(testUserId));

      expect(res.status).toBe(200);
      const { customCompanies } = res.body;

      // 'Manual Corp' (manual) should be present
      expect(customCompanies.some((c: any) => c.name === 'Manual Corp')).toBe(true);
      // 'Seed Corp' (seed) should NOT be present
      expect(customCompanies.some((c: any) => c.name === 'Seed Corp')).toBe(false);
    });

    it('returns 404 when user does not exist', async () => {
      const res = await request(app)
        .get('/api/config/export')
        .set('x-user-id', '9999');

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/user not found/i);
    });

    it('sets Content-Disposition for file download', async () => {
      const res = await request(app)
        .get('/api/config/export')
        .set('x-user-id', String(testUserId));

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain('jobgrid-config.json');
    });
  });

  // ── POST /api/config/import ───────────────────────────────────
  describe('POST /api/config/import', () => {
    it('validates a valid config and returns preview', async () => {
      const res = await request(app)
        .post('/api/config/import')
        .send(validConfig);

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.name).toBe('Test User');
      expect(res.body.archetype).toBe('pm-tpm');
      expect(typeof res.body.targetTitlesCount).toBe('number');
      expect(typeof res.body.targetSkillsCount).toBe('number');
      expect(typeof res.body.searchQueriesCount).toBe('number');
      expect(typeof res.body.customDictionaryCount).toBe('number');
      expect(typeof res.body.customCompaniesCount).toBe('number');
    });

    it('rejects invalid config — missing required field (version)', async () => {
      const { version: _omit, ...noVersion } = validConfig as any;
      const res = await request(app)
        .post('/api/config/import')
        .send(noVersion);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid config/i);
      expect(res.body.details).toBeDefined();
    });

    it('rejects invalid config — wrong version number', async () => {
      const res = await request(app)
        .post('/api/config/import')
        .send({ ...validConfig, version: 99 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid config/i);
    });

    it('rejects invalid config — weights missing a field', async () => {
      const { experience: _omit, ...partialWeights } = validConfig.weights as any;
      const res = await request(app)
        .post('/api/config/import')
        .send({ ...validConfig, weights: partialWeights });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid config/i);
    });

    it('rejects invalid config — targetTitles not an array', async () => {
      const res = await request(app)
        .post('/api/config/import')
        .send({ ...validConfig, targetTitles: 'not-an-array' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid config/i);
    });

    it('rejects empty body', async () => {
      const res = await request(app)
        .post('/api/config/import')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid config/i);
    });

    it('returns the parsed config in the preview response', async () => {
      const res = await request(app)
        .post('/api/config/import')
        .send(validConfig);

      expect(res.status).toBe(200);
      expect(res.body.config).toBeDefined();
      expect(res.body.config.version).toBe(1);
      expect(res.body.config.name).toBe('Test User');
    });
  });

  // ── POST /api/config/import/confirm ──────────────────────────
  describe('POST /api/config/import/confirm', () => {
    it('creates user and profile from valid config', async () => {
      const res = await request(app)
        .post('/api/config/import/confirm')
        .send({ ...validConfig, name: 'Imported User' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.userId).toBe('number');
      expect(typeof res.body.profileId).toBe('number');
    });

    it('returns customDictionaryCount matching the import', async () => {
      const res = await request(app)
        .post('/api/config/import/confirm')
        .send({
          ...validConfig,
          name: 'Dict Tester',
          customDictionary: [
            { category: 'tools', term: 'Asana' },
            { category: 'tools', term: 'Notion' },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.customDictionaryCount).toBe(2);
    });

    it('inserts custom companies and returns companiesInserted count', async () => {
      const res = await request(app)
        .post('/api/config/import/confirm')
        .send({
          ...validConfig,
          name: 'Company Tester',
          customCompanies: [
            { name: 'ImportCo A', greenhouseSlug: 'importco-a' },
            { name: 'ImportCo B', leverSlug: 'importco-b' },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.companiesInserted).toBe(2);
    });

    it('hydrates archetype template dictionary when archetype is provided', async () => {
      const { hydrateUserDictionary } = await import('../../db/bootstrap.js');
      vi.mocked(hydrateUserDictionary).mockClear();

      const res = await request(app)
        .post('/api/config/import/confirm')
        .send({ ...validConfig, name: 'Hydrate Tester', archetype: 'pm-tpm' });

      expect(res.status).toBe(201);
      expect(hydrateUserDictionary).toHaveBeenCalledWith(
        res.body.userId,
        'pm-tpm',
      );
      // templateTermCount comes from the mock return value (30)
      expect(res.body.templateTermCount).toBe(30);
    });

    it('rejects invalid config with 400', async () => {
      const res = await request(app)
        .post('/api/config/import/confirm')
        .send({ name: 'Bad Config' }); // missing required fields

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid config/i);
    });

    it('created user persists in the database', async () => {
      const res = await request(app)
        .post('/api/config/import/confirm')
        .send({ ...validConfig, name: 'Persist Check User' });

      expect(res.status).toBe(201);
      const createdUser = queries.getUserById(res.body.userId);
      expect(createdUser).not.toBeNull();
      expect(createdUser!.name).toBe('Persist Check User');
    });

    it('created profile persists in the database with correct data', async () => {
      const res = await request(app)
        .post('/api/config/import/confirm')
        .send({
          ...validConfig,
          name: 'Profile Persist Tester',
          targetTitles: ['Engineering Manager'],
          searchQueries: ['Engineering Manager', 'EM'],
        });

      expect(res.status).toBe(201);
      const profile = queries.getProfileById(res.body.profileId);
      expect(profile).not.toBeNull();
      const titles = JSON.parse(profile!.targetTitles ?? '[]');
      expect(titles).toContain('Engineering Manager');
    });
  });
});

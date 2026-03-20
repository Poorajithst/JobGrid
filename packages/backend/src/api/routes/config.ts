import { Router } from 'express';
import { z } from 'zod';
import { hydrateUserDictionary } from '../../db/bootstrap.js';
import type { createQueries } from '../../db/queries.js';

const JobGridConfigSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().optional(),
  name: z.string(),
  avatarColor: z.string(),
  archetype: z.string(),
  targetTitles: z.array(z.string()),
  titleSynonyms: z.record(z.array(z.string())),
  excludeTitles: z.array(z.string()),
  targetSkills: z.array(z.string()),
  targetCerts: z.array(z.string()),
  targetLocations: z.array(z.string()),
  remotePreference: z.boolean(),
  searchQueries: z.array(z.string()),
  weights: z.object({
    freshness: z.number(),
    skill: z.number(),
    title: z.number(),
    cert: z.number(),
    competition: z.number(),
    location: z.number(),
    experience: z.number(),
  }),
  analyticTopN: z.number(),
  aiTopN: z.number(),
  customDictionary: z.array(z.object({ category: z.string(), term: z.string() })),
  customCompanies: z.array(z.object({
    name: z.string(),
    greenhouseSlug: z.string().optional(),
    leverSlug: z.string().optional(),
    ashbySlug: z.string().optional(),
  })),
});

type JobGridConfig = z.infer<typeof JobGridConfigSchema>;

export function createConfigRouter(queries: ReturnType<typeof createQueries>) {
  const router = Router();

  // GET /api/config/export — build and return JobGridConfig JSON
  router.get('/export', (req, res, next) => {
    try {
      const userId = req.userId;

      // Get user
      const user = queries.getUserById(userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Get active profile for this user
      const profiles = queries.getActiveProfilesByUser(userId);
      const profile = profiles[0] ?? queries.getProfilesByUser(userId)[0];

      if (!profile) {
        res.status(404).json({ error: 'No profile found for user' });
        return;
      }

      // Get non-template (manual) dictionary terms
      const allTerms = queries.getDictionaryTermsByUser(userId);
      const customDictionary = allTerms
        .filter((t) => t.source === 'manual')
        .map((t) => ({ category: t.category, term: t.term }));

      // Get manual-source companies
      const allCompanies = queries.getCompanies();
      const customCompanies = allCompanies
        .filter((c) => c.source === 'manual')
        .map((c) => ({
          name: c.name,
          ...(c.greenhouseSlug ? { greenhouseSlug: c.greenhouseSlug } : {}),
          ...(c.leverSlug ? { leverSlug: c.leverSlug } : {}),
          ...(c.ashbySlug ? { ashbySlug: c.ashbySlug } : {}),
        }));

      const config: JobGridConfig = {
        version: 1,
        exportedAt: new Date().toISOString(),
        name: user.name,
        avatarColor: user.avatarColor ?? '#6366f1',
        archetype: profile.archetype ?? '',
        targetTitles: profile.targetTitles ? JSON.parse(profile.targetTitles) : [],
        titleSynonyms: profile.titleSynonyms ? JSON.parse(profile.titleSynonyms) : {},
        excludeTitles: profile.excludeTitles ? JSON.parse(profile.excludeTitles) : [],
        targetSkills: profile.targetSkills ? JSON.parse(profile.targetSkills) : [],
        targetCerts: profile.targetCerts ? JSON.parse(profile.targetCerts) : [],
        targetLocations: profile.targetLocations ? JSON.parse(profile.targetLocations) : [],
        remotePreference: profile.remotePreference ?? false,
        searchQueries: profile.searchQueries ? JSON.parse(profile.searchQueries) : [],
        weights: {
          freshness: profile.freshnessWeight,
          skill: profile.skillWeight,
          title: profile.titleWeight,
          cert: profile.certWeight,
          competition: profile.competitionWeight,
          location: profile.locationWeight,
          experience: profile.experienceWeight,
        },
        analyticTopN: profile.analyticTopN,
        aiTopN: profile.aiTopN,
        customDictionary,
        customCompanies,
      };

      res.setHeader('Content-Disposition', 'attachment; filename="jobgrid-config.json"');
      res.setHeader('Content-Type', 'application/json');
      res.json(config);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/config/import — validate JSON with Zod, return preview
  router.post('/import', (req, res, next) => {
    try {
      const result = JobGridConfigSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          error: 'Invalid config format',
          details: result.error.flatten(),
        });
        return;
      }

      const config = result.data;

      // Build a preview summary
      const preview = {
        valid: true,
        name: config.name,
        archetype: config.archetype,
        targetTitlesCount: config.targetTitles.length,
        targetSkillsCount: config.targetSkills.length,
        targetCertsCount: config.targetCerts.length,
        searchQueriesCount: config.searchQueries.length,
        customDictionaryCount: config.customDictionary.length,
        customCompaniesCount: config.customCompanies.length,
        config,
      };

      res.json(preview);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/config/import/confirm — create user, profile, dictionary, companies
  router.post('/import/confirm', (req, res, next) => {
    try {
      const result = JobGridConfigSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          error: 'Invalid config format',
          details: result.error.flatten(),
        });
        return;
      }

      const config = result.data;

      // 1. Create user
      const user = queries.insertUser({
        name: config.name,
        avatarColor: config.avatarColor,
      });

      // 2. Hydrate archetype template dictionary first
      let templateTermCount = 0;
      if (config.archetype) {
        try {
          templateTermCount = hydrateUserDictionary(user.id, config.archetype);
        } catch {
          // If archetype template not found, skip silently
        }
      }

      // 3. Merge custom dictionary terms on top with source='manual'
      for (const { category, term } of config.customDictionary) {
        queries.insertDictionaryTerm(user.id, category, term, 'manual');
      }

      // 4. Create profile
      const profile = queries.insertProfile({
        name: config.name,
        targetTitles: JSON.stringify(config.targetTitles),
        targetSkills: JSON.stringify(config.targetSkills),
        targetCerts: JSON.stringify(config.targetCerts),
        targetLocations: JSON.stringify(config.targetLocations),
        searchQueries: JSON.stringify(config.searchQueries),
        titleSynonyms: JSON.stringify(config.titleSynonyms),
        archetype: config.archetype,
        excludeTitles: JSON.stringify(config.excludeTitles),
        remotePreference: config.remotePreference,
        freshnessWeight: config.weights.freshness,
        skillWeight: config.weights.skill,
        titleWeight: config.weights.title,
        certWeight: config.weights.cert,
        competitionWeight: config.weights.competition,
        locationWeight: config.weights.location,
        experienceWeight: config.weights.experience,
        userId: user.id,
      });

      // Update analyticTopN and aiTopN separately since insertProfile may not accept them
      queries.updateProfile(profile.id, {
        analyticTopN: config.analyticTopN,
        aiTopN: config.aiTopN,
      });

      // 5. Insert custom companies
      const insertedCompanies: string[] = [];
      for (const company of config.customCompanies) {
        try {
          queries.insertCompany({
            name: company.name,
            greenhouseSlug: company.greenhouseSlug ?? null,
            leverSlug: company.leverSlug ?? null,
            ashbySlug: company.ashbySlug ?? null,
            source: 'manual',
            active: true,
          });
          insertedCompanies.push(company.name);
        } catch {
          // Skip duplicates
        }
      }

      res.status(201).json({
        success: true,
        userId: user.id,
        profileId: profile.id,
        templateTermCount,
        customDictionaryCount: config.customDictionary.length,
        companiesInserted: insertedCompanies.length,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

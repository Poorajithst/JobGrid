import { Router } from 'express';
import { CreateProfileSchema, UpdateProfileSchema } from '../schemas.js';
import type { createQueries } from '../../db/queries.js';

export function createProfilesRouter(queries: ReturnType<typeof createQueries>) {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(queries.getProfilesByUser(req.userId));
  });

  router.get('/:id', (req, res) => {
    const profile = queries.getProfileById(parseInt(req.params.id, 10));
    if (!profile) { res.status(404).json({ error: 'Profile not found' }); return; }
    res.json(profile);
  });

  router.post('/', (req, res, next) => {
    try {
      const parsed = CreateProfileSchema.parse(req.body);
      const profile = queries.insertProfile({
        name: parsed.name,
        targetTitles: JSON.stringify(parsed.targetTitles),
        targetSkills: JSON.stringify(parsed.targetSkills),
        targetCerts: parsed.targetCerts ? JSON.stringify(parsed.targetCerts) : null,
        targetLocations: parsed.targetLocations ? JSON.stringify(parsed.targetLocations) : null,
        searchQueries: parsed.searchQueries ? JSON.stringify(parsed.searchQueries) : null,
        titleSynonyms: parsed.titleSynonyms ? JSON.stringify(parsed.titleSynonyms) : null,
        userId: req.userId,
      });
      res.status(201).json(profile);
    } catch (err) { next(err); }
  });

  router.patch('/:id', (req, res, next) => {
    try {
      const parsed = UpdateProfileSchema.parse(req.body);
      const id = parseInt(req.params.id, 10);
      const updates: Record<string, any> = {};

      if (parsed.name) updates.name = parsed.name;
      if (parsed.targetTitles) updates.targetTitles = JSON.stringify(parsed.targetTitles);
      if (parsed.targetSkills) updates.targetSkills = JSON.stringify(parsed.targetSkills);
      if (parsed.targetCerts !== undefined) updates.targetCerts = parsed.targetCerts ? JSON.stringify(parsed.targetCerts) : null;
      if (parsed.targetLocations !== undefined) updates.targetLocations = parsed.targetLocations ? JSON.stringify(parsed.targetLocations) : null;
      if (parsed.searchQueries !== undefined) updates.searchQueries = parsed.searchQueries ? JSON.stringify(parsed.searchQueries) : null;
      if (parsed.titleSynonyms !== undefined) updates.titleSynonyms = parsed.titleSynonyms ? JSON.stringify(parsed.titleSynonyms) : null;
      if (parsed.freshnessWeight !== undefined) updates.freshnessWeight = parsed.freshnessWeight;
      if (parsed.skillWeight !== undefined) updates.skillWeight = parsed.skillWeight;
      if (parsed.titleWeight !== undefined) updates.titleWeight = parsed.titleWeight;
      if (parsed.certWeight !== undefined) updates.certWeight = parsed.certWeight;
      if (parsed.competitionWeight !== undefined) updates.competitionWeight = parsed.competitionWeight;
      if (parsed.locationWeight !== undefined) updates.locationWeight = parsed.locationWeight;
      if (parsed.experienceWeight !== undefined) updates.experienceWeight = parsed.experienceWeight;
      if (parsed.analyticTopN !== undefined) updates.analyticTopN = parsed.analyticTopN;
      if (parsed.aiTopN !== undefined) updates.aiTopN = parsed.aiTopN;
      if (parsed.isActive !== undefined) updates.isActive = parsed.isActive;

      // If only weights changed, recalculate IPE scores without full re-score
      const weightKeys = ['freshnessWeight', 'skillWeight', 'titleWeight', 'certWeight', 'competitionWeight', 'locationWeight', 'experienceWeight'];
      const onlyWeightsChanged = Object.keys(updates).every(k => weightKeys.includes(k) || k === 'updatedAt');

      queries.updateProfile(id, updates);

      if (onlyWeightsChanged && weightKeys.some(k => k in updates)) {
        const profile = queries.getProfileById(id);
        if (profile) {
          queries.recalculateIpeScores(id, {
            freshness: profile.freshnessWeight,
            skill: profile.skillWeight,
            title: profile.titleWeight,
            cert: profile.certWeight,
            competition: profile.competitionWeight,
            location: profile.locationWeight,
            experience: profile.experienceWeight,
          });
        }
      }

      res.json(queries.getProfileById(id));
    } catch (err) { next(err); }
  });

  router.delete('/:id', (req, res) => {
    queries.deleteProfile(parseInt(req.params.id, 10));
    res.json({ message: 'Profile and associated scores deleted' });
  });

  // Auto-populate from documents
  router.post('/:id/auto-populate', (req, res) => {
    const merged = queries.getMergedProfileByUser(req.userId);
    const id = parseInt(req.params.id, 10);
    queries.updateProfile(id, {
      targetSkills: JSON.stringify(merged.skills),
      targetCerts: JSON.stringify(merged.certs),
      targetLocations: JSON.stringify(merged.locations),
    });
    res.json({ message: 'Profile auto-populated from documents', merged });
  });

  return router;
}

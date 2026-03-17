import { Router } from 'express';
import { calculateIpeScore, type ProfileConfig, type JobData } from '../../ipe/index.js';
import type { createQueries } from '../../db/queries.js';

export function createScoreRouter(queries: ReturnType<typeof createQueries>) {
  const router = Router();

  // POST /api/score/ipe/:profileId — run IPE scoring
  router.post('/ipe/:profileId', async (req, res, next) => {
    try {
      const profileId = parseInt(req.params.profileId, 10);
      const profile = queries.getProfileById(profileId);
      if (!profile) { res.status(404).json({ error: 'Profile not found' }); return; }

      const config: ProfileConfig = {
        targetTitles: JSON.parse(profile.targetTitles),
        targetSkills: JSON.parse(profile.targetSkills),
        targetCerts: profile.targetCerts ? JSON.parse(profile.targetCerts) : [],
        targetLocations: profile.targetLocations ? JSON.parse(profile.targetLocations) : [],
        experienceYears: profile.minExperienceYears || 0,
        titleSynonyms: profile.titleSynonyms ? JSON.parse(profile.titleSynonyms) : {},
        weights: {
          freshness: profile.freshnessWeight,
          skill: profile.skillWeight,
          title: profile.titleWeight,
          cert: profile.certWeight,
          competition: profile.competitionWeight,
          location: profile.locationWeight,
          experience: profile.experienceWeight,
        },
      };

      // Get unscored job IDs
      const unscoredIds = queries.getUnscoredJobIds(profileId);
      let scored = 0;

      for (const jobId of unscoredIds) {
        const job = queries.getJobById(jobId);
        if (!job) continue;

        const jobData: JobData = {
          title: job.title,
          description: job.description,
          location: job.location,
          postedAt: job.postedAt,
          applicants: job.applicants,
        };

        const result = calculateIpeScore(config, jobData);

        queries.upsertJobScore({
          jobId,
          profileId,
          ipeScore: result.ipeScore,
          freshnessScore: result.dimensions.freshnessScore,
          skillMatchScore: result.dimensions.skillMatchScore,
          titleAlignmentScore: result.dimensions.titleAlignmentScore,
          certMatchScore: result.dimensions.certMatchScore,
          competitionScore: result.dimensions.competitionScore,
          locationMatchScore: result.dimensions.locationMatchScore,
          experienceAlignScore: result.dimensions.experienceAlignScore,
          matchedSkills: JSON.stringify(result.matchedSkills),
        });

        scored++;
      }

      res.json({ scored, total: unscoredIds.length });
    } catch (err) { next(err); }
  });

  // POST /api/score/ai/:profileId — AI validate top matches
  router.post('/ai/:profileId', async (req, res, next) => {
    try {
      const profileId = parseInt(req.params.profileId, 10);
      const profile = queries.getProfileById(profileId);
      if (!profile) { res.status(404).json({ error: 'Profile not found' }); return; }

      const topScores = queries.getTopUnvalidatedScores(profileId, profile.aiThreshold);
      // AI validation will be wired in Chunk 5 integration
      res.json({ eligible: topScores.length, message: 'AI validation placeholder — will be wired in integration step' });
    } catch (err) { next(err); }
  });

  // POST /api/score/all/:profileId — IPE + AI
  router.post('/all/:profileId', async (req, res, next) => {
    try {
      // First run IPE
      const ipeRes = await fetch(`http://localhost:${process.env.PORT || 3001}/api/score/ipe/${req.params.profileId}`, { method: 'POST' });
      const ipeData = await ipeRes.json();

      // Then run AI
      const aiRes = await fetch(`http://localhost:${process.env.PORT || 3001}/api/score/ai/${req.params.profileId}`, { method: 'POST' });
      const aiData = await aiRes.json();

      res.json({ ipe: ipeData, ai: aiData });
    } catch (err) { next(err); }
  });

  return router;
}

import { Router } from 'express';
import { calculateIpeScore, type ProfileConfig, type JobData } from '../../ipe/index.js';
import { validateJobAi } from '../../scorer/groq.js';
import { computeProfileHash } from '../../scorer/profile-hash.js';
import type { DynamicProfile } from '../../scorer/prompts.js';
import type { createQueries } from '../../db/queries.js';

function buildDynamicProfile(
  profile: { name: string; targetTitles: string; targetSkills: string; targetCerts: string | null; targetLocations: string | null; minExperienceYears: number | null },
  resumeTexts: string[]
): DynamicProfile {
  return {
    name: profile.name,
    resumeText: resumeTexts.join('\n\n'),
    targetTitles: JSON.parse(profile.targetTitles),
    targetSkills: JSON.parse(profile.targetSkills),
    targetCerts: profile.targetCerts ? JSON.parse(profile.targetCerts) : [],
    targetLocations: profile.targetLocations ? JSON.parse(profile.targetLocations) : [],
    experienceYears: profile.minExperienceYears || 0,
  };
}

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

      // Get job IDs to score (force=true re-scores everything)
      const force = req.query.force === 'true';
      let jobIds: number[];
      if (force) {
        const allJobs = queries.getJobs({ page: 1, limit: 10000 });
        // getJobs may return { jobs: [...] } or just [...]
        const jobsArr = Array.isArray(allJobs) ? allJobs : (allJobs as any).jobs || [];
        jobIds = jobsArr.map((j: any) => j.id);
      } else {
        jobIds = queries.getUnscoredJobIds(profileId);
      }
      let scored = 0;

      for (const jobId of jobIds) {
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

      res.json({ scored, total: jobIds.length });
    } catch (err) { next(err); }
  });

  // POST /api/score/ai/:profileId — AI validate top matches
  router.post('/ai/:profileId', async (req, res, next) => {
    try {
      const profileId = parseInt(req.params.profileId, 10);
      const profile = queries.getProfileById(profileId);
      if (!profile) { res.status(404).json({ error: 'Profile not found' }); return; }

      // Get user's documents for resume text
      const userId = profile.userId;
      const documents = userId ? queries.getDocumentsByUser(userId) : [];
      const resumeTexts = documents
        .filter((d: any) => d.type === 'resume')
        .map((d: any) => d.parsedText || '')
        .filter((t: string) => t.length > 0);

      // Compute profile hash and check for changes
      const targetSkills = JSON.parse(profile.targetSkills);
      const targetCerts = profile.targetCerts ? JSON.parse(profile.targetCerts) : [];
      const targetTitles = JSON.parse(profile.targetTitles);

      const currentHash = computeProfileHash(resumeTexts, { targetSkills, targetCerts, targetTitles });

      if (profile.profileHash && profile.profileHash !== currentHash) {
        // Profile changed — clear all AI validations for this profile
        queries.clearAiValidation(profileId);
      }

      // Update the stored hash
      queries.updateProfile(profileId, { profileHash: currentHash });

      // Build dynamic profile for AI prompts
      const dynamicProfile = buildDynamicProfile(profile, resumeTexts);

      // Get top unvalidated jobs (using analyticTopN as limit)
      const topScores = queries.getTopUnvalidatedScores(profileId, 0);
      const limit = profile.analyticTopN || 35;
      const toValidate = topScores.slice(0, limit);

      let validated = 0;

      for (const score of toValidate) {
        const job = queries.getJobById(score.jobId);
        if (!job) continue;

        const ipeBreakdown = {
          ipeScore: score.ipeScore,
          skillMatch: score.skillMatchScore,
          titleAlign: score.titleAlignmentScore,
          freshness: score.freshnessScore,
          competition: score.competitionScore,
          location: score.locationMatchScore,
          certs: score.certMatchScore,
          experience: score.experienceAlignScore,
          matchedSkills: score.matchedSkills ? JSON.parse(score.matchedSkills) : [],
        };

        const aiResult = await validateJobAi(job, ipeBreakdown, dynamicProfile);

        if (aiResult) {
          queries.updateJobScoreAi(score.id, {
            aiValidated: true,
            aiAgrees: aiResult.agrees,
            aiPitch: aiResult.pitch,
            aiFlags: aiResult.flags,
            aiFitAssessment: aiResult.fit_assessment,
          });
          validated++;
        } else {
          // Mark as validated even on failure so we don't retry endlessly
          queries.updateJobScoreAi(score.id, {
            aiValidated: true,
            aiAgrees: null,
            aiPitch: null,
            aiFlags: 'AI validation failed',
            aiFitAssessment: null,
          });
          validated++;
        }
      }

      res.json({ validated, eligible: topScores.length });
    } catch (err) { next(err); }
  });

  // POST /api/score/ai/:profileId/:jobId — single job AI validation
  router.post('/ai/:profileId/:jobId', async (req, res, next) => {
    try {
      const profileId = parseInt(req.params.profileId, 10);
      const jobId = parseInt(req.params.jobId, 10);

      const profile = queries.getProfileById(profileId);
      if (!profile) { res.status(404).json({ error: 'Profile not found' }); return; }

      const job = queries.getJobById(jobId);
      if (!job) { res.status(404).json({ error: 'Job not found' }); return; }

      const score = queries.getJobScore(jobId, profileId);
      if (!score) { res.status(404).json({ error: 'No IPE score found — run IPE scoring first' }); return; }

      // Get user's documents for resume text
      const userId = profile.userId;
      const documents = userId ? queries.getDocumentsByUser(userId) : [];
      const resumeTexts = documents
        .filter((d: any) => d.type === 'resume')
        .map((d: any) => d.parsedText || '')
        .filter((t: string) => t.length > 0);

      const dynamicProfile = buildDynamicProfile(profile, resumeTexts);

      const ipeBreakdown = {
        ipeScore: score.ipeScore,
        skillMatch: score.skillMatchScore,
        titleAlign: score.titleAlignmentScore,
        freshness: score.freshnessScore,
        competition: score.competitionScore,
        location: score.locationMatchScore,
        certs: score.certMatchScore,
        experience: score.experienceAlignScore,
        matchedSkills: score.matchedSkills ? JSON.parse(score.matchedSkills) : [],
      };

      const aiResult = await validateJobAi(job, ipeBreakdown, dynamicProfile);

      if (aiResult) {
        queries.updateJobScoreAi(score.id, {
          aiValidated: true,
          aiAgrees: aiResult.agrees,
          aiPitch: aiResult.pitch,
          aiFlags: aiResult.flags,
          aiFitAssessment: aiResult.fit_assessment,
        });
        res.json({ success: true, result: aiResult });
      } else {
        queries.updateJobScoreAi(score.id, {
          aiValidated: true,
          aiAgrees: null,
          aiPitch: null,
          aiFlags: 'AI validation failed',
          aiFitAssessment: null,
        });
        res.json({ success: false, error: 'AI validation returned no result' });
      }
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

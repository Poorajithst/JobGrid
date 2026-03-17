import { Router } from 'express';
import Groq from 'groq-sdk';
import { OutreachRequestSchema } from '../schemas.js';
import { buildOutreachPrompt, type DynamicProfile } from '../../scorer/prompts.js';
import type { createQueries } from '../../db/queries.js';

let _client: Groq | null = null;
function getClient() {
  if (!_client) _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _client;
}

export function createOutreachRouter(queries: ReturnType<typeof createQueries>) {
  const router = Router();

  // POST /api/outreach/:id
  router.post('/:id', async (req, res, next) => {
    try {
      const parsed = OutreachRequestSchema.parse(req.body);
      const job = queries.getJobById(parseInt(req.params.id, 10));
      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      // Build a dynamic profile from available data
      // If profileId is provided in the body, use it; otherwise build a minimal profile
      let dynamicProfile: DynamicProfile = {
        name: '',
        resumeText: '',
        targetTitles: [],
        targetSkills: [],
        targetCerts: [],
        targetLocations: [],
        experienceYears: 0,
      };

      if (parsed.profileId) {
        const profile = queries.getProfileById(parsed.profileId);
        if (profile) {
          const userId = profile.userId;
          const documents = userId ? queries.getDocumentsByUser(userId) : [];
          const resumeTexts = documents
            .filter((d: any) => d.type === 'resume')
            .map((d: any) => d.parsedText || '')
            .filter((t: string) => t.length > 0);

          dynamicProfile = {
            name: profile.name,
            resumeText: resumeTexts.join('\n\n'),
            targetTitles: JSON.parse(profile.targetTitles),
            targetSkills: JSON.parse(profile.targetSkills),
            targetCerts: profile.targetCerts ? JSON.parse(profile.targetCerts) : [],
            targetLocations: profile.targetLocations ? JSON.parse(profile.targetLocations) : [],
            experienceYears: profile.minExperienceYears || 0,
          };
        }
      }

      const prompt = buildOutreachPrompt({
        title: job.title,
        company: job.company,
        pitch: job.pitch || '',
        type: parsed.type,
      }, dynamicProfile);

      const response = await getClient().chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
      });

      const content = response.choices[0]?.message?.content ?? '';
      queries.insertOutreach({
        jobId: job.id,
        type: parsed.type,
        content,
        userId: req.userId,
      });

      const allDrafts = queries.getOutreachByJobIdAndUser(job.id, req.userId);
      res.json({ content, history: allDrafts });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

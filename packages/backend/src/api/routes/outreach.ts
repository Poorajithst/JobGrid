import { Router } from 'express';
import Groq from 'groq-sdk';
import { OutreachRequestSchema } from '../schemas.js';
import { buildOutreachPrompt } from '../../scorer/prompts.js';
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

      const prompt = buildOutreachPrompt({
        title: job.title,
        company: job.company,
        pitch: job.pitch || '',
        type: parsed.type,
      });

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

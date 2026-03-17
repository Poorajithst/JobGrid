import Groq from 'groq-sdk';
import {
  buildScoringPrompt,
  buildAiValidationPrompt,
  ScoreResponseSchema,
  AiValidationResponseSchema,
  type ScoreResponse,
  type AiValidationResponse,
  type DynamicProfile,
} from './prompts.js';

let _client: Groq | null = null;
function getClient(): Groq {
  if (!_client) {
    _client = new Groq({ apiKey: process.env.GROQ_API_KEY || 'missing' });
  }
  return _client;
}

const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 2000;

async function callWithRetry(prompt: string, retries = 0): Promise<string | null> {
  try {
    const response = await getClient().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });
    return response.choices[0]?.message?.content ?? null;
  } catch (err: any) {
    if (err?.status === 429 && retries < MAX_RETRIES) {
      const delay = BACKOFF_BASE_MS * Math.pow(2, retries);
      console.warn(`Groq rate limited. Retrying in ${delay}ms (attempt ${retries + 1}/${MAX_RETRIES})`);
      await new Promise(r => setTimeout(r, delay));
      return callWithRetry(prompt, retries + 1);
    }
    throw err;
  }
}

export async function scoreJob(
  job: { title: string; company: string; source: string; description: string | null },
  profile?: DynamicProfile
): Promise<ScoreResponse | null> {
  if (!profile) return null;

  try {
    const prompt = buildScoringPrompt(job, profile);
    const content = await callWithRetry(prompt);
    if (!content) return null;

    const parsed = JSON.parse(content);
    const validated = ScoreResponseSchema.safeParse(parsed);

    if (!validated.success) {
      console.error(`Groq: Invalid response for "${job.title}" at ${job.company}:`, validated.error.issues);
      return null;
    }

    return validated.data;
  } catch (err) {
    console.error(`Groq: Failed to score "${job.title}" at ${job.company}:`, err);
    return null;
  }
}

export async function validateJobAi(
  job: { title: string; company: string; location: string | null; description: string | null },
  ipeBreakdown: {
    ipeScore: number;
    skillMatch: number;
    titleAlign: number;
    freshness: number;
    competition: number;
    location: number;
    certs: number;
    experience: number;
    matchedSkills: string[];
  },
  profile: DynamicProfile
): Promise<AiValidationResponse | null> {
  try {
    const prompt = buildAiValidationPrompt(job, ipeBreakdown, profile);
    const content = await callWithRetry(prompt);
    if (!content) return null;

    const parsed = JSON.parse(content);
    const validated = AiValidationResponseSchema.safeParse(parsed);

    if (!validated.success) {
      console.error(`Groq: Invalid AI validation response for "${job.title}" at ${job.company}:`, validated.error.issues);
      return null;
    }

    return validated.data;
  } catch (err) {
    console.error(`Groq: Failed AI validation for "${job.title}" at ${job.company}:`, err);
    return null;
  }
}

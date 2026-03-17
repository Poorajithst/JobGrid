import { z } from 'zod';
import { profileToString } from './profile.js';

export const ScoreResponseSchema = z.object({
  fit_score: z.number().min(0).max(100),
  competition: z.enum(['low', 'medium', 'high']),
  recommendation: z.enum(['apply', 'watch', 'skip']),
  score_reason: z.string(),
  pitch: z.string(),
});

export type ScoreResponse = z.infer<typeof ScoreResponseSchema>;

export function buildScoringPrompt(job: {
  title: string;
  company: string;
  source: string;
  description: string | null;
}): string {
  return `You are a PM job fit scorer. Analyze this job against this candidate profile.
Return ONLY valid JSON, no other text.

PROFILE:
${profileToString()}

JOB TITLE: ${job.title}
COMPANY: ${job.company}
SOURCE: ${job.source}
DESCRIPTION: ${job.description || 'No description available'}

Return:
{
  "fit_score": number 0-100,
  "competition": "low" | "medium" | "high",
  "recommendation": "apply" | "watch" | "skip",
  "score_reason": "one sentence explaining the score",
  "pitch": "two sentence outreach hook referencing specific matches"
}`;
}

export function buildOutreachPrompt(input: {
  title: string;
  company: string;
  pitch: string;
  type: 'connection' | 'email' | 'inmail';
  profile?: {
    target_skills: string[];
    target_titles: string[];
    target_certs: string[];
  };
}): string {
  const profileSection = input.profile
    ? `TARGET SKILLS: ${input.profile.target_skills.join(', ')}
TARGET TITLES: ${input.profile.target_titles.join(', ')}
CERTIFICATIONS: ${input.profile.target_certs.join(', ')}`
    : profileToString();

  return `You are a professional outreach message writer.

Write a ${input.type} message for this job application.

CANDIDATE PROFILE:
${profileSection}

JOB: ${input.title} at ${input.company}
SEED PITCH: ${input.pitch}

Write a personalized ${input.type} message that:
- References specific matches between the candidate's experience and the role
- Is concise and professional
- Avoids generic phrases
- For connection requests: 2-3 sentences max
- For emails: subject line + 3-4 paragraph body
- For InMails: 2-3 paragraph body

Return ONLY the message text, no metadata.`;
}

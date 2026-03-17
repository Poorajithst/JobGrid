import { z } from 'zod';

export interface DynamicProfile {
  name: string;
  resumeText: string;
  targetTitles: string[];
  targetSkills: string[];
  targetCerts: string[];
  targetLocations: string[];
  experienceYears: number;
}

function profileToPromptString(profile: DynamicProfile): string {
  return `NAME: ${profile.name}
TARGET ROLES: ${profile.targetTitles.join(', ')}
KEY SKILLS: ${profile.targetSkills.join(', ')}
CERTIFICATIONS: ${profile.targetCerts.join(', ')}
LOCATIONS: ${profile.targetLocations.join(', ')}
EXPERIENCE: ${profile.experienceYears} years
RESUME SUMMARY: ${profile.resumeText.substring(0, 3000)}`;
}

export const ScoreResponseSchema = z.object({
  fit_score: z.number().min(0).max(100),
  competition: z.enum(['low', 'medium', 'high']),
  recommendation: z.enum(['apply', 'watch', 'skip']),
  score_reason: z.string(),
  pitch: z.string(),
});

export type ScoreResponse = z.infer<typeof ScoreResponseSchema>;

export function buildScoringPrompt(
  job: { title: string; company: string; source: string; description: string | null },
  profile: DynamicProfile
): string {
  return `You are a PM job fit scorer. Analyze this job against this candidate profile.
Return ONLY valid JSON, no other text.

PROFILE:
${profileToPromptString(profile)}

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

// AI validation prompt for two-stage funnel
export const AiValidationResponseSchema = z.object({
  agrees: z.boolean(),
  fit_assessment: z.string(),
  pitch: z.string(),
  flags: z.string().nullable(),
});

export type AiValidationResponse = z.infer<typeof AiValidationResponseSchema>;

export function buildAiValidationPrompt(
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
): string {
  return `System: You are a job fit analyzer for a job seeker.

Candidate Profile:
${profileToPromptString(profile)}

Evaluate this job:

Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Not specified'}
Description: ${(job.description || 'No description').substring(0, 2000)}

IPE Score: ${ipeBreakdown.ipeScore}/100
Score Breakdown:
- Skill Match: ${ipeBreakdown.skillMatch} (matched: ${ipeBreakdown.matchedSkills.join(', ')})
- Title Alignment: ${ipeBreakdown.titleAlign}
- Freshness: ${ipeBreakdown.freshness}
- Competition: ${ipeBreakdown.competition}
- Location: ${ipeBreakdown.location}
- Certifications: ${ipeBreakdown.certs}
- Experience: ${ipeBreakdown.experience}

Return JSON only:
{
  "agrees": true/false,
  "fit_assessment": "one paragraph explaining the fit",
  "pitch": "two sentence personalized outreach hook",
  "flags": "any red flags or concerns, or null"
}`;
}

export function buildOutreachPrompt(
  input: { title: string; company: string; pitch: string; type: 'connection' | 'email' | 'inmail' },
  profile: DynamicProfile
): string {
  return `You are a professional outreach message writer.

Write a ${input.type} message for this job application.

CANDIDATE:
${profileToPromptString(profile)}

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

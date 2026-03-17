import { describe, it, expect } from 'vitest';
import { PM_PROFILE } from '../profile.js';
import { buildScoringPrompt, buildOutreachPrompt, ScoreResponseSchema } from '../prompts.js';

describe('PM Profile', () => {
  it('contains required fields', () => {
    expect(PM_PROFILE.role).toContain('Project Manager');
    expect(PM_PROFILE.certifications).toContain('CAPM');
    expect(PM_PROFILE.location).toContain('Worcester');
  });
});

describe('Scoring Prompt', () => {
  it('builds a prompt with job details interpolated', () => {
    const prompt = buildScoringPrompt({
      title: 'PM',
      company: 'TestCo',
      source: 'greenhouse',
      description: 'A PM role',
    });
    expect(prompt).toContain('PM');
    expect(prompt).toContain('TestCo');
    expect(prompt).toContain('CAPM');
  });
});

describe('Outreach Prompt', () => {
  it('builds a prompt for a specific outreach type', () => {
    const prompt = buildOutreachPrompt({
      title: 'PM',
      company: 'TestCo',
      pitch: 'Your AI work matches mine',
      type: 'email',
    });
    expect(prompt).toContain('email');
    expect(prompt).toContain('TestCo');
  });
});

describe('ScoreResponseSchema', () => {
  it('validates correct response', () => {
    const result = ScoreResponseSchema.safeParse({
      fit_score: 85,
      competition: 'low',
      recommendation: 'apply',
      score_reason: 'Great match',
      pitch: 'Your work aligns with mine',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid response', () => {
    const result = ScoreResponseSchema.safeParse({
      fit_score: 'high',
      competition: 'low',
    });
    expect(result.success).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import {
  buildScoringPrompt,
  buildOutreachPrompt,
  buildAiValidationPrompt,
  ScoreResponseSchema,
  AiValidationResponseSchema,
  type DynamicProfile,
} from '../prompts.js';

const mockProfile: DynamicProfile = {
  name: 'Test User',
  resumeText: 'Experienced project manager with infrastructure background.',
  targetTitles: ['Project Manager', 'Program Manager'],
  targetSkills: ['Python', 'SQL', 'Agile'],
  targetCerts: ['CAPM', 'PMI-ACP'],
  targetLocations: ['Worcester MA', 'Remote'],
  experienceYears: 5,
};

describe('Scoring Prompt', () => {
  it('builds a prompt with job details and profile interpolated', () => {
    const prompt = buildScoringPrompt(
      { title: 'PM', company: 'TestCo', source: 'greenhouse', description: 'A PM role' },
      mockProfile
    );
    expect(prompt).toContain('PM');
    expect(prompt).toContain('TestCo');
    expect(prompt).toContain('CAPM');
    expect(prompt).toContain('Test User');
    expect(prompt).toContain('Python');
  });
});

describe('Outreach Prompt', () => {
  it('builds a prompt for a specific outreach type', () => {
    const prompt = buildOutreachPrompt(
      { title: 'PM', company: 'TestCo', pitch: 'Your AI work matches mine', type: 'email' },
      mockProfile
    );
    expect(prompt).toContain('email');
    expect(prompt).toContain('TestCo');
    expect(prompt).toContain('Test User');
  });
});

describe('AI Validation Prompt', () => {
  it('builds an AI validation prompt with IPE breakdown', () => {
    const prompt = buildAiValidationPrompt(
      { title: 'PM', company: 'TestCo', location: 'Remote', description: 'A PM role' },
      {
        ipeScore: 85,
        skillMatch: 20,
        titleAlign: 15,
        freshness: 25,
        competition: 8,
        location: 10,
        certs: 5,
        experience: 4,
        matchedSkills: ['Python', 'SQL'],
      },
      mockProfile
    );
    expect(prompt).toContain('85/100');
    expect(prompt).toContain('Python, SQL');
    expect(prompt).toContain('Test User');
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

describe('AiValidationResponseSchema', () => {
  it('validates correct response', () => {
    const result = AiValidationResponseSchema.safeParse({
      agrees: true,
      fit_assessment: 'Strong fit for PM role.',
      pitch: 'Your infrastructure background is perfect.',
      flags: null,
    });
    expect(result.success).toBe(true);
  });

  it('validates response with flags', () => {
    const result = AiValidationResponseSchema.safeParse({
      agrees: false,
      fit_assessment: 'Weak fit.',
      pitch: 'Consider other roles.',
      flags: 'Requires 10+ years experience.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid response', () => {
    const result = AiValidationResponseSchema.safeParse({
      agrees: 'yes',
    });
    expect(result.success).toBe(false);
  });
});

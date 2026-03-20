import { describe, it, expect } from 'vitest';
import { calculateIpeScore, type ProfileConfig, type JobData } from '../index.js';

const mockProfile: ProfileConfig = {
  targetTitles: ['Project Manager'],
  targetSkills: ['agile', 'python', 'sql', 'jira'],
  targetCerts: ['capm', 'pmi-acp'],
  targetLocations: ['Worcester, MA', 'Remote'],
  experienceYears: 6,
  titleSynonyms: { 'project manager': ['program manager', 'pm'] },
  weights: {
    freshness: 0.25, skill: 0.25, title: 0.15, cert: 0.10,
    competition: 0.10, location: 0.10, experience: 0.05,
  },
};

describe('IPE Scoring Orchestrator', () => {
  it('calculates composite score for a good match', () => {
    const job: JobData = {
      title: 'Senior Project Manager',
      description: 'Looking for a PM with Agile, Python, SQL, and Jira experience. CAPM preferred. 5+ years.',
      location: 'Worcester, MA',
      postedAt: new Date().toISOString(),
      applicants: 8,
    };

    const result = calculateIpeScore(mockProfile, job);
    expect(result.ipeScore).toBeGreaterThan(70);
    expect(result.dimensions.freshnessScore).toBeGreaterThan(90);
    expect(result.dimensions.skillMatchScore).toBeGreaterThan(50);
    expect(result.dimensions.titleAlignmentScore).toBe(90);
    expect(result.dimensions.locationMatchScore).toBe(100);
    expect(result.matchedSkills.length).toBeGreaterThan(2);
  });

  it('calculates low score for poor match', () => {
    const job: JobData = {
      title: 'Chef',
      description: 'Looking for a culinary expert for our kitchen',
      location: 'New York, NY',
      postedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      applicants: 200,
    };

    const result = calculateIpeScore(mockProfile, job);
    expect(result.ipeScore).toBeLessThan(30);
  });

  it('returns all dimension scores', () => {
    const job: JobData = {
      title: 'PM',
      description: 'A PM role',
      location: null,
      postedAt: null,
      applicants: null,
    };

    const result = calculateIpeScore(mockProfile, job);
    expect(result.dimensions).toHaveProperty('freshnessScore');
    expect(result.dimensions).toHaveProperty('skillMatchScore');
    expect(result.dimensions).toHaveProperty('titleAlignmentScore');
    expect(result.dimensions).toHaveProperty('certMatchScore');
    expect(result.dimensions).toHaveProperty('competitionScore');
    expect(result.dimensions).toHaveProperty('locationMatchScore');
    expect(result.dimensions).toHaveProperty('experienceAlignScore');
    expect(result.ipeScore).toBeGreaterThanOrEqual(0);
    expect(result.ipeScore).toBeLessThanOrEqual(100);
  });
});

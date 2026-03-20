import { describe, it, expect } from 'vitest';
import { scoreFreshness } from '../freshness.js';
import { scoreSkillMatch } from '../skill-match.js';
import { scoreTitleAlignment } from '../title-align.js';
import { scoreCertMatch } from '../cert-match.js';
import { scoreCompetition } from '../competition.js';
import { scoreLocationMatch } from '../location-match.js';
import { scoreExperience } from '../experience.js';

describe('Freshness Score', () => {
  it('scores 100 for very recent posts', () => {
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
    expect(scoreFreshness(threeHoursAgo)).toBe(100);
  });

  it('scores 95 for posts within 24h', () => {
    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
    expect(scoreFreshness(twelveHoursAgo)).toBe(95);
  });

  it('scores 0 for posts older than 14 days', () => {
    const now = new Date();
    const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
    expect(scoreFreshness(twentyDaysAgo)).toBe(0);
  });

  it('scores 40 for null posted_at', () => {
    expect(scoreFreshness(null)).toBe(40);
  });
});

describe('Skill Match Score', () => {
  it('scores high for good overlap', () => {
    const profileSkills = ['agile', 'python', 'sql', 'jira', 'aws'];
    const jobDescription = 'Looking for someone with Python, SQL, and Jira experience. AWS knowledge a plus.';
    const result = scoreSkillMatch(profileSkills, jobDescription);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.matchedSkills.length).toBeGreaterThanOrEqual(3);
  });

  it('scores 0 for no overlap', () => {
    const profileSkills = ['agile', 'python'];
    const jobDescription = 'Looking for a chef with culinary experience';
    const result = scoreSkillMatch(profileSkills, jobDescription);
    expect(result.score).toBe(0);
  });

  it('never exceeds 100', () => {
    const profileSkills = ['python'];
    const jobDescription = 'Python Python Python developer with Python skills and Python expertise';
    const result = scoreSkillMatch(profileSkills, jobDescription);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe('Title Alignment Score', () => {
  it('scores 100 for exact match', () => {
    expect(scoreTitleAlignment(['Project Manager'], 'Project Manager', {})).toBe(100);
  });

  it('scores 90 for contains match (order-independent wins)', () => {
    expect(scoreTitleAlignment(['Project Manager'], 'Senior Project Manager', {})).toBe(90);
  });

  it('scores 100 for synonym match (was 40)', () => {
    const synonyms = { 'scrum master': ['agile coach'] };
    expect(scoreTitleAlignment(['Scrum Master'], 'Agile Coach', synonyms)).toBe(100);
  });

  it('scores 90 for order-independent word match', () => {
    expect(scoreTitleAlignment(
      ['Technical Project Manager'],
      'Project Manager, Technical',
      {}
    )).toBe(90);
  });

  it('scores 0 for exclude title match', () => {
    expect(scoreTitleAlignment(
      ['Technical Project Manager'],
      'Account Manager',
      {},
      ['Account Manager', 'Sales Manager']
    )).toBe(0);
  });

  it('scores 0 for no match', () => {
    expect(scoreTitleAlignment(['Project Manager'], 'Chef', {})).toBe(0);
  });

  it('works with empty excludes', () => {
    const synonyms = { 'product manager': ['product owner'] };
    expect(scoreTitleAlignment(['Product Manager'], 'Product Owner', synonyms, [])).toBe(100);
  });
});

describe('Cert Match Score', () => {
  it('scores 100 when all job certs matched', () => {
    expect(scoreCertMatch(['capm', 'pmi-acp', 'safe'], 'Requires CAPM and SAFe certification')).toBe(100);
  });

  it('scores 70 when job mentions no certs', () => {
    expect(scoreCertMatch(['capm'], 'A great PM role with no specific cert requirements')).toBe(70);
  });

  it('scores 20 when job requires cert you lack', () => {
    expect(scoreCertMatch(['capm'], 'Requires PMP certification')).toBe(20);
  });
});

describe('Competition Score', () => {
  it('scores 100 for < 10 applicants', () => {
    expect(scoreCompetition(5)).toBe(100);
  });

  it('scores 10 for 100+ applicants', () => {
    expect(scoreCompetition(150)).toBe(10);
  });

  it('scores 50 for null applicants', () => {
    expect(scoreCompetition(null)).toBe(50);
  });
});

describe('Location Match Score', () => {
  it('scores 100 for exact city match', () => {
    expect(scoreLocationMatch(['Worcester, MA'], 'Worcester, MA')).toBe(100);
  });

  it('scores 90 for remote job when profile allows remote', () => {
    expect(scoreLocationMatch(['Worcester, MA', 'Remote'], 'Remote')).toBe(90);
  });

  it('scores 70 for same state', () => {
    expect(scoreLocationMatch(['Worcester, MA'], 'Boston, MA')).toBe(70);
  });

  it('scores 10 for different state no remote', () => {
    expect(scoreLocationMatch(['Worcester, MA'], 'New York, NY')).toBe(10);
  });
});

describe('Experience Score', () => {
  it('scores 100 for perfect match', () => {
    expect(scoreExperience(6, '5+ years of project management experience')).toBe(100);
  });

  it('scores 70 for no requirement stated', () => {
    expect(scoreExperience(6, 'A great PM role')).toBe(70);
  });

  it('scores lower for under-qualified', () => {
    expect(scoreExperience(2, '10+ years of experience required')).toBeLessThan(50);
  });
});

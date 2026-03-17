import { describe, it, expect } from 'vitest';
import { extractProfileData, type ExtractedProfile } from '../extractor.js';

const SAMPLE_TEXT = `
John Doe
Project Manager | Infrastructure & Security
Worcester, MA

EXPERIENCE

Worcester Polytechnic Institute — Project Manager
Jan 2020 - Present
- Managing multi-million dollar infrastructure and security portfolio
- AI camera systems: Milestone VMS, AI Argus
- Coordination with campus police, facilities, vendors

RELI Group — PM Analyst
Jun 2018 - Dec 2019
- Cybersecurity project management
- ISO 27001 compliance

SKILLS
Agile, Scrum, Python, SQL, Power BI, Jira, Confluence, AWS

CERTIFICATIONS
CAPM, PMI-ACP, SAFe

EDUCATION
Bachelor of Science in Computer Science
`;

describe('Profile Data Extractor', () => {
  it('extracts skills from text using dictionary', () => {
    const result = extractProfileData(SAMPLE_TEXT);
    expect(result.skills).toContain('agile');
    expect(result.skills).toContain('python');
    expect(result.skills).toContain('jira');
  });

  it('extracts certifications', () => {
    const result = extractProfileData(SAMPLE_TEXT);
    expect(result.certs).toContain('capm');
    expect(result.certs).toContain('pmi-acp');
    expect(result.certs).toContain('safe');
  });

  it('extracts job titles', () => {
    const result = extractProfileData(SAMPLE_TEXT);
    expect(result.titles.some(t => t.toLowerCase().includes('project manager'))).toBe(true);
  });

  it('calculates experience years', () => {
    const result = extractProfileData(SAMPLE_TEXT);
    expect(result.experienceYears).toBeGreaterThanOrEqual(5);
  });

  it('extracts locations', () => {
    const result = extractProfileData(SAMPLE_TEXT);
    expect(result.locations.some(l => l.toLowerCase().includes('worcester'))).toBe(true);
  });

  it('extracts tools', () => {
    const result = extractProfileData(SAMPLE_TEXT);
    expect(result.tools).toContain('jira');
    expect(result.tools).toContain('power bi');
    expect(result.tools).toContain('confluence');
  });
});

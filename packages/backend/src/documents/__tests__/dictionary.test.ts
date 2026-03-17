import { describe, it, expect } from 'vitest';
import { loadDictionary, getAllTerms, getCertifications, getTools } from '../dictionary.js';

describe('Skill Dictionary', () => {
  it('loads all categories', () => {
    const dict = loadDictionary();
    expect(dict.methodologies.length).toBeGreaterThan(10);
    expect(dict.tools.length).toBeGreaterThan(10);
    expect(dict.technical.length).toBeGreaterThan(10);
    expect(dict.certifications.length).toBeGreaterThan(10);
    expect(dict.domains.length).toBeGreaterThan(10);
    expect(dict.soft_skills.length).toBeGreaterThan(10);
  });

  it('getAllTerms returns flattened list', () => {
    const terms = getAllTerms();
    expect(terms.length).toBeGreaterThan(100);
    expect(terms).toContain('agile');
    expect(terms).toContain('python');
    expect(terms).toContain('pmp');
  });

  it('getCertifications returns cert list', () => {
    const certs = getCertifications();
    expect(certs).toContain('capm');
    expect(certs).toContain('pmi-acp');
  });
});

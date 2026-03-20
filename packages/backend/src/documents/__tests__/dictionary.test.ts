import { describe, it, expect } from 'vitest';
import { loadDictionaryFromTemplate, getAllTermsFromTemplate, getCertificationsFromTemplate, getToolsFromTemplate } from '../dictionary.js';

describe('Skill Dictionary (template-based)', () => {
  it('loads pm-tpm template with all categories', () => {
    const dict = loadDictionaryFromTemplate('pm-tpm');
    expect(dict.methodologies.length).toBeGreaterThan(10);
    expect(dict.tools.length).toBeGreaterThan(10);
    expect(dict.technical.length).toBeGreaterThan(10);
    expect(dict.certifications.length).toBeGreaterThan(5);
    expect(dict.domains.length).toBeGreaterThan(10);
    expect(dict.soft_skills.length).toBeGreaterThan(10);
  });

  it('getAllTermsFromTemplate returns flattened list', () => {
    const terms = getAllTermsFromTemplate('pm-tpm');
    expect(terms.length).toBeGreaterThan(50);
    expect(terms).toContain('agile');
    expect(terms).toContain('python');
    expect(terms).toContain('pmp');
  });

  it('getCertificationsFromTemplate returns cert list', () => {
    const certs = getCertificationsFromTemplate('pm-tpm');
    expect(certs).toContain('capm');
    expect(certs).toContain('pmi-acp');
  });

  it('loads default template', () => {
    const dict = loadDictionaryFromTemplate('default');
    expect(dict.methodologies.length).toBeGreaterThan(0);
    expect(dict.tools.length).toBeGreaterThan(0);
  });

  it('loads software-engineer template', () => {
    const dict = loadDictionaryFromTemplate('software-engineer');
    expect(dict.technical.length).toBeGreaterThan(20);
  });
});

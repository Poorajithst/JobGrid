import { describe, it, expect } from 'vitest';
import { generateSlugCandidates } from '../discovery.js';

describe('discovery', () => {
  it('generates slug candidates from multi-word company name', () => {
    const candidates = generateSlugCandidates('Hub Spot');
    expect(candidates).toContain('hubspot');
    expect(candidates).toContain('hub-spot');
    expect(candidates).toContain('hub_spot');
    expect(candidates).toContain('hub');
  });

  it('handles single word company names', () => {
    const candidates = generateSlugCandidates('Stripe');
    expect(candidates).toContain('stripe');
    expect(candidates.length).toBe(1); // only one unique candidate
  });

  it('strips special characters', () => {
    const candidates = generateSlugCandidates("O'Reilly Media");
    expect(candidates).toContain('oreilly-media');
    expect(candidates).toContain('oreillymedia');
  });

  it('handles empty input', () => {
    const candidates = generateSlugCandidates('');
    expect(candidates.length).toBe(0);
  });
});

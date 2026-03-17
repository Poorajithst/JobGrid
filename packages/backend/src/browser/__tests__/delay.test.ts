import { describe, it, expect } from 'vitest';
import { randomDelay } from '../delay.js';

describe('randomDelay', () => {
  it('returns a promise that resolves', async () => {
    const start = Date.now();
    await randomDelay(10, 20); // Use short delays for testing
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(9);
    expect(elapsed).toBeLessThan(100);
  });
});

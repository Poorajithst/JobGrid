import { describe, it, expect, vi } from 'vitest';
import { scrapeGoogleJobs } from '../google-jobs.js';

vi.mock('../../browser/delay.js', () => ({
  randomDelay: vi.fn().mockResolvedValue(undefined),
}));

describe('scrapeGoogleJobs', () => {
  it('extracts jobs from multiple search queries', async () => {
    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      $$eval: vi.fn().mockResolvedValue([
        {
          title: 'Program Manager',
          company: 'Google',
          location: 'Worcester, MA',
          link: 'https://careers.google.com/jobs/123',
        },
      ]),
    };

    const results = await scrapeGoogleJobs(mockPage as any);
    // 4 queries × 1 result each = 4 results
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].source).toBe('google-jobs');
    expect(results[0].atsId).toBeNull();
    expect(mockPage.goto).toHaveBeenCalledTimes(4); // 4 search queries
  });

  it('returns empty on timeout', async () => {
    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockRejectedValue(new Error('Timeout')),
      $$eval: vi.fn(),
    };

    const results = await scrapeGoogleJobs(mockPage as any);
    expect(results).toHaveLength(0);
  });
});

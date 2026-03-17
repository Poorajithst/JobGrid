import { describe, it, expect, vi } from 'vitest';
import { scrapeZipRecruiter } from '../ziprecruiter.js';

vi.mock('../../browser/delay.js', () => ({
  randomDelay: vi.fn().mockResolvedValue(undefined),
}));

describe('scrapeZipRecruiter', () => {
  it('extracts job data from page elements', async () => {
    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      $$eval: vi.fn().mockResolvedValue([
        {
          title: 'Project Manager',
          company: 'TestCo',
          location: 'Worcester, MA',
          link: 'https://www.ziprecruiter.com/job/123',
          postedAt: '1 day ago',
        },
      ]),
    };

    const results = await scrapeZipRecruiter(mockPage as any);
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('ziprecruiter');
    expect(results[0].title).toBe('Project Manager');
  });

  it('returns empty on failure', async () => {
    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockRejectedValue(new Error('Timeout')),
      $$eval: vi.fn(),
    };

    const results = await scrapeZipRecruiter(mockPage as any);
    expect(results).toHaveLength(0);
  });
});

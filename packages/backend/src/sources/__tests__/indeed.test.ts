import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scrapeIndeed } from '../indeed.js';

describe('scrapeIndeed', () => {
  it('extracts job data from page elements', async () => {
    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      $$eval: vi.fn().mockResolvedValue([
        {
          title: 'Sr. Project Manager',
          company: 'TestCo',
          location: 'Worcester, MA',
          link: 'https://www.indeed.com/viewjob?jk=abc123',
          postedAt: '1 day ago',
        },
      ]),
      close: vi.fn(),
    };

    const results = await scrapeIndeed(mockPage as any);
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Sr. Project Manager');
    expect(results[0].source).toBe('indeed');
    expect(results[0].link).toContain('indeed.com');
    expect(mockPage.goto).toHaveBeenCalledWith(
      expect.stringContaining('indeed.com/jobs'),
      expect.any(Object)
    );
  });

  it('returns empty array on selector timeout', async () => {
    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockRejectedValue(new Error('Timeout')),
      $$eval: vi.fn(),
      close: vi.fn(),
    };

    const results = await scrapeIndeed(mockPage as any);
    expect(results).toHaveLength(0);
  });
});

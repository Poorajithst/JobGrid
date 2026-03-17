import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runAllSources } from '../index.js';

vi.mock('../greenhouse.js', () => ({
  fetchGreenhouse: vi.fn().mockResolvedValue([
    { title: 'PM1', company: 'Co1', link: 'https://gh.com/1', source: 'greenhouse', atsId: '1', location: null, postedAt: null, applicants: null, description: null },
  ]),
}));

vi.mock('../lever.js', () => ({
  fetchLever: vi.fn().mockResolvedValue([
    { title: 'PM2', company: 'Co2', link: 'https://lever.co/2', source: 'lever', atsId: '2', location: null, postedAt: null, applicants: null, description: null },
  ]),
}));

vi.mock('../indeed.js', () => ({
  scrapeIndeed: vi.fn().mockResolvedValue([
    { title: 'PM3', company: 'Co3', link: 'https://indeed.com/3', source: 'indeed', atsId: null, location: null, postedAt: null, applicants: null, description: null },
  ]),
}));

vi.mock('../google-jobs.js', () => ({
  scrapeGoogleJobs: vi.fn().mockResolvedValue([]),
}));

vi.mock('../ziprecruiter.js', () => ({
  scrapeZipRecruiter: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../browser/instance.js', () => ({
  getPage: vi.fn().mockResolvedValue({}),
  closeBrowser: vi.fn().mockResolvedValue(undefined),
}));

describe('runAllSources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('collects jobs from all sources', async () => {
    const companies = [
      { name: 'Co1', greenhouseSlug: 'co1', leverSlug: null },
      { name: 'Co2', greenhouseSlug: null, leverSlug: 'co2' },
    ];

    const { jobs, sourcesRun } = await runAllSources(companies);
    expect(jobs).toHaveLength(3);
    expect(jobs.map(j => j.source)).toContain('greenhouse');
    expect(jobs.map(j => j.source)).toContain('lever');
    expect(jobs.map(j => j.source)).toContain('indeed');
    expect(sourcesRun).toContain('greenhouse');
  });

  it('deduplicates by link', async () => {
    // Override greenhouse to return same link as lever
    const { fetchGreenhouse } = await import('../greenhouse.js');
    vi.mocked(fetchGreenhouse).mockResolvedValueOnce([
      { title: 'PM1', company: 'Co1', link: 'https://same-link.com/1', source: 'greenhouse', atsId: '1', location: null, postedAt: null, applicants: null, description: null },
    ]);
    const { fetchLever } = await import('../lever.js');
    vi.mocked(fetchLever).mockResolvedValueOnce([
      { title: 'PM1', company: 'Co1', link: 'https://same-link.com/1', source: 'lever', atsId: '2', location: null, postedAt: null, applicants: null, description: null },
    ]);

    const companies = [
      { name: 'Co1', greenhouseSlug: 'co1', leverSlug: 'co1' },
    ];

    const { jobs } = await runAllSources(companies);
    const sameLinkJobs = jobs.filter(j => j.link === 'https://same-link.com/1');
    expect(sameLinkJobs).toHaveLength(1);
  });

  it('filters out jobs exceeding MAX_APPLICANTS', async () => {
    const { fetchGreenhouse } = await import('../greenhouse.js');
    vi.mocked(fetchGreenhouse).mockResolvedValueOnce([
      { title: 'PM Over', company: 'Co', link: 'https://over.com/1', source: 'greenhouse', atsId: '99', location: null, postedAt: null, applicants: 50, description: null },
      { title: 'PM Under', company: 'Co', link: 'https://under.com/2', source: 'greenhouse', atsId: '100', location: null, postedAt: null, applicants: 10, description: null },
    ]);

    const companies = [{ name: 'Co', greenhouseSlug: 'co', leverSlug: null }];
    const { jobs } = await runAllSources(companies);
    const links = jobs.map(j => j.link);
    expect(links).not.toContain('https://over.com/1');
    expect(links).toContain('https://under.com/2');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchLever } from '../lever.js';
import type { CompanyInput } from '../greenhouse.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('fetchLever', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches jobs from companies with lever slugs', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        {
          id: 'abc-123',
          text: 'Technical PM',
          categories: { location: 'Boston, MA' },
          hostedUrl: 'https://jobs.lever.co/vanderhoof/abc-123',
          createdAt: 1710500000000,
        },
      ]),
    });

    const companies: CompanyInput[] = [
      { name: 'Vanderhoof', greenhouseSlug: null, leverSlug: 'vanderhoof' },
    ];

    const results = await fetchLever(companies);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      title: 'Technical PM',
      company: 'Vanderhoof',
      location: 'Boston, MA',
      link: 'https://jobs.lever.co/vanderhoof/abc-123',
      atsId: 'abc-123',
      source: 'lever',
      postedAt: expect.any(String),
      applicants: null,
      description: null,
    });
  });

  it('skips companies without lever slug', async () => {
    const companies: CompanyInput[] = [
      { name: 'GHOnly', greenhouseSlug: 'ghonly', leverSlug: null },
    ];
    const results = await fetchLever(companies);
    expect(results).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('handles API errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const companies: CompanyInput[] = [
      { name: 'BadCo', greenhouseSlug: null, leverSlug: 'badco' },
    ];
    const results = await fetchLever(companies);
    expect(results).toHaveLength(0);
  });
});

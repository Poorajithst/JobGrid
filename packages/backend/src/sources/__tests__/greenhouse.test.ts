import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchGreenhouse } from '../greenhouse.js';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('fetchGreenhouse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches jobs from companies with greenhouse slugs', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobs: [
          {
            id: 12345,
            title: 'Sr. Project Manager',
            location: { name: 'Worcester, MA' },
            absolute_url: 'https://boards.greenhouse.io/mathworks/jobs/12345',
            updated_at: '2026-03-15T10:00:00Z',
          },
        ],
      }),
    });

    const companies = [
      { name: 'MathWorks', greenhouseSlug: 'mathworks', leverSlug: null },
    ];

    const results = await fetchGreenhouse(companies);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      title: 'Sr. Project Manager',
      company: 'MathWorks',
      location: 'Worcester, MA',
      link: 'https://boards.greenhouse.io/mathworks/jobs/12345',
      atsId: '12345',
      source: 'greenhouse',
      postedAt: '2026-03-15T10:00:00Z',
      applicants: null,
      description: null,
    });
  });

  it('skips companies without greenhouse slug', async () => {
    const companies = [
      { name: 'LeverOnly', greenhouseSlug: null, leverSlug: 'leveronly' },
    ];
    const results = await fetchGreenhouse(companies);
    expect(results).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('handles API errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const companies = [
      { name: 'BadCo', greenhouseSlug: 'badco', leverSlug: null },
    ];
    const results = await fetchGreenhouse(companies);
    expect(results).toHaveLength(0);
  });
});

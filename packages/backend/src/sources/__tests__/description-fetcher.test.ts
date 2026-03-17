import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDescriptionHttp, fetchJobDescription } from '../description-fetcher.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('fetchDescriptionHttp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts description from greenhouse selector (#content .body)', async () => {
    const longText = 'A'.repeat(150);
    const html = `<html><body><div id="content"><div class="body">${longText}</div></div></body></html>`;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => html,
    });

    const result = await fetchDescriptionHttp('https://boards.greenhouse.io/example/jobs/123');
    expect(result).toBe(longText);
  });

  it('extracts description from .job-description selector', async () => {
    const longText = 'We are looking for a software engineer. '.repeat(5);
    const html = `<html><body><div class="job-description">${longText}</div></body></html>`;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => html,
    });

    const result = await fetchDescriptionHttp('https://example.com/jobs/456');
    expect(result).toBe(longText.trim());
  });

  it('extracts from lever selector (.posting-page .content)', async () => {
    const longText = 'B'.repeat(200);
    const html = `<html><body><div class="posting-page"><div class="content">${longText}</div></div></body></html>`;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => html,
    });

    const result = await fetchDescriptionHttp('https://jobs.lever.co/example/abc');
    expect(result).toBe(longText);
  });

  it('returns null for empty pages (text < 100 chars)', async () => {
    const html = `<html><body><div class="job-description">Short</div></body></html>`;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => html,
    });

    const result = await fetchDescriptionHttp('https://example.com/jobs/789');
    expect(result).toBeNull();
  });

  it('returns null for no matching selectors', async () => {
    const html = `<html><body><p>Nothing here</p></body></html>`;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => html,
    });

    const result = await fetchDescriptionHttp('https://example.com/empty');
    expect(result).toBeNull();
  });

  it('returns null on fetch error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await fetchDescriptionHttp('https://example.com/error');
    expect(result).toBeNull();
  });

  it('returns null on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await fetchDescriptionHttp('https://example.com/404');
    expect(result).toBeNull();
  });
});

describe('fetchJobDescription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns HTTP result when cheerio extraction succeeds', async () => {
    const longText = 'C'.repeat(200);
    const html = `<html><body><article>${longText}</article></body></html>`;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => html,
    });

    const result = await fetchJobDescription('https://example.com/jobs/1');
    expect(result).toBe(longText);
  });

  it('returns null when HTTP fails and no Playwright page provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '<html><body></body></html>',
    });

    const result = await fetchJobDescription('https://example.com/empty');
    expect(result).toBeNull();
  });
});

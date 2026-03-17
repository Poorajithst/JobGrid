import * as cheerio from 'cheerio';
import type { Page } from 'playwright';

/** Ordered selector lists by ATS / generic */
const GREENHOUSE_SELECTORS = ['#content .body', '.job-post-content', '[data-mapped="true"]'];
const LEVER_SELECTORS = ['.posting-page .content', '[data-qa="job-description"]'];
const GENERIC_SELECTORS = ['.job-description', '.description', 'article', 'main'];

const ALL_SELECTORS = [...GREENHOUSE_SELECTORS, ...LEVER_SELECTORS, ...GENERIC_SELECTORS];

const MIN_LENGTH = 100;

/**
 * Try to extract text from HTML using cheerio and the ordered selector list.
 */
function extractFromHtml(html: string): string | null {
  const $ = cheerio.load(html);
  for (const sel of ALL_SELECTORS) {
    const el = $(sel);
    if (el.length) {
      const text = el.first().text().trim();
      if (text.length >= MIN_LENGTH) return text;
    }
  }
  return null;
}

/**
 * Fetch a URL with plain HTTP and extract job description via cheerio.
 */
export async function fetchDescriptionHttp(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    return extractFromHtml(html);
  } catch {
    return null;
  }
}

/**
 * Render a page with Playwright and extract job description.
 * Falls back to document.body.innerText capped at 5000 chars.
 */
export async function fetchDescriptionPlaywright(page: Page, url: string): Promise<string | null> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    // Wait a moment for JS rendering
    await page.waitForTimeout(2000);

    for (const sel of ALL_SELECTORS) {
      const el = page.locator(sel).first();
      if (await el.count() > 0) {
        const text = (await el.innerText()).trim();
        if (text.length >= MIN_LENGTH) return text;
      }
    }

    // Fallback: body text capped at 5000 chars
    const bodyText = await page.evaluate(() => document.body.innerText);
    if (bodyText && bodyText.trim().length >= MIN_LENGTH) {
      return bodyText.trim().slice(0, 5000);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Hybrid fetcher: tries HTTP+cheerio first, falls back to Playwright if available.
 */
export async function fetchJobDescription(url: string, page?: Page): Promise<string | null> {
  const httpResult = await fetchDescriptionHttp(url);
  if (httpResult && httpResult.length >= MIN_LENGTH) return httpResult;

  if (page) {
    return fetchDescriptionPlaywright(page, url);
  }

  return null;
}

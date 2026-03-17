import type { Page } from 'playwright';
import { randomDelay } from '../browser/delay.js';
import type { RawJob } from './greenhouse.js';

const SCRAPE_RADIUS = process.env.SCRAPE_RADIUS || '25';
const DAYS_POSTED = process.env.DAYS_POSTED || '1';

export async function scrapeIndeed(page: Page, searchQueries?: string[]): Promise<RawJob[]> {
  const queries = searchQueries && searchQueries.length > 0
    ? searchQueries
    : ['project+manager Worcester MA'];

  const allResults: RawJob[] = [];

  for (const query of queries) {
    const url = [
      `https://www.indeed.com/jobs?q=${encodeURIComponent(query)}`,
      `&radius=${SCRAPE_RADIUS}`,
      `&fromage=${DAYS_POSTED}`,
      '&sort=date',
    ].join('');

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForSelector('.job_seen_beacon', { timeout: 8000 });
      await randomDelay();

      const jobs = await page.$$eval('.job_seen_beacon', (cards) =>
        cards.map((c) => ({
          title: c.querySelector('.jobTitle')?.textContent?.trim() ?? '',
          company: c.querySelector('[data-testid="company-name"]')?.textContent?.trim() ?? '',
          location: c.querySelector('[data-testid="text-location"]')?.textContent?.trim() ?? '',
          link: c.querySelector('a')?.getAttribute('href') ?? '',
          postedAt: c.querySelector('.date')?.textContent?.trim() ?? null,
        }))
      );

      allResults.push(
        ...jobs
          .filter(j => j.title && j.link)
          .map(j => ({
            title: j.title,
            company: j.company,
            location: j.location || null,
            link: j.link.startsWith('http') ? j.link : `https://www.indeed.com${j.link}`,
            atsId: null,
            source: 'indeed' as const,
            postedAt: j.postedAt,
            applicants: null,
            description: null,
          }))
      );

      await randomDelay();
    } catch (err) {
      console.warn(`Indeed: Query "${query}" failed — possible selector breakage:`, err);
    }
  }

  return allResults;
}

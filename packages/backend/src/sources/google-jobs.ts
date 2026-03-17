import type { Page } from 'playwright';
import { randomDelay } from '../browser/delay.js';
import type { RawJob } from './greenhouse.js';

const SEARCH_QUERIES = [
  '"project manager" Worcester MA',
  '"program manager" Worcester MA',
  '"technical program manager" Boston MA',
  '"infrastructure PM" remote',
];

export async function scrapeGoogleJobs(page: Page): Promise<RawJob[]> {
  const results: RawJob[] = [];

  for (const query of SEARCH_QUERIES) {
    try {
      await page.goto(
        `https://www.google.com/search?q=${encodeURIComponent(query)}&ibp=htl;jobs`,
        { waitUntil: 'domcontentloaded', timeout: 15000 }
      );
      await page.waitForSelector('.PwjeAc', { timeout: 8000 });
      await randomDelay();

      const jobs = await page.$$eval('.PwjeAc', (cards) =>
        cards.map((c) => ({
          title: c.querySelector('.BjJfJf')?.textContent?.trim() ?? '',
          company: c.querySelector('.vNEEBe')?.textContent?.trim() ?? '',
          location: c.querySelector('.Qk80Jf')?.textContent?.trim() ?? '',
          link: c.querySelector('a')?.getAttribute('href') ?? '',
        }))
      );

      for (const job of jobs) {
        if (job.title && job.link) {
          results.push({
            title: job.title,
            company: job.company,
            location: job.location || null,
            link: job.link,
            atsId: null,
            source: 'google-jobs',
            postedAt: null,
            applicants: null,
            description: null,
          });
        }
      }

      await randomDelay();
    } catch (err) {
      console.warn(`Google Jobs: Query "${query}" failed — possible selector breakage:`, err);
      // Continue with next query
    }
  }

  if (results.length === 0) {
    console.warn('Google Jobs: All queries returned 0 results — selectors may have changed');
  }

  return results;
}

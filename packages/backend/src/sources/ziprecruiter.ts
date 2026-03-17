import type { Page } from 'playwright';
import { randomDelay } from '../browser/delay.js';
import type { RawJob } from './greenhouse.js';

const SCRAPE_RADIUS = process.env.SCRAPE_RADIUS || '25';
const DAYS_POSTED = process.env.DAYS_POSTED || '1';

export async function scrapeZipRecruiter(page: Page): Promise<RawJob[]> {
  const url = `https://www.ziprecruiter.com/jobs-search?search=project+manager&location=Worcester%2C+MA&radius=${SCRAPE_RADIUS}&days=${DAYS_POSTED}`;

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('.job_listing', { timeout: 8000 });
    await randomDelay();

    const jobs = await page.$$eval('.job_listing', (cards) =>
      cards.map((c) => ({
        title: c.querySelector('.job_title')?.textContent?.trim() ?? '',
        company: c.querySelector('.company_name')?.textContent?.trim() ?? '',
        location: c.querySelector('.location')?.textContent?.trim() ?? '',
        link: c.querySelector('a.job_link')?.getAttribute('href') ?? '',
        postedAt: c.querySelector('.posted_date')?.textContent?.trim() ?? null,
      }))
    );

    return jobs
      .filter(j => j.title && j.link)
      .map(j => ({
        title: j.title,
        company: j.company,
        location: j.location || null,
        link: j.link.startsWith('http') ? j.link : `https://www.ziprecruiter.com${j.link}`,
        atsId: null,
        source: 'ziprecruiter' as const,
        postedAt: j.postedAt,
        applicants: null,
        description: null,
      }));
  } catch (err) {
    console.warn('ZipRecruiter: Scraper failed or returned 0 results — possible selector breakage:', err);
    return [];
  }
}

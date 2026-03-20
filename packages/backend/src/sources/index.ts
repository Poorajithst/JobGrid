import type { CompanyInput, RawJob } from './greenhouse.js';
import { fetchGreenhouse } from './greenhouse.js';
import { fetchLever } from './lever.js';
import { scrapeIndeed } from './indeed.js';
import { scrapeGoogleJobs } from './google-jobs.js';
import { scrapeZipRecruiter } from './ziprecruiter.js';
import { getPage, closeBrowser } from '../browser/instance.js';

const MAX_APPLICANTS = parseInt(process.env.MAX_APPLICANTS || '30', 10);
const MAX_SEARCH_QUERIES = 8;

export interface SourceResult {
  jobs: RawJob[];
  sourcesRun: string[];
  errors: string[];
}

export async function runAllSources(companies: CompanyInput[], searchQueries?: string[]): Promise<SourceResult> {
  const allJobs: RawJob[] = [];
  const sourcesRunSet = new Set<string>();
  const errors: string[] = [];

  // 1. API sources in parallel
  try {
    const [ghJobs, leverJobs] = await Promise.all([
      fetchGreenhouse(companies),
      fetchLever(companies),
    ]);
    sourcesRunSet.add('greenhouse');
    sourcesRunSet.add('lever'); // Track attempted, not just results
    allJobs.push(...ghJobs);
    allJobs.push(...leverJobs);
  } catch (err) {
    errors.push(`API sources: ${err}`);
  }

  // 2. Playwright scrapers (sequential, loop over search queries)
  try {
    const page = await getPage();
    const queryList = (searchQueries || []).slice(0, MAX_SEARCH_QUERIES);
    const seenLinks = new Set<string>();

    for (const query of queryList.length > 0 ? queryList : [undefined]) {
      const queryArr = query ? [query] : undefined;

      try {
        sourcesRunSet.add('indeed');
        const indeedJobs = await scrapeIndeed(page, queryArr);
        for (const job of indeedJobs) {
          if (!seenLinks.has(job.link)) {
            seenLinks.add(job.link);
            allJobs.push(job);
          }
        }
      } catch (err) {
        errors.push(`Indeed (${query || 'default'}): ${err}`);
      }

      try {
        sourcesRunSet.add('google-jobs');
        const googleJobs = await scrapeGoogleJobs(page, queryArr);
        for (const job of googleJobs) {
          if (!seenLinks.has(job.link)) {
            seenLinks.add(job.link);
            allJobs.push(job);
          }
        }
      } catch (err) {
        errors.push(`Google Jobs (${query || 'default'}): ${err}`);
      }

      try {
        sourcesRunSet.add('ziprecruiter');
        const zipJobs = await scrapeZipRecruiter(page, queryArr);
        for (const job of zipJobs) {
          if (!seenLinks.has(job.link)) {
            seenLinks.add(job.link);
            allJobs.push(job);
          }
        }
      } catch (err) {
        errors.push(`ZipRecruiter (${query || 'default'}): ${err}`);
      }
    }

    await page.context().close();
  } catch (err) {
    errors.push(`Browser: ${err}`);
  } finally {
    await closeBrowser();
  }

  // 3. Filter by MAX_APPLICANTS
  const filtered = allJobs.filter(
    j => j.applicants === null || j.applicants <= MAX_APPLICANTS
  );

  // 4. Deduplicate by link (primary)
  const seen = new Set<string>();
  const deduped = filtered.filter(j => {
    if (seen.has(j.link)) return false;
    seen.add(j.link);
    return true;
  });

  // 5. Secondary dedup for ATS sources by (source, ats_id)
  const atsKey = new Set<string>();
  const finalDeduped = deduped.filter(j => {
    if (j.atsId && (j.source === 'greenhouse' || j.source === 'lever')) {
      const key = `${j.source}:${j.atsId}`;
      if (atsKey.has(key)) return false;
      atsKey.add(key);
    }
    return true;
  });

  if (errors.length > 0) {
    console.warn('Source errors:', errors);
  }

  return { jobs: finalDeduped, sourcesRun: Array.from(sourcesRunSet), errors };
}

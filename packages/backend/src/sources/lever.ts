import type { CompanyInput, RawJob } from './greenhouse.js';

export async function fetchLever(companies: CompanyInput[]): Promise<RawJob[]> {
  const results: RawJob[] = [];
  const leverCompanies = companies.filter(c => c.leverSlug);

  for (const company of leverCompanies) {
    try {
      const res = await fetch(
        `https://api.lever.co/v0/postings/${company.leverSlug}?mode=json`
      );
      if (!res.ok) {
        console.warn(`Lever: ${company.name} returned ${res.status}`);
        continue;
      }
      const jobs = await res.json();

      if (!Array.isArray(jobs)) continue;

      for (const job of jobs) {
        results.push({
          title: job.text,
          company: company.name,
          location: job.categories?.location ?? null,
          link: job.hostedUrl,
          atsId: job.id,
          source: 'lever',
          postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : null,
          applicants: null,
          description: null,
        });
      }
    } catch (err) {
      console.error(`Lever: Failed to fetch ${company.name}:`, err);
    }
  }

  return results;
}

export interface CompanyInput {
  name: string;
  greenhouseSlug: string | null;
  leverSlug: string | null;
}

export interface RawJob {
  title: string;
  company: string;
  location: string | null;
  link: string;
  atsId: string | null;
  source: string;
  postedAt: string | null;
  applicants: number | null;
  description: string | null;
}

export async function fetchGreenhouse(companies: CompanyInput[]): Promise<RawJob[]> {
  const results: RawJob[] = [];
  const greenhouseCompanies = companies.filter(c => c.greenhouseSlug);

  for (const company of greenhouseCompanies) {
    try {
      const res = await fetch(
        `https://boards-api.greenhouse.io/v1/boards/${company.greenhouseSlug}/jobs`
      );
      if (!res.ok) {
        console.warn(`Greenhouse: ${company.name} returned ${res.status}`);
        continue;
      }
      const data = await res.json();
      const jobs = data.jobs || [];

      for (const job of jobs) {
        results.push({
          title: job.title,
          company: company.name,
          location: job.location?.name ?? null,
          link: job.absolute_url,
          atsId: String(job.id),
          source: 'greenhouse',
          postedAt: job.updated_at ?? null,
          applicants: null,
          description: null,
        });
      }
    } catch (err) {
      console.error(`Greenhouse: Failed to fetch ${company.name}:`, err);
    }
  }

  return results;
}

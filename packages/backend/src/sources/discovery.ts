import Groq from 'groq-sdk';

const PROBE_TIMEOUT = 5000;

export function generateSlugCandidates(name: string): string[] {
  const lower = name.toLowerCase().trim();
  const noSpecial = lower.replace(/[^a-z0-9\s]/g, '');
  const words = noSpecial.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const candidates = new Set<string>();
  candidates.add(words.join(''));
  candidates.add(words.join('-'));
  candidates.add(words.join('_'));
  if (words.length > 1) candidates.add(words[0]);
  return Array.from(candidates);
}

async function probeUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT) });
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 10000));
      const retry = await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT) });
      return retry.ok;
    }
    return res.ok;
  } catch {
    return false;
  }
}

export async function probeCompany(name: string): Promise<{
  greenhouse: string | null;
  lever: string | null;
  ashby: string | null;
}> {
  const slugs = generateSlugCandidates(name);
  const result = { greenhouse: null as string | null, lever: null as string | null, ashby: null as string | null };

  for (const slug of slugs) {
    if (!result.greenhouse) {
      try {
        const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;
        const res = await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT) });
        if (res.ok) {
          const data = await res.json() as any;
          if (data.jobs && data.jobs.length > 0) result.greenhouse = slug;
        }
      } catch { /* skip */ }
    }

    if (!result.lever) {
      try {
        const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
        const res = await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT) });
        if (res.ok) {
          const data = await res.json() as any[];
          if (Array.isArray(data) && data.length > 0) result.lever = slug;
        }
      } catch { /* skip */ }
    }

    if (!result.ashby) {
      try {
        const url = `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
        const ok = await probeUrl(url);
        if (ok) result.ashby = slug;
      } catch { /* skip */ }
    }

    await new Promise(r => setTimeout(r, 500));
  }
  return result;
}

export async function discoverCompaniesViaAi(
  targetTitles: string[],
  targetLocations: string[],
  existingCompanies: string[]
): Promise<{ name: string; reason: string }[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'missing') {
    console.warn('[discovery] GROQ_API_KEY not set — skipping AI discovery');
    return [];
  }
  const client = new Groq({ apiKey });
  const prompt = `You are a job market research assistant. Suggest 20 companies that are likely hiring for these roles: ${targetTitles.join(', ')}.
Target locations: ${targetLocations.join(', ')}.
Do NOT include any of these companies (already known): ${existingCompanies.slice(0, 100).join(', ')}.
Return ONLY a JSON array of objects with "name" (company name) and "reason" (why they'd hire for these roles). No markdown, no explanation, just the JSON array.`;

  try {
    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });
    const content = response.choices[0]?.message?.content ?? '[]';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]) as { name: string; reason: string }[];
  } catch (err) {
    console.error('[discovery] Groq AI discovery failed:', err);
    return [];
  }
}

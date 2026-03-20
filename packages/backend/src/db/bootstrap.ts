import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db } from './index.js';
import { userDictionary, companies } from './schema.js';

interface SeedCompany {
  name: string;
  domain?: string;
  greenhouseSlug?: string;
  leverSlug?: string;
  ashbySlug?: string;
  industries?: string[];
  hqLocation?: string;
  size?: string;
}

function seedPath(relativePath: string): string {
  // Resolve relative to project root (2 levels up from db/)
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return resolve(__dirname, '..', '..', '..', relativePath);
}

export function hydrateUserDictionary(userId: number, templateId: string): number {
  const path = seedPath(`data/seed/dictionaries/${templateId}.json`);
  const raw = readFileSync(path, 'utf-8');
  const template = JSON.parse(raw);
  const categories = ['methodologies', 'tools', 'technical', 'certifications', 'domains', 'soft_skills'] as const;
  let count = 0;
  for (const category of categories) {
    const terms: string[] = template[category] || [];
    for (const term of terms) {
      db.insert(userDictionary).values({ userId, category, term, source: 'template' }).onConflictDoNothing().run();
      count++;
    }
  }
  return count;
}

export function loadSeedCompanies(): number {
  const path = seedPath('data/seed/companies.json');
  let seedData: SeedCompany[];
  try {
    const raw = readFileSync(path, 'utf-8');
    seedData = JSON.parse(raw);
  } catch {
    console.warn('[bootstrap] No seed companies file found at data/seed/companies.json');
    return 0;
  }
  let inserted = 0;
  for (const company of seedData) {
    try {
      db.insert(companies).values({
        name: company.name,
        greenhouseSlug: company.greenhouseSlug || null,
        leverSlug: company.leverSlug || null,
        ashbySlug: company.ashbySlug || null,
        source: 'seed',
        active: true,
      }).onConflictDoNothing().run();
      inserted++;
    } catch { /* skip duplicates */ }
  }
  return inserted;
}

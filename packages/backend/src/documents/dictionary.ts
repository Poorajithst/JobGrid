import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { userDictionary } from '../db/schema.js';

// Resolve from the source file location so the path works regardless of cwd
const __filename = fileURLToPath(import.meta.url);
// packages/backend/src/documents/ -> up 4 levels -> repo root
const REPO_ROOT = resolve(__filename, '../../../../..');

export interface SkillDictionary {
  methodologies: string[];
  tools: string[];
  technical: string[];
  certifications: string[];
  domains: string[];
  soft_skills: string[];
}

const CATEGORIES: (keyof SkillDictionary)[] = [
  'methodologies', 'tools', 'technical', 'certifications', 'domains', 'soft_skills',
];

export function loadDictionary(userId: number): SkillDictionary {
  const rows = db.select().from(userDictionary).where(eq(userDictionary.userId, userId)).all();
  if (rows.length === 0) {
    console.error(`[dictionary] No dictionary rows for user ${userId} — setup may be incomplete`);
  }
  const dict: SkillDictionary = {
    methodologies: [], tools: [], technical: [],
    certifications: [], domains: [], soft_skills: [],
  };
  for (const row of rows) {
    const cat = row.category as keyof SkillDictionary;
    if (dict[cat]) dict[cat].push(row.term);
  }
  return dict;
}

export function loadDictionaryFromTemplate(templateId: string): SkillDictionary {
  const path = resolve(REPO_ROOT, `data/seed/dictionaries/${templateId}.json`);
  const raw = readFileSync(path, 'utf-8');
  const template = JSON.parse(raw);
  return {
    methodologies: template.methodologies || [],
    tools: template.tools || [],
    technical: template.technical || [],
    certifications: template.certifications || [],
    domains: template.domains || [],
    soft_skills: template.soft_skills || [],
  };
}

export function loadFullTemplate(templateId: string): any {
  const path = resolve(REPO_ROOT, `data/seed/dictionaries/${templateId}.json`);
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw);
}

export function getAllTerms(userId: number): string[] {
  const dict = loadDictionary(userId);
  return CATEGORIES.flatMap(cat => dict[cat]);
}

export function getAllTermsFromTemplate(templateId: string): string[] {
  const dict = loadDictionaryFromTemplate(templateId);
  return CATEGORIES.flatMap(cat => dict[cat]);
}

export function getCertifications(userId: number): string[] {
  return loadDictionary(userId).certifications;
}

export function getCertificationsFromTemplate(templateId: string): string[] {
  return loadDictionaryFromTemplate(templateId).certifications;
}

export function getTools(userId: number): string[] {
  return loadDictionary(userId).tools;
}

export function getToolsFromTemplate(templateId: string): string[] {
  return loadDictionaryFromTemplate(templateId).tools;
}

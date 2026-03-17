import { readFileSync } from 'fs';
import { resolve } from 'path';

export interface SkillDictionary {
  methodologies: string[];
  tools: string[];
  technical: string[];
  certifications: string[];
  domains: string[];
  soft_skills: string[];
}

let cachedDictionary: SkillDictionary | null = null;

export function loadDictionary(): SkillDictionary {
  if (cachedDictionary) return cachedDictionary;

  const path = resolve(process.cwd(), 'data/skill-dictionary.json');
  const raw = readFileSync(path, 'utf-8');
  cachedDictionary = JSON.parse(raw) as SkillDictionary;
  return cachedDictionary;
}

export function getAllTerms(): string[] {
  const dict = loadDictionary();
  return [
    ...dict.methodologies,
    ...dict.tools,
    ...dict.technical,
    ...dict.certifications,
    ...dict.domains,
    ...dict.soft_skills,
  ];
}

export function getCertifications(): string[] {
  return loadDictionary().certifications;
}

export function getTools(): string[] {
  return loadDictionary().tools;
}

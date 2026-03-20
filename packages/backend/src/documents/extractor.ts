import { getAllTerms, getAllTermsFromTemplate, getCertifications, getCertificationsFromTemplate, getTools, getToolsFromTemplate, loadDictionary, loadDictionaryFromTemplate } from './dictionary.js';

export interface ExtractedProfile {
  skills: string[];
  titles: string[];
  certs: string[];
  experienceYears: number;
  locations: string[];
  industries: string[];
  tools: string[];
  education: { degree: string; field: string } | null;
}

export function extractProfileData(text: string, userId?: number): ExtractedProfile {
  const lower = text.toLowerCase();

  // Use DB dictionary if userId provided, otherwise fall back to default template
  const dict = userId ? loadDictionary(userId) : loadDictionaryFromTemplate('default');
  const allTerms = userId ? getAllTerms(userId) : getAllTermsFromTemplate('default');
  const certList = userId ? getCertifications(userId) : getCertificationsFromTemplate('default');
  const toolList = userId ? getTools(userId) : getToolsFromTemplate('default');

  // Extract skills: match all dictionary terms found in text
  const skills = allTerms.filter(term => lower.includes(term));

  // Extract certifications specifically
  const certs = certList.filter(cert => lower.includes(cert));

  // Extract tools specifically
  const tools = toolList.filter(tool => lower.includes(tool));

  // Extract job titles from experience sections
  const titles = extractTitles(text);

  // Calculate experience years from date ranges
  const experienceYears = calculateExperienceYears(text);

  // Extract locations (City, STATE pattern)
  const locations = extractLocations(text);

  // Extract industries
  const industries = dict.domains.filter(domain => lower.includes(domain));

  // Extract education
  const education = extractEducation(text);

  return {
    skills: [...new Set(skills)],
    titles: [...new Set(titles)],
    certs: [...new Set(certs)],
    experienceYears,
    locations: [...new Set(locations)],
    industries: [...new Set(industries)],
    tools: [...new Set(tools)],
    education,
  };
}

function extractTitles(text: string): string[] {
  const titles: string[] = [];
  // Match common title patterns: "Role — Company" or "Company - Role" or standalone title lines
  const titlePatterns = [
    /(?:^|\n)\s*(.+?)\s*[—–-]\s*(?:Project|Program|Technical|Scrum|Product|Infrastructure|IT|Senior|Sr\.|Jr\.|Lead|Principal)/gim,
    /(?:Project|Program|Technical|Scrum|Product|Infrastructure|IT|Senior|Sr\.|Jr\.|Lead|Principal)\s+(?:Manager|Director|Coordinator|Analyst|Engineer|Architect|Lead|Coach|Master)/gi,
  ];

  for (const pattern of titlePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const title = (match[1] || match[0]).trim();
      if (title.length > 3 && title.length < 80) {
        titles.push(title);
      }
    }
  }

  return titles;
}

function calculateExperienceYears(text: string): number {
  // Match date ranges: "Jan 2020 - Present", "2018-2022", "June 2015 - December 2019"
  const datePattern = /(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?(\d{4})\s*[-–—to]+\s*(?:(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?(\d{4})|Present|Current)/gi;

  const ranges: Array<{ start: number; end: number }> = [];
  const now = new Date();
  let match;

  while ((match = datePattern.exec(text)) !== null) {
    const startYear = parseInt(match[2]);
    const endYear = match[4] ? parseInt(match[4]) : now.getFullYear();

    if (startYear >= 1970 && startYear <= now.getFullYear() && endYear >= startYear) {
      ranges.push({ start: startYear, end: endYear });
    }
  }

  if (ranges.length === 0) return 0;

  // Merge overlapping ranges
  ranges.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [ranges[0]];

  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    if (ranges[i].start <= last.end) {
      last.end = Math.max(last.end, ranges[i].end);
    } else {
      merged.push(ranges[i]);
    }
  }

  // Sum non-overlapping years
  return merged.reduce((sum, r) => sum + (r.end - r.start), 0);
}

function extractLocations(text: string): string[] {
  const locations: string[] = [];
  // Match "City, STATE" or "City, ST" patterns
  const locPattern = /([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*([A-Z]{2})\b/g;
  let match;
  while ((match = locPattern.exec(text)) !== null) {
    locations.push(`${match[1]}, ${match[2]}`);
  }
  // Also check for "Remote" keyword
  if (/\bremote\b/i.test(text)) {
    locations.push('Remote');
  }
  return locations;
}

function extractEducation(text: string): { degree: string; field: string } | null {
  const degreePatterns = [
    /(?:Bachelor|Master|PhD|Doctorate|Associate)(?:'s)?\s+(?:of\s+)?(?:Science|Arts|Engineering|Business)\s+(?:in\s+)?(.+?)(?:\n|$)/i,
    /(B\.?S\.?|M\.?S\.?|B\.?A\.?|M\.?B\.?A\.?|Ph\.?D\.?)\s+(?:in\s+)?(.+?)(?:\n|$)/i,
  ];

  for (const pattern of degreePatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        degree: match[1]?.includes('.') ? match[1] : match[0].split(' in ')[0]?.trim() || '',
        field: (match[2] || match[1] || '').trim(),
      };
    }
  }
  return null;
}

# IPE & Multi-Profile Pipeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single hardcoded PM profile + AI-only scoring with a document-driven, multi-signal local matching engine (IPE) that scores instantly, then sends only top matches to AI for validation.

**Architecture:** New DB tables (documents, profiles, job_scores). PDF parsing via pdf-parse + regex extraction. 7-dimension IPE scoring engine using Jaccard similarity with `natural` for stemming. Profile-scoped job views. Dynamic scraper queries from profiles.

**Tech Stack:** pdf-parse, natural (NLP), multer (uploads), existing Express/Drizzle/React/Vite stack

**Spec:** `docs/superpowers/specs/2026-03-16-ipe-multiprofile-design.md`

**Parallelism Map:**
```
Chunk 1 (DB schema + deps)
  ├──> Chunk 2 (document parser)     ── independent
  ├──> Chunk 3 (IPE engine)          ── independent
  └──> Chunk 4 (profiles + API)      ── independent
         All 3 merge into:
Chunk 5 (scoring + AI endpoints)
  ├──> Chunk 6 (frontend updates)    ── independent
  └──> Chunk 7 (scraper/cron/migration) ── independent
```

---

## Chunk 1: DB Schema, Dependencies & Skill Dictionary

### Task 1: Install new dependencies

**Files:**
- Modify: `packages/backend/package.json`

- [ ] **Step 1: Install pdf-parse, natural, multer**

```bash
cd /home/poorajith/My_Volume/CodeBase/Techiee/packages/backend && pnpm add pdf-parse natural multer && pnpm add -D @types/multer @types/pdf-parse
```

- [ ] **Step 2: Commit**

```bash
git add packages/backend/package.json pnpm-lock.yaml
git commit -m "chore: add pdf-parse, natural, multer dependencies"
```

---

### Task 2: Add new DB tables (documents, profiles, job_scores)

**Files:**
- Modify: `packages/backend/src/db/schema.ts`
- Create: `packages/backend/src/db/__tests__/new-schema.test.ts`

- [ ] **Step 1: Write schema test for new tables**

Create `packages/backend/src/db/__tests__/new-schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { documents, profiles, jobScores } from '../schema.js';
import { getTableColumns } from 'drizzle-orm';

describe('New Tables Schema', () => {
  it('documents table has required columns', () => {
    const cols = getTableColumns(documents);
    expect(cols.id).toBeDefined();
    expect(cols.type).toBeDefined();
    expect(cols.filename).toBeDefined();
    expect(cols.rawText).toBeDefined();
    expect(cols.parsedSkills).toBeDefined();
    expect(cols.parsedTitles).toBeDefined();
    expect(cols.parsedCerts).toBeDefined();
    expect(cols.parsedExperienceYears).toBeDefined();
    expect(cols.parsedLocations).toBeDefined();
    expect(cols.parsedTools).toBeDefined();
    expect(cols.uploadedAt).toBeDefined();
    expect(cols.updatedAt).toBeDefined();
  });

  it('profiles table has required columns', () => {
    const cols = getTableColumns(profiles);
    expect(cols.id).toBeDefined();
    expect(cols.name).toBeDefined();
    expect(cols.targetTitles).toBeDefined();
    expect(cols.targetSkills).toBeDefined();
    expect(cols.targetCerts).toBeDefined();
    expect(cols.targetLocations).toBeDefined();
    expect(cols.searchQueries).toBeDefined();
    expect(cols.freshnessWeight).toBeDefined();
    expect(cols.skillWeight).toBeDefined();
    expect(cols.titleWeight).toBeDefined();
    expect(cols.certWeight).toBeDefined();
    expect(cols.competitionWeight).toBeDefined();
    expect(cols.locationWeight).toBeDefined();
    expect(cols.experienceWeight).toBeDefined();
    expect(cols.aiThreshold).toBeDefined();
    expect(cols.isActive).toBeDefined();
  });

  it('jobScores table has required columns', () => {
    const cols = getTableColumns(jobScores);
    expect(cols.id).toBeDefined();
    expect(cols.jobId).toBeDefined();
    expect(cols.profileId).toBeDefined();
    expect(cols.ipeScore).toBeDefined();
    expect(cols.freshnessScore).toBeDefined();
    expect(cols.skillMatchScore).toBeDefined();
    expect(cols.titleAlignmentScore).toBeDefined();
    expect(cols.certMatchScore).toBeDefined();
    expect(cols.competitionScore).toBeDefined();
    expect(cols.locationMatchScore).toBeDefined();
    expect(cols.experienceAlignScore).toBeDefined();
    expect(cols.matchedSkills).toBeDefined();
    expect(cols.aiValidated).toBeDefined();
    expect(cols.aiAgrees).toBeDefined();
    expect(cols.aiPitch).toBeDefined();
    expect(cols.aiFlags).toBeDefined();
  });
});
```

- [ ] **Step 2: Add new table definitions to schema.ts**

Append to `packages/backend/src/db/schema.ts`:

```typescript
export const documents = sqliteTable('documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(), // "resume" or "linkedin"
  filename: text('filename').notNull(),
  rawText: text('raw_text').notNull(),
  parsedSkills: text('parsed_skills'), // JSON array
  parsedTitles: text('parsed_titles'), // JSON array
  parsedCerts: text('parsed_certs'), // JSON array
  parsedExperienceYears: integer('parsed_experience_years'),
  parsedLocations: text('parsed_locations'), // JSON array
  parsedIndustries: text('parsed_industries'), // JSON array
  parsedTools: text('parsed_tools'), // JSON array
  parsedEducation: text('parsed_education'), // JSON {degree, field}
  uploadedAt: text('uploaded_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const profiles = sqliteTable('profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  targetTitles: text('target_titles').notNull(), // JSON array
  targetSkills: text('target_skills').notNull(), // JSON array
  targetCerts: text('target_certs'), // JSON array
  targetLocations: text('target_locations'), // JSON array
  minExperienceYears: integer('min_experience_years'),
  maxExperienceYears: integer('max_experience_years'),
  searchQueries: text('search_queries'), // JSON array
  titleSynonyms: text('title_synonyms'), // JSON object
  freshnessWeight: real('freshness_weight').notNull().default(0.25),
  skillWeight: real('skill_weight').notNull().default(0.25),
  titleWeight: real('title_weight').notNull().default(0.15),
  certWeight: real('cert_weight').notNull().default(0.10),
  competitionWeight: real('competition_weight').notNull().default(0.10),
  locationWeight: real('location_weight').notNull().default(0.10),
  experienceWeight: real('experience_weight').notNull().default(0.05),
  aiThreshold: integer('ai_threshold').notNull().default(60),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const jobScores = sqliteTable('job_scores', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobId: integer('job_id').notNull().references(() => jobs.id),
  profileId: integer('profile_id').notNull().references(() => profiles.id),
  ipeScore: integer('ipe_score').notNull(),
  freshnessScore: integer('freshness_score').notNull(),
  skillMatchScore: integer('skill_match_score').notNull(),
  titleAlignmentScore: integer('title_alignment_score').notNull(),
  certMatchScore: integer('cert_match_score').notNull(),
  competitionScore: integer('competition_score').notNull(),
  locationMatchScore: integer('location_match_score').notNull(),
  experienceAlignScore: integer('experience_align_score').notNull(),
  matchedSkills: text('matched_skills'), // JSON array
  aiValidated: integer('ai_validated', { mode: 'boolean' }).notNull().default(false),
  aiAgrees: integer('ai_agrees', { mode: 'boolean' }),
  aiPitch: text('ai_pitch'),
  aiFlags: text('ai_flags'),
  scoredAt: text('scored_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex('idx_job_scores_unique').on(table.jobId, table.profileId),
  index('idx_job_scores_profile').on(table.profileId),
  index('idx_job_scores_ipe').on(table.profileId, table.ipeScore),
]);
```

- [ ] **Step 3: Run tests**

```bash
cd /home/poorajith/My_Volume/CodeBase/Techiee/packages/backend && pnpm test -- src/db/__tests__/new-schema.test.ts
```
Expected: PASS

- [ ] **Step 4: Generate and run migration**

```bash
cd /home/poorajith/My_Volume/CodeBase/Techiee/packages/backend && pnpm db:generate && pnpm db:migrate
```
Expected: New tables created in SQLite

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/db/schema.ts packages/backend/src/db/__tests__/new-schema.test.ts packages/backend/drizzle/
git commit -m "feat: add documents, profiles, and job_scores tables"
```

---

### Task 3: Create skill dictionary

**Files:**
- Create: `packages/backend/data/skill-dictionary.json`
- Create: `packages/backend/src/documents/dictionary.ts`

- [ ] **Step 1: Create the skill dictionary JSON**

Create `packages/backend/data/skill-dictionary.json`:

```json
{
  "methodologies": [
    "agile", "scrum", "kanban", "waterfall", "safe", "lean", "six sigma",
    "prince2", "pmbok", "hybrid", "devops", "ci/cd", "sdlc", "itil",
    "design thinking", "rapid prototyping", "mvp"
  ],
  "tools": [
    "jira", "asana", "monday.com", "ms project", "microsoft project",
    "power bi", "tableau", "confluence", "trello", "smartsheet",
    "servicenow", "azure devops", "github", "gitlab", "bitbucket",
    "slack", "teams", "zoom", "miro", "figma", "notion",
    "salesforce", "hubspot", "zendesk"
  ],
  "technical": [
    "python", "sql", "javascript", "typescript", "java", "c#", "go", "rust",
    "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "ansible",
    "react", "node.js", "express", "rest api", "graphql", "microservices",
    "machine learning", "ai", "data science", "etl", "data pipeline",
    "postgresql", "mysql", "mongodb", "redis", "elasticsearch"
  ],
  "certifications": [
    "pmp", "capm", "pmi-acp", "safe", "csm", "psm", "itil",
    "prince2", "aws certified", "azure certified", "gcp certified",
    "cissp", "cism", "comptia security+", "iso 27001",
    "six sigma green belt", "six sigma black belt"
  ],
  "domains": [
    "infrastructure", "cybersecurity", "security", "ai/ml", "artificial intelligence",
    "data center", "healthcare", "fintech", "banking", "insurance",
    "higher education", "government", "defense", "manufacturing",
    "telecommunications", "e-commerce", "retail", "supply chain",
    "cloud migration", "digital transformation", "erp", "crm"
  ],
  "soft_skills": [
    "leadership", "stakeholder management", "executive reporting",
    "vendor coordination", "cross-functional", "communication",
    "strategic planning", "risk management", "budget management",
    "team building", "mentoring", "conflict resolution",
    "change management", "presentation", "negotiation"
  ]
}
```

- [ ] **Step 2: Create dictionary loader**

Create `packages/backend/src/documents/dictionary.ts`:

```typescript
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
```

- [ ] **Step 3: Write dictionary test**

Create `packages/backend/src/documents/__tests__/dictionary.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { loadDictionary, getAllTerms, getCertifications, getTools } from '../dictionary.js';

describe('Skill Dictionary', () => {
  it('loads all categories', () => {
    const dict = loadDictionary();
    expect(dict.methodologies.length).toBeGreaterThan(10);
    expect(dict.tools.length).toBeGreaterThan(10);
    expect(dict.technical.length).toBeGreaterThan(10);
    expect(dict.certifications.length).toBeGreaterThan(10);
    expect(dict.domains.length).toBeGreaterThan(10);
    expect(dict.soft_skills.length).toBeGreaterThan(10);
  });

  it('getAllTerms returns flattened list', () => {
    const terms = getAllTerms();
    expect(terms.length).toBeGreaterThan(100);
    expect(terms).toContain('agile');
    expect(terms).toContain('python');
    expect(terms).toContain('pmp');
  });

  it('getCertifications returns cert list', () => {
    const certs = getCertifications();
    expect(certs).toContain('capm');
    expect(certs).toContain('pmi-acp');
  });
});
```

- [ ] **Step 4: Run test**

```bash
cd /home/poorajith/My_Volume/CodeBase/Techiee/packages/backend && pnpm test -- src/documents/__tests__/dictionary.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/backend/data/skill-dictionary.json packages/backend/src/documents/dictionary.ts packages/backend/src/documents/__tests__/dictionary.test.ts
git commit -m "feat: add skill dictionary with ~300 terms across 6 categories"
```

---

## Chunk 2: Document Parser (PARALLEL after Chunk 1)

### Task 4: PDF text extraction

**Files:**
- Create: `packages/backend/src/documents/parser.ts`
- Test: `packages/backend/src/documents/__tests__/parser.test.ts`

- [ ] **Step 1: Write parser test**

Create `packages/backend/src/documents/__tests__/parser.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { extractTextFromPdf } from '../parser.js';

// Mock pdf-parse
vi.mock('pdf-parse', () => ({
  default: vi.fn().mockResolvedValue({
    text: 'John Doe\nProject Manager\nExperience\nWPI - Project Manager\nJan 2020 - Present\nSkills: Agile, Scrum, Python, SQL\nCertifications: CAPM, PMI-ACP',
  }),
}));

describe('PDF Parser', () => {
  it('extracts text from a PDF buffer', async () => {
    const buffer = Buffer.from('fake pdf content');
    const text = await extractTextFromPdf(buffer);
    expect(text).toContain('Project Manager');
    expect(text).toContain('Agile');
    expect(text).toContain('CAPM');
  });
});
```

- [ ] **Step 2: Write parser**

Create `packages/backend/src/documents/parser.ts`:

```typescript
import pdfParse from 'pdf-parse';

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer);
  return result.text;
}
```

- [ ] **Step 3: Run test**

```bash
cd /home/poorajith/My_Volume/CodeBase/Techiee/packages/backend && pnpm test -- src/documents/__tests__/parser.test.ts
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/documents/parser.ts packages/backend/src/documents/__tests__/parser.test.ts
git commit -m "feat: add PDF text extraction via pdf-parse"
```

---

### Task 5: Structured data extractor

**Files:**
- Create: `packages/backend/src/documents/extractor.ts`
- Test: `packages/backend/src/documents/__tests__/extractor.test.ts`

- [ ] **Step 1: Write extractor test**

Create `packages/backend/src/documents/__tests__/extractor.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { extractProfileData, type ExtractedProfile } from '../extractor.js';

const SAMPLE_TEXT = `
John Doe
Project Manager | Infrastructure & Security
Worcester, MA

EXPERIENCE

Worcester Polytechnic Institute — Project Manager
Jan 2020 - Present
- Managing multi-million dollar infrastructure and security portfolio
- AI camera systems: Milestone VMS, AI Argus
- Coordination with campus police, facilities, vendors

RELI Group — PM Analyst
Jun 2018 - Dec 2019
- Cybersecurity project management
- ISO 27001 compliance

SKILLS
Agile, Scrum, Python, SQL, Power BI, Jira, Confluence, AWS

CERTIFICATIONS
CAPM, PMI-ACP, SAFe

EDUCATION
Bachelor of Science in Computer Science
`;

describe('Profile Data Extractor', () => {
  it('extracts skills from text using dictionary', () => {
    const result = extractProfileData(SAMPLE_TEXT);
    expect(result.skills).toContain('agile');
    expect(result.skills).toContain('python');
    expect(result.skills).toContain('jira');
  });

  it('extracts certifications', () => {
    const result = extractProfileData(SAMPLE_TEXT);
    expect(result.certs).toContain('capm');
    expect(result.certs).toContain('pmi-acp');
    expect(result.certs).toContain('safe');
  });

  it('extracts job titles', () => {
    const result = extractProfileData(SAMPLE_TEXT);
    expect(result.titles.some(t => t.toLowerCase().includes('project manager'))).toBe(true);
  });

  it('calculates experience years', () => {
    const result = extractProfileData(SAMPLE_TEXT);
    expect(result.experienceYears).toBeGreaterThanOrEqual(5);
  });

  it('extracts locations', () => {
    const result = extractProfileData(SAMPLE_TEXT);
    expect(result.locations.some(l => l.toLowerCase().includes('worcester'))).toBe(true);
  });

  it('extracts tools', () => {
    const result = extractProfileData(SAMPLE_TEXT);
    expect(result.tools).toContain('jira');
    expect(result.tools).toContain('power bi');
    expect(result.tools).toContain('aws');
  });
});
```

- [ ] **Step 2: Write the extractor**

Create `packages/backend/src/documents/extractor.ts`:

```typescript
import { getAllTerms, getCertifications, getTools, loadDictionary } from './dictionary.js';

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

export function extractProfileData(text: string): ExtractedProfile {
  const lower = text.toLowerCase();
  const dict = loadDictionary();

  // Extract skills: match all dictionary terms found in text
  const allTerms = getAllTerms();
  const skills = allTerms.filter(term => lower.includes(term));

  // Extract certifications specifically
  const certList = getCertifications();
  const certs = certList.filter(cert => lower.includes(cert));

  // Extract tools specifically
  const toolList = getTools();
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
```

- [ ] **Step 3: Run tests**

```bash
cd /home/poorajith/My_Volume/CodeBase/Techiee/packages/backend && pnpm test -- src/documents/__tests__/extractor.test.ts
```
Expected: PASS — all 6 tests

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/documents/extractor.ts packages/backend/src/documents/__tests__/extractor.test.ts
git commit -m "feat: add structured profile data extractor with skill/title/cert/experience extraction"
```

---

### Task 6: Document upload API route

**Files:**
- Create: `packages/backend/src/api/routes/documents.ts`

- [ ] **Step 1: Write the documents router**

Create `packages/backend/src/api/routes/documents.ts`:

```typescript
import { Router } from 'express';
import multer from 'multer';
import { extractTextFromPdf } from '../../documents/parser.js';
import { extractProfileData } from '../../documents/extractor.js';
import type { createQueries } from '../../db/queries.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted'));
    }
  },
});

export function createDocumentsRouter(queries: ReturnType<typeof createQueries>) {
  const router = Router();

  // POST /api/documents/upload
  router.post('/upload', upload.single('file'), async (req, res, next) => {
    try {
      const file = req.file;
      const type = req.body.type as string;

      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }
      if (!type || !['resume', 'linkedin'].includes(type)) {
        res.status(400).json({ error: 'Type must be "resume" or "linkedin"' });
        return;
      }

      // Extract text from PDF
      const rawText = await extractTextFromPdf(file.buffer);

      // Extract structured data
      const profile = extractProfileData(rawText);

      // Delete existing document of same type (re-upload replaces)
      queries.deleteDocumentByType(type);

      // Insert new document
      const doc = queries.insertDocument({
        type,
        filename: file.originalname,
        rawText,
        parsedSkills: JSON.stringify(profile.skills),
        parsedTitles: JSON.stringify(profile.titles),
        parsedCerts: JSON.stringify(profile.certs),
        parsedExperienceYears: profile.experienceYears,
        parsedLocations: JSON.stringify(profile.locations),
        parsedIndustries: JSON.stringify(profile.industries),
        parsedTools: JSON.stringify(profile.tools),
        parsedEducation: profile.education ? JSON.stringify(profile.education) : null,
      });

      res.json({
        message: 'Document uploaded and parsed',
        document: {
          type,
          filename: file.originalname,
          skills: profile.skills,
          titles: profile.titles,
          certs: profile.certs,
          experienceYears: profile.experienceYears,
          locations: profile.locations,
          industries: profile.industries,
          tools: profile.tools,
          education: profile.education,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/documents
  router.get('/', (_req, res) => {
    const docs = queries.getDocuments();
    res.json(docs);
  });

  // DELETE /api/documents/:id
  router.delete('/:id', (req, res) => {
    queries.deleteDocument(parseInt(req.params.id, 10));
    res.json({ message: 'Document deleted' });
  });

  return router;
}
```

- [ ] **Step 2: Add document query helpers to queries.ts**

Add these methods to the `createQueries` function in `packages/backend/src/db/queries.ts`:

```typescript
// Documents
getDocuments() {
  return db.select().from(schema.documents).all();
},

getDocumentsByType(type: string) {
  return db.select().from(schema.documents).where(eq(schema.documents.type, type)).all();
},

insertDocument(data: {
  type: string;
  filename: string;
  rawText: string;
  parsedSkills: string | null;
  parsedTitles: string | null;
  parsedCerts: string | null;
  parsedExperienceYears: number;
  parsedLocations: string | null;
  parsedIndustries: string | null;
  parsedTools: string | null;
  parsedEducation: string | null;
}) {
  return db.insert(schema.documents).values(data).run();
},

deleteDocument(id: number) {
  return db.delete(schema.documents).where(eq(schema.documents.id, id)).run();
},

deleteDocumentByType(type: string) {
  return db.delete(schema.documents).where(eq(schema.documents.type, type)).run();
},

getMergedProfile() {
  const docs = db.select().from(schema.documents).all();
  const allSkills = new Set<string>();
  const allTitles = new Set<string>();
  const allCerts = new Set<string>();
  const allLocations = new Set<string>();
  const allTools = new Set<string>();
  const allIndustries = new Set<string>();
  let maxYears = 0;

  for (const doc of docs) {
    if (doc.parsedSkills) JSON.parse(doc.parsedSkills).forEach((s: string) => allSkills.add(s));
    if (doc.parsedTitles) JSON.parse(doc.parsedTitles).forEach((t: string) => allTitles.add(t));
    if (doc.parsedCerts) JSON.parse(doc.parsedCerts).forEach((c: string) => allCerts.add(c));
    if (doc.parsedLocations) JSON.parse(doc.parsedLocations).forEach((l: string) => allLocations.add(l));
    if (doc.parsedTools) JSON.parse(doc.parsedTools).forEach((t: string) => allTools.add(t));
    if (doc.parsedIndustries) JSON.parse(doc.parsedIndustries).forEach((i: string) => allIndustries.add(i));
    if (doc.parsedExperienceYears && doc.parsedExperienceYears > maxYears) {
      maxYears = doc.parsedExperienceYears;
    }
  }

  return {
    skills: [...allSkills],
    titles: [...allTitles],
    certs: [...allCerts],
    locations: [...allLocations],
    tools: [...allTools],
    industries: [...allIndustries],
    experienceYears: maxYears,
  };
},
```

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/api/routes/documents.ts packages/backend/src/db/queries.ts
git commit -m "feat: add document upload route with PDF parsing and query helpers"
```

---

## Chunk 3: IPE Scoring Engine (PARALLEL after Chunk 1)

### Task 7: Individual dimension scorers

**Files:**
- Create: `packages/backend/src/ipe/freshness.ts`
- Create: `packages/backend/src/ipe/skill-match.ts`
- Create: `packages/backend/src/ipe/title-align.ts`
- Create: `packages/backend/src/ipe/cert-match.ts`
- Create: `packages/backend/src/ipe/competition.ts`
- Create: `packages/backend/src/ipe/location-match.ts`
- Create: `packages/backend/src/ipe/experience.ts`
- Test: `packages/backend/src/ipe/__tests__/dimensions.test.ts`

- [ ] **Step 1: Write dimension tests**

Create `packages/backend/src/ipe/__tests__/dimensions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { scoreFreshness } from '../freshness.js';
import { scoreSkillMatch } from '../skill-match.js';
import { scoreTitleAlignment } from '../title-align.js';
import { scoreCertMatch } from '../cert-match.js';
import { scoreCompetition } from '../competition.js';
import { scoreLocationMatch } from '../location-match.js';
import { scoreExperience } from '../experience.js';

describe('Freshness Score', () => {
  it('scores 100 for very recent posts', () => {
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
    expect(scoreFreshness(threeHoursAgo)).toBe(100);
  });

  it('scores 95 for posts within 24h', () => {
    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
    expect(scoreFreshness(twelveHoursAgo)).toBe(95);
  });

  it('scores 0 for posts older than 14 days', () => {
    const now = new Date();
    const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
    expect(scoreFreshness(twentyDaysAgo)).toBe(0);
  });

  it('scores 40 for null posted_at', () => {
    expect(scoreFreshness(null)).toBe(40);
  });
});

describe('Skill Match Score', () => {
  it('scores high for good overlap', () => {
    const profileSkills = ['agile', 'python', 'sql', 'jira', 'aws'];
    const jobDescription = 'Looking for someone with Python, SQL, and Jira experience. AWS knowledge a plus.';
    const result = scoreSkillMatch(profileSkills, jobDescription);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.matchedSkills.length).toBeGreaterThanOrEqual(3);
  });

  it('scores 0 for no overlap', () => {
    const profileSkills = ['agile', 'python'];
    const jobDescription = 'Looking for a chef with culinary experience';
    const result = scoreSkillMatch(profileSkills, jobDescription);
    expect(result.score).toBe(0);
  });

  it('never exceeds 100', () => {
    const profileSkills = ['python'];
    const jobDescription = 'Python Python Python developer with Python skills and Python expertise';
    const result = scoreSkillMatch(profileSkills, jobDescription);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe('Title Alignment Score', () => {
  it('scores 100 for exact match', () => {
    expect(scoreTitleAlignment(['Project Manager'], 'Project Manager', {})).toBe(100);
  });

  it('scores 85 for contains match', () => {
    expect(scoreTitleAlignment(['Project Manager'], 'Senior Project Manager', {})).toBe(85);
  });

  it('scores 40 for synonym match', () => {
    const synonyms = { 'project manager': ['program manager', 'pm'] };
    expect(scoreTitleAlignment(['Project Manager'], 'Program Manager', synonyms)).toBe(40);
  });

  it('scores 0 for no match', () => {
    expect(scoreTitleAlignment(['Project Manager'], 'Chef', {})).toBe(0);
  });
});

describe('Cert Match Score', () => {
  it('scores 100 when all job certs matched', () => {
    expect(scoreCertMatch(['capm', 'pmi-acp', 'safe'], 'Requires CAPM and SAFe certification')).toBe(100);
  });

  it('scores 70 when job mentions no certs', () => {
    expect(scoreCertMatch(['capm'], 'A great PM role with no specific cert requirements')).toBe(70);
  });

  it('scores 20 when job requires cert you lack', () => {
    expect(scoreCertMatch(['capm'], 'Requires PMP certification')).toBe(20);
  });
});

describe('Competition Score', () => {
  it('scores 100 for < 10 applicants', () => {
    expect(scoreCompetition(5)).toBe(100);
  });

  it('scores 10 for 100+ applicants', () => {
    expect(scoreCompetition(150)).toBe(10);
  });

  it('scores 50 for null applicants', () => {
    expect(scoreCompetition(null)).toBe(50);
  });
});

describe('Location Match Score', () => {
  it('scores 100 for exact city match', () => {
    expect(scoreLocationMatch(['Worcester, MA'], 'Worcester, MA')).toBe(100);
  });

  it('scores 90 for remote job when profile allows remote', () => {
    expect(scoreLocationMatch(['Worcester, MA', 'Remote'], 'Remote')).toBe(90);
  });

  it('scores 70 for same state', () => {
    expect(scoreLocationMatch(['Worcester, MA'], 'Boston, MA')).toBe(70);
  });

  it('scores 10 for different state no remote', () => {
    expect(scoreLocationMatch(['Worcester, MA'], 'New York, NY')).toBe(10);
  });
});

describe('Experience Score', () => {
  it('scores 100 for perfect match', () => {
    expect(scoreExperience(6, '5+ years of project management experience')).toBe(100);
  });

  it('scores 70 for no requirement stated', () => {
    expect(scoreExperience(6, 'A great PM role')).toBe(70);
  });

  it('scores lower for under-qualified', () => {
    expect(scoreExperience(2, '10+ years of experience required')).toBeLessThan(50);
  });
});
```

- [ ] **Step 2: Create all 7 scorer files**

Create `packages/backend/src/ipe/freshness.ts`:

```typescript
export function scoreFreshness(postedAt: string | null): number {
  if (!postedAt) return 40;

  const now = Date.now();
  const posted = new Date(postedAt).getTime();
  const hoursAgo = (now - posted) / (1000 * 60 * 60);

  if (hoursAgo < 6) return 100;
  if (hoursAgo < 24) return 95;
  if (hoursAgo < 48) return 72;
  if (hoursAgo < 72) return 52;
  if (hoursAgo < 168) return 25; // 7 days
  if (hoursAgo < 336) return 10; // 14 days
  return 0;
}
```

Create `packages/backend/src/ipe/skill-match.ts`:

```typescript
import { PorterStemmer, WordTokenizer } from 'natural';

const tokenizer = new WordTokenizer();
const stopwords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or', 'not', 'no', 'nor', 'so', 'yet', 'both', 'either', 'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such', 'than', 'too', 'very', 'just', 'because', 'if', 'when', 'where', 'how', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'it', 'its']);

export function scoreSkillMatch(
  profileSkills: string[],
  jobDescription: string
): { score: number; matchedSkills: string[] } {
  if (profileSkills.length === 0) return { score: 0, matchedSkills: [] };

  const jobLower = jobDescription.toLowerCase();
  const jobTokens = tokenizer.tokenize(jobLower) || [];
  const jobStemmed = new Set(jobTokens.filter(t => !stopwords.has(t)).map(t => PorterStemmer.stem(t)));
  const jobText = jobLower; // Keep original for exact multi-word matches

  const matchedSkills: string[] = [];

  for (const skill of profileSkills) {
    const skillLower = skill.toLowerCase();
    // Try exact multi-word match first (e.g., "power bi", "ms project")
    if (jobText.includes(skillLower)) {
      matchedSkills.push(skill);
      continue;
    }
    // Try stemmed single-word match
    const skillStemmed = PorterStemmer.stem(skillLower);
    if (jobStemmed.has(skillStemmed)) {
      matchedSkills.push(skill);
    }
  }

  // Base score: Jaccard-style ratio
  let score = Math.round((matchedSkills.length / profileSkills.length) * 100);

  // Bonus for exact tool matches (tools are more specific than general skills)
  const toolBonus = matchedSkills.filter(s =>
    jobText.includes(s.toLowerCase()) && s.includes(' ') // multi-word = likely a specific tool
  ).length * 5;

  score = Math.min(100, score + toolBonus);

  return { score, matchedSkills };
}
```

Create `packages/backend/src/ipe/title-align.ts`:

```typescript
export function scoreTitleAlignment(
  targetTitles: string[],
  jobTitle: string,
  synonyms: Record<string, string[]>
): number {
  const jobLower = jobTitle.toLowerCase().trim();
  let bestScore = 0;

  for (const target of targetTitles) {
    const targetLower = target.toLowerCase().trim();

    // Exact match
    if (jobLower === targetLower) return 100;

    // Contains match (job title contains target or vice versa)
    if (jobLower.includes(targetLower) || targetLower.includes(jobLower)) {
      bestScore = Math.max(bestScore, 85);
      continue;
    }

    // Word overlap
    const targetWords = targetLower.split(/\s+/);
    const jobWords = jobLower.split(/\s+/);
    const overlap = targetWords.filter(w => jobWords.includes(w)).length;
    const overlapRatio = overlap / Math.max(targetWords.length, 1);
    if (overlapRatio >= 0.5) {
      bestScore = Math.max(bestScore, 60);
      continue;
    }

    // Synonym match
    const targetSynonyms = synonyms[targetLower] || [];
    for (const syn of targetSynonyms) {
      if (jobLower.includes(syn.toLowerCase()) || syn.toLowerCase().includes(jobLower)) {
        bestScore = Math.max(bestScore, 40);
        break;
      }
    }
  }

  return bestScore;
}
```

Create `packages/backend/src/ipe/cert-match.ts`:

```typescript
export function scoreCertMatch(profileCerts: string[], jobDescription: string): number {
  const jobLower = jobDescription.toLowerCase();

  // Find which certs are mentioned in the job description
  const allKnownCerts = [
    'pmp', 'capm', 'pmi-acp', 'safe', 'csm', 'psm', 'itil',
    'prince2', 'six sigma', 'cissp', 'cism', 'comptia',
  ];

  const jobCerts = allKnownCerts.filter(cert => jobLower.includes(cert));

  // If job mentions no certs, neutral score
  if (jobCerts.length === 0) return 70;

  // Check how many job-required certs you have
  const profileCertsLower = profileCerts.map(c => c.toLowerCase());
  const matched = jobCerts.filter(jc => profileCertsLower.some(pc => pc.includes(jc) || jc.includes(pc)));

  if (matched.length === jobCerts.length) return 100;
  if (matched.length > 0) return 50 + Math.round((matched.length / jobCerts.length) * 40);
  return 20; // Job requires certs you don't have
}
```

Create `packages/backend/src/ipe/competition.ts`:

```typescript
export function scoreCompetition(applicants: number | null): number {
  if (applicants === null) return 50;
  if (applicants < 10) return 100;
  if (applicants < 25) return 85;
  if (applicants < 50) return 60;
  if (applicants < 100) return 30;
  return 10;
}
```

Create `packages/backend/src/ipe/location-match.ts`:

```typescript
export function scoreLocationMatch(targetLocations: string[], jobLocation: string | null): number {
  if (!jobLocation) return 50;

  const jobLower = jobLocation.toLowerCase().trim();
  const targets = targetLocations.map(l => l.toLowerCase().trim());

  // Check for remote
  if (jobLower.includes('remote') && targets.some(t => t === 'remote')) return 90;

  // Check for exact city match
  for (const target of targets) {
    if (target === 'remote') continue;
    if (jobLower.includes(target) || target.includes(jobLower)) return 100;
  }

  // Check for same state
  const jobState = extractState(jobLower);
  if (jobState) {
    for (const target of targets) {
      const targetState = extractState(target);
      if (targetState && targetState === jobState) return 70;
    }
  }

  // Remote job but profile doesn't list remote
  if (jobLower.includes('remote')) return 60;

  return 10;
}

function extractState(location: string): string | null {
  const match = location.match(/,\s*([a-z]{2})\b/);
  return match ? match[1] : null;
}
```

Create `packages/backend/src/ipe/experience.ts`:

```typescript
export function scoreExperience(candidateYears: number, jobDescription: string): number {
  const jobLower = jobDescription.toLowerCase();

  // Extract years requirement from job description
  const yearsMatch = jobLower.match(/(\d+)\+?\s*(?:years?|yrs?)\s*(?:of)?\s*(?:experience|exp)/);
  if (!yearsMatch) return 70; // No requirement stated

  const required = parseInt(yearsMatch[1]);
  const diff = candidateYears - required;

  if (diff >= 0 && diff <= 2) return 100;  // Perfect match
  if (diff > 2 && diff <= 4) return 80;    // Slightly over-qualified
  if (diff > 4) return 40;                  // Significantly over-qualified
  if (diff >= -2) return 50;               // Under-qualified by 1-2 years
  return 20;                                // Significantly under-qualified
}
```

- [ ] **Step 3: Run tests**

```bash
cd /home/poorajith/My_Volume/CodeBase/Techiee/packages/backend && pnpm test -- src/ipe/__tests__/dimensions.test.ts
```
Expected: PASS — all tests

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/ipe/
git commit -m "feat: add 7 IPE dimension scorers with tests"
```

---

### Task 8: IPE scoring orchestrator

**Files:**
- Create: `packages/backend/src/ipe/index.ts`
- Test: `packages/backend/src/ipe/__tests__/orchestrator.test.ts`

- [ ] **Step 1: Write orchestrator test**

Create `packages/backend/src/ipe/__tests__/orchestrator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { calculateIpeScore, type ProfileConfig, type JobData } from '../index.js';

const mockProfile: ProfileConfig = {
  targetTitles: ['Project Manager'],
  targetSkills: ['agile', 'python', 'sql', 'jira'],
  targetCerts: ['capm', 'pmi-acp'],
  targetLocations: ['Worcester, MA', 'Remote'],
  experienceYears: 6,
  titleSynonyms: { 'project manager': ['program manager', 'pm'] },
  weights: {
    freshness: 0.25, skill: 0.25, title: 0.15, cert: 0.10,
    competition: 0.10, location: 0.10, experience: 0.05,
  },
};

describe('IPE Scoring Orchestrator', () => {
  it('calculates composite score for a good match', () => {
    const job: JobData = {
      title: 'Senior Project Manager',
      description: 'Looking for a PM with Agile, Python, SQL, and Jira experience. CAPM preferred. 5+ years.',
      location: 'Worcester, MA',
      postedAt: new Date().toISOString(),
      applicants: 8,
    };

    const result = calculateIpeScore(mockProfile, job);
    expect(result.ipeScore).toBeGreaterThan(70);
    expect(result.dimensions.freshnessScore).toBeGreaterThan(90);
    expect(result.dimensions.skillMatchScore).toBeGreaterThan(50);
    expect(result.dimensions.titleAlignmentScore).toBe(85);
    expect(result.dimensions.locationMatchScore).toBe(100);
    expect(result.matchedSkills.length).toBeGreaterThan(2);
  });

  it('calculates low score for poor match', () => {
    const job: JobData = {
      title: 'Chef',
      description: 'Looking for a culinary expert for our kitchen',
      location: 'New York, NY',
      postedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      applicants: 200,
    };

    const result = calculateIpeScore(mockProfile, job);
    expect(result.ipeScore).toBeLessThan(30);
  });

  it('returns all dimension scores', () => {
    const job: JobData = {
      title: 'PM',
      description: 'A PM role',
      location: null,
      postedAt: null,
      applicants: null,
    };

    const result = calculateIpeScore(mockProfile, job);
    expect(result.dimensions).toHaveProperty('freshnessScore');
    expect(result.dimensions).toHaveProperty('skillMatchScore');
    expect(result.dimensions).toHaveProperty('titleAlignmentScore');
    expect(result.dimensions).toHaveProperty('certMatchScore');
    expect(result.dimensions).toHaveProperty('competitionScore');
    expect(result.dimensions).toHaveProperty('locationMatchScore');
    expect(result.dimensions).toHaveProperty('experienceAlignScore');
    expect(result.ipeScore).toBeGreaterThanOrEqual(0);
    expect(result.ipeScore).toBeLessThanOrEqual(100);
  });
});
```

- [ ] **Step 2: Write the orchestrator**

Create `packages/backend/src/ipe/index.ts`:

```typescript
import { scoreFreshness } from './freshness.js';
import { scoreSkillMatch } from './skill-match.js';
import { scoreTitleAlignment } from './title-align.js';
import { scoreCertMatch } from './cert-match.js';
import { scoreCompetition } from './competition.js';
import { scoreLocationMatch } from './location-match.js';
import { scoreExperience } from './experience.js';

export interface ProfileConfig {
  targetTitles: string[];
  targetSkills: string[];
  targetCerts: string[];
  targetLocations: string[];
  experienceYears: number;
  titleSynonyms: Record<string, string[]>;
  weights: {
    freshness: number;
    skill: number;
    title: number;
    cert: number;
    competition: number;
    location: number;
    experience: number;
  };
}

export interface JobData {
  title: string;
  description: string | null;
  location: string | null;
  postedAt: string | null;
  applicants: number | null;
}

export interface IpeResult {
  ipeScore: number;
  dimensions: {
    freshnessScore: number;
    skillMatchScore: number;
    titleAlignmentScore: number;
    certMatchScore: number;
    competitionScore: number;
    locationMatchScore: number;
    experienceAlignScore: number;
  };
  matchedSkills: string[];
}

export function calculateIpeScore(profile: ProfileConfig, job: JobData): IpeResult {
  const freshnessScore = scoreFreshness(job.postedAt);
  const { score: skillMatchScore, matchedSkills } = scoreSkillMatch(
    profile.targetSkills, job.description || ''
  );
  const titleAlignmentScore = scoreTitleAlignment(
    profile.targetTitles, job.title, profile.titleSynonyms
  );
  const certMatchScore = scoreCertMatch(profile.targetCerts, job.description || '');
  const competitionScore = scoreCompetition(job.applicants);
  const locationMatchScore = scoreLocationMatch(profile.targetLocations, job.location);
  const experienceAlignScore = scoreExperience(profile.experienceYears, job.description || '');

  const { weights } = profile;
  const ipeScore = Math.round(
    freshnessScore * weights.freshness +
    skillMatchScore * weights.skill +
    titleAlignmentScore * weights.title +
    certMatchScore * weights.cert +
    competitionScore * weights.competition +
    locationMatchScore * weights.location +
    experienceAlignScore * weights.experience
  );

  return {
    ipeScore: Math.max(0, Math.min(100, ipeScore)),
    dimensions: {
      freshnessScore,
      skillMatchScore,
      titleAlignmentScore,
      certMatchScore,
      competitionScore,
      locationMatchScore,
      experienceAlignScore,
    },
    matchedSkills,
  };
}
```

- [ ] **Step 3: Run tests**

```bash
cd /home/poorajith/My_Volume/CodeBase/Techiee/packages/backend && pnpm test -- src/ipe/__tests__/orchestrator.test.ts
```
Expected: PASS — all 3 tests

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/ipe/index.ts packages/backend/src/ipe/__tests__/orchestrator.test.ts
git commit -m "feat: add IPE scoring orchestrator combining 7 dimensions"
```

---

## Chunk 4: Profile CRUD & API Routes (PARALLEL after Chunk 1)

### Task 9: Profile query helpers

**Files:**
- Modify: `packages/backend/src/db/queries.ts`

- [ ] **Step 1: Add profile and job_scores query helpers to queries.ts**

Add these methods to the `createQueries` function:

```typescript
// Profiles
getProfiles() {
  return db.select().from(schema.profiles).all();
},

getActiveProfiles() {
  return db.select().from(schema.profiles).where(eq(schema.profiles.isActive, true)).all();
},

getProfileById(id: number) {
  return db.select().from(schema.profiles).where(eq(schema.profiles.id, id)).get();
},

insertProfile(data: {
  name: string;
  targetTitles: string;
  targetSkills: string;
  targetCerts?: string | null;
  targetLocations?: string | null;
  minExperienceYears?: number | null;
  maxExperienceYears?: number | null;
  searchQueries?: string | null;
  titleSynonyms?: string | null;
}) {
  return db.insert(schema.profiles).values(data).returning().get();
},

updateProfile(id: number, data: Partial<{
  name: string;
  targetTitles: string;
  targetSkills: string;
  targetCerts: string | null;
  targetLocations: string | null;
  searchQueries: string | null;
  titleSynonyms: string | null;
  freshnessWeight: number;
  skillWeight: number;
  titleWeight: number;
  certWeight: number;
  competitionWeight: number;
  locationWeight: number;
  experienceWeight: number;
  aiThreshold: number;
  isActive: boolean;
  updatedAt: string;
}>) {
  return db.update(schema.profiles).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(schema.profiles.id, id)).run();
},

deleteProfile(id: number) {
  // Delete associated job_scores first
  db.delete(schema.jobScores).where(eq(schema.jobScores.profileId, id)).run();
  return db.delete(schema.profiles).where(eq(schema.profiles.id, id)).run();
},

// Job Scores
getJobScoresByProfile(profileId: number) {
  return db.select().from(schema.jobScores).where(eq(schema.jobScores.profileId, profileId)).all();
},

getJobScore(jobId: number, profileId: number) {
  return db.select().from(schema.jobScores)
    .where(and(eq(schema.jobScores.jobId, jobId), eq(schema.jobScores.profileId, profileId)))
    .get();
},

upsertJobScore(data: {
  jobId: number;
  profileId: number;
  ipeScore: number;
  freshnessScore: number;
  skillMatchScore: number;
  titleAlignmentScore: number;
  certMatchScore: number;
  competitionScore: number;
  locationMatchScore: number;
  experienceAlignScore: number;
  matchedSkills?: string | null;
}) {
  const existing = db.select().from(schema.jobScores)
    .where(and(eq(schema.jobScores.jobId, data.jobId), eq(schema.jobScores.profileId, data.profileId)))
    .get();

  if (existing) {
    return db.update(schema.jobScores).set({ ...data, scoredAt: new Date().toISOString() })
      .where(eq(schema.jobScores.id, existing.id)).run();
  }
  return db.insert(schema.jobScores).values(data).run();
},

updateJobScoreAi(id: number, data: { aiValidated: boolean; aiAgrees: boolean | null; aiPitch: string | null; aiFlags: string | null }) {
  return db.update(schema.jobScores).set(data).where(eq(schema.jobScores.id, id)).run();
},

getUnscoredJobIds(profileId: number) {
  const scored = db.select({ jobId: schema.jobScores.jobId })
    .from(schema.jobScores)
    .where(eq(schema.jobScores.profileId, profileId))
    .all()
    .map(r => r.jobId);

  return db.select({ id: schema.jobs.id })
    .from(schema.jobs)
    .all()
    .filter(j => !scored.includes(j.id))
    .map(j => j.id);
},

getTopUnvalidatedScores(profileId: number, threshold: number) {
  return db.select().from(schema.jobScores)
    .where(and(
      eq(schema.jobScores.profileId, profileId),
      gte(schema.jobScores.ipeScore, threshold),
      eq(schema.jobScores.aiValidated, false),
    ))
    .orderBy(desc(schema.jobScores.ipeScore))
    .limit(50)
    .all();
},

recalculateIpeScores(profileId: number, weights: {
  freshness: number; skill: number; title: number; cert: number;
  competition: number; location: number; experience: number;
}) {
  const scores = db.select().from(schema.jobScores)
    .where(eq(schema.jobScores.profileId, profileId)).all();

  for (const s of scores) {
    const newIpe = Math.round(
      s.freshnessScore * weights.freshness +
      s.skillMatchScore * weights.skill +
      s.titleAlignmentScore * weights.title +
      s.certMatchScore * weights.cert +
      s.competitionScore * weights.competition +
      s.locationMatchScore * weights.location +
      s.experienceAlignScore * weights.experience
    );
    db.update(schema.jobScores).set({ ipeScore: Math.max(0, Math.min(100, newIpe)) })
      .where(eq(schema.jobScores.id, s.id)).run();
  }
  return scores.length;
},
```

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/db/queries.ts
git commit -m "feat: add profile and job_scores query helpers"
```

---

### Task 10: Profile and Score API routes

**Files:**
- Create: `packages/backend/src/api/routes/profiles.ts`
- Create: `packages/backend/src/api/routes/score.ts`
- Modify: `packages/backend/src/api/schemas.ts`

- [ ] **Step 1: Add Zod schemas for profiles**

Append to `packages/backend/src/api/schemas.ts`:

```typescript
export const CreateProfileSchema = z.object({
  name: z.string().min(1),
  targetTitles: z.array(z.string()).min(1),
  targetSkills: z.array(z.string()).min(1),
  targetCerts: z.array(z.string()).optional(),
  targetLocations: z.array(z.string()).optional(),
  minExperienceYears: z.number().optional(),
  maxExperienceYears: z.number().optional(),
  searchQueries: z.array(z.string()).optional(),
  titleSynonyms: z.record(z.array(z.string())).optional(),
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  targetTitles: z.array(z.string()).min(1).optional(),
  targetSkills: z.array(z.string()).min(1).optional(),
  targetCerts: z.array(z.string()).optional(),
  targetLocations: z.array(z.string()).optional(),
  searchQueries: z.array(z.string()).optional(),
  titleSynonyms: z.record(z.array(z.string())).optional(),
  freshnessWeight: z.number().min(0).max(1).optional(),
  skillWeight: z.number().min(0).max(1).optional(),
  titleWeight: z.number().min(0).max(1).optional(),
  certWeight: z.number().min(0).max(1).optional(),
  competitionWeight: z.number().min(0).max(1).optional(),
  locationWeight: z.number().min(0).max(1).optional(),
  experienceWeight: z.number().min(0).max(1).optional(),
  aiThreshold: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
}).refine(data => {
  const weights = [data.freshnessWeight, data.skillWeight, data.titleWeight,
    data.certWeight, data.competitionWeight, data.locationWeight, data.experienceWeight]
    .filter(w => w !== undefined);
  if (weights.length === 7) {
    const sum = weights.reduce((a, b) => a + b!, 0);
    return Math.abs(sum - 1.0) < 0.01;
  }
  return true; // Partial updates don't need to sum to 1.0
}, { message: 'Weights must sum to 1.0 when all 7 are provided' });
```

- [ ] **Step 2: Create profiles router**

Create `packages/backend/src/api/routes/profiles.ts`:

```typescript
import { Router } from 'express';
import { CreateProfileSchema, UpdateProfileSchema } from '../schemas.js';
import type { createQueries } from '../../db/queries.js';

export function createProfilesRouter(queries: ReturnType<typeof createQueries>) {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(queries.getProfiles());
  });

  router.get('/:id', (req, res) => {
    const profile = queries.getProfileById(parseInt(req.params.id, 10));
    if (!profile) { res.status(404).json({ error: 'Profile not found' }); return; }
    res.json(profile);
  });

  router.post('/', (req, res, next) => {
    try {
      const parsed = CreateProfileSchema.parse(req.body);
      const profile = queries.insertProfile({
        name: parsed.name,
        targetTitles: JSON.stringify(parsed.targetTitles),
        targetSkills: JSON.stringify(parsed.targetSkills),
        targetCerts: parsed.targetCerts ? JSON.stringify(parsed.targetCerts) : null,
        targetLocations: parsed.targetLocations ? JSON.stringify(parsed.targetLocations) : null,
        searchQueries: parsed.searchQueries ? JSON.stringify(parsed.searchQueries) : null,
        titleSynonyms: parsed.titleSynonyms ? JSON.stringify(parsed.titleSynonyms) : null,
      });
      res.status(201).json(profile);
    } catch (err) { next(err); }
  });

  router.patch('/:id', (req, res, next) => {
    try {
      const parsed = UpdateProfileSchema.parse(req.body);
      const id = parseInt(req.params.id, 10);
      const updates: Record<string, any> = {};

      if (parsed.name) updates.name = parsed.name;
      if (parsed.targetTitles) updates.targetTitles = JSON.stringify(parsed.targetTitles);
      if (parsed.targetSkills) updates.targetSkills = JSON.stringify(parsed.targetSkills);
      if (parsed.targetCerts !== undefined) updates.targetCerts = parsed.targetCerts ? JSON.stringify(parsed.targetCerts) : null;
      if (parsed.targetLocations !== undefined) updates.targetLocations = parsed.targetLocations ? JSON.stringify(parsed.targetLocations) : null;
      if (parsed.searchQueries !== undefined) updates.searchQueries = parsed.searchQueries ? JSON.stringify(parsed.searchQueries) : null;
      if (parsed.titleSynonyms !== undefined) updates.titleSynonyms = parsed.titleSynonyms ? JSON.stringify(parsed.titleSynonyms) : null;
      if (parsed.freshnessWeight !== undefined) updates.freshnessWeight = parsed.freshnessWeight;
      if (parsed.skillWeight !== undefined) updates.skillWeight = parsed.skillWeight;
      if (parsed.titleWeight !== undefined) updates.titleWeight = parsed.titleWeight;
      if (parsed.certWeight !== undefined) updates.certWeight = parsed.certWeight;
      if (parsed.competitionWeight !== undefined) updates.competitionWeight = parsed.competitionWeight;
      if (parsed.locationWeight !== undefined) updates.locationWeight = parsed.locationWeight;
      if (parsed.experienceWeight !== undefined) updates.experienceWeight = parsed.experienceWeight;
      if (parsed.aiThreshold !== undefined) updates.aiThreshold = parsed.aiThreshold;
      if (parsed.isActive !== undefined) updates.isActive = parsed.isActive;

      // If only weights changed, recalculate IPE scores without full re-score
      const weightKeys = ['freshnessWeight', 'skillWeight', 'titleWeight', 'certWeight', 'competitionWeight', 'locationWeight', 'experienceWeight'];
      const onlyWeightsChanged = Object.keys(updates).every(k => weightKeys.includes(k) || k === 'updatedAt');

      queries.updateProfile(id, updates);

      if (onlyWeightsChanged && weightKeys.some(k => k in updates)) {
        const profile = queries.getProfileById(id);
        if (profile) {
          queries.recalculateIpeScores(id, {
            freshness: profile.freshnessWeight,
            skill: profile.skillWeight,
            title: profile.titleWeight,
            cert: profile.certWeight,
            competition: profile.competitionWeight,
            location: profile.locationWeight,
            experience: profile.experienceWeight,
          });
        }
      }

      res.json(queries.getProfileById(id));
    } catch (err) { next(err); }
  });

  router.delete('/:id', (req, res) => {
    queries.deleteProfile(parseInt(req.params.id, 10));
    res.json({ message: 'Profile and associated scores deleted' });
  });

  // Auto-populate from documents
  router.post('/:id/auto-populate', (req, res) => {
    const merged = queries.getMergedProfile();
    const id = parseInt(req.params.id, 10);
    queries.updateProfile(id, {
      targetSkills: JSON.stringify(merged.skills),
      targetCerts: JSON.stringify(merged.certs),
      targetLocations: JSON.stringify(merged.locations),
    });
    res.json({ message: 'Profile auto-populated from documents', merged });
  });

  return router;
}
```

- [ ] **Step 3: Create score router**

Create `packages/backend/src/api/routes/score.ts`:

```typescript
import { Router } from 'express';
import { calculateIpeScore, type ProfileConfig, type JobData } from '../../ipe/index.js';
import type { createQueries } from '../../db/queries.js';

export function createScoreRouter(queries: ReturnType<typeof createQueries>) {
  const router = Router();

  // POST /api/score/ipe/:profileId — run IPE scoring
  router.post('/ipe/:profileId', async (req, res, next) => {
    try {
      const profileId = parseInt(req.params.profileId, 10);
      const profile = queries.getProfileById(profileId);
      if (!profile) { res.status(404).json({ error: 'Profile not found' }); return; }

      const config: ProfileConfig = {
        targetTitles: JSON.parse(profile.targetTitles),
        targetSkills: JSON.parse(profile.targetSkills),
        targetCerts: profile.targetCerts ? JSON.parse(profile.targetCerts) : [],
        targetLocations: profile.targetLocations ? JSON.parse(profile.targetLocations) : [],
        experienceYears: profile.minExperienceYears || 0,
        titleSynonyms: profile.titleSynonyms ? JSON.parse(profile.titleSynonyms) : {},
        weights: {
          freshness: profile.freshnessWeight,
          skill: profile.skillWeight,
          title: profile.titleWeight,
          cert: profile.certWeight,
          competition: profile.competitionWeight,
          location: profile.locationWeight,
          experience: profile.experienceWeight,
        },
      };

      // Get unscored job IDs
      const unscoredIds = queries.getUnscoredJobIds(profileId);
      let scored = 0;

      for (const jobId of unscoredIds) {
        const job = queries.getJobById(jobId);
        if (!job) continue;

        const jobData: JobData = {
          title: job.title,
          description: job.description,
          location: job.location,
          postedAt: job.postedAt,
          applicants: job.applicants,
        };

        const result = calculateIpeScore(config, jobData);

        queries.upsertJobScore({
          jobId,
          profileId,
          ipeScore: result.ipeScore,
          freshnessScore: result.dimensions.freshnessScore,
          skillMatchScore: result.dimensions.skillMatchScore,
          titleAlignmentScore: result.dimensions.titleAlignmentScore,
          certMatchScore: result.dimensions.certMatchScore,
          competitionScore: result.dimensions.competitionScore,
          locationMatchScore: result.dimensions.locationMatchScore,
          experienceAlignScore: result.dimensions.experienceAlignScore,
          matchedSkills: JSON.stringify(result.matchedSkills),
        });

        scored++;
      }

      res.json({ scored, total: unscoredIds.length });
    } catch (err) { next(err); }
  });

  // POST /api/score/ai/:profileId — AI validate top matches
  router.post('/ai/:profileId', async (req, res, next) => {
    try {
      const profileId = parseInt(req.params.profileId, 10);
      const profile = queries.getProfileById(profileId);
      if (!profile) { res.status(404).json({ error: 'Profile not found' }); return; }

      const topScores = queries.getTopUnvalidatedScores(profileId, profile.aiThreshold);
      // AI validation will be wired in Chunk 5 integration
      res.json({ eligible: topScores.length, message: 'AI validation placeholder — will be wired in integration step' });
    } catch (err) { next(err); }
  });

  // POST /api/score/all/:profileId — IPE + AI
  router.post('/all/:profileId', async (req, res, next) => {
    try {
      // First run IPE
      const ipeRes = await fetch(`http://localhost:${process.env.PORT || 3001}/api/score/ipe/${req.params.profileId}`, { method: 'POST' });
      const ipeData = await ipeRes.json();

      // Then run AI
      const aiRes = await fetch(`http://localhost:${process.env.PORT || 3001}/api/score/ai/${req.params.profileId}`, { method: 'POST' });
      const aiData = await aiRes.json();

      res.json({ ipe: ipeData, ai: aiData });
    } catch (err) { next(err); }
  });

  return router;
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/api/routes/profiles.ts packages/backend/src/api/routes/score.ts packages/backend/src/api/schemas.ts
git commit -m "feat: add profile CRUD and IPE scoring API routes"
```

---

## Chunk 5: Server Wiring & Modified Routes

### Task 11: Wire new routes into server.ts + modify existing routes

**Files:**
- Modify: `packages/backend/src/api/server.ts`
- Modify: `packages/backend/src/api/routes/jobs.ts`
- Modify: `packages/backend/src/api/routes/stats.ts`

- [ ] **Step 1: Add new routes to server.ts**

Add imports and mount points in `packages/backend/src/api/server.ts`:

```typescript
import { createDocumentsRouter } from './routes/documents.js';
import { createProfilesRouter } from './routes/profiles.js';
import { createScoreRouter } from './routes/score.js';

// Add after existing route mounts:
app.use('/api/documents', createDocumentsRouter(queries));
app.use('/api/profiles', createProfilesRouter(queries));
app.use('/api/score', createScoreRouter(queries));
```

- [ ] **Step 2: Modify jobs route to support profileId**

Update `packages/backend/src/api/routes/jobs.ts` — add `profileId` query param support to `GET /` and `GET /:id`. When `profileId` is set, join with `job_scores` table.

The exact modification depends on the current `queries.getJobs()` implementation — add optional profileId parameter that LEFT JOINs job_scores when provided, adding `ipeScore`, `matchedSkills`, `aiValidated`, `aiPitch` fields to the response.

- [ ] **Step 3: Modify stats route to support profileId**

Update `packages/backend/src/api/routes/stats.ts` — add `profileId` query param. When set, return profile-scoped stats (avg IPE score, count of scored jobs, count of AI-validated, top-scored count).

- [ ] **Step 4: Verify server starts**

```bash
cd /home/poorajith/My_Volume/CodeBase/Techiee/packages/backend && timeout 5 pnpm start 2>&1 || true
```
Expected: Server starts with no import errors

- [ ] **Step 5: Run all tests**

```bash
cd /home/poorajith/My_Volume/CodeBase/Techiee/packages/backend && pnpm test
```
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/api/
git commit -m "feat: wire document, profile, and score routes into server"
```

---

## Chunk 6: Frontend Updates (PARALLEL after Chunk 5)

### Task 12: Update frontend types and API client

**Files:**
- Modify: `packages/frontend/src/api/types.ts`
- Modify: `packages/frontend/src/api/client.ts`

- [ ] **Step 1: Add new types**

Add to `packages/frontend/src/api/types.ts`:

```typescript
export interface Document {
  id: number;
  type: string;
  filename: string;
  parsed_skills: string | null;
  parsed_titles: string | null;
  parsed_certs: string | null;
  parsed_experience_years: number | null;
  parsed_locations: string | null;
  parsed_tools: string | null;
  uploaded_at: string;
}

export interface Profile {
  id: number;
  name: string;
  target_titles: string;
  target_skills: string;
  target_certs: string | null;
  target_locations: string | null;
  search_queries: string | null;
  freshness_weight: number;
  skill_weight: number;
  title_weight: number;
  cert_weight: number;
  competition_weight: number;
  location_weight: number;
  experience_weight: number;
  ai_threshold: number;
  is_active: boolean;
}

export interface JobScore {
  ipe_score: number;
  freshness_score: number;
  skill_match_score: number;
  title_alignment_score: number;
  cert_match_score: number;
  competition_score: number;
  location_match_score: number;
  experience_align_score: number;
  matched_skills: string | null;
  ai_validated: boolean;
  ai_agrees: boolean | null;
  ai_pitch: string | null;
  ai_flags: string | null;
}
```

- [ ] **Step 2: Add API methods**

Add to `packages/frontend/src/api/client.ts`:

```typescript
export const documentsApi = {
  list: () => api.get<Document[]>('/documents').then(r => r.data),
  upload: (file: File, type: 'resume' | 'linkedin') => {
    const form = new FormData();
    form.append('file', file);
    form.append('type', type);
    return api.post('/documents/upload', form).then(r => r.data);
  },
  remove: (id: number) => api.delete(`/documents/${id}`).then(r => r.data),
};

export const profilesApi = {
  list: () => api.get<Profile[]>('/profiles').then(r => r.data),
  get: (id: number) => api.get<Profile>(`/profiles/${id}`).then(r => r.data),
  create: (data: any) => api.post('/profiles', data).then(r => r.data),
  update: (id: number, data: any) => api.patch(`/profiles/${id}`, data).then(r => r.data),
  remove: (id: number) => api.delete(`/profiles/${id}`).then(r => r.data),
  autoPopulate: (id: number) => api.post(`/profiles/${id}/auto-populate`).then(r => r.data),
};

export const scoreApi = {
  runIpe: (profileId: number) => api.post(`/score/ipe/${profileId}`).then(r => r.data),
  runAi: (profileId: number) => api.post(`/score/ai/${profileId}`).then(r => r.data),
  runAll: (profileId: number) => api.post(`/score/all/${profileId}`).then(r => r.data),
};
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/api/
git commit -m "feat: add document, profile, and score API types and client methods"
```

---

### Task 13: Frontend components — DocumentUpload, ProfileManager, ScoreBreakdown, TopBar updates

This is the largest frontend task. Create the new components and update existing ones per the spec. The key components are:

**Files to create:**
- `packages/frontend/src/components/DocumentUpload.tsx` — drag-drop PDF upload for resume + LinkedIn
- `packages/frontend/src/components/ProfileManager.tsx` — profile CRUD with weight sliders
- `packages/frontend/src/components/ScoreBreakdown.tsx` — 7-bar dimension chart replacing single score

**Files to modify:**
- `packages/frontend/src/components/TopBar.tsx` — add profile selector dropdown, Score Now, AI Validate buttons
- `packages/frontend/src/components/JobCard.tsx` — show IPE score + freshness indicator
- `packages/frontend/src/components/DetailPanel.tsx` — show score breakdown, AI validation section
- `packages/frontend/src/App.tsx` — add routing/views for document upload and profile manager, wire profile selector

- [ ] **Step 1: Create all new components with the dark analytics theme**

Create DocumentUpload, ProfileManager, ScoreBreakdown components following the dark analytics design language (gradients, accent colors, glass effects).

- [ ] **Step 2: Update TopBar with profile selector and score buttons**

- [ ] **Step 3: Update JobCard to show IPE score and freshness indicator**

- [ ] **Step 4: Update DetailPanel with ScoreBreakdown and AI validation section**

- [ ] **Step 5: Update App.tsx to wire new views and profile state**

- [ ] **Step 6: Verify build**

```bash
cd /home/poorajith/My_Volume/CodeBase/Techiee/packages/frontend && pnpm build
```
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/src/
git commit -m "feat: add document upload, profile manager, score breakdown, and profile selector"
```

---

## Chunk 7: Scraper/Cron Integration & Data Migration (PARALLEL after Chunk 5)

### Task 14: Dynamic scraper queries from profiles

**Files:**
- Modify: `packages/backend/src/sources/indeed.ts`
- Modify: `packages/backend/src/sources/google-jobs.ts`
- Modify: `packages/backend/src/sources/ziprecruiter.ts`
- Modify: `packages/backend/src/sources/index.ts`

- [ ] **Step 1: Add `searchQueries` parameter to scrapers**

Update `scrapeIndeed(page)` → `scrapeIndeed(page, searchQueries?: string[])` — if provided, use them instead of hardcoded queries.

Same for `scrapeGoogleJobs` and `scrapeZipRecruiter`.

Update `runAllSources(companies)` → `runAllSources(companies, searchQueries?: string[])` — passes queries through to scrapers.

- [ ] **Step 2: Update triggerScrape in server.ts**

Modify `triggerScrape` to collect union of all active profiles' search queries and pass to `runAllSources`.

- [ ] **Step 3: Update cron scheduler**

Modify cron to: scrape → IPE score all active profiles → AI validate top per profile.

- [ ] **Step 4: Update outreach prompts**

Modify `buildOutreachPrompt` to accept profile data instead of using hardcoded `PM_PROFILE`.

- [ ] **Step 5: Run tests**

```bash
cd /home/poorajith/My_Volume/CodeBase/Techiee/packages/backend && pnpm test
```
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/
git commit -m "feat: integrate dynamic scraper queries and profile-aware cron"
```

---

### Task 15: Data migration — move scoring columns

**Files:**
- Create: `packages/backend/src/db/migrate-scores.ts`

- [ ] **Step 1: Create migration script**

Create a script that:
1. Creates a "Legacy PM" profile from existing `scorer/profile.ts` data
2. Migrates `fit_score`, `competition`, `recommendation`, `pitch`, `score_reason` from `jobs` into `job_scores`
3. Maps `competition` text labels: "low"→85, "medium"→50, "high"→20

- [ ] **Step 2: Run migration**

```bash
cd /home/poorajith/My_Volume/CodeBase/Techiee/packages/backend && tsx src/db/migrate-scores.ts
```

- [ ] **Step 3: Generate schema migration to drop old columns**

After verifying data migrated, update schema.ts to remove old scoring columns from `jobs` table, then generate and run a Drizzle migration.

- [ ] **Step 4: Run all tests to verify nothing broke**

```bash
cd /home/poorajith/My_Volume/CodeBase/Techiee/packages/backend && pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add packages/backend/
git commit -m "feat: migrate scoring data to job_scores table, drop old columns"
```

---

### Task 16: Re-score existing jobs with IPE

- [ ] **Step 1: Start server and trigger IPE scoring**

```bash
curl -X POST http://localhost:3001/api/score/ipe/1
```
Expected: `{ scored: 564, total: 564 }`

- [ ] **Step 2: Verify scores**

```bash
curl -s 'http://localhost:3001/api/jobs?profileId=1&limit=5' | python3 -m json.tool
```
Expected: Jobs with IPE scores and dimension breakdowns

- [ ] **Step 3: Final commit**

```bash
git add packages/
git commit -m "feat: complete IPE & multi-profile pipeline — all jobs scored"
```

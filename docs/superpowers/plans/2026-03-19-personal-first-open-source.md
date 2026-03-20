# Personal-First Open-Source Architecture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure JobGrid so all personal data stays local (gitignored), the repo ships clean for open-source, and every new user bootstraps their own personalized instance via a setup wizard.

**Architecture:** Database-only with bootstrap migration. All personal state lives in SQLite (gitignored). The repo ships generic seed files (`data/seed/`) for company lists and role-based dictionary templates. On first run (empty DB), a setup wizard hydrates the DB from seeds + user input. Existing installs get a one-time migration.

**Tech Stack:** TypeScript, Express.js, React 19, SQLite/Drizzle ORM, Vitest, Groq SDK, Playwright

**Spec:** `docs/superpowers/specs/2026-03-19-personal-first-open-source-design.md`

---

## Task 1: Fix Gitignore Boundary

**Files:**
- Modify: `.gitignore`

This is the foundation — without it, `data/seed/` files can never be committed.

- [ ] **Step 1: Update .gitignore**

Replace the blanket `data/` rule with specific entries. The current file is:

```
.superpowers/
node_modules/
dist/
data/
.env
*.db
*.db-journal
```

Change `data/` to `data/uploads/` so that `data/seed/` can be committed:

```
.superpowers/
node_modules/
dist/
data/uploads/
.env
*.db
*.db-journal
```

- [ ] **Step 2: Verify git sees data/seed/ path**

Run: `mkdir -p data/seed && touch data/seed/.gitkeep && git status`
Expected: `data/seed/.gitkeep` appears as untracked (not ignored)

- [ ] **Step 3: Commit**

```bash
git add .gitignore data/seed/.gitkeep
git commit -m "fix: update gitignore to allow data/seed/ while ignoring data/uploads/"
```

---

## Task 2: Create Dictionary Templates

**Files:**
- Create: `data/seed/dictionaries/pm-tpm.json`
- Create: `data/seed/dictionaries/software-engineer.json`
- Create: `data/seed/dictionaries/data-scientist.json`
- Create: `data/seed/dictionaries/default.json`
- Delete: `packages/backend/data/skill-dictionary.json`

Move the existing PM-focused dictionary into a template format and create additional role templates.

- [ ] **Step 1: Create pm-tpm.json template**

Read the current `packages/backend/data/skill-dictionary.json` and wrap it in the `DictionaryTemplate` interface. Add `id`, `label`, `weights`, `defaultTitles`, `defaultSynonyms`, `defaultExcludes`:

```json
{
  "id": "pm-tpm",
  "label": "Project/Program/Product Manager",
  "weights": {
    "freshness": 0.20,
    "skill": 0.25,
    "title": 0.25,
    "cert": 0.05,
    "competition": 0.10,
    "location": 0.10,
    "experience": 0.05
  },
  "defaultTitles": [
    "Technical Project Manager",
    "Technical Program Manager",
    "Product Manager",
    "Program Manager",
    "IT Project Manager"
  ],
  "defaultSynonyms": {
    "technical project manager": ["TPM", "IT Project Manager", "Technology PM", "Tech PM"],
    "technical program manager": ["Program Manager Technical", "Sr Program Manager", "Senior Program Manager"],
    "product manager": ["Product Owner", "Group Product Manager", "Associate Product Manager"],
    "program manager": ["Programme Manager", "PgM"]
  },
  "defaultExcludes": [
    "Account Manager", "Sales Manager", "Marketing Manager",
    "Office Manager", "Property Manager", "Case Manager",
    "Nurse Manager", "Restaurant Manager", "Store Manager",
    "General Manager", "Shift Manager", "Branch Manager",
    "Warehouse Manager", "Operations Manager"
  ],
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

- [ ] **Step 2: Create software-engineer.json template**

```json
{
  "id": "software-engineer",
  "label": "Software Engineer",
  "weights": {
    "freshness": 0.20,
    "skill": 0.30,
    "title": 0.15,
    "cert": 0.05,
    "competition": 0.10,
    "location": 0.10,
    "experience": 0.10
  },
  "defaultTitles": [
    "Software Engineer",
    "Software Developer",
    "Full Stack Engineer",
    "Backend Engineer",
    "Frontend Engineer"
  ],
  "defaultSynonyms": {
    "software engineer": ["SWE", "Software Dev", "SE", "Application Developer"],
    "software developer": ["Developer", "Programmer", "Coder"],
    "full stack engineer": ["Full Stack Developer", "Fullstack Engineer"],
    "backend engineer": ["Backend Developer", "Server Engineer", "API Engineer"],
    "frontend engineer": ["Frontend Developer", "UI Engineer", "Web Developer"]
  },
  "defaultExcludes": [
    "Sales Engineer", "Support Engineer", "Field Engineer",
    "Solutions Engineer", "Customer Engineer", "Hardware Engineer",
    "Mechanical Engineer", "Civil Engineer", "Chemical Engineer"
  ],
  "methodologies": ["agile", "scrum", "kanban", "ci/cd", "devops", "sdlc", "tdd", "bdd", "pair programming"],
  "tools": [
    "git", "github", "gitlab", "bitbucket", "docker", "kubernetes",
    "jenkins", "circleci", "github actions", "terraform", "ansible",
    "jira", "confluence", "slack", "vs code", "intellij", "postman",
    "datadog", "splunk", "grafana", "new relic"
  ],
  "technical": [
    "python", "javascript", "typescript", "java", "c++", "c#", "go", "rust", "ruby", "php",
    "react", "angular", "vue", "svelte", "next.js", "node.js", "express", "django", "flask", "spring boot",
    "rest api", "graphql", "grpc", "websockets", "microservices", "monolith",
    "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "kafka", "rabbitmq",
    "aws", "azure", "gcp", "docker", "kubernetes", "terraform",
    "machine learning", "ai", "data structures", "algorithms", "system design",
    "html", "css", "sass", "tailwind", "webpack", "vite"
  ],
  "certifications": [
    "aws certified", "azure certified", "gcp certified",
    "ckad", "cka", "terraform associate",
    "comptia security+", "cissp"
  ],
  "domains": [
    "web development", "mobile development", "cloud computing", "distributed systems",
    "fintech", "healthcare", "e-commerce", "saas", "edtech",
    "cybersecurity", "data engineering", "machine learning", "ai/ml",
    "devops", "infrastructure", "platform engineering"
  ],
  "soft_skills": [
    "code review", "mentoring", "technical writing", "communication",
    "collaboration", "problem solving", "system design", "architecture"
  ]
}
```

- [ ] **Step 3: Create data-scientist.json template**

```json
{
  "id": "data-scientist",
  "label": "Data Scientist / ML Engineer",
  "weights": {
    "freshness": 0.20,
    "skill": 0.30,
    "title": 0.15,
    "cert": 0.05,
    "competition": 0.10,
    "location": 0.10,
    "experience": 0.10
  },
  "defaultTitles": [
    "Data Scientist",
    "Machine Learning Engineer",
    "ML Engineer",
    "Data Analyst",
    "AI Engineer"
  ],
  "defaultSynonyms": {
    "data scientist": ["DS", "Research Scientist", "Applied Scientist"],
    "machine learning engineer": ["ML Engineer", "MLE", "AI/ML Engineer"],
    "data analyst": ["Analytics Engineer", "Business Analyst", "BI Analyst"],
    "ai engineer": ["AI Developer", "Deep Learning Engineer"]
  },
  "defaultExcludes": [
    "Data Entry", "Database Administrator", "Data Center",
    "Sales Analyst", "Financial Analyst", "Marketing Analyst"
  ],
  "methodologies": ["agile", "scrum", "mlops", "ci/cd", "experiment tracking", "a/b testing"],
  "tools": [
    "jupyter", "pandas", "numpy", "scikit-learn", "tensorflow", "pytorch",
    "keras", "xgboost", "lightgbm", "hugging face", "mlflow", "weights and biases",
    "airflow", "dbt", "snowflake", "databricks", "spark", "hadoop",
    "tableau", "power bi", "looker", "metabase"
  ],
  "technical": [
    "python", "r", "sql", "scala", "julia",
    "machine learning", "deep learning", "nlp", "computer vision", "reinforcement learning",
    "statistics", "probability", "linear algebra", "calculus",
    "regression", "classification", "clustering", "time series",
    "neural networks", "transformers", "cnn", "rnn", "lstm", "gpt",
    "feature engineering", "model deployment", "model monitoring",
    "aws sagemaker", "azure ml", "vertex ai", "gcp",
    "postgresql", "mongodb", "bigquery", "redshift", "s3"
  ],
  "certifications": [
    "aws certified", "azure certified", "gcp certified",
    "tensorflow developer", "databricks certified"
  ],
  "domains": [
    "machine learning", "artificial intelligence", "data engineering",
    "nlp", "computer vision", "recommendation systems",
    "fintech", "healthcare", "adtech", "e-commerce",
    "autonomous vehicles", "robotics", "bioinformatics"
  ],
  "soft_skills": [
    "data storytelling", "presentation", "stakeholder management",
    "technical writing", "cross-functional collaboration", "mentoring"
  ]
}
```

- [ ] **Step 4: Create default.json (minimal baseline)**

```json
{
  "id": "default",
  "label": "Custom / General",
  "weights": {
    "freshness": 0.25,
    "skill": 0.25,
    "title": 0.15,
    "cert": 0.10,
    "competition": 0.10,
    "location": 0.10,
    "experience": 0.05
  },
  "defaultTitles": [],
  "defaultSynonyms": {},
  "defaultExcludes": [],
  "methodologies": ["agile", "scrum", "kanban", "waterfall"],
  "tools": ["jira", "confluence", "slack", "teams", "github", "git"],
  "technical": ["python", "sql", "javascript", "aws", "azure", "gcp"],
  "certifications": [],
  "domains": [],
  "soft_skills": ["leadership", "communication", "collaboration", "problem solving"]
}
```

- [ ] **Step 5: Delete old dictionary file**

```bash
rm packages/backend/data/skill-dictionary.json
```

- [ ] **Step 6: Remove data/seed/.gitkeep (no longer needed)**

```bash
rm data/seed/.gitkeep
```

- [ ] **Step 7: Commit**

```bash
git add data/seed/dictionaries/ && git rm packages/backend/data/skill-dictionary.json && git rm data/seed/.gitkeep
git commit -m "feat: add role-based dictionary templates, remove hardcoded dictionary"
```

---

## Task 3: Schema Changes — New Tables and Columns

**Files:**
- Modify: `packages/backend/src/db/schema.ts`
- Test: `packages/backend/src/db/__tests__/schema.test.ts`

Add `user_dictionary`, `discovery_runs` tables. Add columns to `companies` and `profiles`.

- [ ] **Step 1: Write failing test for new schema tables**

Create or update `packages/backend/src/db/__tests__/schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import * as schema from '../schema.js';

describe('schema exports', () => {
  it('exports userDictionary table', () => {
    expect(schema.userDictionary).toBeDefined();
  });

  it('exports discoveryRuns table', () => {
    expect(schema.discoveryRuns).toBeDefined();
  });

  it('companies table has ashbySlug column', () => {
    expect(schema.companies.ashbySlug).toBeDefined();
  });

  it('companies table has source column', () => {
    expect(schema.companies.source).toBeDefined();
  });

  it('profiles table has archetype column', () => {
    expect(schema.profiles.archetype).toBeDefined();
  });

  it('profiles table has excludeTitles column', () => {
    expect(schema.profiles.excludeTitles).toBeDefined();
  });

  it('profiles table has remotePreference column', () => {
    expect(schema.profiles.remotePreference).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx vitest run src/db/__tests__/schema.test.ts`
Expected: FAIL — `userDictionary` not exported

- [ ] **Step 3: Add new tables and columns to schema.ts**

Add after the existing `jobScores` table definition in `packages/backend/src/db/schema.ts`:

```typescript
// --- New tables for personal-first architecture ---

export const userDictionary = sqliteTable('user_dictionary', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  category: text('category').notNull(), // methodologies|tools|technical|certifications|domains|soft_skills
  term: text('term').notNull(),
  source: text('source').notNull(), // template|resume|manual|ai-discovered
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex('idx_user_dict_unique').on(table.userId, table.category, table.term),
  index('idx_user_dict_user').on(table.userId),
]);

export const discoveryRuns = sqliteTable('discovery_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  companiesFound: integer('companies_found').notNull().default(0),
  companiesNew: integer('companies_new').notNull().default(0),
  status: text('status').notNull(), // running|completed|failed
  error: text('error'),
  source: text('source').notNull(), // scheduled|manual
}, (table) => [
  index('idx_discovery_runs_started').on(table.startedAt),
]);
```

Add new columns to the existing `companies` table:

```typescript
ashbySlug: text('ashby_slug'),
source: text('source').notNull().default('manual'), // seed|manual|discovered|ai-suggested (default 'manual' so existing rows get correct value)
discoveredAt: text('discovered_at'),
relevanceNote: text('relevance_note'),
```

Add new columns to the existing `profiles` table:

```typescript
archetype: text('archetype'), // pm-tpm|software-engineer|data-scientist|custom
excludeTitles: text('exclude_titles'), // JSON array
remotePreference: integer('remote_preference', { mode: 'boolean' }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && npx vitest run src/db/__tests__/schema.test.ts`
Expected: PASS

- [ ] **Step 5: Generate Drizzle migration**

Run: `cd packages/backend && npx drizzle-kit generate`
Expected: New migration file created in `drizzle/` folder

- [ ] **Step 6: Run migration**

Run: `cd packages/backend && npx tsx src/db/migrate.ts`
Expected: Migration applies successfully

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/db/schema.ts packages/backend/src/db/__tests__/schema.test.ts packages/backend/drizzle/
git commit -m "feat: add user_dictionary, discovery_runs tables and new columns on companies/profiles"
```

---

## Task 4: Dictionary Service — Read from DB

**Files:**
- Modify: `packages/backend/src/documents/dictionary.ts`
- Modify: `packages/backend/src/documents/__tests__/dictionary.test.ts`

Change `loadDictionary()` to accept a `userId` and read from `user_dictionary` table instead of a JSON file.

- [ ] **Step 1: Write failing test**

Update `packages/backend/src/documents/__tests__/dictionary.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadDictionary, loadDictionaryFromTemplate, getAllTerms } from '../dictionary.js';

// Mock the DB module
vi.mock('../../db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue([
          { category: 'tools', term: 'jira' },
          { category: 'tools', term: 'confluence' },
          { category: 'methodologies', term: 'agile' },
          { category: 'technical', term: 'python' },
          { category: 'certifications', term: 'pmp' },
          { category: 'domains', term: 'fintech' },
          { category: 'soft_skills', term: 'leadership' },
        ]),
      }),
    }),
  },
}));

describe('dictionary', () => {
  it('loadDictionary groups terms by category from DB', () => {
    const dict = loadDictionary(1);
    expect(dict.tools).toContain('jira');
    expect(dict.methodologies).toContain('agile');
    expect(dict.technical).toContain('python');
  });

  it('loadDictionaryFromTemplate reads JSON file', () => {
    const dict = loadDictionaryFromTemplate('pm-tpm');
    expect(dict.tools.length).toBeGreaterThan(0);
    expect(dict.methodologies.length).toBeGreaterThan(0);
  });

  it('getAllTerms returns flat array from DB', () => {
    const terms = getAllTerms(1);
    expect(terms).toContain('jira');
    expect(terms).toContain('agile');
    expect(terms).toContain('python');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx vitest run src/documents/__tests__/dictionary.test.ts`
Expected: FAIL — `loadDictionary` does not accept userId parameter

- [ ] **Step 3: Rewrite dictionary.ts**

Replace `packages/backend/src/documents/dictionary.ts` entirely:

```typescript
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { userDictionary } from '../db/schema.js';

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

/**
 * Load dictionary from the user_dictionary table (runtime).
 * If no rows exist for this user, logs an error — caller should handle bootstrap.
 */
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
    if (dict[cat]) {
      dict[cat].push(row.term);
    }
  }

  return dict;
}

/**
 * Load a dictionary template from data/seed/dictionaries/ (setup time only).
 */
export function loadDictionaryFromTemplate(templateId: string): SkillDictionary {
  const path = resolve(process.cwd(), `data/seed/dictionaries/${templateId}.json`);
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

/**
 * Load the full template JSON (including weights, titles, synonyms, excludes).
 */
export function loadFullTemplate(templateId: string): any {
  const path = resolve(process.cwd(), `data/seed/dictionaries/${templateId}.json`);
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Get all terms as a flat array (for skill matching and extraction).
 */
export function getAllTerms(userId: number): string[] {
  const dict = loadDictionary(userId);
  return CATEGORIES.flatMap(cat => dict[cat]);
}

export function getCertifications(userId: number): string[] {
  return loadDictionary(userId).certifications;
}

export function getTools(userId: number): string[] {
  return loadDictionary(userId).tools;
}
```

- [ ] **Step 4: Update `extractor.ts` to accept userId**

In `packages/backend/src/documents/extractor.ts`, change the `extractProfileData` function signature to accept an optional `userId` parameter. When provided, use `getAllTerms(userId)` for matching. When not provided (during setup before dictionary exists), fall back to loading from a template file:

```typescript
import { getAllTerms, getCertifications, getTools, loadDictionaryFromTemplate } from './dictionary.js';

export function extractProfileData(text: string, userId?: number): ExtractedProfile {
  // If userId provided and dictionary exists in DB, use it
  // Otherwise fall back to template-based extraction
  const terms = userId ? getAllTerms(userId) : getAllTermsFromTemplate('default');
  const certs = userId ? getCertifications(userId) : getCertificationsFromTemplate('default');
  const tools = userId ? getTools(userId) : getToolsFromTemplate('default');
  // ... rest of extraction logic unchanged
}

function getAllTermsFromTemplate(templateId: string): string[] {
  const dict = loadDictionaryFromTemplate(templateId);
  return [...dict.methodologies, ...dict.tools, ...dict.technical, ...dict.certifications, ...dict.domains, ...dict.soft_skills];
}
function getCertificationsFromTemplate(templateId: string): string[] {
  return loadDictionaryFromTemplate(templateId).certifications;
}
function getToolsFromTemplate(templateId: string): string[] {
  return loadDictionaryFromTemplate(templateId).tools;
}
```

Note: `skill-match.ts` does NOT directly call dictionary functions — it receives `profileSkills` as a parameter from the caller. No changes needed there.

- [ ] **Step 4b: Update document upload routes to pass userId to extractor**

In `packages/backend/src/api/routes/documents.ts` (~line 41), change:
```typescript
const profile = extractProfileData(rawText);
```
to:
```typescript
const profile = extractProfileData(rawText, req.userId);
```

In `packages/backend/src/api/routes/setup.ts` (Task 7, step 3 endpoint), pass userId from the request body:
```typescript
const profile = extractProfileData(rawText, userId);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/backend && npx vitest run src/documents/__tests__/dictionary.test.ts`
Expected: PASS

- [ ] **Step 6: Run full test suite to check nothing is broken**

Run: `cd packages/backend && npx vitest run`
Expected: All existing tests pass (some may need userId mock updates)

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/documents/dictionary.ts packages/backend/src/documents/__tests__/dictionary.test.ts
git add packages/backend/src/documents/extractor.ts packages/backend/src/ipe/skill-match.ts
git commit -m "feat: dictionary now reads from user_dictionary table instead of JSON file"
```

---

## Task 5: Title Alignment — Synonyms, Excludes, Order-Independent Matching

**Files:**
- Modify: `packages/backend/src/ipe/title-align.ts`
- Modify: `packages/backend/src/ipe/__tests__/dimensions.test.ts`

Redesign title scoring: synonyms = 100 (was 40), add exclude filtering, add order-independent word matching.

- [ ] **Step 1: Write failing tests for new title-align behavior**

Add to `packages/backend/src/ipe/__tests__/dimensions.test.ts`:

```typescript
import { scoreTitleAlignment } from '../title-align.js';

describe('scoreTitleAlignment — redesigned', () => {
  const synonyms = {
    'technical project manager': ['TPM', 'IT Project Manager'],
    'product manager': ['Product Owner', 'PM'],
  };
  const excludes = ['Account Manager', 'Sales Manager'];

  it('scores synonym match at 100 (not 40)', () => {
    const score = scoreTitleAlignment(
      ['Technical Project Manager'],
      'TPM',
      synonyms,
      excludes
    );
    expect(score).toBe(100);
  });

  it('scores order-independent match at 90', () => {
    const score = scoreTitleAlignment(
      ['Technical Project Manager'],
      'Project Manager, Technical',
      synonyms,
      excludes
    );
    expect(score).toBe(90);
  });

  it('scores exclude title at 0', () => {
    const score = scoreTitleAlignment(
      ['Technical Project Manager'],
      'Account Manager',
      synonyms,
      excludes
    );
    expect(score).toBe(0);
  });

  it('exact match still scores 100', () => {
    const score = scoreTitleAlignment(
      ['Technical Project Manager'],
      'Technical Project Manager',
      synonyms,
      excludes
    );
    expect(score).toBe(100);
  });

  it('works with empty excludes', () => {
    const score = scoreTitleAlignment(
      ['Product Manager'],
      'Product Owner',
      synonyms,
      []
    );
    expect(score).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx vitest run src/ipe/__tests__/dimensions.test.ts`
Expected: FAIL — `scoreTitleAlignment` doesn't accept 4th parameter, synonym score is 40 not 100

- [ ] **Step 3: Rewrite title-align.ts**

Replace `packages/backend/src/ipe/title-align.ts`:

```typescript
/**
 * Score title alignment with synonym support, exclude filtering,
 * and order-independent word matching.
 *
 * Scoring tiers:
 *  100 — exact match or synonym match
 *   90 — all significant words present (order-independent)
 *   85 — contains match (substring)
 *    0 — exclude match (overrides all)
 *  0-80 — partial word overlap (fallback)
 */
export function scoreTitleAlignment(
  targetTitles: string[],
  jobTitle: string,
  synonyms: Record<string, string[]>,
  excludeTitles: string[] = []
): number {
  const jobLower = jobTitle.toLowerCase().trim().replace(/[^\w\s]/g, '');
  const stopWords = new Set(['a', 'an', 'the', 'of', 'and', 'or', 'in', 'at', 'for', '-', '–']);

  // Check excludes first — overrides everything
  for (const exclude of excludeTitles) {
    const excludeLower = exclude.toLowerCase().trim();
    if (jobLower === excludeLower || jobLower.includes(excludeLower)) {
      return 0;
    }
  }

  let bestScore = 0;

  for (const target of targetTitles) {
    const targetLower = target.toLowerCase().trim().replace(/[^\w\s]/g, '');

    // Exact match
    if (jobLower === targetLower) return 100;

    // Synonym match — keys are always lowercase
    const targetSynonyms = synonyms[targetLower] || [];
    for (const syn of targetSynonyms) {
      const synLower = syn.toLowerCase().trim();
      if (jobLower === synLower || jobLower.includes(synLower) || synLower.includes(jobLower)) {
        return 100;
      }
    }

    // Order-independent: all significant words from target appear in job title
    const targetWords = targetLower.split(/\s+/).filter(w => !stopWords.has(w));
    const jobWords = new Set(jobLower.split(/\s+/));
    const allPresent = targetWords.every(w => jobWords.has(w));
    if (allPresent && targetWords.length > 0) {
      bestScore = Math.max(bestScore, 90);
      continue;
    }

    // Contains match
    if (jobLower.includes(targetLower) || targetLower.includes(jobLower)) {
      bestScore = Math.max(bestScore, 85);
      continue;
    }

    // Partial word overlap
    const overlap = targetWords.filter(w => jobWords.has(w)).length;
    const overlapRatio = overlap / Math.max(targetWords.length, 1);
    const overlapScore = Math.round(overlapRatio * 80);
    bestScore = Math.max(bestScore, overlapScore);
  }

  return bestScore;
}
```

- [ ] **Step 4: Add `excludeTitles` to ProfileConfig interface**

In `packages/backend/src/ipe/index.ts`, add to the `ProfileConfig` interface:

```typescript
excludeTitles?: string[];
```

Then update the `calculateIpeScore` function where it calls `scoreTitleAlignment` to pass the 4th argument:

```typescript
const titleScore = scoreTitleAlignment(
  config.targetTitles,
  jobData.title,
  config.titleSynonyms,
  config.excludeTitles || []
);
```

- [ ] **Step 5: Wire excludeTitles in enrich.ts ProfileConfig construction**

In `packages/backend/src/api/routes/enrich.ts`, inside the `scoreJobAgainstProfiles` function (~line 38), add to the `config` object:

```typescript
const config: ProfileConfig = {
  // ...existing fields...
  excludeTitles: profile.excludeTitles ? JSON.parse(profile.excludeTitles) : [],
};
```

- [ ] **Step 6: Wire excludeTitles in score.ts ProfileConfig construction**

In `packages/backend/src/api/routes/score.ts`, inside the `POST /api/score/ipe/:profileId` handler (~line 33), add to the `config` object:

```typescript
const config: ProfileConfig = {
  // ...existing fields...
  excludeTitles: profile.excludeTitles ? JSON.parse(profile.excludeTitles) : [],
};
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd packages/backend && npx vitest run src/ipe/__tests__/`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/backend/src/ipe/title-align.ts packages/backend/src/ipe/__tests__/dimensions.test.ts
git add packages/backend/src/ipe/index.ts packages/backend/src/api/routes/enrich.ts packages/backend/src/api/routes/score.ts
git commit -m "feat: redesign title-align with synonyms=100, excludes=0, order-independent matching"
```

---

## Task 6: Bootstrap Middleware

**Files:**
- Create: `packages/backend/src/api/middleware/bootstrap.ts`
- Modify: `packages/backend/src/api/server.ts`

Return 412 for all `/api/*` routes when no users exist, except setup and config endpoints.

- [ ] **Step 1: Write failing test**

Create `packages/backend/src/api/__tests__/bootstrap.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createBootstrapMiddleware } from '../middleware/bootstrap.js';

describe('bootstrap middleware', () => {
  it('returns 412 when no users exist and path is not /api/setup', () => {
    const middleware = createBootstrapMiddleware(() => 0);
    const req = { path: '/api/jobs' } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(412);
    expect(res.json).toHaveBeenCalledWith({ error: 'setup_required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() for /api/setup paths', () => {
    const middleware = createBootstrapMiddleware(() => 0);
    const req = { path: '/api/setup/user' } as any;
    const res = {} as any;
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('calls next() when users exist', () => {
    const middleware = createBootstrapMiddleware(() => 1);
    const req = { path: '/api/jobs' } as any;
    const res = {} as any;
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx vitest run src/api/__tests__/bootstrap.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement bootstrap middleware**

Create `packages/backend/src/api/middleware/bootstrap.ts`:

```typescript
import type { Request, Response, NextFunction } from 'express';

const EXEMPT_PREFIXES = ['/api/setup', '/api/config/import'];

export function createBootstrapMiddleware(getUserCount: () => number) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only apply to /api/* routes (never block static assets/frontend)
    if (!req.path.startsWith('/api/')) { next(); return; }
    // Exempt setup and config import routes
    if (EXEMPT_PREFIXES.some(prefix => req.path.startsWith(prefix))) { next(); return; }
    // No caching — getUserCount() is a fast SELECT COUNT(*) on SQLite
    if (getUserCount() > 0) { next(); return; }
    res.status(412).json({ error: 'setup_required' });
  };
}
```

- [ ] **Step 4: Wire into server.ts**

In `packages/backend/src/api/server.ts`, add the middleware before all route registrations:

```typescript
import { createBootstrapMiddleware } from './middleware/bootstrap.js';

// After db and queries are created:
const bootstrapMiddleware = createBootstrapMiddleware(() => queries.getUserCount());
app.use(bootstrapMiddleware);
```

Add `getUserCount()` to queries if it doesn't exist — it's a simple `SELECT COUNT(*) FROM users`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/backend && npx vitest run src/api/__tests__/bootstrap.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/api/middleware/bootstrap.ts packages/backend/src/api/__tests__/bootstrap.test.ts
git add packages/backend/src/api/server.ts packages/backend/src/db/queries.ts
git commit -m "feat: add bootstrap middleware — returns 412 when no users exist"
```

---

## Task 7: Setup Wizard API Endpoints

**Files:**
- Create: `packages/backend/src/api/routes/setup.ts`
- Create: `packages/backend/src/db/bootstrap.ts`
- Modify: `packages/backend/src/api/server.ts`

Backend endpoints for the 8-step setup wizard.

**Design note:** The spec implies session-based userId (from step 1). The plan uses explicit `userId` in request bodies for statelessness — the frontend stores the userId returned from step 1 and passes it to subsequent steps. This avoids session state on the backend. Steps 5 and 6 from the spec are merged into a single `/api/setup/profile` endpoint (the frontend handles them as separate UI steps calling the same API).

- [ ] **Step 1: Create bootstrap.ts — seed loading logic**

Create `packages/backend/src/db/bootstrap.ts`:

```typescript
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { db } from './index.js';
import { userDictionary, companies } from './schema.js';
import type { createQueries } from './queries.js';

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

/**
 * Load dictionary template terms into user_dictionary for a given user.
 */
export function hydrateUserDictionary(userId: number, templateId: string): number {
  const path = resolve(process.cwd(), `data/seed/dictionaries/${templateId}.json`);
  const raw = readFileSync(path, 'utf-8');
  const template = JSON.parse(raw);

  const categories = ['methodologies', 'tools', 'technical', 'certifications', 'domains', 'soft_skills'] as const;
  let count = 0;

  for (const category of categories) {
    const terms: string[] = template[category] || [];
    for (const term of terms) {
      db.insert(userDictionary).values({
        userId,
        category,
        term,
        source: 'template',
      }).onConflictDoNothing().run();
      count++;
    }
  }

  return count;
}

/**
 * Load seed companies from data/seed/companies.json into the companies table.
 */
export function loadSeedCompanies(): number {
  const path = resolve(process.cwd(), 'data/seed/companies.json');
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
    } catch {
      // Skip duplicates
    }
  }

  return inserted;
}
```

- [ ] **Step 2: Create setup.ts route file**

Create `packages/backend/src/api/routes/setup.ts`:

```typescript
import { Router } from 'express';
import { hydrateUserDictionary, loadSeedCompanies } from '../../db/bootstrap.js';
import { loadFullTemplate } from '../../documents/dictionary.js';
import { extractTextFromPdf } from '../../documents/parser.js';
import { extractProfileData } from '../../documents/extractor.js';
import multer from 'multer';
import type { createQueries } from '../../db/queries.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are accepted'));
  },
});

export function createSetupRouter(queries: ReturnType<typeof createQueries>) {
  const router = Router();

  // Step 1: Create user
  router.post('/user', (req, res, next) => {
    try {
      const { name, avatarColor } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }
      const user = queries.insertUser({ name: name.trim(), avatarColor: avatarColor || '#6366f1' });
      res.status(201).json({ userId: user.id });
    } catch (err) { next(err); }
  });

  // Step 2: Choose archetype
  router.post('/archetype', (req, res, next) => {
    try {
      const { archetype, userId } = req.body;
      if (!archetype || !userId) {
        res.status(400).json({ error: 'archetype and userId required' });
        return;
      }

      const template = loadFullTemplate(archetype);

      // Create profile with archetype defaults
      const profile = queries.insertProfile({
        name: template.label || archetype,
        targetTitles: JSON.stringify(template.defaultTitles || []),
        targetSkills: JSON.stringify([]), // Will be populated from dictionary in step 4
        targetCerts: null,
        targetLocations: null,
        searchQueries: null,
        titleSynonyms: JSON.stringify(template.defaultSynonyms || {}),
        excludeTitles: JSON.stringify(template.defaultExcludes || []),
        archetype,
        freshnessWeight: template.weights?.freshness ?? 0.25,
        skillWeight: template.weights?.skill ?? 0.25,
        titleWeight: template.weights?.title ?? 0.15,
        certWeight: template.weights?.cert ?? 0.10,
        competitionWeight: template.weights?.competition ?? 0.10,
        locationWeight: template.weights?.location ?? 0.10,
        experienceWeight: template.weights?.experience ?? 0.05,
        userId,
      });

      // Load dictionary template into user_dictionary
      const termCount = hydrateUserDictionary(userId, archetype);

      res.status(201).json({ profileId: profile.id, template, termCount });
    } catch (err) { next(err); }
  });

  // Step 3: Upload documents
  router.post('/documents', upload.single('file'), async (req, res, next) => {
    try {
      const file = req.file;
      const type = req.body.type as string;
      const userId = parseInt(req.body.userId, 10);

      if (!file) { res.status(400).json({ error: 'No file uploaded' }); return; }
      if (!type || !['resume', 'linkedin'].includes(type)) {
        res.status(400).json({ error: 'Type must be "resume" or "linkedin"' });
        return;
      }

      const rawText = await extractTextFromPdf(file.buffer);
      const profile = extractProfileData(rawText);

      queries.deleteDocumentByTypeAndUser(type, userId);
      queries.insertDocument({
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
        userId,
      });

      const docs = queries.getDocumentsByTypeAndUser(type, userId);
      res.json({ documentId: docs[0]?.id, extracted: profile });
    } catch (err) { next(err); }
  });

  // Step 4: Customize skills (add/remove from user_dictionary)
  router.post('/skills', (req, res, next) => {
    try {
      const { userId, add, remove } = req.body;
      // add: { category: string, term: string }[]
      // remove: { category: string, term: string }[]
      if (add) {
        for (const { category, term } of add) {
          queries.insertDictionaryTerm(userId, category, term, 'manual');
        }
      }
      if (remove) {
        for (const { category, term } of remove) {
          queries.deleteDictionaryTerm(userId, category, term);
        }
      }
      const totalTerms = queries.getDictionaryTermCount(userId);
      res.json({ totalTerms });
    } catch (err) { next(err); }
  });

  // Step 5: Profile — titles, synonyms, excludes, search queries
  router.post('/profile', (req, res, next) => {
    try {
      const { profileId, targetTitles, titleSynonyms, excludeTitles, targetLocations, remotePreference, searchQueries } = req.body;

      // Auto-generate search queries from titles + synonyms if not provided
      let generatedQueries = searchQueries;
      if (!generatedQueries && targetTitles && titleSynonyms) {
        const querySet = new Set<string>(targetTitles);
        for (const syns of Object.values(titleSynonyms) as string[][]) {
          for (const syn of syns) {
            querySet.add(syn);
          }
        }
        generatedQueries = Array.from(querySet);
      }

      const updates: Record<string, any> = {};
      if (targetTitles) updates.targetTitles = JSON.stringify(targetTitles);
      if (titleSynonyms) updates.titleSynonyms = JSON.stringify(titleSynonyms);
      if (excludeTitles !== undefined) updates.excludeTitles = JSON.stringify(excludeTitles);
      if (targetLocations) updates.targetLocations = JSON.stringify(targetLocations);
      if (remotePreference !== undefined) updates.remotePreference = remotePreference;
      if (generatedQueries) updates.searchQueries = JSON.stringify(generatedQueries);

      queries.updateProfile(profileId, updates);
      res.json({ profileId, generatedQueries });
    } catch (err) { next(err); }
  });

  // Step 7: Load seed companies
  router.post('/companies', (_req, res, next) => {
    try {
      const inserted = loadSeedCompanies();
      const allCompanies = queries.getCompanies();
      res.json({ activeCount: allCompanies.filter((c: any) => c.active).length, totalCount: allCompanies.length, inserted });
    } catch (err) { next(err); }
  });

  // Step 8: Complete setup
  router.post('/complete', (_req, res) => {
    res.json({ success: true });
  });

  return router;
}
```

- [ ] **Step 3: Add query helpers for dictionary operations**

Add to `packages/backend/src/db/queries.ts`:

```typescript
insertDictionaryTerm(userId: number, category: string, term: string, source: string) {
  return db.insert(userDictionary).values({ userId, category, term, source }).onConflictDoNothing().run();
},

deleteDictionaryTerm(userId: number, category: string, term: string) {
  return db.delete(userDictionary)
    .where(and(eq(userDictionary.userId, userId), eq(userDictionary.category, category), eq(userDictionary.term, term)))
    .run();
},

getDictionaryTermCount(userId: number) {
  const rows = db.select().from(userDictionary).where(eq(userDictionary.userId, userId)).all();
  return rows.length;
},

getUserCount() {
  const rows = db.select().from(users).all();
  return rows.length;
},
```

- [ ] **Step 4: Register setup router in server.ts**

In `packages/backend/src/api/server.ts`, add:

```typescript
import { createSetupRouter } from './routes/setup.js';
app.use('/api/setup', createSetupRouter(queries));
```

- [ ] **Step 5: Delete seed.ts and update package.json**

```bash
rm packages/backend/src/db/seed.ts
```

Remove `"db:seed": "tsx src/db/seed.ts"` from `packages/backend/package.json` scripts.

- [ ] **Step 6: Run full test suite**

Run: `cd packages/backend && npx vitest run`
Expected: PASS (existing tests may need minor updates for new schema columns)

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/api/routes/setup.ts packages/backend/src/db/bootstrap.ts
git add packages/backend/src/db/queries.ts packages/backend/src/api/server.ts packages/backend/package.json
git rm packages/backend/src/db/seed.ts
git commit -m "feat: add setup wizard API endpoints and bootstrap seed loading"
```

---

## Task 8: Multi-Query Scraping

**Files:**
- Modify: `packages/backend/src/sources/index.ts`
- Modify: `packages/backend/src/sources/__tests__/orchestrator.test.ts`

Update `runAllSources()` to iterate browser-based scrapers over multiple search queries with in-loop deduplication.

- [ ] **Step 1: Write failing test**

Add to `packages/backend/src/sources/__tests__/orchestrator.test.ts`:

```typescript
describe('runAllSources — multi-query', () => {
  it('deduplicates jobs across multiple search queries', async () => {
    // Mock browser sources to return overlapping jobs for different queries
    // The same job link should only appear once in results
  });

  it('caps search queries at MAX_SEARCH_QUERIES (8)', async () => {
    // Provide 12 queries, verify only 8 are used
  });
});
```

- [ ] **Step 2: Modify sources/index.ts**

Update the browser scraping section to loop over queries:

```typescript
const MAX_SEARCH_QUERIES = 8;

// 2. Playwright scrapers (sequential, per query)
try {
  const page = await getPage();
  const queries = (searchQueries || []).slice(0, MAX_SEARCH_QUERIES);
  const seenLinks = new Set<string>();

  for (const query of queries.length > 0 ? queries : [undefined]) {
    const queryArr = query ? [query] : undefined;

    try {
      sourcesRun.push('indeed');
      const indeedJobs = await scrapeIndeed(page, queryArr);
      for (const job of indeedJobs) {
        if (!seenLinks.has(job.link)) {
          seenLinks.add(job.link);
          allJobs.push(job);
        }
      }
    } catch (err) { errors.push(`Indeed (${query}): ${err}`); }

    try {
      sourcesRun.push('google-jobs');
      const googleJobs = await scrapeGoogleJobs(page, queryArr);
      for (const job of googleJobs) {
        if (!seenLinks.has(job.link)) {
          seenLinks.add(job.link);
          allJobs.push(job);
        }
      }
    } catch (err) { errors.push(`Google Jobs (${query}): ${err}`); }

    try {
      sourcesRun.push('ziprecruiter');
      const zipJobs = await scrapeZipRecruiter(page, queryArr);
      for (const job of zipJobs) {
        if (!seenLinks.has(job.link)) {
          seenLinks.add(job.link);
          allJobs.push(job);
        }
      }
    } catch (err) { errors.push(`ZipRecruiter (${query}): ${err}`); }
  }

  await page.context().close();
} catch (err) {
  errors.push(`Browser: ${err}`);
} finally {
  await closeBrowser();
}
```

- [ ] **Step 3: Deduplicate sourcesRun**

Change `sourcesRun` to use a Set to avoid listing "indeed" 8 times:

```typescript
const sourcesRunSet = new Set<string>();
// ... push to sourcesRunSet instead
return { jobs: finalDeduped, sourcesRun: Array.from(sourcesRunSet), errors };
```

- [ ] **Step 4: Run tests**

Run: `cd packages/backend && npx vitest run src/sources/__tests__/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/sources/index.ts packages/backend/src/sources/__tests__/orchestrator.test.ts
git commit -m "feat: multi-query scraping with in-loop dedup and 8-query cap"
```

---

## Task 9: Company Discovery Module

**Files:**
- Create: `packages/backend/src/sources/discovery.ts`
- Create: `packages/backend/src/sources/__tests__/discovery.test.ts`

ATS slug probing + Groq-assisted company discovery.

- [ ] **Step 1: Write failing test**

Create `packages/backend/src/sources/__tests__/discovery.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateSlugCandidates } from '../discovery.js';

describe('discovery', () => {
  it('generates slug candidates from company name', () => {
    const candidates = generateSlugCandidates('Hub Spot');
    expect(candidates).toContain('hubspot');
    expect(candidates).toContain('hub-spot');
    expect(candidates).toContain('hub_spot');
  });

  it('handles single word company names', () => {
    const candidates = generateSlugCandidates('Stripe');
    expect(candidates).toContain('stripe');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx vitest run src/sources/__tests__/discovery.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create discovery.ts**

Create `packages/backend/src/sources/discovery.ts`:

```typescript
import Groq from 'groq-sdk';

const PROBE_TIMEOUT = 5000;

export function generateSlugCandidates(name: string): string[] {
  const lower = name.toLowerCase().trim();
  const noSpecial = lower.replace(/[^a-z0-9\s]/g, '');
  const words = noSpecial.split(/\s+/).filter(Boolean);

  const candidates = new Set<string>();
  candidates.add(words.join(''));        // hubspot
  candidates.add(words.join('-'));       // hub-spot
  candidates.add(words.join('_'));       // hub_spot
  if (words.length > 1) {
    candidates.add(words[0]);            // hub (first word only)
  }

  return Array.from(candidates);
}

async function probeUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.status === 429) {
      // Rate limited — wait and retry once
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
    // Probe Greenhouse
    if (!result.greenhouse) {
      const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;
      const ok = await probeUrl(url);
      if (ok) {
        try {
          const res = await fetch(url);
          const data = await res.json() as any;
          if (data.jobs && data.jobs.length > 0) {
            result.greenhouse = slug;
          }
        } catch { /* skip */ }
      }
    }

    // Probe Lever
    if (!result.lever) {
      const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT) });
        if (res.ok) {
          const data = await res.json() as any[];
          if (Array.isArray(data) && data.length > 0) {
            result.lever = slug;
          }
        }
      } catch { /* skip */ }
    }

    // Probe Ashby
    if (!result.ashby) {
      const url = `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
      const ok = await probeUrl(url);
      if (ok) result.ashby = slug;
    }

    // Rate limit: 500ms between slug attempts
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
    // Extract JSON array from response (handle potential markdown wrapping)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    return JSON.parse(jsonMatch[0]) as { name: string; reason: string }[];
  } catch (err) {
    console.error('[discovery] Groq AI discovery failed:', err);
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && npx vitest run src/sources/__tests__/discovery.test.ts`
Expected: PASS (slug generation tests pass; probing tests need mocking for network calls)

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/sources/discovery.ts packages/backend/src/sources/__tests__/discovery.test.ts
git commit -m "feat: add company discovery module with ATS probing and Groq AI suggestions"
```

---

## Task 10: Discovery API Endpoints and Cron

**Files:**
- Modify: `packages/backend/src/api/routes/companies.ts`
- Modify: `packages/backend/src/scheduler/cron.ts`
- Modify: `packages/backend/src/api/server.ts`

Add discover endpoint and weekly cron job.

- [ ] **Step 1: Add discover endpoints to companies router**

Add to `packages/backend/src/api/routes/companies.ts`:

```typescript
import { probeCompany, discoverCompaniesViaAi } from '../../sources/discovery.js';

// POST /api/companies/discover — manual trigger, returns candidates (logs to discovery_runs)
router.post('/discover', async (req, res, next) => {
  try {
    // Log discovery run
    const run = queries.createDiscoveryRun({ startedAt: new Date().toISOString(), status: 'running', source: 'manual' });

    const profiles = queries.getActiveProfiles();
    if (profiles.length === 0) {
      res.status(400).json({ error: 'No active profiles' });
      return;
    }

    const profile = profiles[0];
    const targetTitles = JSON.parse(profile.targetTitles);
    const targetLocations = profile.targetLocations ? JSON.parse(profile.targetLocations) : [];
    const existingCompanies = queries.getCompanies().map((c: any) => c.name);

    const suggestions = await discoverCompaniesViaAi(targetTitles, targetLocations, existingCompanies);

    // Probe each suggestion for ATS slugs
    const candidates = [];
    for (const s of suggestions) {
      const slugs = await probeCompany(s.name);
      if (slugs.greenhouse || slugs.lever || slugs.ashby) {
        candidates.push({ ...s, ...slugs });
      }
    }

    // Update discovery run
    queries.updateDiscoveryRun(run.id, {
      finishedAt: new Date().toISOString(),
      companiesFound: suggestions.length,
      companiesNew: candidates.length,
      status: 'completed',
    });

    res.json({ companies: candidates });
  } catch (err) {
    // Log failure if run was created
    next(err);
  }
});

// POST /api/companies/discover/confirm — insert confirmed companies
router.post('/discover/confirm', (req, res, next) => {
  try {
    const { companies: newCompanies } = req.body;
    let inserted = 0;
    for (const c of newCompanies) {
      queries.insertCompany({
        name: c.name,
        greenhouseSlug: c.greenhouse || null,
        leverSlug: c.lever || null,
        ashbySlug: c.ashby || null,
        source: 'discovered',
      });
      inserted++;
    }
    res.json({ inserted });
  } catch (err) { next(err); }
});
```

- [ ] **Step 2: Update cron.ts with weekly discovery**

Replace `packages/backend/src/scheduler/cron.ts`:

```typescript
import cron from 'node-cron';

export function startScheduler(
  triggerScrape: () => Promise<void>,
  triggerDiscovery?: () => Promise<void>
) {
  // Daily scrape at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Nightly scrape started`);
    try {
      await triggerScrape();
      console.log(`[${new Date().toISOString()}] Nightly scrape completed`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Nightly scrape failed:`, err);
    }
  });
  console.log('Scheduler registered: nightly scrape at 2:00 AM');

  // Weekly discovery at 4:00 AM Sunday
  if (triggerDiscovery) {
    cron.schedule('0 4 * * 0', async () => {
      console.log(`[${new Date().toISOString()}] Weekly company discovery started`);
      try {
        await triggerDiscovery();
        console.log(`[${new Date().toISOString()}] Weekly company discovery completed`);
      } catch (err) {
        console.error(`[${new Date().toISOString()}] Weekly company discovery failed:`, err);
      }
    });
    console.log('Scheduler registered: weekly company discovery at 4:00 AM Sunday');
  }
}
```

- [ ] **Step 3: Wire discovery into server.ts**

Add a `triggerDiscovery` function in `server.ts` that:
1. Creates a `discovery_runs` record
2. Calls `discoverCompaniesViaAi()` with the active profile's titles + locations
3. Probes each suggestion
4. Inserts valid companies with `source = 'ai-suggested'`
5. Updates the `discovery_runs` record

Pass it to `startScheduler`.

- [ ] **Step 4: Run tests**

Run: `cd packages/backend && npx vitest run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/api/routes/companies.ts packages/backend/src/scheduler/cron.ts
git add packages/backend/src/api/server.ts
git commit -m "feat: add company discovery endpoints and weekly cron job"
```

---

## Task 11: Config Export/Import API

**Files:**
- Create: `packages/backend/src/api/routes/config.ts`
- Modify: `packages/backend/src/api/server.ts`

Export and import user configuration as JSON.

- [ ] **Step 1: Create config.ts**

Create `packages/backend/src/api/routes/config.ts`:

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { hydrateUserDictionary } from '../../db/bootstrap.js';
import { loadFullTemplate } from '../../documents/dictionary.js';
import type { createQueries } from '../../db/queries.js';

const JobGridConfigSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().optional(),
  name: z.string(),
  avatarColor: z.string(),
  archetype: z.string(),
  targetTitles: z.array(z.string()),
  titleSynonyms: z.record(z.array(z.string())),
  excludeTitles: z.array(z.string()),
  targetSkills: z.array(z.string()),
  targetCerts: z.array(z.string()),
  targetLocations: z.array(z.string()),
  remotePreference: z.boolean(),
  searchQueries: z.array(z.string()),
  weights: z.object({
    freshness: z.number(),
    skill: z.number(),
    title: z.number(),
    cert: z.number(),
    competition: z.number(),
    location: z.number(),
    experience: z.number(),
  }),
  analyticTopN: z.number(),
  aiTopN: z.number(),
  customDictionary: z.array(z.object({ category: z.string(), term: z.string() })),
  customCompanies: z.array(z.object({
    name: z.string(),
    greenhouseSlug: z.string().optional(),
    leverSlug: z.string().optional(),
    ashbySlug: z.string().optional(),
  })),
});

export function createConfigRouter(queries: ReturnType<typeof createQueries>) {
  const router = Router();

  // GET /api/config/export
  router.get('/export', (req, res) => {
    const userId = req.userId;
    const user = queries.getUserById(userId);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const profiles = queries.getProfilesByUser(userId);
    const profile = profiles.find((p: any) => p.isActive) || profiles[0];
    if (!profile) { res.status(404).json({ error: 'No profile found' }); return; }

    // Get custom dictionary terms (non-template)
    const dictTerms = queries.getDictionaryTermsByUser(userId);
    const customDictionary = dictTerms
      .filter((t: any) => t.source !== 'template')
      .map((t: any) => ({ category: t.category, term: t.term }));

    // Get custom companies (non-seed)
    const allCompanies = queries.getCompanies();
    const customCompanies = allCompanies
      .filter((c: any) => c.source === 'manual')
      .map((c: any) => ({
        name: c.name,
        greenhouseSlug: c.greenhouseSlug || undefined,
        leverSlug: c.leverSlug || undefined,
        ashbySlug: c.ashbySlug || undefined,
      }));

    const config = {
      version: 1 as const,
      exportedAt: new Date().toISOString(),
      name: user.name,
      avatarColor: user.avatarColor,
      archetype: profile.archetype || 'custom',
      targetTitles: JSON.parse(profile.targetTitles),
      titleSynonyms: profile.titleSynonyms ? JSON.parse(profile.titleSynonyms) : {},
      excludeTitles: profile.excludeTitles ? JSON.parse(profile.excludeTitles) : [],
      targetSkills: JSON.parse(profile.targetSkills),
      targetCerts: profile.targetCerts ? JSON.parse(profile.targetCerts) : [],
      targetLocations: profile.targetLocations ? JSON.parse(profile.targetLocations) : [],
      remotePreference: !!profile.remotePreference,
      searchQueries: profile.searchQueries ? JSON.parse(profile.searchQueries) : [],
      weights: {
        freshness: profile.freshnessWeight,
        skill: profile.skillWeight,
        title: profile.titleWeight,
        cert: profile.certWeight,
        competition: profile.competitionWeight,
        location: profile.locationWeight,
        experience: profile.experienceWeight,
      },
      analyticTopN: profile.analyticTopN,
      aiTopN: profile.aiTopN,
      customDictionary,
      customCompanies,
    };

    res.setHeader('Content-Disposition', 'attachment; filename="jobgrid-config.json"');
    res.json(config);
  });

  // POST /api/config/import — validate and preview
  router.post('/import', (req, res, next) => {
    try {
      const parsed = JobGridConfigSchema.parse(req.body);
      res.json({ valid: true, preview: parsed });
    } catch (err) { next(err); }
  });

  // POST /api/config/import/confirm — apply config
  router.post('/import/confirm', (req, res, next) => {
    try {
      const config = JobGridConfigSchema.parse(req.body);

      // Create user
      const user = queries.insertUser({ name: config.name, avatarColor: config.avatarColor });

      // Load archetype template dictionary
      hydrateUserDictionary(user.id, config.archetype);

      // Add custom dictionary terms
      for (const { category, term } of config.customDictionary) {
        queries.insertDictionaryTerm(user.id, category, term, 'manual');
      }

      // Create profile
      queries.insertProfile({
        name: config.archetype,
        targetTitles: JSON.stringify(config.targetTitles),
        targetSkills: JSON.stringify(config.targetSkills),
        targetCerts: JSON.stringify(config.targetCerts),
        targetLocations: JSON.stringify(config.targetLocations),
        searchQueries: JSON.stringify(config.searchQueries),
        titleSynonyms: JSON.stringify(config.titleSynonyms),
        excludeTitles: JSON.stringify(config.excludeTitles),
        archetype: config.archetype,
        remotePreference: config.remotePreference,
        freshnessWeight: config.weights.freshness,
        skillWeight: config.weights.skill,
        titleWeight: config.weights.title,
        certWeight: config.weights.cert,
        competitionWeight: config.weights.competition,
        locationWeight: config.weights.location,
        experienceWeight: config.weights.experience,
        analyticTopN: config.analyticTopN,
        aiTopN: config.aiTopN,
        userId: user.id,
      });

      // Add custom companies
      for (const c of config.customCompanies) {
        queries.insertCompany({
          name: c.name,
          greenhouseSlug: c.greenhouseSlug || null,
          leverSlug: c.leverSlug || null,
          ashbySlug: c.ashbySlug || null,
          source: 'manual',
        });
      }

      res.json({ success: true, userId: user.id });
    } catch (err) { next(err); }
  });

  return router;
}
```

- [ ] **Step 2: Register in server.ts**

```typescript
import { createConfigRouter } from './routes/config.js';
app.use('/api/config', createConfigRouter(queries));
```

- [ ] **Step 3: Add missing query helpers**

Add `getDictionaryTermsByUser(userId)` to queries.ts — returns all rows from `user_dictionary` for a user.

- [ ] **Step 4: Run tests**

Run: `cd packages/backend && npx vitest run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/api/routes/config.ts packages/backend/src/api/server.ts packages/backend/src/db/queries.ts
git commit -m "feat: add config export/import API endpoints"
```

---

## Task 12: Migration Script for Existing Databases

**Files:**
- Create: `packages/backend/src/db/migrate-dictionary.ts`
- Modify: `packages/backend/src/api/server.ts`

One-time migration for existing installs: backfill `user_dictionary`, set default column values.

- [ ] **Step 1: Create migrate-dictionary.ts**

```typescript
import { db } from './index.js';
import { users, userDictionary, companies } from './schema.js';
import { eq, sql } from 'drizzle-orm';
import { hydrateUserDictionary, loadSeedCompanies } from './bootstrap.js';

/**
 * One-time migration for existing databases.
 * Run automatically on startup if users exist but user_dictionary is empty.
 */
export function runExistingDbMigration(): void {
  const allUsers = db.select().from(users).all();
  if (allUsers.length === 0) return; // Fresh install — bootstrap wizard handles this

  const dictRows = db.select().from(userDictionary).all();
  if (dictRows.length > 0) return; // Already migrated

  console.log('[migration] Existing DB detected — running one-time dictionary backfill...');

  for (const user of allUsers) {
    // Default archetype for existing PM/TPM user
    const termCount = hydrateUserDictionary(user.id, 'pm-tpm');
    console.log(`[migration] Loaded ${termCount} template terms for user ${user.name} (id=${user.id})`);

    // Re-extract terms from existing uploaded documents
    const docs = db.select().from(documents).where(eq(documents.userId, user.id)).all();
    for (const doc of docs) {
      if (!doc.rawText) continue;
      const extracted = extractProfileData(doc.rawText); // No userId — uses template fallback
      const categories = [
        { cat: 'technical', terms: extracted.skills },
        { cat: 'certifications', terms: extracted.certs },
        { cat: 'tools', terms: extracted.tools },
      ];
      for (const { cat, terms } of categories) {
        for (const term of terms) {
          db.insert(userDictionary).values({
            userId: user.id, category: cat, term, source: 'resume',
          }).onConflictDoNothing().run();
        }
      }
    }
    console.log(`[migration] Re-extracted resume terms for user ${user.name}`);
  }

  // Load seed companies if no 'seed' source companies exist
  const seedCompanies = db.select().from(companies)
    .where(eq(companies.source, 'seed')).all();

  if (seedCompanies.length === 0) {
    const inserted = loadSeedCompanies();
    console.log(`[migration] Loaded ${inserted} seed companies`);
  }

  console.log('[migration] One-time migration complete');
}
```

- [ ] **Step 2: Call on server startup**

In `packages/backend/src/api/server.ts`, after DB initialization and migration:

```typescript
import { runExistingDbMigration } from '../db/migrate-dictionary.js';
// After drizzle migration runs:
runExistingDbMigration();
```

- [ ] **Step 3: Run tests**

Run: `cd packages/backend && npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/db/migrate-dictionary.ts packages/backend/src/api/server.ts
git commit -m "feat: add one-time migration script for existing databases"
```

---

## Task 13: Seed Companies List

**Files:**
- Create: `data/seed/companies.json`

Research and create a large list of 300+ companies with verified ATS slugs. This is a data task, not a code task.

- [ ] **Step 1: Research companies using Greenhouse, Lever, and Ashby**

Use web search and known public job boards to compile companies across industries: tech, finance, healthcare, retail, manufacturing, consulting. Focus on companies with active hiring (large enough to have PM/TPM/SWE roles).

- [ ] **Step 2: Create data/seed/companies.json**

Format per the `SeedCompany` interface. Include at minimum: `name` and at least one of `greenhouseSlug`, `leverSlug`, `ashbySlug`. Optional: `domain`, `industries`, `hqLocation`, `size`.

Start with a working list of ~50 verified companies; expand over time. The file should be valid JSON array.

- [ ] **Step 3: Verify a sample of slugs**

Spot-check 5-10 slugs manually:
```bash
curl -s "https://boards-api.greenhouse.io/v1/boards/hubspot/jobs" | head -c 200
curl -s "https://api.lever.co/v0/postings/stripe?mode=json" | head -c 200
```

- [ ] **Step 4: Commit**

```bash
git add data/seed/companies.json
git commit -m "feat: add curated seed company list with ATS slugs"
```

---

## Task 14: Frontend — Setup Wizard Page

**Files:**
- Create: `packages/frontend/src/pages/Setup.tsx`
- Modify: `packages/frontend/src/api/client.ts`
- Modify: `packages/frontend/src/api/types.ts`
- Modify: `packages/frontend/src/App.tsx`

Create the 8-step setup wizard UI that calls the `/api/setup/*` endpoints.

- [ ] **Step 1: Add setup API methods to client.ts**

Add functions for each setup endpoint:

```typescript
export const setupUser = (data: { name: string; avatarColor: string }) =>
  api.post('/setup/user', data).then(r => r.data);

export const setupArchetype = (data: { archetype: string; userId: number }) =>
  api.post('/setup/archetype', data).then(r => r.data);

export const setupDocuments = (file: File, type: string, userId: number) => {
  const form = new FormData();
  form.append('file', file);
  form.append('type', type);
  form.append('userId', String(userId));
  return api.post('/setup/documents', form).then(r => r.data);
};

export const setupSkills = (data: { userId: number; add?: any[]; remove?: any[] }) =>
  api.post('/setup/skills', data).then(r => r.data);

export const setupProfile = (data: any) =>
  api.post('/setup/profile', data).then(r => r.data);

export const setupCompanies = () =>
  api.post('/setup/companies').then(r => r.data);

export const setupComplete = (triggerScrape: boolean) =>
  api.post('/setup/complete', { triggerScrape }).then(r => r.data);

export const exportConfig = () =>
  api.get('/config/export').then(r => r.data);

export const importConfig = (config: any) =>
  api.post('/config/import', config).then(r => r.data);

export const importConfigConfirm = (config: any) =>
  api.post('/config/import/confirm', config).then(r => r.data);
```

- [ ] **Step 2: Add 412 interceptor to client.ts**

Add an Axios response interceptor that detects 412 and triggers a redirect:

```typescript
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 412 && error.response?.data?.error === 'setup_required') {
      window.location.href = '/setup';
    }
    return Promise.reject(error);
  }
);
```

- [ ] **Step 3: Create Setup.tsx**

Create `packages/frontend/src/pages/Setup.tsx` — an 8-step wizard component. Each step is a section with form inputs and a "Next" button that calls the corresponding API endpoint. Include:

- Step 1: Name + avatar color picker + "Import Config" button
- Step 2: Radio buttons for archetype selection (PM/TPM, SWE, Data Scientist, Custom)
- Step 3: File upload for resume + LinkedIn (reuse `DocumentUpload` component pattern)
- Step 4: Skill list with checkboxes, add/remove controls
- Step 5: Title inputs, synonym editor, exclude list
- Step 6: Location inputs, remote toggle
- Step 7: "Loading companies..." with count display
- Step 8: Summary + "Start First Scan" button

- [ ] **Step 4: Add route in App.tsx**

Add routing logic: if current path is `/setup`, render `<Setup />`. Add navigation after setup completes.

- [ ] **Step 5: Test manually**

Start dev servers, clear the database, verify the setup wizard appears and each step works.

Run: `cd packages/backend && rm -f data/jobgrid.db && pnpm dev`
Run (separate terminal): `cd packages/frontend && pnpm dev`

Expected: Frontend shows setup wizard, each step calls API correctly.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/pages/Setup.tsx packages/frontend/src/api/client.ts
git add packages/frontend/src/api/types.ts packages/frontend/src/App.tsx
git commit -m "feat: add frontend setup wizard with 8-step flow"
```

---

## Task 15: Frontend — Skills Settings Page

**Files:**
- Create: `packages/frontend/src/pages/Settings/Skills.tsx`
- Modify: `packages/frontend/src/App.tsx`

UI for managing the user's dictionary terms.

- [ ] **Step 1: Add dictionary API methods to client.ts**

```typescript
export const getDictionaryTerms = () =>
  api.get('/setup/skills').then(r => r.data); // Or create a dedicated GET endpoint

export const addDictionaryTerm = (userId: number, category: string, term: string) =>
  api.post('/setup/skills', { userId, add: [{ category, term }] }).then(r => r.data);

export const removeDictionaryTerm = (userId: number, category: string, term: string) =>
  api.post('/setup/skills', { userId, remove: [{ category, term }] }).then(r => r.data);
```

- [ ] **Step 2: Create Skills.tsx**

Shows all dictionary terms grouped by category. Each term has a source badge and a remove button. "Add term" input at the top of each category. "Reset to template" button.

- [ ] **Step 3: Wire into App.tsx navigation**

Add a "My Skills" link in the settings/sidebar that renders `<Skills />`.

- [ ] **Step 4: Test manually**

Verify terms load, add/remove works, source badges display correctly.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/pages/Settings/Skills.tsx packages/frontend/src/api/client.ts packages/frontend/src/App.tsx
git commit -m "feat: add My Skills settings page for dictionary management"
```

---

## Task 16: Frontend — Company Discovery UI

**Files:**
- Modify: `packages/frontend/src/api/client.ts`
- Modify: company list component (likely in `packages/frontend/src/App.tsx` or a dedicated component)

Add source badges, "Discover More" button, and discovery log.

- [ ] **Step 1: Add discovery API methods to client.ts**

```typescript
export const discoverCompanies = () =>
  api.post('/companies/discover').then(r => r.data);

export const confirmDiscoveredCompanies = (companies: any[]) =>
  api.post('/companies/discover/confirm', { companies }).then(r => r.data);
```

- [ ] **Step 2: Update company list UI**

Add source badge (seed / manual / discovered / ai-suggested) next to each company name. Add a "Discover More" button that calls `discoverCompanies()` and shows results in a modal for confirmation.

- [ ] **Step 3: Test manually**

Verify company list shows badges, discover button works (may return empty if no Groq key).

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/api/client.ts packages/frontend/src/
git commit -m "feat: add company discovery UI with source badges and discover button"
```

---

## Task 17: Update .env.example

**Files:**
- Modify: `.env.example`

Ensure new users cloning the repo know what environment variables to set.

- [ ] **Step 1: Update .env.example**

```
GROQ_API_KEY=
DB_PATH=./data/jobgrid.db
PORT=3001
SCRAPE_RADIUS=25
MAX_APPLICANTS=30
DAYS_POSTED=1
NODE_ENV=development
```

This file already exists and is correct. Verify it is committed and up to date.

- [ ] **Step 2: Commit if changed**

```bash
git add .env.example
git commit -m "chore: verify .env.example is up to date"
```

---

## Task 18: Tests for Setup and Config API Endpoints

**Files:**
- Create: `packages/backend/src/api/__tests__/setup.test.ts`
- Create: `packages/backend/src/api/__tests__/config.test.ts`

- [ ] **Step 1: Write setup endpoint tests**

Create `packages/backend/src/api/__tests__/setup.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
// Test the setup endpoints using supertest or by calling the route handlers directly.
// Key scenarios:
// - POST /api/setup/user creates a user and returns userId
// - POST /api/setup/archetype creates a profile with template defaults and populates user_dictionary
// - POST /api/setup/skills adds/removes dictionary terms
// - POST /api/setup/profile auto-generates searchQueries from titles + synonyms
// - POST /api/setup/companies loads seed companies
// - POST /api/setup/complete returns success
// - All endpoints are idempotent (calling twice doesn't create duplicates)
```

- [ ] **Step 2: Write config endpoint tests**

Create `packages/backend/src/api/__tests__/config.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
// Test the config endpoints:
// - GET /api/config/export returns valid JobGridConfig JSON
// - Export does NOT include resume text, scores, job data, or API keys
// - POST /api/config/import validates the Zod schema and rejects invalid configs
// - POST /api/config/import/confirm creates user + profile + dictionary + companies
// - Import loads archetype template THEN merges customDictionary on top
```

- [ ] **Step 3: Run tests**

Run: `cd packages/backend && npx vitest run src/api/__tests__/setup.test.ts src/api/__tests__/config.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/api/__tests__/setup.test.ts packages/backend/src/api/__tests__/config.test.ts
git commit -m "test: add tests for setup wizard and config export/import endpoints"
```

---

## Task 19: Document Upload Cleanup

**Files:**
- Modify: `packages/backend/src/api/routes/documents.ts`
- Modify: `packages/backend/src/api/routes/setup.ts`

When a user re-uploads a document, delete the old file from `data/uploads/` before saving the new one.

- [ ] **Step 1: Add file cleanup to document upload**

In `packages/backend/src/api/routes/documents.ts`, before `queries.deleteDocumentByTypeAndUser(type, req.userId)`, check if the old document exists and delete its file:

```typescript
import { unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';

// Before deleting the old DB record, remove the old file if stored on disk
const oldDocs = queries.getDocumentsByTypeAndUser(type, req.userId);
for (const oldDoc of oldDocs) {
  const oldPath = resolve(process.cwd(), 'data/uploads', oldDoc.filename);
  if (existsSync(oldPath)) {
    unlinkSync(oldPath);
  }
}
```

Note: Currently documents use `multer.memoryStorage()` (files are not saved to disk). If the implementation changes to disk storage in the future, this cleanup is in place. For now, this is a defensive addition.

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/api/routes/documents.ts
git commit -m "feat: add file cleanup on document re-upload"
```

---

## Task 20: Final Integration Test

**Files:** None — verification only.

- [ ] **Step 1: Clean slate test**

```bash
cd packages/backend && rm -f data/jobgrid.db
pnpm dev
```

In a separate terminal:
```bash
cd packages/frontend && pnpm dev
```

Verify:
1. App shows setup wizard (412 redirect works)
2. Complete all 8 steps
3. Companies are loaded from seed
4. Dictionary is populated
5. First scrape triggers (or at least the endpoint works)

- [ ] **Step 2: Config export test**

After setup, call `GET /api/config/export` and verify the JSON contains the user's config without personal data (no resume text, no scores, no API keys).

- [ ] **Step 3: Config import test**

Clear DB again. Import the exported config. Verify all steps are pre-filled.

- [ ] **Step 4: Existing DB migration test**

Start with a DB that has existing users/profiles/companies (from before the migration). Run the app. Verify the one-time dictionary backfill runs and seed companies are merged.

- [ ] **Step 5: Git push cleanliness test**

```bash
git status
```

Verify no personal data is staged or tracked. Only code, seed files, and templates.

- [ ] **Step 6: Run full test suite**

```bash
cd packages/backend && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 7: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "test: verify personal-first open-source architecture end to end"
```

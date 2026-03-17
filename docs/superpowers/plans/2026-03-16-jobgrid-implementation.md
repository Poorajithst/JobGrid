# JobGrid Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal job-discovery platform that pulls PM listings from 5 sources nightly, scores them with Groq AI, and presents a ranked dark analytics dashboard.

**Architecture:** pnpm monorepo with `packages/backend` (Express + Drizzle + sources + scorer + cron) and `packages/frontend` (React + Vite + shadcn/ui). SQLite database via Drizzle ORM for portability. Zod schemas shared from backend to frontend.

**Tech Stack:** TypeScript, pnpm workspaces, Express.js, Drizzle ORM, SQLite, Playwright, Groq API, React 19, Vite, shadcn/ui, Tailwind CSS v4, Axios, Zod, node-cron

**Spec:** `docs/superpowers/specs/2026-03-16-jobgrid-design.md`

---

## Chunk 1: Project Scaffolding, Database & Company Seed

### Task 1: Initialize pnpm workspace and root config

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `.env`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "jobgrid",
  "private": true,
  "scripts": {
    "dev:backend": "pnpm --filter @jobgrid/backend dev",
    "dev:frontend": "pnpm --filter @jobgrid/frontend dev",
    "dev": "pnpm run dev:backend & pnpm run dev:frontend",
    "build": "pnpm --filter @jobgrid/frontend build",
    "db:generate": "pnpm --filter @jobgrid/backend db:generate",
    "db:migrate": "pnpm --filter @jobgrid/backend db:migrate"
  }
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 3: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
data/
.env
*.db
*.db-journal
.superpowers/
```

- [ ] **Step 5: Create .env.example**

```
GROQ_API_KEY=your_groq_key
DB_PATH=./data/jobgrid.db
PORT=3001
SCRAPE_RADIUS=25
MAX_APPLICANTS=30
DAYS_POSTED=1
NODE_ENV=development
```

- [ ] **Step 6: Create .env with your actual GROQ_API_KEY**

Copy `.env.example` to `.env` and fill in `GROQ_API_KEY`. Leave other values as defaults.

- [ ] **Step 7: Run `pnpm init` and install**

Run: `pnpm install`
Expected: lockfile created, empty workspace

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore .env.example
git commit -m "chore: initialize pnpm workspace with root config"
```

---

### Task 2: Set up backend package

**Files:**
- Create: `packages/backend/package.json`
- Create: `packages/backend/tsconfig.json`
- Create: `packages/backend/drizzle.config.ts`

- [ ] **Step 1: Create backend package.json**

```json
{
  "name": "@jobgrid/backend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/api/server.ts",
    "start": "tsx src/api/server.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/db/migrate.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "drizzle-orm": "^0.38.0",
    "express": "^4.21.0",
    "groq-sdk": "^0.8.0",
    "node-cron": "^3.0.3",
    "playwright": "^1.49.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/cors": "^2.8.0",
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "@types/node-cron": "^3.0.0",
    "drizzle-kit": "^0.30.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  },
  "exports": {
    "./schemas": "./src/api/schemas.ts"
  }
}
```

- [ ] **Step 2: Create backend tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create drizzle.config.ts**

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_PATH || './data/jobgrid.db',
  },
});
```

- [ ] **Step 4: Create data directory**

```bash
mkdir -p packages/backend/data
```

- [ ] **Step 5: Install backend dependencies**

```bash
cd packages/backend && pnpm install
```
Expected: all deps installed, no errors

- [ ] **Step 6: Commit**

```bash
git add packages/backend/package.json packages/backend/tsconfig.json packages/backend/drizzle.config.ts
git commit -m "chore: set up backend package with dependencies"
```

---

### Task 3: Set up frontend package with shadcn/ui and dark theme

**Files:**
- Create: `packages/frontend/` (via Vite scaffold)
- Modify: `packages/frontend/src/index.css`
- Create: `packages/frontend/src/lib/utils.ts`

- [ ] **Step 1: Scaffold Vite React-TS project**

```bash
cd packages && pnpm create vite frontend -- --template react-ts
cd frontend && pnpm install
```

- [ ] **Step 2: Install Tailwind CSS v4 and dependencies**

```bash
pnpm add -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: Install shadcn/ui dependencies**

```bash
pnpm add tailwind-merge clsx class-variance-authority lucide-react
pnpm add -D @types/node
```

- [ ] **Step 4: Install Axios**

```bash
pnpm add axios
```

- [ ] **Step 5: Configure Vite for Tailwind and API proxy**

Update `packages/frontend/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 6: Create utils.ts for shadcn cn() helper**

Create `packages/frontend/src/lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 7: Set up dark theme CSS**

Replace `packages/frontend/src/index.css`:

```css
@import "tailwindcss";

@theme {
  --color-bg-primary: #080b14;
  --color-bg-secondary: #0a0f1e;
  --color-bg-tertiary: #0f172a;
  --color-bg-card: #1e293b;
  --color-border: #334155;
  --color-border-subtle: rgba(51, 65, 85, 0.4);
  --color-text-primary: #e2e8f0;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #64748b;
  --color-text-dim: #475569;
  --color-accent-indigo: #6366f1;
  --color-accent-indigo-light: #a5b4fc;
  --color-accent-green: #10b981;
  --color-accent-green-light: #6ee7b7;
  --color-accent-amber: #f59e0b;
  --color-accent-amber-light: #fcd34d;
  --color-accent-cyan: #06b6d4;
  --color-accent-cyan-light: #67e8f9;
  --color-accent-red: #ef4444;
  --color-accent-red-light: #fca5a5;
  --color-accent-purple: #a855f7;
  --color-accent-purple-light: #c084fc;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

@layer base {
  body {
    @apply bg-bg-primary text-text-primary font-sans antialiased;
  }
}
```

- [ ] **Step 8: Create frontend .env**

Create `packages/frontend/.env`:

```
VITE_API_URL=http://localhost:3001/api
```

- [ ] **Step 9: Verify frontend starts**

```bash
cd packages/frontend && pnpm dev
```
Expected: Vite dev server starts on port 5173, page loads with dark background

- [ ] **Step 10: Commit**

```bash
git add packages/frontend/
git commit -m "chore: set up frontend with Vite, Tailwind v4, shadcn/ui dark theme"
```

---

### Task 4: Define Drizzle database schema

**Files:**
- Create: `packages/backend/src/db/schema.ts`

- [ ] **Step 1: Write the schema test**

Create `packages/backend/src/db/__tests__/schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { companies, jobs, outreach, scrapeRuns } from '../schema.js';
import { getTableColumns } from 'drizzle-orm';

describe('Database Schema', () => {
  it('companies table has required columns', () => {
    const cols = getTableColumns(companies);
    expect(cols.id).toBeDefined();
    expect(cols.name).toBeDefined();
    expect(cols.greenhouseSlug).toBeDefined();
    expect(cols.leverSlug).toBeDefined();
    expect(cols.active).toBeDefined();
    expect(cols.lastChecked).toBeDefined();
    expect(cols.createdAt).toBeDefined();
  });

  it('jobs table has required columns', () => {
    const cols = getTableColumns(jobs);
    expect(cols.id).toBeDefined();
    expect(cols.title).toBeDefined();
    expect(cols.company).toBeDefined();
    expect(cols.link).toBeDefined();
    expect(cols.source).toBeDefined();
    expect(cols.fitScore).toBeDefined();
    expect(cols.competition).toBeDefined();
    expect(cols.recommendation).toBeDefined();
    expect(cols.pitch).toBeDefined();
    expect(cols.status).toBeDefined();
  });

  it('outreach table has required columns', () => {
    const cols = getTableColumns(outreach);
    expect(cols.id).toBeDefined();
    expect(cols.jobId).toBeDefined();
    expect(cols.type).toBeDefined();
    expect(cols.content).toBeDefined();
  });

  it('scrapeRuns table has required columns', () => {
    const cols = getTableColumns(scrapeRuns);
    expect(cols.id).toBeDefined();
    expect(cols.startedAt).toBeDefined();
    expect(cols.status).toBeDefined();
    expect(cols.jobsFound).toBeDefined();
    expect(cols.jobsNew).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && pnpm test -- src/db/__tests__/schema.test.ts`
Expected: FAIL — cannot find `../schema.js`

- [ ] **Step 3: Write the schema**

Create `packages/backend/src/db/schema.ts`:

```typescript
import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const companies = sqliteTable('companies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  greenhouseSlug: text('greenhouse_slug'),
  leverSlug: text('lever_slug'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  lastChecked: text('last_checked'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const jobs = sqliteTable('jobs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  company: text('company').notNull(),
  location: text('location'),
  applicants: integer('applicants'),
  description: text('description'),
  link: text('link').notNull().unique(),
  source: text('source').notNull(),
  atsId: text('ats_id'),
  postedAt: text('posted_at'),
  scrapedAt: text('scraped_at').notNull().default(sql`(datetime('now'))`),
  fitScore: integer('fit_score'),
  competition: text('competition'),
  recommendation: text('recommendation'),
  pitch: text('pitch'),
  scoreReason: text('score_reason'),
  status: text('status').notNull().default('discovered'),
  notes: text('notes'),
  nextAction: text('next_action'),
  appliedAt: text('applied_at'),
  interviewAt: text('interview_at'),
  offerAt: text('offer_at'),
}, (table) => [
  index('idx_jobs_source').on(table.source),
  index('idx_jobs_status').on(table.status),
  index('idx_jobs_fit_score').on(table.fitScore),
  index('idx_jobs_source_ats_id').on(table.source, table.atsId),
]);

export const outreach = sqliteTable('outreach', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobId: integer('job_id').notNull().references(() => jobs.id),
  type: text('type').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const scrapeRuns = sqliteTable('scrape_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  jobsFound: integer('jobs_found').notNull().default(0),
  jobsNew: integer('jobs_new').notNull().default(0),
  sourcesRun: text('sources_run'),
  status: text('status').notNull(),
  error: text('error'),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && pnpm test -- src/db/__tests__/schema.test.ts`
Expected: PASS — all 4 tests green

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/db/schema.ts packages/backend/src/db/__tests__/schema.test.ts
git commit -m "feat: define Drizzle database schema for all 4 tables"
```

---

### Task 5: Create database connection and migration

**Files:**
- Create: `packages/backend/src/db/index.ts`
- Create: `packages/backend/src/db/migrate.ts`

- [ ] **Step 1: Write the DB connection test**

Create `packages/backend/src/db/__tests__/connection.test.ts`:

```typescript
import { describe, it, expect, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../schema.js';

describe('Database Connection', () => {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });

  afterAll(() => sqlite.close());

  it('can create tables and insert a company', () => {
    sqlite.exec(`
      CREATE TABLE companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        greenhouse_slug TEXT,
        lever_slug TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        last_checked TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    db.insert(schema.companies).values({ name: 'TestCo', greenhouseSlug: 'testco' }).run();
    const result = db.select().from(schema.companies).all();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('TestCo');
    expect(result[0].greenhouseSlug).toBe('testco');
    expect(result[0].active).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd packages/backend && pnpm test -- src/db/__tests__/connection.test.ts`
Expected: PASS

- [ ] **Step 3: Create DB connection singleton**

Create `packages/backend/src/db/index.ts`:

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

import 'dotenv/config';

const DB_PATH = process.env.DB_PATH || './data/jobgrid.db';

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export { sqlite };
```

- [ ] **Step 4: Create migration runner**

Create `packages/backend/src/db/migrate.ts`:

```typescript
import 'dotenv/config';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './index.js';

migrate(db, { migrationsFolder: './drizzle' });
console.log('Migrations complete.');
```

- [ ] **Step 5: Generate and run migration**

```bash
cd packages/backend && pnpm db:generate && pnpm db:migrate
```
Expected: migration SQL generated in `drizzle/`, database file created at `data/jobgrid.db`

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/db/index.ts packages/backend/src/db/migrate.ts packages/backend/drizzle/ packages/backend/src/db/__tests__/connection.test.ts
git commit -m "feat: add database connection, migration runner, and verify with tests"
```

---

### Task 6: Create query helpers

**Files:**
- Create: `packages/backend/src/db/queries.ts`

- [ ] **Step 1: Write query helper tests**

Create `packages/backend/src/db/__tests__/queries.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../schema.js';
import { createQueries } from '../queries.js';

describe('Query Helpers', () => {
  let sqlite: InstanceType<typeof Database>;
  let queries: ReturnType<typeof createQueries>;

  beforeAll(() => {
    sqlite = new Database(':memory:');
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: './drizzle' });
    queries = createQueries(db);
  });

  afterAll(() => sqlite.close());

  it('inserts and retrieves a company', () => {
    queries.insertCompany({ name: 'MathWorks', greenhouseSlug: 'mathworks' });
    const companies = queries.getCompanies();
    expect(companies).toHaveLength(1);
    expect(companies[0].name).toBe('MathWorks');
  });

  it('inserts a job and retrieves by id', () => {
    queries.insertJob({
      title: 'PM',
      company: 'MathWorks',
      link: 'https://example.com/1',
      source: 'greenhouse',
    });
    const job = queries.getJobById(1);
    expect(job).toBeDefined();
    expect(job!.title).toBe('PM');
    expect(job!.status).toBe('discovered');
  });

  it('deduplicates by link', () => {
    const newLinks = queries.filterNewLinks([
      'https://example.com/1',
      'https://example.com/2',
    ]);
    expect(newLinks).toEqual(['https://example.com/2']);
  });

  it('updates job status', () => {
    queries.updateJobStatus(1, 'applied');
    const job = queries.getJobById(1);
    expect(job!.status).toBe('applied');
    expect(job!.appliedAt).toBeDefined();
  });

  it('creates a scrape run', () => {
    const runId = queries.createScrapeRun();
    expect(runId).toBeGreaterThan(0);
    const run = queries.getScrapeRun(runId);
    expect(run!.status).toBe('running');
  });

  it('gets stats', () => {
    const stats = queries.getStats();
    expect(stats.total).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && pnpm test -- src/db/__tests__/queries.test.ts`
Expected: FAIL — cannot find `../queries.js`

- [ ] **Step 3: Write query helpers**

Create `packages/backend/src/db/queries.ts`:

```typescript
import { eq, sql, and, like, gte, desc, asc, inArray } from 'drizzle-orm';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

type DB = BetterSQLite3Database<typeof schema>;

export function createQueries(db: DB) {
  return {
    // Companies
    getCompanies() {
      return db.select().from(schema.companies).all();
    },

    getActiveCompanies() {
      return db.select().from(schema.companies).where(eq(schema.companies.active, true)).all();
    },

    insertCompany(data: { name: string; greenhouseSlug?: string | null; leverSlug?: string | null }) {
      return db.insert(schema.companies).values(data).run();
    },

    updateCompany(id: number, data: Partial<{ name: string; greenhouseSlug: string | null; leverSlug: string | null; active: boolean; lastChecked: string }>) {
      return db.update(schema.companies).set(data).where(eq(schema.companies.id, id)).run();
    },

    deleteCompany(id: number) {
      return db.delete(schema.companies).where(eq(schema.companies.id, id)).run();
    },

    // Jobs
    getJobs(filters: {
      source?: string;
      status?: string;
      competition?: string;
      minScore?: number;
      search?: string;
      sort?: string;
      order?: 'asc' | 'desc';
      page?: number;
      limit?: number;
    } = {}) {
      const { source, status, competition, minScore, search, sort = 'scraped_at', order = 'desc', page = 1, limit = 20 } = filters;
      const conditions = [];

      if (source) conditions.push(eq(schema.jobs.source, source));
      if (status) conditions.push(eq(schema.jobs.status, status));
      if (competition) conditions.push(eq(schema.jobs.competition, competition));
      if (minScore) conditions.push(gte(schema.jobs.fitScore, minScore));
      if (search) conditions.push(
        sql`(${schema.jobs.title} LIKE ${'%' + search + '%'} OR ${schema.jobs.company} LIKE ${'%' + search + '%'})`
      );

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const sortColumn = sort === 'fit_score' ? schema.jobs.fitScore
        : sort === 'posted_at' ? schema.jobs.postedAt
        : schema.jobs.scrapedAt;
      const orderFn = order === 'asc' ? asc : desc;

      const total = db.select({ count: sql<number>`count(*)` })
        .from(schema.jobs)
        .where(where)
        .get()!.count;

      const jobs = db.select()
        .from(schema.jobs)
        .where(where)
        .orderBy(orderFn(sortColumn))
        .limit(limit)
        .offset((page - 1) * limit)
        .all();

      const totalPages = Math.ceil(total / limit);

      return { jobs, total, page, totalPages, hasMore: page < totalPages };
    },

    getJobById(id: number) {
      return db.select().from(schema.jobs).where(eq(schema.jobs.id, id)).get();
    },

    insertJob(data: {
      title: string;
      company: string;
      link: string;
      source: string;
      location?: string | null;
      applicants?: number | null;
      description?: string | null;
      atsId?: string | null;
      postedAt?: string | null;
    }) {
      return db.insert(schema.jobs).values(data).run();
    },

    insertJobs(data: Array<{
      title: string;
      company: string;
      link: string;
      source: string;
      location?: string | null;
      applicants?: number | null;
      description?: string | null;
      atsId?: string | null;
      postedAt?: string | null;
    }>) {
      if (data.length === 0) return;
      return db.insert(schema.jobs).values(data).run();
    },

    filterNewLinks(links: string[]) {
      if (links.length === 0) return [];
      const existing = db.select({ link: schema.jobs.link })
        .from(schema.jobs)
        .where(inArray(schema.jobs.link, links))
        .all()
        .map(r => r.link);
      return links.filter(l => !existing.includes(l));
    },

    updateJobStatus(id: number, status: string) {
      const timestamps: Record<string, string> = {};
      const now = new Date().toISOString();
      if (status === 'applied') timestamps.appliedAt = now;
      if (status === 'interview') timestamps.interviewAt = now;
      if (status === 'offer') timestamps.offerAt = now;

      return db.update(schema.jobs)
        .set({ status, ...timestamps })
        .where(eq(schema.jobs.id, id))
        .run();
    },

    updateJobNotes(id: number, data: { notes?: string; nextAction?: string }) {
      return db.update(schema.jobs).set(data).where(eq(schema.jobs.id, id)).run();
    },

    updateJobScoring(id: number, data: {
      fitScore: number;
      competition: string;
      recommendation: string;
      pitch: string;
      scoreReason: string;
    }) {
      return db.update(schema.jobs).set(data).where(eq(schema.jobs.id, id)).run();
    },

    // Outreach
    getOutreachByJobId(jobId: number) {
      return db.select().from(schema.outreach).where(eq(schema.outreach.jobId, jobId)).all();
    },

    insertOutreach(data: { jobId: number; type: string; content: string }) {
      return db.insert(schema.outreach).values(data).run();
    },

    // Scrape Runs
    createScrapeRun() {
      const result = db.insert(schema.scrapeRuns).values({
        startedAt: new Date().toISOString(),
        status: 'running',
      }).run();
      return Number(result.lastInsertRowid);
    },

    getScrapeRun(id: number) {
      return db.select().from(schema.scrapeRuns).where(eq(schema.scrapeRuns.id, id)).get();
    },

    updateScrapeRun(id: number, data: Partial<{
      finishedAt: string;
      jobsFound: number;
      jobsNew: number;
      sourcesRun: string;
      status: string;
      error: string;
    }>) {
      return db.update(schema.scrapeRuns).set(data).where(eq(schema.scrapeRuns.id, id)).run();
    },

    getRecentScrapeRuns(limit = 10) {
      return db.select()
        .from(schema.scrapeRuns)
        .orderBy(desc(schema.scrapeRuns.startedAt))
        .limit(limit)
        .all();
    },

    // Stats
    getStats() {
      const total = db.select({ count: sql<number>`count(*)` }).from(schema.jobs).get()!.count;
      const avgFit = db.select({ avg: sql<number>`coalesce(avg(fit_score), 0)` }).from(schema.jobs).get()!.avg;
      const lowComp = db.select({ count: sql<number>`count(*)` }).from(schema.jobs).where(eq(schema.jobs.competition, 'low')).get()!.count;

      const bySource = db.select({
        source: schema.jobs.source,
        count: sql<number>`count(*)`,
      }).from(schema.jobs).groupBy(schema.jobs.source).all();

      const byStatus = db.select({
        status: schema.jobs.status,
        count: sql<number>`count(*)`,
      }).from(schema.jobs).groupBy(schema.jobs.status).all();

      const lastRun = db.select()
        .from(schema.scrapeRuns)
        .orderBy(desc(schema.scrapeRuns.startedAt))
        .limit(1)
        .get();

      const today = new Date().toISOString().split('T')[0];
      const newToday = db.select({ count: sql<number>`count(*)` })
        .from(schema.jobs)
        .where(sql`date(scraped_at) = ${today}`)
        .get()!.count;

      return {
        total,
        avg_fit: Math.round(avgFit),
        low_competition: lowComp,
        by_source: Object.fromEntries(bySource.map(r => [r.source, r.count])),
        by_status: Object.fromEntries(byStatus.map(r => [r.status, r.count])),
        last_scraped: lastRun?.finishedAt ?? lastRun?.startedAt ?? null,
        new_today: newToday,
      };
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/backend && pnpm test -- src/db/__tests__/queries.test.ts`
Expected: PASS — all 6 tests green

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/db/queries.ts packages/backend/src/db/__tests__/queries.test.ts
git commit -m "feat: add typed query helpers with tests for all CRUD operations"
```

---

### Task 7: Seed target companies

**Files:**
- Create: `packages/backend/src/db/seed.ts`

- [ ] **Step 1: Write the seed script**

Create `packages/backend/src/db/seed.ts`:

```typescript
import 'dotenv/config';
import { db } from './index.js';
import { companies } from './schema.js';
import { createQueries } from './queries.js';

const queries = createQueries(db);

const SEED_COMPANIES = [
  { name: 'MathWorks', greenhouseSlug: 'mathworks' },
  { name: 'Infosys BPM', greenhouseSlug: 'infosysbpm' },
  { name: 'Abiomed', greenhouseSlug: 'abiomed' },
  { name: 'HubSpot', greenhouseSlug: 'hubspot' },
  { name: 'Wayfair', greenhouseSlug: 'wayfair' },
  { name: 'Toast', greenhouseSlug: 'toast' },
  { name: 'Klaviyo', greenhouseSlug: 'klaviyo' },
  { name: 'Rapid7', greenhouseSlug: 'rapid7' },
  { name: 'Moderna', greenhouseSlug: 'moderna' },
  { name: 'Vanderhoof & Assoc', leverSlug: 'vanderhoof' },
  { name: 'Datto', greenhouseSlug: 'datto' },
  { name: 'Allegro MicroSystems', greenhouseSlug: 'allegromicrosystems' },
  { name: 'Insulet Corporation', greenhouseSlug: 'insulet' },
];

const existing = queries.getCompanies();
if (existing.length > 0) {
  console.log(`Database already has ${existing.length} companies. Skipping seed.`);
} else {
  for (const company of SEED_COMPANIES) {
    queries.insertCompany(company);
  }
  console.log(`Seeded ${SEED_COMPANIES.length} companies.`);
}
```

- [ ] **Step 2: Add seed script to package.json**

Add to `packages/backend/package.json` scripts:
```json
"db:seed": "tsx src/db/seed.ts"
```

- [ ] **Step 3: Run seed**

```bash
cd packages/backend && pnpm db:seed
```
Expected: "Seeded 13 companies."

- [ ] **Step 4: Verify seed worked**

```bash
cd packages/backend && tsx -e "import Database from 'better-sqlite3'; const db = new Database('./data/jobgrid.db'); console.log(db.prepare('SELECT count(*) as c FROM companies').get())"
```
Expected: `{ c: 13 }`

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/db/seed.ts packages/backend/package.json
git commit -m "feat: add company seed script with 13 Worcester/Boston area companies"
```

---

## Chunk 2: ATS API Fetchers & Groq Scoring

### Task 8: Greenhouse API fetcher

**Files:**
- Create: `packages/backend/src/sources/greenhouse.ts`
- Test: `packages/backend/src/sources/__tests__/greenhouse.test.ts`

- [ ] **Step 1: Write the test**

Create `packages/backend/src/sources/__tests__/greenhouse.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchGreenhouse } from '../greenhouse.js';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('fetchGreenhouse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches jobs from companies with greenhouse slugs', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobs: [
          {
            id: 12345,
            title: 'Sr. Project Manager',
            location: { name: 'Worcester, MA' },
            absolute_url: 'https://boards.greenhouse.io/mathworks/jobs/12345',
            updated_at: '2026-03-15T10:00:00Z',
          },
        ],
      }),
    });

    const companies = [
      { name: 'MathWorks', greenhouseSlug: 'mathworks', leverSlug: null },
    ];

    const results = await fetchGreenhouse(companies);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      title: 'Sr. Project Manager',
      company: 'MathWorks',
      location: 'Worcester, MA',
      link: 'https://boards.greenhouse.io/mathworks/jobs/12345',
      atsId: '12345',
      source: 'greenhouse',
      postedAt: '2026-03-15T10:00:00Z',
      applicants: null,
      description: null,
    });
  });

  it('skips companies without greenhouse slug', async () => {
    const companies = [
      { name: 'LeverOnly', greenhouseSlug: null, leverSlug: 'leveronly' },
    ];
    const results = await fetchGreenhouse(companies);
    expect(results).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('handles API errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const companies = [
      { name: 'BadCo', greenhouseSlug: 'badco', leverSlug: null },
    ];
    const results = await fetchGreenhouse(companies);
    expect(results).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && pnpm test -- src/sources/__tests__/greenhouse.test.ts`
Expected: FAIL — cannot find `../greenhouse.js`

- [ ] **Step 3: Write the implementation**

Create `packages/backend/src/sources/greenhouse.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/backend && pnpm test -- src/sources/__tests__/greenhouse.test.ts`
Expected: PASS — all 3 tests green

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/sources/greenhouse.ts packages/backend/src/sources/__tests__/greenhouse.test.ts
git commit -m "feat: add Greenhouse public API fetcher with tests"
```

---

### Task 9: Lever API fetcher

**Files:**
- Create: `packages/backend/src/sources/lever.ts`
- Test: `packages/backend/src/sources/__tests__/lever.test.ts`

- [ ] **Step 1: Write the test**

Create `packages/backend/src/sources/__tests__/lever.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchLever } from '../lever.js';
import type { CompanyInput } from '../greenhouse.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('fetchLever', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches jobs from companies with lever slugs', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        {
          id: 'abc-123',
          text: 'Technical PM',
          categories: { location: 'Boston, MA' },
          hostedUrl: 'https://jobs.lever.co/vanderhoof/abc-123',
          createdAt: 1710500000000,
        },
      ]),
    });

    const companies: CompanyInput[] = [
      { name: 'Vanderhoof', greenhouseSlug: null, leverSlug: 'vanderhoof' },
    ];

    const results = await fetchLever(companies);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      title: 'Technical PM',
      company: 'Vanderhoof',
      location: 'Boston, MA',
      link: 'https://jobs.lever.co/vanderhoof/abc-123',
      atsId: 'abc-123',
      source: 'lever',
      postedAt: expect.any(String),
      applicants: null,
      description: null,
    });
  });

  it('skips companies without lever slug', async () => {
    const companies: CompanyInput[] = [
      { name: 'GHOnly', greenhouseSlug: 'ghonly', leverSlug: null },
    ];
    const results = await fetchLever(companies);
    expect(results).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('handles API errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const companies: CompanyInput[] = [
      { name: 'BadCo', greenhouseSlug: null, leverSlug: 'badco' },
    ];
    const results = await fetchLever(companies);
    expect(results).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && pnpm test -- src/sources/__tests__/lever.test.ts`
Expected: FAIL — cannot find `../lever.js`

- [ ] **Step 3: Write the implementation**

Create `packages/backend/src/sources/lever.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/backend && pnpm test -- src/sources/__tests__/lever.test.ts`
Expected: PASS — all 3 tests green

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/sources/lever.ts packages/backend/src/sources/__tests__/lever.test.ts
git commit -m "feat: add Lever public API fetcher with tests"
```

---

### Task 10: PM profile and scoring prompt

**Files:**
- Create: `packages/backend/src/scorer/profile.ts`
- Create: `packages/backend/src/scorer/prompts.ts`
- Create: `packages/backend/src/api/schemas.ts`

- [ ] **Step 1: Write test for profile and prompts**

Create `packages/backend/src/scorer/__tests__/prompts.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PM_PROFILE } from '../profile.js';
import { buildScoringPrompt, buildOutreachPrompt, ScoreResponseSchema } from '../prompts.js';

describe('PM Profile', () => {
  it('contains required fields', () => {
    expect(PM_PROFILE.role).toContain('Project Manager');
    expect(PM_PROFILE.certifications).toContain('CAPM');
    expect(PM_PROFILE.location).toContain('Worcester');
  });
});

describe('Scoring Prompt', () => {
  it('builds a prompt with job details interpolated', () => {
    const prompt = buildScoringPrompt({
      title: 'PM',
      company: 'TestCo',
      source: 'greenhouse',
      description: 'A PM role',
    });
    expect(prompt).toContain('PM');
    expect(prompt).toContain('TestCo');
    expect(prompt).toContain('CAPM');
  });
});

describe('Outreach Prompt', () => {
  it('builds a prompt for a specific outreach type', () => {
    const prompt = buildOutreachPrompt({
      title: 'PM',
      company: 'TestCo',
      pitch: 'Your AI work matches mine',
      type: 'email',
    });
    expect(prompt).toContain('email');
    expect(prompt).toContain('TestCo');
  });
});

describe('ScoreResponseSchema', () => {
  it('validates correct response', () => {
    const result = ScoreResponseSchema.safeParse({
      fit_score: 85,
      competition: 'low',
      recommendation: 'apply',
      score_reason: 'Great match',
      pitch: 'Your work aligns with mine',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid response', () => {
    const result = ScoreResponseSchema.safeParse({
      fit_score: 'high',
      competition: 'low',
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && pnpm test -- src/scorer/__tests__/prompts.test.ts`
Expected: FAIL — cannot find modules

- [ ] **Step 3: Write PM profile**

Create `packages/backend/src/scorer/profile.ts`:

```typescript
export const PM_PROFILE = {
  role: 'Project Manager at Worcester Polytechnic Institute (WPI)',
  experience: [
    'Managing multi-million dollar infrastructure and security portfolio',
    'AI camera systems: Milestone VMS, AI Argus',
    'Emergency phone systems, parking gates, electronic access control',
    'MGHPCC data center coordination',
    'Executive-level status reporting',
    'Coordination with campus police, facilities, vendors, grad students',
  ],
  certifications: ['CAPM', 'PMI-ACP', 'SAFe'],
  skills: ['Python', 'SQL', 'Power BI', 'Power Platform', 'Agile', 'Scrum'],
  previous: 'RELI Group — PM Analyst, cybersecurity, ISO 27001',
  location: 'Worcester MA, open to remote',
};

export function profileToString(): string {
  return `
ROLE: ${PM_PROFILE.role}
EXPERIENCE:
${PM_PROFILE.experience.map(e => `  - ${e}`).join('\n')}
CERTIFICATIONS: ${PM_PROFILE.certifications.join(', ')}
SKILLS: ${PM_PROFILE.skills.join(', ')}
PREVIOUS: ${PM_PROFILE.previous}
LOCATION: ${PM_PROFILE.location}
  `.trim();
}
```

- [ ] **Step 4: Write prompts and Zod schema**

Create `packages/backend/src/scorer/prompts.ts`:

```typescript
import { z } from 'zod';
import { profileToString } from './profile.js';

export const ScoreResponseSchema = z.object({
  fit_score: z.number().min(0).max(100),
  competition: z.enum(['low', 'medium', 'high']),
  recommendation: z.enum(['apply', 'watch', 'skip']),
  score_reason: z.string(),
  pitch: z.string(),
});

export type ScoreResponse = z.infer<typeof ScoreResponseSchema>;

export function buildScoringPrompt(job: {
  title: string;
  company: string;
  source: string;
  description: string | null;
}): string {
  return `You are a PM job fit scorer. Analyze this job against this candidate profile.
Return ONLY valid JSON, no other text.

PROFILE:
${profileToString()}

JOB TITLE: ${job.title}
COMPANY: ${job.company}
SOURCE: ${job.source}
DESCRIPTION: ${job.description || 'No description available'}

Return:
{
  "fit_score": number 0-100,
  "competition": "low" | "medium" | "high",
  "recommendation": "apply" | "watch" | "skip",
  "score_reason": "one sentence explaining the score",
  "pitch": "two sentence outreach hook referencing specific matches"
}`;
}

export function buildOutreachPrompt(input: {
  title: string;
  company: string;
  pitch: string;
  type: 'connection' | 'email' | 'inmail';
}): string {
  return `You are a professional outreach message writer.

Write a ${input.type} message for this job application.

CANDIDATE PROFILE:
${profileToString()}

JOB: ${input.title} at ${input.company}
SEED PITCH: ${input.pitch}

Write a personalized ${input.type} message that:
- References specific matches between the candidate's experience and the role
- Is concise and professional
- Avoids generic phrases
- For connection requests: 2-3 sentences max
- For emails: subject line + 3-4 paragraph body
- For InMails: 2-3 paragraph body

Return ONLY the message text, no metadata.`;
}
```

- [ ] **Step 5: Create shared API schemas**

Create `packages/backend/src/api/schemas.ts`:

```typescript
import { z } from 'zod';

export const UpdateStatusSchema = z.object({
  status: z.enum(['discovered', 'applied', 'interview', 'offer', 'rejected']),
  appliedAt: z.string().optional(),
  interviewAt: z.string().optional(),
  offerAt: z.string().optional(),
});

export const UpdateNotesSchema = z.object({
  notes: z.string().optional(),
  nextAction: z.string().optional(),
});

export const OutreachRequestSchema = z.object({
  type: z.enum(['connection', 'email', 'inmail']),
});

export const AddCompanySchema = z.object({
  name: z.string().min(1),
  greenhouseSlug: z.string().nullable().optional(),
  leverSlug: z.string().nullable().optional(),
});

export const UpdateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  greenhouseSlug: z.string().nullable().optional(),
  leverSlug: z.string().nullable().optional(),
  active: z.boolean().optional(),
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/backend && pnpm test -- src/scorer/__tests__/prompts.test.ts`
Expected: PASS — all 5 tests green

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/scorer/profile.ts packages/backend/src/scorer/prompts.ts packages/backend/src/api/schemas.ts packages/backend/src/scorer/__tests__/prompts.test.ts
git commit -m "feat: add PM profile, scoring/outreach prompts, Zod schemas"
```

---

### Task 11: Groq API client with retry logic

**Files:**
- Create: `packages/backend/src/scorer/groq.ts`
- Test: `packages/backend/src/scorer/__tests__/groq.test.ts`

- [ ] **Step 1: Write the test**

Create `packages/backend/src/scorer/__tests__/groq.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scoreJob } from '../groq.js';

vi.mock('groq-sdk', () => {
  const mockCreate = vi.fn();
  return {
    default: class Groq {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
      static __mockCreate = mockCreate;
    },
  };
});

// Access mock through the module
import Groq from 'groq-sdk';
const mockCreate = (Groq as any).__mockCreate;

describe('scoreJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scores a job and returns validated response', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            fit_score: 85,
            competition: 'low',
            recommendation: 'apply',
            score_reason: 'Strong PM match',
            pitch: 'Your infra experience aligns perfectly.',
          }),
        },
      }],
    });

    const result = await scoreJob({
      title: 'PM',
      company: 'TestCo',
      source: 'greenhouse',
      description: 'A PM role',
    });

    expect(result).toBeDefined();
    expect(result!.fit_score).toBe(85);
    expect(result!.competition).toBe('low');
  });

  it('returns null on invalid JSON response', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: { content: 'not json' },
      }],
    });

    const result = await scoreJob({
      title: 'PM',
      company: 'TestCo',
      source: 'greenhouse',
      description: 'A PM role',
    });

    expect(result).toBeNull();
  });

  it('returns null on API error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API error'));

    const result = await scoreJob({
      title: 'PM',
      company: 'TestCo',
      source: 'greenhouse',
      description: 'A PM role',
    });

    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && pnpm test -- src/scorer/__tests__/groq.test.ts`
Expected: FAIL — cannot find `../groq.js`

- [ ] **Step 3: Write the Groq client**

Create `packages/backend/src/scorer/groq.ts`:

```typescript
import Groq from 'groq-sdk';
import { buildScoringPrompt, ScoreResponseSchema, type ScoreResponse } from './prompts.js';

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 2000;

async function callWithRetry(prompt: string, retries = 0): Promise<string | null> {
  try {
    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });
    return response.choices[0]?.message?.content ?? null;
  } catch (err: any) {
    if (err?.status === 429 && retries < MAX_RETRIES) {
      const delay = BACKOFF_BASE_MS * Math.pow(2, retries);
      console.warn(`Groq rate limited. Retrying in ${delay}ms (attempt ${retries + 1}/${MAX_RETRIES})`);
      await new Promise(r => setTimeout(r, delay));
      return callWithRetry(prompt, retries + 1);
    }
    throw err;
  }
}

export async function scoreJob(job: {
  title: string;
  company: string;
  source: string;
  description: string | null;
}): Promise<ScoreResponse | null> {
  try {
    const prompt = buildScoringPrompt(job);
    const content = await callWithRetry(prompt);
    if (!content) return null;

    const parsed = JSON.parse(content);
    const validated = ScoreResponseSchema.safeParse(parsed);

    if (!validated.success) {
      console.error(`Groq: Invalid response for "${job.title}" at ${job.company}:`, validated.error.issues);
      return null;
    }

    return validated.data;
  } catch (err) {
    console.error(`Groq: Failed to score "${job.title}" at ${job.company}:`, err);
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/backend && pnpm test -- src/scorer/__tests__/groq.test.ts`
Expected: PASS — all 3 tests green

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/scorer/groq.ts packages/backend/src/scorer/__tests__/groq.test.ts
git commit -m "feat: add Groq API client with retry logic and Zod validation"
```

---

### Task 12: Batch scoring orchestrator

**Files:**
- Create: `packages/backend/src/scorer/index.ts`
- Test: `packages/backend/src/scorer/__tests__/batch.test.ts`

- [ ] **Step 1: Write the test**

Create `packages/backend/src/scorer/__tests__/batch.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scoreJobs } from '../index.js';

vi.mock('../groq.js', () => ({
  scoreJob: vi.fn(),
}));

import { scoreJob } from '../groq.js';
const mockScoreJob = vi.mocked(scoreJob);

describe('scoreJobs (batch)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('scores jobs in batches of 10 with pauses', async () => {
    mockScoreJob.mockResolvedValue({
      fit_score: 80,
      competition: 'low',
      recommendation: 'apply',
      score_reason: 'Good match',
      pitch: 'Strong fit',
    });

    // Create 12 jobs — should be 2 batches
    const jobs = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      title: `PM ${i}`,
      company: `Co ${i}`,
      source: 'greenhouse',
      description: 'A role',
    }));

    const promise = scoreJobs(jobs);
    // Advance past the 1-second pause between batches
    await vi.advanceTimersByTimeAsync(2000);
    const results = await promise;

    expect(mockScoreJob).toHaveBeenCalledTimes(12);
    expect(results).toHaveLength(12);
  });

  it('skips jobs that fail scoring', async () => {
    mockScoreJob
      .mockResolvedValueOnce({
        fit_score: 90,
        competition: 'low',
        recommendation: 'apply',
        score_reason: 'Great',
        pitch: 'Yes',
      })
      .mockResolvedValueOnce(null); // Failed

    const jobs = [
      { id: 1, title: 'PM1', company: 'Co1', source: 'greenhouse', description: 'Role' },
      { id: 2, title: 'PM2', company: 'Co2', source: 'lever', description: 'Role' },
    ];

    const results = await scoreJobs(jobs);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && pnpm test -- src/scorer/__tests__/batch.test.ts`
Expected: FAIL — cannot find `../index.js`

- [ ] **Step 3: Write the batch scorer**

Create `packages/backend/src/scorer/index.ts`:

```typescript
import { scoreJob } from './groq.js';
import type { ScoreResponse } from './prompts.js';

const BATCH_SIZE = 10;
const PAUSE_MS = 1000;

export interface ScoredJob {
  id: number;
  fitScore: number;
  competition: string;
  recommendation: string;
  pitch: string;
  scoreReason: string;
}

export async function scoreJobs(
  jobs: Array<{ id: number; title: string; company: string; source: string; description: string | null }>
): Promise<ScoredJob[]> {
  const results: ScoredJob[] = [];

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);
    const scored = await Promise.all(
      batch.map(async (job) => {
        const result = await scoreJob(job);
        if (!result) return null;
        return {
          id: job.id,
          fitScore: result.fit_score,
          competition: result.competition,
          recommendation: result.recommendation,
          pitch: result.pitch,
          scoreReason: result.score_reason,
        };
      })
    );

    results.push(...scored.filter((s): s is ScoredJob => s !== null));

    // Pause between batches (not after the last batch)
    if (i + BATCH_SIZE < jobs.length) {
      await new Promise(r => setTimeout(r, PAUSE_MS));
    }
  }

  return results;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/backend && pnpm test -- src/scorer/__tests__/batch.test.ts`
Expected: PASS — both tests green

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/scorer/index.ts packages/backend/src/scorer/__tests__/batch.test.ts
git commit -m "feat: add batch scoring orchestrator with pause between batches"
```

---

## Chunk 3: Playwright Scrapers & Browser Infrastructure

### Task 13: Browser infrastructure

**Files:**
- Create: `packages/backend/src/browser/delay.ts`
- Create: `packages/backend/src/browser/instance.ts`

- [ ] **Step 1: Write delay utility test**

Create `packages/backend/src/browser/__tests__/delay.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { randomDelay } from '../delay.js';

describe('randomDelay', () => {
  it('returns a promise that resolves', async () => {
    const start = Date.now();
    await randomDelay(10, 20); // Use short delays for testing
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(9);
    expect(elapsed).toBeLessThan(100);
  });
});
```

- [ ] **Step 2: Write delay utility**

Create `packages/backend/src/browser/delay.ts`:

```typescript
export function randomDelay(minMs = 2000, maxMs = 5000): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

- [ ] **Step 3: Run test**

Run: `cd packages/backend && pnpm test -- src/browser/__tests__/delay.test.ts`
Expected: PASS

- [ ] **Step 4: Write browser instance manager**

Create `packages/backend/src/browser/instance.ts`:

```typescript
import { chromium, type Browser, type Page } from 'playwright';

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browser;
}

export async function getPage(): Promise<Page> {
  const b = await getBrowser();
  const context = await b.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  return context.newPage();
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/browser/
git commit -m "feat: add Playwright browser manager and delay utility"
```

---

### Task 14: Indeed scraper

**Files:**
- Create: `packages/backend/src/sources/indeed.ts`
- Test: `packages/backend/src/sources/__tests__/indeed.test.ts`

- [ ] **Step 1: Write the test (mocked Playwright)**

Create `packages/backend/src/sources/__tests__/indeed.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scrapeIndeed } from '../indeed.js';

describe('scrapeIndeed', () => {
  it('extracts job data from page elements', async () => {
    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      $$eval: vi.fn().mockResolvedValue([
        {
          title: 'Sr. Project Manager',
          company: 'TestCo',
          location: 'Worcester, MA',
          link: 'https://www.indeed.com/viewjob?jk=abc123',
          postedAt: '1 day ago',
        },
      ]),
      close: vi.fn(),
    };

    const results = await scrapeIndeed(mockPage as any);
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Sr. Project Manager');
    expect(results[0].source).toBe('indeed');
    expect(results[0].link).toContain('indeed.com');
    expect(mockPage.goto).toHaveBeenCalledWith(
      expect.stringContaining('indeed.com/jobs'),
      expect.any(Object)
    );
  });

  it('returns empty array on selector timeout', async () => {
    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockRejectedValue(new Error('Timeout')),
      $$eval: vi.fn(),
      close: vi.fn(),
    };

    const results = await scrapeIndeed(mockPage as any);
    expect(results).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && pnpm test -- src/sources/__tests__/indeed.test.ts`
Expected: FAIL — cannot find `../indeed.js`

- [ ] **Step 3: Write the Indeed scraper**

Create `packages/backend/src/sources/indeed.ts`:

```typescript
import type { Page } from 'playwright';
import { randomDelay } from '../browser/delay.js';
import type { RawJob } from './greenhouse.js';

const SCRAPE_RADIUS = process.env.SCRAPE_RADIUS || '25';
const DAYS_POSTED = process.env.DAYS_POSTED || '1';

export async function scrapeIndeed(page: Page): Promise<RawJob[]> {
  const url = [
    'https://www.indeed.com/jobs?q=project+manager',
    `&l=Worcester%2C+MA`,
    `&radius=${SCRAPE_RADIUS}`,
    `&fromage=${DAYS_POSTED}`,
    '&sort=date',
  ].join('');

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('.job_seen_beacon', { timeout: 8000 });
    await randomDelay();

    const jobs = await page.$$eval('.job_seen_beacon', (cards) =>
      cards.map((c) => ({
        title: c.querySelector('.jobTitle')?.textContent?.trim() ?? '',
        company: c.querySelector('[data-testid="company-name"]')?.textContent?.trim() ?? '',
        location: c.querySelector('[data-testid="text-location"]')?.textContent?.trim() ?? '',
        link: c.querySelector('a')?.getAttribute('href') ?? '',
        postedAt: c.querySelector('.date')?.textContent?.trim() ?? null,
      }))
    );

    return jobs
      .filter(j => j.title && j.link)
      .map(j => ({
        title: j.title,
        company: j.company,
        location: j.location || null,
        link: j.link.startsWith('http') ? j.link : `https://www.indeed.com${j.link}`,
        atsId: null,
        source: 'indeed' as const,
        postedAt: j.postedAt,
        applicants: null,
        description: null,
      }));
  } catch (err) {
    console.warn('Indeed: Scraper failed or returned 0 results — possible selector breakage:', err);
    return [];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/backend && pnpm test -- src/sources/__tests__/indeed.test.ts`
Expected: PASS — both tests green

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/sources/indeed.ts packages/backend/src/sources/__tests__/indeed.test.ts
git commit -m "feat: add Indeed Playwright scraper with selector-breakage warning"
```

---

### Task 15: Google Jobs scraper

**Files:**
- Create: `packages/backend/src/sources/google-jobs.ts`
- Test: `packages/backend/src/sources/__tests__/google-jobs.test.ts`

- [ ] **Step 1: Write the test**

Create `packages/backend/src/sources/__tests__/google-jobs.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { scrapeGoogleJobs } from '../google-jobs.js';

describe('scrapeGoogleJobs', () => {
  it('extracts jobs from multiple search queries', async () => {
    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      $$eval: vi.fn().mockResolvedValue([
        {
          title: 'Program Manager',
          company: 'Google',
          location: 'Worcester, MA',
          link: 'https://careers.google.com/jobs/123',
        },
      ]),
    };

    const results = await scrapeGoogleJobs(mockPage as any);
    // 4 queries × 1 result each = 4 results
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].source).toBe('google-jobs');
    expect(results[0].atsId).toBeNull();
    expect(mockPage.goto).toHaveBeenCalledTimes(4); // 4 search queries
  });

  it('returns empty on timeout', async () => {
    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockRejectedValue(new Error('Timeout')),
      $$eval: vi.fn(),
    };

    const results = await scrapeGoogleJobs(mockPage as any);
    expect(results).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && pnpm test -- src/sources/__tests__/google-jobs.test.ts`
Expected: FAIL — cannot find `../google-jobs.js`

- [ ] **Step 3: Write the Google Jobs scraper**

Create `packages/backend/src/sources/google-jobs.ts`:

```typescript
import type { Page } from 'playwright';
import { randomDelay } from '../browser/delay.js';
import type { RawJob } from './greenhouse.js';

const SEARCH_QUERIES = [
  '"project manager" Worcester MA',
  '"program manager" Worcester MA',
  '"technical program manager" Boston MA',
  '"infrastructure PM" remote',
];

export async function scrapeGoogleJobs(page: Page): Promise<RawJob[]> {
  const results: RawJob[] = [];

  for (const query of SEARCH_QUERIES) {
    try {
      await page.goto(
        `https://www.google.com/search?q=${encodeURIComponent(query)}&ibp=htl;jobs`,
        { waitUntil: 'domcontentloaded', timeout: 15000 }
      );
      await page.waitForSelector('.PwjeAc', { timeout: 8000 });
      await randomDelay();

      const jobs = await page.$$eval('.PwjeAc', (cards) =>
        cards.map((c) => ({
          title: c.querySelector('.BjJfJf')?.textContent?.trim() ?? '',
          company: c.querySelector('.vNEEBe')?.textContent?.trim() ?? '',
          location: c.querySelector('.Qk80Jf')?.textContent?.trim() ?? '',
          link: c.querySelector('a')?.getAttribute('href') ?? '',
        }))
      );

      for (const job of jobs) {
        if (job.title && job.link) {
          results.push({
            title: job.title,
            company: job.company,
            location: job.location || null,
            link: job.link,
            atsId: null,
            source: 'google-jobs',
            postedAt: null,
            applicants: null,
            description: null,
          });
        }
      }

      await randomDelay();
    } catch (err) {
      console.warn(`Google Jobs: Query "${query}" failed — possible selector breakage:`, err);
      // Continue with next query
    }
  }

  if (results.length === 0) {
    console.warn('Google Jobs: All queries returned 0 results — selectors may have changed');
  }

  return results;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/backend && pnpm test -- src/sources/__tests__/google-jobs.test.ts`
Expected: PASS — both tests green

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/sources/google-jobs.ts packages/backend/src/sources/__tests__/google-jobs.test.ts
git commit -m "feat: add Google Jobs Playwright scraper with 4 search queries"
```

---

### Task 16: ZipRecruiter scraper

**Files:**
- Create: `packages/backend/src/sources/ziprecruiter.ts`
- Test: `packages/backend/src/sources/__tests__/ziprecruiter.test.ts`

- [ ] **Step 1: Write the test**

Create `packages/backend/src/sources/__tests__/ziprecruiter.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { scrapeZipRecruiter } from '../ziprecruiter.js';

describe('scrapeZipRecruiter', () => {
  it('extracts job data from page elements', async () => {
    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      $$eval: vi.fn().mockResolvedValue([
        {
          title: 'Project Manager',
          company: 'TestCo',
          location: 'Worcester, MA',
          link: 'https://www.ziprecruiter.com/job/123',
          postedAt: '1 day ago',
        },
      ]),
    };

    const results = await scrapeZipRecruiter(mockPage as any);
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('ziprecruiter');
    expect(results[0].title).toBe('Project Manager');
  });

  it('returns empty on failure', async () => {
    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockRejectedValue(new Error('Timeout')),
      $$eval: vi.fn(),
    };

    const results = await scrapeZipRecruiter(mockPage as any);
    expect(results).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && pnpm test -- src/sources/__tests__/ziprecruiter.test.ts`
Expected: FAIL — cannot find `../ziprecruiter.js`

- [ ] **Step 3: Write the ZipRecruiter scraper**

Create `packages/backend/src/sources/ziprecruiter.ts`:

```typescript
import type { Page } from 'playwright';
import { randomDelay } from '../browser/delay.js';
import type { RawJob } from './greenhouse.js';

const SCRAPE_RADIUS = process.env.SCRAPE_RADIUS || '25';
const DAYS_POSTED = process.env.DAYS_POSTED || '1';

export async function scrapeZipRecruiter(page: Page): Promise<RawJob[]> {
  const url = `https://www.ziprecruiter.com/jobs-search?search=project+manager&location=Worcester%2C+MA&radius=${SCRAPE_RADIUS}&days=${DAYS_POSTED}`;

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('.job_listing', { timeout: 8000 });
    await randomDelay();

    const jobs = await page.$$eval('.job_listing', (cards) =>
      cards.map((c) => ({
        title: c.querySelector('.job_title')?.textContent?.trim() ?? '',
        company: c.querySelector('.company_name')?.textContent?.trim() ?? '',
        location: c.querySelector('.location')?.textContent?.trim() ?? '',
        link: c.querySelector('a.job_link')?.getAttribute('href') ?? '',
        postedAt: c.querySelector('.posted_date')?.textContent?.trim() ?? null,
      }))
    );

    return jobs
      .filter(j => j.title && j.link)
      .map(j => ({
        title: j.title,
        company: j.company,
        location: j.location || null,
        link: j.link.startsWith('http') ? j.link : `https://www.ziprecruiter.com${j.link}`,
        atsId: null,
        source: 'ziprecruiter' as const,
        postedAt: j.postedAt,
        applicants: null,
        description: null,
      }));
  } catch (err) {
    console.warn('ZipRecruiter: Scraper failed or returned 0 results — possible selector breakage:', err);
    return [];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/backend && pnpm test -- src/sources/__tests__/ziprecruiter.test.ts`
Expected: PASS — both tests green

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/sources/ziprecruiter.ts packages/backend/src/sources/__tests__/ziprecruiter.test.ts
git commit -m "feat: add ZipRecruiter Playwright scraper"
```

---

## Chunk 4: Source Orchestrator & Express API

### Task 17: Source orchestrator with dedup

**Files:**
- Create: `packages/backend/src/sources/index.ts`
- Test: `packages/backend/src/sources/__tests__/orchestrator.test.ts`

- [ ] **Step 1: Write the test**

Create `packages/backend/src/sources/__tests__/orchestrator.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runAllSources } from '../index.js';

vi.mock('../greenhouse.js', () => ({
  fetchGreenhouse: vi.fn().mockResolvedValue([
    { title: 'PM1', company: 'Co1', link: 'https://gh.com/1', source: 'greenhouse', atsId: '1', location: null, postedAt: null, applicants: null, description: null },
  ]),
}));

vi.mock('../lever.js', () => ({
  fetchLever: vi.fn().mockResolvedValue([
    { title: 'PM2', company: 'Co2', link: 'https://lever.co/2', source: 'lever', atsId: '2', location: null, postedAt: null, applicants: null, description: null },
  ]),
}));

vi.mock('../indeed.js', () => ({
  scrapeIndeed: vi.fn().mockResolvedValue([
    { title: 'PM3', company: 'Co3', link: 'https://indeed.com/3', source: 'indeed', atsId: null, location: null, postedAt: null, applicants: null, description: null },
  ]),
}));

vi.mock('../google-jobs.js', () => ({
  scrapeGoogleJobs: vi.fn().mockResolvedValue([]),
}));

vi.mock('../ziprecruiter.js', () => ({
  scrapeZipRecruiter: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../browser/instance.js', () => ({
  getPage: vi.fn().mockResolvedValue({}),
  closeBrowser: vi.fn().mockResolvedValue(undefined),
}));

describe('runAllSources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('collects jobs from all sources', async () => {
    const companies = [
      { name: 'Co1', greenhouseSlug: 'co1', leverSlug: null },
      { name: 'Co2', greenhouseSlug: null, leverSlug: 'co2' },
    ];

    const { jobs, sourcesRun } = await runAllSources(companies);
    expect(jobs).toHaveLength(3);
    expect(jobs.map(j => j.source)).toContain('greenhouse');
    expect(jobs.map(j => j.source)).toContain('lever');
    expect(jobs.map(j => j.source)).toContain('indeed');
    expect(sourcesRun).toContain('greenhouse');
  });

  it('deduplicates by link', async () => {
    // Override greenhouse to return same link as lever
    const { fetchGreenhouse } = await import('../greenhouse.js');
    vi.mocked(fetchGreenhouse).mockResolvedValueOnce([
      { title: 'PM1', company: 'Co1', link: 'https://same-link.com/1', source: 'greenhouse', atsId: '1', location: null, postedAt: null, applicants: null, description: null },
    ]);
    const { fetchLever } = await import('../lever.js');
    vi.mocked(fetchLever).mockResolvedValueOnce([
      { title: 'PM1', company: 'Co1', link: 'https://same-link.com/1', source: 'lever', atsId: '2', location: null, postedAt: null, applicants: null, description: null },
    ]);

    const companies = [
      { name: 'Co1', greenhouseSlug: 'co1', leverSlug: 'co1' },
    ];

    const { jobs } = await runAllSources(companies);
    const sameLinkJobs = jobs.filter(j => j.link === 'https://same-link.com/1');
    expect(sameLinkJobs).toHaveLength(1);
  });

  it('filters out jobs exceeding MAX_APPLICANTS', async () => {
    const { fetchGreenhouse } = await import('../greenhouse.js');
    vi.mocked(fetchGreenhouse).mockResolvedValueOnce([
      { title: 'PM Over', company: 'Co', link: 'https://over.com/1', source: 'greenhouse', atsId: '99', location: null, postedAt: null, applicants: 50, description: null },
      { title: 'PM Under', company: 'Co', link: 'https://under.com/2', source: 'greenhouse', atsId: '100', location: null, postedAt: null, applicants: 10, description: null },
    ]);

    const companies = [{ name: 'Co', greenhouseSlug: 'co', leverSlug: null }];
    const { jobs } = await runAllSources(companies);
    const links = jobs.map(j => j.link);
    expect(links).not.toContain('https://over.com/1');
    expect(links).toContain('https://under.com/2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && pnpm test -- src/sources/__tests__/orchestrator.test.ts`
Expected: FAIL — cannot find `../index.js`

- [ ] **Step 3: Write the orchestrator**

Create `packages/backend/src/sources/index.ts`:

```typescript
import type { CompanyInput, RawJob } from './greenhouse.js';
import { fetchGreenhouse } from './greenhouse.js';
import { fetchLever } from './lever.js';
import { scrapeIndeed } from './indeed.js';
import { scrapeGoogleJobs } from './google-jobs.js';
import { scrapeZipRecruiter } from './ziprecruiter.js';
import { getPage, closeBrowser } from '../browser/instance.js';

const MAX_APPLICANTS = parseInt(process.env.MAX_APPLICANTS || '30', 10);

export interface SourceResult {
  jobs: RawJob[];
  sourcesRun: string[];
  errors: string[];
}

export async function runAllSources(companies: CompanyInput[]): Promise<SourceResult> {
  const allJobs: RawJob[] = [];
  const sourcesRun: string[] = [];
  const errors: string[] = [];

  // 1. API sources in parallel
  try {
    const [ghJobs, leverJobs] = await Promise.all([
      fetchGreenhouse(companies),
      fetchLever(companies),
    ]);
    sourcesRun.push('greenhouse', 'lever'); // Track attempted, not just results
    allJobs.push(...ghJobs);
    allJobs.push(...leverJobs);
  } catch (err) {
    errors.push(`API sources: ${err}`);
  }

  // 2. Playwright scrapers (sequential)
  try {
    const page = await getPage();

    try {
      sourcesRun.push('indeed');
      const indeedJobs = await scrapeIndeed(page);
      allJobs.push(...indeedJobs);
    } catch (err) {
      errors.push(`Indeed: ${err}`);
    }

    try {
      sourcesRun.push('google-jobs');
      const googleJobs = await scrapeGoogleJobs(page);
      allJobs.push(...googleJobs);
    } catch (err) {
      errors.push(`Google Jobs: ${err}`);
    }

    try {
      sourcesRun.push('ziprecruiter');
      const zipJobs = await scrapeZipRecruiter(page);
      allJobs.push(...zipJobs);
    } catch (err) {
      errors.push(`ZipRecruiter: ${err}`);
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

  return { jobs: finalDeduped, sourcesRun, errors };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/backend && pnpm test -- src/sources/__tests__/orchestrator.test.ts`
Expected: PASS — all 3 tests green

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/sources/index.ts packages/backend/src/sources/__tests__/orchestrator.test.ts
git commit -m "feat: add source orchestrator with dedup and applicant filtering"
```

---

### Task 18: Express error middleware

**Files:**
- Create: `packages/backend/src/api/middleware/errors.ts`

- [ ] **Step 1: Write the error middleware**

Create `packages/backend/src/api/middleware/errors.ts`:

```typescript
import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      details: err.issues,
    });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error',
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/api/middleware/errors.ts
git commit -m "feat: add centralized error handling middleware"
```

---

### Task 19: Jobs API routes

**Files:**
- Create: `packages/backend/src/api/routes/jobs.ts`
- Test: `packages/backend/src/api/__tests__/jobs.test.ts`

- [ ] **Step 1: Write route tests**

Create `packages/backend/src/api/__tests__/jobs.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../db/schema.js';
import { createQueries } from '../../db/queries.js';
import { createJobsRouter } from '../routes/jobs.js';
import { errorHandler } from '../middleware/errors.js';

describe('Jobs API', () => {
  let app: express.Express;
  let sqlite: InstanceType<typeof Database>;

  beforeAll(() => {
    sqlite = new Database(':memory:');
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: './drizzle' });
    const queries = createQueries(db);

    // Seed test data
    queries.insertJob({ title: 'PM One', company: 'Co1', link: 'https://test.com/1', source: 'greenhouse' });
    queries.insertJob({ title: 'PM Two', company: 'Co2', link: 'https://test.com/2', source: 'lever' });
    queries.updateJobScoring(1, { fitScore: 90, competition: 'low', recommendation: 'apply', pitch: 'Great fit', scoreReason: 'Strong match' });

    app = express();
    app.use(express.json());
    app.use('/api/jobs', createJobsRouter(queries));
    app.use(errorHandler);
  });

  afterAll(() => sqlite.close());

  it('GET /api/jobs returns paginated list', async () => {
    const res = await request(app).get('/api/jobs');
    expect(res.status).toBe(200);
    expect(res.body.jobs).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body.hasMore).toBe(false);
  });

  it('GET /api/jobs?source=greenhouse filters by source', async () => {
    const res = await request(app).get('/api/jobs?source=greenhouse');
    expect(res.status).toBe(200);
    expect(res.body.jobs).toHaveLength(1);
    expect(res.body.jobs[0].source).toBe('greenhouse');
  });

  it('GET /api/jobs/:id returns single job', async () => {
    const res = await request(app).get('/api/jobs/1');
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('PM One');
  });

  it('GET /api/jobs/:id returns 404 for missing job', async () => {
    const res = await request(app).get('/api/jobs/999');
    expect(res.status).toBe(404);
  });

  it('PATCH /api/jobs/:id/status updates status', async () => {
    const res = await request(app)
      .patch('/api/jobs/1/status')
      .send({ status: 'applied' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('applied');
  });

  it('PATCH /api/jobs/:id/notes updates notes', async () => {
    const res = await request(app)
      .patch('/api/jobs/1/notes')
      .send({ notes: 'Follow up Monday' });
    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('Follow up Monday');
  });
});
```

- [ ] **Step 2: Install supertest**

```bash
cd packages/backend && pnpm add -D supertest @types/supertest
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/backend && pnpm test -- src/api/__tests__/jobs.test.ts`
Expected: FAIL — cannot find `../routes/jobs.js`

- [ ] **Step 4: Write the jobs router**

Create `packages/backend/src/api/routes/jobs.ts`:

```typescript
import { Router } from 'express';
import { UpdateStatusSchema, UpdateNotesSchema } from '../schemas.js';
import type { createQueries } from '../../db/queries.js';

export function createJobsRouter(queries: ReturnType<typeof createQueries>) {
  const router = Router();

  // GET /api/jobs
  router.get('/', (req, res) => {
    const filters = {
      source: req.query.source as string | undefined,
      status: req.query.status as string | undefined,
      competition: req.query.competition as string | undefined,
      minScore: req.query.minScore ? parseInt(req.query.minScore as string, 10) : undefined,
      search: req.query.search as string | undefined,
      sort: req.query.sort as string | undefined,
      order: req.query.order as 'asc' | 'desc' | undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    };
    const result = queries.getJobs(filters);
    res.json(result);
  });

  // GET /api/jobs/:id
  router.get('/:id', (req, res) => {
    const job = queries.getJobById(parseInt(req.params.id, 10));
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    const outreachDrafts = queries.getOutreachByJobId(job.id);
    res.json({ ...job, outreach: outreachDrafts });
  });

  // PATCH /api/jobs/:id/status
  router.patch('/:id/status', (req, res) => {
    const parsed = UpdateStatusSchema.parse(req.body);
    const id = parseInt(req.params.id, 10);
    queries.updateJobStatus(id, parsed.status);
    const updated = queries.getJobById(id);
    res.json(updated);
  });

  // PATCH /api/jobs/:id/notes
  router.patch('/:id/notes', (req, res) => {
    const parsed = UpdateNotesSchema.parse(req.body);
    const id = parseInt(req.params.id, 10);
    queries.updateJobNotes(id, parsed);
    const updated = queries.getJobById(id);
    res.json(updated);
  });

  return router;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/backend && pnpm test -- src/api/__tests__/jobs.test.ts`
Expected: PASS — all 6 tests green

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/api/routes/jobs.ts packages/backend/src/api/__tests__/jobs.test.ts
git commit -m "feat: add jobs API routes with filtering, pagination, status, and notes"
```

---

### Task 20: Stats, scrape, outreach, and companies routes

**Files:**
- Create: `packages/backend/src/api/routes/stats.ts`
- Create: `packages/backend/src/api/routes/scrape.ts`
- Create: `packages/backend/src/api/routes/outreach.ts`
- Create: `packages/backend/src/api/routes/companies.ts`

- [ ] **Step 1: Write stats router**

Create `packages/backend/src/api/routes/stats.ts`:

```typescript
import { Router } from 'express';
import type { createQueries } from '../../db/queries.js';

export function createStatsRouter(queries: ReturnType<typeof createQueries>) {
  const router = Router();

  router.get('/', (_req, res) => {
    const stats = queries.getStats();
    res.json(stats);
  });

  return router;
}
```

- [ ] **Step 2: Write scrape router**

Create `packages/backend/src/api/routes/scrape.ts`:

```typescript
import { Router } from 'express';
import type { createQueries } from '../../db/queries.js';

type ScrapeHandler = () => Promise<void>;

let isRunning = false;

export function createScrapeRouter(
  queries: ReturnType<typeof createQueries>,
  triggerScrape: ScrapeHandler
) {
  const router = Router();

  // GET /api/scrape/log — MUST be before /:runId to avoid "log" matching as a param
  router.get('/log', (_req, res) => {
    const runs = queries.getRecentScrapeRuns();
    res.json(runs);
  });

  // POST /api/scrape — trigger manual run
  router.post('/', (_req, res) => {
    // Check both in-memory flag and DB for running status
    if (isRunning) {
      res.status(409).json({ error: 'A scrape run is already in progress' });
      return;
    }

    const runId = queries.createScrapeRun();
    isRunning = true;

    triggerScrape()
      .catch(err => console.error('Manual scrape failed:', err))
      .finally(() => { isRunning = false; });

    res.json({ runId });
  });

  // GET /api/scrape/:runId
  router.get('/:runId', (req, res) => {
    const run = queries.getScrapeRun(parseInt(req.params.runId, 10));
    if (!run) {
      res.status(404).json({ error: 'Scrape run not found' });
      return;
    }
    res.json(run);
  });

  return router;
}
```

- [ ] **Step 4: Write outreach router**

Create `packages/backend/src/api/routes/outreach.ts`:

```typescript
import { Router } from 'express';
import Groq from 'groq-sdk';
import { OutreachRequestSchema } from '../schemas.js';
import { buildOutreachPrompt } from '../../scorer/prompts.js';
import type { createQueries } from '../../db/queries.js';

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

export function createOutreachRouter(queries: ReturnType<typeof createQueries>) {
  const router = Router();

  // POST /api/outreach/:id
  router.post('/:id', async (req, res, next) => {
    try {
      const parsed = OutreachRequestSchema.parse(req.body);
      const job = queries.getJobById(parseInt(req.params.id, 10));
      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      const prompt = buildOutreachPrompt({
        title: job.title,
        company: job.company,
        pitch: job.pitch || '',
        type: parsed.type,
      });

      const response = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
      });

      const content = response.choices[0]?.message?.content ?? '';
      queries.insertOutreach({
        jobId: job.id,
        type: parsed.type,
        content,
      });

      const allDrafts = queries.getOutreachByJobId(job.id);
      res.json({ content, history: allDrafts });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

- [ ] **Step 5: Write companies router**

Create `packages/backend/src/api/routes/companies.ts`:

```typescript
import { Router } from 'express';
import { AddCompanySchema, UpdateCompanySchema } from '../schemas.js';
import type { createQueries } from '../../db/queries.js';

export function createCompaniesRouter(queries: ReturnType<typeof createQueries>) {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(queries.getCompanies());
  });

  router.post('/', (req, res, next) => {
    try {
      const parsed = AddCompanySchema.parse(req.body);
      queries.insertCompany(parsed);
      res.status(201).json({ message: 'Company added' });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', (req, res, next) => {
    try {
      const parsed = UpdateCompanySchema.parse(req.body);
      queries.updateCompany(parseInt(req.params.id, 10), parsed);
      res.json({ message: 'Company updated' });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', (req, res) => {
    queries.deleteCompany(parseInt(req.params.id, 10));
    res.json({ message: 'Company deleted' });
  });

  return router;
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/api/routes/stats.ts packages/backend/src/api/routes/scrape.ts packages/backend/src/api/routes/outreach.ts packages/backend/src/api/routes/companies.ts
git commit -m "feat: add stats, scrape, outreach, and companies API routes"
```

---

### Task 21: Express server setup

**Files:**
- Create: `packages/backend/src/api/server.ts`

- [ ] **Step 1: Write the server**

Create `packages/backend/src/api/server.ts`:

```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { db } from '../db/index.js';
import { createQueries } from '../db/queries.js';
import { createJobsRouter } from './routes/jobs.js';
import { createStatsRouter } from './routes/stats.js';
import { createScrapeRouter } from './routes/scrape.js';
import { createOutreachRouter } from './routes/outreach.js';
import { createCompaniesRouter } from './routes/companies.js';
import { errorHandler } from './middleware/errors.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const queries = createQueries(db);

const app = express();

app.use(cors({ origin: ['http://localhost:5173'] }));
app.use(express.json());

// Placeholder scrape handler — will be wired to orchestrator in Task 24
const triggerScrape = async () => {
  console.log('Scrape triggered (handler not wired yet)');
};

app.use('/api/jobs', createJobsRouter(queries));
app.use('/api/stats', createStatsRouter(queries));
app.use('/api/scrape', createScrapeRouter(queries, triggerScrape));
app.use('/api/outreach', createOutreachRouter(queries));
app.use('/api/companies', createCompaniesRouter(queries));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`JobGrid API running on port ${PORT}`);
});

export { app, queries };
```

- [ ] **Step 2: Verify server starts**

```bash
cd packages/backend && pnpm dev
```
Expected: "JobGrid API running on port 3001"

- [ ] **Step 3: Test a couple endpoints manually**

```bash
curl http://localhost:3001/api/stats | jq
curl http://localhost:3001/api/companies | jq
```
Expected: stats returns JSON with `total: 0`, companies returns the 13 seeded companies

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/api/server.ts
git commit -m "feat: add Express server with all API routes wired"
```

---

## Chunk 5: React Frontend — API Client, Hooks & Components

### Task 22: Axios API client

**Files:**
- Create: `packages/frontend/src/api/client.ts`
- Create: `packages/frontend/src/api/types.ts`

- [ ] **Step 1: Create shared types**

Create `packages/frontend/src/api/types.ts`:

```typescript
export interface Job {
  id: number;
  title: string;
  company: string;
  location: string | null;
  applicants: number | null;
  description: string | null;
  link: string;
  source: string;
  ats_id: string | null;
  posted_at: string | null;
  scraped_at: string;
  fit_score: number | null;
  competition: string | null;
  recommendation: string | null;
  pitch: string | null;
  score_reason: string | null;
  status: string;
  notes: string | null;
  next_action: string | null;
  applied_at: string | null;
  interview_at: string | null;
  offer_at: string | null;
}

export interface JobWithOutreach extends Job {
  outreach: OutreachDraft[];
}

export interface OutreachDraft {
  id: number;
  job_id: number;
  type: string;
  content: string;
  created_at: string;
}

export interface JobsResponse {
  jobs: Job[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

export interface Stats {
  total: number;
  avg_fit: number;
  low_competition: number;
  by_source: Record<string, number>;
  by_status: Record<string, number>;
  last_scraped: string | null;
  new_today: number;
}

export interface ScrapeRun {
  id: number;
  started_at: string;
  finished_at: string | null;
  jobs_found: number;
  jobs_new: number;
  sources_run: string | null;
  status: string;
  error: string | null;
}

export interface Company {
  id: number;
  name: string;
  greenhouse_slug: string | null;
  lever_slug: string | null;
  active: boolean;
  last_checked: string | null;
  created_at: string;
}

export interface JobFilters {
  source?: string;
  status?: string;
  competition?: string;
  minScore?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}
```

- [ ] **Step 2: Create Axios client**

Create `packages/frontend/src/api/client.ts`:

```typescript
import axios from 'axios';
import type {
  JobsResponse,
  JobWithOutreach,
  Stats,
  ScrapeRun,
  Company,
  JobFilters,
} from './types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message;
    console.error('API Error:', message);
    return Promise.reject(error);
  }
);

export const jobsApi = {
  list: (filters: JobFilters = {}) =>
    api.get<JobsResponse>('/jobs', { params: filters }).then(r => r.data),

  get: (id: number) =>
    api.get<JobWithOutreach>(`/jobs/${id}`).then(r => r.data),

  updateStatus: (id: number, status: string) =>
    api.patch(`/jobs/${id}/status`, { status }).then(r => r.data),

  updateNotes: (id: number, data: { notes?: string; next_action?: string }) =>
    api.patch(`/jobs/${id}/notes`, data).then(r => r.data),
};

export const outreachApi = {
  generate: (jobId: number, type: 'connection' | 'email' | 'inmail') =>
    api.post(`/outreach/${jobId}`, { type }).then(r => r.data),
};

export const statsApi = {
  get: () => api.get<Stats>('/stats').then(r => r.data),
};

export const scrapeApi = {
  trigger: () => api.post<{ runId: number }>('/scrape').then(r => r.data),
  getRun: (runId: number) => api.get<ScrapeRun>(`/scrape/${runId}`).then(r => r.data),
  getLog: () => api.get<ScrapeRun[]>('/scrape/log').then(r => r.data),
};

export const companiesApi = {
  list: () => api.get<Company[]>('/companies').then(r => r.data),
  add: (data: { name: string; greenhouse_slug?: string; lever_slug?: string }) =>
    api.post('/companies', data).then(r => r.data),
  update: (id: number, data: Partial<Company>) =>
    api.patch(`/companies/${id}`, data).then(r => r.data),
  remove: (id: number) => api.delete(`/companies/${id}`).then(r => r.data),
};
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/api/
git commit -m "feat: add Axios API client with typed endpoints"
```

---

### Task 23: React hooks

**Files:**
- Create: `packages/frontend/src/hooks/useJobs.ts`
- Create: `packages/frontend/src/hooks/useStats.ts`
- Create: `packages/frontend/src/hooks/useJob.ts`

- [ ] **Step 1: Create useJobs hook**

Create `packages/frontend/src/hooks/useJobs.ts`:

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { jobsApi } from '../api/client';
import type { Job, JobFilters, JobsResponse } from '../api/types';

export function useJobs(filters: JobFilters = {}) {
  const [data, setData] = useState<JobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchJobs = useCallback(async (f: JobFilters) => {
    setLoading(true);
    setError(null);
    try {
      const result = await jobsApi.list(f);
      setData(result);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchJobs(filters), filters.search ? 300 : 0);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [
    filters.source, filters.status, filters.competition,
    filters.minScore, filters.search, filters.sort,
    filters.order, filters.page, filters.limit,
    fetchJobs,
  ]);

  const refetch = useCallback(() => fetchJobs(filters), [fetchJobs, filters]);

  return {
    jobs: data?.jobs ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    totalPages: data?.totalPages ?? 1,
    hasMore: data?.hasMore ?? false,
    loading,
    error,
    refetch,
  };
}
```

- [ ] **Step 2: Create useStats hook**

Create `packages/frontend/src/hooks/useStats.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { statsApi } from '../api/client';
import type { Stats } from '../api/types';

export function useStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const result = await statsApi.get();
      setStats(result);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}
```

- [ ] **Step 3: Create useJob hook**

Create `packages/frontend/src/hooks/useJob.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { jobsApi } from '../api/client';
import type { JobWithOutreach } from '../api/types';

export function useJob(id: number | null) {
  const [job, setJob] = useState<JobWithOutreach | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchJob = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const result = await jobsApi.get(id);
      setJob(result);
    } catch (err) {
      console.error('Failed to fetch job:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  const updateStatus = useCallback(async (status: string) => {
    if (!id) return;
    try {
      const updated = await jobsApi.updateStatus(id, status);
      setJob(prev => prev ? { ...prev, ...updated } : null);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }, [id]);

  const updateNotes = useCallback(async (notes: string, next_action?: string) => {
    if (!id) return;
    try {
      const updated = await jobsApi.updateNotes(id, { notes, next_action });
      setJob(prev => prev ? { ...prev, ...updated } : null);
    } catch (err) {
      console.error('Failed to update notes:', err);
    }
  }, [id]);

  return { job, loading, refetch: fetchJob, updateStatus, updateNotes };
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/hooks/
git commit -m "feat: add useJobs, useStats, and useJob React hooks"
```

---

### Task 24: TopBar component

**Files:**
- Create: `packages/frontend/src/components/TopBar.tsx`

- [ ] **Step 1: Create TopBar**

Create `packages/frontend/src/components/TopBar.tsx`:

```tsx
import { scrapeApi } from '../api/client';
import type { Stats } from '../api/types';
import { useState, useCallback } from 'react';

interface TopBarProps {
  stats: Stats | null;
  onScrapeComplete: () => void;
}

export function TopBar({ stats, onScrapeComplete }: TopBarProps) {
  const [scraping, setScraping] = useState(false);

  const handleRunNow = useCallback(async () => {
    setScraping(true);
    try {
      const { runId } = await scrapeApi.trigger();
      // Poll for completion
      const poll = setInterval(async () => {
        const run = await scrapeApi.getRun(runId);
        if (run.status !== 'running') {
          clearInterval(poll);
          setScraping(false);
          onScrapeComplete();
        }
      }, 3000);
    } catch (err: any) {
      if (err.response?.status === 409) {
        alert('A scrape is already running.');
      }
      setScraping(false);
    }
  }, [onScrapeComplete]);

  return (
    <div className="bg-gradient-to-b from-[#0f1629] to-[#0c1120] border-b border-accent-indigo/15 px-6 py-3.5 flex justify-between items-center relative">
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-indigo/40 to-transparent" />
      <div className="flex items-center gap-5">
        <span className="text-lg font-extrabold tracking-tight bg-gradient-to-br from-accent-indigo-light to-accent-indigo bg-clip-text text-transparent">
          JobGrid
        </span>
        <div className="flex gap-2">
          <StatBadge color="indigo" value={stats?.total ?? 0} label="Jobs" />
          <StatBadge color="green" value={stats?.avg_fit ?? 0} label="Avg Fit" />
          <StatBadge color="amber" value={stats?.low_competition ?? 0} label="Low Comp" />
          <StatBadge color="cyan" value={stats?.new_today ?? 0} label="New Today" />
        </div>
      </div>
      <div className="flex items-center gap-3.5">
        <span className="text-text-dim text-xs">
          Last scraped{' '}
          <span className="text-text-muted">
            {stats?.last_scraped
              ? new Date(stats.last_scraped).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'never'}
          </span>
        </span>
        <button
          onClick={handleRunNow}
          disabled={scraping}
          className="bg-gradient-to-br from-accent-indigo to-[#4f46e5] text-white px-4 py-1.5 rounded-lg text-xs font-semibold shadow-[0_2px_8px_rgba(99,102,241,0.3)] hover:shadow-[0_4px_16px_rgba(99,102,241,0.4)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {scraping ? 'Running...' : 'Run Now'}
        </button>
      </div>
    </div>
  );
}

function StatBadge({ color, value, label }: { color: string; value: number; label: string }) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-accent-indigo/12 text-accent-indigo-light border-accent-indigo/20',
    green: 'bg-accent-green/12 text-accent-green-light border-accent-green/20',
    amber: 'bg-accent-amber/12 text-accent-amber-light border-accent-amber/20',
    cyan: 'bg-accent-cyan/12 text-accent-cyan-light border-accent-cyan/20',
  };

  return (
    <div className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border backdrop-blur-sm ${colorMap[color]}`}>
      <span className="text-sm font-extrabold">{value}</span>
      {label}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/components/TopBar.tsx
git commit -m "feat: add TopBar component with stats badges and run button"
```

---

### Task 25: JobCard and JobList components

**Files:**
- Create: `packages/frontend/src/components/JobCard.tsx`
- Create: `packages/frontend/src/components/JobList.tsx`

- [ ] **Step 1: Create JobCard**

Create `packages/frontend/src/components/JobCard.tsx`:

```tsx
import type { Job } from '../api/types';

interface JobCardProps {
  job: Job;
  isActive: boolean;
  onClick: () => void;
}

const SOURCE_COLORS: Record<string, string> = {
  greenhouse: 'bg-accent-cyan/10 text-[#22d3ee] border-accent-cyan/15',
  lever: 'bg-accent-amber/10 text-[#fbbf24] border-accent-amber/15',
  indeed: 'bg-accent-red/10 text-[#f87171] border-accent-red/15',
  'google-jobs': 'bg-accent-purple/10 text-[#c084fc] border-accent-purple/15',
  ziprecruiter: 'bg-accent-green/10 text-[#34d399] border-accent-green/15',
};

const COMP_COLORS: Record<string, string> = {
  low: 'bg-accent-green/10 text-[#34d399] border-accent-green/15',
  medium: 'bg-accent-amber/10 text-[#fbbf24] border-accent-amber/15',
  high: 'bg-accent-red/10 text-[#f87171] border-accent-red/15',
};

const REC_COLORS: Record<string, string> = {
  apply: 'bg-accent-indigo/10 text-[#818cf8] border-accent-indigo/15',
  watch: 'bg-accent-amber/10 text-[#fbbf24] border-accent-amber/15',
  skip: 'bg-accent-red/10 text-[#f87171] border-accent-red/15',
};

function getScoreStyle(score: number | null) {
  if (!score) return 'border-border text-text-muted';
  if (score >= 80) return 'border-accent-indigo/40 text-accent-indigo-light shadow-[0_0_12px_rgba(99,102,241,0.2)] bg-[radial-gradient(circle,rgba(99,102,241,0.2)_0%,transparent_70%)]';
  if (score >= 60) return 'border-accent-amber/40 text-accent-amber-light shadow-[0_0_12px_rgba(245,158,11,0.2)] bg-[radial-gradient(circle,rgba(245,158,11,0.2)_0%,transparent_70%)]';
  return 'border-accent-red/40 text-accent-red-light shadow-[0_0_12px_rgba(239,68,68,0.2)] bg-[radial-gradient(circle,rgba(239,68,68,0.2)_0%,transparent_70%)]';
}

export function JobCard({ job, isActive, onClick }: JobCardProps) {
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-[10px] p-3 px-3.5 mb-1.5 cursor-pointer transition-all duration-200 border
        ${isActive
          ? 'border-accent-indigo/50 bg-gradient-to-br from-accent-indigo/[0.08] to-[#0f172a]/90 shadow-[0_0_20px_rgba(99,102,241,0.08),inset_0_0_20px_rgba(99,102,241,0.03)]'
          : 'border-border-subtle bg-gradient-to-br from-[#0f172a]/80 to-[#0f172a]/40 hover:border-accent-indigo/30 hover:bg-gradient-to-br hover:from-[#0f172a]/90 hover:to-bg-card/40 hover:translate-x-0.5'
        }`}
    >
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-accent-indigo to-accent-indigo-light rounded-l-[3px]" />
      )}
      <div className="flex justify-between items-start gap-2.5">
        <div>
          <div className="text-[13px] font-semibold text-text-primary leading-snug">{job.title}</div>
          <div className="text-[11px] text-text-muted mt-0.5">
            {job.company} &middot; {job.location || 'Location N/A'}
          </div>
        </div>
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-extrabold shrink-0 border-2 ${getScoreStyle(job.fit_score)}`}>
          {job.fit_score ?? '—'}
        </div>
      </div>
      <div className="flex gap-[5px] mt-2">
        {job.competition && (
          <span className={`px-[7px] py-0.5 rounded text-[10px] font-medium border ${COMP_COLORS[job.competition] || ''}`}>
            {job.competition === 'low' ? 'Low Comp' : job.competition === 'medium' ? 'Med Comp' : 'High Comp'}
          </span>
        )}
        {job.recommendation && (
          <span className={`px-[7px] py-0.5 rounded text-[10px] font-medium border ${REC_COLORS[job.recommendation] || ''}`}>
            {job.recommendation.charAt(0).toUpperCase() + job.recommendation.slice(1)}
          </span>
        )}
        <span className={`px-[7px] py-0.5 rounded text-[10px] font-medium border ${SOURCE_COLORS[job.source] || ''}`}>
          {job.source === 'google-jobs' ? 'Google' : job.source.charAt(0).toUpperCase() + job.source.slice(1)}
        </span>
      </div>
      {job.posted_at && (
        <div className="text-[10px] text-[#334155] mt-1.5">
          Posted {job.posted_at} {job.applicants ? `· ${job.applicants} applicants` : ''}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create JobList with filters and search**

Create `packages/frontend/src/components/JobList.tsx`:

```tsx
import { useState, useMemo } from 'react';
import { JobCard } from './JobCard';
import type { Job, JobFilters } from '../api/types';

interface JobListProps {
  jobs: Job[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  filters: JobFilters;
  onFiltersChange: (filters: JobFilters) => void;
}

const SOURCES = ['All', 'Greenhouse', 'Lever', 'Indeed', 'Google', 'ZipRecruiter'];
const SOURCE_VALUES: Record<string, string | undefined> = {
  All: undefined, Greenhouse: 'greenhouse', Lever: 'lever',
  Indeed: 'indeed', Google: 'google-jobs', ZipRecruiter: 'ziprecruiter',
};
const STATUSES = ['All', 'Discovered', 'Applied', 'Interview', 'Offer', 'Rejected'];
const COMPETITIONS = ['All', 'Low', 'Medium', 'High'];

export function JobList({ jobs, selectedId, onSelect, filters, onFiltersChange }: JobListProps) {
  const activeSource = SOURCES.find(s => SOURCE_VALUES[s] === filters.source) || 'All';
  const activeStatus = filters.status ? filters.status.charAt(0).toUpperCase() + filters.status.slice(1) : 'All';
  const activeComp = filters.competition ? filters.competition.charAt(0).toUpperCase() + filters.competition.slice(1) : 'All';

  return (
    <div className="w-[380px] min-w-[380px] bg-bg-secondary border-r border-border-subtle flex flex-col">
      {/* Filters */}
      <div className="p-3 px-4 border-b border-border-subtle">
        <FilterRow label="Source" items={SOURCES} active={activeSource} onSelect={(v) =>
          onFiltersChange({ ...filters, source: SOURCE_VALUES[v], page: 1 })
        } />
        <FilterRow label="Pipeline" items={STATUSES} active={activeStatus} onSelect={(v) =>
          onFiltersChange({ ...filters, status: v === 'All' ? undefined : v.toLowerCase(), page: 1 })
        } />
        <FilterRow label="Competition" items={COMPETITIONS} active={activeComp} onSelect={(v) =>
          onFiltersChange({ ...filters, competition: v === 'All' ? undefined : v.toLowerCase(), page: 1 })
        } />
      </div>

      {/* Search */}
      <div className="p-2 px-4 border-b border-border-subtle">
        <input
          type="text"
          placeholder="Search jobs, companies..."
          value={filters.search || ''}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value || undefined, page: 1 })}
          className="w-full bg-[#0f172a]/80 border border-border-subtle rounded-lg py-2 px-3 pl-8 text-text-primary text-xs outline-none focus:border-accent-indigo/40 transition-colors placeholder:text-[#334155]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'%3E%3C/circle%3E%3Cpath d='m21 21-4.3-4.3'%3E%3C/path%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: '10px center',
          }}
        />
      </div>

      {/* Job Cards */}
      <div className="flex-1 overflow-y-auto p-2 px-2.5 scrollbar-thin scrollbar-thumb-bg-card">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} isActive={job.id === selectedId} onClick={() => onSelect(job.id)} />
        ))}
        {jobs.length === 0 && (
          <div className="text-text-dim text-xs text-center py-8">No jobs found</div>
        )}
      </div>
    </div>
  );
}

function FilterRow({ label, items, active, onSelect }: {
  label: string;
  items: string[];
  active: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="text-[9px] font-semibold uppercase tracking-widest text-text-dim mb-1.5">{label}</div>
      <div className="flex gap-[5px] flex-wrap">
        {items.map(item => (
          <button
            key={item}
            onClick={() => onSelect(item)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all border
              ${item === active
                ? 'bg-accent-indigo/15 text-accent-indigo-light border-accent-indigo/30'
                : 'bg-bg-card/60 text-text-muted border-border-subtle hover:text-text-secondary hover:border-border'
              }`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/components/JobCard.tsx packages/frontend/src/components/JobList.tsx
git commit -m "feat: add JobCard and JobList components with filters and search"
```

---

### Task 26: DetailPanel and Pipeline components

**Files:**
- Create: `packages/frontend/src/components/Pipeline.tsx`
- Create: `packages/frontend/src/components/DetailPanel.tsx`

- [ ] **Step 1: Create Pipeline component**

Create `packages/frontend/src/components/Pipeline.tsx`:

```tsx
interface PipelineProps {
  status: string;
  onStatusChange: (status: string) => void;
}

const STAGES = ['discovered', 'applied', 'interview', 'offer'];

export function Pipeline({ status, onStatusChange }: PipelineProps) {
  const isRejected = status === 'rejected';
  const activeIndex = STAGES.indexOf(status);

  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim mb-2">Pipeline</div>
      <div className="flex gap-[3px]">
        {STAGES.map((stage, i) => (
          <button
            key={stage}
            onClick={() => onStatusChange(stage)}
            className={`flex-1 py-2.5 text-center text-xs font-semibold transition-all cursor-pointer
              ${i === 0 ? 'rounded-l-[10px]' : ''} ${i === STAGES.length - 1 ? 'rounded-r-[10px]' : ''}
              ${!isRejected && i <= activeIndex
                ? 'bg-gradient-to-br from-accent-indigo to-[#4f46e5] text-white shadow-[0_2px_12px_rgba(99,102,241,0.3)]'
                : 'bg-bg-card/50 text-text-dim border border-border-subtle hover:text-text-muted hover:bg-bg-card/80'
              }`}
          >
            {stage.charAt(0).toUpperCase() + stage.slice(1)}
          </button>
        ))}
      </div>
      <button
        onClick={() => onStatusChange('rejected')}
        className={`mt-2 w-full py-2 rounded-lg text-xs font-semibold transition-all
          ${isRejected
            ? 'bg-accent-red/20 text-accent-red-light border border-accent-red/30'
            : 'bg-bg-card/30 text-text-dim border border-border-subtle hover:text-accent-red-light hover:border-accent-red/30'
          }`}
      >
        {isRejected ? 'Rejected' : 'Mark as Rejected'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create DetailPanel**

Create `packages/frontend/src/components/DetailPanel.tsx`:

```tsx
import { useState, useEffect } from 'react';
import type { JobWithOutreach } from '../api/types';
import { Pipeline } from './Pipeline';
import { outreachApi } from '../api/client';

interface DetailPanelProps {
  job: JobWithOutreach;
  onStatusChange: (status: string) => void;
  onNotesChange: (notes: string) => void;
}

export function DetailPanel({ job, onStatusChange, onNotesChange }: DetailPanelProps) {
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [outreachLoading, setOutreachLoading] = useState<string | null>(null);
  const [outreachContent, setOutreachContent] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState(job.notes || '');

  // Sync notes state when job changes
  useEffect(() => {
    setNotesText(job.notes || '');
    setEditingNotes(false);
    setOutreachContent(null);
    setShowFullDesc(false);
  }, [job.id]);

  const handleOutreach = async (type: 'connection' | 'email' | 'inmail') => {
    setOutreachLoading(type);
    try {
      const result = await outreachApi.generate(job.id, type);
      setOutreachContent(result.content);
    } catch (err) {
      console.error('Outreach failed:', err);
    } finally {
      setOutreachLoading(null);
    }
  };

  const saveNotes = () => {
    onNotesChange(notesText);
    setEditingNotes(false);
  };

  return (
    <div className="flex-1 bg-gradient-to-b from-bg-secondary to-bg-primary overflow-y-auto p-6 px-7 scrollbar-thin scrollbar-thumb-bg-card">
      {/* Header */}
      <div className="flex justify-between items-start mb-5">
        <div>
          <h2 className="text-[22px] font-bold text-[#f1f5f9] tracking-tight">{job.title}</h2>
          <div className="text-sm text-text-muted mt-1">
            {job.company} <span className="text-text-dim mx-1.5">&middot;</span> {job.location || 'N/A'}
          </div>
          <div className="text-[11px] text-[#334155] mt-1">
            {job.posted_at ? `Posted ${job.posted_at}` : ''} {job.applicants ? `· ${job.applicants} applicants` : ''}
          </div>
        </div>
        <a
          href={job.link}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-accent-indigo/10 text-accent-indigo-light border border-accent-indigo/25 px-4 py-2 rounded-lg text-xs font-semibold hover:bg-accent-indigo/20 hover:border-accent-indigo/40 transition-all inline-flex items-center gap-1.5"
        >
          View Original
        </a>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <MetricCard label="Fit Score" value={String(job.fit_score ?? '—')} color="indigo" large />
        <MetricCard label="Competition" value={job.competition ?? '—'} color="green" />
        <MetricCard label="Recommendation" value={job.recommendation ?? '—'} color="amber" />
        <MetricCard label="Source" value={job.source === 'google-jobs' ? 'Google' : job.source} color="cyan" />
      </div>

      {/* Score Reason */}
      {job.score_reason && (
        <SectionCard label="Why This Score" text={job.score_reason} />
      )}

      {/* Pitch */}
      {job.pitch && (
        <SectionCard label="Outreach Hook" text={`"${job.pitch}"`} italic />
      )}

      {/* Description */}
      {job.description && (
        <div className="bg-gradient-to-br from-[#0f172a]/70 to-[#0f172a]/30 border border-border-subtle rounded-xl p-4 px-[18px] mb-3">
          <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim mb-2">Job Description</div>
          <div className={`text-xs text-text-muted leading-relaxed ${!showFullDesc ? 'max-h-20 overflow-hidden relative' : ''}`}>
            {job.description}
            {!showFullDesc && (
              <div className="absolute bottom-0 left-0 right-0 h-[30px] bg-gradient-to-t from-[#0a0f1e]/95 to-transparent" />
            )}
          </div>
          <button
            onClick={() => setShowFullDesc(!showFullDesc)}
            className="text-accent-indigo text-[11px] font-semibold mt-1 cursor-pointer"
          >
            {showFullDesc ? 'Show less' : 'Show full description'}
          </button>
        </div>
      )}

      {/* Pipeline */}
      <div className="mb-4">
        <Pipeline status={job.status} onStatusChange={onStatusChange} />
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {(['connection', 'email', 'inmail'] as const).map((type, i) => (
          <button
            key={type}
            onClick={() => handleOutreach(type)}
            disabled={outreachLoading !== null}
            className={`py-2.5 rounded-[10px] text-xs font-semibold transition-all
              ${i === 0
                ? 'bg-gradient-to-br from-accent-indigo to-[#4f46e5] text-white shadow-[0_2px_12px_rgba(99,102,241,0.25)] hover:shadow-[0_4px_20px_rgba(99,102,241,0.35)] hover:-translate-y-0.5'
                : 'bg-bg-card/50 text-text-secondary border border-border-subtle hover:text-text-primary hover:border-border'
              } disabled:opacity-50`}
          >
            {outreachLoading === type ? 'Generating...' : `Draft ${type.charAt(0).toUpperCase() + type.slice(1)}`}
          </button>
        ))}
      </div>

      {/* Outreach Result */}
      {outreachContent && (
        <div className="bg-gradient-to-br from-[#0f172a]/70 to-[#0f172a]/30 border border-accent-indigo/20 rounded-xl p-4 px-[18px] mb-3">
          <div className="flex justify-between items-center mb-2">
            <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim">Generated Draft</div>
            <button
              onClick={() => navigator.clipboard.writeText(outreachContent)}
              className="text-accent-indigo text-[10px] font-semibold hover:text-accent-indigo-light"
            >
              Copy
            </button>
          </div>
          <div className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">{outreachContent}</div>
        </div>
      )}

      {/* Notes */}
      <div className="bg-gradient-to-br from-[#0f172a]/70 to-[#0f172a]/30 border border-border-subtle rounded-xl p-4 px-[18px]">
        <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim mb-2">Notes</div>
        {editingNotes ? (
          <div>
            <textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              className="w-full bg-bg-primary/40 border border-border-subtle rounded-lg p-3 text-xs text-text-primary outline-none focus:border-accent-indigo/40 resize-none min-h-[80px]"
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button onClick={saveNotes} className="text-accent-indigo text-[11px] font-semibold">Save</button>
              <button onClick={() => setEditingNotes(false)} className="text-text-dim text-[11px]">Cancel</button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setEditingNotes(true)}
            className={`text-xs cursor-pointer min-h-[40px] ${job.notes ? 'text-text-secondary' : 'text-[#1e293b] italic'}`}
          >
            {job.notes || 'Click to add notes...'}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, color, large }: { label: string; value: string; color: string; large?: boolean }) {
  const colorMap: Record<string, string> = {
    indigo: 'text-accent-indigo-light',
    green: 'text-accent-green-light',
    amber: 'text-accent-amber-light',
    cyan: 'text-accent-cyan-light',
  };
  const borderMap: Record<string, string> = {
    indigo: 'before:bg-gradient-to-r before:from-transparent before:via-accent-indigo/50 before:to-transparent',
    green: 'before:bg-gradient-to-r before:from-transparent before:via-accent-green/50 before:to-transparent',
    amber: 'before:bg-gradient-to-r before:from-transparent before:via-accent-amber/50 before:to-transparent',
    cyan: 'before:bg-gradient-to-r before:from-transparent before:via-accent-cyan/50 before:to-transparent',
  };

  return (
    <div className={`bg-gradient-to-br from-[#0f172a]/90 to-[#0f172a]/50 border border-border-subtle rounded-xl p-4 text-center relative overflow-hidden before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-3/5 before:h-px ${borderMap[color]}`}>
      <div className={`${large ? 'text-[28px]' : 'text-[18px]'} font-extrabold mb-0.5 ${colorMap[color]} capitalize`}>{value}</div>
      <div className="text-[10px] text-text-dim uppercase tracking-[1px] font-semibold">{label}</div>
    </div>
  );
}

function SectionCard({ label, text, italic }: { label: string; text: string; italic?: boolean }) {
  return (
    <div className="bg-gradient-to-br from-[#0f172a]/70 to-[#0f172a]/30 border border-border-subtle rounded-xl p-4 px-[18px] mb-3">
      <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim mb-2">{label}</div>
      <div className={`text-[13px] text-text-secondary leading-relaxed ${italic ? 'italic text-accent-indigo-light' : ''}`}>{text}</div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/components/Pipeline.tsx packages/frontend/src/components/DetailPanel.tsx
git commit -m "feat: add DetailPanel and Pipeline components with outreach generation"
```

---

### Task 27: App.tsx — wire everything together

**Files:**
- Modify: `packages/frontend/src/App.tsx`

- [ ] **Step 1: Write App.tsx**

Replace `packages/frontend/src/App.tsx`:

```tsx
import { useState, useCallback } from 'react';
import { TopBar } from './components/TopBar';
import { JobList } from './components/JobList';
import { DetailPanel } from './components/DetailPanel';
import { useJobs } from './hooks/useJobs';
import { useStats } from './hooks/useStats';
import { useJob } from './hooks/useJob';
import type { JobFilters } from './api/types';

export default function App() {
  const [filters, setFilters] = useState<JobFilters>({ sort: 'fit_score', order: 'desc' });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { jobs, loading, refetch: refetchJobs } = useJobs(filters);
  const { stats, refetch: refetchStats } = useStats();
  const { job: selectedJob, updateStatus, updateNotes, refetch: refetchJob } = useJob(selectedId);

  const handleScrapeComplete = useCallback(() => {
    refetchJobs();
    refetchStats();
  }, [refetchJobs, refetchStats]);

  const handleStatusChange = useCallback(async (status: string) => {
    await updateStatus(status);
    refetchJobs();
    refetchStats();
  }, [updateStatus, refetchJobs, refetchStats]);

  const handleNotesChange = useCallback(async (notes: string) => {
    await updateNotes(notes);
  }, [updateNotes]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopBar stats={stats} onScrapeComplete={handleScrapeComplete} />
      <div className="flex flex-1 overflow-hidden">
        <JobList
          jobs={jobs}
          selectedId={selectedId}
          onSelect={setSelectedId}
          filters={filters}
          onFiltersChange={setFilters}
        />
        <div className="flex-1 overflow-hidden">
          {selectedJob ? (
            <DetailPanel
              job={selectedJob}
              onStatusChange={handleStatusChange}
              onNotesChange={handleNotesChange}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-text-dim text-sm">
              {loading ? 'Loading...' : 'Select a job to view details'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify frontend builds**

```bash
cd packages/frontend && pnpm build
```
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 3: Verify frontend displays with mock data**

```bash
cd packages/frontend && pnpm dev
```
Open `http://localhost:5173`. With the backend running (`pnpm dev:backend`), the dashboard should load showing the empty state. If the backend has been seeded and scraped, data should appear.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/App.tsx
git commit -m "feat: wire App.tsx with all components, hooks, and data flow"
```

---

## Chunk 6: Scheduler, Scrape Wiring & End-to-End Verification

### Task 28: Wire scrape handler to orchestrator + scorer

**Files:**
- Modify: `packages/backend/src/api/server.ts`

- [ ] **Step 1: Update server.ts to wire the full scrape pipeline**

Update the placeholder `triggerScrape` in `packages/backend/src/api/server.ts`:

```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { db } from '../db/index.js';
import { createQueries } from '../db/queries.js';
import { createJobsRouter } from './routes/jobs.js';
import { createStatsRouter } from './routes/stats.js';
import { createScrapeRouter } from './routes/scrape.js';
import { createOutreachRouter } from './routes/outreach.js';
import { createCompaniesRouter } from './routes/companies.js';
import { errorHandler } from './middleware/errors.js';
import { runAllSources } from '../sources/index.js';
import { scoreJobs } from '../scorer/index.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const queries = createQueries(db);

const app = express();

app.use(cors({ origin: ['http://localhost:5173'] }));
app.use(express.json());

async function triggerScrape() {
  const runId = queries.createScrapeRun();
  const sourcesRun: string[] = [];

  try {
    // Get active companies from DB
    const companies = queries.getActiveCompanies().map(c => ({
      name: c.name,
      greenhouseSlug: c.greenhouseSlug,
      leverSlug: c.leverSlug,
    }));

    // Run all sources (returns SourceResult with jobs, sourcesRun, errors)
    const result = await runAllSources(companies);
    const { jobs: allJobs, sourcesRun, errors } = result;

    // Filter to only new jobs (DB-level dedup)
    const allLinks = allJobs.map(j => j.link);
    const newLinks = queries.filterNewLinks(allLinks);
    const newJobs = allJobs.filter(j => newLinks.includes(j.link));

    // Insert new jobs one at a time to get their IDs for scoring
    const insertedIds: { id: number; title: string; company: string; source: string; description: string | null }[] = [];
    for (const j of newJobs) {
      const result = queries.insertJob({
        title: j.title,
        company: j.company,
        location: j.location,
        link: j.link,
        source: j.source,
        atsId: j.atsId,
        postedAt: j.postedAt,
        applicants: j.applicants,
        description: j.description,
      });
      insertedIds.push({
        id: Number(result.lastInsertRowid),
        title: j.title,
        company: j.company,
        source: j.source,
        description: j.description,
      });
    }

    // Score new jobs
    if (insertedIds.length > 0) {
      const scored = await scoreJobs(insertedIds);
      for (const s of scored) {
        queries.updateJobScoring(s.id, {
          fitScore: s.fitScore,
          competition: s.competition,
          recommendation: s.recommendation,
          pitch: s.pitch,
          scoreReason: s.scoreReason,
        });
      }
    }

    // Determine status: success if no errors, partial if some, failed if all
    const status = errors.length === 0 ? 'success'
      : errors.length < sourcesRun.length ? 'partial'
      : 'failed';

    // Update scrape run
    queries.updateScrapeRun(runId, {
      finishedAt: new Date().toISOString(),
      jobsFound: allJobs.length,
      jobsNew: newJobs.length,
      sourcesRun: JSON.stringify(sourcesRun),
      status,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    });

    console.log(`Scrape complete: ${allJobs.length} found, ${newJobs.length} new, status: ${status}`);
  } catch (err: any) {
    queries.updateScrapeRun(runId, {
      finishedAt: new Date().toISOString(),
      status: 'failed',
      error: err.message,
    });
    throw err;
  }
}

app.use('/api/jobs', createJobsRouter(queries));
app.use('/api/stats', createStatsRouter(queries));
app.use('/api/scrape', createScrapeRouter(queries, triggerScrape));
app.use('/api/outreach', createOutreachRouter(queries));
app.use('/api/companies', createCompaniesRouter(queries));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`JobGrid API running on port ${PORT}`);
});

export { app, queries, triggerScrape };
```

- [ ] **Step 2: Verify server starts with wiring**

```bash
cd packages/backend && pnpm dev
```
Expected: "JobGrid API running on port 3001" — no import errors

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/api/server.ts
git commit -m "feat: wire scrape handler to source orchestrator and Groq scorer"
```

---

### Task 29: Cron scheduler

**Files:**
- Create: `packages/backend/src/scheduler/cron.ts`

- [ ] **Step 1: Write the cron scheduler**

Create `packages/backend/src/scheduler/cron.ts`:

```typescript
import cron from 'node-cron';

export function startScheduler(triggerScrape: () => Promise<void>) {
  // Run at 2am daily
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
}
```

- [ ] **Step 2: Import scheduler in server.ts**

Add to the end of `packages/backend/src/api/server.ts` (before `export`):

```typescript
import { startScheduler } from '../scheduler/cron.js';

// Start cron scheduler
if (process.env.NODE_ENV !== 'test') {
  startScheduler(triggerScrape);
}
```

- [ ] **Step 3: Verify server starts with scheduler**

```bash
cd packages/backend && pnpm dev
```
Expected: Console shows "JobGrid API running on port 3001" followed by "Scheduler registered: nightly scrape at 2:00 AM"

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/scheduler/cron.ts packages/backend/src/api/server.ts
git commit -m "feat: add node-cron scheduler for nightly 2am scrape"
```

---

### Task 30: End-to-end verification

- [ ] **Step 1: Start the backend**

```bash
cd packages/backend && pnpm dev
```
Expected: Server running on port 3001, scheduler registered

- [ ] **Step 2: Verify companies are seeded**

```bash
curl -s http://localhost:3001/api/companies | jq '. | length'
```
Expected: `13`

- [ ] **Step 3: Trigger a manual scrape (API sources only will work without Playwright installed)**

```bash
curl -s -X POST http://localhost:3001/api/scrape | jq
```
Expected: Returns `{ "runId": 1 }`

- [ ] **Step 4: Poll for scrape completion**

```bash
sleep 10 && curl -s http://localhost:3001/api/scrape/1 | jq
```
Expected: Status changes from `running` to `success` or `partial` (Playwright scrapers may fail if Chromium not installed). `jobs_found` should be > 0 if Greenhouse/Lever APIs returned results.

- [ ] **Step 5: Check stats**

```bash
curl -s http://localhost:3001/api/stats | jq
```
Expected: `total` > 0 if API sources returned jobs. `by_source` should show counts for `greenhouse` and/or `lever`.

- [ ] **Step 6: Check jobs list**

```bash
curl -s 'http://localhost:3001/api/stats' | jq '.total'
curl -s 'http://localhost:3001/api/jobs?limit=3' | jq '.jobs[].title'
```
Expected: Job titles from Greenhouse/Lever companies

- [ ] **Step 7: Start frontend and verify dashboard**

```bash
cd packages/frontend && pnpm dev
```
Open `http://localhost:5173`. Expected:
- TopBar shows stats (total jobs, avg fit, etc.)
- JobList shows job cards with scores (if scored)
- Clicking a job shows the DetailPanel
- Pipeline buttons work
- Notes are editable

- [ ] **Step 8: Install Playwright browsers (for full scraper coverage)**

```bash
cd packages/backend && npx playwright install chromium
```

- [ ] **Step 9: Run another scrape to test Playwright sources**

```bash
curl -s -X POST http://localhost:3001/api/scrape | jq
sleep 30
curl -s 'http://localhost:3001/api/scrape/log' | jq '.[0]'
```
Expected: Latest run shows more sources in `sources_run` array

- [ ] **Step 10: Final commit**

```bash
git add packages/ pnpm-lock.yaml
git commit -m "feat: complete JobGrid — all sources, scoring, API, frontend, and scheduler"
```

# JobGrid — Full Architecture & Design Spec

Personal job-discovery platform that pulls PM listings from multiple sources nightly, scores each against your profile using Groq's LLaMA 3.3, and presents a ranked dark analytics dashboard with pipeline tracking and AI-drafted outreach.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Language | TypeScript (strict) | Type safety, better IDE experience, catches bugs early |
| Package Manager | pnpm workspaces | Clean monorepo, fast installs, shared types |
| ORM | Drizzle ORM (SQLite now, Postgres-ready) | Lightweight, SQL-like, TypeScript-native, migration-friendly |
| Database | SQLite via better-sqlite3 | Zero config for personal tool, Drizzle allows future Postgres swap |
| API Server | Express.js | Simple, proven, matches original spec |
| Frontend | React 19 + Vite | Fast dev server, lightweight for a personal tool |
| UI Components | shadcn/ui + Tailwind CSS v4 | Best-in-class dark mode components, full ownership of code |
| Validation | Zod | Shared schemas between frontend/backend, runtime + compile-time safety |
| UI Style | Dark analytics (Linear/Vercel aesthetic) | Data-dense, gradient accents, glowing score indicators, premium feel |
| Scrapers | Playwright (Chromium) | Indeed, Google Jobs, ZipRecruiter |
| Scorer | Groq API — llama-3.3-70b-versatile | Fast inference, consistent JSON output at temp 0.2 |
| Scheduler | node-cron (2am nightly) | Runs in same process as Express |

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict) |
| Package Manager | pnpm workspaces |
| ATS APIs | Greenhouse + Lever public JSON APIs (native fetch) |
| Scrapers | Playwright — Indeed, Google Jobs, ZipRecruiter |
| Scorer | Groq API — llama-3.3-70b-versatile |
| ORM | Drizzle ORM (SQLite via better-sqlite3, Postgres-ready) |
| API Server | Express.js on port 3001 |
| Scheduler | node-cron (2am nightly) |
| Frontend | React 19 + Vite + TypeScript |
| UI Components | shadcn/ui + Tailwind CSS v4 |
| HTTP Client | Axios |
| Validation | Zod (shared schemas) |

## Project Structure

```
jobgrid/
├── packages/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── sources/
│   │   │   │   ├── index.ts          # Orchestrates all sources, deduplicates
│   │   │   │   ├── greenhouse.ts     # Greenhouse public API (no browser)
│   │   │   │   ├── lever.ts          # Lever public API (no browser)
│   │   │   │   ├── indeed.ts         # Indeed Playwright scraper
│   │   │   │   ├── google-jobs.ts    # Google Jobs Playwright scraper
│   │   │   │   ├── ziprecruiter.ts   # ZipRecruiter Playwright scraper
│   │   │   │   └── companies.ts      # Target company list with ATS slugs
│   │   │   ├── browser/
│   │   │   │   ├── instance.ts       # Playwright browser manager (singleton)
│   │   │   │   └── delay.ts          # Random human-like delays (2–5s)
│   │   │   ├── scorer/
│   │   │   │   ├── index.ts          # Batch scoring orchestrator
│   │   │   │   ├── groq.ts           # Groq API client
│   │   │   │   ├── profile.ts        # PM profile definition
│   │   │   │   └── prompts.ts        # Scoring + outreach prompt templates
│   │   │   ├── db/
│   │   │   │   ├── index.ts          # Drizzle client singleton
│   │   │   │   ├── schema.ts         # Drizzle table definitions
│   │   │   │   └── queries.ts        # Typed query helpers
│   │   │   ├── api/
│   │   │   │   ├── server.ts         # Express app setup
│   │   │   │   ├── routes/
│   │   │   │   │   ├── jobs.ts       # Job CRUD + filtering
│   │   │   │   │   ├── stats.ts      # Dashboard aggregates
│   │   │   │   │   ├── scrape.ts     # Manual trigger + logs
│   │   │   │   │   ├── outreach.ts   # Groq outreach drafting
│   │   │   │   │   └── companies.ts  # Company CRUD
│   │   │   │   └── middleware/
│   │   │   │       └── errors.ts     # Centralized error handling
│   │   │   └── scheduler/
│   │   │       └── cron.ts           # node-cron nightly job
│   │   ├── drizzle/                  # Generated migrations
│   │   ├── drizzle.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── frontend/
│       ├── src/
│       │   ├── App.tsx
│       │   ├── components/
│       │   │   ├── ui/               # shadcn/ui primitives
│       │   │   ├── TopBar.tsx        # Logo, stat badges, scrape status, run button
│       │   │   ├── JobList.tsx       # Filterable, searchable job list
│       │   │   ├── JobCard.tsx       # Score circle, tags, time, applicant count
│       │   │   ├── DetailPanel.tsx   # Full job detail with metrics, pitch, description
│       │   │   ├── Pipeline.tsx      # Clickable pipeline status bar
│       │   │   ├── OutreachModal.tsx # Draft display with copy + history
│       │   │   └── StatusBar.tsx     # Last scraped, source counts, manual trigger
│       │   ├── hooks/
│       │   │   ├── useJobs.ts        # Job list with filters, search, pagination
│       │   │   ├── useStats.ts       # Dashboard aggregates (auto-refresh 60s)
│       │   │   └── useJob.ts         # Single job detail + outreach history
│       │   ├── api/
│       │   │   └── client.ts         # Axios instance with interceptors
│       │   └── lib/
│       │       └── utils.ts          # shadcn cn() helper
│       ├── tailwind.config.ts
│       ├── vite.config.ts
│       ├── tsconfig.json
│       └── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
├── .gitignore
└── package.json
```

## Database Schema

All timestamps stored as ISO text strings (SQLite-friendly, Postgres-portable). Drizzle generates SQL migrations from schema definitions.

### companies

Target company list with ATS slugs. Managed via API. Seed with 10-15 known companies.

| Column | Type | Notes |
|---|---|---|
| id | integer, PK, auto-increment | |
| name | text, not null | Display name |
| greenhouse_slug | text, nullable | For boards-api.greenhouse.io |
| lever_slug | text, nullable | For api.lever.co |
| active | integer (boolean), default 1 | Pause without deleting |
| last_checked | text, nullable | ISO timestamp of last successful API call |
| created_at | text, default now | |

### jobs

Core table. All discovered jobs from all sources.

| Column | Type | Notes |
|---|---|---|
| id | integer, PK, auto-increment | |
| title | text, not null | |
| company | text, not null | |
| location | text, nullable | |
| applicants | integer, nullable | Count at discovery time |
| description | text, nullable | Full job description |
| link | text, not null, unique | Primary dedup key |
| source | text, not null | greenhouse, lever, indeed, google-jobs, ziprecruiter |
| ats_id | text, nullable | Original ATS job ID for secondary dedup |
| posted_at | text, nullable | ISO timestamp |
| scraped_at | text, not null, default now | |
| fit_score | integer, nullable | Groq score 0–100 |
| competition | text, nullable | low, medium, high |
| recommendation | text, nullable | apply, watch, skip |
| pitch | text, nullable | 2-line outreach hook |
| score_reason | text, nullable | One-line explanation |
| status | text, not null, default 'discovered' | discovered → applied → interview → offer → rejected |
| notes | text, nullable | |
| next_action | text, nullable | |
| applied_at | text, nullable | |
| interview_at | text, nullable | |
| offer_at | text, nullable | |

**Indexes:** `link` (unique), `source`, `status`, `fit_score`, composite `(source, ats_id)`.

### outreach

AI-generated outreach drafts.

| Column | Type | Notes |
|---|---|---|
| id | integer, PK, auto-increment | |
| job_id | integer, FK → jobs.id | |
| type | text, not null | connection, email, inmail |
| content | text, not null | Generated outreach text |
| created_at | text, default now | |

### scrape_runs

Nightly run logs for debugging and status display.

| Column | Type | Notes |
|---|---|---|
| id | integer, PK, auto-increment | |
| started_at | text, not null | |
| finished_at | text, nullable | |
| jobs_found | integer, default 0 | |
| jobs_new | integer, default 0 | |
| sources_run | text, nullable | JSON array of sources that ran |
| status | text, not null | success, partial, failed |
| error | text, nullable | Error message if failed |

## Sources Layer

### Orchestrator (sources/index.ts)

Runs all 5 sources in sequence: API sources first (fast, zero risk), then Playwright scrapers. Deduplicates and returns only net-new jobs.

**Execution order:**
1. Greenhouse API + Lever API (parallel via Promise.all)
2. Indeed scraper (sequential — one browser page at a time)
3. Google Jobs scraper
4. ZipRecruiter scraper

**Deduplication:**
1. Deduplicate within batch by `link` (exact URL match)
2. For ATS sources, also deduplicate by `(source, ats_id)` to catch URL variations
3. Query existing `jobs` table for matching `link` values
4. Insert only truly new jobs, return them for scoring

**Error handling:** Each source wrapped in try/catch. Partial failures don't block other sources. `scrape_runs` logs which sources succeeded with status `partial` if some failed, `failed` only if all did.

### Greenhouse (sources/greenhouse.ts)

Pure API — no browser. Iterates companies with `greenhouse_slug` set.

```
GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs
```

Maps: `job.title` → title, `job.location.name` → location, `job.absolute_url` → link, `String(job.id)` → ats_id, `job.updated_at` → posted_at.

### Lever (sources/lever.ts)

Pure API — no browser. Iterates companies with `lever_slug` set.

```
GET https://api.lever.co/v0/postings/{slug}?mode=json
```

Maps: `job.text` → title, `job.categories.location` → location, `job.hostedUrl` → link, `job.id` → ats_id, `new Date(job.createdAt).toISOString()` → posted_at.

### Indeed (sources/indeed.ts)

Playwright scraper. Navigates to Indeed with query params:
- `q=project+manager`
- `l=Worcester,MA`
- `radius=25`
- `fromage=1` (last 24h)
- `sort=date`

Waits for `.job_seen_beacon`, extracts title/company/location/link/posted_at from cards.

### Google Jobs (sources/google-jobs.ts)

Playwright scraper. Runs multiple search queries:
- "project manager" Worcester MA
- "program manager" Worcester MA
- "technical program manager" Boston MA
- "infrastructure PM" remote

Navigates to `google.com/search?q={query}&ibp=htl;jobs`. Extracts from job carousel cards.

### ZipRecruiter (sources/ziprecruiter.ts)

Playwright scraper. Similar pattern to Indeed — navigates to ZipRecruiter search with location/radius/date filters, extracts job cards.

### Browser Infrastructure (browser/)

- **instance.ts** — Singleton Playwright browser manager. Launches Chromium with realistic viewport (1920x1080), standard user-agent. Provides `getPage()` and `close()`.
- **delay.ts** — Random delays between 2–5 seconds between page actions to mimic human browsing patterns.

### Companies (sources/companies.ts)

Typed array of target companies, seeded with initial list. Managed at runtime via `/api/companies` endpoints.

Initial seed companies:
- MathWorks (greenhouse: mathworks)
- Infosys BPM (greenhouse: infosysbpm)
- Abiomed (greenhouse: abiomed)
- Plus 7-12 more discovered via `site:boards.greenhouse.io` and `site:jobs.lever.co` searches for Worcester/Boston area companies.

## Groq Scoring Layer

### Profile (scorer/profile.ts)

Typed constant containing the PM profile:
- Role: Project Manager at WPI
- Experience: Multi-million dollar infrastructure/security portfolio, AI camera systems (Milestone VMS, AI Argus), emergency phone systems, parking gates, electronic access control, MGHPCC data center, executive reporting
- Certifications: CAPM, PMI-ACP, SAFe
- Skills: Python, SQL, Power BI, Power Platform, Agile, Scrum
- Previous: RELI Group — PM Analyst, cybersecurity, ISO 27001
- Location: Worcester MA, open to remote

### Scoring Prompt (scorer/prompts.ts)

Instructs LLaMA 3.3 to analyze job against profile. Returns JSON:

```json
{
  "fit_score": 0-100,
  "competition": "low | medium | high",
  "recommendation": "apply | watch | skip",
  "score_reason": "one sentence",
  "pitch": "two sentence outreach hook"
}
```

Temperature 0.2 for consistency. `response_format: { type: "json_object" }` enforced. Zod validates the response shape.

### Outreach Prompt (scorer/prompts.ts)

On-demand prompt for generating full outreach drafts. Takes job + type (connection/email/inmail) + pitch as seed. Used by `/api/outreach/:id`.

### Batch Scorer (scorer/index.ts + groq.ts)

- Batches of 10 jobs
- Each batch scored in parallel via `Promise.all`
- 1-second pause between batches (Groq rate limits)
- Failed individual scores logged and skipped (don't block batch)
- Updates `jobs` table with fit_score, competition, recommendation, pitch, score_reason

## API Layer

Express.js on port 3001. All routes prefixed `/api`. CORS enabled for Vite dev server.

### Endpoints

| Method | Route | Description |
|---|---|---|
| GET | /api/jobs | List jobs. Query: `?source=greenhouse&status=discovered&competition=low&minScore=70&sort=fit_score&order=desc&page=1&limit=20` |
| GET | /api/jobs/:id | Single job with full detail + outreach drafts |
| PATCH | /api/jobs/:id/status | Update pipeline status. Body: `{ status, applied_at?, interview_at?, offer_at? }`. Auto-sets timestamps. |
| PATCH | /api/jobs/:id/notes | Update notes/next_action. Body: `{ notes?, next_action? }` |
| POST | /api/outreach/:id | Generate outreach via Groq. Body: `{ type: "connection" | "email" | "inmail" }`. Saves to outreach table. |
| GET | /api/stats | Dashboard aggregates: total, avg fit, low-competition count, by-source, by-status, last scraped, new today |
| POST | /api/scrape | Trigger full source run async. Returns `{ runId }`. |
| GET | /api/scrape/log | Last 10 scrape runs |
| GET | /api/companies | List target companies |
| POST | /api/companies | Add company. Body: `{ name, greenhouse_slug?, lever_slug? }` |
| PATCH | /api/companies/:id | Update company (toggle active, change slugs) |
| DELETE | /api/companies/:id | Remove company |

### Stats Response Shape

```json
{
  "total": 47,
  "avg_fit": 81,
  "low_competition": 18,
  "by_source": {
    "greenhouse": 18,
    "lever": 12,
    "indeed": 10,
    "google-jobs": 7,
    "ziprecruiter": 0
  },
  "by_status": {
    "discovered": 22,
    "applied": 14,
    "interview": 6,
    "offer": 1,
    "rejected": 4
  },
  "last_scraped": "2026-03-16T02:00:00Z",
  "new_today": 8
}
```

### Validation

Zod schemas on all mutation endpoints. Shared between frontend and backend — frontend imports them for type-safe API contracts.

### Error Handling

Centralized error middleware returns consistent `{ error: string, details?: any }` with appropriate HTTP status codes.

## Scheduler

node-cron at `0 2 * * *` (2am daily). Runs in the same process as Express.

**Sequence:**
1. Create `scrape_runs` entry (started_at, status pending)
2. API sources in parallel: `fetchGreenhouse()` + `fetchLever()`
3. Launch Playwright browser
4. Run scrapers sequentially: Indeed → Google Jobs → ZipRecruiter
5. Close browser
6. Deduplicate and insert new jobs
7. Score new jobs via Groq
8. Update `scrape_runs` with finished_at, jobs_found, jobs_new, sources_run, final status

## Frontend

### UI Design

Dark analytics aesthetic (Linear/Vercel-inspired):
- Deep dark background (#080b14, #0a0f1e, #0f172a)
- Gradient logo, ambient glow effects
- Score circles with radial gradients and color-coded glow (80-100 indigo, 60-79 amber, 0-59 red)
- Frosted stat badges with colored borders
- Card hover animations (lift + slide)
- Active card with left-edge accent bar and subtle box glow
- Gradient pipeline bar
- Top-glow accent lines on metric cards
- Custom scrollbars, Inter font family

### Components

| Component | Responsibility |
|---|---|
| TopBar.tsx | Logo, stat badges (total/avg fit/low comp/new today), last scraped time, Run Now button |
| JobList.tsx | Filter pills (source/pipeline/competition), search input, scrollable job card list |
| JobCard.tsx | Title, company, location, score circle, competition/recommendation/source tags, posted time, applicant count |
| DetailPanel.tsx | Job header, 4 metric cards, score reason, outreach pitch, description preview with expand, pipeline bar, action buttons, notes |
| Pipeline.tsx | Clickable segmented bar: Discovered → Applied → Interview → Offer |
| OutreachModal.tsx | Draft display with copy-to-clipboard, outreach history |
| StatusBar.tsx | (Integrated into TopBar) Last scraped, source counts, manual trigger |

### Hooks & Data Flow

- **useJobs(filters)** — Fetches `/api/jobs` with reactive query params. Returns `{ jobs, loading, error, refetch, hasMore, loadMore }`. Debounced search (300ms).
- **useStats()** — Fetches `/api/stats`. Auto-refreshes every 60 seconds. Refetches after manual scrape.
- **useJob(id)** — Fetches `/api/jobs/:id` for detail panel. Includes outreach history.
- **Optimistic updates** on pipeline status changes and notes. Revert on error.
- **Axios client** with base URL from `VITE_API_URL`, response interceptor for errors.

### Score Badge Colors

| Range | Color | Hex |
|---|---|---|
| 80-100 | Indigo | #6366f1 / #a5b4fc |
| 60-79 | Amber | #f59e0b / #fcd34d |
| 0-59 | Red | #ef4444 / #fca5a5 |

### Source Tag Colors

| Source | Color |
|---|---|
| Greenhouse | Cyan (#22d3ee) |
| Lever | Amber (#fbbf24) |
| Indeed | Red (#f87171) |
| Google Jobs | Purple (#c084fc) |
| ZipRecruiter | Green (#34d399) |

## Environment Variables

### Backend (.env)

```
GROQ_API_KEY=your_groq_key
DB_PATH=./data/jobgrid.db
PORT=3001
SCRAPE_RADIUS=25
MAX_APPLICANTS=30
DAYS_POSTED=1
NODE_ENV=development
```

### Frontend (.env)

```
VITE_API_URL=http://localhost:3001/api
```

`.env.example` committed with placeholder values. `data/` directory gitignored.

## Build Order

Each step is independently testable before the next depends on it.

1. **Project scaffolding** — pnpm workspace, tsconfigs, package.jsons, Drizzle config, Tailwind + shadcn/ui init
2. **Database schema** — Drizzle schema definitions, generate initial migration, run migration
3. **Company seed** — Seed 10-15 companies with known Greenhouse/Lever slugs
4. **Greenhouse + Lever fetchers** — Test against real APIs, validate JSON parsing and mapping
5. **Groq scorer** — Profile, prompts, batch scorer with hardcoded test job, validate JSON output
6. **Indeed scraper** — Playwright setup, browser manager, delay util, Indeed scraper
7. **Google Jobs + ZipRecruiter scrapers** — Remaining Playwright scrapers
8. **Source orchestrator** — Combine all sources, dedup logic, scrape_runs logging
9. **Express API** — All endpoints, Zod validation, error middleware, CORS
10. **React frontend** — Vite + shadcn/ui setup, dark theme, all components with mock data
11. **Wire frontend to API** — Replace mocks with Axios calls, hooks, optimistic updates
12. **Cron scheduler** — node-cron wired to orchestrator + scorer
13. **End-to-end test** — One full manual run, verify complete pipeline

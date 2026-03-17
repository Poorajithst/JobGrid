# JobGrid

Personal job-discovery platform that pulls listings from multiple sources, scores them against your profile using a two-stage scoring funnel, and presents a ranked dark analytics dashboard with AI-validated outreach drafts.

**How it works:** Upload your resume, set your target roles, and JobGrid handles the rest. It scrapes job boards nightly, fetches full descriptions, scores every job against your profile locally (instant, free), then sends only the top matches to AI for deep validation.

## Features

- **Multi-user** -- Netflix-style profile switching. Each user has their own resume, profiles, and scores.
- **Guided onboarding** -- 6-step wizard: name, upload resume, review extracted skills, set target roles/locations, start searching.
- **5 job sources** -- Greenhouse API, Lever API, Indeed (Playwright), Google Jobs (Playwright), ZipRecruiter (Playwright).
- **Resume parsing** -- Upload resume + LinkedIn PDF. Auto-extracts skills, titles, certifications, experience years, locations.
- **7-dimension scoring engine (IPE)** -- Freshness, skill match, title alignment, cert match, competition, location, experience. Runs locally, scores 500+ jobs in under a second.
- **Two-stage funnel** -- IPE narrows all jobs to top 35, then AI validates and ranks to top 15.
- **AI token caching** -- Profile hash tracks resume/skill changes. AI scores persist until your profile changes.
- **JD enrichment** -- Fetches full job descriptions from original URLs (cheerio + Playwright hybrid).
- **Keyword highlighting** -- Job descriptions highlight your matching skills, certs, and titles.
- **Pipeline tracking** -- Track jobs through Discovered, Applied, Interview, Offer stages.
- **AI outreach drafts** -- Generate personalized connection requests, emails, and InMails.
- **Dark analytics UI** -- Linear/Vercel-inspired dashboard with gradient accents, glowing score indicators, and custom components.

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict mode) |
| Monorepo | pnpm workspaces |
| Backend | Express.js |
| Database | SQLite via Drizzle ORM (Postgres-ready) |
| Scrapers | Playwright (Chromium) |
| JD Enrichment | cheerio + Playwright hybrid |
| NLP | natural (tokenizer, stemmer) |
| AI Scoring | Groq API (LLaMA 3.3 70B) |
| Scheduler | node-cron (2am nightly) |
| Frontend | React 19 + Vite |
| UI | Tailwind CSS v4 + shadcn/ui components |
| Uploads | multer + pdf-parse |

## Prerequisites

- **Node.js** >= 18
- **pnpm** >= 8 (`npm install -g pnpm`)
- **Groq API key** -- free at [console.groq.com](https://console.groq.com)

## Quick Start

```bash
# Clone
git clone https://github.com/Poorajithst/JobGrid.git
cd JobGrid

# Install dependencies
pnpm install

# Install Playwright browsers (for job scraping)
cd packages/backend && npx playwright install chromium && cd ../..

# Set up environment
cp .env.example .env
# Edit .env and add your GROQ_API_KEY

# Set up database
pnpm db:generate
pnpm db:migrate

# Seed target companies (13 Worcester/Boston area companies)
cd packages/backend && pnpm db:seed && cd ../..

# Start backend (port 3001)
cd packages/backend && pnpm start &

# Start frontend (port 5173)
cd packages/frontend && pnpm dev
```

Open **http://localhost:5173** -- the onboarding wizard will guide you through setup.

## Setup Walkthrough

1. **Create your profile** -- Enter your name, pick an avatar color.
2. **Upload your resume** -- Drag-drop your resume PDF. LinkedIn PDF is optional but recommended.
3. **Review extracted data** -- Toggle skills on/off, add missing ones.
4. **Set target roles** -- What job titles are you looking for?
5. **Set target locations** -- Where are you looking? Toggle Remote on/off.
6. **Start finding jobs** -- Profile is created, dashboard is ready.

## Usage

### Daily workflow

1. **Scrape** -- Click "Scrape" or wait for the 2am nightly run. Pulls fresh listings from all 5 sources.
2. **Enrich JDs** -- Click "Enrich JDs" to fetch full descriptions from job URLs. Runs automatically after scraping.
3. **Analytic Score** -- Click "Analytic Score" to run the IPE engine. Scores all jobs instantly and shows your top 35 matches.
4. **AI Score** -- Click "AI Score" to send the top 35 to Groq for deep validation. Shows your best 15 matches with fit assessments, pitches, and red flags.
5. **Apply** -- Click a job to see the full breakdown. Use "Draft Connection Request / Email / InMail" for personalized outreach. Track your pipeline.

### Multiple users

Click your avatar in the top-left to switch users or add a new one. Each user has completely separate documents, profiles, and scores. Jobs are shared -- everyone benefits from the same scrapes.

### Multiple profiles per user

One person can have multiple search profiles targeting different roles. Go to the Profiles tab to create additional profiles with different target titles, skills, and search queries.

## Project Structure

```
JobGrid/
├── packages/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── api/              # Express routes + middleware
│   │   │   │   ├── routes/       # jobs, stats, scrape, outreach, companies,
│   │   │   │   │                 # documents, profiles, score, enrich, users
│   │   │   │   ├── middleware/   # error handler, user context
│   │   │   │   ├── schemas.ts   # Zod validation schemas
│   │   │   │   └── server.ts    # Express app + scrape pipeline
│   │   │   ├── browser/          # Playwright browser manager + delay utility
│   │   │   ├── db/               # Drizzle schema, queries, migrations, seeds
│   │   │   ├── documents/        # PDF parser, profile extractor, skill dictionary
│   │   │   ├── ipe/              # 7-dimension scoring engine
│   │   │   │   ├── freshness.ts
│   │   │   │   ├── skill-match.ts
│   │   │   │   ├── title-align.ts
│   │   │   │   ├── cert-match.ts
│   │   │   │   ├── competition.ts
│   │   │   │   ├── location-match.ts
│   │   │   │   ├── experience.ts
│   │   │   │   └── index.ts      # Orchestrator
│   │   │   ├── scheduler/        # node-cron nightly job
│   │   │   ├── scorer/           # Groq AI client, prompts, batch scorer, profile hash
│   │   │   └── sources/          # Greenhouse, Lever, Indeed, Google Jobs,
│   │   │                         # ZipRecruiter, orchestrator, JD fetcher
│   │   └── data/
│   │       └── skill-dictionary.json  # 125+ terms across 6 categories
│   └── frontend/
│       └── src/
│           ├── api/              # Axios client + TypeScript types
│           ├── components/       # TopBar, JobList, JobCard, DetailPanel,
│           │                     # Pipeline, ScoreBreakdown, DocumentUpload,
│           │                     # ProfileManager, UserSwitcher, OnboardingWizard
│           ├── hooks/            # useJobs, useStats, useJob
│           └── lib/              # Tailwind utilities
├── .env.example
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Environment Variables

Create a `.env` file in the project root:

```bash
# Required
GROQ_API_KEY=your_groq_api_key

# Optional (defaults shown)
DB_PATH=./data/jobgrid.db
PORT=3001
SCRAPE_RADIUS=25          # Miles radius for Indeed/ZipRecruiter
MAX_APPLICANTS=30         # Skip jobs with more applicants
DAYS_POSTED=1             # Max posting age in days
NODE_ENV=development
```

## API Reference

### Jobs
| Method | Route | Description |
|---|---|---|
| GET | /api/jobs | List jobs (supports filters: source, status, competition, minScore, search, profileId, pagination) |
| GET | /api/jobs/:id | Single job with outreach history |
| PATCH | /api/jobs/:id/status | Update pipeline status |
| PATCH | /api/jobs/:id/notes | Update notes |

### Scoring
| Method | Route | Description |
|---|---|---|
| POST | /api/score/ipe/:profileId | Run IPE scoring against a profile |
| POST | /api/score/ai/:profileId | AI validate top matches |
| POST | /api/score/ai/:profileId/:jobId | AI validate single job |

### Documents
| Method | Route | Description |
|---|---|---|
| POST | /api/documents/upload | Upload resume/LinkedIn PDF (multipart form) |
| GET | /api/documents | List uploaded documents |
| DELETE | /api/documents/:id | Delete a document |

### Profiles
| Method | Route | Description |
|---|---|---|
| GET | /api/profiles | List profiles |
| POST | /api/profiles | Create profile |
| PATCH | /api/profiles/:id | Update profile (weights auto-recalculate scores) |
| DELETE | /api/profiles/:id | Delete profile + scores |
| POST | /api/profiles/:id/auto-populate | Auto-fill from uploaded documents |

### Enrichment
| Method | Route | Description |
|---|---|---|
| POST | /api/enrich | Bulk enrich all jobs without descriptions |
| POST | /api/enrich/:jobId | Enrich single job |
| GET | /api/enrich/status | Enrichment progress |

### Other
| Method | Route | Description |
|---|---|---|
| GET | /api/stats | Dashboard aggregates (supports profileId) |
| POST | /api/scrape | Trigger manual scrape |
| GET | /api/scrape/log | Last 10 scrape runs |
| POST | /api/outreach/:id | Generate AI outreach draft |
| GET/POST/PATCH/DELETE | /api/companies | Manage target company list |
| GET/POST/PATCH/DELETE | /api/users | Manage users |

## IPE Scoring Dimensions

The Interview Probability Engine scores each job on 7 research-backed dimensions:

| Dimension | Default Weight | What it measures |
|---|---|---|
| Freshness | 25% | How recently posted (24h = 32% higher callback rate) |
| Skill Match | 25% | Jaccard similarity between your skills and the JD |
| Title Alignment | 15% | How closely the job title matches your targets |
| Certification Match | 10% | Whether the job requires certs you have |
| Competition | 10% | Applicant count (fewer = better odds) |
| Location Match | 10% | Geographic alignment with your preferences |
| Experience | 5% | Years of experience match |

Weights are customizable per profile via sliders in the Profiles tab.

## Scripts

```bash
# Development
pnpm dev:backend          # Start backend with hot reload
pnpm dev:frontend         # Start frontend dev server

# Database
pnpm db:generate          # Generate Drizzle migrations
pnpm db:migrate           # Run migrations
pnpm db:seed              # Seed target companies

# Testing
cd packages/backend && pnpm test       # Run all backend tests
cd packages/backend && pnpm test:watch  # Watch mode

# Production
cd packages/frontend && pnpm build     # Build frontend
cd packages/backend && pnpm start      # Start backend
```

## Adding Target Companies

The system comes pre-seeded with 13 Worcester/Boston area companies. To add more:

```bash
# Via API
curl -X POST http://localhost:3001/api/companies \
  -H 'Content-Type: application/json' \
  -d '{"name": "Company Name", "greenhouseSlug": "company-slug"}'

# Find a company's ATS slug:
# Visit their careers page, look at the job URL
# boards.greenhouse.io/SLUG or jobs.lever.co/SLUG
```

## Customizing the Skill Dictionary

Edit `packages/backend/data/skill-dictionary.json` to add terms relevant to your field. The dictionary has 6 categories: methodologies, tools, technical, certifications, domains, soft_skills.

## License

MIT

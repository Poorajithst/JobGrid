# JobGrid

Personal job-discovery platform that automatically scrapes job boards, scores every listing against your profile, and surfaces only the roles that match you. Clone it, run the setup wizard, and it becomes yours.

**How it works:** Pick your role archetype, upload your resume, and JobGrid handles the rest. It scrapes 5 job sources nightly, fetches full descriptions, scores every job locally with a 7-dimension engine, then sends your top matches to AI for deep validation -- all focused on the roles you want.

## Features

### Core
- **8-step setup wizard** -- Choose your role archetype (PM/TPM, Software Engineer, Data Scientist, or Custom), upload your resume, and the app configures itself around your goals.
- **Role-based dictionary templates** -- Skill dictionaries, scoring weights, title synonyms, and exclude filters pre-tuned for your archetype. Fully customizable after setup.
- **5 job sources** -- Greenhouse API, Lever API, Indeed (Playwright), Google Jobs (Playwright), ZipRecruiter (Playwright).
- **Multi-query scraping** -- Auto-generates search queries from your target titles + synonyms. Up to 8 queries per scrape, with in-loop deduplication.
- **7-dimension scoring engine (IPE)** -- Freshness, skill match, title alignment, cert match, competition, location, experience. Runs locally, scores 500+ jobs in under a second.
- **Two-stage funnel** -- IPE narrows all jobs to your top 35, then AI validates and ranks to your top 15 with fit assessments, pitches, and red flags.
- **Negative title filtering** -- Exclude irrelevant roles (e.g., "Account Manager", "Sales Manager") that pollute keyword searches.
- **Resume parsing** -- Upload resume + LinkedIn PDF. Auto-extracts skills, titles, certifications, experience years, locations.
- **AI outreach drafts** -- Generate personalized connection requests, emails, and InMails.

### Discovery & Growth
- **200+ seed companies** -- Pre-loaded with verified Greenhouse, Lever, and Ashby ATS slugs across tech, finance, healthcare, consulting, and more.
- **AI company discovery** -- Groq suggests companies hiring for your target roles. ATS slug probing validates them automatically.
- **Weekly discovery cron** -- Autonomous company discovery runs every Sunday at 4 AM. New companies are auto-added and included in future scrapes.
- **On-demand discovery** -- "Discover More" button lets you trigger discovery manually and review candidates before adding.

### Personal-First, Open-Source Ready
- **Zero personal data in the repo** -- Your database, resume, API keys, and uploads are all gitignored. Push to GitHub with confidence.
- **Config export/import** -- Export your full setup as a JSON file. Share it, back it up, or bootstrap a new instance instantly.
- **Existing DB migration** -- Upgrading? The app auto-detects existing databases and backfills the new dictionary and company data.

### Dashboard & UI
- **Dark analytics UI** -- Linear/Vercel-inspired dashboard with gradient accents and custom components.
- **My Skills page** -- Manage your skill dictionary with source badges (template / resume / manual / AI-discovered).
- **Company management** -- View all companies with source badges, toggle active/inactive, discover new ones.
- **Pipeline tracking** -- Track jobs through Discovered, Applied, Interview, Offer stages.
- **Keyword highlighting** -- Job descriptions highlight your matching skills, certs, and titles.
- **Multi-user** -- Netflix-style profile switching. Each user has their own resume, profiles, and scores.

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict mode) |
| Monorepo | pnpm workspaces |
| Backend | Express.js |
| Database | SQLite via Drizzle ORM |
| Scrapers | Playwright (Chromium) |
| JD Enrichment | cheerio + Playwright hybrid |
| NLP | natural (tokenizer, stemmer) |
| AI | Groq API (LLaMA 3.3 70B) |
| Scheduler | node-cron (nightly scrape + weekly discovery) |
| Frontend | React 19 + Vite |
| UI | Tailwind CSS v4 |
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
cd packages/backend && pnpm db:migrate && cd ../..

# Start backend (port 3001)
cd packages/backend && pnpm start &

# Start frontend (port 5173)
cd packages/frontend && pnpm dev
```

Open **http://localhost:5173** -- the setup wizard launches automatically on first run.

## Setup Wizard

On first run (empty database), the app gates all routes behind a setup wizard:

1. **Name & Avatar** -- Create your identity. Or click "Import Config" to load an exported config file.
2. **Role Archetype** -- Pick PM/TPM, Software Engineer, Data Scientist, or Custom. This loads a tuned skill dictionary, scoring weights, default titles, synonyms, and exclude filters.
3. **Upload Resume** -- Drag-drop your resume PDF (optional). LinkedIn PDF also supported. Skills and experience are auto-extracted.
4. **Review Skills** -- See the merged skill list (template + resume). Toggle terms on/off, add new ones by category.
5. **Target Titles** -- Edit your target job titles, manage synonyms per title, and set negative title filters.
6. **Locations & Remote** -- Set target locations and remote preference.
7. **Company Seed** -- 200+ companies with ATS slugs are auto-loaded. Review and disable any you don't want.
8. **Start Scanning** -- Trigger your first job scrape and you're live.

## Usage

### Daily Workflow

1. **Scrape** -- Click "Scrape" or wait for the 2 AM nightly run. Pulls fresh listings from all 5 sources using your search queries.
2. **Enrich JDs** -- Click "Enrich JDs" to fetch full descriptions. Runs automatically after scraping.
3. **Analytic Score** -- Click "Analytic Score" to run the IPE engine. Scores all jobs instantly and shows your top 35.
4. **AI Score** -- Click "AI Score" to send the top 35 to Groq. Shows your best 15 with fit assessments, pitches, and red flags.
5. **Apply** -- Click a job to see the full breakdown. Generate personalized outreach. Track your pipeline.

### Managing Your Skills

Go to Settings > My Skills to see all dictionary terms grouped by category. Each term shows its source:
- **Template** (gray) -- From your archetype template
- **Resume** (blue) -- Extracted from your uploaded documents
- **Manual** (green) -- Added by you
- **AI-Discovered** (purple) -- Found by AI in job descriptions

Add, remove, or reset to your archetype's defaults at any time.

### Discovering Companies

Go to Settings > Companies to see all tracked companies with source badges. Click "Discover More" to:
1. AI suggests companies hiring for your target roles in your target locations
2. Each suggestion is probed against Greenhouse, Lever, and Ashby APIs
3. Only companies with valid ATS boards are shown
4. Review and add the ones you want

The weekly cron (4 AM Sunday) does this automatically.

### Config Export & Import

- **Export** -- `GET /api/config/export` or from Settings. Downloads your full configuration (archetype, titles, skills, weights, custom companies) as a JSON file. No resume text, scores, or API keys are included.
- **Import** -- Upload a config JSON during setup (step 1) or from Settings. Pre-fills all wizard steps.

### Multiple Users & Profiles

- Click your avatar to switch users or add new ones
- Each user has separate documents, profiles, skills, and scores
- One user can have multiple profiles targeting different roles
- Jobs are shared across all users

## Project Structure

```
JobGrid/
├── packages/
│   ├── backend/
│   │   └── src/
│   │       ├── api/              # Express routes + middleware
│   │       │   ├── routes/       # jobs, stats, scrape, outreach, companies,
│   │       │   │                 # documents, profiles, score, enrich, users,
│   │       │   │                 # setup, config
│   │       │   └── middleware/   # error handler, user context, bootstrap gate
│   │       ├── browser/          # Playwright browser manager
│   │       ├── db/               # Drizzle schema, queries, migrations, bootstrap
│   │       ├── documents/        # PDF parser, profile extractor, skill dictionary
│   │       ├── ipe/              # 7-dimension scoring engine
│   │       ├── scheduler/        # node-cron (nightly scrape + weekly discovery)
│   │       ├── scorer/           # Groq AI client, prompts, batch scorer
│   │       └── sources/          # Greenhouse, Lever, Indeed, Google Jobs,
│   │                             # ZipRecruiter, company discovery, JD fetcher
│   └── frontend/
│       └── src/
│           ├── api/              # Axios client + TypeScript types
│           ├── components/       # Dashboard components
│           ├── pages/            # Setup wizard, Settings (Skills)
│           └── hooks/            # useJobs, useStats, useJob
├── data/
│   └── seed/
│       ├── companies.json        # 200+ companies with ATS slugs
│       └── dictionaries/         # Role-based skill templates
│           ├── pm-tpm.json
│           ├── software-engineer.json
│           ├── data-scientist.json
│           └── default.json
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

### Setup & Config
| Method | Route | Description |
|---|---|---|
| POST | /api/setup/user | Create user (step 1) |
| POST | /api/setup/archetype | Set role archetype + load dictionary (step 2) |
| POST | /api/setup/documents | Upload resume/LinkedIn PDF (step 3) |
| POST | /api/setup/skills | Add/remove dictionary terms (step 4) |
| GET | /api/setup/skills | Get dictionary terms for user |
| POST | /api/setup/profile | Set titles, synonyms, excludes, locations (step 5-6) |
| POST | /api/setup/companies | Load seed companies (step 7) |
| POST | /api/setup/complete | Finalize setup (step 8) |
| GET | /api/config/export | Export user config as JSON |
| POST | /api/config/import | Validate config JSON |
| POST | /api/config/import/confirm | Apply imported config |

### Jobs
| Method | Route | Description |
|---|---|---|
| GET | /api/jobs | List jobs (filters: source, status, minScore, search, profileId, scoreTier) |
| GET | /api/jobs/:id | Single job with outreach history |
| PATCH | /api/jobs/:id/status | Update pipeline status |
| PATCH | /api/jobs/:id/notes | Update notes |

### Scoring
| Method | Route | Description |
|---|---|---|
| POST | /api/score/ipe/:profileId | Run IPE scoring (?force=true to re-score all) |
| POST | /api/score/ai/:profileId | AI validate top matches |
| POST | /api/score/ai/:profileId/:jobId | AI validate single job |

### Documents & Profiles
| Method | Route | Description |
|---|---|---|
| POST | /api/documents/upload | Upload resume/LinkedIn PDF |
| GET | /api/documents | List uploaded documents |
| DELETE | /api/documents/:id | Delete a document |
| GET | /api/profiles | List profiles |
| POST | /api/profiles | Create profile |
| PATCH | /api/profiles/:id | Update profile |
| DELETE | /api/profiles/:id | Delete profile + scores |

### Scraping & Discovery
| Method | Route | Description |
|---|---|---|
| POST | /api/scrape | Trigger manual scrape |
| GET | /api/scrape/log | Last 10 scrape runs |
| POST | /api/enrich | Bulk enrich all jobs without descriptions |
| GET | /api/enrich/status | Enrichment progress |
| POST | /api/companies/discover | AI-assisted company discovery (returns candidates) |
| POST | /api/companies/discover/confirm | Add discovered companies |
| GET/POST/PATCH/DELETE | /api/companies | Manage company list |

### Other
| Method | Route | Description |
|---|---|---|
| GET | /api/stats | Dashboard aggregates |
| POST | /api/outreach/:id | Generate AI outreach draft |
| GET/POST/PATCH/DELETE | /api/users | Manage users |

## IPE Scoring Dimensions

| Dimension | PM/TPM Weight | SWE Weight | What it measures |
|---|---|---|---|
| Freshness | 20% | 20% | How recently posted (24h = 32% higher callback rate) |
| Skill Match | 25% | 30% | Jaccard similarity between your skills and the JD |
| Title Alignment | 25% | 15% | Title match with synonym expansion + exclude filtering |
| Certification Match | 5% | 5% | Whether the job requires certs you have |
| Competition | 10% | 10% | Applicant count (fewer = better odds) |
| Location Match | 10% | 10% | Geographic alignment with your preferences |
| Experience | 5% | 10% | Years of experience match |

Weights are customizable per profile. Each archetype ships with tuned defaults.

## Scripts

```bash
# Development
cd packages/backend && pnpm dev      # Backend with hot reload
cd packages/frontend && pnpm dev     # Frontend dev server

# Database
cd packages/backend
pnpm db:generate                     # Generate Drizzle migrations
pnpm db:migrate                      # Run migrations

# Testing
cd packages/backend && pnpm test     # Run all backend tests (162 tests)
cd packages/backend && pnpm test:watch

# Production
cd packages/frontend && pnpm build   # Build frontend
cd packages/backend && pnpm start    # Start backend
```

## Customizing

### Adding Companies

The setup wizard loads 200+ companies. To add more:

```bash
# Via API
curl -X POST http://localhost:3001/api/companies \
  -H 'Content-Type: application/json' \
  -d '{"name": "Company Name", "greenhouseSlug": "company-slug"}'

# Via AI Discovery
# Click "Discover More" in Settings > Companies
# Or POST /api/companies/discover
```

### Creating Dictionary Templates

Add a new JSON file to `data/seed/dictionaries/` following the template format:

```json
{
  "id": "your-role",
  "label": "Your Role Title",
  "weights": { "freshness": 0.20, "skill": 0.25, "title": 0.20, "cert": 0.05, "competition": 0.10, "location": 0.10, "experience": 0.10 },
  "defaultTitles": ["Your Target Title"],
  "defaultSynonyms": { "your target title": ["Synonym 1", "Synonym 2"] },
  "defaultExcludes": ["Irrelevant Title"],
  "methodologies": [],
  "tools": [],
  "technical": [],
  "certifications": [],
  "domains": [],
  "soft_skills": []
}
```

## License

MIT

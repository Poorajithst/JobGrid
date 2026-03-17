# JD Enrichment, Two-Stage Scoring Funnel & Multi-User

Adds job description fetching, a two-stage scoring funnel (IPE → AI), Netflix-style multi-user support, and a guided first-time setup experience. Makes the platform role-agnostic — works for any profession.

## Overview

```
New user arrives
  → Guided setup: name → upload resume → review extracted data → confirm profile
    → Scraper uses profile's target titles/locations as search queries
      → JD Enrichment: fetch full descriptions from job URLs
        → Analytic Score (IPE): scores all → keeps top 35
          → AI Score (Groq): validates 35 → ranks → shows top 15
            → User's personalized dashboard
```

## Multi-User System

Netflix-style user switching. No passwords, no auth — just profile selection.

### `users` table

| Column | Type | Notes |
|---|---|---|
| id | integer, PK | |
| name | text, not null | Display name |
| avatarColor | text, not null | Hex color for avatar circle (auto-assigned or picked) |
| createdAt | text, default now | |

### Data ownership

| Table | Ownership | Rationale |
|---|---|---|
| users | — | Top-level entity |
| documents | user_id FK | Each user uploads their own resume |
| profiles | user_id FK | Each user has their own search profiles |
| job_scores | (via profile.user_id) | Scores are per-profile, profiles are per-user |
| outreach | user_id FK | Outreach drafts are personalized |
| jobs | SHARED | Everyone benefits from the same scrape |
| companies | SHARED | Shared target company list |
| scrape_runs | SHARED | Shared scrape history |

### User switching

- App header shows colored avatar circle + name
- Click to open user switcher dropdown
- "Add User" option at bottom of dropdown
- All API calls include `userId` query param or `X-User-Id` header
- No sessions, no cookies — stateless, local tool

### Add `user_id` columns

- `documents.user_id` — integer, FK → users.id, not null
- `profiles.user_id` — integer, FK → users.id, not null
- `outreach.user_id` — integer, FK → users.id, not null

### Migration strategy for user_id columns

Existing rows in `documents`, `profiles`, `outreach` need a user_id. Migration steps:
1. Create `users` table
2. Insert a default user: `{ name: 'Default User', avatarColor: '#6366f1' }` → id=1
3. Add `user_id` columns as nullable first (ALTER TABLE via Drizzle migration)
4. Backfill all existing rows with `user_id = 1`
5. Set columns to NOT NULL via subsequent migration
6. Add FK constraints

### userId API middleware

Create `middleware/user-context.ts` — extracts `userId` from `X-User-Id` header (preferred) or `userId` query param. Falls back to userId=1 if missing (backward compatible during rollout). Attaches `req.userId` for all downstream routes. All user-scoped routes use `req.userId` for filtering.

## First-Time Setup (Onboarding Wizard)

Triggered when a user has no profiles yet. A multi-step guided flow:

### Step 1: Welcome
- "Welcome to JobGrid" — enter your name, pick avatar color
- Creates user record

### Step 2: Upload Resume
- Drag-drop resume PDF
- LinkedIn PDF optional (can skip, add later)
- Reuses existing `POST /api/documents/upload` endpoint (from IPE spec) — no duplicate extraction logic
- System extracts: skills, titles, certs, experience years, locations, tools, industries

### Step 3: Review Extracted Data
- Shows extracted skills as toggleable tags (on/off)
- Shows extracted titles — user can add/remove
- Shows certs, locations — editable
- "These will be used to find and score jobs for you"

### Step 4: Target Roles
- Pre-populated from extracted titles
- User adds target job titles: e.g., "Finance Manager", "Budget Analyst"
- Can add title synonyms

### Step 5: Target Locations
- Pre-populated from extracted locations
- Add/remove locations, toggle "Remote" on/off
- Set search radius preference

### Step 6: Confirmation
- Summary of profile: "Looking for [titles] in [locations] with [N] skills"
- Search queries auto-generated from titles × locations
- "Start Finding Jobs" button → creates profile, redirects to dashboard

### Post-setup
- Profile accessible via Settings icon / edit button
- Can re-upload resume anytime (triggers re-extraction + hash change)
- Can create additional profiles (same user, different role targets)

## JD Enrichment

### Problem
Greenhouse/Lever APIs return job titles and links but NOT full descriptions. Without descriptions, IPE skill matching (25% weight) scores against empty text.

### Solution: Hybrid Fetcher

```
For each job with NULL description:
  1. HTTP GET the job URL + parse with cheerio (fast, ~0.5s)
  2. If extracted text < 100 chars → fall back to Playwright (slower, ~3-5s)
  3. Store description in jobs.description column
```

### Description Fetcher (`sources/description-fetcher.ts`)

**HTTP-first approach:**
- `fetch()` the job URL, get HTML
- Parse with `cheerio` — try selectors in order:
  - Greenhouse: `#content .body`, `.job-post-content`, `[data-mapped="true"]`
  - Lever: `.posting-page .content`, `[data-qa="job-description"]`, `.section-wrapper`
  - Generic: `.job-description`, `.description`, `article`, `main`
- If extracted text ≥ 100 chars → done

**Playwright fallback:**
- Launch page via existing browser infrastructure
- Same selector priority
- If still nothing, extract `document.body.innerText` (cap at 5000 chars)

### Enrichment Endpoint

`POST /api/enrich` — starts background enrichment of all null-description jobs. Returns `{ running: true }`.

`GET /api/enrich/status` — returns `{ total: 587, enriched: 342, pending: 245, running: boolean }`.

`POST /api/enrich/:jobId` — enriches a single job's description. Used by the "Fetch Description" button in DetailPanel.

Route file: `packages/backend/src/api/routes/enrich.ts` — mounted as `app.use('/api/enrich', createEnrichRouter(queries))`.

### Auto-trigger
- After each scrape completes, auto-trigger enrichment for new jobs
- Frontend shows enrichment progress bar in TopBar when running

### New dependency
- `cheerio` — fast HTML parser for HTTP-first approach (~200KB)

## Two-Stage Scoring Funnel

### Flow

```
All jobs (with descriptions)
  ┌─── "Analytic Score" button ───────────────────┐
  │  IPE scores all jobs against active profile    │
  │  Filters to top N (profile.analytic_top_n)     │
  │  Dashboard shows: "35 matches from 587 jobs"   │
  │  Instant, free, no tokens                      │
  └───────────────────────────────────────────────┘
        │
        ▼
  ┌─── "AI Score" button ─────────────────────────┐
  │  Takes top analytic_top_n jobs                 │
  │  Sends each to Groq with full profile context  │
  │  AI validates, writes pitch, flags concerns    │
  │  Ranks → shows top ai_top_n (default 15)       │
  │  Results cached via profile hash               │
  └───────────────────────────────────────────────┘
```

### Analytic Score Button
- Calls `POST /api/score/ipe/:profileId`
- Scores ALL jobs with non-null descriptions against the user's active profile
- After scoring, auto-filters job list to top `analytic_top_n` (default 35)
- TopBar status: "35 matches from 587 jobs"
- Button state: disabled while scoring, shows count when done

### AI Score Button
- Only enabled after Analytic Score has run (job_scores exist)
- Calls `POST /api/score/ai/:profileId`
- Takes top `analytic_top_n` jobs by IPE score
- For each job, sends to Groq:
  - System prompt: full user profile (resume text + skills + certs + experience)
  - User prompt: job description + IPE score breakdown + matched skills
  - Response format: JSON with `agrees`, `fit_assessment`, `pitch`, `flags`
- Stores results in `job_scores.ai_*` columns
- After completion, auto-filters to top `ai_top_n` (default 15)
- TopBar status: "15 best matches (AI validated)"

### Profile configuration

Add to `profiles` table:

| Column | Type | Notes |
|---|---|---|
| analytic_top_n | integer, not null, default 35 | How many pass IPE filter (replaces `ai_threshold` score cutoff — count-based is more predictable) |
| ai_top_n | integer, not null, default 15 | How many AI shows as final |
| profile_hash | text, nullable | SHA-256 for AI token cache |

**Note:** `ai_threshold` (from IPE spec, score-based cutoff) is replaced by `analytic_top_n` (count-based cutoff). Drop `ai_threshold` column in the same migration that adds these columns. Count-based is more user-friendly ("show me top 35") than score-based ("show me jobs above 60").

### AI Token Caching

**Hash computation:** SHA-256 of concatenated: all document raw texts for this user + profile target skills + profile target certs + profile target titles.

**Cache logic:**
1. Before AI scoring, compute current hash from user's documents + profile
2. Compare with `profile.profile_hash`
3. If hash matches AND job already has `ai_validated=true` → skip (no tokens)
4. If hash changed → set new hash, clear all `ai_validated` flags for this profile
5. "AI Score" button always re-validates jobs where `ai_validated=false`

**Invalidation triggers:**
- Resume re-uploaded → hash changes → all AI scores cleared
- Profile skills/titles/certs edited → hash changes → all AI scores cleared
- New jobs scraped → they have `ai_validated=false` by default → will be scored on next AI run

### AI Scoring Prompt

```
System: You are a job fit analyzer for a job seeker.

Candidate Profile:
Name: {user.name}
Resume Summary: {first 3000 chars of resume raw text}
Target Roles: {profile.target_titles}
Key Skills: {profile.target_skills}
Certifications: {profile.target_certs}
Experience: {profile experience years} years
Locations: {profile.target_locations}

Your job is to evaluate job postings against this candidate and determine fit.

User: Evaluate this job:

Title: {job.title}
Company: {job.company}
Location: {job.location}
Description: {first 2000 chars of job.description}

IPE Score: {ipe_score}/100
Score Breakdown:
- Skill Match: {skill_match_score} (matched: {matched_skills})
- Title Alignment: {title_alignment_score}
- Freshness: {freshness_score}
- Competition: {competition_score}
- Location: {location_match_score}
- Certifications: {cert_match_score}
- Experience: {experience_align_score}

Return JSON only:
{
  "agrees": true/false (do you agree with the IPE score assessment?),
  "fit_assessment": "one paragraph explaining the fit, highlighting strengths and gaps",
  "pitch": "two sentence personalized outreach hook for this specific job",
  "flags": "any red flags, hidden requirements, or concerns — null if none"
}
```

Zod validation on response. On parse failure, retry once. On second failure, mark job as `ai_validated=true, ai_agrees=null` (failed validation, don't waste more tokens).

**Schema addition:** Add `ai_fit_assessment` column (text, nullable) to `job_scores` table to store the `fit_assessment` paragraph from the AI response.

Batch processing: score sequentially with 1s pause between jobs. On 429 rate limit, exponential backoff (existing retry logic in groq.ts).

## DetailPanel: JD Viewer with Highlights

### Description Display
- Full job description text with keyword highlighting:
  - Profile skills found in description → indigo highlight
  - Profile certs found → amber highlight
  - Target titles found → cyan highlight
- Collapsible with "Show more" / "Show less" (default: first 500 chars)
- If description is null: "No description available. Click to fetch." button

### Score Section
- 7-bar horizontal IPE breakdown (existing ScoreBreakdown component)
- Below: matched skills as tag pills

### AI Section (when validated)
- "AI Assessment" card with:
  - Agree/disagree badge (green checkmark or yellow warning)
  - Fit assessment paragraph
  - Outreach pitch in italic indigo
  - Red flags in a warning-styled box (if any)
- If not yet validated: "Validate with AI" button for individual job

## Frontend Changes

### New Components

**UserSwitcher** — avatar circle in top-left, dropdown with all users, "Add User" option.

**OnboardingWizard** — multi-step form: name → upload → review → titles → locations → confirm. Full-screen overlay, appears on first visit or when user has no profiles.

### Modified Components

**TopBar** (replaces existing buttons):
- Old "Run Now" → renamed "Scrape" (triggers job scraping)
- Old "Score Now" → renamed "Analytic Score" (runs IPE)
- Old "AI Validate Top" → renamed "AI Score" (runs Groq on top N)
- New "Enrich JDs" button added

Layout:
- Left: UserSwitcher avatar + profile dropdown
- Center: stat badges (adapt to scoring stage)
- Right: [Scrape] [Enrich JDs] [Analytic Score] [AI Score] buttons with states:
  - Enrich: shows progress bar when running, "Enrich JDs (245 pending)" when idle
  - Analytic Score: "Score" when ready, "Scoring..." when running, "35 matches" when done
  - AI Score: disabled until Analytic done, "AI Score" when ready, "Validating 12/35..." when running, "15 best" when done

**App.tsx:**
- Stores `activeUserId` in state (persisted to localStorage)
- On load: if no users exist → show OnboardingWizard
- If user exists but no profiles → show OnboardingWizard step 2+
- All API calls include userId

### Navigation
- Dashboard (main view)
- Documents (upload/manage)
- Profiles (manage multiple profiles per user)
- Settings (user management)

## API Changes

### New Endpoints

| Method | Route | Description |
|---|---|---|
| GET | /api/users | List all users |
| POST | /api/users | Create user. Body: `{ name, avatarColor }` |
| PATCH | /api/users/:id | Update user name/color |
| DELETE | /api/users/:id | Delete user + cascade documents/profiles/scores/outreach |
| POST | /api/enrich | Start background JD enrichment for null-description jobs |
| GET | /api/enrich/status | Enrichment progress: total, enriched, pending, running |

### Modified Endpoints

All existing user-scoped endpoints add `userId` filtering:

| Route | Change |
|---|---|
| GET/POST /api/documents | Scoped by userId query param |
| GET/POST/PATCH/DELETE /api/profiles | Scoped by userId |
| POST /api/score/ipe/:profileId | Verify profile belongs to userId |
| POST /api/score/ai/:profileId | Uses user's documents for profile hash + Groq context |
| GET /api/jobs | Scoped by user's active profile when profileId set |
| POST /api/outreach/:id | Scoped by userId |

## New Dependencies

| Package | Purpose |
|---|---|
| `cheerio` | Fast HTML parsing for HTTP-first JD extraction |

## Remove Hardcoded Profile

Delete `packages/backend/src/scorer/profile.ts` — the `PM_PROFILE` constant is replaced entirely by database-driven profiles. Update all imports that reference it to use profile data from the database instead.

## Additional API Endpoints

- `POST /api/score/ai/:profileId/:jobId` — AI validate a single job (for "Validate with AI" button in DetailPanel)

## Build Order

1. **Users table + CRUD + userId middleware** — foundation for multi-user
2. **Add user_id to documents/profiles/outreach** — migration with backfill to default user
3. **Rewrite prompts.ts** — remove hardcoded PM_PROFILE dependency, accept dynamic profile data. Delete `scorer/profile.ts`. This must happen before AI Score (step 7) since the AI prompt uses profile data.
4. **Add analytic_top_n/ai_top_n/profile_hash columns** — migration, drop ai_threshold, add ai_fit_assessment to job_scores
5. **JD enrichment** — cheerio + Playwright hybrid fetcher, route file, single-job + batch endpoints, auto-trigger after scrape
6. **User switcher + onboarding wizard UI** — frontend multi-step setup flow, reuses existing document upload endpoint
7. **Analytic Score button** — IPE scoring with auto-filter to top N
8. **AI Score with caching** — Groq validation with new dynamic prompt, profile hash, token caching, per-job endpoint
9. **DetailPanel JD viewer** — description with keyword highlights, AI assessment display, fetch/validate buttons
10. **TopBar button states + enrichment progress** — rename buttons, progress indicators, enable/disable logic
11. **Navigation + settings** — Dashboard/Documents/Profiles/Settings tabs, user management

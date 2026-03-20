# JobGrid: Personal-First Open-Source Architecture

**Date:** 2026-03-19
**Status:** Draft
**Author:** Brainstorming session

---

## 1. Problem Statement

JobGrid is a personal job discovery tool built for a specific user targeting Technical Project Manager, Technical Program Manager, and Product Manager roles. However, the codebase has personal data embedded in committed files:

- `seed.ts` contains 13 hardcoded Worcester/Boston area companies
- `skill-dictionary.json` is tuned for PM/TPM roles but shipped as a generic file
- No mechanism exists for new users to bootstrap their own configuration
- No separation between "the tool" (open source) and "my setup" (personal)

The tool needs to be restructured so that:
1. When the owner uses it locally, it is laser-focused on their target roles — every scrape, score, and suggestion serves their job search
2. When pushed to GitHub, zero personal data is included
3. When someone else clones it, they go through their own setup and the tool becomes laser-focused on THEIR goals

---

## 2. Architecture Decision: Database-Only with Bootstrap Migration

All personal data lives in SQLite (already gitignored via `*.db`). The repo ships generic seed files in `data/seed/`. On first run (empty DB), the app bootstraps from seed files and the user's input via a setup wizard. No config file sprawl — the DB is the single source of truth.

### 2.1 Gitignore Boundary

**Critical:** The current `.gitignore` has a blanket `data/` rule which would block `data/seed/` from being committed. This MUST be changed to specific entries.

**New `.gitignore` rules (replacing `data/`):**

```gitignore
# Database (personal)
*.db
*.db-journal

# Uploads (personal)
data/uploads/

# Keep data/seed/ committed (generic templates + company list)
# !data/seed/ is implicitly allowed by not ignoring it
```

**Committed to repo (public, open-source):**

```
packages/                          # All application code
data/seed/
  companies.json                   # 300+ companies with ATS slugs (generic)
  dictionaries/
    pm-tpm.json                    # PM/TPM/Product Manager template
    software-engineer.json         # SWE template
    data-scientist.json            # Data science template
    default.json                   # Minimal generic baseline
.env.example                       # Blank env template
.gitignore
```

**Gitignored (never pushed):**

```
data/jobgrid.db                    # *.db rule
data/uploads/                      # Explicit rule
.env                               # Already ignored
```

### 2.2 Changes from Current State

- Replace `data/` in `.gitignore` with `*.db`, `*.db-journal`, and `data/uploads/`
- Delete `packages/backend/src/db/seed.ts` (hardcoded 13 companies)
- Move `packages/backend/data/skill-dictionary.json` to `data/seed/dictionaries/pm-tpm.json`
- Create additional dictionary templates

---

## 3. First-Run Bootstrap Flow

### 3.1 Detection

On server startup, query `SELECT COUNT(*) FROM users`. If 0, the app is in bootstrap mode.

### 3.2 Bootstrap Middleware

New middleware `packages/backend/src/api/middleware/bootstrap.ts`. When bootstrap mode is active, all API routes under `/api/*` return HTTP `412 Precondition Failed` with body `{ error: "setup_required" }`, **except:**

- `/api/setup/*` — setup wizard endpoints
- `/api/config/import` — config import
- Non-API routes (static assets, frontend bundle) — never blocked

The middleware checks a cached `isBootstrapped` flag (refreshed on user creation) to avoid querying on every request.

### 3.3 Frontend Redirect

When the frontend receives a 412, it redirects to `/setup`.

### 3.4 Setup Wizard (8 steps)

Replaces the current 6-step onboarding wizard entirely.

| Step | Action | Data Written |
|------|--------|-------------|
| 1. Welcome + Name/Avatar | Create user identity. "Import Config" button as alternative entry. | `users` row |
| 2. Choose Role Archetype | Pick template: PM/TPM, Software Engineer, Data Scientist, Custom | `profiles.archetype` set |
| 3. Upload Resume + LinkedIn PDF | Same as today, optional | `documents` rows, parsed data extracted |
| 4. Review & Customize Skills | Merged list: template + resume-extracted. User adds/removes. | `user_dictionary` rows, `profiles.target_skills`, `profiles.target_certs` |
| 5. Target Titles + Synonyms + Excludes | Pre-filled from archetype. User edits. Auto-generates `searchQueries` from titles + synonyms. | `profiles.target_titles`, `profiles.title_synonyms`, `profiles.exclude_titles`, `profiles.search_queries` |
| 6. Target Locations + Remote | Same as today | `profiles.target_locations`, `profiles.remote_preference` |
| 7. Company Seed | Auto-loads `data/seed/companies.json`. Shows count. User can review/disable. | `companies` rows |
| 8. Config Complete | "Start your first job scan?" → triggers first scrape | Scrape kicks off |

### 3.5 Setup API Endpoints

```typescript
POST /api/setup/user
  Body: { name: string, avatarColor: string }
  Returns: { userId: number }
  Creates the user row. Idempotent within a session (returns existing if called again).

POST /api/setup/archetype
  Body: { archetype: string }  // "pm-tpm" | "software-engineer" | "data-scientist" | "custom"
  Returns: { profileId: number, template: DictionaryTemplate }
  Creates the profile with archetype defaults (weights, titles, synonyms, excludes).
  Loads template terms into user_dictionary.

POST /api/setup/documents
  Multipart form: file (PDF), type ("resume" | "linkedin")
  Returns: { documentId: number, extracted: ExtractedProfile }
  Same as current upload endpoint.

POST /api/setup/skills
  Body: { add: { category: string, term: string }[], remove: { category: string, term: string }[] }
  Returns: { totalTerms: number }
  Modifies user_dictionary. Removed template terms get deleted; added terms get source='manual'.

POST /api/setup/profile
  Body: { targetTitles, titleSynonyms, excludeTitles, targetLocations, remotePreference, searchQueries? }
  Returns: { profileId: number, generatedQueries: string[] }
  If searchQueries not provided, auto-generates from titles + synonyms.

POST /api/setup/companies
  Body: { disabledIds?: number[] }  // Companies to deactivate from the seed load
  Returns: { activeCount: number, totalCount: number }
  Loads seed companies (if not already loaded), then deactivates specified ones.

POST /api/setup/complete
  Body: { triggerScrape: boolean }
  Returns: { success: true }
  Marks setup as complete. Optionally triggers first scrape.
```

All steps are idempotent — user can go back and redo any step. Each step updates existing rows rather than creating duplicates.

### 3.6 Config Import as Alternative

At step 1, "Import Config" uploads a `JobGridConfig` JSON file that pre-fills steps 2-7. The import flow:

1. Validate JSON against `JobGridConfig` Zod schema
2. Load the archetype's template dictionary, then merge `customDictionary` entries on top
3. Create user, profile, dictionary rows, and companies
4. Return the complete setup state so the UI can show pre-filled review screens
5. User confirms at step 8

---

## 4. Skill Dictionary Architecture

### 4.1 Two-Layer System

**Layer 1 — Seed Templates (committed, read-only)**

Files in `data/seed/dictionaries/`. Each template:

```typescript
interface DictionaryTemplate {
  id: string;                    // "pm-tpm"
  label: string;                 // "Project/Program/Product Manager"
  weights: {                     // Default scoring weights for this archetype
    freshness: number;
    skill: number;
    title: number;
    cert: number;
    competition: number;
    location: number;
    experience: number;
  };
  defaultTitles: string[];       // Pre-filled target titles
  defaultSynonyms: Record<string, string[]>;  // Keys are lowercased for normalization
  defaultExcludes: string[];     // Negative title filter
  methodologies: string[];
  tools: string[];
  technical: string[];
  certifications: string[];
  domains: string[];
  soft_skills: string[];
}
```

**Synonym normalization contract:** All synonym map keys are stored and looked up in **lowercase**. Both the template's `defaultSynonyms` and the profile's `titleSynonyms` use lowercase keys. When `title-align.ts` performs a synonym lookup, it lowercases the input before checking the map. This eliminates case-mismatch bugs.

**Layer 2 — User Dictionary (in DB, personal)**

New `user_dictionary` table. Terms sourced from template, resume extraction, manual edits, and AI discovery at runtime.

### 4.2 Schema: `user_dictionary` Table

```sql
CREATE TABLE user_dictionary (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  category    TEXT NOT NULL,  -- "methodologies"|"tools"|"technical"|"certifications"|"domains"|"soft_skills"
  term        TEXT NOT NULL,
  source      TEXT NOT NULL,  -- "template"|"resume"|"manual"|"ai-discovered"
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, category, term)
);

CREATE INDEX idx_user_dictionary_user ON user_dictionary(user_id);
```

### 4.3 Hydration Flow

1. User picks archetype → all terms from template inserted with `source = 'template'`
2. Resume parsed → new extracted terms inserted with `source = 'resume'`
3. User manually adds/removes in wizard → `source = 'manual'`
4. Runtime: Groq identifies new relevant skills in job descriptions → `source = 'ai-discovered'`

### 4.4 Code Changes

- `dictionary.ts`: `loadDictionary(userId)` reads from `user_dictionary` table grouped by category. Same return shape (`SkillDictionary`). **If no rows exist for the user, this indicates a corrupt state (setup ran but dictionary is empty). The function logs an error and triggers bootstrap mode rather than silently falling back to a file.** During the setup wizard (before dictionary rows exist), the extractor uses the selected template file directly.
- `extractor.ts`: No change — calls `getAllTerms()` as before.
- `skill-match.ts`: No change — calls `getAllTerms()` as before.

### 4.5 UI

New "My Skills" settings page. Shows all terms grouped by category with source badges (template / resume / manual / ai-discovered). Add/remove individual terms. "Reset to template" option (reloads archetype template, preserving resume and manual terms).

---

## 5. Autonomous Company Discovery

### 5.1 Layer 1 — Large Seed List (committed)

`data/seed/companies.json` — 300+ companies with verified ATS slugs. Generic across all roles. Structure:

```typescript
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
```

Loaded into `companies` table during bootstrap step 7. Every user gets the full list.

### 5.2 Layer 2 — ATS Slug Probing

New module `packages/backend/src/sources/discovery.ts`.

```typescript
async function probeCompany(name: string): Promise<{
  greenhouse: string | null;
  lever: string | null;
  ashby: string | null;
}>
```

Generates slug candidates from company name (lowercase, hyphenated, underscored, concatenated). Probes:
- `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs` — 200 with jobs > 0 = valid
- `https://api.lever.co/v0/postings/{slug}?mode=json` — 200 with array length > 0 = valid
- `https://api.ashbyhq.com/posting-api/job-board/{slug}` — 200 = valid

**Error handling for probes:**
- Connection timeout: 5s per request. Timed-out ATS is skipped (returns null for that ATS), other ATS probes continue.
- HTTP 429 (rate limited): Back off 10s, retry once. If still 429, skip that ATS for this company.
- DNS failure / network error: Skip that ATS, log warning.
- Partial failures are normal — a company may only be on one ATS. Each ATS is probed independently.

Rate-limited to 2 probes/second. No authentication required.

### 5.3 Layer 3 — AI-Assisted Discovery (Groq)

```typescript
async function discoverCompanies(
  targetTitles: string[],
  targetLocations: string[],
  existingCompanies: string[]
): Promise<{ name: string; reason: string }[]>
```

Prompts Groq to suggest 20 companies hiring for the user's target roles in their target locations, excluding known companies. Results run through `probeCompany()`. Only companies with valid ATS slugs are added.

**Error handling:** If `GROQ_API_KEY` is not set or Groq returns an error (quota exhausted, 429, 500), the discovery run is logged to `discovery_runs` with `status = 'failed'` and the error message. The cron job does not retry — it will try again next week. No crash, no throw.

### 5.4 Schema Changes to `companies`

New columns:

```sql
ALTER TABLE companies ADD COLUMN ashby_slug TEXT;
ALTER TABLE companies ADD COLUMN source TEXT NOT NULL DEFAULT 'seed';
  -- "seed"|"manual"|"discovered"|"ai-suggested"
ALTER TABLE companies ADD COLUMN discovered_at TEXT;
ALTER TABLE companies ADD COLUMN relevance_note TEXT;
```

### 5.5 Scheduling

New cron in `cron.ts`:

```
0 4 * * 0    -- Weekly, Sundays at 4:00 AM (2 hours after daily scrape, safe gap)
```

**Why 4 AM not 3 AM:** The multi-query scraping (Section 6.2) can take up to 60 minutes with 6 queries across 3 browser sources. A 2-hour gap ensures the scrape completes before discovery starts.

Flow:
1. Call `discoverCompanies()` with active profile titles + locations
2. Probe ATS APIs for suggested companies
3. Insert valid ones with `source = 'ai-suggested'`, `active = true`
4. Log to `discovery_runs` table

**Note on auto-activation:** Scheduled discovery auto-activates companies (`active = true`) so they are included in the next scrape without user intervention. This is intentional — the user can review and deactivate from the UI. The on-demand endpoint (Section 5.6) returns results for review before insertion, giving the user a choice.

### 5.6 On-Demand Endpoint

`POST /api/companies/discover` — triggers discovery manually. Returns discovered companies for user review.

```typescript
POST /api/companies/discover
  Returns: { companies: { name: string, reason: string, greenhouse?: string, lever?: string, ashby?: string }[] }
  // Does NOT insert into DB. Returns candidates.

POST /api/companies/discover/confirm
  Body: { companies: { name: string, greenhouseSlug?: string, leverSlug?: string, ashbySlug?: string }[] }
  Returns: { inserted: number }
  // Inserts confirmed companies with source='discovered', active=true
```

### 5.7 Discovery Runs Audit Table

```sql
CREATE TABLE discovery_runs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at      TEXT NOT NULL,
  finished_at     TEXT,
  companies_found INTEGER NOT NULL DEFAULT 0,
  companies_new   INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL,  -- "running"|"completed"|"failed"
  error           TEXT,
  source          TEXT NOT NULL   -- "scheduled"|"manual"
);

CREATE INDEX idx_discovery_runs_started ON discovery_runs(started_at);
```

### 5.8 UI

- Company list: source badges (seed / manual / discovered / ai-suggested)
- "Discover More" button triggers on-demand discovery
- Toggle active/inactive per company
- Discovery log page (mirrors scrape log)

---

## 6. Role-Focused Scoring & Search

### 6.1 Auto-Generated Search Queries

During setup step 5, search queries are auto-generated from target titles + synonyms and **written to `profiles.search_queries`**. For a TPM user:

```
targetTitles: ["Technical Project Manager", "Technical Program Manager", "Product Manager"]
titleSynonyms: {
  "technical project manager": ["TPM", "IT Project Manager", "Technology PM"],
  "technical program manager": ["Program Manager Technical", "Sr Program Manager"],
  "product manager": ["Product Owner", "PM", "Group Product Manager"]
}

Generated searchQueries (persisted to profiles.search_queries):
["Technical Project Manager", "Technical Program Manager", "Product Manager",
 "TPM", "IT Project Manager", "Product Owner"]
```

The user can override the auto-generated list. If `searchQueries` is explicitly provided (via config import or manual edit), the auto-generation is skipped.

### 6.2 Multi-Query Scraping

`runAllSources()` in `sources/index.ts` changes to iterate over all search queries **for browser-based sources only**. ATS API sources (Greenhouse, Lever, Ashby) run once per company regardless of search queries — they return all jobs for a board, not filtered by keyword.

```typescript
// ATS sources: run once (parallel across all companies)
const atsResults = await runAtsSources(companies);

// Browser sources: run per query (sequential)
const browserResults: RawJob[] = [];
const seenLinks = new Set<string>();

for (const query of searchQueries) {
  const results = await runBrowserSources(query, page);
  for (const job of results) {
    if (!seenLinks.has(job.link)) {
      seenLinks.add(job.link);
      browserResults.push(job);
    }
  }
}
```

**Deduplication:** Per-query dedup happens inside the loop via `seenLinks` set (by job link). This avoids wasting scrape time re-processing duplicates across queries. Final dedup against the DB (existing logic) runs after all queries complete.

**Time budget:** Maximum 8 search queries per scrape run. With 3 browser sources and ~3 minutes per source per query, worst case is 8 × 3 × 3 = 72 minutes. The 4:00 AM discovery cron has a safe 2-hour gap from the 2:00 AM scrape start.

### 6.3 Scoring Weight Presets

Each archetype template includes default weights:

```json
{
  "id": "pm-tpm",
  "weights": {
    "freshness": 0.20,
    "skill": 0.25,
    "title": 0.25,
    "cert": 0.05,
    "competition": 0.10,
    "location": 0.10,
    "experience": 0.05
  }
}
```

PM/TPM: title weight bumped to 0.25 (from 0.15) because title precision matters more. Cert weight dropped to 0.05 because PMP is nice-to-have. Loaded during bootstrap, customizable in settings.

### 6.4 Title Matching Improvements

Changes to `ipe/title-align.ts`:

**Note:** This is a deliberate redesign of the scoring tiers. The current code scores synonym matches at 40 (lowest tier). The new design promotes synonyms to full score (100) because a synonym match IS the target role — "TPM" and "Technical Project Manager" should score identically.

New scoring logic:

1. Normalize both strings: lowercase, strip punctuation, expand abbreviations via `titleSynonyms` (keys are always lowercase — see Section 4.1 normalization contract)
2. **Exact match** after normalization → score 100
3. **Synonym match**: check if the normalized job title matches any synonym value in the map → score 100
4. **Order-independent word match**: check if all significant words from any target title appear in the job title (ignoring word order) → score 90
5. **Exclude title match**: if the job title matches any entry in `excludeTitles` → score 0 (overrides all above)
6. **Partial word overlap** as fallback (existing logic, scores 0-80 proportional to overlap)

### 6.5 Negative Title Filtering

New field on profiles: `exclude_titles` (JSON array, nullable).

Default for PM/TPM archetype:

```json
["Account Manager", "Sales Manager", "Marketing Manager",
 "Office Manager", "Property Manager", "Case Manager",
 "Nurse Manager", "Restaurant Manager", "Store Manager"]
```

Jobs matching an exclude title get `titleAlignmentScore = 0`, tanking their overall IPE score. Prevents false positives from "Manager" keyword pollution.

### 6.6 Schema Changes to `profiles`

```sql
ALTER TABLE profiles ADD COLUMN archetype TEXT;             -- "pm-tpm"|"software-engineer"|"data-scientist"|"custom"
ALTER TABLE profiles ADD COLUMN exclude_titles TEXT;         -- JSON array, nullable
ALTER TABLE profiles ADD COLUMN remote_preference INTEGER;  -- 0 or 1 (boolean), nullable
```

---

## 7. Config Export/Import

### 7.1 Export

`GET /api/config/export` — returns the active user's configuration as JSON:

```typescript
interface JobGridConfig {
  version: 1;
  exportedAt: string;

  // Identity
  name: string;
  avatarColor: string;

  // Role
  archetype: string;

  // Profile
  targetTitles: string[];
  titleSynonyms: Record<string, string[]>;
  excludeTitles: string[];
  targetSkills: string[];
  targetCerts: string[];
  targetLocations: string[];
  remotePreference: boolean;
  searchQueries: string[];

  // Scoring
  weights: {
    freshness: number;
    skill: number;
    title: number;
    cert: number;
    competition: number;
    location: number;
    experience: number;
  };

  // Thresholds
  analyticTopN: number;
  aiTopN: number;

  // Custom additions only (not template terms)
  customDictionary: { category: string; term: string }[];
  customCompanies: { name: string; greenhouseSlug?: string; leverSlug?: string; ashbySlug?: string }[];
}
```

**Not exported:** Resume text, scores, job data, outreach, API keys.

### 7.2 Import

Two entry points:
- Setup wizard step 1: "Import Config" → pre-fills all steps
- Settings page: "Import Config" → merges into existing setup

Endpoints:
- `POST /api/config/import` — validates JSON (Zod), returns preview diff
- `POST /api/config/import/confirm` — applies changes

**Import merge behavior:** The import loads the full archetype template dictionary first, then merges `customDictionary` entries on top with `source = 'manual'`. This ensures the user gets the complete template base plus their personal additions. Template terms are not included in exports to avoid bloating config files and to allow template updates to propagate.

### 7.3 Version Handling

`version: 1` field allows future schema evolution. Import validates version and migrates if needed.

---

## 8. Complete Data Flow

### 8.1 First Run (new user)

```
git clone → pnpm install → pnpm dev
  → DB empty detected (0 users)
  → API returns 412 → frontend redirects to /setup
  → Setup wizard (or config import):
      Pick archetype → loads dictionary template into user_dictionary
      Upload resume → extracts skills, merges into user_dictionary
      Set titles + synonyms + excludes (pre-filled from archetype)
      Set locations + remote preference
      Auto-generate searchQueries from titles + synonyms → persist to profile
      Seed companies loaded (300+)
      First scrape triggered
  → App is fully personalized
```

### 8.2 Daily Runtime

```
2:00 AM — Cron: scrape
  ATS sources (once, parallel): Greenhouse/Lever/Ashby APIs for all active companies
  Browser sources (per query, sequential):
    For each of max 8 search queries:
      Indeed, Google Jobs, ZipRecruiter
      In-loop dedup by link (seenLinks set)
  Final dedup against DB by link
  Filter by MAX_APPLICANTS
  Enrich (fetch full descriptions)
  IPE score (uses user_dictionary, excludeTitles)
  AI validate top N via Groq

4:00 AM Sunday — Cron: discover (safe 2h gap after scrape)
  Groq suggests companies for user's roles + locations
  Probe ATS APIs for valid slugs
  Insert valid companies (source = 'ai-suggested', active = true)
  Log to discovery_runs
```

### 8.3 Repo When Pushed

```
packages/                          # All code, no personal data
data/seed/companies.json           # 300+ generic companies
data/seed/dictionaries/*.json      # Role templates
.env.example                       # Blank
.gitignore                         # Covers *.db, *.db-journal, data/uploads/, .env
```

Zero trace of any user's identity, resume, companies, scores, or keys.

---

## 9. Migration for Existing Installations

Existing databases (with users, profiles, companies, jobs, scores) need a one-time migration.

### 9.1 Schema Migration

Handled by Drizzle's migration system. New columns get defaults:
- `companies.source` → default `'manual'` (existing companies were manually seeded, not from the generic seed file)
- `companies.ashby_slug` → default `null`
- `profiles.archetype` → default `'pm-tpm'` (the existing installation is the PM/TPM user)
- `profiles.exclude_titles` → default `null` (user can set later)
- `profiles.remote_preference` → default `null`
- New tables (`user_dictionary`, `discovery_runs`) created empty

### 9.2 Dictionary Backfill

A one-time migration script `packages/backend/src/db/migrate-dictionary.ts`:

1. Read the current `data/seed/dictionaries/pm-tpm.json` template
2. For each term in the template, insert into `user_dictionary` with `source = 'template'` for the existing user
3. If the user has uploaded documents, re-run `extractProfileData()` and insert new terms with `source = 'resume'`
4. Log: "Migrated X dictionary terms for user Y"

This script runs automatically on startup if `user_dictionary` is empty but users exist.

### 9.3 Seed Company Merge

On first startup after migration, the bootstrap checks: if users exist but `companies.source` column has no `'seed'` entries, load `data/seed/companies.json` and insert companies that don't already exist (matched by name). Existing companies keep `source = 'manual'`; new ones get `source = 'seed'`.

---

## 10. Schema Changes Summary

### New Tables

| Table | Purpose |
|-------|---------|
| `user_dictionary` | Per-user skill terms with source tracking. Index on `user_id`. Unique on `(user_id, category, term)`. |
| `discovery_runs` | Audit trail for company discovery operations. Index on `started_at`. |

### Modified Tables

| Table | Column Added | Type | Default |
|-------|-------------|------|---------|
| `companies` | `ashby_slug` | text | null |
| `companies` | `source` | text | 'seed' |
| `companies` | `discovered_at` | text | null |
| `companies` | `relevance_note` | text | null |
| `profiles` | `archetype` | text | null |
| `profiles` | `exclude_titles` | text (JSON array) | null |
| `profiles` | `remote_preference` | integer (0/1) | null |

### Deleted Files

| File | Reason |
|------|--------|
| `packages/backend/src/db/seed.ts` | Hardcoded personal companies |
| `packages/backend/data/skill-dictionary.json` | Replaced by `data/seed/dictionaries/` templates |

### Modified Files

| File | Change |
|------|--------|
| `.gitignore` | Replace `data/` with `*.db`, `*.db-journal`, `data/uploads/` |

---

## 11. New & Changed Files Summary

| File | Change Type |
|------|-------------|
| `data/seed/companies.json` | New — large curated company list |
| `data/seed/dictionaries/pm-tpm.json` | New — moved + expanded from current dictionary |
| `data/seed/dictionaries/software-engineer.json` | New — SWE template |
| `data/seed/dictionaries/data-scientist.json` | New — data science template |
| `data/seed/dictionaries/default.json` | New — minimal baseline |
| `packages/backend/src/db/schema.ts` | Modified — add `user_dictionary`, `discovery_runs`, columns on `companies` and `profiles` |
| `packages/backend/src/db/seed.ts` | Deleted |
| `packages/backend/src/db/bootstrap.ts` | New — first-run hydration from seed files |
| `packages/backend/src/db/migrate-dictionary.ts` | New — one-time dictionary backfill for existing DBs |
| `packages/backend/src/documents/dictionary.ts` | Modified — reads from `user_dictionary` table, takes `userId` param |
| `packages/backend/src/sources/discovery.ts` | New — ATS probing + Groq company discovery |
| `packages/backend/src/sources/index.ts` | Modified — multi-query scraping loop (browser sources only) |
| `packages/backend/src/ipe/title-align.ts` | Modified — order-independent matching, synonym=100, excludes=0 |
| `packages/backend/src/api/routes/setup.ts` | New — 7 setup wizard endpoints |
| `packages/backend/src/api/routes/config.ts` | New — export/import endpoints |
| `packages/backend/src/api/routes/companies.ts` | Modified — add discover + confirm endpoints |
| `packages/backend/src/api/middleware/bootstrap.ts` | New — 412 middleware (API routes only) |
| `packages/backend/src/scheduler/cron.ts` | Modified — add weekly discovery cron at 4:00 AM Sunday |
| `packages/frontend/src/pages/Setup.tsx` | New — first-run wizard (replaces old onboarding) |
| `packages/frontend/src/pages/Settings/Skills.tsx` | New — My Skills dictionary page |
| `packages/frontend/src/pages/Settings/Companies.tsx` | Modified — source badges, discover button |
| `.gitignore` | Modified — replace `data/` with specific entries |

---

## 12. Document Upload Cleanup Policy

When a user re-uploads a resume or LinkedIn PDF (replacing the existing one), the old file in `data/uploads/` is deleted from disk before saving the new one. The current code already replaces the `documents` DB row (deletes old, inserts new); the file cleanup extends this to the filesystem. This prevents accumulation of sensitive documents.

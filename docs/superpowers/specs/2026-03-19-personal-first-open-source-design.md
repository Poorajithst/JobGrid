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

All personal data lives in SQLite (already gitignored via `*.db` and `data/`). The repo ships generic seed files in `data/seed/`. On first run (empty DB), the app bootstraps from seed files and the user's input via a setup wizard. No config file sprawl — the DB is the single source of truth.

### 2.1 Gitignore Boundary

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
data/jobgrid.db                    # Already ignored (*.db)
data/uploads/                      # Resume/LinkedIn PDFs (new addition)
.env                               # Already ignored
```

### 2.2 Changes from Current State

- Delete `packages/backend/src/db/seed.ts` (hardcoded 13 companies)
- Move `packages/backend/data/skill-dictionary.json` to `data/seed/dictionaries/pm-tpm.json`
- Create additional dictionary templates
- Add `data/uploads/` to `.gitignore`

---

## 3. First-Run Bootstrap Flow

### 3.1 Detection

On server startup, query `SELECT COUNT(*) FROM users`. If 0, the app is in bootstrap mode.

### 3.2 Bootstrap Middleware

New middleware `packages/backend/src/api/middleware/bootstrap.ts`. When bootstrap mode is active, all API routes except `/api/setup/*` and `/api/config/import` return HTTP `412 Precondition Failed` with body `{ error: "setup_required" }`.

### 3.3 Frontend Redirect

When the frontend receives a 412, it redirects to `/setup`.

### 3.4 Setup Wizard (8 steps)

Replaces the current 6-step onboarding wizard entirely.

| Step | Action | Data Written |
|------|--------|-------------|
| 1. Welcome + Name/Avatar | Create user identity. "Import Config" button as alternative entry. | `users` row |
| 2. Choose Role Archetype | Pick template: PM/TPM, Software Engineer, Data Scientist, Custom | Determines dictionary template |
| 3. Upload Resume + LinkedIn PDF | Same as today, optional | `documents` rows, parsed data extracted |
| 4. Review & Customize Skills | Merged list: template + resume-extracted. User adds/removes. | `user_dictionary` rows, `profiles.target_skills`, `profiles.target_certs` |
| 5. Target Titles + Synonyms + Excludes | Pre-filled from archetype. User edits. | `profiles.target_titles`, `profiles.title_synonyms`, `profiles.exclude_titles` |
| 6. Target Locations + Remote | Same as today | `profiles.target_locations` |
| 7. Company Seed | Auto-loads `data/seed/companies.json`. Shows count. User can review/disable. | `companies` rows |
| 8. Config Complete | "Start your first job scan?" → triggers first scrape | Scrape kicks off |

### 3.5 Config Import as Alternative

At step 1, "Import Config" uploads a `JobGridConfig` JSON file that pre-fills steps 2-7. User reviews and confirms.

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
  defaultSynonyms: Record<string, string[]>;
  defaultExcludes: string[];     // Negative title filter
  methodologies: string[];
  tools: string[];
  technical: string[];
  certifications: string[];
  domains: string[];
  soft_skills: string[];
}
```

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
```

### 4.3 Hydration Flow

1. User picks archetype → all terms from template inserted with `source = 'template'`
2. Resume parsed → new extracted terms inserted with `source = 'resume'`
3. User manually adds/removes in wizard → `source = 'manual'`
4. Runtime: Groq identifies new relevant skills in job descriptions → `source = 'ai-discovered'`

### 4.4 Code Changes

- `dictionary.ts`: `loadDictionary()` reads from `user_dictionary` table grouped by category. Same return shape (`SkillDictionary`). Falls back to `default.json` if no user dictionary exists.
- `extractor.ts`: No change — calls `getAllTerms()` as before.
- `skill-match.ts`: No change — calls `getAllTerms()` as before.

### 4.5 UI

New "My Skills" settings page. Shows all terms grouped by category with source badges (template / resume / manual / ai-discovered). Add/remove individual terms. "Reset to template" option.

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

### 5.4 Schema Changes to `companies`

New columns:

```sql
ALTER TABLE companies ADD COLUMN source TEXT NOT NULL DEFAULT 'seed';
  -- "seed"|"manual"|"discovered"|"ai-suggested"
ALTER TABLE companies ADD COLUMN discovered_at TEXT;
ALTER TABLE companies ADD COLUMN relevance_note TEXT;
```

### 5.5 Scheduling

New cron in `cron.ts`:

```
0 3 * * 0    -- Weekly, Sundays at 3:00 AM
```

Flow:
1. Call `discoverCompanies()` with active profile titles + locations
2. Probe ATS APIs for suggested companies
3. Insert valid ones with `source = 'ai-suggested'`, `active = true`
4. Log to `discovery_runs` table

### 5.6 On-Demand Endpoint

`POST /api/companies/discover` — triggers discovery manually. Returns discovered companies for user review before activation.

### 5.7 Discovery Runs Audit Table

```sql
CREATE TABLE discovery_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at    TEXT NOT NULL,
  finished_at   TEXT,
  companies_found INTEGER NOT NULL DEFAULT 0,
  companies_new   INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL,  -- "running"|"completed"|"failed"
  error         TEXT,
  source        TEXT NOT NULL   -- "scheduled"|"manual"
);
```

### 5.8 UI

- Company list: source badges (seed / manual / discovered / ai-suggested)
- "Discover More" button triggers on-demand discovery
- Toggle active/inactive per company
- Discovery log page (mirrors scrape log)

---

## 6. Role-Focused Scoring & Search

### 6.1 Auto-Generated Search Queries

During setup step 5, search queries are auto-generated from target titles + synonyms. For a TPM user:

```
targetTitles: ["Technical Project Manager", "Technical Program Manager", "Product Manager"]
titleSynonyms: {
  "Technical Project Manager": ["TPM", "IT Project Manager", "Technology PM"],
  "Technical Program Manager": ["Program Manager Technical", "Sr Program Manager"],
  "Product Manager": ["Product Owner", "PM", "Group Product Manager"]
}

Generated searchQueries:
["Technical Project Manager", "Technical Program Manager", "Product Manager",
 "TPM", "IT Project Manager", "Product Owner"]
```

### 6.2 Multi-Query Scraping

`runAllSources()` in `sources/index.ts` changes to iterate over all search queries for browser-based sources:

```typescript
for (const query of searchQueries) {
  // Run Indeed, Google Jobs, ZipRecruiter with this query
  // Deduplicate across queries by link
}
```

A user with 6 queries gets 6x the coverage per browser source. Rate-limited by existing 1-2s delay.

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

1. Normalize both strings (lowercase, strip punctuation, expand abbreviations via `titleSynonyms`)
2. Order-independent matching: check if all significant words from any target title appear in job title
3. Synonym map check: if job title matches any synonym, full score (100)
4. Partial word overlap as fallback (existing logic)

### 6.5 Negative Title Filtering

New field on profiles: `exclude_titles` (JSON array, nullable).

Default for PM/TPM archetype:

```json
["Account Manager", "Sales Manager", "Marketing Manager",
 "Office Manager", "Property Manager", "Case Manager",
 "Nurse Manager", "Restaurant Manager", "Store Manager"]
```

Jobs matching an exclude title get `titleAlignmentScore = 0`, tanking their overall IPE score. Prevents false positives from "Manager" keyword pollution.

### 6.6 Schema Change to `profiles`

```sql
ALTER TABLE profiles ADD COLUMN exclude_titles TEXT;  -- JSON array, nullable
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
      Set locations
      Seed companies loaded (300+)
      First scrape triggered
  → App is fully personalized
```

### 8.2 Daily Runtime

```
2:00 AM — Cron: scrape
  For each search query:
    Greenhouse/Lever/Ashby APIs (parallel, all active companies)
    Indeed, Google Jobs, ZipRecruiter (sequential, per query)
  Deduplicate by link
  Filter by MAX_APPLICANTS
  Enrich (fetch full descriptions)
  IPE score (uses user_dictionary, excludeTitles)
  AI validate top N via Groq

3:00 AM Sunday — Cron: discover
  Groq suggests companies for user's roles + locations
  Probe ATS APIs for valid slugs
  Insert valid companies (source = 'ai-suggested')
  Log to discovery_runs
```

### 8.3 Repo When Pushed

```
packages/                          # All code, no personal data
data/seed/companies.json           # 300+ generic companies
data/seed/dictionaries/*.json      # Role templates
.env.example                       # Blank
.gitignore                         # Covers *.db, data/uploads/, .env
```

Zero trace of any user's identity, resume, companies, scores, or keys.

---

## 9. Schema Changes Summary

### New Tables

| Table | Purpose |
|-------|---------|
| `user_dictionary` | Per-user skill terms with source tracking |
| `discovery_runs` | Audit trail for company discovery operations |

### Modified Tables

| Table | Change |
|-------|--------|
| `companies` | Add `source` (text, default 'seed'), `discovered_at` (text), `relevance_note` (text) |
| `profiles` | Add `exclude_titles` (text, JSON array, nullable) |

### Deleted Files

| File | Reason |
|------|--------|
| `packages/backend/src/db/seed.ts` | Hardcoded personal companies |
| `packages/backend/data/skill-dictionary.json` | Replaced by `data/seed/dictionaries/` templates |

---

## 10. New & Changed Files Summary

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
| `packages/backend/src/documents/dictionary.ts` | Modified — reads from `user_dictionary` table |
| `packages/backend/src/sources/discovery.ts` | New — ATS probing + Groq company discovery |
| `packages/backend/src/sources/index.ts` | Modified — multi-query scraping loop |
| `packages/backend/src/ipe/title-align.ts` | Modified — order-independent matching, synonyms, excludes |
| `packages/backend/src/api/routes/config.ts` | New — export/import endpoints |
| `packages/backend/src/api/routes/companies.ts` | Modified — add discover endpoint |
| `packages/backend/src/api/middleware/bootstrap.ts` | New — 412 middleware |
| `packages/backend/src/scheduler/cron.ts` | Modified — add weekly discovery cron |
| `packages/frontend/src/pages/Setup.tsx` | New — first-run wizard (replaces old onboarding) |
| `packages/frontend/src/pages/Settings/Skills.tsx` | New — My Skills dictionary page |
| `packages/frontend/src/pages/Settings/Companies.tsx` | Modified — source badges, discover button |
| `.gitignore` | Modified — add `data/uploads/` |

# Interview Probability Engine (IPE) & Multi-Profile Pipeline

Replaces the single hardcoded PM profile + AI-only scoring with a document-driven, multi-signal local matching engine that runs instantly, then sends only top candidates to AI for validation.

## Overview

```
Resume PDF + LinkedIn PDF
  → Text Extraction (pdf-parse)
    → Profile Builder (regex + keyword dictionaries)
      → Candidate Profile (DB)
        → Search Profiles (lenses on your background)
          → Scrape jobs using profile's target titles
            → IPE scores ALL jobs locally (instant, free)
              → Top 50 (score ≥ 60) → AI Validation (Groq)
                → Ranked dashboard per profile
```

## Core Concepts

**Documents** — Your resume and LinkedIn PDF. Uploaded once, parsed into structured data (skills, titles, certs, experience years, locations, tools, industries, education). Can be re-uploaded when updated.

**Candidate Profile** — The union of all parsed document data. Represents everything you bring to the table.

**Search Profiles** — Lenses on your candidate profile. Each search profile targets different roles: "PM roles" picks Agile/CAPM/SAFe skills and searches for "project manager"; "TPM roles" picks Python/SQL/AI skills and searches for "technical program manager". Same person, different angles.

**IPE (Interview Probability Engine)** — 7-signal weighted scoring engine that runs locally with no AI. Scores every job against a search profile in under a second. Based on research-backed factors that predict interview callbacks.

**AI Validation** — Groq reviews only the top IPE matches. Pre-configured with your full profile. Validates the match, writes a personalized pitch, flags hidden issues. Does not re-score — enriches.

## Interview Probability Engine — Scoring Model

Seven dimensions, each scored 0-100, combined with customizable weights.

### 1. Freshness Score (default weight: 25%)

Based on research: applications within 24h get 32% higher callback rates, dropping 28% per day.

| Posting Age | Score |
|---|---|
| < 6 hours | 100 |
| < 24 hours | 95 |
| < 48 hours | 72 |
| < 72 hours | 52 |
| < 7 days | 25 |
| < 14 days | 10 |
| ≥ 14 days | 0 |

Formula: exponential decay from posting date.

### 2. Skill Match Score (default weight: 25%)

TF-IDF cosine similarity between the search profile's skills/experience text and the job description.

- Build TF-IDF vectors from profile text and job description
- Cosine similarity = score (0.0 to 1.0 → mapped to 0-100)
- Uses `natural` npm package for tokenization, stemming, TF-IDF
- Includes both hard skills (tools, technologies) and domain terms (infrastructure, security, data center)

A 75%+ match rate passes most ATS filters per research.

### 3. Title Alignment Score (default weight: 15%)

Fuzzy matching between the search profile's target titles and the job title.

| Match Type | Score |
|---|---|
| Exact match (case-insensitive) | 100 |
| Contains target title | 85 |
| Partial match (≥50% word overlap) | 60 |
| Related title (synonym dictionary) | 40 |
| No match | 0 |

Synonym dictionary maps: "Project Manager" ↔ "Program Manager" ↔ "PM", "Technical PM" ↔ "TPM", "Scrum Master" ↔ "Agile Coach", etc. Extensible per profile.

### 4. Certification Match Score (default weight: 10%)

Exact string matching for certifications mentioned in the job description.

| Condition | Score |
|---|---|
| Job mentions cert you have → all matched | 100 |
| Job mentions cert you have → some matched | 50-90 (proportional) |
| Job doesn't mention any certs | 70 (neutral — not a disadvantage) |
| Job requires cert you don't have | 20 |

### 5. Competition Score (default weight: 10%)

Based on applicant count at discovery time. Research: 3% interview rate at 100+ applicants.

| Applicants | Score |
|---|---|
| < 10 | 100 |
| < 25 | 85 |
| < 50 | 60 |
| < 100 | 30 |
| 100+ | 10 |
| Unknown (null) | 50 (neutral) |

### 6. Location Match Score (default weight: 10%)

Compares job location against the search profile's target locations.

| Condition | Score |
|---|---|
| Exact city match | 100 |
| Remote-friendly job + profile allows remote | 90 |
| Same state | 70 |
| Different state but within commute radius | 40 |
| Different state, no remote | 10 |

### 7. Experience Alignment Score (default weight: 5%)

Compares the seniority level implied by the job title and description against the candidate's experience years.

| Alignment | Score |
|---|---|
| Perfect match (e.g., "5+ years" and you have 6) | 100 |
| Slightly over-qualified (1-2 years over) | 80 |
| Under-qualified by 1-2 years | 50 |
| Significantly over-qualified (5+ years over) | 40 |
| Significantly under-qualified (3+ years under) | 20 |
| No experience requirement stated | 70 (neutral) |

### Composite IPE Score

```
IPE = (freshness × w1) + (skill_match × w2) + (title_align × w3) +
      (cert_match × w4) + (competition × w5) + (location × w6) +
      (experience × w7)
```

Where w1-w7 are customizable per profile (default weights above). Weights must sum to 1.0.

### AI Validation Threshold

Jobs with IPE ≥ 60 are eligible for AI validation. The AI stage:
- Receives: job description, IPE score breakdown, matching skills from profile
- Pre-configured system prompt with full candidate profile
- Returns: agree/disagree with IPE assessment, personalized 2-line pitch, red flags or hidden requirements, culture fit notes
- Stored in `job_scores.ai_*` columns

## Document Parsing

### Input

Two PDF files uploaded via the UI:
1. **Resume PDF** — your targeted resume
2. **LinkedIn PDF** — exported from LinkedIn (Settings → Data Privacy → Get a copy, or "Save to PDF" on profile)

### Extraction Pipeline

```
PDF file
  → pdf-parse (extract raw text)
    → Section detection (regex for headers: "Experience", "Education", "Skills", "Certifications")
      → Per-section extraction:
        - Skills: match against curated dictionary (~300 terms)
        - Titles: extract job titles from experience entries
        - Certs: regex for known cert patterns
        - Experience years: parse date ranges, calculate total
        - Locations: extract city/state from entries
        - Industries: match against industry keyword list
        - Tools: match against tool/platform dictionary
        - Education: degree level + field
```

### Skill Dictionary

Curated list of ~300 terms across categories:
- **PM methodologies**: Agile, Scrum, Kanban, Waterfall, SAFe, Lean, Six Sigma
- **Tools**: Jira, Asana, Monday.com, MS Project, Power BI, Tableau, Confluence
- **Technical**: Python, SQL, JavaScript, AWS, Azure, Docker, Kubernetes
- **Certifications**: PMP, CAPM, PMI-ACP, SAFe, ITIL, CSM, PSM, Prince2
- **Domains**: infrastructure, cybersecurity, AI/ML, data center, healthcare, fintech
- **Soft skills**: leadership, stakeholder management, executive reporting, vendor coordination

The dictionary is extensible — stored as a JSON file, user can add terms.

### Merging Two Documents

When both resume and LinkedIn are uploaded:
1. Extract structured data from each independently
2. Union all skills (deduplicated)
3. Union all titles (deduplicated)
4. Take the longer experience history
5. Union all locations
6. Store each document separately in `documents` table
7. The merged view is computed at query time, not stored

## Database Schema

### New Tables

**`documents`**

| Column | Type | Notes |
|---|---|---|
| id | integer, PK, auto-increment | |
| type | text, not null | "resume" or "linkedin" |
| filename | text, not null | Original filename |
| raw_text | text, not null | Full extracted text from PDF |
| parsed_skills | text | JSON array of extracted skills |
| parsed_titles | text | JSON array of extracted job titles |
| parsed_certs | text | JSON array of extracted certifications |
| parsed_experience_years | integer, nullable | Calculated total years |
| parsed_locations | text | JSON array of extracted locations |
| parsed_industries | text | JSON array |
| parsed_tools | text | JSON array |
| parsed_education | text | JSON object {degree, field} |
| uploaded_at | text, not null, default now | |

**`profiles`**

| Column | Type | Notes |
|---|---|---|
| id | integer, PK, auto-increment | |
| name | text, not null | "PM roles", "TPM roles", etc. |
| target_titles | text, not null | JSON array of target job titles |
| target_skills | text, not null | JSON array of skills to match against |
| target_certs | text | JSON array of certifications to match |
| target_locations | text | JSON array of preferred locations |
| min_experience_years | integer, nullable | |
| max_experience_years | integer, nullable | |
| search_queries | text | JSON array of custom scraper search queries |
| title_synonyms | text | JSON object mapping related titles |
| freshness_weight | real, not null, default 0.25 | |
| skill_weight | real, not null, default 0.25 | |
| title_weight | real, not null, default 0.15 | |
| cert_weight | real, not null, default 0.10 | |
| competition_weight | real, not null, default 0.10 | |
| location_weight | real, not null, default 0.10 | |
| experience_weight | real, not null, default 0.05 | |
| ai_threshold | integer, not null, default 60 | Min IPE score for AI validation |
| is_active | integer (boolean), not null, default 1 | |
| created_at | text, not null, default now | |

**`job_scores`**

| Column | Type | Notes |
|---|---|---|
| id | integer, PK, auto-increment | |
| job_id | integer, not null, FK → jobs.id | |
| profile_id | integer, not null, FK → profiles.id | |
| ipe_score | integer, not null | Composite 0-100 |
| freshness_score | integer, not null | |
| skill_match_score | integer, not null | |
| title_alignment_score | integer, not null | |
| cert_match_score | integer, not null | |
| competition_score | integer, not null | |
| location_match_score | integer, not null | |
| experience_align_score | integer, not null | |
| ai_validated | integer (boolean), not null, default 0 | |
| ai_agrees | integer (boolean), nullable | |
| ai_pitch | text, nullable | |
| ai_flags | text, nullable | |
| scored_at | text, not null, default now | |

**Unique constraint:** `(job_id, profile_id)` — one score per job per profile.
**Indexes:** `profile_id`, `ipe_score`, composite `(profile_id, ipe_score)`.

### Changes to `jobs` Table

**Remove columns** (moved to `job_scores`):
- `fit_score`
- `competition` (the text label — applicant count stays)
- `recommendation`
- `pitch`
- `score_reason`

**Keep all other columns** — jobs remain source-agnostic and profile-independent.

### Existing Tables — No Changes

- `companies` — unchanged
- `outreach` — unchanged (outreach is per-job, not per-profile)
- `scrape_runs` — unchanged

## API Endpoints

### New Endpoints

| Method | Route | Description |
|---|---|---|
| POST | /api/documents/upload | Upload resume or LinkedIn PDF. Accepts multipart form with `file` field and `type` ("resume" or "linkedin"). Parses PDF, extracts structured data, stores in DB. Returns parsed data for review. |
| GET | /api/documents | List all uploaded documents with parsed data |
| DELETE | /api/documents/:id | Delete a document |
| GET | /api/profiles | List all search profiles |
| POST | /api/profiles | Create a search profile. Body: `{ name, target_titles, target_skills, ... }`. Can auto-populate from documents. |
| PATCH | /api/profiles/:id | Update profile fields, weights, or search queries |
| DELETE | /api/profiles/:id | Delete profile and its job_scores |
| POST | /api/profiles/:id/auto-populate | Auto-fill profile fields from uploaded documents |
| POST | /api/score/ipe/:profileId | Run IPE scoring for all unscored jobs against this profile. Returns count scored. |
| POST | /api/score/ai/:profileId | Send top IPE matches (≥ ai_threshold) that haven't been AI-validated to Groq. Returns count validated. |
| POST | /api/score/all/:profileId | Run IPE + AI in sequence for a profile. |

### Modified Endpoints

| Method | Route | Change |
|---|---|---|
| GET | /api/jobs | Adds `profileId` query param. When set, joins with `job_scores` for that profile, returns IPE score + AI data. Sorts by `ipe_score` by default. |
| GET | /api/jobs/:id | Includes all profile scores for this job (from `job_scores`). |
| GET | /api/stats | Adds `profileId` param. Stats scoped to profile's scores: avg IPE, top-scored count, AI-validated count, by-source breakdown. |
| POST | /api/scrape | Uses active profile's `search_queries` for Indeed/Google Jobs/ZipRecruiter search terms instead of hardcoded queries. |

## Frontend Changes

### New Pages/Components

**Document Upload View:**
- Drag-and-drop zone for Resume PDF and LinkedIn PDF
- After upload: shows extracted data (skills, titles, certs, experience) for review
- Edit extracted data inline before saving
- Re-upload to refresh

**Profile Manager View:**
- List of search profiles with active/inactive toggle
- Create new profile: name, pick target titles from extracted data, pick skills, set locations
- Weight sliders for each IPE dimension (visual, drag to adjust)
- Custom search queries editor
- "Auto-populate from documents" button

**Score Breakdown (replaces single score in DetailPanel):**
- 7-bar horizontal breakdown showing each IPE dimension
- Color-coded: green (≥70), amber (40-69), red (<40)
- Shows the weight next to each bar
- AI validation badge: checkmark if AI agrees, warning if AI flagged issues

### Modified Components

**TopBar:**
- Profile selector dropdown (replaces hardcoded "JobGrid" context)
- "Score Now" button — runs IPE for active profile
- "AI Validate Top" button — sends top matches to Groq

**JobCard:**
- Shows IPE score (from `job_scores`) instead of `fit_score`
- Shows freshness indicator (green dot for <24h, yellow for <48h, etc.)

**JobList:**
- Filters now include IPE score range slider
- "AI Validated" filter toggle

**DetailPanel:**
- Score section shows 7-dimension breakdown instead of single number
- AI section shows validation result, pitch, flags
- "Validate with AI" button on individual jobs

## New Dependencies

| Package | Purpose | Size |
|---|---|---|
| `pdf-parse` | Extract text from PDF files | ~50KB |
| `natural` | NLP: tokenizer, stemmer, TF-IDF, cosine similarity | ~2MB |
| `multer` | Express file upload middleware | ~30KB |

All pure JavaScript, no native bindings, no Python required.

## Scraper Integration

The source orchestrator's search queries become dynamic:

**Current (hardcoded):**
```
"project manager" Worcester MA
```

**New (from active profile):**
```
profile.search_queries = [
  "project manager Worcester MA",
  "program manager Boston MA",
  "infrastructure PM remote"
]
```

Each profile defines its own search queries. When a scrape runs, it uses the active profile's queries for Indeed, Google Jobs, and ZipRecruiter. Greenhouse/Lever API sources still scrape all companies regardless of profile (since they return all jobs, filtering happens at the scoring stage).

## Migration Strategy

Since the existing `jobs` table has 564 jobs with scoring columns:

1. Create new tables (`documents`, `profiles`, `job_scores`)
2. Create a "Legacy PM" profile from the existing hardcoded profile data
3. Migrate existing `fit_score`, `competition`, `recommendation`, `pitch`, `score_reason` from `jobs` into `job_scores` for the legacy profile
4. Drop the old scoring columns from `jobs`
5. Re-score all 564 jobs with the IPE engine against the new profile

## Build Order

1. **PDF parsing + document storage** — upload, extract, store, review
2. **Profile CRUD** — create/edit/delete profiles, auto-populate from documents
3. **IPE scoring engine** — the 7-dimension scorer with TF-IDF
4. **Score Now endpoint** — trigger IPE scoring for a profile
5. **AI validation endpoint** — send top matches to Groq
6. **DB migration** — move scoring columns, create new tables
7. **Frontend: document upload** — drag-drop, review extracted data
8. **Frontend: profile manager** — CRUD, weight sliders, search queries
9. **Frontend: score breakdown** — 7-bar chart in DetailPanel
10. **Frontend: profile selector + score/validate buttons** — TopBar updates
11. **Scraper integration** — dynamic search queries from active profile
12. **Re-score existing jobs** — run IPE against all 564 jobs

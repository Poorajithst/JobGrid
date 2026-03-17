# JD Enrichment, Two-Stage Funnel & Multi-User Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add JD fetching, two-stage scoring funnel (IPE top 35 → AI top 15), Netflix-style multi-user, guided onboarding, and AI token caching.

**Architecture:** New users table, user_id FKs on existing tables, cheerio+Playwright hybrid JD fetcher, profile hash for AI cache, dynamic Groq prompts replacing hardcoded PM_PROFILE.

**Tech Stack:** cheerio (HTML parsing), existing pdf-parse/natural/multer/Groq/Playwright stack

**Spec:** `docs/superpowers/specs/2026-03-16-jd-enrichment-funnel-multiuser-design.md`

**Parallelism Map:**
```
Chunk 1 (DB migrations + user system backend)
  ├──> Chunk 2 (JD enrichment backend)           ── independent
  ├──> Chunk 3 (prompt rewrite + AI scoring)      ── independent
  └──> Chunk 4 (user switcher + onboarding UI)    ── independent
         All merge into:
Chunk 5 (TopBar buttons + DetailPanel + wiring)
```

---

## Chunk 1: DB Migrations, Users Backend & Middleware

### Task 1: Install cheerio + create users table

- [ ] **Step 1: Install cheerio**
```bash
cd /home/poorajith/My_Volume/CodeBase/Techiee/packages/backend && pnpm add cheerio
```

- [ ] **Step 2: Add users table to schema.ts**

Add to `packages/backend/src/db/schema.ts`:
```typescript
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  avatarColor: text('avatar_color').notNull().default('#6366f1'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});
```

- [ ] **Step 3: Add analytic_top_n, ai_top_n, profile_hash to profiles table**

Add columns to the existing `profiles` definition in schema.ts:
```typescript
analyticTopN: integer('analytic_top_n').notNull().default(35),
aiTopN: integer('ai_top_n').notNull().default(15),
profileHash: text('profile_hash'),
```

Remove `aiThreshold` column from profiles definition (replaced by analyticTopN).

- [ ] **Step 4: Add ai_fit_assessment to job_scores table**

Add to jobScores definition:
```typescript
aiFitAssessment: text('ai_fit_assessment'),
```

- [ ] **Step 5: Add user_id columns to documents, profiles, outreach**

Add to `documents`: `userId: integer('user_id'),`
Add to `profiles`: `userId: integer('user_id'),`
Add to `outreach`: `userId: integer('user_id'),`

Note: Make them nullable for now. The backfill migration will set them.

- [ ] **Step 6: Generate and run migration**
```bash
cd /home/poorajith/My_Volume/CodeBase/Techiee/packages/backend && pnpm db:generate && pnpm db:migrate
```

- [ ] **Step 7: Create backfill script** `packages/backend/src/db/backfill-users.ts`

Creates default user (id=1), sets all existing documents/profiles/outreach user_id=1.

```bash
cd /home/poorajith/My_Volume/CodeBase/Techiee/packages/backend && tsx src/db/backfill-users.ts
```

- [ ] **Step 8: Commit**
```bash
git commit -m "feat: add users table, user_id columns, profile scoring config"
```

### Task 2: User CRUD routes + userId middleware

- [ ] **Step 1: Create userId middleware** `packages/backend/src/api/middleware/user-context.ts`

Extracts userId from `X-User-Id` header or `userId` query param. Falls back to 1 if missing. Sets `req.userId`.

```typescript
import type { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      userId: number;
    }
  }
}

export function userContext(req: Request, _res: Response, next: NextFunction) {
  const fromHeader = req.headers['x-user-id'];
  const fromQuery = req.query.userId;
  req.userId = parseInt(String(fromHeader || fromQuery || '1'), 10);
  next();
}
```

- [ ] **Step 2: Create users route** `packages/backend/src/api/routes/users.ts`

```typescript
import { Router } from 'express';
import type { createQueries } from '../../db/queries.js';

export function createUsersRouter(queries: ReturnType<typeof createQueries>) {
  const router = Router();

  router.get('/', (_req, res) => { res.json(queries.getUsers()); });

  router.post('/', (req, res) => {
    const { name, avatarColor } = req.body;
    const user = queries.insertUser({ name, avatarColor: avatarColor || '#6366f1' });
    res.status(201).json(user);
  });

  router.patch('/:id', (req, res) => {
    queries.updateUser(parseInt(req.params.id, 10), req.body);
    res.json(queries.getUserById(parseInt(req.params.id, 10)));
  });

  router.delete('/:id', (req, res) => {
    queries.deleteUser(parseInt(req.params.id, 10));
    res.json({ message: 'User deleted' });
  });

  return router;
}
```

- [ ] **Step 3: Add user query helpers to queries.ts**

getUsers(), getUserById(id), insertUser(data), updateUser(id, data), deleteUser(id) — cascade deletes documents/profiles/outreach/job_scores for user.

- [ ] **Step 4: Wire into server.ts**

Add userContext middleware (before routes), mount `/api/users`.

- [ ] **Step 5: Scope existing routes by userId**

Update documents, profiles, outreach routes to filter by `req.userId`.

- [ ] **Step 6: Run tests + verify server starts**
```bash
cd /home/poorajith/My_Volume/CodeBase/Techiee/packages/backend && pnpm test
```

- [ ] **Step 7: Commit**
```bash
git commit -m "feat: add user CRUD, userId middleware, scope routes by user"
```

---

## Chunk 2: JD Enrichment (PARALLEL after Chunk 1)

### Task 3: Hybrid JD fetcher

- [ ] **Step 1: Create** `packages/backend/src/sources/description-fetcher.ts`

Hybrid approach:
1. HTTP GET with fetch() + parse with cheerio
2. Try selectors: Greenhouse (#content .body, .job-post-content), Lever (.posting-page .content), Generic (.job-description, article, main)
3. If text < 100 chars → fall back to Playwright page rendering
4. Cap at 5000 chars
5. Return description string or null

- [ ] **Step 2: Create test** `packages/backend/src/sources/__tests__/description-fetcher.test.ts`

Mock fetch to return HTML with job description content. Test cheerio extraction, fallback to Playwright, error handling.

- [ ] **Step 3: Run tests, commit**
```bash
git commit -m "feat: add hybrid JD fetcher (cheerio + Playwright fallback)"
```

### Task 4: Enrichment endpoint + auto-trigger

- [ ] **Step 1: Create** `packages/backend/src/api/routes/enrich.ts`

```
POST /api/enrich — bulk enrichment (background)
POST /api/enrich/:jobId — single job enrichment
GET /api/enrich/status — progress
```

Uses an in-memory running flag (like scrape route). Iterates null-description jobs, calls hybrid fetcher, updates DB.

- [ ] **Step 2: Wire into server.ts**

Mount `/api/enrich`.

- [ ] **Step 3: Add auto-trigger after scrape**

In triggerScrape (server.ts), after inserting new jobs, start enrichment for jobs with null descriptions.

- [ ] **Step 4: Commit**
```bash
git commit -m "feat: add JD enrichment endpoint with auto-trigger after scrape"
```

---

## Chunk 3: Prompt Rewrite + AI Scoring with Caching (PARALLEL after Chunk 1)

### Task 5: Rewrite prompts to use dynamic profile data

- [ ] **Step 1: Delete** `packages/backend/src/scorer/profile.ts`

- [ ] **Step 2: Rewrite** `packages/backend/src/scorer/prompts.ts`

Remove all references to PM_PROFILE and profileToString(). Replace with:

```typescript
export interface DynamicProfile {
  name: string;
  resumeText: string;
  targetTitles: string[];
  targetSkills: string[];
  targetCerts: string[];
  targetLocations: string[];
  experienceYears: number;
}

export function buildScoringPrompt(job: {...}, profile: DynamicProfile): string { ... }
export function buildOutreachPrompt(input: {...}, profile: DynamicProfile): string { ... }
export function buildAiValidationPrompt(job: {...}, ipeBreakdown: {...}, profile: DynamicProfile): string { ... }
```

The AI validation prompt follows the spec: system prompt with full profile, user prompt with job + IPE breakdown.

- [ ] **Step 3: Update scorer/groq.ts** — scoreJob() now takes profile parameter

- [ ] **Step 4: Fix any test imports** that reference deleted profile.ts

- [ ] **Step 5: Run tests, commit**
```bash
git commit -m "feat: rewrite prompts for dynamic profiles, remove hardcoded PM_PROFILE"
```

### Task 6: AI scoring with profile hash caching

- [ ] **Step 1: Add profile hash computation**

Create `packages/backend/src/scorer/profile-hash.ts`:
```typescript
import { createHash } from 'crypto';

export function computeProfileHash(resumeTexts: string[], profile: {
  targetSkills: string[]; targetCerts: string[]; targetTitles: string[];
}): string {
  const data = [...resumeTexts, ...profile.targetSkills, ...profile.targetCerts, ...profile.targetTitles].join('|');
  return createHash('sha256').update(data).digest('hex');
}
```

- [ ] **Step 2: Update POST /api/score/ai/:profileId in score.ts**

Implement the full AI scoring flow:
1. Get profile + user's documents (for resume text)
2. Compute current profile hash
3. Compare with stored profile.profileHash
4. If hash changed → clear all ai_validated for this profile, update hash
5. Get top analyticTopN unvalidated jobs
6. For each: build AI validation prompt, call Groq, parse response, store in job_scores
7. Return count validated

- [ ] **Step 3: Add POST /api/score/ai/:profileId/:jobId** — single job AI validation

- [ ] **Step 4: Run tests, commit**
```bash
git commit -m "feat: add AI scoring with profile hash caching and per-job validation"
```

---

## Chunk 4: User Switcher + Onboarding Wizard UI (PARALLEL after Chunk 1)

### Task 7: User switcher component

- [ ] **Step 1: Create** `packages/frontend/src/components/UserSwitcher.tsx`

Avatar circle with user initial + color. Click opens dropdown with all users. "Add User" option at bottom. Selected user stored in localStorage.

- [ ] **Step 2: Create** `packages/frontend/src/api/client.ts` updates

Add usersApi: list(), create(data), update(id, data), remove(id).
Add X-User-Id header to axios instance based on active userId.

- [ ] **Step 3: Commit**
```bash
git commit -m "feat: add UserSwitcher component and user API client"
```

### Task 8: Onboarding wizard

- [ ] **Step 1: Create** `packages/frontend/src/components/OnboardingWizard.tsx`

Multi-step full-screen overlay:
1. Welcome: name + avatar color picker
2. Upload resume (reuses DocumentUpload component logic)
3. Review extracted data (toggleable skill/title/cert tags)
4. Target roles (editable title list)
5. Target locations (editable, Remote toggle)
6. Confirmation → creates profile → redirects to dashboard

Wizard state stored in component state (lost on page reload — acceptable for a one-time flow).

- [ ] **Step 2: Update App.tsx**

Check if users exist. If not → show OnboardingWizard. Store activeUserId in localStorage. Pass to all API calls.

- [ ] **Step 3: Build and verify**
```bash
cd /home/poorajith/My_Volume/CodeBase/Techiee/packages/frontend && pnpm build
```

- [ ] **Step 4: Commit**
```bash
git commit -m "feat: add onboarding wizard with guided profile setup"
```

---

## Chunk 5: TopBar Buttons, DetailPanel JD Viewer & Final Wiring

### Task 9: TopBar button updates

- [ ] **Step 1: Update TopBar.tsx**

Replace existing buttons with 4-button layout:
- Scrape (existing Run Now, renamed)
- Enrich JDs (new — calls POST /api/enrich, shows progress)
- Analytic Score (existing Score Now, renamed — calls POST /api/score/ipe/:profileId, auto-filters to top N)
- AI Score (new — calls POST /api/score/ai/:profileId, auto-filters to top ai_top_n)

Each button shows state: idle, running, complete with count.

Add enrichment status polling (GET /api/enrich/status every 3s when running).

- [ ] **Step 2: Commit**
```bash
git commit -m "feat: update TopBar with Scrape/Enrich/Analytic/AI Score buttons"
```

### Task 10: DetailPanel JD viewer with highlights

- [ ] **Step 1: Update DetailPanel.tsx**

Add job description section with keyword highlighting:
- Profile skills → indigo highlight
- Profile certs → amber highlight
- Target titles → cyan highlight

Collapsible (show first 500 chars, "Show more" to expand).

If description is null: "No description available" + "Fetch" button (calls POST /api/enrich/:jobId).

Add AI assessment section:
- If ai_validated: show fit_assessment paragraph, pitch (italic indigo), flags (warning box)
- If not validated: "Validate with AI" button (calls POST /api/score/ai/:profileId/:jobId)

- [ ] **Step 2: Commit**
```bash
git commit -m "feat: add JD viewer with highlights and AI assessment in DetailPanel"
```

### Task 11: Navigation + final wiring

- [ ] **Step 1: Update App.tsx with tab navigation**

Tabs: Dashboard | Documents | Profiles | Settings
- Dashboard: existing job list + detail panel
- Documents: DocumentUpload component
- Profiles: ProfileManager component
- Settings: user management (rename, delete, add new user)

- [ ] **Step 2: Run full test suite + build**
```bash
cd /home/poorajith/My_Volume/CodeBase/Techiee/packages/backend && pnpm test
cd /home/poorajith/My_Volume/CodeBase/Techiee/packages/frontend && pnpm build
```

- [ ] **Step 3: Commit**
```bash
git commit -m "feat: add tab navigation and wire all views"
```

### Task 12: E2E verification

- [ ] **Step 1: Start server, verify user creation**
```bash
curl -s -X POST http://localhost:3001/api/users -H 'Content-Type: application/json' -d '{"name":"Poorajith"}'
```

- [ ] **Step 2: Verify enrichment**
```bash
curl -s -X POST http://localhost:3001/api/enrich
# Wait, check status
curl -s http://localhost:3001/api/enrich/status
```

- [ ] **Step 3: Verify analytic scoring**
```bash
curl -s -X POST http://localhost:3001/api/score/ipe/1
```

- [ ] **Step 4: Verify AI scoring**
```bash
curl -s -X POST http://localhost:3001/api/score/ai/1
```

- [ ] **Step 5: Final commit**
```bash
git commit -m "feat: complete JD enrichment, two-stage funnel, and multi-user system"
```

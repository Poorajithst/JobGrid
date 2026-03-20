# Contributing to JobGrid

Thanks for your interest in contributing! JobGrid is a personal-first job discovery tool that anyone can clone and make their own.

## Getting Started

1. Fork the repo and clone your fork
2. Install dependencies: `pnpm install`
3. Install Playwright: `cd packages/backend && npx playwright install chromium`
4. Copy `.env.example` to `.env` and add your `GROQ_API_KEY`
5. Run migrations: `cd packages/backend && pnpm db:migrate`
6. Start dev servers: `pnpm dev` (runs backend + frontend concurrently)

## Development

- **Backend:** `packages/backend/` — Express.js + Drizzle ORM + SQLite
- **Frontend:** `packages/frontend/` — React 19 + Vite + Tailwind CSS v4
- **Tests:** `cd packages/backend && pnpm test` (Vitest, 162 tests)
- **Type check:** `cd packages/frontend && npx tsc --noEmit`

## Making Changes

1. Create a branch: `git checkout -b feat/your-feature`
2. Write tests first when adding backend logic
3. Run `pnpm test` in the backend package before committing
4. Keep commits focused — one logical change per commit

## What We Look For

- **Bug fixes** with a test that reproduces the bug
- **New job sources** following the existing source pattern in `packages/backend/src/sources/`
- **New dictionary templates** in `data/seed/dictionaries/` for different role archetypes
- **UI improvements** that match the existing dark theme style
- **Documentation** improvements, especially around scraper setup and troubleshooting

## What to Avoid

- Don't commit `.env` files, database files, or uploaded documents
- Don't add personal data (locations, company lists, resume content) to committed files
- Don't change scoring weights in templates without explaining the rationale

## Reporting Issues

Open a GitHub issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your Node.js version and OS

## Code Style

- TypeScript strict mode
- Functional style (no classes)
- Named exports
- Zod for request validation
- Drizzle ORM for all database queries

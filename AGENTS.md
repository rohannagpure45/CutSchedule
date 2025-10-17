# Repository Guidelines

## Project Structure & Module Organization
- Main code lives in `cutschedule/`.
- `app/` — Next.js App Router pages and API routes (`app/api/*/route.ts`).
- `components/` — Reusable React components (UI and feature-specific).
- `lib/` — Utilities, services, and integrations (e.g., `auth`, `db`, `sms`, `calendar`).
- `prisma/` — Database schema and migrations (`schema.prisma`, `migrations/`).
- `scripts/` — Maintenance scripts (e.g., syncing, fixes).
- `tests/` — Playwright tests and artifacts.

## Build, Test, and Development Commands
- From `cutschedule/`:
  - `npm run dev` — Start Next.js dev server at `http://localhost:3000`.
  - `npm run build` — Generate Prisma client and build the app.
  - `npm start` — Run the production build locally.
  - `npm run lint` — ESLint (`next/core-web-vitals` rules).
  - `npm run typecheck` — TypeScript type checking.
- Database (development):
  - `npx prisma generate` — Generate Prisma client.
  - `npx prisma db push` — Apply schema to dev DB.
  - `npx prisma db seed` — Seed data (optional; uses `prisma/seed.ts`).
- Tests (Playwright):
  - `npx playwright test` or `npx playwright test --ui`.

## Coding Style & Naming Conventions
- Language: TypeScript with Next.js App Router; Tailwind for styling.
- Linting: ESLint with `next/core-web-vitals`. Fix issues before PR.
- Match existing style: 2-space indentation, double quotes, no semicolons.
- Filenames: React components `PascalCase.tsx`; hooks `useX.ts`; utilities in `lib/` with named exports.
- API routes mirror domain structure under `app/api/<area>/route.ts`.
- Prefer `cn(...)` helper for class merging; keep Tailwind classes co-located.

## Testing Guidelines
- Place end-to-end/UI tests in `cutschedule/tests/*.spec.ts`.
- Use stable selectors (e.g., `data-testid`) over text or layout.
- Keep tests deterministic; avoid real external network calls.
- Run `npm run build` only when needed; for fast feedback use `npx playwright test` during dev.

## Commit & Pull Request Guidelines
- Follow Conventional Commits seen in history (e.g., `feat:`, `fix:`, `refactor:`).
- Before opening a PR: run `npm run lint`, `npm run typecheck`, and `npx playwright test`.
- PRs should include: summary, linked issues, screenshots/GIFs for UI changes, notes on DB migrations or env var changes, and test instructions.

## Security & Configuration Tips
- Do not commit secrets. Use `cutschedule/.env` or `.env.local` locally and Vercel env vars in production.
- Required envs include NextAuth, Twilio, and Google (OAuth + Calendar). Verify before `npm run dev`/`npm run build`.
- Prisma: edit `prisma/schema.prisma`; use `db push` for dev. For team-shared changes, coordinate on migrations.


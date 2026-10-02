# Task Plan

## Sprint 1 — DB + Core Capture + Daily Report Graph
**Goal:** Working app — capture sales, see daily comparison graph. Demo-first, no login.
- Create Supabase tables (tenants, sales_records, projections) + seed data.
- Build `lib/data/` access layer (list tenants, insert/list sales, daily aggregation query).
- Build sales entry form (tenant select, period, amount, date).
- Build Daily Report page: line chart this-week vs last-week daily GTO.
- Build portfolio dashboard: total today, top tenants, mini trend.
- Responsive sidebar nav.
- **Definition of Done:** Analyst opens `/`, sees seeded daily report graph, adds a sales record, graph updates. No login required.

## Sprint 2 — Projections + Tenant Detail
**Goal:** Projection engine + tenant drill-down.
- Build `lib/logic/projection.ts`: trailing-7-day average weekly projection.
- Projections page: per-tenant next-week estimate with confidence.
- Tenant detail page: hourly/daily breakdown + sparkline.
- Empty/loading/error states for all pages.
- **Definition of Done:** Analyst views projection for a tenant, projection reflects trailing data, tenant detail shows breakdown.

## Sprint 3 — Polish + Import
**Goal:** CSV import + edge cases.
- CSV upload → parse → batch insert sales_records.
- Week-over-week and month-over-month toggle on daily report.
- Test all five states (loading/empty/partial/error/ready).
- **Definition of Done:** Analyst imports a CSV, records appear in graph, toggle switches comparison window.

## Sprint 4 — Lock It Down ✅ (team workspaces + login)
**Goal:** Auth + per-team RLS. Scope changed from per-user to **team workspaces** (chosen by the user): each team has its own data; roles admin / analyst / viewer.
- [x] Supabase Auth: email + password with email confirmation, magic link, `/auth/callback`, sign-out.
- [x] Middleware redirects signed-out users to `/login?next=…` (public: `/login`, `/signup`, `/auth/*`, `/api/health`, Stripe webhook; other APIs → 401).
- [x] `0002_teams.sql`: teams / team_members / team_invites, `team_id` on all data tables, permissive RLS replaced with member-read / admin+analyst-write policies, anon revoked.
- [x] Seed/existing data moved into a member-less “Demo workspace”, claimable via SQL editor (README).
- [x] Onboarding (create team / accept pending invites), team switcher, `/team` (members, roles, invite link, revoke, rename, leave).
- [x] Data layer + server actions scoped to the active team; viewers see no write buttons and actions refuse them.
- [x] Tests: `supabase/tests/rls_test.sql` (98 assertions, real Postgres), Vitest for role/redirect/validation logic, browser E2E `e2e/teams-flow.mjs` against local GoTrue + PostgREST.
- Out of scope: sending invite emails (admins copy the link), audit log of membership changes, team deletion UI.
- **Definition of Done:** New signup sees only their team's data; anonymous users redirected to login. ✔

## Gantt
```
S1 ████████████  DB + capture + daily graph
S2         ████  projections + tenant detail
S3             ████  CSV import + polish
S4                 ████  auth + RLS lock-down
```

**v1 functional milestone: end of Sprint 1.**

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

## Sprint 4 — Lock It Down
**Goal:** Auth + per-user RLS.
- Supabase Auth (email/password).
- Replace permissive RLS with `auth.uid() = user_id` policies.
- Assign seed data to a demo user.
- **Definition of Done:** New signup sees only their data; anonymous users redirected to login.

## Gantt
```
S1 ████████████  DB + capture + daily graph
S2         ████  projections + tenant detail
S3             ████  CSV import + polish
S4                 ████  auth + RLS lock-down
```

**v1 functional milestone: end of Sprint 1.**

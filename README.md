# Tenant GTO

Sales tracking for SPSB Leasing & Finance: capture tenant GTO (hourly / daily / weekly / monthly), compare this week vs last week (or month vs month), drill into a tenant, and see a rule-based next-week / next-month projection with estimated percentage rent. Replaces the Excel + email workflow.

Plan and specs live in [`/docs`](docs/). v1 is demo-first: no login (see `docs/TASKS.md` Sprint 4 for the lock-down).

## Screens

| Route | What it does |
|---|---|
| `/` | Portfolio dashboard — today / week-to-date / month-to-date GTO, this-week-vs-last-week chart, top tenants (click a bar to drill in), 14-day trend |
| `/daily-report` | Week-over-week or month-over-month comparison, portfolio or a single tenant, day-by-day and per-tenant tables |
| `/tenants` | Tenant list with 14-day sparkline and next-week projection; add / edit / delete |
| `/tenants/[id]` | KPIs, weekly + monthly projection cards (save snapshot), hourly breakdown, all sales records with edit / delete |
| `/projections` | Portfolio projection table, est. % rent, saved snapshots with approve / delete |
| `/import` | CSV upload → validated preview → confirm batch import |

“Add Sales” is on every page and persists straight to `sales_records`; every screen re-renders from the database.

## Rules baked in

- Business days are bucketed in Malaysia time (UTC+8). Daily figures = hourly + daily records; weekly / monthly records are period summaries and are listed on the tenant page, not spread across days.
- Projection (`lib/logic/projection.ts`): weekly = trailing 7-day average × 7, confidence 0.7 with ≥ 4 days of data else 0.4; monthly = trailing 28-day average × days in next month, confidence 0.8 with ≥ 21 days else 0.5. The average is over days that reported sales.
- `amount ≥ 0` is enforced in the form, the server action and a DB check constraint.

## Setup

1. **Database** — run `supabase/migrations/0001_init.sql` once in the Supabase SQL editor (or `supabase db push`). It is idempotent and seeds five demo tenants with 14 days of sales.
2. **Env** — `vercel link && vercel env pull .env.local` (needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
3. `bun install && bun dev` → http://localhost:3000
4. `bun run test` runs the logic unit tests (Vitest).

Deploy by pushing to `main`; Vercel builds from GitHub.

## Layout

```
app/            routes + server actions (app/actions.ts)
components/     Sidebar, SalesForm, Charts (Recharts), TenantForm, CsvImport, …
lib/data/       Supabase reads/writes (server-only)
lib/logic/      dates (MYT), aggregation, projection, validation, CSV parsing
supabase/       migrations
__tests__/      Vitest unit tests
```

# Architecture

## Stack
Next.js (App Router) + Supabase (Postgres) + Vercel. Charts via Recharts.

## Build Sequencing
- **Now:** Sales capture form, daily comparison graph, portfolio dashboard, basic projection.
- **Next:** Weekly/monthly trend views, CSV import, tenant-level drill-down.
- **Later:** Auth + per-user RLS, AI anomaly detection, email alerts, percentage-rent calc.

## Key User Action Flow (Daily Report)
1. Analyst opens `/` (portfolio dashboard).
2. Sees today's total GTO + line chart (this week vs last week, daily).
3. Clicks a tenant bar → tenant detail with hourly breakdown + projection.
4. Clicks "Add Sales" → enters amount + period → record persists → graph refreshes.

## Nav Shell
Left sidebar (desktop): Dashboard, Tenants, Daily Report, Projections. Collapses to hamburger on mobile. Current section highlighted.

## Layer Plan
1. **Data layer** (`lib/data/`): all Supabase reads/writes. Typed functions for tenants, sales, reports, projections.
2. **App logic** (`lib/logic/`): aggregation queries, projection math (trailing average).
3. **UI** (`app/` + `components/`): server components fetch via data layer; client components for forms/charts.
4. **Intelligence** (`lib/ai/`): later — anomaly flagging, smarter projections.

## Why Core Runs Without AI
Projection v1 uses trailing-7-day average math — pure SQL/JS. Anomaly detection and enhanced forecasting are additive layers, not required for the daily report graph.

## Repo Structure
```
app/
  dashboard/page.tsx
  tenants/page.tsx
  tenants/[id]/page.tsx
  daily-report/page.tsx
  projections/page.tsx
components/
  Sidebar.tsx
  SalesChart.tsx
  SalesForm.tsx
  TenantCard.tsx
lib/
  data/        # supabase queries
  logic/       # aggregation, projection
  ai/          # later
__tests__/
```

## Module Map
| Module | Responsibility | Owns | Build Order |
|--------|---------------|------|-------------|
| data-sales | DB access for tenants + sales records | tenants, sales_records tables | 1st |
| daily-report | Aggregate + chart daily GTO vs prior period | computed daily view | 2nd |
| projection | Trailing-average next-week estimate | projections (derived) | 3rd |
| dashboard | Portfolio overview + top tenants | composite read | 4th |

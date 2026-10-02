# Tenant Monthly GTO — PRD

## Problem
Leasing & Finance departments track tenant Gross Turnover (GTO) sales via Excel sheets and email. Sales data arrives at varying cadences (hourly, daily, weekly, monthly) but there's no live comparison or projection — just stale spreadsheets.

## Target User
Leasing & Finance staff who monitor tenant sales performance and project future GTO for rent calculations (percentage-rent tenants).

## Core Objects
- **Tenant** — name, category, unit, percentage-rent rate.
- **SalesRecord** — tenant_id, period (hour/day/week/month), amount, recorded_at, source (manual/import).
- **DailyReport** — aggregated daily sales per tenant with trend vs previous period.
- **Projection** — projected weekly/monthly GTO per tenant (rule-based baseline; AI-enhanced later).

## MVP (v1) — Checklist
- [ ] Capture a sales record (manual entry) per tenant at hourly/daily/weekly/monthly granularity.
- [ ] Daily sales graph comparing today vs yesterday (or week-over-week) per tenant or portfolio.
- [ ] Portfolio dashboard: total daily GTO, top tenants, trend line.
- [ ] Simple projection: next-week GTO estimate based on trailing average.
- [ ] All screens viewable without login (demo-first with seed tenants + sales).

## Non-goals (v1)
- No auth / login.
- No percentage-rent invoicing.
- No multi-mall/portfolio support beyond a single property.
- No email or PDF exports.

## Success Criteria
A leasing analyst opens the app, sees the Daily Report graph comparing this week's daily GTO vs last week's, drills into one tenant, and sees an auto-projected figure for next week — all without logging in. They can add a new sales record and it immediately updates the graph.

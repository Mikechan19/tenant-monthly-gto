# Tenant GTO

Sales tracking for SPSB Leasing & Finance: capture tenant GTO (hourly / daily / weekly / monthly), compare this week vs last week (or month vs month), drill into a tenant, and see a rule-based next-week / next-month projection with estimated percentage rent. Replaces the Excel + email workflow.

Plan and specs live in [`/docs`](docs/). Since Sprint 4 the app requires sign-in and every team (e.g. “SPSB Leasing”) gets its own walled-off workspace — see [Teams & login](#teams--login).

## Screens

| Route | What it does |
|---|---|
| `/` | Portfolio dashboard — today / week-to-date / month-to-date GTO, this-week-vs-last-week chart, top tenants (click a bar to drill in), 14-day trend |
| `/daily-report` | Week-over-week or month-over-month comparison, portfolio or a single tenant, day-by-day and per-tenant tables |
| `/tenants` | Tenant list with 14-day sparkline and next-week projection; add / edit / delete |
| `/tenants/[id]` | KPIs, weekly + monthly projection cards (save snapshot), hourly breakdown, all sales records with edit / delete |
| `/projections` | Portfolio projection table, est. % rent, saved snapshots with approve / delete |
| `/import` | CSV upload → validated preview → confirm batch import |
| `/team` | Members + roles, invite by email (copyable link), pending invites, rename, create another team, leave |
| `/login`, `/signup` | Email + password, or a magic link; `/auth/callback` finishes email links |
| `/onboarding` | First sign-in with no team: create one, or accept invites sent to your email |
| `/invite/<token>` | Accept an invite (must be signed in with the invited email) |

“Add Sales” is on every page and persists straight to `sales_records`; every screen re-renders from the database.

## Rules baked in

- Business days are bucketed in Malaysia time (UTC+8). Daily figures = hourly + daily records; weekly / monthly records are period summaries and are listed on the tenant page, not spread across days.
- Projection (`lib/logic/projection.ts`): weekly = trailing 7-day average × 7, confidence 0.7 with ≥ 4 days of data else 0.4; monthly = trailing 28-day average × days in next month, confidence 0.8 with ≥ 21 days else 0.5. The average is over days that reported sales.
- `amount ≥ 0` is enforced in the form, the server action and a DB check constraint.

## Setup

1. **Database** — in the Supabase SQL editor run, in order:
   1. `supabase/migrations/0001_init.sql` (skip if already applied — it is idempotent and seeds five demo tenants with 14 days of sales), then
   2. `supabase/migrations/0002_teams.sql` — teams, roles, invites and per-team RLS (idempotent; see below for what it does to existing data).

   Run 0002 and deploy this code together: after 0002 the old code can't read or write anything (anon access is revoked).
2. **Supabase Auth settings** (Dashboard → Authentication):
   - *Sign In / Providers → Email*: enabled; keep **Confirm email ON** (invite acceptance requires a confirmed email).
   - *URL Configuration*: **Site URL** `https://tenant-monthly-gto.vercel.app`; add **Redirect URL** `https://tenant-monthly-gto.vercel.app/auth/callback` (and `http://localhost:3000/auth/callback` for local dev).
   - The built-in Supabase mailer is rate-limited (a few emails/hour); for real use set up custom SMTP under *Emails → SMTP Settings*.
3. **Claim the demo workspace** (optional — keeps the existing data): sign up in the app, then in the SQL editor run
   ```sql
   select public.add_team_member_by_email('00000000-0000-4000-8000-00000000d0e0', 'you@selangorproperties.com.my', 'admin');
   ```
   You're now admin of “Demo workspace” (rename it on `/team`) and can invite colleagues to it.
4. **Env** — `vercel link && vercel env pull .env.local` (needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
5. `bun install && bun dev` → http://localhost:3000
6. `bun run test` runs the logic unit tests (Vitest). RLS tests: `PGHOST=… PGPORT=… PGUSER=postgres bash supabase/tests/run.sh` builds a scratch Postgres database with an auth stub, applies the migrations (0002 twice) and runs `supabase/tests/rls_test.sql`.

Deploy by pushing to `main`; Vercel builds from GitHub.

## Teams & login

- **Sign-in**: email + password (signup sends a confirmation link) or a magic link. Every page except `/login`, `/signup`, `/auth/*`, `/api/health` and the Stripe webhook redirects signed-out visitors to `/login?next=…` (API routes return 401).
- **Workspaces**: each team has its own tenants, sales and projections. A user can belong to several teams; the active one is kept in a cookie and switched from the sidebar. All reads and writes are filtered by the active `team_id`, and Postgres RLS independently restricts rows to teams you belong to.
- **Roles**: **admin** (everything + manage members and invites), **analyst** (add/edit/import sales, tenants, projections), **viewer** (read-only — write buttons are hidden and server actions + RLS refuse writes). A team always keeps at least one admin.
- **Invites**: an admin enters a colleague's email + role on `/team`. The app does **not** send email — copy the `/invite/<token>` link and send it yourself. The colleague signs in or signs up **with that email** (confirmed), then accepts; invites addressed to them also appear on `/onboarding`. Admins can revoke pending invites.
- **Demo workspace**: 0002 moves all pre-existing rows into a team called “Demo workspace” that starts with no members, so nobody (including the public) can see it until you claim it with the SQL snippet above. New signups never see it unless an admin invites them.

### What `0002_teams.sql` does to live data
Creates `teams`, `team_members`, `team_invites`; adds `team_id` (NOT NULL, FK → teams, cascade) to `tenants`, `sales_records`, `projections` and backfills every existing row into the Demo workspace (nothing is deleted); drops the permissive v1 policies; revokes all `anon` table access; installs member/writer/admin RLS policies, `SECURITY DEFINER` helpers (`is_team_member`, `can_write_team`, `is_team_admin`, `team_role`) and RPCs (`create_team`, `accept_invite`, `accept_my_invites`, `my_pending_invites`, `invite_preview`, `team_member_list`). `add_team_member_by_email` is SQL-editor only. `0001_init.sql` now skips its permissive policies and seed once teams exist, so re-running it can't reopen access.

## Layout

```
app/            routes + server actions (app/actions.ts)
components/     Sidebar, SalesForm, Charts (Recharts), TenantForm, CsvImport, …
lib/data/       Supabase reads/writes (server-only)
lib/logic/      dates (MYT), aggregation, projection, validation, CSV parsing
supabase/       migrations; tests/ = RLS test script + auth stub + runner
__tests__/      Vitest unit tests
e2e/            browser E2E for login + teams (needs a local GoTrue/PostgREST stack; not run in CI)
```

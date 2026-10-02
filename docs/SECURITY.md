# Security

## Secret Handling
- Supabase keys: service-role key server-only (never in client bundle). Client uses anon key + RLS.
- `.env.local` for local; Vercel env vars for prod. Never commit secrets.

## Permission Model
- **v1 (demo-first):** RLS enabled but permissive — all tables readable/writable by anyone. Seed data renders without login.
- **Sprint 4 (implemented):** Supabase Auth sign-in required; per-**team** RLS (see DATA_MODEL.md). Roles: admin / analyst / viewer. The app talks to Postgres only through the anon key + the user's session cookie (`@supabase/ssr`), so RLS is the enforcement point; server actions additionally reject viewers, and the UI hides write controls. Invites are accepted only by a signed-in user whose **confirmed** email matches the invite. The service-role key is not used by the app.
- Agent (later) inherits caller's permissions — can never exceed what the user can do.

## Approved-Tools Rule
- Agent may only call named, pre-approved tools (`generate_projection`, `import_sales_batch`). No raw `run_any` / `send_any`.
- Each tool has a declared risk level and approval gate.

## Audit Principle
Every meaningful action (projection gen, batch import, email send) is logged. Logs are append-only.

## Data Integrity
- `sales_records.amount` must be ≥ 0 (DB check constraint).
- `period_type` constrained to enum values.
- Projection `confidence` range 0–1.

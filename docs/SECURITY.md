# Security

## Secret Handling
- Supabase keys: service-role key server-only (never in client bundle). Client uses anon key + RLS.
- `.env.local` for local; Vercel env vars for prod. Never commit secrets.

## Permission Model
- **v1 (demo-first):** RLS enabled but permissive — all tables readable/writable by anyone. Seed data renders without login.
- **Lock-down sprint:** per-user RLS — `auth.uid() = user_id` on all tables. Users see only their own tenants/sales.
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

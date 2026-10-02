# Data Model

## tenants
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| name | text | tenant display name |
| category | text | e.g. F&B, Fashion, Electronics |
| unit | text | mall unit number |
| rent_rate_pct | numeric | percentage of GTO for rent (nullable) |
| user_id | uuid | nullable (owner scope later) |
| created_at | timestamptz | default now() |

## sales_records
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| tenant_id | uuid | FK -> tenants.id (logical, no FK constraint in demo) |
| period_type | text | 'hourly' / 'daily' / 'weekly' / 'monthly' |
| amount | numeric | sales value in currency |
| recorded_at | timestamptz | when the sale period occurred |
| source | text | 'manual' / 'import' (later) |
| user_id | uuid | nullable (owner scope later) |
| created_at | timestamptz | default now() |

## projections (v1 — derived in app logic; table for persistence later)
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| tenant_id | uuid | FK logical |
| target_period | text | 'weekly' / 'monthly' |
| projected_amount | numeric | estimated GTO |
| method | text | 'trailing_avg_7d' |
| confidence | numeric | 0–1 (AI-enhanced later) |
| source | text | 'rule_based' / 'ai' |
| review_status | text | 'unreviewed' / 'approved' |
| user_id | uuid | nullable |
| created_at | timestamptz | default now() |

## Lease & GTO terms (`0003_gto_terms.sql`)
| Table | Field | Notes |
|-------|-------|-------|
| tenants | property | text ≤ 120, e.g. the mall or building |
| tenants | base_rent_monthly | numeric ≥ 0, RM per month |
| tenants | gto_tiers | jsonb `[{"up_to": 400000, "rate": 0}, {"up_to": null, "rate": 0.03}]` — marginal bands on monthly gross sales; ascending `up_to`, last null, 0 ≤ rate ≤ 1 (CHECK via `valid_gto_tiers`). Null → `rent_rate_pct` as one flat band |
| tenants | gto_sst_pct | numeric 0–100, default 0 (e.g. 8) |
| tenants | lease_start, lease_end | date, end ≥ start |
| sales_records | outlet | text 1–80, nullable — outlets of one tenant are summed for GTO |

## Relationships
- tenants 1 → many sales_records
- tenants 1 → many projections

## teams / team_members / team_invites (Sprint 4 — `0002_teams.sql`)
| Table | Fields |
|-------|--------|
| teams | id uuid PK, name text (1–80), created_by uuid → auth.users, created_at |
| team_members | (team_id, user_id) PK, role `admin`/`analyst`/`viewer`, created_at |
| team_invites | id, team_id, email (lower-case), role, token (unique, 48 hex), invited_by, accepted_at, accepted_by, created_at; one open invite per (team, email) |

`tenants`, `sales_records`, `projections` gain `team_id uuid not null → teams(id) on delete cascade` (indexed); `user_id` now defaults to `auth.uid()` (informational — access is by team). `team_id` can't be changed after insert (trigger). Demo workspace id: `00000000-0000-4000-8000-00000000d0e0`.

## RLS Notes
- v1 (0001): permissive policies — removed by 0002.
- Since 0002: `anon` has no table access. Members of a team can read its rows; admins + analysts can insert/update/delete; viewers are read-only. Sales/projections must reference a tenant of the same team. Only admins read/manage `team_members` writes and `team_invites`; anyone may delete their own membership (leave). A team always keeps ≥ 1 admin (trigger). Policies call `SECURITY DEFINER` helpers with `search_path = ''`.

## AI Field Convention
`projected_amount` carries `source`, `confidence`, `review_status` when AI-generated. Rule-based projections: source='rule_based', confidence=null, review_status='unreviewed'.

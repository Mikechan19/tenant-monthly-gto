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

## Relationships
- tenants 1 → many sales_records
- tenants 1 → many projections

## RLS Notes
- All tables: RLS enabled, permissive v1 policies (read+write for all) — demo-first.
- Lock-down sprint: replace with `auth.uid() = user_id` policies.

## AI Field Convention
`projected_amount` carries `source`, `confidence`, `review_status` when AI-generated. Rule-based projections: source='rule_based', confidence=null, review_status='unreviewed'.

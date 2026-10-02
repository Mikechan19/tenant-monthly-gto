# Agentic Layer

## Risk Levels

### Low (auto) — v1
- Generate weekly/monthly projection from trailing average.
- Tag projection with confidence + review_status.
- Aggregate daily report.

### Medium (light approval) — later
- Create sales record from CSV import (analyst confirms batch before commit).
- Update projection method setting.

### High (always approval) — later
- Send weekly GTO summary email to stakeholders.
- Adjust tenant rent_rate_pct.

### Critical (human-only) — later
- Delete sales records (bulk).
- Export financial data externally.

## Named Tools (later)
- `generate_projection(tenant_id, period)` — low risk, auto.
- `import_sales_batch(rows[])` — medium, needs confirm.
- `send_gto_summary(recipients[])` — high, needs approval.

## v1: No agentic actions executed automatically beyond projection generation (read-only computation). All data writes are direct user actions (form submit).

## Audit Log Fields (later)
| Field | Type |
|-------|------|
| id | uuid |
| action | text |
| actor | text |
| target_type | text |
| target_id | uuid |
| risk_level | text |
| status | text |
| created_at | timestamptz |

## Audit Principle
Every automated write or approved action is logged with actor, action, target, and timestamp.

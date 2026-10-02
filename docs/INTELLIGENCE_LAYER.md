# Intelligence Layer

## Messy Inputs
Manual sales entry: analyst types amount, picks tenant + period. No natural language in v1. Later: paste an email or CSV → auto-extract rows.

## Auto-Structure (later, CSV/email import)
```json
{
  "raw": "Tenant: Starbucks, Day: 2024-01-15, Sales: $3,200",
  "structured": {
    "tenant_name": "Starbucks",
    "period_type": "daily",
    "amount": 3200,
    "recorded_at": "2024-01-15T00:00:00Z"
  },
  "confidence": 0.95,
  "source": "csv_import",
  "review_status": "unreviewed"
}
```

## Events to Track
- `sales_record.created`
- `projection.generated`
- `daily_report.viewed` (for usage analytics later)

## Scoring Rules (rule-based v1)
- **Projection (weekly):** trailing 7-day average × 1.0. Confidence = 0.7 if ≥4 days of data, else 0.4.
- **Projection (monthly):** trailing 28-day average. Confidence = 0.8 if ≥21 days, else 0.5.
- **Anomaly flag (later):** |today - trailing_avg| > 2σ → flagged.

## What Gets Ranked
- Tenants ranked by daily GTO contribution (dashboard).
- Projections ranked by confidence (later).

## v1 vs Later
- **v1:** trailing-average projection, no anomaly detection, no import.
- **Later:** AI-enhanced projection (seasonality), anomaly alerts, CSV/email import with auto-structuring.

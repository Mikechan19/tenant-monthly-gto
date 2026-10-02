# Test Plan

## v1 Success Scenario
1. Open `/` without login → portfolio dashboard loads with seed data (total GTO, top tenants, trend chart).
2. Click "Daily Report" in sidebar → line chart shows this week vs last week daily GTO.
3. Click "Add Sales" → select tenant "Coffee House", period "daily", amount "1500", date today → submit.
4. Chart refreshes; today's point updates to include the new record.
5. Verify total on dashboard reflects new record.

## Empty State
- Clear all sales_records for a tenant → tenant detail shows "No sales recorded yet" with empty-state illustration and CTA.
- New install with no data → dashboard shows "No tenants yet" with add-tenant prompt.

## Error State
- Submit sales form with amount = -100 → blocked by DB check constraint, form shows "Amount must be 0 or greater."
- Submit without selecting tenant → client validation: "Please select a tenant."

## Loading State
- Charts show skeleton/spinner while Supabase query resolves.

## Projection (Sprint 2)
- Tenant with 5 days of data → projection shows trailing average, confidence 0.7.
- Tenant with 1 day of data → confidence 0.4, projection labelled "low confidence."
- Tenant with no data → "Not enough data to project."

## Auth (Sprint 4)
- New signup → no tenants visible (empty state).
- Demo user login → sees seed tenants.
- Anonymous access → redirected to /login.

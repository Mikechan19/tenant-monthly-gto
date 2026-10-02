-- Tenant GTO — lease & turnover-rent (GTO) terms, outlets.
--
-- Runs AFTER 0002_teams.sql. Additive only and idempotent (safe to re-run): no existing column,
-- row or policy is changed. Existing team RLS policies on tenants / sales_records cover the new
-- columns automatically (policies are row-level; table grants already include them).
--
-- tenants.gto_tiers — marginal turnover-rent bands on MONTHLY gross sales, e.g.
--   [{"up_to": 400000, "rate": 0}, {"up_to": null, "rate": 0.03}]
--   = 0% on the first RM 400,000, 3% on everything above. `up_to` is the band's upper bound in RM
--   (strictly ascending), the last band is open-ended (`up_to` null), `rate` is a fraction 0..1.
--   When gto_tiers is null the app falls back to rent_rate_pct as one flat band (rate = pct / 100).
-- tenants.gto_sst_pct — SST charged on the turnover rent (e.g. 8 → GTO × 1.08). Default 0.

-- Validator used by the check constraint (IMMUTABLE so it can back a CHECK).
create or replace function public.valid_gto_tiers(p jsonb)
returns boolean language plpgsql immutable set search_path = ''
as $$
declare
  n int;
  i int;
  el jsonb;
  prev numeric := 0;
  up numeric;
  rate numeric;
begin
  if p is null then return true; end if;
  if jsonb_typeof(p) <> 'array' then return false; end if;
  n := jsonb_array_length(p);
  if n < 1 or n > 20 then return false; end if;
  for i in 0 .. n - 1 loop
    el := p -> i;
    if jsonb_typeof(el) <> 'object' then return false; end if;
    if jsonb_typeof(el -> 'rate') is distinct from 'number' then return false; end if;
    rate := (el ->> 'rate')::numeric;
    if rate < 0 or rate > 1 then return false; end if;
    if i < n - 1 then
      -- every band but the last needs a numeric upper bound above the previous one
      if jsonb_typeof(el -> 'up_to') is distinct from 'number' then return false; end if;
      up := (el ->> 'up_to')::numeric;
      if up <= prev then return false; end if;
      prev := up;
    else
      -- last band is open-ended
      if el ? 'up_to' and jsonb_typeof(el -> 'up_to') <> 'null' then return false; end if;
    end if;
  end loop;
  return true;
end;
$$;
grant execute on function public.valid_gto_tiers(jsonb) to authenticated;

alter table public.tenants add column if not exists property text;
alter table public.tenants add column if not exists base_rent_monthly numeric;
alter table public.tenants add column if not exists gto_tiers jsonb;
alter table public.tenants add column if not exists gto_sst_pct numeric not null default 0;
alter table public.tenants add column if not exists lease_start date;
alter table public.tenants add column if not exists lease_end date;
alter table public.sales_records add column if not exists outlet text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tenants_gto_tiers_valid') then
    alter table public.tenants add constraint tenants_gto_tiers_valid check (public.valid_gto_tiers(gto_tiers));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tenants_gto_sst_pct_range') then
    alter table public.tenants add constraint tenants_gto_sst_pct_range check (gto_sst_pct >= 0 and gto_sst_pct <= 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tenants_base_rent_nonneg') then
    alter table public.tenants add constraint tenants_base_rent_nonneg check (base_rent_monthly is null or base_rent_monthly >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tenants_lease_dates_order') then
    alter table public.tenants add constraint tenants_lease_dates_order
      check (lease_start is null or lease_end is null or lease_end >= lease_start);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tenants_property_len') then
    alter table public.tenants add constraint tenants_property_len check (property is null or char_length(property) <= 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sales_records_outlet_len') then
    alter table public.sales_records add constraint sales_records_outlet_len
      check (outlet is null or char_length(btrim(outlet)) between 1 and 80);
  end if;
end $$;

-- Monthly GTO screen reads a tenant's records for a year; outlet lookups for the Add Sales datalist.
create index if not exists sales_records_team_tenant_period_idx
  on public.sales_records (team_id, tenant_id, period_type, recorded_at);

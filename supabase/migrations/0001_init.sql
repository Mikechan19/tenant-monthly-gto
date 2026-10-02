-- Tenant Monthly GTO — initial schema (demo-first, permissive RLS)
-- Safe to re-run: tables use IF NOT EXISTS and seed rows are inserted only when absent.

create extension if not exists pgcrypto;

-- ── tenants ────────────────────────────────────────────────────────────────
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  name text not null,
  category text,
  unit text,
  rent_rate_pct numeric check (rent_rate_pct is null or (rent_rate_pct >= 0 and rent_rate_pct <= 100)),
  created_at timestamptz not null default now()
);
alter table tenants enable row level security;
drop policy if exists "tenants_v1_read" on tenants;
create policy "tenants_v1_read" on tenants for select using (true);
drop policy if exists "tenants_v1_write" on tenants;
create policy "tenants_v1_write" on tenants for all using (true) with check (true);

-- ── sales_records ──────────────────────────────────────────────────────────
create table if not exists sales_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  tenant_id uuid not null,
  period_type text not null check (period_type in ('hourly','daily','weekly','monthly')),
  amount numeric not null check (amount >= 0),
  recorded_at timestamptz not null default now(),
  source text default 'manual',
  created_at timestamptz not null default now()
);
create index if not exists sales_records_tenant_recorded_idx on sales_records (tenant_id, recorded_at);
create index if not exists sales_records_recorded_idx on sales_records (recorded_at);
alter table sales_records enable row level security;
drop policy if exists "sales_records_v1_read" on sales_records;
create policy "sales_records_v1_read" on sales_records for select using (true);
drop policy if exists "sales_records_v1_write" on sales_records;
create policy "sales_records_v1_write" on sales_records for all using (true) with check (true);

-- ── projections ────────────────────────────────────────────────────────────
create table if not exists projections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  tenant_id uuid not null,
  target_period text not null check (target_period in ('weekly','monthly')),
  projected_amount numeric not null,
  method text default 'trailing_avg_7d',
  confidence numeric check (confidence >= 0 and confidence <= 1),
  source text default 'rule_based',
  review_status text default 'unreviewed',
  created_at timestamptz not null default now()
);
alter table projections enable row level security;
drop policy if exists "projections_v1_read" on projections;
create policy "projections_v1_read" on projections for select using (true);
drop policy if exists "projections_v1_write" on projections;
create policy "projections_v1_write" on projections for all using (true) with check (true);

-- ── seed (demo placeholders — fully editable/deletable in the app) ─────────
insert into tenants (name, category, unit, rent_rate_pct)
select v.name, v.category, v.unit, v.rate
from (values
  ('Coffee House',  'F&B',         'A-12', 8.0),
  ('Urban Fashion', 'Fashion',     'B-05', 6.5),
  ('Tech World',    'Electronics', 'C-03', 5.0),
  ('Green Grocer',  'Grocery',     'A-08', 4.5),
  ('PlayZone Toys', 'Kids',        'D-10', 7.0)
) as v(name, category, unit, rate)
where not exists (select 1 from tenants t where t.name = v.name);

-- 14 days of daily GTO (days -13 .. -1) for three tenants, so this-week vs last-week has data.
-- Recorded at 12:00 Malaysia time (04:00 UTC) of each day.
insert into sales_records (tenant_id, period_type, amount, recorded_at, source)
select t.id, 'daily',
       round((b.base * (1 + 0.08 * sin(d.n * 1.3) + case when extract(isodow from (current_date - d.n)) in (6,7) then 0.18 else 0 end))::numeric, 2),
       ((current_date - d.n)::timestamp + interval '4 hours') at time zone 'UTC',
       'manual'
from tenants t
join (values ('Coffee House', 3200), ('Urban Fashion', 5100), ('Tech World', 8300)) as b(name, base) on b.name = t.name
cross join generate_series(1, 13) as d(n)
where not exists (select 1 from sales_records s where s.tenant_id = t.id);

-- Today: Coffee House reports hourly (10:00–17:00 MYT); Urban Fashion & Tech World report a daily figure.
insert into sales_records (tenant_id, period_type, amount, recorded_at, source)
select t.id, 'hourly', h.amt,
       (current_date::timestamp + make_interval(hours => h.hr - 8)) at time zone 'UTC',
       'manual'
from tenants t
cross join (values (10, 260), (11, 410), (12, 620), (13, 580), (14, 390), (15, 450), (16, 510), (17, 480)) as h(hr, amt)
where t.name = 'Coffee House'
  and not exists (select 1 from sales_records s where s.tenant_id = t.id and s.period_type = 'hourly');

insert into sales_records (tenant_id, period_type, amount, recorded_at, source)
select t.id, 'daily', v.amt, (current_date::timestamp + interval '4 hours') at time zone 'UTC', 'manual'
from tenants t
join (values ('Urban Fashion', 5800), ('Tech World', 9000)) as v(name, amt) on v.name = t.name
where not exists (
  select 1 from sales_records s
  where s.tenant_id = t.id and s.recorded_at >= (current_date::timestamp - interval '8 hours') at time zone 'UTC'
);

-- Green Grocer: a single day of data (shows a low-confidence projection). PlayZone Toys: none (empty state).
insert into sales_records (tenant_id, period_type, amount, recorded_at, source)
select t.id, 'daily', 2100, ((current_date - 1)::timestamp + interval '4 hours') at time zone 'UTC', 'manual'
from tenants t
where t.name = 'Green Grocer' and not exists (select 1 from sales_records s where s.tenant_id = t.id);

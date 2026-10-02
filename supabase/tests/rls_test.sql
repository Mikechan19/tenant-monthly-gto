-- RLS / RPC tests for 0002_teams.sql. Run against a scratch database (NOT a real project):
--   createdb teams_test
--   psql -d teams_test -f supabase/tests/auth_stub.sql
--   psql -d teams_test -f supabase/migrations/0001_init.sql
--   psql -d teams_test -f supabase/migrations/0002_teams.sql   (twice, to prove idempotency)
--   psql -d teams_test -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
-- or simply: bash supabase/tests/run.sh
-- Each assertion prints PASS/FAIL; the script exits non-zero if anything failed.
\set QUIET on
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

reset role;
drop schema if exists rlstest cascade;
create schema rlstest;
create table rlstest.results (n serial, name text, pass boolean, detail text);
grant usage on schema rlstest to anon, authenticated;
grant all on rlstest.results to anon, authenticated;
grant all on sequence rlstest.results_n_seq to anon, authenticated;
create table rlstest.ids (k text primary key, v text);
grant all on rlstest.ids to anon, authenticated;

create function rlstest.ok(p_name text, p_cond boolean, p_detail text default null) returns void
language plpgsql as $$
begin
  insert into rlstest.results (name, pass, detail) values (p_name, coalesce(p_cond, false), p_detail);
  raise notice '% %', case when coalesce(p_cond, false) then 'PASS' else 'FAIL' end, p_name;
end $$;

-- Runs SQL as the current role; returns affected row count, -1 if it was refused (permission denied,
-- RLS violation, constraint/trigger/RPC rejection), or -2 for any other error (e.g. a typo in the test
-- itself), so a broken test can never pass as "denied".
create function rlstest.rows(p_sql text) returns integer language plpgsql as $$
declare n integer;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
exception when others then
  if sqlstate in ('42501', '22023', 'P0001', 'P0002') or sqlstate like '23%' then
    raise notice '  refused [%] %', sqlstate, sqlerrm;
    return -1;
  end if;
  raise notice '  UNEXPECTED ERROR [%] %', sqlstate, sqlerrm;
  return -2;
end $$;

-- Returns the error message an SQL statement raises (null if it succeeded).
create function rlstest.err(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlerrm;
end $$;

create function rlstest.id(p_k text) returns uuid language sql stable as $$ select v::uuid from rlstest.ids where k = p_k $$;
create function rlstest.txt(p_k text) returns text language sql stable as $$ select v from rlstest.ids where k = p_k $$;
grant execute on all functions in schema rlstest to anon, authenticated;

-- Test users (alice/dave admins of separate teams; bob viewer, carol analyst; eve outsider; mallory unconfirmed)
delete from auth.users where email like '%@rls.test';
insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-4000-8000-000000000001', 'alice@rls.test',   now()),
  ('b0000000-0000-4000-8000-000000000002', 'bob@rls.test',     now()),
  ('c0000000-0000-4000-8000-000000000003', 'carol@rls.test',   now()),
  ('d0000000-0000-4000-8000-000000000004', 'dave@rls.test',    now()),
  ('e0000000-0000-4000-8000-000000000005', 'eve@rls.test',     now()),
  ('f0000000-0000-4000-8000-000000000006', 'mallory@rls.test', null);
delete from public.teams where name like 'RLS %';

\set as_anon 'reset role; do $c$ begin perform set_config(''request.jwt.claims'', ''{"role":"anon"}'', false); end $c$; set role anon;'
\set as_alice 'reset role; do $c$ begin perform set_config(''request.jwt.claims'', ''{"sub":"a0000000-0000-4000-8000-000000000001","email":"alice@rls.test","role":"authenticated"}'', false); end $c$; set role authenticated;'
\set as_bob 'reset role; do $c$ begin perform set_config(''request.jwt.claims'', ''{"sub":"b0000000-0000-4000-8000-000000000002","email":"bob@rls.test","role":"authenticated"}'', false); end $c$; set role authenticated;'
\set as_carol 'reset role; do $c$ begin perform set_config(''request.jwt.claims'', ''{"sub":"c0000000-0000-4000-8000-000000000003","email":"carol@rls.test","role":"authenticated"}'', false); end $c$; set role authenticated;'
\set as_dave 'reset role; do $c$ begin perform set_config(''request.jwt.claims'', ''{"sub":"d0000000-0000-4000-8000-000000000004","email":"dave@rls.test","role":"authenticated"}'', false); end $c$; set role authenticated;'
\set as_eve 'reset role; do $c$ begin perform set_config(''request.jwt.claims'', ''{"sub":"e0000000-0000-4000-8000-000000000005","email":"eve@rls.test","role":"authenticated"}'', false); end $c$; set role authenticated;'
\set as_mallory 'reset role; do $c$ begin perform set_config(''request.jwt.claims'', ''{"sub":"f0000000-0000-4000-8000-000000000006","email":"mallory@rls.test","role":"authenticated"}'', false); end $c$; set role authenticated;'
\set as_super 'reset role; do $c$ begin perform set_config(''request.jwt.claims'', '''', false); end $c$;'

-- ── migration sanity ───────────────────────────────────────────────────────
:as_super
select rlstest.ok('migration: no permissive v1 policies remain',
  not exists (select 1 from pg_policies where policyname like '%\_v1\_%'));
select rlstest.ok('migration: every existing row was backfilled into a team',
  not exists (select 1 from tenants where team_id is null)
  and not exists (select 1 from sales_records where team_id is null)
  and not exists (select 1 from projections where team_id is null));
select rlstest.ok('migration: demo data kept in Demo workspace',
  (select count(*) from tenants where team_id = '00000000-0000-4000-8000-00000000d0e0') >= 5);
select rlstest.ok('migration: demo workspace starts with no members',
  not exists (select 1 from team_members where team_id = '00000000-0000-4000-8000-00000000d0e0'));

-- ── anon gets nothing ──────────────────────────────────────────────────────
:as_anon
select rlstest.ok('anon: select tenants is denied',       rlstest.rows('select * from public.tenants') = -1);
select rlstest.ok('anon: select sales_records is denied', rlstest.rows('select * from public.sales_records') = -1);
select rlstest.ok('anon: select projections is denied',   rlstest.rows('select * from public.projections') = -1);
select rlstest.ok('anon: select teams is denied',         rlstest.rows('select * from public.teams') = -1);
select rlstest.ok('anon: insert tenant is denied',
  rlstest.rows($$insert into public.tenants (name, team_id) values ('x', '00000000-0000-4000-8000-00000000d0e0')$$) = -1);
select rlstest.ok('anon: create_team() not executable',   rlstest.rows($$select public.create_team('RLS anon')$$) = -1);
select rlstest.ok('anon: invite_preview() not executable', rlstest.rows($$select * from public.invite_preview('x')$$) = -1);

-- ── team creation ──────────────────────────────────────────────────────────
:as_alice
select rlstest.ok('alice: direct insert into teams is denied', rlstest.rows($$insert into public.teams (name) values ('RLS direct')$$) = -1);
insert into rlstest.ids values ('teamA', public.create_team('RLS Team A'));
select rlstest.ok('alice: create_team makes her admin', public.team_role(rlstest.id('teamA')) = 'admin');
select rlstest.ok('alice: sees exactly her one team', (select count(*) from public.teams) = 1);
select rlstest.ok('alice: demo data invisible to non-members', (select count(*) from public.tenants) = 0);
select rlstest.ok('alice: create_team rejects blank name', rlstest.rows($$select public.create_team('   ')$$) = -1);

with x as (insert into public.tenants (name, team_id) values ('A Coffee', rlstest.id('teamA')) returning id) insert into rlstest.ids select 'tenantA', id from x;
select rlstest.ok('alice (admin): insert tenant in own team', rlstest.id('tenantA') is not null);
select rlstest.ok('alice (admin): insert sales in own team',
  rlstest.rows(format($$insert into public.sales_records (team_id, tenant_id, period_type, amount) values (%L, %L, 'daily', 1000)$$, rlstest.id('teamA'), rlstest.id('tenantA'))) = 1);
select rlstest.ok('alice: user_id defaults to auth.uid()',
  (select user_id from public.sales_records where tenant_id = rlstest.id('tenantA') limit 1) = 'a0000000-0000-4000-8000-000000000001');
select rlstest.ok('alice: insert tenant with null team_id fails', rlstest.rows($$insert into public.tenants (name) values ('no team')$$) = -1);
select rlstest.ok('alice: insert tenant into Demo workspace (not a member) fails',
  rlstest.rows($$insert into public.tenants (name, team_id) values ('sneaky', '00000000-0000-4000-8000-00000000d0e0')$$) = -1);

:as_dave
insert into rlstest.ids values ('teamB', public.create_team('RLS Team B'));
with x as (insert into public.tenants (name, team_id) values ('B Shoes', rlstest.id('teamB')) returning id) insert into rlstest.ids select 'tenantB', id from x;

-- ── cross-team isolation ───────────────────────────────────────────────────
select rlstest.ok('dave: cannot read team A tenants', (select count(*) from public.tenants where team_id = rlstest.id('teamA')) = 0);
select rlstest.ok('dave: cannot read team A sales', (select count(*) from public.sales_records where team_id = rlstest.id('teamA')) = 0);
select rlstest.ok('dave: cannot read team A by tenant id', (select count(*) from public.tenants where id = rlstest.id('tenantA')) = 0);
select rlstest.ok('dave: sees only his team', (select count(*) from public.teams) = 1 and (select id from public.teams) = rlstest.id('teamB'));
select rlstest.ok('dave: cannot read team A members', (select count(*) from public.team_members where team_id = rlstest.id('teamA')) = 0);
select rlstest.ok('dave: team_member_list(team A) is empty', (select count(*) from public.team_member_list(rlstest.id('teamA'))) = 0);
select rlstest.ok('dave: update team A tenant affects 0 rows',
  rlstest.rows(format($$update public.tenants set name = 'hacked' where id = %L$$, rlstest.id('tenantA'))) = 0);
select rlstest.ok('dave: delete team A sales affects 0 rows',
  rlstest.rows(format($$delete from public.sales_records where team_id = %L$$, rlstest.id('teamA'))) = 0);
select rlstest.ok('dave: insert sales into team A fails',
  rlstest.rows(format($$insert into public.sales_records (team_id, tenant_id, period_type, amount) values (%L, %L, 'daily', 1)$$, rlstest.id('teamA'), rlstest.id('tenantA'))) = -1);
select rlstest.ok('dave: insert sales in own team pointing at team A tenant fails',
  rlstest.rows(format($$insert into public.sales_records (team_id, tenant_id, period_type, amount) values (%L, %L, 'daily', 1)$$, rlstest.id('teamB'), rlstest.id('tenantA'))) = -1);
select rlstest.ok('dave: add himself to team A fails',
  rlstest.rows(format($$insert into public.team_members (team_id, user_id, role) values (%L, auth.uid(), 'admin')$$, rlstest.id('teamA'))) = -1);
select rlstest.ok('dave: create invite for team A fails',
  rlstest.rows(format($$insert into public.team_invites (team_id, email, role) values (%L, 'dave@rls.test', 'admin')$$, rlstest.id('teamA'))) = -1);
select rlstest.ok('dave: rename team A affects 0 rows',
  rlstest.rows(format($$update public.teams set name = 'pwned' where id = %L$$, rlstest.id('teamA'))) = 0);
select rlstest.ok('dave: moving own tenant into team A fails',
  rlstest.rows(format($$update public.tenants set team_id = %L where id = %L$$, rlstest.id('teamA'), rlstest.id('tenantB'))) = -1);

:as_super
select rlstest.ok('team A data untouched by dave',
  (select name from public.tenants where id = rlstest.id('tenantA')) = 'A Coffee'
  and (select count(*) from public.sales_records where team_id = rlstest.id('teamA')) = 1);

-- ── invites ────────────────────────────────────────────────────────────────
:as_alice
with x as (insert into public.team_invites (team_id, email, role) values (rlstest.id('teamA'), 'carol@rls.test', 'analyst') returning token) insert into rlstest.ids select 'inv_carol', token from x;
with x as (insert into public.team_invites (team_id, email, role) values (rlstest.id('teamA'), 'bob@rls.test', 'viewer') returning token) insert into rlstest.ids select 'inv_bob', token from x;
with x as (insert into public.team_invites (team_id, email, role) values (rlstest.id('teamA'), 'mallory@rls.test', 'admin') returning token) insert into rlstest.ids select 'inv_mallory', token from x;
with x as (insert into public.team_invites (team_id, email, role) values (rlstest.id('teamA'), 'temp@rls.test', 'viewer') returning id) insert into rlstest.ids select 'inv_revoke', id from x;
select rlstest.ok('alice (admin): created 4 invites', (select count(*) from public.team_invites where team_id = rlstest.id('teamA')) = 4);
select rlstest.ok('alice: duplicate open invite for same email fails',
  rlstest.rows(format($$insert into public.team_invites (team_id, email) values (%L, 'carol@rls.test')$$, rlstest.id('teamA'))) = -1);
select rlstest.ok('alice: invite with upper-case email rejected (app lowercases)',
  rlstest.rows(format($$insert into public.team_invites (team_id, email) values (%L, 'Zed@RLS.test')$$, rlstest.id('teamA'))) = -1);
select rlstest.ok('alice: cannot forge accepted invite',
  rlstest.rows(format($$insert into public.team_invites (team_id, email, accepted_at) values (%L, 'x@rls.test', now())$$, rlstest.id('teamA'))) = -1);
select rlstest.ok('alice: invites cannot be updated directly',
  rlstest.rows(format($$update public.team_invites set role = 'admin' where team_id = %L$$, rlstest.id('teamA'))) = -1);
select rlstest.ok('alice (admin): revoke invite deletes 1 row',
  rlstest.rows(format($$delete from public.team_invites where id = %L$$, rlstest.id('inv_revoke'))) = 1);

:as_carol
select rlstest.ok('carol (invitee): cannot list team_invites table', (select count(*) from public.team_invites) = 0);
select rlstest.ok('carol: my_pending_invites shows her invite',
  (select count(*) from public.my_pending_invites() where team_name = 'RLS Team A' and role = 'analyst') = 1);
select rlstest.ok('carol: invite_preview resolves token',
  (select email from public.invite_preview(rlstest.txt('inv_carol'))) = 'carol@rls.test');
select rlstest.ok('carol: cannot see team A data before accepting', (select count(*) from public.tenants) = 0);

:as_eve
select rlstest.ok('eve: accepting someone else''s invite fails',
  rlstest.err(format($$select public.accept_invite(%L)$$, rlstest.txt('inv_carol'))) like '%different email%');
select rlstest.ok('eve: my_pending_invites is empty', (select count(*) from public.my_pending_invites()) = 0);
select rlstest.ok('eve: bogus token fails', rlstest.err($$select public.accept_invite('nope')$$) like '%not found%');
select rlstest.ok('eve: still not a member of team A', (select count(*) from public.tenants) = 0);

:as_mallory
select rlstest.ok('mallory (unconfirmed email): cannot accept her invite',
  rlstest.rows(format($$select public.accept_invite(%L)$$, rlstest.txt('inv_mallory'))) = -1);
select rlstest.ok('mallory: pending invites hidden until email confirmed', (select count(*) from public.my_pending_invites()) = 0);

:as_carol
select rlstest.ok('carol: accept_invite returns team A', public.accept_invite(rlstest.txt('inv_carol')) = rlstest.id('teamA'));
select rlstest.ok('carol: now analyst of team A', public.team_role(rlstest.id('teamA')) = 'analyst');
select rlstest.ok('carol: accepting again is a no-op', public.accept_invite(rlstest.txt('inv_carol')) = rlstest.id('teamA'));

:as_bob
select rlstest.ok('bob: accepting carol''s used invite fails', rlstest.rows(format($$select public.accept_invite(%L)$$, rlstest.txt('inv_carol'))) = -1);
select rlstest.ok('bob: accept_my_invites accepts 1', public.accept_my_invites() = 1);
select rlstest.ok('bob: now viewer of team A', public.team_role(rlstest.id('teamA')) = 'viewer');

-- ── analyst can write data, not manage the team ───────────────────────────
:as_carol
select rlstest.ok('carol (analyst): reads team A tenants', (select count(*) from public.tenants where team_id = rlstest.id('teamA')) = 1);
select rlstest.ok('carol (analyst): insert sales',
  rlstest.rows(format($$insert into public.sales_records (team_id, tenant_id, period_type, amount) values (%L, %L, 'hourly', 250)$$, rlstest.id('teamA'), rlstest.id('tenantA'))) = 1);
select rlstest.ok('carol (analyst): update sales',
  rlstest.rows(format($$update public.sales_records set amount = amount + 1 where team_id = %L$$, rlstest.id('teamA'))) = 2);
select rlstest.ok('carol (analyst): insert projection',
  rlstest.rows(format($$insert into public.projections (team_id, tenant_id, target_period, projected_amount) values (%L, %L, 'weekly', 7000)$$, rlstest.id('teamA'), rlstest.id('tenantA'))) = 1);
select rlstest.ok('carol (analyst): approve projection',
  rlstest.rows(format($$update public.projections set review_status = 'approved' where team_id = %L$$, rlstest.id('teamA'))) = 1);
select rlstest.ok('carol (analyst): add + edit tenant',
  rlstest.rows(format($$insert into public.tenants (team_id, name) values (%L, 'Carol Temp')$$, rlstest.id('teamA'))) = 1
  and rlstest.rows($$update public.tenants set unit = 'Z-1' where name = 'Carol Temp'$$) = 1);
select rlstest.ok('carol (analyst): delete tenant', rlstest.rows($$delete from public.tenants where name = 'Carol Temp'$$) = 1);
select rlstest.ok('carol (analyst): cannot create invites',
  rlstest.rows(format($$insert into public.team_invites (team_id, email) values (%L, 'friend@rls.test')$$, rlstest.id('teamA'))) = -1);
select rlstest.ok('carol (analyst): cannot see invites', (select count(*) from public.team_invites) = 0);
select rlstest.ok('carol (analyst): cannot promote herself',
  rlstest.rows($$update public.team_members set role = 'admin' where user_id = auth.uid()$$) = 0);
select rlstest.ok('carol (analyst): cannot remove bob',
  rlstest.rows($$delete from public.team_members where user_id = 'b0000000-0000-4000-8000-000000000002'$$) = 0);
select rlstest.ok('carol (analyst): cannot rename team',
  rlstest.rows(format($$update public.teams set name = 'Carol''s' where id = %L$$, rlstest.id('teamA'))) = 0);
select rlstest.ok('carol: team_member_list shows emails of 3 members',
  (select count(*) from public.team_member_list(rlstest.id('teamA'))) = 3
  and exists (select 1 from public.team_member_list(rlstest.id('teamA')) where email = 'bob@rls.test' and role = 'viewer'));

-- ── viewer is read-only ────────────────────────────────────────────────────
:as_bob
select rlstest.ok('bob (viewer): reads tenants', (select count(*) from public.tenants where team_id = rlstest.id('teamA')) = 1);
select rlstest.ok('bob (viewer): reads sales', (select count(*) from public.sales_records where team_id = rlstest.id('teamA')) = 2);
select rlstest.ok('bob (viewer): reads projections', (select count(*) from public.projections where team_id = rlstest.id('teamA')) = 1);
select rlstest.ok('bob (viewer): insert sales fails',
  rlstest.rows(format($$insert into public.sales_records (team_id, tenant_id, period_type, amount) values (%L, %L, 'daily', 5)$$, rlstest.id('teamA'), rlstest.id('tenantA'))) = -1);
select rlstest.ok('bob (viewer): update sales affects 0 rows', rlstest.rows($$update public.sales_records set amount = 0$$) = 0);
select rlstest.ok('bob (viewer): delete sales affects 0 rows', rlstest.rows($$delete from public.sales_records$$) = 0);
select rlstest.ok('bob (viewer): insert tenant fails',
  rlstest.rows(format($$insert into public.tenants (team_id, name) values (%L, 'Bob shop')$$, rlstest.id('teamA'))) = -1);
select rlstest.ok('bob (viewer): delete tenant affects 0 rows', rlstest.rows($$delete from public.tenants$$) = 0);
select rlstest.ok('bob (viewer): insert projection fails',
  rlstest.rows(format($$insert into public.projections (team_id, tenant_id, target_period, projected_amount) values (%L, %L, 'weekly', 1)$$, rlstest.id('teamA'), rlstest.id('tenantA'))) = -1);
select rlstest.ok('bob (viewer): approve projection affects 0 rows', rlstest.rows($$update public.projections set review_status = 'unreviewed'$$) = 0);

-- ── 0003: lease & GTO terms, outlets ───────────────────────────────────────
:as_carol
select rlstest.ok('0003 carol (analyst): set tiers, SST, base rent, lease dates, property',
  rlstest.rows(format($$update public.tenants set gto_tiers = '[{"up_to":400000,"rate":0},{"up_to":null,"rate":0.03}]',
    gto_sst_pct = 8, base_rent_monthly = 12500, lease_start = '2025-07-01', lease_end = '2028-06-30', property = 'Demo Mall North'
    where id = %L$$, rlstest.id('tenantA'))) = 1);
select rlstest.ok('0003: three-band tiers accepted',
  rlstest.rows(format($$update public.tenants set gto_tiers = '[{"up_to":150000,"rate":0},{"up_to":350000,"rate":0.015},{"up_to":null,"rate":0.045}]' where id = %L$$, rlstest.id('tenantA'))) = 1);
select rlstest.ok('0003: descending thresholds rejected',
  rlstest.rows(format($$update public.tenants set gto_tiers = '[{"up_to":350000,"rate":0},{"up_to":150000,"rate":0.015},{"up_to":null,"rate":0.045}]' where id = %L$$, rlstest.id('tenantA'))) = -1);
select rlstest.ok('0003: last band must be open-ended',
  rlstest.rows(format($$update public.tenants set gto_tiers = '[{"up_to":400000,"rate":0},{"up_to":900000,"rate":0.03}]' where id = %L$$, rlstest.id('tenantA'))) = -1);
select rlstest.ok('0003: rate above 1 (100%%) rejected',
  rlstest.rows(format($$update public.tenants set gto_tiers = '[{"up_to":null,"rate":2.5}]' where id = %L$$, rlstest.id('tenantA'))) = -1);
select rlstest.ok('0003: non-array tiers rejected',
  rlstest.rows(format($$update public.tenants set gto_tiers = '{"rate":0.1}' where id = %L$$, rlstest.id('tenantA'))) = -1);
select rlstest.ok('0003: SST over 100%% rejected',
  rlstest.rows(format($$update public.tenants set gto_sst_pct = 150 where id = %L$$, rlstest.id('tenantA'))) = -1);
select rlstest.ok('0003: lease end before start rejected',
  rlstest.rows(format($$update public.tenants set lease_start = '2027-01-01', lease_end = '2026-01-01' where id = %L$$, rlstest.id('tenantA'))) = -1);
select rlstest.ok('0003: negative base rent rejected',
  rlstest.rows(format($$update public.tenants set base_rent_monthly = -1 where id = %L$$, rlstest.id('tenantA'))) = -1);
select rlstest.ok('0003: null tiers (flat rent_rate_pct fallback) still valid',
  rlstest.rows(format($$insert into public.tenants (team_id, name, rent_rate_pct) values (%L, 'Flat Rate Co', 8)$$, rlstest.id('teamA'))) = 1
  and rlstest.rows($$delete from public.tenants where name = 'Flat Rate Co'$$) = 1);
select rlstest.ok('0003 carol (analyst): monthly sale with outlet',
  rlstest.rows(format($$insert into public.sales_records (team_id, tenant_id, period_type, amount, outlet, source) values (%L, %L, 'monthly', 120450.5, 'Outlet North', 'import')$$, rlstest.id('teamA'), rlstest.id('tenantA'))) = 1);
select rlstest.ok('0003: blank outlet rejected',
  rlstest.rows(format($$insert into public.sales_records (team_id, tenant_id, period_type, amount, outlet) values (%L, %L, 'monthly', 1, '  ')$$, rlstest.id('teamA'), rlstest.id('tenantA'))) = -1);
:as_bob
select rlstest.ok('0003 bob (viewer): reads new term columns',
  (select gto_sst_pct from public.tenants where id = rlstest.id('tenantA')) = 8
  and (select count(*) from public.sales_records where outlet = 'Outlet North') = 1);
select rlstest.ok('0003 bob (viewer): cannot change tiers',
  rlstest.rows(format($$update public.tenants set gto_tiers = null where id = %L$$, rlstest.id('tenantA'))) = 0);
:as_dave
select rlstest.ok('0003 dave (other team): cannot read or change team A terms',
  (select count(*) from public.tenants where id = rlstest.id('tenantA')) = 0
  and rlstest.rows(format($$update public.tenants set base_rent_monthly = 1 where id = %L$$, rlstest.id('tenantA'))) = 0
  and (select count(*) from public.sales_records where outlet = 'Outlet North') = 0);
:as_super
select rlstest.ok('0003: team A terms untouched by viewer / other team',
  (select base_rent_monthly from public.tenants where id = rlstest.id('tenantA')) = 12500
  and (select jsonb_array_length(gto_tiers) from public.tenants where id = rlstest.id('tenantA')) = 3);
-- keep later sales-count assertions unchanged
delete from public.sales_records where outlet = 'Outlet North' and tenant_id = rlstest.id('tenantA');
:as_bob

-- ── admin manages members ──────────────────────────────────────────────────
:as_alice
select rlstest.ok('alice (admin): promote bob to analyst',
  rlstest.rows($$update public.team_members set role = 'analyst' where user_id = 'b0000000-0000-4000-8000-000000000002'$$) = 1);
:as_bob
select rlstest.ok('bob (now analyst): insert sales works',
  rlstest.rows(format($$insert into public.sales_records (team_id, tenant_id, period_type, amount) values (%L, %L, 'daily', 5)$$, rlstest.id('teamA'), rlstest.id('tenantA'))) = 1);
:as_alice
select rlstest.ok('alice (admin): demote bob back to viewer',
  rlstest.rows($$update public.team_members set role = 'viewer' where user_id = 'b0000000-0000-4000-8000-000000000002'$$) = 1);
select rlstest.ok('alice: invalid role rejected',
  rlstest.rows($$update public.team_members set role = 'owner' where user_id = 'b0000000-0000-4000-8000-000000000002'$$) = -1);
select rlstest.ok('alice: cannot rewrite member user_id (column grant)',
  rlstest.rows($$update public.team_members set user_id = 'e0000000-0000-4000-8000-000000000005' where user_id = 'b0000000-0000-4000-8000-000000000002'$$) = -1);
select rlstest.ok('alice (sole admin): cannot demote herself',
  rlstest.err($$update public.team_members set role = 'viewer' where user_id = auth.uid()$$) like '%at least one admin%');
select rlstest.ok('alice (sole admin): cannot leave',
  rlstest.rows($$delete from public.team_members where user_id = auth.uid()$$) = -1);
select rlstest.ok('alice (admin): rename team',
  rlstest.rows(format($$update public.teams set name = 'RLS Team A2' where id = %L$$, rlstest.id('teamA'))) = 1);
select rlstest.ok('alice (admin): add eve directly as viewer',
  rlstest.rows(format($$insert into public.team_members (team_id, user_id, role) values (%L, 'e0000000-0000-4000-8000-000000000005', 'viewer')$$, rlstest.id('teamA'))) = 1);
select rlstest.ok('alice (admin): remove eve',
  rlstest.rows($$delete from public.team_members where user_id = 'e0000000-0000-4000-8000-000000000005'$$) = 1);
:as_bob
select rlstest.ok('bob (viewer): can leave the team', rlstest.rows($$delete from public.team_members where user_id = auth.uid()$$) = 1);
select rlstest.ok('bob: after leaving sees nothing', (select count(*) from public.tenants) = 0 and (select count(*) from public.teams) = 0);

-- ── claiming the demo workspace (SQL editor only) ─────────────────────────
:as_alice
select rlstest.ok('alice: add_team_member_by_email not callable by app users',
  rlstest.rows($$select public.add_team_member_by_email('00000000-0000-4000-8000-00000000d0e0', 'alice@rls.test', 'admin')$$) = -1);
:as_super
select public.add_team_member_by_email('00000000-0000-4000-8000-00000000d0e0', 'ALICE@rls.test', 'admin');
:as_alice
select rlstest.ok('alice: after claim sees demo tenants', (select count(*) from public.tenants where team_id = '00000000-0000-4000-8000-00000000d0e0') >= 5);
select rlstest.ok('alice: in two teams, filters by team_id', (select count(*) from public.teams) = 2
  and (select count(*) from public.tenants where team_id = rlstest.id('teamA')) = 1);
:as_dave
select rlstest.ok('dave: still cannot see demo data', (select count(*) from public.tenants where team_id = '00000000-0000-4000-8000-00000000d0e0') = 0);

-- ── cascade ────────────────────────────────────────────────────────────────
:as_super
delete from public.teams where id = rlstest.id('teamB');
select rlstest.ok('deleting a team cascades members + data (admin guard allows it)',
  not exists (select 1 from public.team_members where team_id = rlstest.id('teamB'))
  and not exists (select 1 from public.tenants where id = rlstest.id('tenantB')));

-- ── summary ────────────────────────────────────────────────────────────────
:as_super
\pset tuples_only off
select count(*) filter (where pass) as passed, count(*) filter (where not pass) as failed, count(*) as total from rlstest.results;
select name as failed_test, detail from rlstest.results where not pass order by n;
-- cleanup test fixtures (keep migration objects)
set session_replication_role = replica; -- skip the keep-one-admin trigger for fixture cleanup
delete from public.teams where name like 'RLS %';
delete from public.team_members where team_id = '00000000-0000-4000-8000-00000000d0e0' and user_id in (select id from auth.users where email like '%@rls.test');
delete from auth.users where email like '%@rls.test';
set session_replication_role = origin;
do $$ begin
  if exists (select 1 from rlstest.results where not pass) then raise exception 'RLS tests failed'; end if;
end $$;

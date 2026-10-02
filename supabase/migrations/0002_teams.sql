-- Tenant GTO — Sprint 4 "Lock it down": team workspaces, roles and per-team RLS.
--
-- Runs AFTER 0001_init.sql on a database that already holds the seeded demo data.
-- Idempotent: safe to re-run (IF NOT EXISTS / CREATE OR REPLACE / DROP … IF EXISTS everywhere).
--
-- What it does to existing data:
--   * creates one team, "Demo workspace" (fixed id 00000000-0000-4000-8000-00000000d0e0),
--   * moves every existing tenant / sales record / projection into it (nothing is deleted),
--   * the demo workspace starts with NO members — it is invisible to everyone until you
--     make yourself its admin (see README → "Claim the demo workspace").
--   * removes the permissive v1 policies and revokes all anon access: data is readable only
--     by signed-in members of the owning team.
--
-- Roles: admin (everything + manage members/invites), analyst (read + write data),
--        viewer (read only).

create extension if not exists pgcrypto;

-- ── teams / members / invites ──────────────────────────────────────────────
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'analyst', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index if not exists team_members_user_idx on public.team_members (user_id);

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  role text not null default 'analyst' check (role in ('admin', 'analyst', 'viewer')),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid references auth.users (id) on delete set null default auth.uid(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists team_invites_team_idx on public.team_invites (team_id);
create index if not exists team_invites_email_idx on public.team_invites (email) where accepted_at is null;
-- One open invite per email per team.
create unique index if not exists team_invites_open_uniq on public.team_invites (team_id, email) where accepted_at is null;

-- ── the demo workspace + backfill ──────────────────────────────────────────
insert into public.teams (id, name, created_by)
values ('00000000-0000-4000-8000-00000000d0e0', 'Demo workspace', null)
on conflict (id) do nothing;

alter table public.tenants       add column if not exists team_id uuid references public.teams (id) on delete cascade;
alter table public.sales_records add column if not exists team_id uuid references public.teams (id) on delete cascade;
alter table public.projections   add column if not exists team_id uuid references public.teams (id) on delete cascade;

update public.tenants set team_id = '00000000-0000-4000-8000-00000000d0e0' where team_id is null;
-- Sales / projections follow their tenant's team; orphans (tenant already deleted) go to the demo team.
update public.sales_records s set team_id = t.team_id from public.tenants t where s.team_id is null and t.id = s.tenant_id;
update public.sales_records set team_id = '00000000-0000-4000-8000-00000000d0e0' where team_id is null;
update public.projections p set team_id = t.team_id from public.tenants t where p.team_id is null and t.id = p.tenant_id;
update public.projections set team_id = '00000000-0000-4000-8000-00000000d0e0' where team_id is null;

alter table public.tenants       alter column team_id set not null;
alter table public.sales_records alter column team_id set not null;
alter table public.projections   alter column team_id set not null;

-- Who created a row (informational; access is decided by team_id).
alter table public.tenants       alter column user_id set default auth.uid();
alter table public.sales_records alter column user_id set default auth.uid();
alter table public.projections   alter column user_id set default auth.uid();

create index if not exists tenants_team_idx on public.tenants (team_id, name);
create index if not exists sales_records_team_recorded_idx on public.sales_records (team_id, recorded_at);
create index if not exists projections_team_created_idx on public.projections (team_id, created_at desc);

-- ── helper functions (SECURITY DEFINER so policies don't recurse through team_members RLS) ──
create or replace function public.team_role(p_team uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select m.role from public.team_members m where m.team_id = p_team and m.user_id = auth.uid()
$$;

create or replace function public.is_team_member(p_team uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.team_members m where m.team_id = p_team and m.user_id = auth.uid())
$$;

create or replace function public.can_write_team(p_team uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = p_team and m.user_id = auth.uid() and m.role in ('admin', 'analyst')
  )
$$;

create or replace function public.is_team_admin(p_team uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = p_team and m.user_id = auth.uid() and m.role = 'admin'
  )
$$;

-- The signed-in user's email, only once confirmed (so an unverified signup can't claim invites).
create or replace function public.current_user_email()
returns text language sql stable security definer set search_path = ''
as $$
  select lower(u.email) from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null
$$;

-- ── RPCs ───────────────────────────────────────────────────────────────────
create or replace function public.create_team(p_name text)
returns uuid language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_team uuid;
begin
  if v_uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 80 then
    raise exception 'Team name must be 1–80 characters' using errcode = '22023';
  end if;
  insert into public.teams (name, created_by) values (btrim(p_name), v_uid) returning id into v_team;
  insert into public.team_members (team_id, user_id, role) values (v_team, v_uid, 'admin');
  return v_team;
end;
$$;

-- Accept one invite by token. The invite's email must match the signed-in (confirmed) email.
create or replace function public.accept_invite(p_token text)
returns uuid language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := public.current_user_email();
  v_inv public.team_invites%rowtype;
begin
  if v_uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  select * into v_inv from public.team_invites where token = p_token for update;
  if not found then raise exception 'Invite not found' using errcode = 'P0002'; end if;
  if v_inv.accepted_at is not null then
    if v_inv.accepted_by = v_uid then return v_inv.team_id; end if;
    raise exception 'Invite has already been used' using errcode = '22023';
  end if;
  if v_email is null or v_email <> v_inv.email then
    raise exception 'This invite was sent to a different email address' using errcode = '42501';
  end if;
  insert into public.team_members (team_id, user_id, role)
  values (v_inv.team_id, v_uid, v_inv.role)
  on conflict (team_id, user_id) do nothing; -- already a member: keep current role
  update public.team_invites set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  return v_inv.team_id;
end;
$$;

-- Accept every open invite addressed to the signed-in user's email. Returns how many were accepted.
create or replace function public.accept_my_invites()
returns integer language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_n integer := 0;
  r record;
begin
  for r in select token from public.team_invites where accepted_at is null and email = public.current_user_email() loop
    perform public.accept_invite(r.token);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- Open invites for the signed-in user (they aren't a member yet, so team names are hidden by RLS).
create or replace function public.my_pending_invites()
returns table (token text, team_id uuid, team_name text, role text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select i.token, i.team_id, t.name, i.role, i.created_at
  from public.team_invites i join public.teams t on t.id = i.team_id
  where i.accepted_at is null and i.email = public.current_user_email()
  order by i.created_at
$$;

-- What an invite link points at (for the /invite/<token> page). Knowing the token is the credential.
create or replace function public.invite_preview(p_token text)
returns table (team_name text, email text, role text, accepted boolean)
language sql stable security definer set search_path = ''
as $$
  select t.name, i.email, i.role, i.accepted_at is not null
  from public.team_invites i join public.teams t on t.id = i.team_id
  where i.token = p_token and auth.uid() is not null
$$;

-- Member roster with emails (auth.users is not readable by clients). Members only.
create or replace function public.team_member_list(p_team uuid)
returns table (user_id uuid, email text, role text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select m.user_id, u.email::text, m.role, m.created_at
  from public.team_members m join auth.users u on u.id = m.user_id
  where m.team_id = p_team and public.is_team_member(p_team)
  order by m.created_at
$$;

-- Server-side helper for the SQL editor only (not callable by app users): add/upgrade a member by email.
create or replace function public.add_team_member_by_email(p_team uuid, p_email text, p_role text default 'admin')
returns void language plpgsql volatile security definer set search_path = ''
as $$
declare v_uid uuid;
begin
  select id into v_uid from auth.users where lower(email) = lower(btrim(p_email));
  if v_uid is null then raise exception 'No user with email % — sign up in the app first', p_email; end if;
  insert into public.team_members (team_id, user_id, role) values (p_team, v_uid, p_role)
  on conflict (team_id, user_id) do update set role = excluded.role;
end;
$$;

-- ── integrity triggers ─────────────────────────────────────────────────────
-- Rows can't be moved between teams.
create or replace function public.forbid_team_change()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.team_id is distinct from old.team_id then
    raise exception 'team_id cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists tenants_team_immutable on public.tenants;
create trigger tenants_team_immutable before update on public.tenants for each row execute function public.forbid_team_change();
drop trigger if exists sales_records_team_immutable on public.sales_records;
create trigger sales_records_team_immutable before update on public.sales_records for each row execute function public.forbid_team_change();
drop trigger if exists projections_team_immutable on public.projections;
create trigger projections_team_immutable before update on public.projections for each row execute function public.forbid_team_change();

-- A team always keeps at least one admin (unless the whole team is being deleted).
create or replace function public.keep_one_admin()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role <> 'admin')
     and exists (select 1 from public.teams where id = old.team_id)
     and not exists (
       select 1 from public.team_members
       where team_id = old.team_id and role = 'admin' and user_id <> old.user_id
     ) then
    raise exception 'A team needs at least one admin' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists team_members_keep_admin on public.team_members;
create trigger team_members_keep_admin before update or delete on public.team_members
  for each row execute function public.keep_one_admin();

-- ── privileges ─────────────────────────────────────────────────────────────
revoke all on public.tenants, public.sales_records, public.projections,
              public.teams, public.team_members, public.team_invites from anon;
grant select, insert, update, delete on public.tenants, public.sales_records, public.projections to authenticated;
grant select, update on public.teams to authenticated;
revoke insert, delete on public.teams from authenticated; -- teams are created via create_team()
grant select, insert, delete on public.team_members to authenticated;
revoke update on public.team_members from authenticated;
grant update (role) on public.team_members to authenticated; -- only the role column is editable
grant select, insert, delete on public.team_invites to authenticated;
revoke update on public.team_invites from authenticated;

revoke execute on function
  public.team_role(uuid), public.is_team_member(uuid), public.can_write_team(uuid), public.is_team_admin(uuid),
  public.current_user_email(), public.create_team(text), public.accept_invite(text), public.accept_my_invites(),
  public.my_pending_invites(), public.invite_preview(text), public.team_member_list(uuid),
  public.add_team_member_by_email(uuid, text, text)
from public, anon;
grant execute on function
  public.team_role(uuid), public.is_team_member(uuid), public.can_write_team(uuid), public.is_team_admin(uuid),
  public.current_user_email(), public.create_team(text), public.accept_invite(text), public.accept_my_invites(),
  public.my_pending_invites(), public.invite_preview(text), public.team_member_list(uuid)
to authenticated;
revoke execute on function public.add_team_member_by_email(uuid, text, text) from authenticated;

-- ── RLS policies ───────────────────────────────────────────────────────────
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;
alter table public.tenants enable row level security;
alter table public.sales_records enable row level security;
alter table public.projections enable row level security;

-- Remove the permissive demo-first policies from 0001.
drop policy if exists "tenants_v1_read" on public.tenants;
drop policy if exists "tenants_v1_write" on public.tenants;
drop policy if exists "sales_records_v1_read" on public.sales_records;
drop policy if exists "sales_records_v1_write" on public.sales_records;
drop policy if exists "projections_v1_read" on public.projections;
drop policy if exists "projections_v1_write" on public.projections;

-- teams
drop policy if exists "teams_select" on public.teams;
create policy "teams_select" on public.teams for select to authenticated using (public.is_team_member(id));
drop policy if exists "teams_update" on public.teams;
create policy "teams_update" on public.teams for update to authenticated
  using (public.is_team_admin(id)) with check (public.is_team_admin(id));

-- team_members
drop policy if exists "team_members_select" on public.team_members;
create policy "team_members_select" on public.team_members for select to authenticated
  using (public.is_team_member(team_id));
drop policy if exists "team_members_insert" on public.team_members;
create policy "team_members_insert" on public.team_members for insert to authenticated
  with check (public.is_team_admin(team_id));
drop policy if exists "team_members_update" on public.team_members;
create policy "team_members_update" on public.team_members for update to authenticated
  using (public.is_team_admin(team_id)) with check (public.is_team_admin(team_id));
drop policy if exists "team_members_delete" on public.team_members;
create policy "team_members_delete" on public.team_members for delete to authenticated
  using (public.is_team_admin(team_id) or user_id = auth.uid()); -- admins remove; anyone may leave

-- team_invites (admins only; invitees go through the RPCs above)
drop policy if exists "team_invites_select" on public.team_invites;
create policy "team_invites_select" on public.team_invites for select to authenticated
  using (public.is_team_admin(team_id));
drop policy if exists "team_invites_insert" on public.team_invites;
create policy "team_invites_insert" on public.team_invites for insert to authenticated
  with check (public.is_team_admin(team_id) and accepted_at is null and accepted_by is null
              and invited_by is not distinct from auth.uid());
drop policy if exists "team_invites_delete" on public.team_invites;
create policy "team_invites_delete" on public.team_invites for delete to authenticated
  using (public.is_team_admin(team_id));

-- tenants
drop policy if exists "tenants_select" on public.tenants;
create policy "tenants_select" on public.tenants for select to authenticated using (public.is_team_member(team_id));
drop policy if exists "tenants_insert" on public.tenants;
create policy "tenants_insert" on public.tenants for insert to authenticated with check (public.can_write_team(team_id));
drop policy if exists "tenants_update" on public.tenants;
create policy "tenants_update" on public.tenants for update to authenticated
  using (public.can_write_team(team_id)) with check (public.can_write_team(team_id));
drop policy if exists "tenants_delete" on public.tenants;
create policy "tenants_delete" on public.tenants for delete to authenticated using (public.can_write_team(team_id));

-- sales_records (the tenant must belong to the same team)
drop policy if exists "sales_records_select" on public.sales_records;
create policy "sales_records_select" on public.sales_records for select to authenticated using (public.is_team_member(team_id));
drop policy if exists "sales_records_insert" on public.sales_records;
create policy "sales_records_insert" on public.sales_records for insert to authenticated
  with check (public.can_write_team(team_id)
              and exists (select 1 from public.tenants t where t.id = tenant_id and t.team_id = sales_records.team_id));
drop policy if exists "sales_records_update" on public.sales_records;
create policy "sales_records_update" on public.sales_records for update to authenticated
  using (public.can_write_team(team_id))
  with check (public.can_write_team(team_id)
              and exists (select 1 from public.tenants t where t.id = tenant_id and t.team_id = sales_records.team_id));
drop policy if exists "sales_records_delete" on public.sales_records;
create policy "sales_records_delete" on public.sales_records for delete to authenticated using (public.can_write_team(team_id));

-- projections (same shape as sales_records)
drop policy if exists "projections_select" on public.projections;
create policy "projections_select" on public.projections for select to authenticated using (public.is_team_member(team_id));
drop policy if exists "projections_insert" on public.projections;
create policy "projections_insert" on public.projections for insert to authenticated
  with check (public.can_write_team(team_id)
              and exists (select 1 from public.tenants t where t.id = tenant_id and t.team_id = projections.team_id));
drop policy if exists "projections_update" on public.projections;
create policy "projections_update" on public.projections for update to authenticated
  using (public.can_write_team(team_id))
  with check (public.can_write_team(team_id)
              and exists (select 1 from public.tenants t where t.id = tenant_id and t.team_id = projections.team_id));
drop policy if exists "projections_delete" on public.projections;
create policy "projections_delete" on public.projections for delete to authenticated using (public.can_write_team(team_id));

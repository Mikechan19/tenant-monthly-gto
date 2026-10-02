-- Minimal stand-in for Supabase's auth schema + default grants, for running the RLS tests on plain Postgres.
-- NOT for use against a real Supabase project (it already has all of this).
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email text unique,
  email_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select auth.jwt() ->> 'role'
$$;
grant usage on schema auth to anon, authenticated;
grant execute on all functions in schema auth to anon, authenticated;

-- Supabase's default privileges: anon + authenticated get table/function rights in public; RLS does the gating.
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;

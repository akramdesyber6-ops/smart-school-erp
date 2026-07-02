-- supabase/policies/01_tenant_isolation.sql
-- Purpose: Multi-tenant, recursion-safe RLS helpers and policies for core tables.
-- Notes:
--  - Uses JWT claims propagated by Supabase to identify the current user's school (tenant).
--  - Security-definer functions are intentionally immutable/stable to avoid recursive RLS evaluation.
--  - Adjust claim keys ("school_id", "role", "user_id") if your project uses different names.

-- Create a dedicated schema for policy helper functions
create schema if not exists policies;

-- Safety: ensure the schema owner is the postgres superuser or a role with privileges required by SECURITY DEFINER usage.
set search_path = policies,public;

-- Returns the current request's JWT claims as JSON (or NULL if not present)
create or replace function policies._jwt_claims() returns jsonb
language sql stable security definer as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb, '{}'::jsonb);
$$;

-- Extract the current school_id from the JWT claims and cast to uuid
create or replace function policies.current_school_id() returns uuid
language sql stable security definer as $$
  select nullif((policies._jwt_claims() ->> 'school_id'), '')::uuid;
$$;

-- Extract the current user id from the JWT claims
create or replace function policies.current_user_id() returns uuid
language sql stable security definer as $$
  select nullif((policies._jwt_claims() ->> 'user_id'), '')::uuid;
$$;

-- Is the request coming from a service role (server-side privileged token)?
create or replace function policies.is_service_role() returns boolean
language sql stable security definer as $$
  select (policies._jwt_claims() ->> 'role') = 'service_role';
$$;

-- Lightweight authorization check used by RLS policies. It avoids querying other tables so it doesn't introduce recursion.
-- Use this for simple checks where the tenant id is provided directly on the row (e.g. a "school_id" column).
create or replace function policies.allowed_school(target_school uuid) returns boolean
language sql stable security definer as $$
  -- Allow if service role OR the request's school_id matches the target_school
  select
    (policies.is_service_role())
    or (
      policies.current_school_id() is not null and policies.current_school_id() = target_school
    );
$$;

-- Utility: guard to ensure there is an authenticated user in normal contexts
create or replace function policies.require_authenticated_user() returns boolean
language sql stable security definer as $$
  select
    policies.is_service_role()
    or (policies.current_user_id() is not null);
$$;

-- ==================================================================
-- Enable RLS and create policies for tenant isolation on core tables
-- ==================================================================

-- 1) schools
-- Allow read access for users only to the school that matches their tenant or for service role.
alter table if exists public.schools enable row level security;

create policy if not exists "tenant_isolation_read_schools" on public.schools
  for select using (policies.allowed_school(id));

create policy if not exists "tenant_isolation_modify_schools" on public.schools
  for all using (policies.allowed_school(id)) with check (policies.allowed_school(coalesce(new.id, id)));

-- 2) profiles (user profiles belonging to a school)
alter table if exists public.profiles enable row level security;

create policy if not exists "tenant_isolation_select_profiles" on public.profiles
  for select using (policies.allowed_school(school_id));

create policy if not exists "tenant_isolation_insert_profiles" on public.profiles
  for insert with check (policies.allowed_school(new.school_id) and policies.require_authenticated_user());

create policy if not exists "tenant_isolation_update_profiles" on public.profiles
  for update using (policies.allowed_school(school_id)) with check (policies.allowed_school(coalesce(new.school_id, school_id)));

create policy if not exists "tenant_isolation_delete_profiles" on public.profiles
  for delete using (policies.allowed_school(school_id));

-- 3) academic_terms
alter table if exists public.academic_terms enable row level security;

create policy if not exists "tenant_isolation_terms" on public.academic_terms
  for all using (policies.allowed_school(school_id)) with check (policies.allowed_school(coalesce(new.school_id, school_id)));

-- 4) classes
alter table if exists public.classes enable row level security;

create policy if not exists "tenant_isolation_classes" on public.classes
  for all using (policies.allowed_school(school_id)) with check (policies.allowed_school(coalesce(new.school_id, school_id)));

-- 5) enrollments
alter table if exists public.enrollments enable row level security;

create policy if not exists "tenant_isolation_enrollments" on public.enrollments
  for all using (policies.allowed_school(school_id)) with check (policies.allowed_school(coalesce(new.school_id, school_id)));

-- 6) markbook_entries
alter table if exists public.markbook_entries enable row level security;

create policy if not exists "tenant_isolation_markbook_entries" on public.markbook_entries
  for all using (policies.allowed_school(school_id)) with check (policies.allowed_school(coalesce(new.school_id, school_id)));

-- ==================================================================
-- Helpful additional policy: allow authenticated users to access their own profile
-- ==================================================================
create policy if not exists "self_profile_access" on public.profiles
  for select using (policies.is_service_role() or (profiles.user_id = policies.current_user_id()));

-- ==================================================================
-- Notes & migration guidance
-- ==================================================================
-- 1) If your JWT claim keys differ (e.g. using "tenant_id" instead of "school_id"), update the policies._jwt_claims() accessors.
-- 2) If you need to authorize by group/role membership that requires joins, create a dedicated, RLS-exempt helper table
--    (populated by a trusted background job) and reference it in the security-definer functions to avoid recursive queries.
-- 3) Test these policies thoroughly in a staging environment. Use a service_role key to bypass RLS for administrative operations when needed.

-- End of file

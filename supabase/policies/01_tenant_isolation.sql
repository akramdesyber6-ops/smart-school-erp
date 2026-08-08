-- Supabase RLS baseline for Smart School ERP.
-- Apply after the schema migration that creates the referenced tables.
-- Roles are read from the active profile for the authenticated auth.uid().

create schema if not exists policies;

create or replace function policies.current_school_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.school_id
  from public.profiles p
  where p.user_id = auth.uid()
    and p.is_active = true
  limit 1;
$$;

create or replace function policies.current_role()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.role
  from public.profiles p
  where p.user_id = auth.uid()
    and p.is_active = true
  limit 1;
$$;

create or replace function policies.is_service_role()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.role() = 'service_role';
$$;

create or replace function policies.can_access_school(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select policies.is_service_role()
    or (auth.uid() is not null and policies.current_school_id() = target_school_id);
$$;

create or replace function policies.is_school_admin(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select policies.is_service_role()
    or (
      auth.uid() is not null
      and policies.current_school_id() = target_school_id
      and policies.current_role() in ('admin', 'school_admin')
    );
$$;

-- Tables with a direct school_id use a uniform least-privilege policy:
-- active members may read their tenant; only school administrators may mutate it.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'academic_years', 'academic_terms', 'attendance', 'classes', 'enrollments',
    'markbook_entries', 'parents', 'students', 'subjects'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('drop policy if exists %I on public.%I', format('erp_%s_read', table_name), table_name);
      execute format('drop policy if exists %I on public.%I', format('erp_%s_write', table_name), table_name);
      execute format(
        'create policy %I on public.%I for select using (policies.can_access_school(school_id))',
        format('erp_%s_read', table_name),
        table_name
      );
      execute format(
        'create policy %I on public.%I for all using (policies.is_school_admin(school_id)) with check (policies.is_school_admin(school_id))',
        format('erp_%s_write', table_name),
        table_name
      );
    end if;
  end loop;
end;
$$;

do $$
begin
  if to_regclass('public.schools') is not null then
    alter table public.schools enable row level security;
    drop policy if exists erp_schools_read on public.schools;
    drop policy if exists erp_schools_write on public.schools;
    create policy erp_schools_read on public.schools
      for select using (policies.can_access_school(id));
    create policy erp_schools_write on public.schools
      for all using (policies.is_school_admin(id)) with check (policies.is_school_admin(id));
  end if;

  if to_regclass('public.profiles') is not null then
    alter table public.profiles enable row level security;
    drop policy if exists erp_profiles_read on public.profiles;
    drop policy if exists erp_profiles_write on public.profiles;
    create policy erp_profiles_read on public.profiles
      for select using (user_id = auth.uid() or policies.is_school_admin(school_id));
    create policy erp_profiles_write on public.profiles
      for all using (policies.is_school_admin(school_id)) with check (policies.is_school_admin(school_id));
  end if;

  if to_regclass('public.class_subjects') is not null then
    alter table public.class_subjects enable row level security;
    drop policy if exists erp_class_subjects_read on public.class_subjects;
    drop policy if exists erp_class_subjects_write on public.class_subjects;
    create policy erp_class_subjects_read on public.class_subjects
      for select using (
        exists (
          select 1 from public.classes c
          where c.id = class_subjects.class_id and policies.can_access_school(c.school_id)
        )
      );
    create policy erp_class_subjects_write on public.class_subjects
      for all using (
        exists (
          select 1 from public.classes c
          where c.id = class_subjects.class_id and policies.is_school_admin(c.school_id)
        )
      ) with check (
        exists (
          select 1 from public.classes c
          where c.id = class_subjects.class_id and policies.is_school_admin(c.school_id)
        )
      );
  end if;

  if to_regclass('public.student_parents') is not null then
    alter table public.student_parents enable row level security;
    drop policy if exists erp_student_parents_read on public.student_parents;
    drop policy if exists erp_student_parents_write on public.student_parents;
    create policy erp_student_parents_read on public.student_parents
      for select using (
        exists (
          select 1 from public.students s
          where s.id = student_parents.student_id and policies.can_access_school(s.school_id)
        )
      );
    create policy erp_student_parents_write on public.student_parents
      for all using (
        exists (
          select 1 from public.students s
          where s.id = student_parents.student_id and policies.is_school_admin(s.school_id)
        )
      ) with check (
        exists (
          select 1 from public.students s
          where s.id = student_parents.student_id and policies.is_school_admin(s.school_id)
        )
      );
  end if;
end;
$$;

revoke all on all functions in schema policies from public;
grant usage on schema policies to authenticated, service_role;
grant execute on all functions in schema policies to authenticated, service_role;

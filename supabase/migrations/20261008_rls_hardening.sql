BEGIN;

create schema if not exists policies;

set search_path = policies, public;

create or replace function policies._jwt_claims() returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb, '{}'::jsonb);
$$;

create or replace function policies.current_school_id() returns uuid
language sql
stable
security definer
set search_path = public, pg_temp as $$
  select nullif(
    coalesce(
      (policies._jwt_claims() ->> 'school_id')::uuid,
      (policies._jwt_claims() ->> 'tenant_id')::uuid,
      case when jsonb_typeof(policies._jwt_claims() -> 'school_ids') = 'array'
           then (policies._jwt_claims() -> 'school_ids' ->> 0)::uuid
           else null end
    ),
    null
  );
$$;

create or replace function policies.current_user_id() returns uuid
language sql
stable
security definer
set search_path = public, pg_temp as $$
  select nullif(
    coalesce(
      (policies._jwt_claims() ->> 'user_id')::uuid,
      (policies._jwt_claims() ->> 'sub')::uuid
    ),
    null
  );
$$;

create or replace function policies.user_school_ids() returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp as $$
  select coalesce(
    array(
      select distinct p.school_id
      from public.profiles p
      where p.user_id = auth.uid()
        and p.school_id is not null
    ),
    array[]::uuid[]
  );
$$;

create or replace function policies.is_service_role() returns boolean
language sql
stable
security definer
set search_path = public, pg_temp as $$
  select coalesce((policies._jwt_claims() ->> 'role') = 'service_role', false);
$$;

create or replace function policies.allowed_school(target_school uuid) returns boolean
language sql
stable
security definer
set search_path = public, pg_temp as $$
  select
    policies.is_service_role()
    or (
      target_school is not null
      and target_school = any (policies.user_school_ids())
    );
$$;

create or replace function policies.require_authenticated_user() returns boolean
language sql
stable
security definer
set search_path = public, pg_temp as $$
  select policies.is_service_role() or policies.current_user_id() is not null;
$$;

create or replace function policies.is_teacher_for_class(target_class uuid) returns boolean
language sql
stable
security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'teacher'
      and (
        (
          to_regclass('public.teacher_class_assignments') is not null
          and exists (
            select 1
            from public.teacher_class_assignments tca
            where tca.teacher_id = p.user_id
              and tca.class_id = target_class
          )
        )
        or (
          to_regclass('public.class_teachers') is not null
          and exists (
            select 1
            from public.class_teachers ct
            where ct.teacher_id = p.user_id
              and ct.class_id = target_class
          )
        )
        or (
          to_regclass('public.class_subjects') is not null
          and exists (
            select 1
            from public.class_subjects cs
            where cs.class_id = target_class
              and cs.teacher_id = p.user_id
          )
        )
      )
  );
$$;

create or replace function policies.is_teacher_for_class_subject(target_class uuid, target_subject uuid) returns boolean
language sql
stable
security definer
set search_path = public, pg_temp as $$
  select policies.is_service_role()
    or exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role = 'teacher'
        and (
          (
            to_regclass('public.class_subjects') is not null
            and exists (
              select 1
              from public.class_subjects cs
              where cs.class_id = target_class
                and cs.subject_id = target_subject
                and cs.teacher_id = p.user_id
            )
          )
          or (
            to_regclass('public.teacher_subject_assignments') is not null
            and exists (
              select 1
              from public.teacher_subject_assignments tsa
              where tsa.teacher_id = p.user_id
                and tsa.class_id = target_class
                and tsa.subject_id = target_subject
            )
          )
        )
    );
$$;

create or replace function policies.is_student_own_record(target_student uuid) returns boolean
language sql
stable
security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'student'
      and exists (
        select 1
        from public.students s
        where s.id = target_student
          and s.school_id = p.school_id
      )
  );
$$;

create or replace function policies.is_parent_of_student(target_student uuid) returns boolean
language sql
stable
security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'parent'
      and (
        (
          to_regclass('public.student_parents') is not null
          and exists (
            select 1
            from public.student_parents sp
            join public.parents pr on pr.id = sp.parent_id
            where sp.student_id = target_student
              and pr.user_id = auth.uid()
          )
        )
        or (
          to_regclass('public.parent_students') is not null
          and exists (
            select 1
            from public.parent_students ps
            where ps.student_id = target_student
              and ps.parent_user_id = auth.uid()
          )
        )
      )
  );
$$;

alter table if exists public.schools enable row level security;
create policy if not exists "tenant_isolation_read_schools" on public.schools
for select using (policies.allowed_school(id));
create policy if not exists "tenant_isolation_modify_schools" on public.schools
for all using (policies.allowed_school(id)) with check (policies.allowed_school(coalesce(new.id, id)));

alter table if exists public.profiles enable row level security;
create policy if not exists "tenant_isolation_select_profiles" on public.profiles
for select using (policies.allowed_school(school_id));
create policy if not exists "tenant_isolation_insert_profiles" on public.profiles
for insert with check (policies.allowed_school(new.school_id) and policies.require_authenticated_user());
create policy if not exists "tenant_isolation_update_profiles" on public.profiles
for update using (policies.allowed_school(school_id)) with check (policies.allowed_school(coalesce(new.school_id, school_id)));
create policy if not exists "tenant_isolation_delete_profiles" on public.profiles
for delete using (policies.allowed_school(school_id));
create policy if not exists "self_profile_access" on public.profiles
for select using (policies.is_service_role() or (profiles.user_id = policies.current_user_id()));

alter table if exists public.students enable row level security;
create policy if not exists "tenant_isolation_students" on public.students
for all using (policies.allowed_school(school_id)) with check (policies.allowed_school(coalesce(new.school_id, school_id)));

alter table if exists public.parents enable row level security;
create policy if not exists "tenant_isolation_parents" on public.parents
for all using (policies.allowed_school(school_id)) with check (policies.allowed_school(coalesce(new.school_id, school_id)));

alter table if exists public.teachers enable row level security;
create policy if not exists "tenant_isolation_teachers" on public.teachers
for all using (policies.allowed_school(school_id)) with check (policies.allowed_school(coalesce(new.school_id, school_id)));

alter table if exists public.academic_terms enable row level security;
create policy if not exists "tenant_isolation_terms" on public.academic_terms
for all using (policies.allowed_school(school_id)) with check (policies.allowed_school(coalesce(new.school_id, school_id)));

alter table if exists public.classes enable row level security;
create policy if not exists "tenant_isolation_classes" on public.classes
for all using (policies.allowed_school(school_id)) with check (policies.allowed_school(coalesce(new.school_id, school_id)));

alter table if exists public.subjects enable row level security;
create policy if not exists "tenant_isolation_subjects" on public.subjects
for all using (policies.allowed_school(school_id)) with check (policies.allowed_school(coalesce(new.school_id, school_id)));

alter table if exists public.enrollments enable row level security;
create policy if not exists "tenant_isolation_enrollments" on public.enrollments
for all using (policies.allowed_school(school_id)) with check (policies.allowed_school(coalesce(new.school_id, school_id)));

alter table if exists public.attendance enable row level security;
create policy if not exists "tenant_isolation_attendance" on public.attendance
for all using (policies.allowed_school(school_id)) with check (policies.allowed_school(coalesce(new.school_id, school_id)));

alter table if exists public.markbook_entries enable row level security;
create policy if not exists "tenant_isolation_markbook_entries" on public.markbook_entries
for all using (policies.allowed_school(school_id)) with check (policies.allowed_school(coalesce(new.school_id, school_id)));

alter table if exists public.student_assessments enable row level security;
create policy if not exists "tenant_isolation_student_assessments" on public.student_assessments
for all using (policies.allowed_school(school_id)) with check (policies.allowed_school(coalesce(new.school_id, school_id)));

alter table if exists public.report_verifications enable row level security;
create policy if not exists "tenant_isolation_report_verifications" on public.report_verifications
for all using (policies.allowed_school(school_id)) with check (policies.allowed_school(coalesce(new.school_id, school_id)));

COMMIT;

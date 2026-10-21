-- Link authenticated student/parent profiles to their records and scope
-- self-service reads to those verified links.
begin;

alter table public.students
  add column if not exists profile_id uuid;

alter table public.parents
  add column if not exists profile_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'students_profile_school_fkey'
      and conrelid = 'public.students'::regclass
  ) then
    alter table public.students
      add constraint students_profile_school_fkey
      foreign key (profile_id, school_id)
      references public.profiles (id, school_id)
      on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'parents_profile_school_fkey'
      and conrelid = 'public.parents'::regclass
  ) then
    alter table public.parents
      add constraint parents_profile_school_fkey
      foreign key (profile_id, school_id)
      references public.profiles (id, school_id)
      on delete restrict;
  end if;
end;
$$;

create unique index if not exists students_profile_id_unique
  on public.students (profile_id) where profile_id is not null;
create unique index if not exists parents_profile_id_unique
  on public.parents (profile_id) where profile_id is not null;

create or replace function public.assert_student_parent_profile_link()
returns trigger
language plpgsql
set search_path = public, auth
as $$
declare
  linked_role text;
  linked_active boolean;
begin
  if new.profile_id is null then
    return new;
  end if;

  select p.role, p.is_active
    into linked_role, linked_active
  from public.profiles p
  where p.id = new.profile_id
    and p.school_id = new.school_id
  limit 1;

  if linked_role is null or linked_active is not true then
    raise exception 'Linked profile must be active and belong to the same school'
      using errcode = '23514';
  end if;

  if tg_table_name = 'students' and linked_role <> 'student' then
    raise exception 'Student records may only link to student profiles'
      using errcode = '23514';
  end if;

  if tg_table_name = 'parents' and linked_role <> 'parent' then
    raise exception 'Parent records may only link to parent profiles'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists students_profile_link_guard on public.students;
create trigger students_profile_link_guard
  before insert or update of profile_id, school_id on public.students
  for each row execute function public.assert_student_parent_profile_link();

drop trigger if exists parents_profile_link_guard on public.parents;
create trigger parents_profile_link_guard
  before insert or update of profile_id, school_id on public.parents
  for each row execute function public.assert_student_parent_profile_link();

create or replace function policies.is_current_student(target_student_id uuid)
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.students s
    join public.profiles p on p.id = s.profile_id and p.school_id = s.school_id
    where s.id = target_student_id
      and p.user_id = auth.uid()
      and p.role = 'student'
      and p.is_active = true
  );
$$;

create or replace function policies.is_current_parent(target_parent_id uuid)
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.parents p
    join public.profiles pr on pr.id = p.profile_id and pr.school_id = p.school_id
    where p.id = target_parent_id
      and pr.user_id = auth.uid()
      and pr.role = 'parent'
      and pr.is_active = true
  );
$$;

create or replace function policies.is_parent_of_student(target_student_id uuid)
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.student_parents sp
    join public.parents p on p.id = sp.parent_id
    join public.profiles pr on pr.id = p.profile_id and pr.school_id = p.school_id
    where sp.student_id = target_student_id
      and pr.user_id = auth.uid()
      and pr.role = 'parent'
      and pr.is_active = true
  );
$$;

drop policy if exists erp_parents_read on public.parents;
create policy erp_parents_read on public.parents
  for select using (
    policies.is_school_admin(school_id)
    or policies.is_current_parent(id)
  );

drop policy if exists erp_student_parents_read on public.student_parents;
create policy erp_student_parents_read on public.student_parents
  for select using (
    policies.is_school_admin((
      select s.school_id from public.students s
      where s.id = student_parents.student_id
    ))
    or policies.is_current_student(student_id)
    or policies.is_parent_of_student(student_id)
  );

drop policy if exists erp_students_read on public.students;
create policy erp_students_read on public.students
  for select using (
    policies.is_school_admin(school_id)
    or exists (
      select 1
      from public.enrollments e
      where e.student_id = students.id
        and policies.is_teacher_for_class(e.class_id)
    )
    or policies.is_current_student(id)
    or policies.is_parent_of_student(id)
  );

drop policy if exists erp_enrollments_read on public.enrollments;
create policy erp_enrollments_read on public.enrollments
  for select using (
    policies.is_school_admin(school_id)
    or policies.is_teacher_for_class(class_id)
    or policies.is_current_student(student_id)
    or policies.is_parent_of_student(student_id)
  );

drop policy if exists erp_markbook_entries_read on public.markbook_entries;
create policy erp_markbook_entries_read on public.markbook_entries
  for select using (
    policies.is_school_admin(school_id)
    or (
      policies.current_school_id() = school_id
      and policies.is_teacher_for_class_subject(class_id, subject_id)
    )
    or policies.is_current_student(student_id)
    or policies.is_parent_of_student(student_id)
  );

drop policy if exists erp_attendance_read on public.attendance;
create policy erp_attendance_read on public.attendance
  for select using (
    policies.is_school_admin(school_id)
    or (
      policies.current_school_id() = school_id
      and policies.is_teacher_for_class(class_id)
    )
    or policies.is_current_student(student_id)
    or policies.is_parent_of_student(student_id)
  );

revoke all on function public.assert_student_parent_profile_link() from public, anon, authenticated;
revoke all on function policies.is_current_student(uuid) from public;
revoke all on function policies.is_current_parent(uuid) from public;
revoke all on function policies.is_parent_of_student(uuid) from public;
grant execute on function policies.is_current_student(uuid) to authenticated, service_role;
grant execute on function policies.is_current_parent(uuid) to authenticated, service_role;
grant execute on function policies.is_parent_of_student(uuid) to authenticated, service_role;

commit;

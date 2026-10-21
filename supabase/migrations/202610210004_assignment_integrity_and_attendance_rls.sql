-- Tighten teacher assignment integrity and ensure all related rows remain tenant-scoped.
begin;

create or replace function policies.is_teacher_for_class_subject(
  target_class_id uuid,
  target_subject_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, policies
as $$
  select
    coalesce(
      (
        select policies.is_school_admin(c.school_id)
        from public.classes c
        where c.id = target_class_id
        limit 1
      ),
      false
    )
    or exists (
      select 1
      from public.class_subjects cs
      join public.classes c on c.id = cs.class_id
      join public.subjects s on s.id = cs.subject_id
      join public.profiles p on p.id = cs.teacher_id
      where cs.class_id = target_class_id
        and cs.subject_id = target_subject_id
        and c.school_id = s.school_id
        and p.school_id = c.school_id
        and policies.current_school_id() = c.school_id
        and p.user_id = auth.uid()
        and p.role = 'teacher'
        and p.is_active = true
    );
$$;

create or replace function policies.is_teacher_for_class(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, policies
as $$
  select
    coalesce(
      (
        select policies.is_school_admin(c.school_id)
        from public.classes c
        where c.id = target_class_id
        limit 1
      ),
      false
    )
    or exists (
      select 1
      from public.class_subjects cs
      join public.classes c on c.id = cs.class_id
      join public.profiles p on p.id = cs.teacher_id
      where cs.class_id = target_class_id
        and p.school_id = c.school_id
        and policies.current_school_id() = c.school_id
        and p.user_id = auth.uid()
        and p.role = 'teacher'
        and p.is_active = true
    );
$$;

create or replace function public.validate_class_subject_assignment()
returns trigger
language plpgsql
set search_path = public, auth
as $$
declare
  class_school uuid;
  subject_school uuid;
  teacher_school uuid;
  teacher_role text;
  teacher_active boolean;
begin
  select c.school_id into class_school
  from public.classes c where c.id = new.class_id;

  select s.school_id into subject_school
  from public.subjects s where s.id = new.subject_id;

  if class_school is null or subject_school is null or class_school <> subject_school then
    raise exception 'Class and subject must belong to the same school'
      using errcode = '23514';
  end if;

  if new.teacher_id is not null then
    select p.school_id, p.role, p.is_active
      into teacher_school, teacher_role, teacher_active
    from public.profiles p
    where p.id = new.teacher_id;

    if teacher_school is distinct from class_school
       or teacher_role is distinct from 'teacher'
       or teacher_active is not true then
      raise exception 'Assigned teacher must be active and belong to the same school'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists class_subjects_validate_assignment on public.class_subjects;
create trigger class_subjects_validate_assignment
  before insert or update of class_id, subject_id, teacher_id on public.class_subjects
  for each row execute function public.validate_class_subject_assignment();

create or replace function public.validate_student_parent_school_match()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  student_school uuid;
  parent_school uuid;
begin
  select s.school_id into student_school
  from public.students s where s.id = new.student_id;

  select p.school_id into parent_school
  from public.parents p where p.id = new.parent_id;

  if student_school is null or parent_school is null or student_school <> parent_school then
    raise exception 'Parent and student must belong to the same school'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists student_parents_validate_school_match on public.student_parents;
create trigger student_parents_validate_school_match
  before insert or update of student_id, parent_id on public.student_parents
  for each row execute function public.validate_student_parent_school_match();

-- Teacher reads/writes now require a valid assignment and a matching enrollment.
drop policy if exists erp_markbook_entries_read on public.markbook_entries;
create policy erp_markbook_entries_read on public.markbook_entries
  for select using (
    policies.is_school_admin(school_id)
    or (
      policies.current_school_id() = school_id
      and policies.is_teacher_for_class_subject(class_id, subject_id)
      and exists (
        select 1 from public.enrollments e
        where e.student_id = markbook_entries.student_id
          and e.class_id = markbook_entries.class_id
          and e.term_id = markbook_entries.term_id
          and e.school_id = markbook_entries.school_id
      )
    )
    or policies.is_current_student(student_id)
    or policies.is_parent_of_student(student_id)
  );

drop policy if exists erp_markbook_entries_insert on public.markbook_entries;
create policy erp_markbook_entries_insert on public.markbook_entries
  for insert with check (
    policies.is_school_admin(school_id)
    or (
      policies.current_school_id() = school_id
      and policies.is_teacher_for_class_subject(class_id, subject_id)
      and exists (
        select 1 from public.enrollments e
        where e.student_id = markbook_entries.student_id
          and e.class_id = markbook_entries.class_id
          and e.term_id = markbook_entries.term_id
          and e.school_id = markbook_entries.school_id
      )
    )
  );

drop policy if exists erp_markbook_entries_update on public.markbook_entries;
create policy erp_markbook_entries_update on public.markbook_entries
  for update using (
    policies.is_school_admin(school_id)
    or (
      policies.current_school_id() = school_id
      and policies.is_teacher_for_class_subject(class_id, subject_id)
      and exists (
        select 1 from public.enrollments e
        where e.student_id = markbook_entries.student_id
          and e.class_id = markbook_entries.class_id
          and e.term_id = markbook_entries.term_id
          and e.school_id = markbook_entries.school_id
      )
    )
  ) with check (
    policies.is_school_admin(school_id)
    or (
      policies.current_school_id() = school_id
      and policies.is_teacher_for_class_subject(class_id, subject_id)
      and exists (
        select 1 from public.enrollments e
        where e.student_id = markbook_entries.student_id
          and e.class_id = markbook_entries.class_id
          and e.term_id = markbook_entries.term_id
          and e.school_id = markbook_entries.school_id
      )
    )
  );

drop policy if exists erp_markbook_entries_delete on public.markbook_entries;
create policy erp_markbook_entries_delete on public.markbook_entries
  for delete using (policies.is_school_admin(school_id));

-- Give assigned teachers an attendance write policy without permitting them to
-- alter another school's records or mark students outside the assigned class.
drop policy if exists erp_attendance_insert on public.attendance;
create policy erp_attendance_insert on public.attendance
  for insert with check (
    policies.is_school_admin(school_id)
    or (
      policies.current_school_id() = school_id
      and policies.current_role() = 'teacher'
      and policies.is_teacher_for_class(class_id)
      and exists (
        select 1 from public.enrollments e
        where e.student_id = attendance.student_id
          and e.class_id = attendance.class_id
          and e.term_id = attendance.term_id
          and e.school_id = attendance.school_id
      )
    )
  );

drop policy if exists erp_attendance_update on public.attendance;
create policy erp_attendance_update on public.attendance
  for update using (
    policies.is_school_admin(school_id)
    or (
      policies.current_school_id() = school_id
      and policies.current_role() = 'teacher'
      and policies.is_teacher_for_class(class_id)
      and exists (
        select 1 from public.enrollments e
        where e.student_id = attendance.student_id
          and e.class_id = attendance.class_id
          and e.term_id = attendance.term_id
          and e.school_id = attendance.school_id
      )
    )
  ) with check (
    policies.is_school_admin(school_id)
    or (
      policies.current_school_id() = school_id
      and policies.current_role() = 'teacher'
      and policies.is_teacher_for_class(class_id)
      and exists (
        select 1 from public.enrollments e
        where e.student_id = attendance.student_id
          and e.class_id = attendance.class_id
          and e.term_id = attendance.term_id
          and e.school_id = attendance.school_id
      )
    )
  );

revoke all on function public.validate_class_subject_assignment() from public, anon, authenticated;
revoke all on function public.validate_student_parent_school_match() from public, anon, authenticated;
grant execute on function policies.is_teacher_for_class_subject(uuid, uuid) to authenticated, service_role;
grant execute on function policies.is_teacher_for_class(uuid) to authenticated, service_role;

commit;

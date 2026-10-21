-- Atomically create a student and the initial enrollment after validating
-- that the caller administers the school and both selected records belong to it.
begin;

create or replace function public.create_student_and_enroll(
  target_school_id uuid,
  target_class_id uuid,
  target_term_id uuid,
  student_first_name text,
  student_last_name text,
  student_registration_number text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_student_id uuid;
begin
  if not policies.is_school_admin(target_school_id) then
    raise exception 'School administrator access is required'
      using errcode = '42501';
  end if;

  if nullif(btrim(student_first_name), '') is null
     or nullif(btrim(student_last_name), '') is null
     or nullif(btrim(student_registration_number), '') is null then
    raise exception 'Student first name, last name, and registration number are required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.classes c
    where c.id = target_class_id and c.school_id = target_school_id
  ) then
    raise exception 'Class does not belong to the selected school'
      using errcode = '23503';
  end if;

  if not exists (
    select 1 from public.academic_terms t
    where t.id = target_term_id and t.school_id = target_school_id
  ) then
    raise exception 'Academic term does not belong to the selected school'
      using errcode = '23503';
  end if;

  insert into public.students (
    school_id, first_name, last_name, registration_number
  ) values (
    target_school_id,
    btrim(student_first_name),
    btrim(student_last_name),
    btrim(student_registration_number)
  )
  returning id into new_student_id;

  insert into public.enrollments (
    school_id, student_id, class_id, term_id, status, enrollment_date
  ) values (
    target_school_id, new_student_id, target_class_id, target_term_id, 'active', current_date
  );

  return new_student_id;
end;
$$;

revoke all on function public.create_student_and_enroll(uuid, uuid, uuid, text, text, text) from public, anon;
grant execute on function public.create_student_and_enroll(uuid, uuid, uuid, text, text, text) to authenticated, service_role;

commit;

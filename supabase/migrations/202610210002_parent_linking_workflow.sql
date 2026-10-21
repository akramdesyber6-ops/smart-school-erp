-- Atomically create a parent contact and link it to a student after verifying
-- the caller administers the school and the target student belongs to it.
begin;

create or replace function public.create_parent_and_link_student(
  target_school_id uuid,
  target_student_id uuid,
  parent_first_name text,
  parent_last_name text,
  parent_email text default null,
  parent_phone text default null,
  target_relationship text default null,
  target_primary_contact boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_parent_id uuid;
begin
  if not policies.is_school_admin(target_school_id) then
    raise exception 'School administrator access is required'
      using errcode = '42501';
  end if;

  if nullif(btrim(parent_first_name), '') is null
     or nullif(btrim(parent_last_name), '') is null then
    raise exception 'Parent first and last names are required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.students s
    where s.id = target_student_id
      and s.school_id = target_school_id
  ) then
    raise exception 'Student record does not belong to the selected school'
      using errcode = '23503';
  end if;

  insert into public.parents (
    school_id, first_name, last_name, email, phone, relationship_to_student
  ) values (
    target_school_id,
    btrim(parent_first_name),
    btrim(parent_last_name),
    nullif(btrim(parent_email), ''),
    nullif(btrim(parent_phone), ''),
    nullif(btrim(target_relationship), '')
  )
  returning id into new_parent_id;

  insert into public.student_parents (
    student_id, parent_id, is_primary_contact
  ) values (
    target_student_id, new_parent_id, coalesce(target_primary_contact, false)
  );

  return new_parent_id;
end;
$$;

revoke all on function public.create_parent_and_link_student(
  uuid, uuid, text, text, text, text, text, boolean
) from public, anon;
grant execute on function public.create_parent_and_link_student(
  uuid, uuid, text, text, text, text, text, boolean
) to authenticated, service_role;

commit;

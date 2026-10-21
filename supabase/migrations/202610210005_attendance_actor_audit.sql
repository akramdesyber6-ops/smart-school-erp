-- Derive attendance audit attribution from the authenticated active profile.
-- Callers may not impersonate another staff member by supplying marked_by.
begin;

create or replace function public.set_attendance_actor_audit_fields()
returns trigger
language plpgsql
set search_path = public, auth
as $$
declare
  actor_profile_id uuid;
begin
  if auth.role() = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  select p.id
    into actor_profile_id
  from public.profiles p
  where p.user_id = auth.uid()
    and p.is_active = true
  limit 1;

  if actor_profile_id is null then
    raise exception 'An active profile is required to write attendance'
      using errcode = '42501';
  end if;

  new.marked_by := actor_profile_id;
  return new;
end;
$$;

drop trigger if exists attendance_actor_audit_fields on public.attendance;
create trigger attendance_actor_audit_fields
  before insert or update on public.attendance
  for each row execute function public.set_attendance_actor_audit_fields();

revoke all on function public.set_attendance_actor_audit_fields() from public, anon, authenticated;

commit;

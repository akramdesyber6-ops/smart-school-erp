-- Prevent direct client writes from changing profile identity, tenant, role,
-- or activation state. Trusted server-side provisioning uses service_role.
begin;

create or replace function public.guard_profile_identity_fields()
returns trigger
language plpgsql
set search_path = public, auth
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'Profile provisioning must use a trusted server workflow'
      using errcode = '42501';
  end if;

  if new.user_id is distinct from old.user_id
     or new.school_id is distinct from old.school_id
     or new.role is distinct from old.role
     or new.is_active is distinct from old.is_active then
    raise exception 'Profile identity, tenant, role, and activation fields are server-managed'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_identity_fields on public.profiles;
create trigger profiles_guard_identity_fields
  before insert or update of user_id, school_id, role, is_active
  on public.profiles
  for each row execute function public.guard_profile_identity_fields();

revoke all on function public.guard_profile_identity_fields() from public, anon, authenticated;

commit;

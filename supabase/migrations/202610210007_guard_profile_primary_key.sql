-- Extend the protected profile identity guard to include the primary key.
-- A caller must never re-key a profile to evade the profile-to-auth identity link.
begin;

create or replace function public.guard_profile_identity_fields()
returns trigger
language plpgsql
set search_path = public, auth
as $$
begin
  if auth.role() = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'Profile provisioning must use a trusted server workflow'
      using errcode = '42501';
  end if;

  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
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
  before insert or update on public.profiles
  for each row execute function public.guard_profile_identity_fields();

revoke all on function public.guard_profile_identity_fields() from public, anon, authenticated;

commit;

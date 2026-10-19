-- Add the audit columns already written by the teacher markbook UI and
-- derive the actor from the authenticated profile instead of trusting payloads.
begin;

alter table public.markbook_entries
  add column if not exists teacher_id uuid references public.profiles(id) on delete set null,
  add column if not exists marked_at timestamptz not null default timezone('utc', now());

create or replace function public.set_markbook_actor_audit_fields()
returns trigger
language plpgsql
set search_path = public, auth
as $$
declare
  actor_profile_id uuid;
begin
  -- Trusted server workflows may preserve an explicitly supplied actor for
  -- backfills/imports. Normal authenticated clients cannot spoof these fields.
  if auth.role() = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    new.marked_at := coalesce(new.marked_at, timezone('utc', now()));
    return new;
  end if;

  select p.id
    into actor_profile_id
  from public.profiles p
  where p.user_id = auth.uid()
    and p.is_active = true
  limit 1;

  if actor_profile_id is null then
    raise exception 'An active profile is required to write markbook entries'
      using errcode = '42501';
  end if;

  new.teacher_id := actor_profile_id;
  new.marked_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists markbook_actor_audit_fields on public.markbook_entries;
create trigger markbook_actor_audit_fields
  before insert or update on public.markbook_entries
  for each row execute function public.set_markbook_actor_audit_fields();

revoke all on function public.set_markbook_actor_audit_fields() from public, anon, authenticated;

commit;

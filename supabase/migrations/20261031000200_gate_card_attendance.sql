-- Separate, immutable gate events for RFID/card readers.
-- Gate devices authenticate with a one-time-issued random token. Only its SHA-256
-- hash is stored. The device never supplies a student ID; the server resolves the
-- presented card inside the device's school boundary.
begin;

create extension if not exists pgcrypto;

create table public.gate_devices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  device_code text not null unique,
  name text not null,
  secret_hash text not null,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz,
  revoked_by uuid,
  unique (id, school_id),
  foreign key (created_by, school_id)
    references public.profiles(id, school_id) on delete restrict,
  foreign key (revoked_by, school_id)
    references public.profiles(id, school_id) on delete restrict,
  check (length(btrim(name)) between 1 and 100),
  check (device_code ~ '^GATE-[A-F0-9]{10}$'),
  check (secret_hash ~ '^[a-f0-9]{64}$'),
  check ((is_active and revoked_at is null and revoked_by is null)
    or (not is_active and revoked_at is not null and revoked_by is not null))
);

create index gate_devices_school_active_idx
  on public.gate_devices(school_id, is_active);

create table public.student_gate_cards (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null,
  card_uid text not null,
  label text,
  is_active boolean not null default true,
  created_by uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz,
  revoked_by uuid,
  unique (id, school_id),
  foreign key (student_id, school_id)
    references public.students(id, school_id) on delete restrict,
  foreign key (created_by, school_id)
    references public.profiles(id, school_id) on delete restrict,
  foreign key (revoked_by, school_id)
    references public.profiles(id, school_id) on delete restrict,
  check (length(btrim(card_uid)) between 1 and 128),
  check (label is null or length(btrim(label)) <= 100),
  check ((is_active and revoked_at is null and revoked_by is null)
    or (not is_active and revoked_at is not null and revoked_by is not null))
);

create unique index student_gate_cards_school_uid_active_idx
  on public.student_gate_cards(school_id, card_uid)
  where is_active;

create index student_gate_cards_student_idx
  on public.student_gate_cards(school_id, student_id)
  where is_active;

create table public.gate_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  gate_device_id uuid not null,
  card_id uuid not null,
  student_id uuid not null,
  device_event_id text not null,
  event_type text not null check (event_type in ('entry', 'exit')),
  occurred_at timestamptz not null,
  received_at timestamptz not null default timezone('utc', now()),
  foreign key (gate_device_id, school_id)
    references public.gate_devices(id, school_id) on delete restrict,
  foreign key (card_id, school_id)
    references public.student_gate_cards(id, school_id) on delete restrict,
  foreign key (student_id, school_id)
    references public.students(id, school_id) on delete restrict,
  unique (gate_device_id, device_event_id),
  check (length(btrim(device_event_id)) between 1 and 128)
);

create index gate_events_school_occurred_idx
  on public.gate_events(school_id, occurred_at desc);
create index gate_events_student_occurred_idx
  on public.gate_events(school_id, student_id, occurred_at desc);
create index gate_events_device_received_idx
  on public.gate_events(gate_device_id, received_at desc);

-- Re-check device, card and student state in the same transaction as the insert.
-- Row locks serialize a scan against a simultaneous device/card revocation.
create or replace function public.validate_gate_event_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $
declare
  v_device_school_id uuid;
  v_card_school_id uuid;
  v_card_student_id uuid;
  v_student_school_id uuid;
  v_student_active boolean;
begin
  select d.school_id
    into v_device_school_id
  from public.gate_devices d
  where d.id = new.gate_device_id
    and d.school_id = new.school_id
    and d.is_active = true
  for share;

  if v_device_school_id is null then
    raise exception 'Gate device is inactive or does not belong to this school'
      using errcode = '23514';
  end if;

  select c.school_id, c.student_id
    into v_card_school_id, v_card_student_id
  from public.student_gate_cards c
  where c.id = new.card_id
    and c.school_id = new.school_id
    and c.is_active = true
  for share;

  if v_card_school_id is null or v_card_student_id is distinct from new.student_id then
    raise exception 'Student card is inactive or does not match the gate event'
      using errcode = '23514';
  end if;

  select s.school_id, s.is_active
    into v_student_school_id, v_student_active
  from public.students s
  where s.id = new.student_id
    and s.school_id = new.school_id
  for share;

  if v_student_school_id is null or v_student_active is not true then
    raise exception 'Student is inactive or does not belong to this school'
      using errcode = '23514';
  end if;

  return new;
end;
$;

create trigger gate_events_validate_active_identity
  before insert on public.gate_events
  for each row execute function public.validate_gate_event_insert();

revoke all on function public.validate_gate_event_insert() from public, anon, authenticated;

-- Issue a device credential once. Only the SHA-256 hash is persisted.
create or replace function public.create_gate_device(target_name text)
returns table(device_id uuid, device_code text, device_name text, device_token text)
language plpgsql
security definer
set search_path = public, auth, policies, extensions
as $$
declare
  v_school_id uuid;
  v_profile_id uuid;
  v_device_id uuid := gen_random_uuid();
  v_device_code text;
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'Sign in as a school administrator to create a gate device'
      using errcode = '42501';
  end if;

  v_school_id := policies.current_school_id();
  if v_school_id is null or policies.current_role() not in ('admin', 'school_admin') then
    raise exception 'Only a school administrator can create gate devices'
      using errcode = '42501';
  end if;

  if target_name is null or length(btrim(target_name)) not between 1 and 100 then
    raise exception 'Enter a device name between 1 and 100 characters'
      using errcode = '22023';
  end if;

  select p.id into v_profile_id
  from public.profiles p
  where p.user_id = auth.uid()
    and p.school_id = v_school_id
    and p.is_active = true
  limit 1;

  if v_profile_id is null then
    raise exception 'An active school administrator profile is required'
      using errcode = '42501';
  end if;

  v_device_code := 'GATE-' || upper(substr(replace(v_device_id::text, '-', ''), 1, 10));
  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.gate_devices (
    id, school_id, device_code, name, secret_hash, created_by
  ) values (
    v_device_id,
    v_school_id,
    v_device_code,
    btrim(target_name),
    encode(digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex'),
    v_profile_id
  );

  return query select v_device_id, v_device_code, btrim(target_name), v_token;
end;
$$;

create or replace function public.assign_student_gate_card(
  target_student_id uuid,
  target_card_uid text,
  target_label text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, policies
as $$
declare
  v_school_id uuid;
  v_profile_id uuid;
  v_card_id uuid;
  v_card_uid text;
begin
  if auth.uid() is null then
    raise exception 'Sign in as a school administrator to assign a card'
      using errcode = '42501';
  end if;

  v_school_id := policies.current_school_id();
  if v_school_id is null or policies.current_role() not in ('admin', 'school_admin') then
    raise exception 'Only a school administrator can assign student cards'
      using errcode = '42501';
  end if;

  select p.id into v_profile_id
  from public.profiles p
  where p.user_id = auth.uid()
    and p.school_id = v_school_id
    and p.is_active = true
  limit 1;

  if v_profile_id is null then
    raise exception 'An active school administrator profile is required'
      using errcode = '42501';
  end if;

  v_card_uid := upper(btrim(target_card_uid));
  if target_student_id is null
     or v_card_uid is null
     or length(v_card_uid) not between 1 and 128
     or target_label is not null and length(btrim(target_label)) > 100 then
    raise exception 'A student and valid card UID are required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.students s
    where s.id = target_student_id
      and s.school_id = v_school_id
      and s.is_active = true
  ) then
    raise exception 'Student not found or inactive in this school'
      using errcode = '23503';
  end if;

  insert into public.student_gate_cards (
    school_id, student_id, card_uid, label, created_by
  ) values (
    v_school_id, target_student_id, v_card_uid, nullif(btrim(target_label), ''), v_profile_id
  )
  returning id into v_card_id;

  return v_card_id;
end;
$$;

create or replace function public.revoke_gate_device(target_device_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, policies
as $$
declare
  v_school_id uuid;
  v_profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in as a school administrator'
      using errcode = '42501';
  end if;

  v_school_id := policies.current_school_id();
  if v_school_id is null or policies.current_role() not in ('admin', 'school_admin') then
    raise exception 'Only a school administrator can revoke a gate device'
      using errcode = '42501';
  end if;

  select p.id into v_profile_id
  from public.profiles p
  where p.user_id = auth.uid()
    and p.school_id = v_school_id
    and p.is_active = true
  limit 1;

  update public.gate_devices
  set is_active = false,
      revoked_at = timezone('utc', now()),
      revoked_by = v_profile_id
  where id = target_device_id
    and school_id = v_school_id
    and is_active = true;

  if not found then
    raise exception 'Active gate device not found in this school'
      using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.revoke_student_gate_card(target_card_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, policies
as $$
declare
  v_school_id uuid;
  v_profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in as a school administrator'
      using errcode = '42501';
  end if;

  v_school_id := policies.current_school_id();
  if v_school_id is null or policies.current_role() not in ('admin', 'school_admin') then
    raise exception 'Only a school administrator can revoke student cards'
      using errcode = '42501';
  end if;

  select p.id into v_profile_id
  from public.profiles p
  where p.user_id = auth.uid()
    and p.school_id = v_school_id
    and p.is_active = true
  limit 1;

  update public.student_gate_cards
  set is_active = false,
      revoked_at = timezone('utc', now()),
      revoked_by = v_profile_id
  where id = target_card_id
    and school_id = v_school_id
    and is_active = true;

  if not found then
    raise exception 'Active student card not found in this school'
      using errcode = 'P0002';
  end if;
end;
$$;

alter table public.gate_devices enable row level security;
alter table public.student_gate_cards enable row level security;
alter table public.gate_events enable row level security;

drop policy if exists gate_devices_admin_read on public.gate_devices;
create policy gate_devices_admin_read on public.gate_devices
  for select to authenticated
  using (policies.is_school_admin(school_id));

drop policy if exists student_gate_cards_admin_read on public.student_gate_cards;
create policy student_gate_cards_admin_read on public.student_gate_cards
  for select to authenticated
  using (policies.is_school_admin(school_id));

drop policy if exists gate_events_school_and_guardian_read on public.gate_events;
create policy gate_events_school_and_guardian_read on public.gate_events
  for select to authenticated
  using (
    policies.is_school_admin(school_id)
    or policies.is_current_student(student_id)
    or policies.is_parent_of_student(student_id)
  );

-- A signed-in administrator can inspect safe device metadata, never credential hashes.
revoke all on public.gate_devices from public, anon, authenticated;
grant select (
  id, school_id, device_code, name, is_active, last_seen_at,
  created_by, created_at, revoked_at, revoked_by
) on public.gate_devices to authenticated;
grant select, update on public.gate_devices to service_role;

revoke all on public.student_gate_cards from public, anon, authenticated;
grant select on public.student_gate_cards to authenticated;
grant select on public.student_gate_cards to service_role;

revoke all on public.gate_events from public, anon, authenticated;
grant select on public.gate_events to authenticated;
grant select, insert on public.gate_events to service_role;

revoke all on function public.create_gate_device(text) from public, anon;
revoke all on function public.assign_student_gate_card(uuid, text, text) from public, anon;
revoke all on function public.revoke_gate_device(uuid) from public, anon;
revoke all on function public.revoke_student_gate_card(uuid) from public, anon;
grant execute on function public.create_gate_device(text) to authenticated;
grant execute on function public.assign_student_gate_card(uuid, text, text) to authenticated;
grant execute on function public.revoke_gate_device(uuid) to authenticated;
grant execute on function public.revoke_student_gate_card(uuid) to authenticated;

commit;

begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(8);

insert into public.schools (id, name, emis_code)
values
  ('550e8400-e29b-41d4-a716-446655440200'::uuid, 'Gate Test School', 'EMIS-GATE-200'),
  ('550e8400-e29b-41d4-a716-446655440201'::uuid, 'Other Gate Test School', 'EMIS-GATE-201')
on conflict (id) do nothing;

insert into public.students (
  id, school_id, first_name, last_name, registration_number, is_active
) values
  ('d10e8400-e29b-41d4-a716-446655440200'::uuid,
   '550e8400-e29b-41d4-a716-446655440200'::uuid,
   'Gate', 'Student', 'GATE-200', true),
  ('d10e8400-e29b-41d4-a716-446655440201'::uuid,
   '550e8400-e29b-41d4-a716-446655440201'::uuid,
   'Foreign', 'Student', 'GATE-201', true);

insert into public.profiles (
  id, user_id, school_id, role, first_name, last_name, email, is_active
) values (
  'a10e8400-e29b-41d4-a716-446655440200'::uuid,
  'c20e8400-e29b-41d4-a716-446655440200'::uuid,
  '550e8400-e29b-41d4-a716-446655440200'::uuid,
  'school_admin', 'Gate', 'Administrator', 'gate.admin.rls-test@example.invalid', true
);

create temporary table gate_test_fixture (
  device_id uuid,
  device_code text,
  device_token text,
  school_id uuid,
  student_id uuid,
  card_id uuid,
  cross_school_rejected boolean
);
grant insert, select, update on gate_test_fixture to authenticated;

create temporary table gate_test_result (
  case_key text primary key,
  value_boolean boolean
);
grant insert, select, update on gate_test_result to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c20e8400-e29b-41d4-a716-446655440200', true);

insert into pg_temp.gate_test_fixture (device_id, device_code, device_token, school_id, student_id)
select device_id, device_code, device_token,
  '550e8400-e29b-41d4-a716-446655440200'::uuid,
  'd10e8400-e29b-41d4-a716-446655440200'::uuid
from public.create_gate_device('Main Entrance Reader');

update pg_temp.gate_test_fixture
set card_id = public.assign_student_gate_card(
  student_id, 'A1B2C3D4', 'Student ID card'
);

insert into pg_temp.gate_test_result(case_key, value_boolean)
values ('own_school_device_and_card', true);

do $$
begin
  begin
    perform public.assign_student_gate_card(
      'd10e8400-e29b-41d4-a716-446655440201'::uuid,
      'F0E1D2C3',
      'Cross-school attempt'
    );
    insert into pg_temp.gate_test_result(case_key, value_boolean)
    values ('cross_school_card_rejected', false);
  exception when sqlstate '23503' then
    insert into pg_temp.gate_test_result(case_key, value_boolean)
    values ('cross_school_card_rejected', true);
  end;
end;
$$;

reset role;

insert into public.gate_events (
  school_id, gate_device_id, card_id, student_id,
  device_event_id, event_type, occurred_at
)
select school_id, device_id, card_id, student_id,
  'device-event-unique-001', 'entry', timezone('utc', now())
from pg_temp.gate_test_fixture;

insert into public.gate_events (
  school_id, gate_device_id, card_id, student_id,
  device_event_id, event_type, occurred_at
)
select school_id, device_id, card_id, student_id,
  'device-event-unique-001', 'entry', timezone('utc', now())
from pg_temp.gate_test_fixture
on conflict (gate_device_id, device_event_id) do nothing;

select ok(
  (select count(*) = 3
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = any (array['gate_devices', 'student_gate_cards', 'gate_events'])
     and c.relrowsecurity),
  'RLS is enabled on all gate attendance tables'
);

select ok(
  not exists (
    select 1
    from (values
      ('gate_devices', 'gate_devices_admin_read'),
      ('student_gate_cards', 'student_gate_cards_admin_read'),
      ('gate_events', 'gate_events_school_and_guardian_read')
    ) as expected(tablename, policyname)
    where not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = expected.tablename
        and p.policyname = expected.policyname
    )
  ),
  'Gate devices, card assignments and gate events have explicit read policies'
);

select ok(
  to_regprocedure('public.create_gate_device(text)') is not null
  and to_regprocedure('public.assign_student_gate_card(uuid,text,text)') is not null
  and to_regprocedure('public.revoke_gate_device(uuid)') is not null
  and to_regprocedure('public.revoke_student_gate_card(uuid)') is not null,
  'Gate provisioning and revocation RPCs exist'
);

select ok(
  not has_column_privilege('authenticated', 'public.gate_devices', 'secret_hash', 'SELECT')
  and not has_function_privilege('anon', 'public.create_gate_device(text)', 'EXECUTE')
  and has_table_privilege('service_role', 'public.gate_events', 'INSERT'),
  'Device credential hashes stay private and only the service role can ingest gate events'
);

select ok(
  (select device_code like 'GATE-%'
      and length(device_token) = 64
      and card_id is not null
   from pg_temp.gate_test_fixture)
  and (select value_boolean from pg_temp.gate_test_result where case_key = 'own_school_device_and_card'),
  'A school administrator can provision a device and assign a student card'
);

select ok(
  (select value_boolean from pg_temp.gate_test_result where case_key = 'cross_school_card_rejected'),
  'A school administrator cannot assign a card to another school student'
);

select ok(
  (select count(*) = 1
   from public.gate_events e
   join pg_temp.gate_test_fixture f
     on f.device_id = e.gate_device_id
   where e.device_event_id = 'device-event-unique-001'),
  'The database enforces one event per device event ID'
);

-- Revocation and event insertion serialize through the trigger's row lock.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c20e8400-e29b-41d4-a716-446655440200', true);
select public.revoke_gate_device((select device_id from pg_temp.gate_test_fixture limit 1));
reset role;

do $
declare
  v_rejected boolean := false;
begin
  begin
    insert into public.gate_events (
      school_id, gate_device_id, card_id, student_id,
      device_event_id, event_type, occurred_at
    )
    select school_id, device_id, card_id, student_id,
      'device-event-after-revoke', 'exit', timezone('utc', now())
    from pg_temp.gate_test_fixture;
  exception when sqlstate '23514' then
    v_rejected := true;
  end;

  insert into pg_temp.gate_test_result(case_key, value_boolean)
  values ('revoked_device_rejected', v_rejected);
end;
$;

select extensions.ok(
  (select value_boolean from pg_temp.gate_test_result where case_key = 'revoked_device_rejected'),
  'The database rejects new scans after a gate reader is revoked'
);

select * from extensions.finish();
rollback;

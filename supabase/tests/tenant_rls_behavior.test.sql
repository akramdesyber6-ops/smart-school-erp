begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(4);

-- Fixtures use the seed school and existing seeded teacher profiles.
-- Everything in this file is rolled back at the end; never target a remote DB.
insert into public.schools (id, name, emis_code)
values (
  '550e8400-e29b-41d4-a716-446655440099'::uuid,
  'Tenant Isolation Test School',
  'EMIS-RLS-TEST-099'
)
on conflict (id) do nothing;

insert into public.profiles (
  id, user_id, school_id, role, first_name, last_name, email, is_active
) values (
  'a10e8400-e29b-41d4-a716-446655440099'::uuid,
  'c20e8400-e29b-41d4-a716-446655440099'::uuid,
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  'teacher',
  'Unassigned',
  'Teacher',
  'unassigned.teacher.rls-test@example.invalid',
  true
)
on conflict (id) do nothing;

-- Record results while SET ROLE is active, then execute pgTAP assertions as
-- the database owner so extension function privileges do not affect RLS tests.
create temporary table rls_actual (
  case_key text primary key,
  actual_count integer not null
);
grant insert, select on rls_actual to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c20e8400-e29b-41d4-a716-446655440001', true);

insert into pg_temp.rls_actual(case_key, actual_count)
select 'school_admin_own_school_count', count(*)::integer
from public.schools;

with changed_rows as (
  update public.schools
     set name = 'Attempted Cross-Tenant Edit'
   where id = '550e8400-e29b-41d4-a716-446655440099'::uuid
  returning id
)
insert into pg_temp.rls_actual(case_key, actual_count)
select 'school_admin_cross_tenant_update_count', count(*)::integer
from changed_rows;

reset role;
select extensions.is(
  (select actual_count from pg_temp.rls_actual where case_key = 'school_admin_own_school_count'),
  1,
  'a school administrator can read only their own school'
);
select extensions.is(
  (select actual_count from pg_temp.rls_actual where case_key = 'school_admin_cross_tenant_update_count'),
  0,
  'a school administrator cannot update another school'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c20e8400-e29b-41d4-a716-446655440002', true);
insert into pg_temp.rls_actual(case_key, actual_count)
select 'assigned_teacher_mark_count', count(*)::integer
from public.markbook_entries;
reset role;

select extensions.ok(
  (select actual_count > 0 from pg_temp.rls_actual where case_key = 'assigned_teacher_mark_count'),
  'an assigned teacher can read marks for their assigned class/subjects'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c20e8400-e29b-41d4-a716-446655440099', true);
insert into pg_temp.rls_actual(case_key, actual_count)
select 'unassigned_teacher_mark_count', count(*)::integer
from public.markbook_entries;
reset role;

select extensions.is(
  (select actual_count from pg_temp.rls_actual where case_key = 'unassigned_teacher_mark_count'),
  0,
  'an unassigned same-school teacher cannot read markbook entries'
);

select * from extensions.finish();
rollback;

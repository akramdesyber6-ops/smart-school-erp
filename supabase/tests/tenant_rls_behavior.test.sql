begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(4);

-- Fixtures use the seed school and its existing seeded teacher profiles.
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

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c20e8400-e29b-41d4-a716-446655440001', true);

select extensions.is(
  (select count(*)::integer from public.schools),
  1,
  'a school administrator can read only their own school'
);

with changed_rows as (
  update public.schools
     set name = 'Attempted Cross-Tenant Edit'
   where id = '550e8400-e29b-41d4-a716-446655440099'::uuid
  returning id
)
select extensions.is(
  (select count(*)::integer from changed_rows),
  0,
  'a school administrator cannot update another school'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c20e8400-e29b-41d4-a716-446655440002', true);

select extensions.ok(
  (select count(*) > 0 from public.markbook_entries),
  'an assigned teacher can read marks for their assigned class/subjects'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c20e8400-e29b-41d4-a716-446655440099', true);

select extensions.is(
  (select count(*)::integer from public.markbook_entries),
  0,
  'an unassigned same-school teacher cannot read markbook entries'
);

reset role;
select * from extensions.finish();
rollback;

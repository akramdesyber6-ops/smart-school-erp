begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(9);

-- All fixtures are rolled back. These IDs are intentionally separate from the
-- normal school seed except for the existing seeded Amina enrollment.
insert into public.schools (id, name, emis_code)
values (
  '550e8400-e29b-41d4-a716-446655440098'::uuid,
  'Finance Tenant Boundary Test School',
  'EMIS-FIN-TEST-098'
)
on conflict (id) do nothing;

insert into public.academic_years (
  id, school_id, year, start_date, end_date, is_current
) values (
  '650e8400-e29b-41d4-a716-446655440098'::uuid,
  '550e8400-e29b-41d4-a716-446655440098'::uuid,
  2026, '2026-01-01', '2026-12-31', true
);

insert into public.academic_terms (
  id, school_id, academic_year_id, name, start_date, end_date, is_current
) values (
  '750e8400-e29b-41d4-a716-446655440098'::uuid,
  '550e8400-e29b-41d4-a716-446655440098'::uuid,
  '650e8400-e29b-41d4-a716-446655440098'::uuid,
  'Finance boundary test term', '2026-01-01', '2026-12-31', true
);

insert into public.classes (id, school_id, name, curriculum)
values (
  '850e8400-e29b-41d4-a716-446655440098'::uuid,
  '550e8400-e29b-41d4-a716-446655440098'::uuid,
  'Finance boundary class', 'NCDC'
);

insert into public.students (
  id, school_id, first_name, last_name, registration_number, is_active
) values (
  'd10e8400-e29b-41d4-a716-446655440098'::uuid,
  '550e8400-e29b-41d4-a716-446655440098'::uuid,
  'Other', 'School Student', 'FIN-OTHER-001', true
);

insert into public.enrollments (
  school_id, student_id, class_id, term_id, status, enrollment_date
) values (
  '550e8400-e29b-41d4-a716-446655440098'::uuid,
  'd10e8400-e29b-41d4-a716-446655440098'::uuid,
  '850e8400-e29b-41d4-a716-446655440098'::uuid,
  '750e8400-e29b-41d4-a716-446655440098'::uuid,
  'active', current_date
);

insert into public.profiles (
  id, user_id, school_id, role, first_name, last_name, email, is_active
) values (
  'a10e8400-e29b-41d4-a716-446655440098'::uuid,
  'c20e8400-e29b-41d4-a716-446655440098'::uuid,
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  'bursar', 'Finance', 'Operator', 'finance.operator.rls-test@example.invalid', true
);

insert into public.fee_categories (id, school_id, name)
values (
  'b10e8400-e29b-41d4-a716-446655440098'::uuid,
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  'RLS test tuition'
);

insert into public.fee_structures (
  id, school_id, academic_year_id, term_id, class_id, category_id,
  name, amount, due_date, created_by
) values (
  'b20e8400-e29b-41d4-a716-446655440098'::uuid,
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  '650e8400-e29b-41d4-a716-446655440001'::uuid,
  '750e8400-e29b-41d4-a716-446655440002'::uuid,
  '850e8400-e29b-41d4-a716-446655440001'::uuid,
  'b10e8400-e29b-41d4-a716-446655440098'::uuid,
  'Term tuition', 100000, '2026-10-31',
  'a10e8400-e29b-41d4-a716-446655440098'::uuid
);

create temporary table finance_test_results (
  case_key text primary key,
  value_numeric numeric,
  value_text text,
  value_boolean boolean
);
grant insert, select, update on finance_test_results to authenticated;

create temporary table finance_test_ids (
  invoice_id uuid,
  payment_id uuid
);
grant insert, select, update on finance_test_ids to authenticated;

-- Exercise invoice and payment RPCs as a real authenticated bursar.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c20e8400-e29b-41d4-a716-446655440098', true);

insert into pg_temp.finance_test_results(case_key, value_boolean)
select 'bursar_scope',
  policies.can_manage_finance('550e8400-e29b-41d4-a716-446655440001'::uuid)
  and not policies.can_manage_finance('550e8400-e29b-41d4-a716-446655440098'::uuid);

insert into pg_temp.finance_test_ids(invoice_id)
select public.create_student_invoice(
  'd10e8400-e29b-41d4-a716-446655440001'::uuid,
  '750e8400-e29b-41d4-a716-446655440002'::uuid,
  '2026-10-31'::date,
  'RLS finance module test',
  array['b20e8400-e29b-41d4-a716-446655440098'::uuid]
);

insert into pg_temp.finance_test_results(case_key, value_boolean)
values ('cross_school_invoice_rejected', true);

-- This is expected to raise 23503 because the bursar cannot bill another school's learner.
do $$
begin
  begin
    perform public.create_student_invoice(
      'd10e8400-e29b-41d4-a716-446655440098'::uuid,
      '750e8400-e29b-41d4-a716-446655440098'::uuid,
      null,
      'Must not cross tenant',
      array['b20e8400-e29b-41d4-a716-446655440098'::uuid]
    );
    update pg_temp.finance_test_results
      set value_boolean = false
      where case_key = 'cross_school_invoice_rejected';
  exception when sqlstate '23503' then
    update pg_temp.finance_test_results
      set value_boolean = true
      where case_key = 'cross_school_invoice_rejected';
  end;
end;
$$;

update pg_temp.finance_test_ids
set payment_id = public.record_fee_payment(
  invoice_id,
  25000,
  'cash',
  'RLS-FINANCE-TEST-001',
  'f20e8400-e29b-41d4-a716-446655440098'::uuid
)
where invoice_id is not null;

insert into pg_temp.finance_test_results(case_key, value_numeric)
select 'partial_payment_balance', balance
from public.student_invoice_balances
where id = (select invoice_id from pg_temp.finance_test_ids limit 1);

select public.reverse_fee_payment(
  (select payment_id from pg_temp.finance_test_ids limit 1),
  'RLS finance test reversal'
);

insert into pg_temp.finance_test_results(case_key, value_numeric)
select 'reversed_payment_balance', balance
from public.student_invoice_balances
where id = (select invoice_id from pg_temp.finance_test_ids limit 1);

reset role;

select ok(
  (select count(*) = 6
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = any (array[
       'fee_categories', 'fee_structures', 'student_invoices',
       'student_invoice_items', 'fee_payments', 'fee_payment_allocations'
     ])
     and c.relrowsecurity),
  'RLS is enabled on all six finance tables'
);

select ok(
  not exists (
    select 1
    from (values
      ('fee_categories', 'fee_categories_manage'),
      ('fee_structures', 'fee_structures_manage'),
      ('student_invoices', 'student_invoices_read'),
      ('student_invoice_items', 'student_invoice_items_read'),
      ('fee_payments', 'fee_payments_read'),
      ('fee_payment_allocations', 'fee_payment_allocations_read')
    ) as expected(tablename, policyname)
    where not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = expected.tablename
        and p.policyname = expected.policyname
    )
  ),
  'Finance RLS policies exist for setup, invoices, receipts and allocations'
);

select ok(
  to_regprocedure('public.create_student_invoice(uuid,uuid,date,text,uuid[])') is not null
  and to_regprocedure('public.record_fee_payment(uuid,numeric,text,text,uuid)') is not null
  and to_regprocedure('public.reverse_fee_payment(uuid,text)') is not null,
  'Invoice, payment and reversal RPC functions exist'
);

select ok(
  has_table_privilege('authenticated', 'public.fee_categories', 'INSERT')
  and has_table_privilege('authenticated', 'public.fee_structures', 'INSERT')
  and has_table_privilege('authenticated', 'public.student_invoice_balances', 'SELECT')
  and not has_table_privilege('authenticated', 'public.student_invoices', 'INSERT')
  and not has_table_privilege('authenticated', 'public.fee_payments', 'INSERT')
  and not has_table_privilege('anon', 'public.fee_payments', 'SELECT'),
  'Data API grants expose only intended finance operations'
);

select extensions.is(
  (select value_numeric from finance_test_results where case_key = 'partial_payment_balance'),
  75000::numeric,
  'posting a partial payment updates the invoice balance atomically'
);

select extensions.is(
  (select value_numeric from finance_test_results where case_key = 'reversed_payment_balance'),
  100000::numeric,
  'reversing a receipt restores the outstanding invoice balance'
);

select extensions.ok(
  (select value_boolean from finance_test_results where case_key = 'bursar_scope'),
  'a bursar can manage finance only inside their own school'
);

select extensions.ok(
  (select value_boolean from finance_test_results where case_key = 'cross_school_invoice_rejected'),
  'a bursar cannot issue an invoice for another school student'
);

select extensions.is(
  (select status from public.fee_payments
   where id = (select payment_id from finance_test_ids limit 1)),
  'reversed',
  'payment correction is retained as an audited reversal'
);

select * from extensions.finish();
rollback;

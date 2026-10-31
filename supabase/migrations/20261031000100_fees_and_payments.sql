-- Tenant-scoped fee structures, student invoices, payments and receipts.
-- Payment posting/reversal is transactional and server-validated. Payments are
-- append-only: corrections are made through a reversal, never by editing amounts.
begin;

-- Add a dedicated finance operator without granting school-administration access.
alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'school_admin', 'teacher', 'student', 'parent', 'bursar'));

create table public.fee_categories (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, name),
  unique (id, school_id),
  check (length(btrim(name)) > 0)
);

create table public.fee_structures (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  academic_year_id uuid not null,
  term_id uuid not null,
  class_id uuid not null,
  category_id uuid not null,
  name text not null,
  description text,
  amount numeric(12,2) not null check (amount > 0),
  due_date date,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, school_id),
  foreign key (academic_year_id, school_id)
    references public.academic_years(id, school_id) on delete restrict,
  foreign key (term_id, school_id)
    references public.academic_terms(id, school_id) on delete restrict,
  foreign key (class_id, school_id)
    references public.classes(id, school_id) on delete restrict,
  foreign key (category_id, school_id)
    references public.fee_categories(id, school_id) on delete restrict,
  foreign key (created_by, school_id)
    references public.profiles(id, school_id) on delete restrict,
  check (length(btrim(name)) > 0)
);

create index fee_structures_school_term_class_idx
  on public.fee_structures(school_id, term_id, class_id)
  where is_active;

create table public.student_invoices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null,
  term_id uuid not null,
  invoice_number text not null,
  issue_date date not null default current_date,
  due_date date,
  status text not null default 'issued'
    check (status in ('issued', 'partially_paid', 'paid', 'cancelled')),
  notes text,
  created_by uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, invoice_number),
  unique (id, school_id),
  foreign key (student_id, school_id)
    references public.students(id, school_id) on delete restrict,
  foreign key (term_id, school_id)
    references public.academic_terms(id, school_id) on delete restrict,
  foreign key (created_by, school_id)
    references public.profiles(id, school_id) on delete restrict
);

create index student_invoices_school_term_idx
  on public.student_invoices(school_id, term_id, created_at desc);
create index student_invoices_student_idx
  on public.student_invoices(school_id, student_id, created_at desc);

create table public.student_invoice_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  invoice_id uuid not null,
  fee_structure_id uuid,
  description text not null,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_amount numeric(12,2) not null check (unit_amount >= 0),
  line_total numeric(14,2) generated always as (round(quantity * unit_amount, 2)) stored,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (invoice_id, school_id)
    references public.student_invoices(id, school_id) on delete restrict,
  foreign key (fee_structure_id, school_id)
    references public.fee_structures(id, school_id) on delete restrict,
  check (length(btrim(description)) > 0)
);

create index student_invoice_items_invoice_idx
  on public.student_invoice_items(school_id, invoice_id);

create table public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  student_id uuid not null,
  receipt_number text not null,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null
    check (payment_method in ('cash', 'mobile_money', 'bank_transfer', 'cheque', 'card', 'other')),
  reference text,
  received_at timestamptz not null default timezone('utc', now()),
  received_by uuid not null,
  status text not null default 'posted' check (status in ('posted', 'reversed')),
  idempotency_key uuid not null,
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (school_id, receipt_number),
  unique (school_id, idempotency_key),
  unique (id, school_id),
  foreign key (student_id, school_id)
    references public.students(id, school_id) on delete restrict,
  foreign key (received_by, school_id)
    references public.profiles(id, school_id) on delete restrict,
  foreign key (reversed_by, school_id)
    references public.profiles(id, school_id) on delete restrict,
  check (
    (status = 'posted' and reversed_at is null and reversed_by is null and reversal_reason is null)
    or
    (status = 'reversed' and reversed_at is not null and reversed_by is not null
      and nullif(btrim(reversal_reason), '') is not null)
  )
);

create index fee_payments_school_received_idx
  on public.fee_payments(school_id, received_at desc);
create index fee_payments_student_idx
  on public.fee_payments(school_id, student_id, received_at desc);

create table public.fee_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  payment_id uuid not null,
  invoice_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique (payment_id, invoice_id),
  foreign key (payment_id, school_id)
    references public.fee_payments(id, school_id) on delete restrict,
  foreign key (invoice_id, school_id)
    references public.student_invoices(id, school_id) on delete restrict
);

create index fee_payment_allocations_invoice_idx
  on public.fee_payment_allocations(school_id, invoice_id);

-- Keep posted payment facts immutable. A permitted reversal changes only the
-- status/reversal audit fields; amount, method, receipt, student and reference stay fixed.
create or replace function public.guard_fee_payment_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Posted payments cannot be deleted; reverse the receipt instead'
      using errcode = '42501';
  end if;

  if new.id is distinct from old.id
     or new.school_id is distinct from old.school_id
     or new.student_id is distinct from old.student_id
     or new.receipt_number is distinct from old.receipt_number
     or new.amount is distinct from old.amount
     or new.payment_method is distinct from old.payment_method
     or new.reference is distinct from old.reference
     or new.received_at is distinct from old.received_at
     or new.received_by is distinct from old.received_by
     or new.idempotency_key is distinct from old.idempotency_key
     or new.created_at is distinct from old.created_at then
    raise exception 'Payment details are immutable'
      using errcode = '42501';
  end if;

  if old.status <> 'posted'
     or new.status <> 'reversed'
     or new.reversed_at is null
     or new.reversed_by is null
     or nullif(btrim(new.reversal_reason), '') is null then
    raise exception 'Payments may only be reversed once with a reason'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger fee_payments_immutable
  before update or delete on public.fee_payments
  for each row execute function public.guard_fee_payment_immutable();

-- Finance operators may manage fee setup and post receipts, but they are not
-- automatically school administrators and cannot manage unrelated school data.
create or replace function policies.can_manage_finance(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, policies
as $$
  select policies.is_service_role()
    or (
      auth.uid() is not null
      and policies.current_school_id() = target_school_id
      and policies.current_role() in ('admin', 'school_admin', 'bursar')
    );
$$;

create or replace function policies.can_view_student_finance(
  target_school_id uuid,
  target_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, policies
as $$
  select policies.can_manage_finance(target_school_id)
    or policies.is_current_student(target_student_id)
    or policies.is_parent_of_student(target_student_id);
$$;

revoke all on function public.guard_fee_payment_immutable() from public, anon, authenticated;
revoke all on function policies.can_manage_finance(uuid) from public, anon;
revoke all on function policies.can_view_student_finance(uuid, uuid) from public, anon;
grant execute on function policies.can_manage_finance(uuid) to authenticated, service_role;
grant execute on function policies.can_view_student_finance(uuid, uuid) to authenticated, service_role;

-- Bursars need the minimum school-scoped learner and enrollment data required
-- to issue and reconcile invoices; they do not gain school-admin write access.
drop policy if exists erp_students_read on public.students;
create policy erp_students_read on public.students
  for select to authenticated using (
    policies.can_manage_finance(school_id)
    or exists (
      select 1 from public.enrollments e
      where e.student_id = students.id
        and policies.is_teacher_for_class(e.class_id)
    )
    or policies.is_current_student(id)
    or policies.is_parent_of_student(id)
  );

drop policy if exists erp_enrollments_read on public.enrollments;
create policy erp_enrollments_read on public.enrollments
  for select to authenticated using (
    policies.can_manage_finance(school_id)
    or policies.is_teacher_for_class(class_id)
    or policies.is_current_student(student_id)
    or policies.is_parent_of_student(student_id)
  );

alter table public.fee_categories enable row level security;
alter table public.fee_structures enable row level security;
alter table public.student_invoices enable row level security;
alter table public.student_invoice_items enable row level security;
alter table public.fee_payments enable row level security;
alter table public.fee_payment_allocations enable row level security;

create policy fee_categories_manage on public.fee_categories
  for all to authenticated
  using (policies.can_manage_finance(school_id))
  with check (policies.can_manage_finance(school_id));

create policy fee_structures_manage on public.fee_structures
  for all to authenticated
  using (policies.can_manage_finance(school_id))
  with check (policies.can_manage_finance(school_id));

create policy student_invoices_read on public.student_invoices
  for select to authenticated
  using (policies.can_view_student_finance(school_id, student_id));

create policy student_invoice_items_read on public.student_invoice_items
  for select to authenticated
  using (
    exists (
      select 1 from public.student_invoices i
      where i.id = student_invoice_items.invoice_id
        and i.school_id = student_invoice_items.school_id
        and policies.can_view_student_finance(i.school_id, i.student_id)
    )
  );

create policy fee_payments_read on public.fee_payments
  for select to authenticated
  using (policies.can_view_student_finance(school_id, student_id));

create policy fee_payment_allocations_read on public.fee_payment_allocations
  for select to authenticated
  using (
    exists (
      select 1 from public.student_invoices i
      where i.id = fee_payment_allocations.invoice_id
        and i.school_id = fee_payment_allocations.school_id
        and policies.can_view_student_finance(i.school_id, i.student_id)
    )
  );

-- Expose only the intended operations to signed-in users. Invoice/payment
-- writes must go through the checked transactional RPC functions below.
revoke all on public.fee_categories, public.fee_structures,
  public.student_invoices, public.student_invoice_items,
  public.fee_payments, public.fee_payment_allocations
  from anon, authenticated;

grant select, insert, update, delete on public.fee_categories, public.fee_structures
  to authenticated;
grant select on public.student_invoices, public.student_invoice_items,
  public.fee_payments, public.fee_payment_allocations to authenticated;
grant all on public.fee_categories, public.fee_structures,
  public.student_invoices, public.student_invoice_items,
  public.fee_payments, public.fee_payment_allocations to service_role;

create or replace function public.create_student_invoice(
  target_student_id uuid,
  target_term_id uuid,
  target_due_date date,
  target_notes text,
  target_fee_structure_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, policies
as $$
declare
  v_school_id uuid;
  v_profile_id uuid;
  v_invoice_id uuid;
  v_invoice_number text;
  v_selected_count integer;
begin
  v_school_id := policies.current_school_id();
  if auth.uid() is null or v_school_id is null or not coalesce(policies.can_manage_finance(v_school_id), false) then
    raise exception 'Finance operator access is required'
      using errcode = '42501';
  end if;

  if target_student_id is null or target_term_id is null
     or target_fee_structure_ids is null
     or cardinality(target_fee_structure_ids) < 1 then
    raise exception 'Select a student, term and at least one fee item'
      using errcode = '22023';
  end if;

  select p.id into v_profile_id
  from public.profiles p
  where p.user_id = auth.uid()
    and p.school_id = v_school_id
    and p.is_active = true
  limit 1;

  if v_profile_id is null then
    raise exception 'An active school profile is required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.students s
    where s.id = target_student_id
      and s.school_id = v_school_id
      and s.is_active = true
  ) then
    raise exception 'Student does not belong to this school or is inactive'
      using errcode = '23503';
  end if;

  if not exists (
    select 1 from public.academic_terms t
    where t.id = target_term_id
      and t.school_id = v_school_id
  ) then
    raise exception 'Academic term does not belong to this school'
      using errcode = '23503';
  end if;

  select count(distinct selected.id)::integer
    into v_selected_count
  from unnest(target_fee_structure_ids) as selected(id);

  if v_selected_count <> cardinality(target_fee_structure_ids) then
    raise exception 'Duplicate fee items are not allowed'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(target_fee_structure_ids) as selected(id)
    left join public.fee_structures fs
      on fs.id = selected.id
     and fs.school_id = v_school_id
    where fs.id is null
       or fs.term_id <> target_term_id
       or fs.is_active is not true
       or not exists (
          select 1 from public.enrollments e
          where e.student_id = target_student_id
            and e.term_id = target_term_id
            and e.class_id = fs.class_id
            and e.school_id = v_school_id
            and e.status = 'active'
       )
  ) then
    raise exception 'Every fee item must be active, belong to this school and term, and match the student class'
      using errcode = '23514';
  end if;

  v_invoice_number := 'INV-' || to_char(current_date, 'YYYY') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into public.student_invoices (
    school_id, student_id, term_id, invoice_number,
    due_date, status, notes, created_by
  ) values (
    v_school_id, target_student_id, target_term_id, v_invoice_number,
    target_due_date, 'issued', nullif(btrim(target_notes), ''), v_profile_id
  )
  returning id into v_invoice_id;

  insert into public.student_invoice_items (
    school_id, invoice_id, fee_structure_id, description, quantity, unit_amount
  )
  select v_school_id, v_invoice_id, fs.id, fs.name, 1, fs.amount
  from public.fee_structures fs
  where fs.id = any(target_fee_structure_ids)
    and fs.school_id = v_school_id;

  return v_invoice_id;
end;
$$;

create or replace function public.record_fee_payment(
  target_invoice_id uuid,
  target_amount numeric,
  target_payment_method text,
  target_reference text,
  target_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, policies
as $$
declare
  v_school_id uuid;
  v_profile_id uuid;
  v_student_id uuid;
  v_invoice_status text;
  v_existing_payment public.fee_payments%rowtype;
  v_total numeric(14,2);
  v_paid numeric(14,2);
  v_balance numeric(14,2);
  v_payment_id uuid;
  v_receipt_number text;
begin
  v_school_id := policies.current_school_id();
  if auth.uid() is null or v_school_id is null or not coalesce(policies.can_manage_finance(v_school_id), false) then
    raise exception 'Finance operator access is required'
      using errcode = '42501';
  end if;

  if target_invoice_id is null or target_idempotency_key is null
     or target_amount is null or target_amount <= 0 then
    raise exception 'Invoice, positive payment amount and idempotency key are required'
      using errcode = '22023';
  end if;

  select p.id into v_profile_id
  from public.profiles p
  where p.user_id = auth.uid()
    and p.school_id = v_school_id
    and p.is_active = true
  limit 1;

  if v_profile_id is null then
    raise exception 'An active school profile is required'
      using errcode = '42501';
  end if;

  select i.student_id, i.status
    into v_student_id, v_invoice_status
  from public.student_invoices i
  where i.id = target_invoice_id
    and i.school_id = v_school_id
  for update;

  if v_student_id is null then
    raise exception 'Invoice not found for this school'
      using errcode = 'P0002';
  end if;

  select * into v_existing_payment
  from public.fee_payments p
  where p.school_id = v_school_id
    and p.idempotency_key = target_idempotency_key;

  if v_existing_payment.id is not null then
    if v_existing_payment.student_id is distinct from v_student_id
       or v_existing_payment.amount is distinct from target_amount
       or v_existing_payment.payment_method is distinct from target_payment_method
       or v_existing_payment.reference is distinct from nullif(btrim(target_reference), '')
       or not exists (
         select 1 from public.fee_payment_allocations a
         where a.payment_id = v_existing_payment.id
           and a.invoice_id = target_invoice_id
           and a.amount = target_amount
           and a.school_id = v_school_id
       ) then
      raise exception 'This idempotency key was already used for a different payment request'
        using errcode = '23505';
    end if;
    return v_existing_payment.id;
  end if;

  if v_invoice_status = 'cancelled' then
    raise exception 'Cancelled invoices cannot receive payments'
      using errcode = '23514';
  end if;

  select coalesce(sum(ii.line_total), 0)::numeric(14,2)
    into v_total
  from public.student_invoice_items ii
  where ii.invoice_id = target_invoice_id
    and ii.school_id = v_school_id;

  select coalesce(sum(a.amount), 0)::numeric(14,2)
    into v_paid
  from public.fee_payment_allocations a
  join public.fee_payments p
    on p.id = a.payment_id
   and p.school_id = a.school_id
  where a.invoice_id = target_invoice_id
    and a.school_id = v_school_id
    and p.status = 'posted';

  v_balance := v_total - v_paid;
  if v_balance <= 0 then
    raise exception 'Invoice is already fully paid'
      using errcode = '23514';
  end if;

  if target_amount > v_balance then
    raise exception 'Payment amount exceeds the outstanding invoice balance'
      using errcode = '22023';
  end if;

  v_receipt_number := 'RCT-' || to_char(current_date, 'YYYYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into public.fee_payments (
    school_id, student_id, receipt_number, amount, payment_method,
    reference, received_by, idempotency_key
  ) values (
    v_school_id, v_student_id, v_receipt_number, target_amount,
    target_payment_method, nullif(btrim(target_reference), ''),
    v_profile_id, target_idempotency_key
  )
  returning id into v_payment_id;

  insert into public.fee_payment_allocations (
    school_id, payment_id, invoice_id, amount
  ) values (
    v_school_id, v_payment_id, target_invoice_id, target_amount
  );

  update public.student_invoices
  set status = case
    when target_amount = v_balance then 'paid'
    else 'partially_paid'
  end,
  updated_at = timezone('utc', now())
  where id = target_invoice_id
    and school_id = v_school_id;

  return v_payment_id;
end;
$$;

create or replace function public.reverse_fee_payment(
  target_payment_id uuid,
  target_reversal_reason text
)
returns void
language plpgsql
security definer
set search_path = public, auth, policies
as $$
declare
  v_school_id uuid;
  v_profile_id uuid;
  v_payment public.fee_payments%rowtype;
  v_invoice_id uuid;
  v_total numeric(14,2);
  v_paid numeric(14,2);
begin
  v_school_id := policies.current_school_id();
  if auth.uid() is null or v_school_id is null or not coalesce(policies.can_manage_finance(v_school_id), false) then
    raise exception 'Finance operator access is required'
      using errcode = '42501';
  end if;

  if nullif(btrim(target_reversal_reason), '') is null then
    raise exception 'A reversal reason is required'
      using errcode = '22023';
  end if;

  select p.id into v_profile_id
  from public.profiles p
  where p.user_id = auth.uid()
    and p.school_id = v_school_id
    and p.is_active = true
  limit 1;

  select * into v_payment
  from public.fee_payments p
  where p.id = target_payment_id
    and p.school_id = v_school_id
  for update;

  if v_payment.id is null then
    raise exception 'Payment not found for this school'
      using errcode = 'P0002';
  end if;

  if v_payment.status <> 'posted' then
    raise exception 'Payment has already been reversed'
      using errcode = '23514';
  end if;

  update public.fee_payments
  set status = 'reversed',
      reversed_at = timezone('utc', now()),
      reversed_by = v_profile_id,
      reversal_reason = btrim(target_reversal_reason)
  where id = target_payment_id
    and school_id = v_school_id;

  for v_invoice_id in
    select a.invoice_id
    from public.fee_payment_allocations a
    where a.payment_id = target_payment_id
      and a.school_id = v_school_id
  loop
    -- Use the same invoice lock as payment posting so two concurrent
    -- receipt/reversal operations cannot calculate a stale balance.
    perform 1
    from public.student_invoices i
    where i.id = v_invoice_id
      and i.school_id = v_school_id
    for update;

    select coalesce(sum(ii.line_total), 0)::numeric(14,2)
      into v_total
    from public.student_invoice_items ii
    where ii.invoice_id = v_invoice_id
      and ii.school_id = v_school_id;

    select coalesce(sum(a.amount), 0)::numeric(14,2)
      into v_paid
    from public.fee_payment_allocations a
    join public.fee_payments p
      on p.id = a.payment_id and p.school_id = a.school_id
    where a.invoice_id = v_invoice_id
      and a.school_id = v_school_id
      and p.status = 'posted';

    update public.student_invoices
    set status = case
      when v_paid >= v_total then 'paid'
      when v_paid > 0 then 'partially_paid'
      else 'issued'
    end,
    updated_at = timezone('utc', now())
    where id = v_invoice_id
      and school_id = v_school_id;
  end loop;
end;
$$;

revoke all on function public.create_student_invoice(uuid, uuid, date, text, uuid[]) from public, anon;
revoke all on function public.record_fee_payment(uuid, numeric, text, text, uuid) from public, anon;
revoke all on function public.reverse_fee_payment(uuid, text) from public, anon;
grant execute on function public.create_student_invoice(uuid, uuid, date, text, uuid[]) to authenticated, service_role;
grant execute on function public.record_fee_payment(uuid, numeric, text, text, uuid) to authenticated, service_role;
grant execute on function public.reverse_fee_payment(uuid, text) to authenticated, service_role;

create or replace view public.student_invoice_balances
with (security_invoker = true)
as
select
  i.id,
  i.school_id,
  i.student_id,
  i.term_id,
  i.invoice_number,
  i.issue_date,
  i.due_date,
  i.status,
  i.notes,
  i.created_at,
  s.first_name,
  s.last_name,
  s.registration_number,
  t.name as term_name,
  coalesce((
    select sum(ii.line_total)
    from public.student_invoice_items ii
    where ii.invoice_id = i.id and ii.school_id = i.school_id
  ), 0)::numeric(14,2) as total_amount,
  coalesce((
    select sum(a.amount)
    from public.fee_payment_allocations a
    join public.fee_payments p
      on p.id = a.payment_id and p.school_id = a.school_id
    where a.invoice_id = i.id and a.school_id = i.school_id
      and p.status = 'posted'
  ), 0)::numeric(14,2) as paid_amount,
  greatest(
    coalesce((
      select sum(ii.line_total)
      from public.student_invoice_items ii
      where ii.invoice_id = i.id and ii.school_id = i.school_id
    ), 0)
    - coalesce((
      select sum(a.amount)
      from public.fee_payment_allocations a
      join public.fee_payments p
        on p.id = a.payment_id and p.school_id = a.school_id
      where a.invoice_id = i.id and a.school_id = i.school_id
        and p.status = 'posted'
    ), 0),
    0
  )::numeric(14,2) as balance
from public.student_invoices i
join public.students s
  on s.id = i.student_id and s.school_id = i.school_id
join public.academic_terms t
  on t.id = i.term_id and t.school_id = i.school_id;

grant select on public.student_invoice_balances to authenticated, service_role;

-- Apply the shared updated-at trigger to the editable finance setup and invoice tables.
create trigger set_fee_categories_updated_at
  before update on public.fee_categories
  for each row execute function public.set_updated_at();

create trigger set_fee_structures_updated_at
  before update on public.fee_structures
  for each row execute function public.set_updated_at();

commit;

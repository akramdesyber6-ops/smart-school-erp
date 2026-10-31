# Finance and Fees Module

This first implementation adds the fee ledger to the multi-tenant Smart School ERP. It is intended for review on `feat/erp-fees-and-payments`; it has not been applied to a live Supabase project.

## Scope

- Fee categories, e.g. Tuition, Boarding, Meals, Transport and Development.
- Fee structures by school, academic year, term, class/stream and category.
- Student invoices with one or more fee line items.
- Partial and full payments against an invoice.
- Unique receipt numbers and a printable receipt view.
- Outstanding, paid and overdue balance summaries in UGX.
- Reversal of a posted payment with a mandatory reason and actor/time audit fields.
- Bursar role and finance route.
- Read-only invoice balances for a signed-in student and their linked parent(s).

The first version deliberately does not integrate a mobile-money, bank or card provider. A manual payment entry records a payment acknowledged by the finance operator; it is not evidence that an external payment provider settled funds.

## Database objects

Migration: `supabase/migrations/20261031000100_fees_and_payments.sql`

Tables:

- `fee_categories`
- `fee_structures`
- `student_invoices`
- `student_invoice_items`
- `fee_payments`
- `fee_payment_allocations`

Read model:

- `student_invoice_balances` is a `security_invoker` view. The querying user's permissions and row-level policies on the source tables apply.

The migration adds `bursar` to the profile role constraint. It does not create platform-wide `super_admin`; the existing `admin` / `school_admin` meanings remain school-level roles.

## Transactional operations

### Issue an invoice

Call `public.create_student_invoice(target_student_id, target_term_id, target_due_date, target_notes, target_fee_structure_ids)`.

The database derives the school and active profile from the authenticated session. It verifies that the caller is a finance operator, the student and term belong to the same school, and each selected fee structure matches an active enrollment for the student's class and term. Invoice and line items are created in one transaction.

### Record a payment

Call `public.record_fee_payment(target_invoice_id, target_amount, target_payment_method, target_reference, target_idempotency_key)`.

The RPC locks the invoice row, calculates the current balance, rejects overpayment/cancelled invoices, creates the receipt and allocation atomically, and updates the invoice status. A school-scoped idempotency key is required. Reuse of a key for a different request is rejected.

The finance page keeps the same key after an uncertain network response so that an operator can retry without intentionally creating a second receipt.

### Reverse a payment

Call `public.reverse_fee_payment(target_payment_id, target_reversal_reason)`.

A posted payment cannot be deleted or have its amount/method/receipt identity edited. Reversal requires a reason, records the active finance operator and timestamp, retains the original payment/allocation rows, and recalculates invoice balances using only non-reversed payments.

## Authorization

- School admins and bursars can manage fee setup and use the invoice/payment/reversal RPCs within their own active school.
- Bursars receive the minimum same-school student and enrollment read access needed to prepare invoices. They are not granted school-admin writes to unrelated records.
- Students can read invoices for their verified student profile only.
- Parents can read invoices for students linked to their verified parent profile only.
- Direct authenticated writes to invoice headers, invoice items, payments and allocations are not granted; write operations go through the checked RPCs.
- The balance view uses `security_invoker = true` so it does not bypass underlying RLS.

## Frontend routes

- `/dashboards/finance`: fee setup, invoice issue, payment entry, summaries, receipts and invoice balances.
- `/dashboards/finance/receipts/[paymentId]`: school-scoped printable receipt.
- Student portal: read-only fee balance table.
- Parent portal: read-only fee balances grouped under each linked child.
- School admin dashboard: link to finance workspace.

## Tests

- `src/lib/finance/financeUtils.test.ts`: UGX formatting, due-date logic and aggregate summary calculations.
- `src/lib/routes/routing_security.test.ts`: bursar dashboard redirect and route-boundary tests.
- `supabase/tests/finance_module.test.sql`: pgTAP coverage for finance RLS objects, Bursar school scope, invoice creation, partial payment, reversal, cross-school rejection and intended grants.

The automated Supabase workflow applies migrations and seeds a disposable local database, lints the schema, then runs pgTAP. A passing workflow verifies the local migration/test environment, not an already-deployed database.

## Apply safely

1. Review the migration and confirm the target Supabase project.
2. Apply to a disposable/staging project first.
3. Verify the migration status and run the database advisors.
4. Test with at least two schools and separate admin, bursar, student and parent accounts.
5. Confirm that a bursar cannot issue an invoice for another school's learner, student/parent finance reads are limited to linked records, duplicate idempotency requests do not create duplicate receipts, and a reversal restores the correct invoice balance.
6. Only after these checks pass should the migration be scheduled for production deployment.

Do not run `supabase db reset` against production data. Keep the service-role key server-side and never expose it in a `NEXT_PUBLIC_*` variable.

## Remaining finance work

The first version does not yet implement discounts/waivers, bulk allocation across multiple invoices, invoice edits/cancellation, credit balances, statement/export packs, aged-arrears reports, reconciliation tools or external payment-provider webhooks. Those should be separate reviewable changes with their own audit/security tests.

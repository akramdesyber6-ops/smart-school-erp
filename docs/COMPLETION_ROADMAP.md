# Smart School ERP — Completion Roadmap

This roadmap extends the existing multi-tenant Next.js and Supabase application. It is deliberately based on the current implementation branch rather than treating older README claims as completed functionality.

## Current implementation baseline

The working baseline already contains:

- Supabase authentication and role-aware route protection.
- School administration, student onboarding, class/stream setup, and academic terms.
- Teacher CBC/NCDC markbook tools and a lesson-plan template.
- Student and parent portals that depend on administrator-linked school records.
- School-admin and assignment-scoped teacher attendance registers.
- Parent/student portal invitation and profile-linking workflows.
- Initial tenant schema, RLS policies, profile guards, assignment integrity checks, and attendance/markbook audit attribution.
- A first tenant-scoped finance ledger with fee categories/structures, student invoices, partial/full payments, unique receipt numbers, audited reversals, UGX balances and printable receipts.
- A separate bursar role and finance route with school-scoped access; student and linked-parent portals can read their own invoice balances.
- A first gate-card event layer: school-scoped reader credentials, student card registry, signed device ingestion, immutable entry/exit events, duplicate protection, revocation controls and a school-admin management workspace.

The current role model is `admin`, `school_admin`, `bursar`, `teacher`, `student`, and `parent`. A distinct platform super-admin is not yet implemented. Gate hardware firmware, notifications, automatic campus-presence reconciliation, school timetables and the complete term report-card workflow are still outstanding.

## Visual system

Keep the existing visual language consistent across all new routes:

- **Primary surfaces:** navy and slate, using the current `slate-900`, `slate-800`, and light slate backgrounds.
- **Primary actions:** indigo.
- **Secondary emphasis:** purple.
- **Success and completed states:** emerald/green.
- **Cards and workspaces:** white/light surfaces, slate borders, restrained shadows, rounded corners, responsive layouts.
- **Accessibility:** visible keyboard focus, readable contrast, labelled controls, and responsive tables/forms.

Global theme variables and reusable base component classes live in `src/app/globals.css`; the root layout must import that stylesheet.

## Delivery phases

### 1. Finish and verify the existing foundation

- Confirm the landing page, sign-in, school-admin, teacher, student, and parent routes render with the restored global stylesheet.
- Resolve the outstanding Vercel deployment failure and inspect its actual build log before treating deployment as healthy.
- Verify the open parent/student/attendance branch against a disposable Supabase project.
- Test the same-school and cross-school access paths with at least two test schools.
- Keep the existing draft pull request separate until its database and deployment verification is complete.

**Acceptance:** TypeScript, route tests, lint, production build and deployment pass; role boundaries and RLS behavior pass integration tests.

### 2. Fees and finance

**Status:** First implementation delivered on `feat/erp-fees-and-payments`; database integration checks are pending.

Implemented in this branch:

- Tenant-scoped fee categories and class/term/year fee structures.
- Invoices with multiple fee line items, generated invoice references and server-side validation that each selected item matches the student's active class and term.
- Partial and full payments with a unique receipt number, method, optional transaction reference and school-scoped idempotency key.
- Immutable posted payment facts; correction is an audited reversal, not a delete or silent amount edit.
- Invoice totals, paid amounts, outstanding balances and overdue summaries in UGX.
- Printable, school-scoped receipt page.
- Bursar finance route and permissions, with school-admin oversight and read-only student/parent balance views.

Still required before calling finance complete:

- Discounts, approved waivers and configurable fee exemptions.
- Multi-invoice payment allocation and credit balances.
- Invoice cancellation/editing workflows with audit history and approval controls.
- Finance exports, class arrears reports, aging reports and reconciliations.
- Real payment-provider callbacks (mobile money/bank) with signature validation and idempotent webhook processing. The current screen records cash/manual payment entries; it does not claim to collect money from a provider.

**Security and accounting requirements:** preserve an immutable payment/audit trail; never store card secrets; prevent a payment or allocation from being attached to another school's student/invoice; make payment posting idempotent; record reversals instead of silently deleting posted payments. Do not treat a browser-submitted amount or school ID as trusted.

### 3. Timetables and academic planning

Add:

- Timetable periods, days, class schedules, subjects, assigned teachers and rooms.
- Validation for teacher, class and room double-booking.
- Term-aware timetable publishing and revision history.
- Teacher and class views, plus printable weekly timetables.

**Acceptance:** a schedule cannot be published with a conflicting teacher, class or room slot; every row is tenant-scoped.

### 4. Gate attendance and learner movement

**Status:** First gate-card backend and school-admin setup workspace delivered on `feat/gate-card-attendance`. Database integration verification is pending; no live database was changed.

Implemented in this first slice:
- School-scoped gate readers provisioned by a school-admin RPC. A random bearer token is shown once; only its SHA-256 hash is stored.
- Student card registry with same-school validation and audited card revocation.
- Server-side `POST /api/gate/events` ingestion. A reader supplies a card UID, not a student ID; the server resolves the active student inside the reader's school.
- Immutable entry/exit events, reader and server timestamps, unique per-device event IDs, retry deduplication and conflicting replay detection.
- School-admin workspace to create/revoke readers, assign/deactivate cards and review today's events.

Still required before calling gate attendance complete:
- Firmware and field verification for the actual RFID readers and card format in use.
- Device health/heartbeat, offline queue telemetry and alerting.
- Campus-presence reconciliation, duplicate entry/exit warnings, missing-departure and early-departure reports.
- A permissioned correction workflow that preserves the original scan event.
- Gate event history in student/parent portals and opt-in arrival/departure notifications through the notification outbox.

**Security requirements:** gate devices authenticate to a server-side endpoint; arbitrary student IDs are never accepted from a public client; device-to-school assignment is validated; secrets are hashed and server-only; one unique device event ID is enforced by the database; raw events remain separate from editable class attendance.

### 5. Notifications and communication

Create a notification outbox and provider adapters for SMS and WhatsApp:

- Templates for arrival, departure, absence, fee reminders, receipts and school announcements.
- Guardian opt-in/contact validation and per-school notification preferences.
- Queue/retry state, delivery receipts, provider message IDs and failure reasons.
- Idempotency keys so repeated device/webhook requests do not send duplicate messages.
- Admin message history and delivery status.

Provider credentials must remain server-side. The application should record a message as queued/sent/failed only when the corresponding action has actually occurred; a database record alone is not proof of provider delivery.

### 6. Reports, assessments and report cards

Complete the school reporting workflow for both curricula:

- CBC competency descriptors, observations and achievement summaries.
- NCDC marks and configurable grading rules appropriate to the assessment/year.
- Weekly-test and term assessment analysis by student, class and subject.
- Transparent trends and risk indicators based on actual recorded assessments; never present an unsupported score prediction as fact.
- Term report-card generation, school branding, comments, sign-off, verification and print/PDF output.
- Filters by academic year, term, class and stream, including class-specific print batches.

**Acceptance:** report totals reconcile to saved marks and configured grading rules; blank scores remain distinct from zero; all reports filter by the active school.

### 7. Platform super-admin and tenant operations

Implement a platform role separately from school-level administrators:

- Provision and suspend school tenants, manage school codes and platform settings.
- View platform-wide health and subscription/plan status without exposing school records by default.
- Audited, explicit support access where required; no implicit cross-tenant browsing.
- Keep each school’s normal sessions, data, settings, reports and branding isolated.

A platform super-admin must not be added as a string to the frontend role type alone. The database role constraints, route authorization, server APIs, and RLS access model must all be updated and tested together.

## Required verification before production

- Use a disposable Supabase project for schema migration and RLS integration tests; do not experiment with destructive commands on production.
- Create at least two schools and verify allowed and denied operations for school admin, bursar, teacher (assigned and unassigned), student, parent, gate device and platform super-admin.
- Test duplicate gate events, repeated payment callbacks, notification retries, tenant boundary IDs, and audit history.
- Verify print/PDF output, mobile layouts, role redirects, empty states, loading states and failure states.
- Confirm server-only secrets and provider credentials are set in the deployment environment, never in `NEXT_PUBLIC_*` variables.
- Review the final GitHub Actions and Vercel logs, then merge only after the required checks pass.

## Implementation order

Complete the existing foundation first, then deliver the finance ledger and roles, gate event ingestion, notification outbox, timetable, and full reporting in separately reviewable changes. Each module should include its migration, RLS policies, server-side validation, user interface, tests and documentation before it is called complete.

# Smart School ERP

A Next.js 14 App Router application for school administration and academic workflows. The repository is in active development; passing frontend checks does **not** mean the database migrations have been applied or tenant isolation has been verified against a live Supabase project.

## What is implemented in this branch

- **Public entry and authentication:** landing page and Supabase sign-in.
- **School administration:** school dashboard, live student/teacher counts, class/stream creation, student onboarding with its first enrollment in one database transaction.
- **Portal onboarding:** invite an existing email address to a student or parent portal through a server-side API; link its profile to the matching student or parent record; create parent contacts and student-parent relationships.
- **Teacher tools:** assignment-scoped CBC/NCDC markbook, lesson-plan template generation, and an attendance register for assigned classes.
- **Student portal:** the signed-in student's own linked enrollments, marks, and attendance.
- **Parent portal:** data for linked children only, including read-only invoice balances.
- **Finance and fees:** fee categories and class/term fee structures, transactional student invoices, partial/full payments, unique receipts, audited reversals, UGX balance summaries, and printable receipts.
- **Bursar role:** finance-only route access; bursars can manage fees and read the minimum school-scoped learner/enrollment data required for billing, without school-admin write permissions.
- **Student/parent finance views:** signed-in students and linked parents can read only their own invoice balances and payment totals.
- **Gate-card attendance:** school admins can provision reader devices, assign/revoke student RFID cards, and review today's arrival/departure scans. Devices authenticate to a server-side endpoint; raw gate events are append-only and separately stored from class attendance.
- **Security work:** role-based route checks, tenant/assignment RLS policies, profile identity guards, markbook/attendance actor attribution, class/subject integrity checks, and security headers.
- **Automated frontend checks:** TypeScript, a small route-role test suite, ESLint, and Next.js production build via GitHub Actions.

The student and parent portals require their profile to be linked to a corresponding school record. Existing records are not automatically linked.

## Not implemented yet

The current branch includes a first finance ledger and a first gate-card event/reader-management slice, but still lacks a distinct platform super-admin, discounts/waivers, multi-invoice payment allocation, invoice cancellation and editing workflows, a full finance reporting/export suite, field-tested reader firmware, campus-presence reconciliation, SMS/WhatsApp notification delivery, timetables, and the complete report-card workflow. The current database changes must be applied and integration-tested in a disposable environment before production use.

## Roles and routes

The current role model is `admin`, `school_admin`, `bursar`, `teacher`, `student`, and `parent`. There is no separate platform `super_admin` role in this branch.

| Route | Purpose |
| --- | --- |
| `/` | Public landing page |
| `/login` | Sign in |
| `/dashboards/school-admin` | School administration |
| `/dashboards/school-admin/accounts` | Invite portal users, link profiles, manage parent contacts/relationships |
| `/dashboards/school-admin/attendance` | School attendance register |
| `/dashboards/school-admin/gate` | Gate readers, student card registry and daily entry/exit events |
| `/dashboards/finance` | Finance workspace for admin, school admin and bursar |
| `/dashboards/finance/receipts/[paymentId]` | School-scoped printable payment receipt |
| `/dashboards/teacher` | Markbook and lesson-plan tools |
| `/dashboards/teacher/attendance` | Teacher attendance register |
| `/dashboards/student` | Linked student's records |
| `/dashboards/parent` | Linked children's records |

## Technology

- Next.js 14 App Router, React 18, TypeScript
- Tailwind CSS and Lucide React
- Supabase Auth, PostgreSQL, and row-level security
- Zustand, Zod, React Hook Form

## Local setup

Use Node.js 20 or later and pnpm. There is currently no committed package-manager lockfile, so dependency versions are not fully reproducible yet.

1. Install dependencies:

   ```sh
   pnpm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the values:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_publishable_anon_key
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   SUPABASE_SERVICE_ROLE_KEY=your_server_only_service_role_key
   ```

   The service-role key is privileged: keep it server-only, never name it `NEXT_PUBLIC_*`, and never commit it. It is used only by server-side account-invitation and authenticated gate-event ingestion code. Invitation delivery also requires a configured Supabase Auth email provider and a valid production `NEXT_PUBLIC_APP_URL` using HTTPS.

3. Apply migrations to a development or staging Supabase project. A committed `supabase/config.toml` configures the local CLI and seed file. Review the SQL and select the correct project before applying any change:

   ```sh
   pnpm exec supabase login
   pnpm exec supabase link --project-ref YOUR_PROJECT_REF
   pnpm exec supabase db push --dry-run
   pnpm db:setup
   ```

   `pnpm db:setup` runs `supabase db push`. The dry run is a preview, not a security test. If your remote database already contains tables created outside these migrations, reconcile its migration history first; do not push blindly or try to baseline a production database by trial and error. Do not use a production project for experimental policy or migration testing. The student/parent links, invite RPCs, markbook constraints, assignment checks, class attendance policies, student-onboarding RPC, finance ledger/RPCs, and gate device/card/event schema are unavailable until their migrations have been applied.

4. Start the development server:

   ```sh
   pnpm dev
   ```

## Commands and CI checks

```sh
pnpm type-check
pnpm test
pnpm lint
pnpm build
```

GitHub Actions runs TypeScript, route/finance utility tests, ESLint and a production build, plus a disposable Supabase migration/lint/pgTAP job. SQL tests exercise finance tenant scoping/payments and gate reader/card provisioning, event isolation and duplicate protection. These checks do not replace live-provider and deployed-environment verification.

## Required verification before production

Apply migrations to a **disposable** Supabase environment and test at least two schools with separate administrators, assigned/unassigned teachers, students, and parents. Verify both allowed and denied reads/writes, including cross-school IDs, teacher class/subject assignments, attendance upserts, parent-child links, profile role/tenant changes, student onboarding, finance invoice creation, payment idempotency, reversals, student/parent financial views, gate-device credential secrecy, card-to-school mapping and idempotent gate-event ingestion. Confirm PostgREST relationship names in that database. Never run reset/destructive test commands against production data.

Also verify portal email delivery and Vercel's deployment/build logs. The current GitHub Actions build passes, but it does not prove Vercel environment variables are configured or that Supabase policies work in the deployed project. See [docs/IMPLEMENTATION_AUDIT.md](./docs/IMPLEMENTATION_AUDIT.md) for the current source audit and outstanding items.

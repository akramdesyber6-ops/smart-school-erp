# Frontend and Supabase Security Audit

Audit scope: static inspection of the GitHub repository as found on `main` at
`1c0a66dabb0e26332f8ffeff03aa02036c5ce32f`. This document records repository evidence; it is not a live database
security test or a claim of production readiness.

## Routes and role model present in the repository

The checked-in App Router has these page routes:

- `/`: public marketing/entry page.
- `/login`: Supabase password login and profile lookup.
- `/dashboards/school-admin`: school administration dashboard with student onboarding, classes/streams, and school metrics.
- `/dashboards/school-admin/accounts`: school-admin workflow to invite student/parent users, link existing profiles to records, and manage parent-to-student relationships.
- `/dashboards/school-admin/attendance`: school-admin attendance register.
- `/dashboards/teacher`: assignment-scoped markbook, lesson-plan template, and attendance navigation.
- `/dashboards/teacher/attendance`: teacher attendance register restricted to assigned classes.
- `/dashboards/student`: authenticated student view of that student's enrollments, assessment entries, and attendance.
- `/dashboards/parent`: authenticated parent view of linked students' enrollments, assessment entries, and attendance.
- `/api/admin/portal-accounts`: server-side invitation endpoint for school-admin-created student/parent Auth accounts, requiring server-only Supabase credentials.

The profile schema and route helper define `admin`, `school_admin`, `teacher`,
`student`, and `parent`. The current role model does not define `bursar` or a
separate `super_admin` value. The README's broader role/module description exceeds
the routes and tables found in the current tree.

The schema contains 13 core tables for schools, profiles, academic years/terms,
classes, subjects, students, parents, class-subject assignments, student-parent
links, enrollments, marks, and attendance. There are still no fee/payment tables,
dedicated report-card workflow, or bursar dashboard, and the role model has no
separate `super_admin` or `bursar` role.

## Fixes in this branch

- Removed the developer sandbox UI that referenced undeclared test-account/state
  symbols and advertised a public test-credential panel; the referenced account data
  was not defined in the committed source.
- Removed the nonfunctional footer links and changed the landing-page CTA to an
  existing section. The dashboard mock is labelled as an illustration rather than
  a live school record.
- Fixed the enrollment roster helper: class IDs now filter by `class_id`; stream
  names filter through the related `classes.stream` relation. The previous path
  issued an invalid null filter and then attempted an empty ID list.
- Fixed teacher mark writes so trusted assignment/tenant identifiers cannot be
  overwritten by spreading client state after them; repaired duplicate class-only
  selector values and CBC/NCDC empty-score handling.
- Removed the login fallback to nonexistent `/dashboard`. Roles without an
  implemented dashboard now receive an explicit message and are signed out rather
  than left in a broken authenticated state.
- Added a versioned migration to prevent ordinary same-school users from reading
  all parent contact rows and student-parent relationship links.
- Added the `teacher_id` and `marked_at` markbook columns expected by the teacher
  dashboard, with a database trigger that derives audit attribution from the active
  authenticated profile instead of trusting client payloads.
- Added a database trigger that rejects direct client inserts of profile rows and
  blocks client changes to `user_id`, `school_id`, `role`, and `is_active`;
  trusted provisioning/administrative workflows must use server-side service-role
  access.
- Added a student/parent identity-link migration and role-scoped read policies;
  student and parent dashboards read actual linked records only.
- Added a school-admin workflow to link existing student/parent profiles and to
  create a parent contact plus its student relationship atomically through a
  school-admin-checked database function.
- Corrected NCDC total calculation: score inputs are already contribution points
  with maxima 10/20/70, so the final score is their sum rather than applying those
  weights a second time. Blank components remain null, and a legitimate zero total
  is preserved. Corrected example seed totals and added `NOT VALID` database checks
  for the three component ranges; legacy rows must be audited before validating the
  constraints against the whole table.

## Static security findings and remaining gaps

- Middleware calls Supabase `auth.getUser()`, then reads an active profile and
  applies the central route-role rules. The service-role client imports
  `server-only` and reads `SUPABASE_SERVICE_ROLE_KEY`, not a `NEXT_PUBLIC_*`
  key. These are positive code-level findings, not a test of deployed runtime
  configuration.
- The initial tenant migration creates 13 core tables; the RLS migration enables
  RLS and defines policies for those tables. The teacher-assignment migration
  tightens reads for students, enrollments, attendance, and markbook rows and
  scopes teacher mark writes to assigned class/subject pairs.
- A new policy migration permits teachers to insert/update attendance only for
  same-school assigned classes and enrolled students, while a database trigger
  derives `marked_by` from the authenticated active profile. These changes require
  SQL execution and cross-school tests before being treated as verified.
- The student/parent pages, invitation endpoint, account-linking page, and
  attendance workspace have only had source/CI checks; no interactive browser or
  live database test has been performed here. Verify the migrations on a disposable
  database, confirm PostgREST join names, and test same-school and cross-school
  accounts.
- A new migration adds optional `profile_id` foreign keys on student and parent
  records, validates that links point to active profiles of the matching role in
  the same school, and adds self/parent read rules for linked enrollments, marks,
  attendance, and relationship rows. Existing records remain unlinked until an
  administrator links them. Student and parent dashboards show an explicit setup
  state instead of fabricated records when there is no verified link.
- The school-admin account page can associate existing student/parent profiles,
  invite new student/parent accounts through a server-side route, and create parent
  contacts linked to a student. Auth invitations use `createAdminClient()`, which
  is marked `server-only` and reads `SUPABASE_SERVICE_ROLE_KEY`; the route validates
  the actor's active school-admin profile before doing privileged work. Configure
  the service-role key, application URL, and Supabase Auth email provider privately
  in the deployment. A school must apply the migrations before portal links and RPC
  functions are available.
- Profile provisioning and changes to profile identity/tenant/role/activation
  fields must be performed through trusted server workflows. Any existing
  application workflow that writes these fields directly from an authenticated
  client will now be rejected and must be moved server-side.
- The markbook audit trigger, protected-profile trigger, student/parent identity
  links, class/subject assignment checks, attendance-write policies, actor attribution,
  and atomic student onboarding have only been statically reviewed. Test them for
  authenticated users, school admins, assigned/unassigned teachers, and the service
  role in a disposable Supabase instance before deployment. The audit/identity
  triggers explicitly allow trusted `postgres`/`supabase_admin` database roles
  for migration/seed workflows.
- Added a Node test-runner script for route-role boundaries, public-route
  matching, and role redirect mapping; CI runs it alongside type checking, ESLint,
  and production build. These tests exercise route helpers, not database RLS.
- The repository does not currently commit a package-manager lockfile. CI installs
  dependencies with pnpm without frozen-lockfile enforcement, so dependency
  reproducibility should be improved by committing the intended lockfile.
- Static review and CI do not verify deployed PostgreSQL grants/policies, storage
  permissions, environment secrets, invitation email delivery, or cross-tenant
  behavior against a live Supabase project.

## Checks still required in a development environment

The branch now includes a GitHub Actions workflow that runs these checks. Review its
latest result before merging. Locally, run these package scripts after installing
dependencies with pnpm:

```sh
pnpm type-check
pnpm test
pnpm lint
pnpm build
```

CI runs type checking, the route-role tests, ESLint, and production build. Apply
migrations to a disposable local Supabase instance and use two test schools with
distinct teacher/admin, assigned/unassigned teacher, student, and parent accounts
to verify that users cannot read or mutate another school's rows. Also verify that non-admin users receive no rows from
`parents` and `student_parents`, while same-school admins can manage them. Do not
run reset/destructive test commands against production.

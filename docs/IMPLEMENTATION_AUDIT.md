# Frontend and Supabase Security Audit

Audit scope: static inspection of the GitHub repository as found on `main` at
`1c0a66dabb0e26332f8ffeff03aa02036c5ce32f`. This document records repository evidence; it is not a live database
security test or a claim of production readiness.

## Routes and role model present in the repository

The checked-in App Router has these page routes:

- `/`: public marketing/entry page.
- `/login`: Supabase password login and profile lookup.
- `/dashboards/school-admin`: school administration dashboard with some student onboarding and school metrics.
- `/dashboards/teacher`: assignment-scoped markbook and lesson-plan template.

The profile schema and route helper define `admin`, `school_admin`, `teacher`,
`student`, and `parent`. The current role model does not define `bursar` or a
separate `super_admin` value. The README's broader role/module description exceeds
the routes and tables found in the current tree.

The schema contains 13 core tables for schools, profiles, academic years/terms,
classes, subjects, students, parents, class-subject assignments, student-parent
links, enrollments, marks, and attendance. There are no fee/payment tables or
dedicated attendance, report-card, bursar, student, or parent dashboard pages in
the checked-in App Router.

## Fixes in this branch

- Removed the developer sandbox UI that referenced undeclared test-account/state
  symbols and would put account credentials into the public client bundle.
- Removed the nonfunctional footer links and changed the landing-page CTA to an
  existing section. The dashboard mock is labelled as an illustration rather than
  a live school record.
- Fixed the enrollment roster helper: class IDs now filter by `class_id`; stream
  names filter through the related `classes.stream` relation. The previous path
  issued an invalid null filter and then attempted an empty ID list.
- Removed the login fallback to nonexistent `/dashboard`. Roles without an
  implemented dashboard now receive an explicit message and are signed out rather
  than left in a broken authenticated state.
- Added a versioned migration to prevent ordinary same-school users from reading
  all parent contact rows and student-parent relationship links.

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
- The current attendance policies permit teacher reads for assigned classes, but
  the generic attendance write policy is administrator-only. Teacher attendance
  write flows therefore are not currently supported by these policies.
- Student/parent auth identities are not linked to the `students` or `parents`
  rows. Student and parent dashboards and entitled self-service reads cannot be
  implemented safely until the schema includes a verified relationship from the
  authenticated profile to the corresponding student/parent record. The new
  migration fails closed for parent contact data in the meantime.
- No test script or dependency lockfile is present in the repository root.
  Static review does not verify deployed PostgreSQL grants/policies, storage
  permissions, environment secrets, or cross-tenant behaviour against a live
  Supabase project.

## Checks still required in a development environment

Run the package scripts after installing dependencies with the project's intended
package manager:

```sh
pnpm type-check
pnpm lint
pnpm build
```

No automated test script is currently defined in `package.json`. Apply migrations
to a disposable local Supabase instance and use two test schools with distinct
teacher/admin accounts to verify that users cannot read or mutate the other
school's rows. Also verify that non-admin users receive no rows from
`parents` and `student_parents`, while same-school admins can manage them. Do not
run reset/destructive test commands against production.

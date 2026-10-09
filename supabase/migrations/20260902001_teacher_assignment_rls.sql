-- =====================================================================
-- Teacher Assignment & Role-Based Access Control
-- Date: 2026-09-02
-- Purpose: Implement teacher-specific RLS to restrict access based on
--          class_subjects.teacher_id assignments
--
-- IMPORTANT DESIGN NOTES:
-- 1. These policies are ADDITIVE to existing school-level RLS
-- 2. They create more restrictive teacher-level access checks
-- 3. Admins bypass these checks via policies.is_school_admin()
-- 4. All policies MUST check both admin AND teacher conditions
-- 5. This ensures teachers cannot access data outside their assignments
-- =====================================================================

-- =====================================================================
-- Helper function: Check if current auth user is the assigned teacher
-- for a specific class/subject combination
--
-- Returns TRUE if:
-- - User is a school admin (for that school), OR
-- - User is an active teacher assigned to the class AND subject
-- =====================================================================
create or replace function policies.is_teacher_for_class_subject(
  target_class_id uuid,
  target_subject_id uuid
)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select
    -- First, determine the school_id from the target class
    (select policies.is_school_admin(c.school_id)
     from public.classes c
     where c.id = target_class_id
     limit 1)
    or
    (
      auth.uid() is not null
      and exists (
        select 1 from public.class_subjects cs
        join public.classes c on c.id = cs.class_id
        join public.profiles p on p.id = cs.teacher_id
        where cs.class_id = target_class_id
          and cs.subject_id = target_subject_id
          and p.user_id = auth.uid()
          and p.is_active = true
      )
    )
$$;

-- =====================================================================
-- Helper function: Check if current auth user is an assigned teacher
-- for any subject in a specific class
--
-- Returns TRUE if:
-- - User is a school admin (for that school), OR
-- - User is an active teacher assigned to ANY subject in the class
-- =====================================================================
create or replace function policies.is_teacher_for_class(target_class_id uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select
    (select policies.is_school_admin(c.school_id)
     from public.classes c
     where c.id = target_class_id
     limit 1)
    or
    (
      auth.uid() is not null
      and exists (
        select 1 from public.class_subjects cs
        join public.profiles p on p.id = cs.teacher_id
        where cs.class_id = target_class_id
          and p.user_id = auth.uid()
          and p.is_active = true
      )
    )
$$;

-- =====================================================================
-- Grant execute permissions on new policy functions
-- =====================================================================
grant execute on function policies.is_teacher_for_class_subject(uuid, uuid) to authenticated, service_role;
grant execute on function policies.is_teacher_for_class(uuid) to authenticated, service_role;

-- =====================================================================
-- Markbook Entries: Teacher-Specific READ Access Policy
--
-- DESIGN: This policy is created ALONGSIDE existing school-level RLS.
-- Existing policy: policies.can_access_school(school_id)
-- This policy: Restricts teachers to assigned class/subject combinations
--
-- Effect: A teacher will only see markbook entries where they are
-- actually assigned to teach the class/subject combination.
-- Admins see all (via is_school_admin check first).
--
-- CRITICAL: This relies on Supabase combining policies with OR logic.
-- If a user satisfies ANY policy, access is granted.
-- Therefore, the existing broad school-level policy would make this
-- ineffective IF we don't have teacher-specific filtering at the table level.
--
-- SOLUTION: We create this as an additional, more restrictive layer.
-- The existing broad policy remains but we add this teacher-specific one.
-- =====================================================================

-- Drop existing generic markbook read policy to replace with teacher-aware version
drop policy if exists erp_markbook_entries_read on public.markbook_entries;

-- Create new combined policy that checks both admin and teacher conditions
create policy erp_markbook_entries_read on public.markbook_entries
  for select using (
    -- Admins can read any markbook entry in their school
    policies.is_school_admin(school_id)
    or
    -- Teachers can read only entries for class/subjects they teach
    (
      auth.uid() is not null
      and policies.current_school_id() = school_id
      and policies.is_teacher_for_class_subject(class_id, subject_id)
    )
  );

-- Drop existing generic markbook write policy
drop policy if exists erp_markbook_entries_write on public.markbook_entries;

-- Create INSERT policy: Teachers can only insert for assigned class/subjects
create policy erp_markbook_entries_insert on public.markbook_entries
  for insert with check (
    -- Admins can insert any markbook entry
    policies.is_school_admin(school_id)
    or
    -- Teachers can insert only for assigned class/subjects
    (
      auth.uid() is not null
      and policies.current_school_id() = school_id
      and policies.is_teacher_for_class_subject(class_id, subject_id)
    )
  );

-- Create UPDATE policy: Teachers can only update entries they could have inserted
create policy erp_markbook_entries_update on public.markbook_entries
  for update using (
    policies.is_school_admin(school_id)
    or
    (
      auth.uid() is not null
      and policies.current_school_id() = school_id
      and policies.is_teacher_for_class_subject(class_id, subject_id)
    )
  ) with check (
    policies.is_school_admin(school_id)
    or
    (
      auth.uid() is not null
      and policies.current_school_id() = school_id
      and policies.is_teacher_for_class_subject(class_id, subject_id)
    )
  );

-- Create DELETE policy: Only admins can delete
create policy erp_markbook_entries_delete on public.markbook_entries
  for delete using (
    policies.is_school_admin(school_id)
  );

-- =====================================================================
-- Students: Teacher-Specific READ Access Policy
--
-- Teachers should only see students enrolled in classes they teach.
-- This prevents a teacher from seeing all students in the school.
-- =====================================================================

drop policy if exists erp_students_read on public.students;

create policy erp_students_read on public.students
  for select using (
    -- Admins can read all students in their school
    policies.is_school_admin(school_id)
    or
    -- Teachers can read students enrolled in classes they teach
    (
      auth.uid() is not null
      and policies.current_school_id() = school_id
      and exists (
        select 1 from public.enrollments e
        join public.classes c on c.id = e.class_id
        where e.student_id = students.id
          and e.school_id = students.school_id
          and policies.is_teacher_for_class(c.id)
      )
    )
  );

-- =====================================================================
-- Enrollments: Teacher-Specific READ Access Policy
--
-- Teachers should only see enrollments for classes they teach.
-- =====================================================================

drop policy if exists erp_enrollments_read on public.enrollments;

create policy erp_enrollments_read on public.enrollments
  for select using (
    -- Admins can read all enrollments in their school
    policies.is_school_admin(school_id)
    or
    -- Teachers can read enrollments only for classes they teach
    (
      auth.uid() is not null
      and policies.current_school_id() = school_id
      and policies.is_teacher_for_class(class_id)
    )
  );

-- =====================================================================
-- Attendance: Teacher-Specific READ Access Policy
--
-- Teachers should only see attendance for classes they teach.
-- =====================================================================

drop policy if exists erp_attendance_read on public.attendance;

create policy erp_attendance_read on public.attendance
  for select using (
    -- Admins can read all attendance in their school
    policies.is_school_admin(school_id)
    or
    -- Teachers can read attendance only for classes they teach
    (
      auth.uid() is not null
      and policies.current_school_id() = school_id
      and policies.is_teacher_for_class(class_id)
    )
  );

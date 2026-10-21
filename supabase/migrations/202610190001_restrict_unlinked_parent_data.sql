-- Restrict unlinked parent contact data to school administrators.
-- The current schema has no auth-user foreign key on public.parents, so parent
-- self-service access cannot be safely scoped to the authenticated parent yet.
begin;

drop policy if exists erp_parents_read on public.parents;
create policy erp_parents_read on public.parents
  for select using (policies.is_school_admin(school_id));

-- Relationship rows also expose which parents are associated with which students.
-- Until parent/student auth identities are modelled, expose these links only to
-- administrators in the owning school.
drop policy if exists erp_student_parents_read on public.student_parents;
create policy erp_student_parents_read on public.student_parents
  for select using (
    exists (
      select 1
      from public.students s
      where s.id = student_parents.student_id
        and policies.is_school_admin(s.school_id)
    )
  );

commit;

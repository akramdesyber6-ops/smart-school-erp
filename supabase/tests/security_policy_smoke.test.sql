begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

select ok(
  (select count(*) = 13
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = any (array[
       'schools', 'profiles', 'academic_years', 'academic_terms', 'classes',
       'subjects', 'students', 'parents', 'class_subjects', 'student_parents',
       'enrollments', 'markbook_entries', 'attendance'
     ])
     and c.relrowsecurity),
  'Row-level security is enabled on all 13 core tenant tables'
);

select ok(
  not exists (
    select 1
    from (values
      ('schools', 'erp_schools_read'),
      ('schools', 'erp_schools_write'),
      ('profiles', 'erp_profiles_read'),
      ('profiles', 'erp_profiles_write'),
      ('academic_years', 'erp_academic_years_read'),
      ('academic_years', 'erp_academic_years_write'),
      ('academic_terms', 'erp_academic_terms_read'),
      ('academic_terms', 'erp_academic_terms_write'),
      ('classes', 'erp_classes_read'),
      ('classes', 'erp_classes_write'),
      ('subjects', 'erp_subjects_read'),
      ('subjects', 'erp_subjects_write'),
      ('students', 'erp_students_read'),
      ('students', 'erp_students_write'),
      ('parents', 'erp_parents_read'),
      ('parents', 'erp_parents_write'),
      ('class_subjects', 'erp_class_subjects_read'),
      ('class_subjects', 'erp_class_subjects_write'),
      ('student_parents', 'erp_student_parents_read'),
      ('student_parents', 'erp_student_parents_write'),
      ('enrollments', 'erp_enrollments_read'),
      ('enrollments', 'erp_enrollments_write'),
      ('markbook_entries', 'erp_markbook_entries_read'),
      ('markbook_entries', 'erp_markbook_entries_insert'),
      ('markbook_entries', 'erp_markbook_entries_update'),
      ('markbook_entries', 'erp_markbook_entries_delete'),
      ('attendance', 'erp_attendance_read'),
      ('attendance', 'erp_attendance_write'),
      ('attendance', 'erp_attendance_insert'),
      ('attendance', 'erp_attendance_update')
    ) as expected(tablename, policyname)
    where not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = expected.tablename
        and p.policyname = expected.policyname
    )
  ),
  'Expected tenant, teacher-assignment, portal, and attendance policies exist'
);

select ok(
  to_regprocedure('policies.is_current_student(uuid)') is not null
  and to_regprocedure('policies.is_current_parent(uuid)') is not null
  and to_regprocedure('policies.is_parent_of_student(uuid)') is not null
  and to_regprocedure('policies.is_teacher_for_class_subject(uuid,uuid)') is not null
  and to_regprocedure('policies.is_teacher_for_class(uuid)') is not null,
  'Role- and assignment-aware RLS helper functions exist'
);

select ok(
  to_regprocedure('public.create_student_and_enroll(uuid,uuid,uuid,text,text,text)') is not null
  and to_regprocedure('public.create_parent_and_link_student(uuid,uuid,text,text,text,text,text,boolean)') is not null,
  'Student onboarding and parent-linking RPC functions exist'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'students_profile_school_fkey')
  and exists (select 1 from pg_constraint where conname = 'parents_profile_school_fkey')
  and exists (select 1 from pg_constraint where conname = 'markbook_bot_score_range_check')
  and exists (select 1 from pg_constraint where conname = 'markbook_mot_score_range_check')
  and exists (select 1 from pg_constraint where conname = 'markbook_eot_score_range_check'),
  'Profile-link tenant constraints and NCDC score-range constraints exist'
);

select ok(
  exists (select 1 from pg_trigger where tgname = 'profiles_guard_identity_fields' and not tgisinternal)
  and exists (select 1 from pg_trigger where tgname = 'markbook_actor_audit_fields' and not tgisinternal)
  and exists (select 1 from pg_trigger where tgname = 'attendance_actor_audit_fields' and not tgisinternal)
  and exists (select 1 from pg_trigger where tgname = 'class_subjects_validate_assignment' and not tgisinternal)
  and exists (select 1 from pg_trigger where tgname = 'student_parents_validate_school_match' and not tgisinternal),
  'Protected identity, actor audit, and tenant-assignment triggers exist'
);

select * from finish();
rollback;

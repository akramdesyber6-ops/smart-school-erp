BEGIN;

CREATE SCHEMA IF NOT EXISTS policies;

CREATE OR REPLACE FUNCTION policies.user_school_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
SET row_security = off
AS $$
  SELECT COALESCE(array_agg(DISTINCT p.school_id), ARRAY[]::uuid[])
  FROM public.profiles AS p
  WHERE p.user_id = auth.uid()
    AND p.is_active IS TRUE
    AND p.school_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION policies.allowed_school(target_school uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
  SELECT target_school IS NOT NULL
    AND target_school = ANY (policies.user_school_ids());
$$;

CREATE OR REPLACE FUNCTION policies.is_school_admin_for_school(target_school uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.user_id = auth.uid()
      AND p.is_active IS TRUE
      AND p.school_id = target_school
      AND p.role IN ('admin', 'school_admin', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION policies.is_teacher_for_class(target_class uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    JOIN public.class_subjects AS cs ON cs.teacher_id = p.id
    JOIN public.classes AS class ON class.id = cs.class_id AND class.school_id = p.school_id
    JOIN public.subjects AS subject ON subject.id = cs.subject_id AND subject.school_id = class.school_id
    WHERE p.user_id = auth.uid()
      AND p.is_active IS TRUE
      AND p.role = 'teacher'
      AND cs.class_id = target_class
  );
$$;

CREATE OR REPLACE FUNCTION policies.is_teacher_for_class_subject(target_class uuid, target_subject uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    JOIN public.class_subjects AS cs ON cs.teacher_id = p.id
    JOIN public.classes AS class ON class.id = cs.class_id AND class.school_id = p.school_id
    JOIN public.subjects AS subject ON subject.id = cs.subject_id AND subject.school_id = class.school_id
    WHERE p.user_id = auth.uid()
      AND p.is_active IS TRUE
      AND p.role = 'teacher'
      AND cs.class_id = target_class
      AND cs.subject_id = target_subject
  );
$$;

CREATE OR REPLACE FUNCTION policies.is_parent_of_student(target_student text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    JOIN public.parents AS parent
      ON lower(parent.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
     AND parent.school_id = profile.school_id
    JOIN public.student_parents AS relationship
      ON relationship.parent_id = parent.id
    JOIN public.students AS student
      ON student.id::text = relationship.student_id::text
     AND student.id::text = target_student
     AND student.school_id = parent.school_id
    WHERE profile.user_id = auth.uid()
      AND profile.is_active IS TRUE
      AND profile.role = 'parent'
  );
$$;

CREATE OR REPLACE FUNCTION policies.is_teacher_for_student(target_student text, target_school uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    JOIN public.class_subjects AS cs ON cs.teacher_id = p.id
    JOIN public.classes AS class ON class.id = cs.class_id AND class.school_id = p.school_id
    JOIN public.enrollments AS e ON e.class_id = cs.class_id
    JOIN public.students AS student ON student.id = e.student_id AND student.school_id = p.school_id
    WHERE p.user_id = auth.uid()
      AND p.is_active IS TRUE
      AND p.role = 'teacher'
      AND e.student_id::text = target_student
      AND e.school_id = target_school
  );
$$;

CREATE OR REPLACE FUNCTION policies.valid_student_class_term(
  target_student text,
  target_class uuid,
  target_term uuid,
  target_school uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments AS enrollment
    JOIN public.students AS student
      ON student.id = enrollment.student_id
     AND student.school_id = enrollment.school_id
    JOIN public.classes AS class
      ON class.id = enrollment.class_id
     AND class.school_id = enrollment.school_id
    JOIN public.academic_terms AS term
      ON term.id = enrollment.term_id
     AND term.school_id = enrollment.school_id
    WHERE enrollment.student_id::text = target_student
      AND enrollment.class_id = target_class
      AND enrollment.term_id = target_term
      AND enrollment.school_id = target_school
  );
$$;

CREATE OR REPLACE FUNCTION policies.valid_student_term(
  target_student text,
  target_term uuid,
  target_school uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students AS student
    JOIN public.academic_terms AS term
      ON term.id = target_term
     AND term.school_id = student.school_id
    WHERE student.id::text = target_student
      AND student.school_id = target_school
  );
$$;

CREATE OR REPLACE FUNCTION policies.valid_student_subject_term(
  target_student text,
  target_subject uuid,
  target_term uuid,
  target_school uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
SET row_security = off
AS $$
  SELECT policies.valid_student_term(target_student, target_term, target_school)
    AND EXISTS (
      SELECT 1
      FROM public.subjects AS subject
      WHERE subject.id = target_subject
        AND subject.school_id = target_school
    );
$$;

CREATE OR REPLACE FUNCTION policies.valid_class_subject(target_class uuid, target_subject uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
SET row_security = off
AS $$
    SELECT EXISTS (
      SELECT 1
      FROM public.classes AS class
      JOIN public.subjects AS subject
        ON subject.id = target_subject
       AND subject.school_id = class.school_id
      WHERE class.id = target_class
    );
$$;

CREATE OR REPLACE FUNCTION policies.can_read_student(target_student text, target_school uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students AS student
    WHERE student.id::text = target_student
      AND student.school_id = target_school
      AND (
        policies.is_school_admin_for_school(target_school)
        OR policies.is_teacher_for_student(target_student, target_school)
        OR policies.is_parent_of_student(target_student)
      )
  );
$$;

CREATE OR REPLACE FUNCTION policies.is_parent_of_class(target_class uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments AS e
    JOIN public.students AS student
      ON student.id = e.student_id
     AND student.school_id = e.school_id
    JOIN public.classes AS class
      ON class.id = e.class_id
     AND class.school_id = student.school_id
    WHERE e.class_id = target_class
      AND policies.is_parent_of_student(e.student_id::text)
  );
$$;

CREATE OR REPLACE FUNCTION policies.is_teacher_for_assessment(target_student text, target_subject uuid, target_term uuid, target_school uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    JOIN public.class_subjects AS cs
      ON cs.teacher_id = p.id
     AND cs.subject_id = target_subject
    JOIN public.classes AS class
      ON class.id = cs.class_id
     AND class.school_id = p.school_id
    JOIN public.enrollments AS e
      ON e.class_id = cs.class_id
     AND e.term_id = target_term
    JOIN public.students AS student
      ON student.id = e.student_id
     AND student.school_id = e.school_id
    JOIN public.subjects AS subject
      ON subject.id = cs.subject_id
     AND subject.school_id = e.school_id
    JOIN public.academic_terms AS term
      ON term.id = e.term_id
     AND term.school_id = e.school_id
    WHERE p.user_id = auth.uid()
      AND p.is_active IS TRUE
      AND p.role = 'teacher'
      AND class.school_id = target_school
      AND e.student_id::text = target_student
      AND e.school_id = target_school
  );
$$;

CREATE OR REPLACE FUNCTION policies.can_manage_markbook(target_student text, target_class uuid, target_subject uuid, target_term uuid, target_school uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
SET row_security = off
AS $$
  SELECT policies.valid_student_class_term(target_student, target_class, target_term, target_school)
    AND policies.valid_student_subject_term(target_student, target_subject, target_term, target_school)
    AND policies.valid_class_subject(target_class, target_subject)
    AND (
      policies.is_school_admin_for_school(target_school)
      OR policies.is_teacher_for_class_subject(target_class, target_subject)
    );
$$;

CREATE OR REPLACE FUNCTION policies.can_manage_attendance(target_student text, target_class uuid, target_term uuid, target_school uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
SET row_security = off
AS $$
  SELECT policies.valid_student_class_term(target_student, target_class, target_term, target_school)
    AND (
      policies.is_school_admin_for_school(target_school)
      OR policies.is_teacher_for_class(target_class)
    );
$$;

CREATE OR REPLACE FUNCTION policies.is_parent_record(target_parent uuid, target_school uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.parents AS parent
    JOIN public.profiles AS profile
      ON profile.user_id = auth.uid()
      AND profile.is_active IS TRUE
      AND profile.role = 'parent'
     AND profile.school_id = parent.school_id
    WHERE parent.id = target_parent
      AND parent.school_id = target_school
      AND lower(parent.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );
$$;

REVOKE ALL ON SCHEMA policies FROM PUBLIC;
GRANT USAGE ON SCHEMA policies TO authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA policies FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION policies.allowed_school(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION policies.is_school_admin_for_school(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION policies.is_teacher_for_class(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION policies.is_teacher_for_class_subject(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION policies.is_parent_of_student(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION policies.is_teacher_for_student(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION policies.valid_student_class_term(text, uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION policies.valid_student_term(text, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION policies.valid_student_subject_term(text, uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION policies.valid_class_subject(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION policies.can_read_student(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION policies.is_parent_of_class(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION policies.is_teacher_for_assessment(text, uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION policies.can_manage_markbook(text, uuid, uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION policies.can_manage_attendance(text, uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION policies.is_parent_record(uuid, uuid) TO authenticated, service_role;

DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'schools', 'profiles', 'students', 'parents', 'student_parents',
        'academic_years', 'academic_terms', 'classes', 'subjects',
        'class_subjects', 'enrollments', 'attendance', 'markbook_entries',
        'student_assessments', 'grade_mappings', 'report_verifications',
        'student_subject_assignments'
      ])
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  END LOOP;
END;
$$;

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.markbook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_subject_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_school_read ON public.schools
FOR SELECT TO authenticated USING (policies.allowed_school(id));
CREATE POLICY tenant_school_update ON public.schools
FOR UPDATE TO authenticated
USING (policies.is_school_admin_for_school(id))
WITH CHECK (policies.is_school_admin_for_school(id));

CREATE POLICY profiles_read_self_or_school_admin ON public.profiles
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR policies.is_school_admin_for_school(school_id)
);
CREATE POLICY profiles_admin_insert ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (policies.is_school_admin_for_school(school_id));
CREATE POLICY profiles_admin_update ON public.profiles
FOR UPDATE TO authenticated
USING (policies.is_school_admin_for_school(school_id))
WITH CHECK (policies.is_school_admin_for_school(school_id));
CREATE POLICY profiles_admin_delete ON public.profiles
FOR DELETE TO authenticated
USING (policies.is_school_admin_for_school(school_id));

CREATE POLICY students_read_authorized_records ON public.students
FOR SELECT TO authenticated
USING (policies.can_read_student(id::text, school_id));
CREATE POLICY students_admin_insert ON public.students
FOR INSERT TO authenticated
WITH CHECK (policies.is_school_admin_for_school(school_id));
CREATE POLICY students_admin_update ON public.students
FOR UPDATE TO authenticated
USING (policies.is_school_admin_for_school(school_id))
WITH CHECK (policies.is_school_admin_for_school(school_id));
CREATE POLICY students_admin_delete ON public.students
FOR DELETE TO authenticated
USING (policies.is_school_admin_for_school(school_id));

CREATE POLICY parents_read_own_or_admin ON public.parents
FOR SELECT TO authenticated
USING (
  policies.is_school_admin_for_school(school_id)
  OR policies.is_parent_record(id, school_id)
);
CREATE POLICY parents_admin_insert ON public.parents
FOR INSERT TO authenticated
WITH CHECK (policies.is_school_admin_for_school(school_id));
CREATE POLICY parents_admin_update ON public.parents
FOR UPDATE TO authenticated
USING (policies.is_school_admin_for_school(school_id))
WITH CHECK (policies.is_school_admin_for_school(school_id));
CREATE POLICY parents_admin_delete ON public.parents
FOR DELETE TO authenticated
USING (policies.is_school_admin_for_school(school_id));

CREATE POLICY student_parents_read_linked ON public.student_parents
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.students AS student
    WHERE student.id::text = student_parents.student_id::text
      AND (
        policies.is_school_admin_for_school(student.school_id)
        OR policies.is_parent_of_student(student.id::text)
      )
  )
);
CREATE POLICY student_parents_admin_insert ON public.student_parents
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students AS student
    JOIN public.parents AS parent ON parent.id = student_parents.parent_id
    WHERE student.id::text = student_parents.student_id::text
      AND student.school_id = parent.school_id
      AND policies.is_school_admin_for_school(student.school_id)
  )
);
CREATE POLICY student_parents_admin_update ON public.student_parents
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students AS student
    WHERE student.id::text = student_parents.student_id::text
      AND policies.is_school_admin_for_school(student.school_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students AS student
    JOIN public.parents AS parent ON parent.id = student_parents.parent_id
    WHERE student.id::text = student_parents.student_id::text
      AND student.school_id = parent.school_id
      AND policies.is_school_admin_for_school(student.school_id)
  )
);
CREATE POLICY student_parents_admin_delete ON public.student_parents
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students AS student
    WHERE student.id::text = student_parents.student_id::text
      AND policies.is_school_admin_for_school(student.school_id)
  )
);

CREATE POLICY academic_years_read_school ON public.academic_years
FOR SELECT TO authenticated USING (policies.allowed_school(school_id));
CREATE POLICY academic_years_admin_write ON public.academic_years
FOR ALL TO authenticated
USING (policies.is_school_admin_for_school(school_id))
WITH CHECK (policies.is_school_admin_for_school(school_id));

CREATE POLICY academic_terms_read_school ON public.academic_terms
FOR SELECT TO authenticated USING (policies.allowed_school(school_id));
CREATE POLICY academic_terms_admin_write ON public.academic_terms
FOR ALL TO authenticated
USING (policies.is_school_admin_for_school(school_id))
WITH CHECK (policies.is_school_admin_for_school(school_id));

CREATE POLICY classes_read_authorized ON public.classes
FOR SELECT TO authenticated
USING (
  policies.allowed_school(school_id)
  AND (
    policies.is_school_admin_for_school(school_id)
    OR policies.is_teacher_for_class(id)
    OR policies.is_parent_of_class(id)
  )
);
CREATE POLICY classes_admin_write ON public.classes
FOR ALL TO authenticated
USING (policies.is_school_admin_for_school(school_id))
WITH CHECK (policies.is_school_admin_for_school(school_id));

CREATE POLICY subjects_read_authorized ON public.subjects
FOR SELECT TO authenticated
USING (
  policies.allowed_school(school_id)
  AND (
    policies.is_school_admin_for_school(school_id)
    OR EXISTS (
      SELECT 1
      FROM public.class_subjects AS cs
      JOIN public.classes AS class ON class.id = cs.class_id AND class.school_id = subjects.school_id
      WHERE cs.subject_id = subjects.id
        AND policies.is_teacher_for_class_subject(cs.class_id, cs.subject_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.class_subjects AS cs
      JOIN public.classes AS class
        ON class.id = cs.class_id
       AND class.school_id = subjects.school_id
      JOIN public.enrollments AS enrollment
        ON enrollment.class_id = class.id
       AND enrollment.school_id = class.school_id
      WHERE cs.subject_id = subjects.id
        AND policies.valid_student_class_term(
          enrollment.student_id::text,
          enrollment.class_id,
          enrollment.term_id,
          enrollment.school_id
        )
        AND policies.is_parent_of_student(enrollment.student_id::text)
    )
  )
);
CREATE POLICY subjects_admin_write ON public.subjects
FOR ALL TO authenticated
USING (policies.is_school_admin_for_school(school_id))
WITH CHECK (policies.is_school_admin_for_school(school_id));

CREATE POLICY class_subjects_read_assigned ON public.class_subjects
FOR SELECT TO authenticated
USING (
  policies.valid_class_subject(class_id, subject_id)
  AND (
    policies.is_school_admin_for_school(
      (SELECT class.school_id FROM public.classes AS class WHERE class.id = class_subjects.class_id)
    )
    OR policies.is_teacher_for_class_subject(class_id, subject_id)
  )
);
CREATE POLICY class_subjects_admin_write ON public.class_subjects
FOR ALL TO authenticated
USING (
  policies.valid_class_subject(class_id, subject_id)
  AND policies.is_school_admin_for_school(
    (SELECT class.school_id FROM public.classes AS class WHERE class.id = class_subjects.class_id)
  )
)
WITH CHECK (
  policies.valid_class_subject(class_id, subject_id)
  AND policies.is_school_admin_for_school(
    (SELECT class.school_id FROM public.classes AS class WHERE class.id = class_subjects.class_id)
  )
);

CREATE POLICY enrollments_read_authorized ON public.enrollments
FOR SELECT TO authenticated
USING (
  policies.allowed_school(school_id)
  AND policies.valid_student_class_term(student_id::text, class_id, term_id, school_id)
  AND (
    policies.is_school_admin_for_school(school_id)
    OR policies.is_teacher_for_class(class_id)
    OR policies.can_read_student(student_id::text, school_id)
  )
);
CREATE POLICY enrollments_admin_write ON public.enrollments
FOR ALL TO authenticated
USING (policies.is_school_admin_for_school(school_id))
WITH CHECK (
  policies.is_school_admin_for_school(school_id)
  AND EXISTS (
    SELECT 1
    FROM public.students AS student
    JOIN public.classes AS class
      ON class.id = enrollments.class_id
     AND class.school_id = student.school_id
    JOIN public.academic_terms AS term
      ON term.id = enrollments.term_id
     AND term.school_id = student.school_id
    WHERE student.id = enrollments.student_id
      AND student.school_id = enrollments.school_id
  )
);

CREATE POLICY attendance_read_authorized ON public.attendance
FOR SELECT TO authenticated
USING (
  policies.allowed_school(school_id)
  AND policies.valid_student_class_term(student_id::text, class_id, term_id, school_id)
  AND (
    policies.is_school_admin_for_school(school_id)
    OR (
      policies.is_teacher_for_class(class_id)
      AND policies.can_read_student(student_id::text, school_id)
    )
    OR policies.is_parent_of_student(student_id::text)
  )
);
CREATE POLICY attendance_admin_insert ON public.attendance
FOR INSERT TO authenticated
WITH CHECK (policies.can_manage_attendance(student_id::text, class_id, term_id, school_id));
CREATE POLICY attendance_authorized_update ON public.attendance
FOR UPDATE TO authenticated
USING (policies.can_manage_attendance(student_id::text, class_id, term_id, school_id))
WITH CHECK (policies.can_manage_attendance(student_id::text, class_id, term_id, school_id));
CREATE POLICY attendance_admin_delete ON public.attendance
FOR DELETE TO authenticated
USING (policies.is_school_admin_for_school(school_id));

CREATE POLICY markbook_read_authorized ON public.markbook_entries
FOR SELECT TO authenticated
USING (
  policies.allowed_school(school_id)
  AND policies.valid_student_class_term(student_id::text, class_id, term_id, school_id)
  AND (
    policies.is_school_admin_for_school(school_id)
    OR policies.can_manage_markbook(student_id::text, class_id, subject_id, term_id, school_id)
    OR policies.is_parent_of_student(student_id::text)
  )
);
CREATE POLICY markbook_authorized_insert ON public.markbook_entries
FOR INSERT TO authenticated
WITH CHECK (policies.can_manage_markbook(student_id::text, class_id, subject_id, term_id, school_id));
CREATE POLICY markbook_authorized_update ON public.markbook_entries
FOR UPDATE TO authenticated
USING (policies.can_manage_markbook(student_id::text, class_id, subject_id, term_id, school_id))
WITH CHECK (policies.can_manage_markbook(student_id::text, class_id, subject_id, term_id, school_id));
CREATE POLICY markbook_admin_delete ON public.markbook_entries
FOR DELETE TO authenticated
USING (policies.is_school_admin_for_school(school_id));

CREATE POLICY student_assessments_read_authorized ON public.student_assessments
FOR SELECT TO authenticated
USING (
  policies.allowed_school(school_id)
  AND policies.valid_student_subject_term(student_id::text, subject_id, term_id, school_id)
  AND (
    policies.is_school_admin_for_school(school_id)
    OR policies.is_teacher_for_assessment(student_id::text, subject_id, term_id, school_id)
    OR policies.is_parent_of_student(student_id::text)
  )
);
CREATE POLICY student_assessments_teacher_insert ON public.student_assessments
FOR INSERT TO authenticated
WITH CHECK (
  recorded_by = auth.uid()
  AND policies.valid_student_subject_term(student_id::text, subject_id, term_id, school_id)
  AND policies.is_teacher_for_assessment(student_id::text, subject_id, term_id, school_id)
);
CREATE POLICY student_assessments_teacher_update ON public.student_assessments
FOR UPDATE TO authenticated
USING (
  recorded_by = auth.uid()
  AND policies.valid_student_subject_term(student_id::text, subject_id, term_id, school_id)
  AND policies.is_teacher_for_assessment(student_id::text, subject_id, term_id, school_id)
)
WITH CHECK (
  recorded_by = auth.uid()
  AND policies.is_teacher_for_assessment(student_id::text, subject_id, term_id, school_id)
);
CREATE POLICY student_assessments_admin_delete ON public.student_assessments
FOR DELETE TO authenticated
USING (policies.is_school_admin_for_school(school_id));

CREATE POLICY grade_mappings_read_school ON public.grade_mappings
FOR SELECT TO authenticated USING (policies.allowed_school(school_id));
CREATE POLICY grade_mappings_admin_write ON public.grade_mappings
FOR ALL TO authenticated
USING (policies.is_school_admin_for_school(school_id))
WITH CHECK (policies.is_school_admin_for_school(school_id));

CREATE POLICY report_verifications_read_authorized ON public.report_verifications
FOR SELECT TO authenticated
USING (
  policies.allowed_school(school_id)
  AND policies.valid_student_term(student_id::text, term_id, school_id)
  AND (
    policies.is_school_admin_for_school(school_id)
    OR policies.is_parent_of_student(student_id::text)
  )
);
CREATE POLICY report_verifications_admin_insert ON public.report_verifications
FOR INSERT TO authenticated
WITH CHECK (
  policies.is_school_admin_for_school(school_id)
  AND policies.valid_student_term(student_id, term_id, school_id)
);
CREATE POLICY report_verifications_admin_update ON public.report_verifications
FOR UPDATE TO authenticated
USING (policies.is_school_admin_for_school(school_id))
WITH CHECK (
  policies.is_school_admin_for_school(school_id)
  AND policies.valid_student_term(student_id::text, term_id, school_id)
);
CREATE POLICY report_verifications_admin_delete ON public.report_verifications
FOR DELETE TO authenticated
USING (policies.is_school_admin_for_school(school_id));

CREATE POLICY student_subject_assignments_read_authorized ON public.student_subject_assignments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.students AS student
    WHERE student.id::text = student_subject_assignments.student_id
      AND policies.can_read_student(student.id::text, student.school_id)
  )
  OR EXISTS (
    SELECT 1
    FROM public.classes AS class
    JOIN public.class_subjects AS cs ON cs.class_id = class.id
    JOIN public.subjects AS subject
      ON subject.id = cs.subject_id
     AND subject.school_id = class.school_id
    JOIN public.students AS student
      ON student.id::text = student_subject_assignments.student_id
     AND student.school_id = class.school_id
    JOIN public.enrollments AS enrollment
      ON enrollment.student_id = student.id
     AND enrollment.class_id = class.id
     AND enrollment.school_id = student.school_id
     AND policies.valid_student_class_term(
       enrollment.student_id::text,
       enrollment.class_id,
       enrollment.term_id,
       enrollment.school_id
     )
    WHERE class.name = student_subject_assignments.class_name
      AND class.stream = student_subject_assignments.stream
      AND subject.name = student_subject_assignments.subject_name
      AND policies.is_teacher_for_class_subject(class.id, subject.id)
  )
);
CREATE POLICY student_subject_assignments_admin_insert ON public.student_subject_assignments
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.students AS student
    WHERE student.id::text = student_subject_assignments.student_id
      AND policies.is_school_admin_for_school(student.school_id)
  )
);
CREATE POLICY student_subject_assignments_admin_update ON public.student_subject_assignments
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.students AS student
    WHERE student.id::text = student_subject_assignments.student_id
      AND policies.is_school_admin_for_school(student.school_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.students AS student
    WHERE student.id::text = student_subject_assignments.student_id
      AND policies.is_school_admin_for_school(student.school_id)
  )
);
CREATE POLICY student_subject_assignments_admin_delete ON public.student_subject_assignments
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.students AS student
    WHERE student.id::text = student_subject_assignments.student_id
      AND policies.is_school_admin_for_school(student.school_id)
  )
);

CREATE OR REPLACE FUNCTION public.verify_report_card(p_token text)
RETURNS TABLE (is_valid boolean, report_date date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
SET row_security = off
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.report_verifications AS verification
  SET verified_at = now()
  WHERE verification.verification_token = p_token
    AND verification.is_valid IS TRUE
    AND EXISTS (
      SELECT 1
      FROM public.students AS student
      JOIN public.academic_terms AS term
        ON term.id = verification.term_id
       AND term.school_id = student.school_id
      WHERE student.id = verification.student_id
        AND student.school_id = verification.school_id
    )
  RETURNING TRUE, verification.report_date;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_report_card(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_report_card(text) TO anon, authenticated;

COMMIT;

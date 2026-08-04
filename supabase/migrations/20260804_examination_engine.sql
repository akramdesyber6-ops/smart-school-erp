-- Migration: examination and grading engine
-- Run with: supabase db push / psql -f ...

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- exam_types
CREATE TABLE IF NOT EXISTS public.exam_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  weightage numeric(5,2) DEFAULT 100.00
);

CREATE INDEX IF NOT EXISTS idx_exam_types_school ON public.exam_types (school_id);

-- exams
CREATE TABLE IF NOT EXISTS public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  exam_type_id uuid NOT NULL REFERENCES public.exam_types(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_published boolean DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exams_school ON public.exams (school_id);

-- grading_scales
CREATE TABLE IF NOT EXISTS public.grading_scales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  min_score numeric(5,2) NOT NULL,
  max_score numeric(5,2) NOT NULL,
  grade text NOT NULL,
  gpa_point numeric(3,2) DEFAULT 0.00,
  remark text
);

CREATE INDEX IF NOT EXISTS idx_grading_scales_school ON public.grading_scales (school_id, min_score, max_score);

-- marks_entries
CREATE TABLE IF NOT EXISTS public.marks_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_subject_id uuid NOT NULL REFERENCES public.class_subjects(id) ON DELETE CASCADE,
  mark_obtained numeric(5,2) NOT NULL,
  grade text,
  remarks text,
  entered_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_student_exam_subject UNIQUE (exam_id, student_id, class_subject_id)
);

CREATE INDEX IF NOT EXISTS idx_marks_school_exam ON public.marks_entries (school_id, exam_id);

-- Enable RLS
ALTER TABLE public.exam_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grading_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks_entries ENABLE ROW LEVEL SECURITY;

-- Policies: Use profiles table to confirm tenant

-- exam_types policies
CREATE POLICY exam_types_select_same_school ON public.exam_types
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()::uuid AND p.school_id = public.exam_types.school_id)
);
CREATE POLICY exam_types_insert_same_school ON public.exam_types
FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()::uuid AND p.school_id = NEW.school_id)
);
CREATE POLICY exam_types_update_same_school ON public.exam_types
FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()::uuid AND p.school_id = public.exam_types.school_id)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()::uuid AND p.school_id = NEW.school_id)
);
CREATE POLICY exam_types_delete_same_school ON public.exam_types
FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()::uuid AND p.school_id = public.exam_types.school_id)
);

-- exams policies
CREATE POLICY exams_select_same_school ON public.exams
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()::uuid AND p.school_id = public.exams.school_id)
);
CREATE POLICY exams_insert_same_school ON public.exams
FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()::uuid AND p.school_id = NEW.school_id)
);
CREATE POLICY exams_update_same_school ON public.exams
FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()::uuid AND p.school_id = public.exams.school_id)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()::uuid AND p.school_id = NEW.school_id)
);
CREATE POLICY exams_delete_same_school ON public.exams
FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()::uuid AND p.school_id = public.exams.school_id)
);

-- grading_scales policies
CREATE POLICY grading_scales_select_same_school ON public.grading_scales
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()::uuid AND p.school_id = public.grading_scales.school_id)
);
CREATE POLICY grading_scales_insert_same_school ON public.grading_scales
FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()::uuid AND p.school_id = NEW.school_id)
);
CREATE POLICY grading_scales_update_same_school ON public.grading_scales
FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()::uuid AND p.school_id = public.grading_scales.school_id)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()::uuid AND p.school_id = NEW.school_id)
);
CREATE POLICY grading_scales_delete_same_school ON public.grading_scales
FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()::uuid AND p.school_id = public.grading_scales.school_id)
);

-- marks_entries policies (ensure session belongs to same school via exam)
CREATE POLICY marks_entries_select_same_school ON public.marks_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.exams e
    WHERE e.id = public.marks_entries.exam_id
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()::uuid AND p.school_id = e.school_id)
  )
);
CREATE POLICY marks_entries_insert_same_school ON public.marks_entries
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.exams e
    WHERE e.id = NEW.exam_id
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()::uuid AND p.school_id = e.school_id)
  )
);
CREATE POLICY marks_entries_update_same_school ON public.marks_entries
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.exams e
    WHERE e.id = public.marks_entries.exam_id
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()::uuid AND p.school_id = e.school_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.exams e
    WHERE e.id = NEW.exam_id
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()::uuid AND p.school_id = e.school_id)
  )
);
CREATE POLICY marks_entries_delete_same_school ON public.marks_entries
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.exams e
    WHERE e.id = public.marks_entries.exam_id
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()::uuid AND p.school_id = e.school_id)
  )
);

-- Function: save_bulk_marks
CREATE OR REPLACE FUNCTION public.save_bulk_marks(
  p_school_id uuid,
  p_exam_id uuid,
  p_class_subject_id uuid,
  p_entered_by uuid,
  p_marks jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_rec jsonb;
  v_student_id uuid;
  v_mark numeric(5,2);
  v_grade text;
  v_remark text;
  v_count int := 0;
BEGIN
  -- Validate exam belongs to school
  PERFORM 1 FROM public.exams e WHERE e.id = p_exam_id AND e.school_id = p_school_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam % not found for school %', p_exam_id, p_school_id;
  END IF;

  -- Loop marks
  FOR v_rec IN SELECT * FROM jsonb_array_elements(p_marks) LOOP
    v_student_id := (v_rec->>'student_id')::uuid;
    v_mark := (v_rec->>'mark_obtained')::numeric;

    -- find matching grading scale for this school and mark
    SELECT grade, remark INTO v_grade, v_remark
    FROM public.grading_scales gs
    WHERE gs.school_id = p_school_id
      AND v_mark >= gs.min_score
      AND v_mark <= gs.max_score
    ORDER BY gs.gpa_point DESC
    LIMIT 1;

    INSERT INTO public.marks_entries (school_id, exam_id, student_id, class_subject_id, mark_obtained, grade, remarks, entered_by)
    VALUES (p_school_id, p_exam_id, v_student_id, p_class_subject_id, v_mark, v_grade, v_rec->>'remarks', p_entered_by)
    ON CONFLICT (exam_id, student_id, class_subject_id)
    DO UPDATE SET mark_obtained = EXCLUDED.mark_obtained, grade = EXCLUDED.grade, remarks = EXCLUDED.remarks, entered_by = EXCLUDED.entered_by, created_at = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('processed', v_count);
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

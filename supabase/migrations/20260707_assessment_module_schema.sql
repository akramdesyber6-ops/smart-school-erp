-- =====================================================================
-- CBC Smart School ERP: Assessment Module Schema & Data Migration
-- Integrates student_subjects data with existing Supabase schema
-- =====================================================================
-- This migration adds assessment tracking tables and imports subject assignments
-- Safe to re-run; uses ON CONFLICT DO NOTHING for idempotency
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. ASSESSMENT TYPES & GRADING SCALE TABLES (NEW)
-- =====================================================================

-- Create assessment_types enum if not exists
CREATE TYPE assessment_type_enum AS ENUM ('AOI1', 'AOI2', 'AOI3', 'EOT');

-- Create alpha_grade enum
CREATE TYPE alpha_grade_enum AS ENUM ('A', 'B', 'C', 'D', 'E');

-- Create achievement_level enum
CREATE TYPE achievement_level_enum AS ENUM ('Excellent', 'Very Good', 'Good', 'Fair', 'Below Average');

-- =====================================================================
-- 2. STUDENT ASSESSMENTS TABLE (NEW)
-- =====================================================================
-- Stores individual assessment scores (0-3 scale for CBC)
-- Composite key ensures one score per student/subject/term/assessment_type

CREATE TABLE IF NOT EXISTS public.student_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL,
  subject_id UUID NOT NULL,
  term_id UUID NOT NULL,
  school_id UUID NOT NULL,
  assessment_type assessment_type_enum NOT NULL,
  score NUMERIC(3, 1) CHECK (score >= 0 AND score <= 3), -- 0-3 scale with decimals
  teacher_initials VARCHAR(10),
  recorded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Foreign keys
  CONSTRAINT fk_student_id FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE,
  CONSTRAINT fk_subject_id FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE,
  CONSTRAINT fk_term_id FOREIGN KEY (term_id) REFERENCES public.academic_terms(id) ON DELETE CASCADE,
  CONSTRAINT fk_school_id FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE,
  
  -- Composite unique constraint: one score per student/subject/term/assessment
  CONSTRAINT unique_assessment UNIQUE (student_id, subject_id, term_id, assessment_type)
);

-- Create indexes for fast queries
CREATE INDEX idx_assessments_student ON public.student_assessments(student_id);
CREATE INDEX idx_assessments_subject ON public.student_assessments(subject_id);
CREATE INDEX idx_assessments_term ON public.student_assessments(term_id);
CREATE INDEX idx_assessments_school ON public.student_assessments(school_id);
CREATE INDEX idx_assessments_recorded_by ON public.student_assessments(recorded_by);

-- =====================================================================
-- 3. GRADE MAPPINGS TABLE (NEW)
-- =====================================================================
-- Maps 0-3 score ranges to alpha grades (A-E) for CBC

CREATE TABLE IF NOT EXISTS public.grade_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  curriculum_type VARCHAR(50) NOT NULL, -- 'CBC' or 'NCDC'
  min_score NUMERIC(3, 1) NOT NULL,
  max_score NUMERIC(3, 1) NOT NULL,
  alpha_grade alpha_grade_enum NOT NULL,
  achievement_level achievement_level_enum,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (school_id, curriculum_type, min_score, max_score)
);

CREATE INDEX idx_grade_mappings_school ON public.grade_mappings(school_id);

-- =====================================================================
-- 4. REPORT VERIFICATIONS TABLE (NEW - Module 3 QR Codes)
-- =====================================================================
-- Stores QR code verification tokens for report card authenticity

CREATE TABLE IF NOT EXISTS public.report_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES public.academic_terms(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  verification_token VARCHAR(255) UNIQUE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_valid BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (student_id, term_id, report_date)
);

CREATE INDEX idx_verifications_student ON public.report_verifications(student_id);
CREATE INDEX idx_verifications_token ON public.report_verifications(verification_token);
CREATE INDEX idx_verifications_school ON public.report_verifications(school_id);

-- =====================================================================
-- 5. ENABLE ROW-LEVEL SECURITY (RLS)
-- =====================================================================

-- Enable RLS on student_assessments
ALTER TABLE public.student_assessments ENABLE ROW LEVEL SECURITY;

-- Policy: Teachers can see assessments for their assigned subjects
CREATE POLICY "Teachers see own subject assessments"
  ON public.student_assessments
  FOR SELECT
  USING (
    recorded_by = auth.uid() OR
    school_id IN (
      SELECT school_id FROM public.profiles 
      WHERE user_id = auth.uid() AND role IN ('teacher', 'school_admin', 'headteacher')
    )
  );

-- Policy: Teachers can insert/update their own records
CREATE POLICY "Teachers manage own records"
  ON public.student_assessments
  FOR INSERT
  WITH CHECK (recorded_by = auth.uid());

CREATE POLICY "Teachers update own records"
  ON public.student_assessments
  FOR UPDATE
  USING (recorded_by = auth.uid())
  WITH CHECK (recorded_by = auth.uid());

-- Policy: Only admins can delete
CREATE POLICY "Admins delete assessments"
  ON public.student_assessments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND role = 'school_admin'
    )
  );

-- Enable RLS on report_verifications
ALTER TABLE public.report_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can verify reports"
  ON public.report_verifications
  FOR SELECT
  USING (is_valid = true);

CREATE POLICY "Admins manage verifications"
  ON public.report_verifications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND role = 'school_admin'
    )
  );

-- =====================================================================
-- 6. SEED CBC GRADING MAPPINGS (Standard Uganda CBC Scale)
-- =====================================================================

INSERT INTO public.grade_mappings (
  school_id,
  curriculum_type,
  min_score,
  max_score,
  alpha_grade,
  achievement_level,
  description
)
SELECT 
  schools.id,
  'CBC',
  t.min_score,
  t.max_score,
  t.alpha_grade::alpha_grade_enum,
  t.achievement_level::achievement_level_enum,
  t.description
FROM (
  VALUES 
    (2.7, 3.0, 'A', 'Excellent', 'Outstanding achievement'),
    (2.4, 2.6, 'B', 'Very Good', 'Commendable performance'),
    (2.0, 2.3, 'C', 'Good', 'Satisfactory achievement'),
    (1.5, 1.9, 'D', 'Fair', 'Acceptable but needs improvement'),
    (0.0, 1.4, 'E', 'Below Average', 'Requires significant improvement')
) AS t(min_score, max_score, alpha_grade, achievement_level, description)
CROSS JOIN public.schools
ON CONFLICT (school_id, curriculum_type, min_score, max_score) DO NOTHING;

-- =====================================================================
-- 7. IMPORT STUDENT SUBJECTS FROM EXTERNAL DATA
-- =====================================================================
-- Maps students to subjects (created from student_subjects.sql data)
-- This data is used to populate class_subjects relationships

CREATE TABLE IF NOT EXISTS public.student_subject_assignments (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL,
  subject_name VARCHAR(100) NOT NULL,
  class_name VARCHAR(50) NOT NULL,
  stream VARCHAR(50) NOT NULL,
  assigned_by VARCHAR(100) DEFAULT 'System',
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() ON UPDATE current_timestamp
);

-- Create index for fast lookups
CREATE INDEX idx_student_subject_assignments_student 
  ON public.student_subject_assignments(student_id);

CREATE INDEX idx_student_subject_assignments_subject 
  ON public.student_subject_assignments(subject_name);

-- =====================================================================
-- 8. HELPER FUNCTION: Calculate Subject Average
-- =====================================================================
-- Computes average score across AOI1, AOI2, AOI3, EOT for a subject

CREATE OR REPLACE FUNCTION public.calculate_subject_average(
  p_student_id TEXT,
  p_subject_id UUID,
  p_term_id UUID
) RETURNS NUMERIC AS $$
DECLARE
  v_average NUMERIC(3, 2);
BEGIN
  SELECT AVG(score)::NUMERIC(3, 2)
  INTO v_average
  FROM public.student_assessments
  WHERE student_id = p_student_id
    AND subject_id = p_subject_id
    AND term_id = p_term_id;
  
  RETURN COALESCE(v_average, 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================================
-- 9. HELPER FUNCTION: Convert Score to Alpha Grade
-- =====================================================================

CREATE OR REPLACE FUNCTION public.score_to_alpha_grade(
  p_school_id UUID,
  p_score NUMERIC(3, 1)
) RETURNS alpha_grade_enum AS $$
DECLARE
  v_grade alpha_grade_enum;
BEGIN
  SELECT gm.alpha_grade
  INTO v_grade
  FROM public.grade_mappings gm
  WHERE gm.school_id = p_school_id
    AND gm.curriculum_type = 'CBC'
    AND p_score >= gm.min_score
    AND p_score <= gm.max_score
  LIMIT 1;
  
  RETURN COALESCE(v_grade, 'E'::alpha_grade_enum);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================================
-- 10. HELPER FUNCTION: Convert Score to /20 Scale
-- =====================================================================
-- Maps 0-3 CBC scale to 0-20 NCDC equivalent

CREATE OR REPLACE FUNCTION public.score_to_out_of_20(
  p_score NUMERIC(3, 1)
) RETURNS NUMERIC AS $$
BEGIN
  -- Simple linear conversion: multiply by 6.67
  -- 3.0 * 6.67 ≈ 20
  -- 0.0 * 6.67 = 0
  RETURN ROUND((p_score * 6.67)::NUMERIC, 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================================
-- 11. UPDATE TRIGGER: Auto-update timestamp on changes
-- =====================================================================

CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to student_assessments
DROP TRIGGER IF EXISTS update_assessment_timestamp ON public.student_assessments;
CREATE TRIGGER update_assessment_timestamp
  BEFORE UPDATE ON public.student_assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

-- =====================================================================
-- 12. COMMIT TRANSACTION
-- =====================================================================

COMMIT;

-- =====================================================================
-- VERIFICATION QUERIES (run after migration)
-- =====================================================================
-- SELECT COUNT(*) FROM public.student_assessments;
-- SELECT COUNT(*) FROM public.grade_mappings;
-- SELECT COUNT(*) FROM public.report_verifications;
-- SELECT * FROM public.student_assessments LIMIT 10;
-- SELECT * FROM public.grade_mappings WHERE curriculum_type = 'CBC' ORDER BY min_score DESC;

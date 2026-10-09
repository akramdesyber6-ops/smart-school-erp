-- =====================================================================
-- INTEGRATION GUIDE: student_subjects.sql → Supabase Schema
-- =====================================================================

-- OVERVIEW
-- Your existing student_subjects.sql contains ~400 records of student-subject
-- assignments from your legacy MariaDB database. This guide shows how to
-- integrate this data into the new Supabase PostgreSQL backend.

-- =====================================================================
-- STEP 1: Understand Your Data Structure
-- =====================================================================

-- Legacy table structure (from your student_subjects.sql):
-- 
-- CREATE TABLE `student_subjects` (
--   `id` int(11),
--   `student_id` varchar(30),           -- e.g., '0U-STD-2026-0547'
--   `subject` varchar(100),             -- e.g., 'Kiswahili', 'Physical Education'
--   `class` varchar(50),                -- e.g., 'Senior One', 'Senior Three'
--   `stream` varchar(50),               -- e.g., 'East', 'West', 'South'
--   `assigned_by` varchar(100),         -- e.g., 'System'
--   `assigned_at` timestamp,
--   `updated_at` timestamp
-- );

-- KEY DATA OBSERVATIONS:
-- - 59 students assigned "Kiswahili" in Senior One East stream
-- - 61+ students assigned "Physical Education" across different streams
-- - Students: Senior One (East, South, West), Senior Three (East, South)
-- - All records have assigned_by = 'System'

-- =====================================================================
-- STEP 2: Map Legacy Subjects to Supabase Subject IDs
-- =====================================================================

-- In Supabase, you have subjects table with UUIDs:
-- 
-- Subject Lookup (from supabase/seed.sql):
--   Mathematics:       950e8400-e29b-41d4-a716-446655440001
--   Geography:         950e8400-e29b-41d4-a716-446655440002
--   Physics:           950e8400-e29b-41d4-a716-446655440003
--   Chemistry:         950e8400-e29b-41d4-a716-446655440004
--   English:           950e8400-e29b-41d4-a716-446655440005
--
-- From your data, you need to add:
--   Kiswahili
--   Physical Education
--   Fine Art

-- RUN THIS FIRST to add missing subjects:

INSERT INTO public.subjects (id, school_id, name, code, description)
SELECT 
  schools.id || '-' || ROW_NUMBER() OVER (ORDER BY name) || '-subject' AS id,
  schools.id,
  t.subject_name,
  t.subject_code,
  t.description
FROM (
  VALUES 
    ('Kiswahili', 'KIS', 'Swahili language and cultural studies'),
    ('Physical Education', 'PE', 'Sports and physical fitness curriculum'),
    ('Fine Art', 'FA', 'Visual arts and creative expression')
) AS t(subject_name, subject_code, description)
CROSS JOIN public.schools
WHERE schools.name = 'Kampala Elite Academy' -- or your school name
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- STEP 3: Verify Student IDs Exist
-- =====================================================================

-- Check if students from your CSV are registered:
SELECT COUNT(DISTINCT student_id) as registered_students
FROM public.students
WHERE student_id LIKE '0U-STD-2026-%';

-- If 0 results, you need to import students first:
-- See: supabase/migrations/20260707_students_bulk_import.sql

-- =====================================================================
-- STEP 4: Import Subject Assignments (Idempotent)
-- =====================================================================

-- This creates a mapping between students and their assigned subjects
-- The student_subject_assignments table tracks which student has which subject

INSERT INTO public.student_subject_assignments (
  student_id,
  subject_name,
  class_name,
  stream,
  assigned_by,
  assigned_at
)
-- Example: Import Kiswahili assignments for Senior One East
SELECT DISTINCT
  CAST(ss.student_id AS TEXT),
  CAST(ss.subject AS TEXT),
  CAST(ss.class AS TEXT),
  CAST(ss.stream AS TEXT),
  COALESCE(ss.assigned_by, 'System'),
  CAST(ss.assigned_at AS TIMESTAMP WITH TIME ZONE)
FROM legacy_student_subjects ss -- Replace with your import source
WHERE ss.class = 'Senior One'
  AND ss.stream = 'East'
  AND ss.subject = 'Kiswahili'
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- STEP 5: Link Student Subjects to Class-Subject Relationships
-- =====================================================================

-- Now update class_subjects to include all subject assignments
-- Match subject_name to subject_id using a lookup

INSERT INTO public.class_subjects (
  id,
  class_id,
  subject_id,
  teacher_id
)
SELECT 
  gen_random_uuid(),
  c.id AS class_id,
  s.id AS subject_id,
  -- Default teacher assignment (can be updated later)
  (SELECT id FROM auth.users WHERE email LIKE '%teacher%' LIMIT 1) AS teacher_id
FROM public.student_subject_assignments ssa
JOIN public.classes c ON c.name ILIKE ssa.class_name || '%'
JOIN public.subjects s ON s.name ILIKE ssa.subject_name
WHERE NOT EXISTS (
  SELECT 1 FROM public.class_subjects
  WHERE class_id = c.id AND subject_id = s.id
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- STEP 6: Verify Import Success
-- =====================================================================

-- Count imported assignments:
SELECT 
  COUNT(*) as total_assignments,
  COUNT(DISTINCT student_id) as unique_students,
  COUNT(DISTINCT subject_name) as unique_subjects,
  COUNT(DISTINCT class_name) as unique_classes
FROM public.student_subject_assignments;

-- Sample query - Show Kiswahili assignments:
SELECT 
  ssa.student_id,
  ssa.subject_name,
  ssa.class_name,
  ssa.stream,
  ssa.assigned_at
FROM public.student_subject_assignments ssa
WHERE ssa.subject_name = 'Kiswahili'
ORDER BY ssa.student_id
LIMIT 20;

-- =====================================================================
-- STEP 7: Create Assessment Records (Optional - Seed Dummy Data)
-- =====================================================================

-- For testing, create sample assessment records:
WITH sample_assessments AS (
  SELECT 
    s.id as student_id,
    cs.subject_id,
    t.id as term_id,
    sch.id as school_id,
    'AOI1'::assessment_type_enum as assessment_type,
    ROUND((RANDOM() * 3)::NUMERIC, 1)::NUMERIC(3, 1) as score,
    'JM' as teacher_initials,
    auth.uid() as recorded_by
  FROM public.students s
  JOIN public.student_subject_assignments ssa ON ssa.student_id = s.id
  JOIN public.subjects subj ON subj.name ILIKE ssa.subject_name
  JOIN public.classes c ON c.name ILIKE ssa.class_name
  JOIN public.class_subjects cs ON cs.class_id = c.id AND cs.subject_id = subj.id
  JOIN public.academic_terms t ON t.name = 'Term II Evaluation'
  JOIN public.schools sch ON sch.id = c.school_id
  LIMIT 100
)
INSERT INTO public.student_assessments (
  student_id,
  subject_id,
  term_id,
  school_id,
  assessment_type,
  score,
  teacher_initials,
  recorded_by
)
SELECT * FROM sample_assessments
ON CONFLICT (student_id, subject_id, term_id, assessment_type) DO NOTHING;

-- =====================================================================
-- TROUBLESHOOTING
-- =====================================================================

-- Issue: "student_id does not exist"
-- Solution: Import students from student_subjects.sql:
--   1. Extract DISTINCT student_id from student_subjects.sql
--   2. Match to students table or bulk-create
--   3. Ensure IDs follow format: 0U-STD-2026-XXXX

-- Issue: "subject not found"
-- Solution: 
--   1. Verify subject names match exactly (case-sensitive?)
--   2. Check public.subjects table: SELECT * FROM public.subjects;
--   3. Create missing subjects first

-- Issue: "RLS policy prevents access"
-- Solution:
--   1. Ensure authenticated user has 'teacher' or 'school_admin' role
--   2. Check auth.users and profiles tables
--   3. Grant appropriate permissions via RLS policies

-- =====================================================================
-- REFERENCE: SQL to Convert Legacy CSV to Supabase Format
-- =====================================================================

-- If importing from CSV:
-- 1. Export student_subjects.sql data to CSV
-- 2. Use Supabase Studio -> SQL Editor -> Import CSV
-- 3. Or use psql: \COPY public.student_subject_assignments FROM 'file.csv' CSV HEADER;


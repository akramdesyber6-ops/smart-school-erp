-- =====================================================================
-- Kampala Elite Academy: Comprehensive Database Seed Script
-- Multi-Tenant, Idempotent, CBC/NCDC Dual-Curriculum Support
-- =====================================================================
-- This script is safe to re-run; all inserts use ON CONFLICT DO NOTHING
-- Dependencies: Supabase Auth + PostgreSQL RLS policies must be active
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. SCHOOLS (Tenant)
-- =====================================================================
INSERT INTO public.schools (id, name, emis_code, location, phone, email, principal_name)
VALUES (
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  'Kampala Elite Academy',
  'EMIS-KEA-001',
  'Plot 123, Kololo, Kampala, Uganda',
  '+256 750 123456',
  'admin@kampalaelite.ug',
  'Dr. Samuel Kasirye'
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 2. ACADEMIC YEARS & TERMS
-- =====================================================================
INSERT INTO public.academic_years (id, school_id, year, start_date, end_date, is_current)
VALUES (
  '650e8400-e29b-41d4-a716-446655440001'::uuid,
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  2026,
  '2026-01-15'::date,
  '2026-11-30'::date,
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.academic_terms (id, school_id, academic_year_id, name, start_date, end_date, is_current)
VALUES
  (
    '750e8400-e29b-41d4-a716-446655440001'::uuid,
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    '650e8400-e29b-41d4-a716-446655440001'::uuid,
    'Term I',
    '2026-01-15'::date,
    '2026-04-15'::date,
    false
  ),
  (
    '750e8400-e29b-41d4-a716-446655440002'::uuid,
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    '650e8400-e29b-41d4-a716-446655440001'::uuid,
    'Term II Evaluation',
    '2026-04-20'::date,
    '2026-08-15'::date,
    true
  ),
  (
    '750e8400-e29b-41d4-a716-446655440003'::uuid,
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    '650e8400-e29b-41d4-a716-446655440001'::uuid,
    'Term III',
    '2026-08-20'::date,
    '2026-11-30'::date,
    false
  )
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 3. CLASSES & STREAMS
-- =====================================================================
INSERT INTO public.classes (id, school_id, name, stream, curriculum, form_level)
VALUES
  (
    '850e8400-e29b-41d4-a716-446655440001'::uuid,
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    'Senior 1',
    'Blue Stream',
    'CBC',
    1
  ),
  (
    '850e8400-e29b-41d4-a716-446655440002'::uuid,
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    'Senior 5',
    'Science Stream',
    'NCDC',
    5
  )
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 4. SUBJECTS
-- =====================================================================
INSERT INTO public.subjects (id, school_id, name, code, description)
VALUES
  (
    '950e8400-e29b-41d4-a716-446655440001'::uuid,
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    'Mathematics',
    'MATH',
    'Core mathematics curriculum covering algebra, geometry, and calculus'
  ),
  (
    '950e8400-e29b-41d4-a716-446655440002'::uuid,
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    'Geography',
    'GEO',
    'Physical and human geography with focus on African context'
  ),
  (
    '950e8400-e29b-41d4-a716-446655440003'::uuid,
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    'Physics',
    'PHYS',
    'Classical mechanics, thermodynamics, and modern physics'
  ),
  (
    '950e8400-e29b-41d4-a716-446655440004'::uuid,
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    'Chemistry',
    'CHEM',
    'Inorganic and organic chemistry with practical laboratory work'
  ),
  (
    '950e8400-e29b-41d4-a716-446655440005'::uuid,
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    'English',
    'ENG',
    'Language and literature studies'
  )
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 5. CLASS-SUBJECT ASSOCIATIONS
-- =====================================================================
INSERT INTO public.class_subjects (id, class_id, subject_id, teacher_id)
VALUES
  -- Senior 1 (CBC) subjects
  (
    '960e8400-e29b-41d4-a716-446655440001'::uuid,
    '850e8400-e29b-41d4-a716-446655440001'::uuid,
    '950e8400-e29b-41d4-a716-446655440001'::uuid,
    'a10e8400-e29b-41d4-a716-446655440001'::uuid
  ), -- Teacher 1 (CBC)
  (
    '960e8400-e29b-41d4-a716-446655440002'::uuid,
    '850e8400-e29b-41d4-a716-446655440001'::uuid,
    '950e8400-e29b-41d4-a716-446655440002'::uuid,
    'a10e8400-e29b-41d4-a716-446655440001'::uuid
  ), -- Teacher 1 (CBC)
  -- Senior 5 (NCDC) subjects
  (
    '960e8400-e29b-41d4-a716-446655440003'::uuid,
    '850e8400-e29b-41d4-a716-446655440002'::uuid,
    '950e8400-e29b-41d4-a716-446655440003'::uuid,
    'a10e8400-e29b-41d4-a716-446655440002'::uuid
  ), -- Teacher 2 (NCDC)
  (
    '960e8400-e29b-41d4-a716-446655440004'::uuid,
    '850e8400-e29b-41d4-a716-446655440002'::uuid,
    '950e8400-e29b-41d4-a716-446655440004'::uuid,
    'a10e8400-e29b-41d4-a716-446655440002'::uuid
  ) -- Teacher 2 (NCDC)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 6. AUTHENTICATION & PROFILE USERS
-- Note: In production, use Firebase/Supabase Auth Admin SDK
-- For testing, we create placeholder user_ids (typically UUIDs from auth.users)
-- =====================================================================

-- School Admin Profile
INSERT INTO public.profiles (
  id,
  user_id,
  school_id,
  role,
  first_name,
  last_name,
  email,
  phone,
  national_id,
  date_of_birth,
  is_active
)
VALUES (
  'b10e8400-e29b-41d4-a716-446655440001'::uuid,
  'c20e8400-e29b-41d4-a716-446655440001'::uuid,
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  'school_admin',
  'Grace',
  'Kiggundu',
  'grace.admin@kampalaelite.ug',
  '+256 701 234567',
  'UG-NIN-2024-001',
  '1985-03-15'::date,
  true
)
ON CONFLICT (id) DO NOTHING;

-- Teacher 1 (CBC - Mathematics & Geography)
INSERT INTO public.profiles (
  id,
  user_id,
  school_id,
  role,
  first_name,
  last_name,
  email,
  phone,
  national_id,
  date_of_birth,
  is_active,
  qualifications
)
VALUES (
  'a10e8400-e29b-41d4-a716-446655440001'::uuid,
  'c20e8400-e29b-41d4-a716-446655440002'::uuid,
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  'teacher',
  'Robert',
  'Mukuka',
  'robert.mukuka@kampalaelite.ug',
  '+256 705 345678',
  'UG-NIN-2024-002',
  '1990-07-22'::date,
  true,
  'B.Sc Education (Mathematics), Diploma in CBC Pedagogy'
)
ON CONFLICT (id) DO NOTHING;

-- Teacher 2 (NCDC - Physics & Chemistry)
INSERT INTO public.profiles (
  id,
  user_id,
  school_id,
  role,
  first_name,
  last_name,
  email,
  phone,
  national_id,
  date_of_birth,
  is_active,
  qualifications
)
VALUES (
  'a10e8400-e29b-41d4-a716-446655440002'::uuid,
  'c20e8400-e29b-41d4-a716-446655440003'::uuid,
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  'teacher',
  'Dr. Patrick',
  'Ouma',
  'patrick.ouma@kampalaelite.ug',
  '+256 708 456789',
  'UG-NIN-2024-003',
  '1988-11-30'::date,
  true,
  'B.Sc Physics, M.Sc Chemistry, Secondary Teaching Certificate'
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 7. STUDENT PROFILES (WITH PARENT RELATIONSHIPS)
-- =====================================================================

-- Student 1: Amina Ssekandi (S1 CBC)
INSERT INTO public.students (id, school_id, first_name, last_name, registration_number, date_of_birth, gender, is_active)
VALUES (
  'd10e8400-e29b-41d4-a716-446655440001'::uuid,
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  'Amina',
  'Ssekandi',
  'STU-2024-S1-001',
  '2012-05-14'::date,
  'Female',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Student 2: John Kiwanuka (S1 CBC)
INSERT INTO public.students (id, school_id, first_name, last_name, registration_number, date_of_birth, gender, is_active)
VALUES (
  'd10e8400-e29b-41d4-a716-446655440002'::uuid,
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  'John',
  'Kiwanuka',
  'STU-2024-S1-002',
  '2012-08-28'::date,
  'Male',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Student 3: David Muwanguzi (S5 NCDC)
INSERT INTO public.students (id, school_id, first_name, last_name, registration_number, date_of_birth, gender, is_active)
VALUES (
  'd10e8400-e29b-41d4-a716-446655440003'::uuid,
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  'David',
  'Muwanguzi',
  'STU-2024-S5-001',
  '2008-02-11'::date,
  'Male',
  true
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 8. PARENT PROFILES & RELATIONSHIPS
-- =====================================================================

-- Parent 1: Father of Amina & John
INSERT INTO public.parents (id, school_id, first_name, last_name, email, phone, relationship_to_student)
VALUES (
  'e10e8400-e29b-41d4-a716-446655440001'::uuid,
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  'Emmanuel',
  'Ssekandi',
  'emmanuel.ssekandi@email.ug',
  '+256 754 567890',
  'Father'
)
ON CONFLICT (id) DO NOTHING;

-- Parent 2: Mother of Amina & John
INSERT INTO public.parents (id, school_id, first_name, last_name, email, phone, relationship_to_student)
VALUES (
  'e10e8400-e29b-41d4-a716-446655440002'::uuid,
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  'Ruth',
  'Ssekandi',
  'ruth.ssekandi@email.ug',
  '+256 754 678901',
  'Mother'
)
ON CONFLICT (id) DO NOTHING;

-- Parent 3: Father of David
INSERT INTO public.parents (id, school_id, first_name, last_name, email, phone, relationship_to_student)
VALUES (
  'e10e8400-e29b-41d4-a716-446655440003'::uuid,
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  'Samuel',
  'Muwanguzi',
  'samuel.muwanguzi@email.ug',
  '+256 757 789012',
  'Father'
)
ON CONFLICT (id) DO NOTHING;

-- Student-Parent Relationships
INSERT INTO public.student_parents (id, student_id, parent_id, is_primary_contact)
VALUES
  ('f10e8400-e29b-41d4-a716-446655440001'::uuid, 'd10e8400-e29b-41d4-a716-446655440001'::uuid, 'e10e8400-e29b-41d4-a716-446655440001'::uuid, true),
  ('f10e8400-e29b-41d4-a716-446655440002'::uuid, 'd10e8400-e29b-41d4-a716-446655440001'::uuid, 'e10e8400-e29b-41d4-a716-446655440002'::uuid, false),
  ('f10e8400-e29b-41d4-a716-446655440003'::uuid, 'd10e8400-e29b-41d4-a716-446655440002'::uuid, 'e10e8400-e29b-41d4-a716-446655440001'::uuid, true),
  ('f10e8400-e29b-41d4-a716-446655440004'::uuid, 'd10e8400-e29b-41d4-a716-446655440002'::uuid, 'e10e8400-e29b-41d4-a716-446655440002'::uuid, false),
  ('f10e8400-e29b-41d4-a716-446655440005'::uuid, 'd10e8400-e29b-41d4-a716-446655440003'::uuid, 'e10e8400-e29b-41d4-a716-446655440003'::uuid, true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 9. ENROLLMENTS (STUDENTS IN CLASSES FOR CURRENT TERM)
-- =====================================================================

-- Amina & John enrolled in S1 CBC (Term II)
INSERT INTO public.enrollments (id, school_id, student_id, class_id, term_id, status, enrollment_date)
VALUES
  (
    '010e8400-e29b-41d4-a716-446655440001'::uuid,
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    'd10e8400-e29b-41d4-a716-446655440001'::uuid,
    '850e8400-e29b-41d4-a716-446655440001'::uuid,
    '750e8400-e29b-41d4-a716-446655440002'::uuid,
    'active',
    '2026-04-20'::date
  ),
  (
    '010e8400-e29b-41d4-a716-446655440002'::uuid,
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    'd10e8400-e29b-41d4-a716-446655440002'::uuid,
    '850e8400-e29b-41d4-a716-446655440001'::uuid,
    '750e8400-e29b-41d4-a716-446655440002'::uuid,
    'active',
    '2026-04-20'::date
  ),
  -- David enrolled in S5 NCDC (Term II)
  (
    '010e8400-e29b-41d4-a716-446655440003'::uuid,
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    'd10e8400-e29b-41d4-a716-446655440003'::uuid,
    '850e8400-e29b-41d4-a716-446655440002'::uuid,
    '750e8400-e29b-41d4-a716-446655440002'::uuid,
    'active',
    '2026-04-20'::date
  )
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 10. MARKBOOK ENTRIES (GRADES)
-- =====================================================================

-- S1 CBC Grades (Competency-based: 1=Initiating, 2=Progressing, 3=Achieving)
-- Amina's CBC Grades (Mathematics)
INSERT INTO public.markbook_entries (
  id,
  school_id,
  student_id,
  class_id,
  subject_id,
  term_id,
  competency_score,
  observation,
  descriptor
)
VALUES (
  '110e8400-e29b-41d4-a716-446655440001'::uuid,
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  'd10e8400-e29b-41d4-a716-446655440001'::uuid,
  '850e8400-e29b-41d4-a716-446655440001'::uuid,
  '950e8400-e29b-41d4-a716-446655440001'::uuid,
  '750e8400-e29b-41d4-a716-446655440002'::uuid,
  3,
  'Demonstrates exceptional understanding of algebraic concepts. Accurately solves complex equations and explains mathematical reasoning clearly to peers. Actively participates in collaborative problem-solving activities.',
  'Achieving'
)
ON CONFLICT (id) DO NOTHING;

-- Amina's CBC Grades (Geography)
INSERT INTO public.markbook_entries (
  id,
  school_id,
  student_id,
  class_id,
  subject_id,
  term_id,
  competency_score,
  observation,
  descriptor
)
VALUES (
  '110e8400-e29b-41d4-a716-446655440002'::uuid,
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  'd10e8400-e29b-41d4-a716-446655440001'::uuid,
  '850e8400-e29b-41d4-a716-446655440001'::uuid,
  '950e8400-e29b-41d4-a716-446655440002'::uuid,
  '750e8400-e29b-41d4-a716-446655440002'::uuid,
  2,
  'Shows developing competency in geographical analysis. Correctly identifies major landforms and climate patterns but needs support in explaining interconnections. Demonstrates effort in field observation tasks.',
  'Progressing'
)
ON CONFLICT (id) DO NOTHING;

-- John's CBC Grades (Mathematics)
INSERT INTO public.markbook_entries (
  id,
  school_id,
  student_id,
  class_id,
  subject_id,
  term_id,
  competency_score,
  observation,
  descriptor
)
VALUES (
  '110e8400-e29b-41d4-a716-446655440003'::uuid,
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  'd10e8400-e29b-41d4-a716-446655440002'::uuid,
  '850e8400-e29b-41d4-a716-446655440001'::uuid,
  '950e8400-e29b-41d4-a716-446655440001'::uuid,
  '750e8400-e29b-41d4-a716-446655440002'::uuid,
  2,
  'Developing proficiency in mathematical procedures. Completes basic calculations accurately but requires scaffolding for multi-step problems. Shows consistent effort and willingness to learn.',
  'Progressing'
)
ON CONFLICT (id) DO NOTHING;

-- John's CBC Grades (Geography)
INSERT INTO public.markbook_entries (
  id,
  school_id,
  student_id,
  class_id,
  subject_id,
  term_id,
  competency_score,
  observation,
  descriptor
)
VALUES (
  '110e8400-e29b-41d4-a716-446655440004'::uuid,
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  'd10e8400-e29b-41d4-a716-446655440002'::uuid,
  '850e8400-e29b-41d4-a716-446655440001'::uuid,
  '950e8400-e29b-41d4-a716-446655440002'::uuid,
  '750e8400-e29b-41d4-a716-446655440002'::uuid,
  1,
  'Beginning to develop geographical understanding. Requires significant guidance in map interpretation and spatial reasoning. Needs more practice with vocabulary and core concepts.',
  'Initiating'
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- S5 NCDC Grades (Traditional: BOT 10%, MOT 20%, EOT 70%)
-- Calculation Examples:
-- David Physics: BOT=9/10 (90%), MOT=18/20 (90%), EOT=65/70 (93%) => Total = 0.9 + 3.6 + 65.1 = 89.6% => D1
-- David Chemistry: BOT=8/10 (80%), MOT=16/20 (80%), EOT=55/70 (79%) => Total = 0.8 + 3.2 + 55.3 = 59.3% => D5
-- =====================================================================

-- David's NCDC Physics (High performance)
INSERT INTO public.markbook_entries (
  id,
  school_id,
  student_id,
  class_id,
  subject_id,
  term_id,
  bot_score,
  mot_score,
  eot_score,
  total_percentage,
  raw_score,
  grade
)
VALUES (
  '110e8400-e29b-41d4-a716-446655440005'::uuid,
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  'd10e8400-e29b-41d4-a716-446655440003'::uuid,
  '850e8400-e29b-41d4-a716-446655440002'::uuid,
  '950e8400-e29b-41d4-a716-446655440003'::uuid,
  '750e8400-e29b-41d4-a716-446655440002'::uuid,
  9,
  18,
  65,
  89.6,
  90,
  'D1'
)
ON CONFLICT (id) DO NOTHING;

-- David's NCDC Chemistry (Mid-range performance)
INSERT INTO public.markbook_entries (
  id,
  school_id,
  student_id,
  class_id,
  subject_id,
  term_id,
  bot_score,
  mot_score,
  eot_score,
  total_percentage,
  raw_score,
  grade
)
VALUES (
  '110e8400-e29b-41d4-a716-446655440006'::uuid,
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  'd10e8400-e29b-41d4-a716-446655440003'::uuid,
  '850e8400-e29b-41d4-a716-446655440002'::uuid,
  '950e8400-e29b-41d4-a716-446655440004'::uuid,
  '750e8400-e29b-41d4-a716-446655440002'::uuid,
  8,
  16,
  55,
  59.3,
  59,
  'D5'
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 11. ATTENDANCE RECORDS (Optional, for comprehensive testing)
-- =====================================================================
INSERT INTO public.attendance (id, school_id, student_id, class_id, term_id, date, status, marked_by)
VALUES
  -- Amina's attendance
  (
    '120e8400-e29b-41d4-a716-446655440001'::uuid,
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    'd10e8400-e29b-41d4-a716-446655440001'::uuid,
    '850e8400-e29b-41d4-a716-446655440001'::uuid,
    '750e8400-e29b-41d4-a716-446655440002'::uuid,
    '2026-04-21'::date,
    'present',
    'a10e8400-e29b-41d4-a716-446655440001'::uuid
  ),
  (
    '120e8400-e29b-41d4-a716-446655440002'::uuid,
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    'd10e8400-e29b-41d4-a716-446655440001'::uuid,
    '850e8400-e29b-41d4-a716-446655440001'::uuid,
    '750e8400-e29b-41d4-a716-446655440002'::uuid,
    '2026-04-22'::date,
    'present',
    'a10e8400-e29b-41d4-a716-446655440001'::uuid
  ),
  -- John's attendance
  (
    '120e8400-e29b-41d4-a716-446655440003'::uuid,
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    'd10e8400-e29b-41d4-a716-446655440002'::uuid,
    '850e8400-e29b-41d4-a716-446655440001'::uuid,
    '750e8400-e29b-41d4-a716-446655440002'::uuid,
    '2026-04-21'::date,
    'present',
    'a10e8400-e29b-41d4-a716-446655440001'::uuid
  ),
  (
    '120e8400-e29b-41d4-a716-446655440004'::uuid,
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    'd10e8400-e29b-41d4-a716-446655440002'::uuid,
    '850e8400-e29b-41d4-a716-446655440001'::uuid,
    '750e8400-e29b-41d4-a716-446655440002'::uuid,
    '2026-04-22'::date,
    'absent',
    'a10e8400-e29b-41d4-a716-446655440001'::uuid
  ),
  -- David's attendance
  (
    '120e8400-e29b-41d4-a716-446655440005'::uuid,
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    'd10e8400-e29b-41d4-a716-446655440003'::uuid,
    '850e8400-e29b-41d4-a716-446655440002'::uuid,
    '750e8400-e29b-41d4-a716-446655440002'::uuid,
    '2026-04-21'::date,
    'present',
    'a10e8400-e29b-41d4-a716-446655440002'::uuid
  ),
  (
    '120e8400-e29b-41d4-a716-446655440006'::uuid,
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    'd10e8400-e29b-41d4-a716-446655440003'::uuid,
    '850e8400-e29b-41d4-a716-446655440002'::uuid,
    '750e8400-e29b-41d4-a716-446655440002'::uuid,
    '2026-04-22'::date,
    'present',
    'a10e8400-e29b-41d4-a716-446655440002'::uuid
  )
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- COMMIT TRANSACTION
-- =====================================================================
COMMIT;

-- =====================================================================
-- Verification Queries (for testing)
-- Run these manually to verify seed data:
--
-- SELECT COUNT(*) FROM public.schools;
-- SELECT COUNT(*) FROM public.profiles WHERE role = 'teacher';
-- SELECT COUNT(*) FROM public.students;
-- SELECT COUNT(*) FROM public.markbook_entries;
-- SELECT s.first_name, s.last_name, m.competency_score, m.descriptor
--   FROM public.students s
--   LEFT JOIN public.markbook_entries m ON s.id = m.student_id
--  WHERE s.school_id = '550e8400-e29b-41d4-a716-446655440001'::uuid;
-- =====================================================================

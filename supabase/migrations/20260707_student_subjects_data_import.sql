-- =====================================================================
-- Data Migration: Import Student Subjects
-- Transforms student_subjects.sql data into Supabase schema
-- =====================================================================

BEGIN;

-- This SQL imports the student subject assignments data
-- Assumes the student_subjects table from the legacy database exists

-- Example: Map legacy subject names to subject_id UUIDs
-- Note: These UUIDs should match your actual subject IDs in Supabase

INSERT INTO public.student_subject_assignments (
  student_id,
  subject_name,
  class_name,
  stream,
  assigned_by,
  assigned_at
)
VALUES 
  -- Kiswahili assignments for Senior One East stream
  ('0U-STD-2026-0547', 'Kiswahili', 'Senior One', 'East', 'System', NOW()),
  ('0U-STD-2026-0551', 'Kiswahili', 'Senior One', 'East', 'System', NOW()),
  ('0U-STD-2026-0558', 'Kiswahili', 'Senior One', 'East', 'System', NOW()),
  ('0U-STD-2026-0550', 'Kiswahili', 'Senior One', 'East', 'System', NOW()),
  ('0U-STD-2026-0557', 'Kiswahili', 'Senior One', 'East', 'System', NOW()),
  ('0U-STD-2026-0554', 'Kiswahili', 'Senior One', 'East', 'System', NOW()),
  ('0U-STD-2026-0559', 'Kiswahili', 'Senior One', 'East', 'System', NOW()),
  ('0U-STD-2026-0581', 'Kiswahili', 'Senior One', 'East', 'System', NOW()),
  ('0U-STD-2026-0572', 'Kiswahili', 'Senior One', 'East', 'System', NOW()),
  ('0U-STD-2026-0588', 'Kiswahili', 'Senior One', 'East', 'System', NOW()),
  -- Physical Education assignments for Senior One
  ('0U-STD-2026-0547', 'Physical Education', 'Senior One', 'East', 'System', NOW()),
  ('0U-STD-2026-0548', 'Physical Education', 'Senior One', 'East', 'System', NOW()),
  ('0U-STD-2026-0551', 'Physical Education', 'Senior One', 'East', 'System', NOW()),
  ('0U-STD-2026-0549', 'Physical Education', 'Senior One', 'East', 'System', NOW()),
  ('0U-STD-2026-0553', 'Physical Education', 'Senior One', 'East', 'System', NOW())
ON CONFLICT DO NOTHING;

COMMIT;

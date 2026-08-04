-- Migration: create students table with multi-tenant isolation and RLS policies
-- Run with: supabase db push / psql -f ...

-- Optional: ensure schools table exists (remove if already present)
-- CREATE TABLE IF NOT EXISTS public.schools (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   name text NOT NULL,
--   created_at timestamptz DEFAULT now()
-- );

-- Optional: ensure users table has school_id reference (remove if already present)
-- CREATE TABLE IF NOT EXISTS public.users (
--   id uuid PRIMARY KEY,
--   email text UNIQUE,
--   school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE
-- );

CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  admission_number text,
  class_id uuid,
  stream_id uuid,
  status text DEFAULT 'active', -- allowed: active, inactive, graduated
  email text,
  dob date,
  enrolled_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique per-school constraint for email (if present)
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_school_email ON public.students (school_id, lower(email)) WHERE email IS NOT NULL;

-- Optional unique per-school admission number
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_school_adm ON public.students (school_id, lower(admission_number)) WHERE admission_number IS NOT NULL;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.students;
CREATE TRIGGER trg_set_updated_at
BEFORE UPDATE ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Enable Row Level Security and policies
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Policy: allow SELECT only for users within the same school
CREATE POLICY "students_select_same_school" ON public.students
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()::uuid
      AND u.school_id = public.students.school_id
  )
);

-- Policy: allow INSERT only if the authenticated user belongs to the same school (and school_id provided)
CREATE POLICY "students_insert_same_school" ON public.students
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()::uuid
      AND u.school_id = NEW.school_id
  )
);

-- Policy: allow UPDATE only for rows in the same school as the authenticated user
CREATE POLICY "students_update_same_school" ON public.students
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()::uuid
      AND u.school_id = public.students.school_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()::uuid
      AND u.school_id = NEW.school_id
  )
);

-- Policy: allow DELETE only for rows in the same school as the authenticated user
CREATE POLICY "students_delete_same_school" ON public.students
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()::uuid
      AND u.school_id = public.students.school_id
  )
);

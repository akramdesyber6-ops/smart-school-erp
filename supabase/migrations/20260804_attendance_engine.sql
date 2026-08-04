-- Migration: attendance engine (sessions + student attendance + RPC for bulk writes)
-- Run with: supabase db push / psql -f ...

-- Ensure extension for gen_random_uuid if needed
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- attendance_sessions table
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  stream_id uuid REFERENCES public.streams(id) ON DELETE CASCADE,
  date date NOT NULL,
  taken_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_daily_session UNIQUE (school_id, class_id, stream_id, date)
);

-- student_attendance table
CREATE TABLE IF NOT EXISTS public.student_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('present','absent','late','excused')),
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_student_session UNIQUE (session_id, student_id)
);

-- Optional indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_school_date ON public.attendance_sessions (school_id, date);
CREATE INDEX IF NOT EXISTS idx_student_attendance_session_student ON public.student_attendance (session_id, student_id);

-- Enable RLS
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;

-- RLS policy: attendance_sessions - allow select/insert/update/delete only within same school
CREATE POLICY attendance_sessions_select_same_school ON public.attendance_sessions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()::uuid
      AND p.school_id = public.attendance_sessions.school_id
  )
);

CREATE POLICY attendance_sessions_insert_same_school ON public.attendance_sessions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()::uuid
      AND p.school_id = NEW.school_id
  )
);

CREATE POLICY attendance_sessions_update_same_school ON public.attendance_sessions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()::uuid
      AND p.school_id = public.attendance_sessions.school_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()::uuid
      AND p.school_id = NEW.school_id
  )
);

CREATE POLICY attendance_sessions_delete_same_school ON public.attendance_sessions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()::uuid
      AND p.school_id = public.attendance_sessions.school_id
  )
);

-- RLS policy: student_attendance - ensure the related session belongs to the same school as the authenticated user's profile
CREATE POLICY student_attendance_select_same_school ON public.student_attendance
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.attendance_sessions s
    WHERE s.id = public.student_attendance.session_id
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()::uuid
          AND p.school_id = s.school_id
      )
  )
);

CREATE POLICY student_attendance_insert_same_school ON public.student_attendance
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.attendance_sessions s
    WHERE s.id = NEW.session_id
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()::uuid
          AND p.school_id = s.school_id
      )
  )
);

CREATE POLICY student_attendance_update_same_school ON public.student_attendance
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.attendance_sessions s
    WHERE s.id = public.student_attendance.session_id
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()::uuid
          AND p.school_id = s.school_id
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.attendance_sessions s
    WHERE s.id = NEW.session_id
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()::uuid
          AND p.school_id = s.school_id
      )
  )
);

CREATE POLICY student_attendance_delete_same_school ON public.student_attendance
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.attendance_sessions s
    WHERE s.id = public.student_attendance.session_id
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()::uuid
          AND p.school_id = s.school_id
      )
  )
);

-- PL/pgSQL function to save bulk attendance in a single transactional operation
CREATE OR REPLACE FUNCTION public.save_bulk_attendance(
  p_school_id uuid,
  p_class_id uuid,
  p_stream_id uuid,
  p_date date,
  p_taken_by uuid,
  p_records jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_session_id uuid;
  v_rec jsonb;
  v_student_id uuid;
  v_status text;
  v_remarks text;
  v_count int := 0;
BEGIN
  -- Upsert attendance session (insert or update taken_by)
  INSERT INTO public.attendance_sessions (school_id, class_id, stream_id, date, taken_by)
  VALUES (p_school_id, p_class_id, p_stream_id, p_date, p_taken_by)
  ON CONFLICT (school_id, class_id, stream_id, date)
  DO UPDATE SET taken_by = EXCLUDED.taken_by, created_at = COALESCE(attendance_sessions.created_at, now())
  RETURNING id INTO v_session_id;

  -- Loop through records array and upsert student_attendance rows
  FOR v_rec IN SELECT * FROM jsonb_array_elements(p_records) LOOP
    v_student_id := (v_rec->>'student_id')::uuid;
    v_status := (v_rec->>'status')::text;
    v_remarks := NULLIF(v_rec->>'remarks', '')::text;

    -- validate status server-side to avoid bad values
    IF v_status NOT IN ('present','absent','late','excused') THEN
      RAISE EXCEPTION 'invalid status % for student %', v_status, v_student_id;
    END IF;

    INSERT INTO public.student_attendance (session_id, student_id, status, remarks)
    VALUES (v_session_id, v_student_id, v_status, v_remarks)
    ON CONFLICT (session_id, student_id)
    DO UPDATE SET status = EXCLUDED.status, remarks = EXCLUDED.remarks;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('session_id', v_session_id, 'processed', v_count);
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

// src/lib/supabase/api.ts
// Strongly-typed Supabase API client wrapper and helper query functions

import { supabase } from '@/lib/supabase/client';
export { supabase };

// ----------------------
// Types
// ----------------------
export type ClassRow = {
  id: string;
  name: string;
  stream?: string | null;
  school_id: string;
};

export type SubjectRow = {
  id: string;
  name: string;
  code?: string | null;
  school_id: string;
};

export type EnrollmentRow = {
  id: string;
  student_id: string;
  class_id: string;
  term_id: string;
  school_id: string;
  status?: string | null;
};

export type MarkbookEntryRow = {
  id: string;
  student_id: string;
  class_id: string;
  subject_id: string;
  raw_score: number | null;
  grade?: string | null;
  descriptor?: string | null; // CBC descriptor
  school_id: string;
};

// ----------------------
// Score mapping helpers
// ----------------------
export function mapRawScoreToUgandanDivision(score: number | null): string | null {
  if (score === null || typeof score !== 'number' || isNaN(score)) return null;

  // Traditional Ugandan divisions (adjust thresholds as your policy requires)
  if (score >= 75) return 'Division I';
  if (score >= 60) return 'Division II';
  if (score >= 45) return 'Division III';
  if (score >= 35) return 'Division IV';
  return 'Fail';
}

export function mapRawScoreToCBCDescriptor(score: number | null): string | null {
  if (score === null || typeof score !== 'number' || isNaN(score)) return null;

  // CBC descriptors mapped from a 0-100 score (tunable)
  if (score >= 70) return 'Achieving';
  if (score >= 40) return 'Progressing';
  return 'Initiating';
}

// ----------------------
// API functions
// ----------------------

// Fetch classes and their linked subjects for the current school (as set in JWT claims). Returns lightweight objects.
export async function getClassesAndSubjectsForCurrentSchool() {
  try {
    // join classes -> class_subjects -> subjects (assumes a join table exists named class_subjects)
    const { data, error } = await supabase
      .from('classes')
      .select(`
        id,
        name,
        stream,
        school_id,
        class_subjects(subjects(id,name,code,school_id))
      `)
      .order('name', { ascending: true });

    if (error) throw error;

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err.message || String(err), original: err } };
  }
}

// Get enrollment roster for a specific term and class stream (class_id or stream identifier)
export async function getEnrollmentRoster(termId: string, classIdOrStream: string) {
  try {
    const isClassId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(classIdOrStream);
    let query = supabase
      .from('enrollments')
      .select('id, student_id, class_id, term_id, school_id, status, students!inner(id,first_name,last_name,registration_number), classes!inner(stream)')
      .eq('term_id', termId);

    if (isClassId) {
      query = query.eq('class_id', classIdOrStream);
    } else {
      query = query.eq('classes.stream', classIdOrStream);
    }

    const { data, error } = await query.order('status', { ascending: true });
    if (error) throw error;

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err.message || String(err), original: err } };
  }
}

// Get markbook entries for a class + term (optionally filtered by subject). Maps scores to divisions/descriptors.
export async function getMarkbookEntries({ classId, termId, subjectId }: { classId: string; termId?: string; subjectId?: string }) {
  try {
    let query = supabase
      .from('markbook_entries')
      .select('id, student_id, class_id, subject_id, raw_score, grade, descriptor, school_id')
      .eq('class_id', classId);

    if (termId) query = query.eq('term_id', termId);
    if (subjectId) query = query.eq('subject_id', subjectId);

    const { data, error } = await query.order('student_id', { ascending: true });
    if (error) throw error;

    // Map computed fields client-side to avoid RLS complexity inside DB functions
    const enriched = (data || []).map((row: MarkbookEntryRow) => ({
      ...row,
      computed_division: mapRawScoreToUgandanDivision(row.raw_score ?? null),
      computed_cbc_descriptor: mapRawScoreToCBCDescriptor(row.raw_score ?? null),
    }));

    return { data: enriched, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err.message || String(err), original: err } };
  }
}

// Export default for convenience
export default {
  supabase,
  getClassesAndSubjectsForCurrentSchool,
  getEnrollmentRoster,
  getMarkbookEntries,
};

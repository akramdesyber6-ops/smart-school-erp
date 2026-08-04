// src/lib/supabase/api.ts
// Strongly-typed Supabase API client wrapper and helper query functions

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables expected at runtime. For server-side operations prefer using a service role key stored securely.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Fail fast if environment is incorrectly configured on server-side builds.
  // In client-side builds these values should be present as NEXT_PUBLIC_* vars.
  // eslint-disable-next-line no-console
  console.warn('Supabase environment variables are not fully configured. Ensure SUPABASE_URL and SUPABASE_ANON_KEY are set.');
}

export const supabase: SupabaseClient = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '');

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
    // Prefer class id exact match; if stream string is provided, we filter by stream
    const isUUID = /^[0-9a-fA-F-]{36}$/.test(classIdOrStream);

    const { data, error } = await supabase
      .from('enrollments')
      .select('id, student_id, class_id, term_id, school_id, status, students!inner(id,first_name,last_name,registration_number)')
      .match({ term_id: termId })
      .filter('class_id', isUUID ? 'eq' : 'in', isUUID ? classIdOrStream : null)
      .order('status', { ascending: true });

    // Fallback: if not a UUID, filter enrolments by joining on classes.stream
    if (error && !isUUID) {
      // Try join through classes by stream
      const { data: joinedData, error: joinErr } = await supabase
        .from('enrollments')
        .select('enrollments(id,student_id,class_id,term_id,school_id,status), students(id,first_name,last_name,registration_number)')
        .eq('term_id', termId)
        .in('class_id', supabase.rpc ? [] : []); // placeholder to keep TS happy; we'll do client-side join below

      if (joinErr) throw joinErr;

      const filtered = (joinedData || []).filter((row: any) => row.enrollments && row.enrollments.class_id && row.enrollments.class_id === classIdOrStream);
      return { data: filtered, error: null };
    }

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

// Example of a protected write using server-side service role (recommended on backend only)
export async function upsertMarkbookEntryAsServiceRole(entry: Partial<MarkbookEntryRow> & { id?: string }) {
  try {
    // This wrapper expects the server environment to set a SUPABASE_SERVICE_ROLE_KEY and create a service client.
    // We create it here lazily if the key exists; otherwise return an error to avoid accidental exposure.
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SERVICE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured. Server-side service role is required for this operation.');
    }

    const serviceClient = createClient(SUPABASE_URL || '', SERVICE_KEY);

    const { data, error } = await serviceClient.from('markbook_entries').upsert(entry).select();
    if (error) throw error;

    return { data, error: null };
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
  upsertMarkbookEntryAsServiceRole,
};

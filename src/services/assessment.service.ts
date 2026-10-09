/**
 * Supabase Service Layer for Assessment Management
 * Handles all database operations for marks entry, report cards, and student assessments
 * Production-grade with full error handling and type safety
 */

import { supabase } from '@/lib/supabase/client';
import {
  Student,
  AssessmentType,
  GradeScale,
  StudentGradeReport,
  SubjectAssessment,
} from '@/types/assessment';

/**
 * Database schema types for type-safe queries
 */
export interface StudentRecord {
  id: string;
  first_name: string;
  last_name: string;
  registration_number: string;
  stream: string | null;
  class_name: string;
}

export interface AssessmentRecord {
  id: string;
  student_id: string;
  subject_id: string;
  term_id: string;
  school_id: string;
  assessment_type: AssessmentType;
  score: GradeScale;
  teacher_initials: string;
  recorded_by: string; // user_id of teacher
  created_at: string;
  updated_at: string;
}

export interface SubjectRecord {
  id: string;
  name: string;
  code: string;
  description: string | null;
}

export interface TermRecord {
  id: string;
  name: string;
  year: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface ClassRecord {
  id: string;
  name: string;
  year_group: string;
}

/**
 * Custom error type for consistent error handling
 */
export class AssessmentServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AssessmentServiceError';
  }
}

/**
 * ============================================================
 * MARKS ENTRY SERVICE
 * ============================================================
 */

export interface SaveMarksInput {
  assessmentType: AssessmentType;
  subjectId: string;
  termId: string;
  classId: string;
  marks: Array<{
    studentId: string;
    score: GradeScale;
  }>;
  teacherId: string;
  teacherInitials: string;
}

export interface SaveMarksResult {
  success: boolean;
  savedCount: number;
  failedCount: number;
  error?: string;
}

/**
 * Save or update assessment marks in bulk using atomic upsert
 * Uses composite key: (student_id, subject_id, term_id, assessment_type)
 */
export async function saveAssessmentMarks(
  input: SaveMarksInput
): Promise<SaveMarksResult> {
  try {
    // Validate inputs
    if (!input.marks || input.marks.length === 0) {
      throw new AssessmentServiceError('No marks provided', 'EMPTY_MARKS');
    }

    if (!input.subjectId || !input.termId || !input.classId) {
      throw new AssessmentServiceError(
        'Missing required context: subjectId, termId, or classId',
        'MISSING_CONTEXT'
      );
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      throw new AssessmentServiceError(
        `Unable to verify the current user: ${authError.message}`,
        'AUTHENTICATION_FAILED',
        authError
      );
    }
    if (!user || input.teacherId !== user.id) {
      throw new AssessmentServiceError('Only the signed-in teacher can save marks.', 'UNAUTHORIZED');
    }

    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('school_id')
      .eq('id', input.classId)
      .single();
    if (classError) {
      throw new AssessmentServiceError(
        `Unable to load the assigned class: ${classError.message}`,
        'CLASS_LOOKUP_FAILED',
        classError
      );
    }

    // Transform marks to database format
    const recordsToUpsert: Partial<AssessmentRecord>[] = input.marks
      .filter((mark) => mark.score !== undefined && mark.score !== null)
      .map((mark) => ({
        student_id: mark.studentId,
        subject_id: input.subjectId,
        term_id: input.termId,
        school_id: classData.school_id,
        assessment_type: input.assessmentType,
        score: mark.score,
        teacher_initials: input.teacherInitials,
        recorded_by: user.id,
        updated_at: new Date().toISOString(),
      }));

    if (recordsToUpsert.length === 0) {
      throw new AssessmentServiceError(
        'No valid marks to save (all scores are null/undefined)',
        'NO_VALID_MARKS'
      );
    }

    // Execute atomic upsert with composite key constraint
    const { data, error } = await supabase
      .from('student_assessments')
      .upsert(recordsToUpsert, {
        onConflict: 'student_id,subject_id,term_id,assessment_type',
      })
      .select();

    if (error) {
      throw new AssessmentServiceError(
        `Failed to save marks: ${error.message}`,
        'UPSERT_FAILED',
        error
      );
    }

    const savedCount = data?.length || 0;
    const failedCount = input.marks.length - savedCount;

    return {
      success: true,
      savedCount,
      failedCount,
    };
  } catch (error) {
    if (error instanceof AssessmentServiceError) {
      return {
        success: false,
        savedCount: 0,
        failedCount: input.marks.length,
        error: error.message,
      };
    }

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Unexpected error saving marks:', errorMessage);

    return {
      success: false,
      savedCount: 0,
      failedCount: input.marks.length,
      error: errorMessage,
    };
  }
}

/**
 * Fetch all students in a class, ordered by stream and name
 */
export async function getClassStudents(classId: string): Promise<Student[]> {
  try {
    const { data, error } = await supabase
      .from('classes')
      .select('school_id')
      .eq('id', classId)
      .single();

    if (error) {
      throw new AssessmentServiceError(
        `Failed to fetch class: ${error.message}`,
        'FETCH_CLASS_FAILED',
        error
      );
    }

    const { data: roster, error: rosterError } = await supabase
      .from('enrollments')
      .select('students!inner(id, first_name, last_name, registration_number), classes!inner(stream)')
      .eq('class_id', classId)
      .eq('school_id', data.school_id)
      .eq('status', 'active')
      .order('students.last_name', { ascending: true });

    if (rosterError) {
      throw new AssessmentServiceError(
        `Failed to fetch class students: ${rosterError.message}`,
        'FETCH_STUDENTS_FAILED',
        rosterError
      );
    }

    return (roster || []).map((record: any) => ({
      id: record.students.id,
      firstName: record.students.first_name,
      lastName: record.students.last_name,
      stream: record.classes.stream ?? '',
      class: classId,
      admissionNumber: record.students.registration_number,
    }));
  } catch (error) {
    if (error instanceof AssessmentServiceError) {
      throw error;
    }
    throw new AssessmentServiceError(
      'Unexpected error fetching students',
      'UNKNOWN_ERROR',
      error
    );
  }
}

/**
 * Fetch existing marks for a specific assessment period
 * Returns a Map for O(1) lookup during dashboard rendering
 */
export async function getAssessmentMarks(input: {
  subjectId: string;
  termId: string;
  assessmentType: AssessmentType;
  classId: string;
}): Promise<Map<string, GradeScale>> {
  try {
    // First get all students in the class
    const students = await getClassStudents(input.classId);
    const studentIds = students.map((s) => s.id);

    if (studentIds.length === 0) {
      console.warn(`No students found in class ${input.classId}`);
      return new Map();
    }

    // Fetch assessments for these students
    const { data, error } = await supabase
      .from('student_assessments')
      .select('student_id, score')
      .eq('subject_id', input.subjectId)
      .eq('term_id', input.termId)
      .eq('assessment_type', input.assessmentType)
      .in('student_id', studentIds);

    if (error) {
      throw new AssessmentServiceError(
        `Failed to fetch assessment marks: ${error.message}`,
        'FETCH_MARKS_FAILED',
        error
      );
    }

    // Build map of student_id -> score for O(1) lookup
    const marksMap = new Map<string, GradeScale>();
    (data || []).forEach((record: Pick<AssessmentRecord, 'student_id' | 'score'>) => {
      if (record.score !== null && record.score !== undefined) {
        marksMap.set(record.student_id, record.score);
      }
    });

    return marksMap;
  } catch (error) {
    if (error instanceof AssessmentServiceError) {
      throw error;
    }
    throw new AssessmentServiceError(
      'Unexpected error fetching marks',
      'UNKNOWN_ERROR',
      error
    );
  }
}

/**
 * ============================================================
 * REPORT CARD SERVICE
 * ============================================================
 */

/**
 * Fetch all assessments for a student across all subjects in a term
 * Aggregates into complete StudentGradeReport
 */
export async function getStudentGradeReport(
  studentId: string,
  termId: string
): Promise<StudentGradeReport | null> {
  try {
    // Validate inputs
    if (!studentId || !termId) {
      throw new AssessmentServiceError(
        'Missing studentId or termId',
        'MISSING_PARAMS'
      );
    }

    // Resolve class membership through the term-specific enrollment relationship.
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('id, school_id, first_name, last_name, registration_number, schools!inner(name, location, email, phone)')
      .eq('id', studentId)
      .single();

    if (studentError) {
      if (studentError.code === 'PGRST116') {
        throw new AssessmentServiceError(
          `Student not found: ${studentId}`,
          'STUDENT_NOT_FOUND'
        );
      }
      throw new AssessmentServiceError(
        `Failed to fetch student: ${studentError.message}`,
        'FETCH_STUDENT_FAILED',
        studentError
      );
    }
    const schoolData = Array.isArray(studentData.schools)
      ? studentData.schools[0]
      : studentData.schools;
    if (!schoolData) {
      throw new AssessmentServiceError(
        'The student record is not linked to a school profile.',
        'SCHOOL_NOT_FOUND'
      );
    }

    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('classes!inner(name, stream)')
      .eq('student_id', studentId)
      .eq('term_id', termId)
      .eq('school_id', studentData.school_id)
      .order('enrollment_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (enrollmentError) {
      throw new AssessmentServiceError(
        `Failed to fetch student enrollment: ${enrollmentError.message}`,
        'FETCH_ENROLLMENT_FAILED',
        enrollmentError
      );
    }
    const enrollmentClass = Array.isArray(enrollmentData?.classes)
      ? enrollmentData.classes[0]
      : enrollmentData?.classes;

    // Fetch term info
    const { data: termData, error: termError } = await supabase
      .from('academic_terms')
      .select('id, school_id, name, academic_years!inner(year)')
      .eq('id', termId)
      .single();

    if (termError) {
      if (termError.code === 'PGRST116') {
        throw new AssessmentServiceError(
          `Term not found: ${termId}`,
          'TERM_NOT_FOUND'
        );
      }
      throw new AssessmentServiceError(
        `Failed to fetch term: ${termError.message}`,
        'FETCH_TERM_FAILED',
        termError
      );
    }
    if (!termData) {
      throw new AssessmentServiceError(`Term not found: ${termId}`, 'TERM_NOT_FOUND');
    }
    if (termData.school_id !== studentData.school_id) {
      throw new AssessmentServiceError(
        'The selected academic term does not belong to the student’s school.',
        'TERM_SCHOOL_MISMATCH'
      );
    }
    const academicYear = Array.isArray(termData.academic_years)
      ? termData.academic_years[0]
      : termData.academic_years;

    // Build student object
    const student: Student = {
      id: studentData.id,
      firstName: studentData.first_name,
      lastName: studentData.last_name,
      stream: enrollmentClass?.stream ?? '',
      class: enrollmentClass?.name ?? '',
      admissionNumber: studentData.registration_number,
    };

    // Fetch all assessments for this student in the term
    const { data: assessmentData, error: assessmentError } = await supabase
      .from('student_assessments')
      .select('*, subjects!inner(name, code, description)')
      .eq('student_id', studentId)
      .eq('term_id', termId)
      .eq('school_id', studentData.school_id)
      .order('subject_id', { ascending: true });

    if (assessmentError) {
      throw new AssessmentServiceError(
        `Failed to fetch assessments: ${assessmentError.message}`,
        'FETCH_ASSESSMENTS_FAILED',
        assessmentError
      );
    }

    // Group assessments by subject
    const subjectMap = new Map<string, SubjectAssessment>();

    (assessmentData || []).forEach((assessment: any) => {
      const subjectId = assessment.subject_id;
      const subjectInfo = assessment.subjects as any;

      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, {
          subjectId,
          subjectName: subjectInfo?.name || 'Unknown Subject',
          teacherInitials: assessment.teacher_initials || '—',
          aoiKey: subjectInfo?.description || undefined,
        });
      }

      const subject = subjectMap.get(subjectId)!;

      // Populate assessment type scores
      switch (assessment.assessment_type) {
        case 'AOI1':
          subject.aoi1Score = assessment.score ?? undefined;
          break;
        case 'AOI2':
          subject.aoi2Score = assessment.score ?? undefined;
          break;
        case 'AOI3':
          subject.aoi3Score = assessment.score ?? undefined;
          break;
        case 'EOT':
          subject.eotScore = assessment.score ?? undefined;
          break;
      }
    });

    const subjects = Array.from(subjectMap.values());

    if (subjects.length === 0) {
      console.warn(
        `No assessments found for student ${studentId} in term ${termId}`
      );
    }

    const report: StudentGradeReport = {
      student,
      school: {
        name: schoolData.name,
        location: schoolData.location,
        contactEmail: schoolData.email,
        contactPhone: schoolData.phone,
      },
      class: student.class,
      term: termData.name,
      academicYear: String(academicYear.year),
      subjects,
      reportDate: new Date().toISOString().split('T')[0],
    };

    return report;
  } catch (error) {
    if (error instanceof AssessmentServiceError) {
      console.error(`Assessment service error: [${error.code}] ${error.message}`);
      throw error;
    }

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Unexpected error fetching grade report:', errorMessage);
    throw new AssessmentServiceError(
      errorMessage,
      'UNKNOWN_ERROR',
      error
    );
  }
}

export async function getCurrentTermForStudent(studentId: string): Promise<string | null> {
  if (!studentId) {
    throw new AssessmentServiceError('Missing studentId', 'MISSING_PARAMS');
  }

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('school_id')
    .eq('id', studentId)
    .single();
  if (studentError) {
    throw new AssessmentServiceError(
      `Failed to load student school: ${studentError.message}`,
      'FETCH_STUDENT_FAILED',
      studentError
    );
  }

  const { data: terms, error: termsError } = await supabase
    .from('academic_terms')
    .select('id, is_current, start_date')
    .eq('school_id', student.school_id)
    .order('start_date', { ascending: false });
  if (termsError) {
    throw new AssessmentServiceError(
      `Failed to fetch academic terms: ${termsError.message}`,
      'FETCH_TERMS_FAILED',
      termsError
    );
  }

  return terms?.find((term) => term.is_current)?.id ?? terms?.[0]?.id ?? null;
}

/**
 * ============================================================
 * REFERENCE DATA SERVICE
 * ============================================================
 */

/**
 * Fetch all active terms (cached)
 */
export async function getActiveTerms(): Promise<TermRecord[]> {
  try {
    const { data, error } = await supabase
      .from('academic_terms')
      .select('id, name, start_date, end_date, is_current, academic_years!inner(year)')
      .order('start_date', { ascending: false })
      .order('name', { ascending: true });

    if (error) {
      throw new AssessmentServiceError(
        `Failed to fetch terms: ${error.message}`,
        'FETCH_TERMS_FAILED',
        error
      );
    }

    return (data || []).map((term: any) => ({
      id: term.id,
      name: term.name,
      year: term.academic_years.year,
      start_date: term.start_date,
      end_date: term.end_date,
      is_active: term.is_current,
    }));
  } catch (error) {
    if (error instanceof AssessmentServiceError) {
      throw error;
    }
    throw new AssessmentServiceError(
      'Unexpected error fetching terms',
      'UNKNOWN_ERROR',
      error
    );
  }
}

/**
 * Fetch all subjects with competency descriptions
 */
export async function getSubjects(): Promise<SubjectRecord[]> {
  try {
    const { data, error } = await supabase
      .from('subjects')
      .select('id, name, code, description')
      .order('name', { ascending: true });

    if (error) {
      throw new AssessmentServiceError(
        `Failed to fetch subjects: ${error.message}`,
        'FETCH_SUBJECTS_FAILED',
        error
      );
    }

    return data || [];
  } catch (error) {
    if (error instanceof AssessmentServiceError) {
      throw error;
    }
    throw new AssessmentServiceError(
      'Unexpected error fetching subjects',
      'UNKNOWN_ERROR',
      error
    );
  }
}

/**
 * Fetch all classes
 */
export async function getClasses(): Promise<ClassRecord[]> {
  try {
    const { data, error } = await supabase
      .from('classes')
      .select('id, name, form_level')
      .order('form_level', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      throw new AssessmentServiceError(
        `Failed to fetch classes: ${error.message}`,
        'FETCH_CLASSES_FAILED',
        error
      );
    }

    return (data || []).map((classRow: any) => ({
      id: classRow.id,
      name: classRow.name,
      year_group: String(classRow.form_level),
    }));
  } catch (error) {
    if (error instanceof AssessmentServiceError) {
      throw error;
    }
    throw new AssessmentServiceError(
      'Unexpected error fetching classes',
      'UNKNOWN_ERROR',
      error
    );
  }
}

/**
 * ============================================================
 * VERIFICATION SERVICE (Module 3)
 * ============================================================
 */

export interface VerificationRecord {
  id: string;
  student_id: string;
  report_date: string;
  verification_token: string;
  verified_at: string | null;
  verified_by: string | null;
  is_valid: boolean;
}

/**
 * Create or retrieve verification token for a report card
 */
export async function getVerificationToken(
  studentId: string,
  termId: string,
  reportDate: string
): Promise<string | null> {
  try {
    if (!studentId || !termId || !reportDate) {
      throw new AssessmentServiceError(
        'Missing studentId, termId, or reportDate',
        'MISSING_PARAMS'
      );
    }

    // Check if verification already exists
    const { data: existingToken, error: checkError } = await supabase
      .from('report_verifications')
      .select('verification_token')
      .eq('student_id', studentId)
      .eq('term_id', termId)
      .eq('report_date', reportDate)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw new AssessmentServiceError(
        `Failed to check verification: ${checkError.message}`,
        'CHECK_VERIFICATION_FAILED',
        checkError
      );
    }

    if (existingToken) {
      return existingToken.verification_token;
    }

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('school_id')
      .eq('id', studentId)
      .single();
    if (studentError) {
      throw new AssessmentServiceError(
        `Failed to load student school: ${studentError.message}`,
        'FETCH_STUDENT_FAILED',
        studentError
      );
    }

    // Generate new verification token
    const token = generateVerificationToken();

    const { error: insertError } = await supabase
      .from('report_verifications')
      .insert({
        student_id: studentId,
        term_id: termId,
        school_id: student.school_id,
        report_date: reportDate,
        verification_token: token,
        is_valid: true,
      });

    if (insertError) {
      throw new AssessmentServiceError(
        `Failed to create verification: ${insertError.message}`,
        'CREATE_VERIFICATION_FAILED',
        insertError
      );
    }

    return token;
  } catch (error) {
    if (error instanceof AssessmentServiceError) {
      throw error;
    }
    throw new AssessmentServiceError(
      'Unexpected error generating verification token',
      'UNKNOWN_ERROR',
      error
    );
  }
}

/**
 * Verify a report card via QR code token
 */
export async function verifyReportCard(token: string): Promise<{
  isValid: boolean;
  studentId?: string;
  reportDate?: string;
  verifiedAt?: string;
  error?: string;
}> {
  try {
      const { data, error } = await supabase.rpc('verify_report_card', { p_token: token });

      if (error) {
        throw new AssessmentServiceError(
        `Failed to verify report: ${error.message}`,
        'VERIFY_REPORT_FAILED',
        error
      );
    }

    const verification = data?.[0];
    if (!verification?.is_valid) {
      return { isValid: false, error: 'Invalid or expired verification token' };
    }

    return {
      isValid: true,
      reportDate: verification.report_date,
    };
  } catch (error) {
    if (error instanceof AssessmentServiceError) {
      throw error;
    }
    throw new AssessmentServiceError(
      'Verification failed',
      'UNKNOWN_ERROR',
      error
    );
  }
}

/**
 * Generate a cryptographically secure verification token
 */
function generateVerificationToken(): string {
  const randomBytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * ============================================================
 * BULK EXPORT SERVICE
 * ============================================================
 */

export interface BulkExportOptions {
  format: 'csv' | 'json';
  classId: string;
  termId: string;
  assessmentType: AssessmentType;
  subjectId: string;
}

export interface ExportResult {
  success: boolean;
  data: string;
  mimeType: string;
  filename: string;
  error?: string;
}

/**
 * Export assessment data in CSV or JSON format
 */
export async function exportAssessmentData(
  options: BulkExportOptions
): Promise<ExportResult> {
  try {
    // Fetch all relevant data
    const students = await getClassStudents(options.classId);
    const marksMap = await getAssessmentMarks({
      subjectId: options.subjectId,
      termId: options.termId,
      assessmentType: options.assessmentType,
      classId: options.classId,
    });

    const timestamp = new Date().toISOString().split('T')[0];

    if (options.format === 'csv') {
      const csvData = exportAsCSV(students, marksMap);
      return {
        success: true,
        data: csvData,
        mimeType: 'text/csv',
        filename: `marks-${options.assessmentType}-${timestamp}.csv`,
      };
    } else if (options.format === 'json') {
      const jsonData = exportAsJSON(students, marksMap);
      return {
        success: true,
        data: jsonData,
        mimeType: 'application/json',
        filename: `marks-${options.assessmentType}-${timestamp}.json`,
      };
    }

    throw new AssessmentServiceError(
      'Unsupported export format',
      'UNSUPPORTED_FORMAT'
    );
  } catch (error) {
    if (error instanceof AssessmentServiceError) {
      return {
        success: false,
        data: '',
        mimeType: '',
        filename: '',
        error: error.message,
      };
    }

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      success: false,
      data: '',
      mimeType: '',
      filename: '',
      error: errorMessage,
    };
  }
}

function exportAsCSV(
  students: Student[],
  marksMap: Map<string, GradeScale>
): string {
  const rows: string[] = [];
  rows.push('Student ID,First Name,Last Name,Stream,Score');

  students.forEach((student) => {
    const score = marksMap.get(student.id);
    const scoreStr = score !== undefined ? String(score) : '';
    rows.push(
      `"${student.id}","${student.firstName}","${student.lastName}","${student.stream}","${scoreStr}"`
    );
  });

  return rows.join('\n');
}

function exportAsJSON(
  students: Student[],
  marksMap: Map<string, GradeScale>
): string {
  const data = students.map((student) => ({
    studentId: student.id,
    firstName: student.firstName,
    lastName: student.lastName,
    stream: student.stream,
    score: marksMap.get(student.id) ?? null,
  }));

  return JSON.stringify(data, null, 2);
}

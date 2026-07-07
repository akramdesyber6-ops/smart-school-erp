/**
 * Assessment Data Models
 * Strictly typed interfaces for the CBC Smart School ERP assessment system
 * Supporting 0-3 grading scale for AOI and EOT assessments
 */

export type GradeScale = 0 | 1 | 2 | 3 | number; // Allows decimals like 2.1, 1.5, 3.0

export type AssessmentType = 'AOI1' | 'AOI2' | 'AOI3' | 'EOT';

export type AlphaGrade = 'A' | 'B' | 'C' | 'D' | 'E';

export type AchievementLevel = 'Excellent' | 'Very Good' | 'Good' | 'Fair' | 'Below Average';

/**
 * Student profile information
 */
export interface Student {
  id: string; // OU-STD-2026-XXXX format
  firstName: string;
  lastName: string;
  stream: 'East' | 'West' | 'North' | 'South';
  class: string; // e.g., "Senior One"
  admissionNumber?: string;
  photoUrl?: string;
}

/**
 * Assessment score for a single subject
 */
export interface SubjectAssessment {
  subjectId: string;
  subjectName: string;
  teacherInitials: string;
  aoi1Score?: GradeScale; // 0-3
  aoi2Score?: GradeScale;
  aoi3Score?: GradeScale;
  eotScore?: GradeScale;
  subjectAverage?: GradeScale;
  outOf20?: number; // Calculated equivalent
  alphaGrade?: AlphaGrade;
  aoiKey?: string; // Description of competency
}

/**
 * Complete grade report for a student
 */
export interface StudentGradeReport {
  student: Student;
  class: string;
  term: string; // e.g., "Term 1 2026"
  academicYear: string;
  subjects: SubjectAssessment[];
  overallAverage?: GradeScale;
  finalGrade?: AlphaGrade;
  achievementLevel?: AchievementLevel;
  classTeacherComment?: string;
  headteacherComment?: string;
  classTeacherInitials?: string;
  headteacherInitials?: string;
  reportDate?: string;
}

/**
 * Marks entry session state
 */
export interface MarksEntrySession {
  class: string;
  subject: string;
  term: string;
  students: Student[];
  assessmentType: AssessmentType;
  scores: Record<string, GradeScale>; // studentId -> score
  completionCount: number;
  totalCount: number;
}

/**
 * Grade scale mapping for alpha grade conversion
 */
export interface GradeRangeMapping {
  alphaGrade: AlphaGrade;
  minScore: GradeScale;
  maxScore: GradeScale;
  achievementLevel: AchievementLevel;
  description: string;
}

/**
 * School information for report cards
 */
export interface SchoolProfile {
  name: string;
  location: string;
  motto: string;
  contactEmail: string;
  contactPhone: string;
  logoUrl?: string;
  letterheadBgColor?: string; // Tailwind class
}

/**
 * Verification payload for QR code
 */
export interface VerificationPayload {
  studentId: string;
  reportDate: string;
  verificationToken?: string;
}

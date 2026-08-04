// src/lib/services/calculations.ts
// Business logic calculations for attendance, grades, fees

import { 
  GradingScaleRow, 
  AttendanceRecordRow,
  MarkbookEntryRow,
} from '@/lib/supabase/types';

/**
 * Calculate attendance percentage from attendance records
 */
export function calculateAttendancePercentage(
  records: AttendanceRecordRow[]
): number {
  if (records.length === 0) return 0;

  const presentDays = records.filter((r) => r.status === 'present').length;
  const excusedDays = records.filter((r) => r.status === 'excused').length;

  // Excused days typically count as present
  const effectivePresentDays = presentDays + excusedDays;
  const percentage = (effectivePresentDays / records.length) * 100;

  return Math.round(percentage * 100) / 100;
}

/**
 * Calculate grade from raw score based on grading scale
 */
export function calculateGradeFromScore(
  rawScore: number | null,
  gradingScale: GradingScaleRow[]
): {
  grade: string | null;
  gradePoints: number | null;
} {
  if (rawScore === null || gradingScale.length === 0) {
    return { grade: null, gradePoints: null };
  }

  // Sort grading scale by min_score descending for proper matching
  const sorted = [...gradingScale].sort((a, b) => b.min_score - a.min_score);

  const gradeEntry = sorted.find(
    (scale) => rawScore >= scale.min_score && rawScore <= scale.max_score
  );

  if (!gradeEntry) {
    return { grade: null, gradePoints: null };
  }

  return {
    grade: gradeEntry.grade,
    gradePoints: gradeEntry.grade_points,
  };
}

/**
 * Calculate average score from multiple marks
 */
export function calculateAverageScore(marks: MarkbookEntryRow[]): number {
  if (marks.length === 0) return 0;

  const validMarks = marks.filter((m) => m.raw_score !== null);
  if (validMarks.length === 0) return 0;

  const sum = validMarks.reduce((total, m) => total + (m.raw_score || 0), 0);
  const average = sum / validMarks.length;

  return Math.round(average * 100) / 100;
}

/**
 * Count passed subjects (marks >= passing marks)
 */
export function countPassedSubjects(
  marks: MarkbookEntryRow[],
  passingMarks: number[]
): number {
  if (marks.length === 0) return 0;

  let passCount = 0;
  marks.forEach((mark, index) => {
    if (mark.raw_score !== null && mark.raw_score >= (passingMarks[index] || 40)) {
      passCount++;
    }
  });

  return passCount;
}

/**
 * Determine fee payment status based on balance
 */
export function determineFeeStatus(
  totalFees: number,
  amountPaid: number,
  dueDate?: string
): 'paid' | 'pending' | 'partial' | 'overdue' {
  if (amountPaid >= totalFees) {
    return 'paid';
  }

  if (amountPaid === 0) {
    // Check if overdue
    if (dueDate && new Date(dueDate) < new Date()) {
      return 'overdue';
    }
    return 'pending';
  }

  // Partial payment
  if (dueDate && new Date(dueDate) < new Date()) {
    return 'overdue';
  }

  return 'partial';
}

/**
 * Calculate performance category based on average score
 */
export function getPerformanceCategory(
  averageScore: number
): 'excellent' | 'very_good' | 'good' | 'fair' | 'poor' {
  if (averageScore >= 85) return 'excellent';
  if (averageScore >= 75) return 'very_good';
  if (averageScore >= 65) return 'good';
  if (averageScore >= 50) return 'fair';
  return 'poor';
}

/**
 * Calculate promotion/retention status
 */
export function getPromotionStatus(
  averageScore: number,
  subjectsPassed: number,
  totalSubjects: number,
  passingPercentage: number = 50
): 'promoted' | 'retained' | 'conditional' {
  const passPercentage = (subjectsPassed / totalSubjects) * 100;

  if (averageScore >= 50 && passPercentage >= passingPercentage) {
    return 'promoted';
  }

  if (averageScore >= 40 && passPercentage >= passingPercentage - 10) {
    return 'conditional';
  }

  return 'retained';
}

/**
 * Calculate late students (those absent frequently)
 */
export function identifyAtRiskStudents(
  attendancePercentage: number,
  threshold: number = 75
): boolean {
  return attendancePercentage < threshold;
}

/**
 * Calculate term dates info
 */
export function getTermDaysRemaining(
  startDate: string,
  endDate: string
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();

  if (today > end) return 0;
  if (today < start) return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Validate if a score is within exam total marks
 */
export function isValidScore(
  rawScore: number,
  totalMarks: number
): boolean {
  return rawScore >= 0 && rawScore <= totalMarks;
}

/**
 * Calculate weighted average (for subjects with different weights)
 */
export function calculateWeightedAverage(
  scores: { score: number; weight: number }[]
): number {
  if (scores.length === 0) return 0;

  const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight === 0) return 0;

  const weightedSum = scores.reduce((sum, s) => sum + s.score * s.weight, 0);
  const average = weightedSum / totalWeight;

  return Math.round(average * 100) / 100;
}

/**
 * Calculate GPA from multiple grades
 */
export function calculateGPA(gradePoints: (number | null)[]): number {
  const validPoints = gradePoints.filter((p) => p !== null) as number[];
  if (validPoints.length === 0) return 0;

  const sum = validPoints.reduce((total, p) => total + p, 0);
  const gpa = sum / validPoints.length;

  return Math.round(gpa * 100) / 100;
}

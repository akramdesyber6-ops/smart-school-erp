'use client';

/**
 * Custom React Hook: useStudentGradeReport
 * Fetches complete student grade report from Supabase
 * Manages loading/error states and triggers data aggregation
 */

import { useCallback, useEffect, useState } from 'react';
import { StudentGradeReport } from '@/types/assessment';
import {
  getStudentGradeReport,
  AssessmentServiceError,
} from '@/services/assessment.service';

export interface UseStudentGradeReportOptions {
  studentId: string;
  termId: string;
  enabled?: boolean;
}

export interface UseStudentGradeReportResult {
  report: StudentGradeReport | null;
  loading: boolean;
  error: string | null;
  errorCode?: string;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage student grade report
 * Aggregates all assessment data across subjects for a term
 */
export function useStudentGradeReport(
  options: UseStudentGradeReportOptions
): UseStudentGradeReportResult {
  const [report, setReport] = useState<StudentGradeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string>();

  const { enabled = true } = options;

  // Fetch report function
  const fetchReport = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setErrorCode(undefined);

      const gradeReport = await getStudentGradeReport(
        options.studentId,
        options.termId
      );

      if (!gradeReport) {
        throw new Error('No grade report found for this student/term combination');
      }

      setReport(gradeReport);
    } catch (err) {
      if (err instanceof AssessmentServiceError) {
        setError(err.message);
        setErrorCode(err.code);
        console.error(
          `Assessment Service Error [${err.code}]: ${err.message}`,
          err.details
        );
      } else {
        const message =
          err instanceof Error ? err.message : 'Unknown error occurred';
        setError(message);
        console.error('Unexpected error fetching grade report:', message);
      }
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [options.studentId, options.termId, enabled]);

  // Initial fetch and refetch on options change
  useEffect(() => {
    if (enabled) {
      fetchReport();
    }
  }, [options.studentId, options.termId, enabled, fetchReport]);

  return {
    report,
    loading,
    error,
    errorCode,
    refetch: fetchReport,
  };
}

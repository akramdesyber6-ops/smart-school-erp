'use client';

/**
 * Custom React Hook: useAssessmentMarks
 * Fetches live marks from Supabase for a specific assessment period
 * Provides loading/error states and automatic cache invalidation
 */

import { useCallback, useEffect, useState } from 'react';
import { GradeScale, AssessmentType } from '@/types/assessment';
import {
  getAssessmentMarks,
  AssessmentServiceError,
} from '@/services/assessment.service';

export interface UseAssessmentMarksOptions {
  subjectId: string;
  termId: string;
  assessmentType: AssessmentType;
  classId: string;
  enabled?: boolean; // Allow disabling the hook
}

export interface UseAssessmentMarksResult {
  marksMap: Map<string, GradeScale> | null;
  loading: boolean;
  error: string | null;
  errorCode?: string;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage assessment marks
 * Returns a Map for O(1) lookup during table rendering
 */
export function useAssessmentMarks(
  options: UseAssessmentMarksOptions
): UseAssessmentMarksResult {
  const [marksMap, setMarksMap] = useState<Map<string, GradeScale> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string>();

  const { enabled = true } = options;

  // Fetch marks function
  const fetchMarks = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setErrorCode(undefined);

      const marks = await getAssessmentMarks(options);
      setMarksMap(marks);
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
        console.error('Unexpected error fetching marks:', message);
      }
      setMarksMap(null);
    } finally {
      setLoading(false);
    }
  }, [options, enabled]);

  // Initial fetch and refetch on options change
  useEffect(() => {
    if (enabled) {
      fetchMarks();
    }
  }, [
    options.subjectId,
    options.termId,
    options.assessmentType,
    options.classId,
    enabled,
    fetchMarks,
  ]);

  return {
    marksMap,
    loading,
    error,
    errorCode,
    refetch: fetchMarks,
  };
}

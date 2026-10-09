'use client';

/**
 * Custom React Hook: useSaveMarks
 * Manages atomic bulk upsert of marks to Supabase
 * Provides loading states, error handling, and success callbacks
 */

import { useCallback, useState } from 'react';
import { GradeScale, AssessmentType } from '@/types/assessment';
import {
  saveAssessmentMarks,
  SaveMarksResult,
  AssessmentServiceError,
} from '@/services/assessment.service';

export interface UseSaveMarksOptions {
  onSuccess?: (result: SaveMarksResult) => void;
  onError?: (error: string) => void;
}

export interface UseSaveMarksState {
  saving: boolean;
  error: string | null;
  errorCode?: string;
  lastResult: SaveMarksResult | null;
}

export interface UseSaveMarksActions {
  saveMarks: (params: {
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
  }) => Promise<SaveMarksResult>;
  reset: () => void;
}

export interface UseSaveMarksResult extends UseSaveMarksState, UseSaveMarksActions {}

/**
 * Hook to manage atomic bulk mark upserts
 * Handles loading states, errors, and success notifications
 */
export function useSaveMarks(
  options: UseSaveMarksOptions = {}
): UseSaveMarksResult {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string>();
  const [lastResult, setLastResult] = useState<SaveMarksResult | null>(null);

  const saveMarks = useCallback(
    async (params: {
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
    }): Promise<SaveMarksResult> => {
      try {
        setSaving(true);
        setError(null);
        setErrorCode(undefined);

        const result = await saveAssessmentMarks(params);
        setLastResult(result);

        if (result.success) {
          options.onSuccess?.(result);
          console.log(`Successfully saved ${result.savedCount} marks`);
        } else {
          const errorMsg = result.error || 'Failed to save marks';
          setError(errorMsg);
          options.onError?.(errorMsg);
          console.error('Save marks failed:', errorMsg);
        }

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        if (err instanceof AssessmentServiceError) {
          setError(errorMessage);
          setErrorCode(err.code);
          options.onError?.(errorMessage);
          console.error(`Assessment Service Error [${err.code}]: ${errorMessage}`, err.details);
        } else {
          setError(errorMessage);
          options.onError?.(errorMessage);
          console.error('Unexpected error saving marks:', errorMessage);
        }

        return {
          success: false,
          savedCount: 0,
          failedCount: params.marks.length,
          error: errorMessage,
        };
      } finally {
        setSaving(false);
      }
    },
    [options]
  );

  const reset = useCallback(() => {
    setSaving(false);
    setError(null);
    setErrorCode(undefined);
    setLastResult(null);
  }, []);

  return {
    saving,
    error,
    errorCode,
    lastResult,
    saveMarks,
    reset,
  };
}

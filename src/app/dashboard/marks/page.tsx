'use client';

/**
 * MODULE 1: Marks Entry Dashboard Page
 * Wired to live Supabase backend with real-time synchronization
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import MarksEntryDashboard from '@/components/MarksEntryDashboard';
import { Student } from '@/types/assessment';
import { getClassStudents, AssessmentServiceError } from '@/services/assessment.service';
import { useAuth } from '@/hooks/useAuth';

/**
 * Loading skeleton for dashboard
 */
function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-32 animate-pulse rounded-lg bg-slate-300"></div>
      <div className="h-16 animate-pulse rounded-lg bg-slate-200"></div>
      <div className="h-96 animate-pulse rounded-lg bg-slate-200"></div>
    </div>
  );
}

/**
 * Error state component
 */
function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="rounded-lg border-l-4 border-red-500 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-900">Failed to Load Dashboard</h2>
        <p className="mt-2 text-red-800">{error}</p>
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 transition-colors"
        >
          🔄 Retry
        </button>
      </div>
    </div>
  );
}

export default function MarksPage() {
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  
  // Get parameters from URL
  const classId = searchParams.get('classId') || '';
  const subjectId = searchParams.get('subjectId') || '';
  const termId = searchParams.get('termId') || '';
  const studentClass = searchParams.get('class') || 'Senior One';
  const subject = searchParams.get('subject') || 'Agriculture';
  const term = searchParams.get('term') || 'Term 1 2026';

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch students for the class
  useEffect(() => {
    const fetchStudents = async () => {
      if (!classId) {
        setError('No class selected. Please select a class from the menu.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const fetchedStudents = await getClassStudents(classId);
        
        if (fetchedStudents.length === 0) {
          setError(`No students found in class ${studentClass}`);
        } else {
          setStudents(fetchedStudents);
        }
      } catch (err) {
        if (err instanceof AssessmentServiceError) {
          setError(`Error loading students: ${err.message}`);
        } else {
          const message = err instanceof Error ? err.message : 'Unknown error occurred';
          setError(`Failed to load students: ${message}`);
        }
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchStudents();
    }
  }, [classId, studentClass, authLoading]);

  if (authLoading) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    return (
      <ErrorState
        error="You must be authenticated to access this page."
        onRetry={() => window.location.href = '/login'}
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (students.length === 0) {
    return (
      <ErrorState
        error={`No students found in ${studentClass}`}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <MarksEntryDashboard
      class={studentClass}
      subject={subject}
      term={term}
      subjectId={subjectId}
      termId={termId}
      classId={classId}
      students={students}
      assessmentType="AOI1"
      teacherId={user.id}
      teacherInitials={user.user_metadata?.initials || 'TT'}
      onSaveSuccess={() => {
        console.log('Marks saved successfully');
      }}
    />
  );
}

'use client';

/**
 * MODULE 2: Report Card Page - Client Component with Live Data Hydration
 * Fetches student grade report from Supabase and passes to ReportCard component
 */

import React, { useEffect, useState } from 'react';
import ReportCard from '@/components/ReportCard';
import { useStudentGradeReport } from '@/hooks/useStudentGradeReport';
import { getCurrentTermForStudent } from '@/services/assessment.service';

interface ReportCardPageProps {
  params: {
    studentId: string;
  };
  searchParams?: {
    termId?: string;
  };
}

/**
 * Loading skeleton for report card
 */
function ReportCardSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div className="h-40 animate-pulse rounded-lg bg-slate-200"></div>
      <div className="h-32 animate-pulse rounded-lg bg-slate-200"></div>
      <div className="h-64 animate-pulse rounded-lg bg-slate-200"></div>
      <div className="h-40 animate-pulse rounded-lg bg-slate-200"></div>
    </div>
  );
}

/**
 * Error display component
 */
function ErrorDisplay({ error, studentId }: { error: string; studentId: string }) {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="rounded-lg border-l-4 border-red-500 bg-red-50 p-6">
        <h2 className="text-xl font-bold text-red-900">Unable to Load Report Card</h2>
        <p className="mt-2 text-red-800">{error}</p>
        <p className="mt-2 text-sm text-red-700">Student ID: <code className="font-mono">{studentId}</code></p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 transition-colors"
          >
            🔄 Retry
          </button>
          <a
            href="/dashboard"
            className="rounded-lg bg-slate-600 px-4 py-2 text-white hover:bg-slate-700 transition-colors"
          >
            ← Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Main Report Card Page Component
 */
export default function ReportCardPage({ params, searchParams }: ReportCardPageProps) {
  const { studentId } = params;
  const requestedTermId = searchParams?.termId?.trim() ?? '';
  const [resolvedTermId, setResolvedTermId] = useState('');
  const [termLoading, setTermLoading] = useState(!requestedTermId);
  const [termError, setTermError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    if (requestedTermId) {
      setResolvedTermId(requestedTermId);
      setTermError(null);
      setTermLoading(false);
      return;
    }

    let active = true;
    setTermLoading(true);
    setTermError(null);
    getCurrentTermForStudent(studentId)
      .then((currentTermId) => {
        if (!active) return;
        if (!currentTermId) {
          setTermError('No academic term is available for this student’s school.');
          setResolvedTermId('');
          return;
        }
        setResolvedTermId(currentTermId);
      })
      .catch((termLookupError: unknown) => {
        if (!active) return;
        setTermError(termLookupError instanceof Error ? termLookupError.message : 'Unable to load the current academic term.');
        setResolvedTermId('');
      })
      .finally(() => {
        if (active) setTermLoading(false);
      });

    return () => {
      active = false;
    };
  }, [studentId, requestedTermId]);

  const termId = requestedTermId || resolvedTermId;
  const { report, loading, error, refetch } = useStudentGradeReport({
    studentId,
    termId,
    enabled: Boolean(termId),
  });

  if (!isClient) {
    return <ReportCardSkeleton />;
  }

  // Validate student ID format
  if (!studentId || typeof studentId !== 'string' || studentId.trim().length === 0) {
    return (
      <div className="min-h-screen bg-slate-100 py-8">
        <ErrorDisplay
          error="Invalid student ID provided"
          studentId={studentId || 'N/A'}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white">
      {/* Print and Download Controls */}
      <div className="mb-6 print:hidden">
        <div className="mx-auto max-w-4xl flex gap-3 px-4">
          <button
            onClick={() => window.print()}
            disabled={loading || termLoading}
            className="rounded-lg bg-emerald-700 px-6 py-2 font-semibold text-white shadow hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            🖨️ Print
          </button>
          <button
            onClick={() => window.print()}
            disabled={loading || termLoading}
            className="rounded-lg bg-blue-700 px-6 py-2 font-semibold text-white shadow hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            💾 Save as PDF
          </button>
          <button
            onClick={refetch}
            disabled={loading || termLoading}
            className="rounded-lg bg-slate-600 px-6 py-2 font-semibold text-white shadow hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            🔄 Refresh
          </button>
          <a
            href="/dashboard"
            className="rounded-lg bg-slate-500 px-6 py-2 font-semibold text-white shadow hover:bg-slate-600 transition-colors ml-auto"
          >
            ← Back
          </a>
        </div>
      </div>

      {/* Loading State */}
      {(loading || termLoading) && (
        <div className="mx-auto max-w-4xl px-4">
          <ReportCardSkeleton />
        </div>
      )}

      {/* Error State */}
      {(error || termError) && !loading && !termLoading && (
        <div className="mx-auto max-w-4xl px-4">
          <ErrorDisplay error={termError ?? error ?? 'Unable to load report card.'} studentId={studentId} />
        </div>
      )}

      {/* Success State - Report Card */}
      {!loading && !termLoading && !error && !termError && report && (
        <div className="mx-auto max-w-4xl px-4">
          <div
            id="report-card"
            className="rounded-lg shadow-lg print:rounded-none print:shadow-none"
          >
            <ReportCard report={report} school={report.school} />
          </div>
        </div>
      )}

      {/* No Data State */}
      {!loading && !termLoading && !error && !termError && !report && (
        <div className="mx-auto max-w-4xl px-4">
          <ErrorDisplay
            error="No report card found for this student"
            studentId={studentId}
          />
        </div>
      )}
    </div>
  );
}

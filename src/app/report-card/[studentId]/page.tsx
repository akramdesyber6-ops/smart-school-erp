'use client';

/**
 * MODULE 2: Report Card Page - Client Component with Live Data Hydration
 * Fetches student grade report from Supabase and passes to ReportCard component
 */

import React, { useEffect, useState } from 'react';
import ReportCard from '@/components/ReportCard';
import { StudentGradeReport, SchoolProfile } from '@/types/assessment';
import { useStudentGradeReport } from '@/hooks/useStudentGradeReport';

// Mock school profile (could be fetched from config/database)
const mockSchool: SchoolProfile = {
  name: 'ONWARDS AND UPWARDS SECONDARY SCHOOL - BULOBA',
  location: 'Buloba, Kampala, Uganda',
  motto: 'Excellence Through Competence',
  contactEmail: 'info@ou-schoolpilot.org',
  contactPhone: '+256-701-234-567',
  letterheadBgColor: 'bg-emerald-50',
};

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
  const termId = searchParams?.termId || 'current'; // Default to current term
  const [isClient, setIsClient] = useState(false);

  // Use the custom hook to fetch grade report
  const { report, loading, error, refetch } = useStudentGradeReport({
    studentId,
    termId,
  });

  // Ensure we only render on client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <ReportCardSkeleton />;
  }

  // Validate student ID format
  if (!studentId || typeof studentId !== 'string' || studentId.trim().length === 0) {
    return (
      <div className=\"min-h-screen bg-slate-100 py-8\">
        <ErrorDisplay
          error=\"Invalid student ID provided\"
          studentId={studentId || 'N/A'}
        />
      </div>
    );
  }

  return (
    <div className=\"min-h-screen bg-slate-100 py-8 print:bg-white\">
      {/* Print and Download Controls */}\n      <div className=\"mb-6 print:hidden\">\n        <div className=\"mx-auto max-w-4xl flex gap-3 px-4\">\n          <button\n            onClick={() => window.print()}\n            disabled={loading}\n            className=\"rounded-lg bg-emerald-700 px-6 py-2 font-semibold text-white shadow hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors\"\n          >\n            🖨️ Print\n          </button>\n          <button\n            onClick={() => window.print()}\n            disabled={loading}\n            className=\"rounded-lg bg-blue-700 px-6 py-2 font-semibold text-white shadow hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors\"\n          >\n            💾 Save as PDF\n          </button>\n          <button\n            onClick={refetch}\n            disabled={loading}\n            className=\"rounded-lg bg-slate-600 px-6 py-2 font-semibold text-white shadow hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors\"\n          >\n            🔄 Refresh\n          </button>\n          <a\n            href=\"/dashboard\"\n            className=\"rounded-lg bg-slate-500 px-6 py-2 font-semibold text-white shadow hover:bg-slate-600 transition-colors ml-auto\"\n          >\n            ← Back\n          </a>\n        </div>\n      </div>\n\n      {/* Loading State */}\n      {loading && (\n        <div className=\"mx-auto max-w-4xl px-4\">\n          <ReportCardSkeleton />\n        </div>\n      )}\n\n      {/* Error State */}\n      {error && !loading && (\n        <div className=\"mx-auto max-w-4xl px-4\">\n          <ErrorDisplay error={error} studentId={studentId} />\n        </div>\n      )}\n\n      {/* Success State - Report Card */}\n      {!loading && !error && report && (\n        <div className=\"mx-auto max-w-4xl px-4\">\n          <div\n            id=\"report-card\"\n            className=\"rounded-lg shadow-lg print:rounded-none print:shadow-none\"\n          >\n            <ReportCard report={report} school={mockSchool} showQRCode={true} />\n          </div>\n        </div>\n      )}\n\n      {/* No Data State */}\n      {!loading && !error && !report && (\n        <div className=\"mx-auto max-w-4xl px-4\">\n          <ErrorDisplay\n            error=\"No report card found for this student\"\n            studentId={studentId}\n          />\n        </div>\n      )}\n    </div>\n  );\n}\n
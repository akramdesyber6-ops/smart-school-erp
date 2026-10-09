'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, BookOpen, CheckCircle, ClipboardCheck, GraduationCap, Loader, TrendingUp, UserCircle } from 'lucide-react';
import useAuthStore from '@/lib/stores/useAuthStore';
import DashboardAccountActions from '@/components/DashboardAccountActions';

interface StudentOverview {
  id: string;
  first_name: string;
  last_name: string;
  registration_number: string;
  school_id: string;
  gender?: string | null;
  date_of_birth?: string | null;
  is_active?: boolean | null;
}

interface EnrollmentOverview {
  id: string;
  status: string | null;
  class_name: string | null;
  stream: string | null;
  term_name: string | null;
}

interface ResultOverview {
  id: string;
  subject_name: string | null;
  descriptor: string | null;
  competency_score: number | null;
  observation: string | null;
  term_name: string | null;
}

export default function StudentDashboard(): JSX.Element {
  const router = useRouter();
  const { profile, activeSchoolId } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkMissing, setLinkMissing] = useState(false);
  const [student, setStudent] = useState<StudentOverview | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentOverview[]>([]);
  const [results, setResults] = useState<ResultOverview[]>([]);

  useEffect(() => {
    const loadStudentDashboard = async () => {
      if (!profile || !activeSchoolId) {
        setError('Unauthorized: Missing authentication or school context.');
        setLoading(false);
        router.replace('/login');
        return;
      }

      if (profile.role !== 'student') {
        setError('Unauthorized: Only students can access this dashboard.');
        setLoading(false);
        router.replace('/dashboard');
        return;
      }

      setStudent(null);
      setEnrollments([]);
      setResults([]);
      setLinkMissing(true);
      setLoading(false);
    };

    loadStudentDashboard();
  }, [profile, activeSchoolId, router]);

  const averageCompetency = useMemo(() => {
    if (!results.length) return 0;
    const validScores = results.map((row) => row.competency_score).filter((score): score is number => typeof score === 'number');
    if (!validScores.length) return 0;
    return validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
  }, [results]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader className="h-12 w-12 animate-spin text-indigo-600 mx-auto" />
          <p className="text-gray-600 text-lg">Loading student dashboard...</p>
        </div>
      </div>
    );
  }

  if (!profile || error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="flex items-center space-x-3 mb-4">
            <AlertCircle className="h-6 w-6 text-red-600" />
            <h2 className="text-xl font-semibold text-gray-800">Access Denied</h2>
          </div>
          <p className="text-gray-600 mb-6">{error || 'You are not authorized to access this page.'}</p>
          <button onClick={() => router.push('/login')} className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition">
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full text-center">
          <UserCircle className="h-12 w-12 text-slate-400 mx-auto mb-3" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Student record not linked</h2>
          <p className="text-gray-600">
            {linkMissing
              ? 'The current database schema does not link a student login to a student record. Your school administrator must establish that relationship before academic records can be shown safely.'
              : 'No student profile is available for this account.'}
          </p>
          <div className="mt-6 flex justify-center">
            <DashboardAccountActions />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600">Student Portal</p>
              <h1 className="text-3xl font-bold text-slate-900">{student.first_name} {student.last_name}</h1>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
                <GraduationCap className="h-4 w-4" />
                {student.registration_number}
              </div>
              <DashboardAccountActions />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Current Class</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">{enrollments[0]?.class_name ?? 'Not assigned'}</p>
              </div>
              <BookOpen className="h-10 w-10 text-indigo-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Average Competency</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">{averageCompetency.toFixed(1)}</p>
              </div>
              <TrendingUp className="h-10 w-10 text-emerald-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Results Logged</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">{results.length}</p>
              </div>
              <ClipboardCheck className="h-10 w-10 text-amber-500 opacity-20" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <UserCircle className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-slate-900">Student profile</h2>
            </div>
            <dl className="space-y-3 text-sm text-slate-600">
              <div className="flex justify-between"><dt>Full name</dt><dd className="font-medium text-slate-900">{student.first_name} {student.last_name}</dd></div>
              <div className="flex justify-between"><dt>Registration</dt><dd className="font-medium text-slate-900">{student.registration_number}</dd></div>
              <div className="flex justify-between"><dt>Gender</dt><dd className="font-medium text-slate-900">{student.gender ?? 'Not set'}</dd></div>
              <div className="flex justify-between"><dt>Status</dt><dd className="font-medium text-green-700">{student.is_active ? 'Active' : 'Inactive'}</dd></div>
            </dl>
          </section>

          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <BookOpen className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-slate-900">Enrollment overview</h2>
            </div>
            {enrollments.length > 0 ? (
              <div className="space-y-3">
                {enrollments.map((enrollment) => (
                  <div key={enrollment.id} className="rounded-lg border border-slate-200 p-3" >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-900">{enrollment.class_name}</p>
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">{enrollment.status}</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">{enrollment.stream} • {enrollment.term_name}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500 text-center">
                No active enrollment is available yet.
              </div>
            )}
          </section>
        </div>

        <section className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-slate-900">Recent academic results</h2>
            </div>
          </div>
          {results.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Term</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Descriptor</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Competency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {results.map((result) => (
                    <tr key={result.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{result.subject_name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{result.term_name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{result.descriptor ?? 'Pending'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{result.competency_score ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-10 text-center text-sm text-slate-500">No academic results have been recorded yet.</div>
          )}
        </section>
      </main>
    </div>
  );
}

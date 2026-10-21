'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, BookOpen, CalendarCheck, GraduationCap, RefreshCw, User } from 'lucide-react';
import useAuthStore, { type AuthProfile, type AuthSession } from '@/lib/stores/useAuthStore';
import { supabase } from '@/lib/supabase/api';

type StudentRecord = {
  id: string;
  school_id: string;
  first_name: string;
  last_name: string;
  registration_number: string;
};

type EnrollmentRecord = {
  id: string;
  status: string;
  enrollment_date: string;
  classes: { name: string; stream: string | null } | null;
  academic_terms: { name: string } | null;
};

type MarkRecord = {
  id: string;
  raw_score: number | null;
  grade: string | null;
  descriptor: string | null;
  competency_score: number | null;
  observation: string | null;
  subjects: { name: string } | null;
  academic_terms: { name: string } | null;
};

type AttendanceRecord = {
  id: string;
  date: string;
  status: string;
  classes: { name: string; stream: string | null } | null;
};

export default function StudentDashboard(): JSX.Element {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [marks, setMarks] = useState<MarkRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const loadPortal = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: userResult, error: userError } = await supabase.auth.getUser();
      if (userError || !userResult.user) {
        router.replace('/login');
        return;
      }

      const { data: sessionResult } = await supabase.auth.getSession();
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id, school_id, role, first_name, last_name, email')
        .eq('user_id', userResult.user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) {
        setError('An active school profile was not found for this account. Contact your school administrator.');
        return;
      }
      if (profile.role !== 'student') {
        router.replace('/');
        return;
      }
      if (sessionResult.session) {
        setSession({ session: sessionResult.session as AuthSession, profile: profile as AuthProfile });
      }

      const { data: studentRow, error: studentError } = await supabase
        .from('students')
        .select('id, school_id, first_name, last_name, registration_number')
        .eq('profile_id', profile.id)
        .eq('school_id', profile.school_id)
        .maybeSingle();

      if (studentError) throw studentError;
      if (!studentRow) {
        setStudent(null);
        setEnrollments([]);
        setMarks([]);
        setAttendance([]);
        return;
      }

      const { data: enrollmentRows, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('id, status, enrollment_date, classes!inner(name,stream), academic_terms!inner(name)')
        .eq('student_id', studentRow.id)
        .eq('school_id', studentRow.school_id)
        .order('enrollment_date', { ascending: false })
        .limit(5);

      if (enrollmentError) throw enrollmentError;

      const { data: markRows, error: marksError } = await supabase
        .from('markbook_entries')
        .select('id, raw_score, grade, descriptor, competency_score, observation, subjects!inner(name), academic_terms!inner(name), updated_at')
        .eq('student_id', studentRow.id)
        .eq('school_id', studentRow.school_id)
        .order('updated_at', { ascending: false })
        .limit(10);

      if (marksError) throw marksError;

      const { data: attendanceRows, error: attendanceError } = await supabase
        .from('attendance')
        .select('id, date, status, classes!inner(name,stream)')
        .eq('student_id', studentRow.id)
        .eq('school_id', studentRow.school_id)
        .order('date', { ascending: false })
        .limit(10);

      if (attendanceError) throw attendanceError;

      setStudent(studentRow as StudentRecord);
      setEnrollments((enrollmentRows ?? []) as unknown as EnrollmentRecord[]);
      setMarks((markRows ?? []) as unknown as MarkRecord[]);
      setAttendance((attendanceRows ?? []) as unknown as AttendanceRecord[]);
    } catch {
      setError('Student records could not be loaded. Confirm that the latest Supabase migrations are applied, then try again or contact the school administrator.');
    } finally {
      setLoading(false);
    }
  }, [router, setSession, retryKey]);

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  const handleSignOut = async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError('Sign-out failed. Please try again.');
      return;
    }
    clearSession();
    router.replace('/login');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <p className="text-slate-600" role="status">Loading your student portal…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <section className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-8 shadow-sm" aria-labelledby="student-error-title">
          <AlertCircle className="mb-3 h-8 w-8 text-red-600" aria-hidden="true" />
          <h1 id="student-error-title" className="text-xl font-semibold text-slate-900">Student portal unavailable</h1>
          <p className="mt-2 text-slate-600">{error}</p>
          <button type="button" onClick={() => setRetryKey((key) => key + 1)} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
          </button>
        </section>
      </main>
    );
  }

  if (!student) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <section className="mx-auto mt-16 max-w-2xl rounded-2xl border bg-white p-8 shadow-sm">
          <User className="h-9 w-9 text-indigo-600" aria-hidden="true" />
          <h1 className="mt-3 text-2xl font-bold text-slate-900">Your student record is not linked yet</h1>
          <p className="mt-2 text-slate-600">Your account is signed in, but the school has not linked it to a student record. No sample or other student data is shown here. Please contact your school administrator.</p>
          <button type="button" onClick={() => router.replace('/login')} className="mt-5 rounded-lg border px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">Return to login</button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Student portal</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Welcome, {student.first_name} {student.last_name}</h1>
            <p className="mt-1 text-slate-600">Registration number: {student.registration_number}</p>
          </div>
          <button type="button" onClick={() => void handleSignOut()} className="self-start rounded-lg border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">Sign out</button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-4 sm:grid-cols-3" aria-label="Student record summary">
          <SummaryCard icon={<BookOpen className="h-5 w-5" aria-hidden="true" />} label="Enrollment records" value={String(enrollments.length)} detail="Most recent records shown" />
          <SummaryCard icon={<GraduationCap className="h-5 w-5" aria-hidden="true" />} label="Assessment entries" value={String(marks.length)} detail="Latest marks available" />
          <SummaryCard icon={<CalendarCheck className="h-5 w-5" aria-hidden="true" />} label="Attendance entries" value={String(attendance.length)} detail="Latest attendance records" />
        </section>

        <section className="rounded-2xl border bg-white shadow-sm" aria-labelledby="enrollment-heading">
          <div className="border-b px-5 py-4 sm:px-6">
            <h2 id="enrollment-heading" className="text-lg font-semibold text-slate-900">Enrollment</h2>
          </div>
          {enrollments.length === 0 ? <EmptyState message="No enrollment records are available for your account yet." /> : (
            <div className="divide-y">
              {enrollments.map((item) => (
                <div key={item.id} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div>
                    <p className="font-medium text-slate-900">{item.classes?.name ?? 'Class not specified'}{item.classes?.stream ? ` · ${item.classes.stream}` : ''}</p>
                    <p className="text-sm text-slate-500">{item.academic_terms?.name ?? 'Term not specified'} · Enrolled {item.enrollment_date}</p>
                  </div>
                  <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-sm capitalize text-slate-700">{item.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border bg-white shadow-sm" aria-labelledby="marks-heading">
          <div className="border-b px-5 py-4 sm:px-6">
            <h2 id="marks-heading" className="text-lg font-semibold text-slate-900">Recent assessments</h2>
          </div>
          {marks.length === 0 ? <EmptyState message="No assessment entries are available yet." /> : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr><th scope="col" className="px-5 py-3 font-semibold">Subject</th><th scope="col" className="px-5 py-3 font-semibold">Term</th><th scope="col" className="px-5 py-3 font-semibold">Score</th><th scope="col" className="px-5 py-3 font-semibold">Grade / descriptor</th></tr>
                </thead>
                <tbody className="divide-y">
                  {marks.map((mark) => (
                    <tr key={mark.id}>
                      <td className="px-5 py-3 text-sm font-medium text-slate-900">{mark.subjects?.name ?? 'Subject'}</td>
                      <td className="px-5 py-3 text-sm text-slate-600">{mark.academic_terms?.name ?? '—'}</td>
                      <td className="px-5 py-3 text-sm text-slate-700">{mark.raw_score === null ? (mark.competency_score === null ? 'Not graded' : `Competency ${mark.competency_score}/3`) : `${mark.raw_score}%`}</td>
                      <td className="px-5 py-3 text-sm text-slate-700">{mark.grade ?? mark.descriptor ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border bg-white shadow-sm" aria-labelledby="attendance-heading">
          <div className="border-b px-5 py-4 sm:px-6">
            <h2 id="attendance-heading" className="text-lg font-semibold text-slate-900">Recent attendance</h2>
          </div>
          {attendance.length === 0 ? <EmptyState message="No attendance entries are available yet." /> : (
            <div className="divide-y">
              {attendance.map((item) => (
                <div key={item.id} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div><p className="font-medium text-slate-900">{item.classes?.name ?? 'Class'}{item.classes?.stream ? ` · ${item.classes.stream}` : ''}</p><p className="text-sm text-slate-500">{item.date}</p></div>
                  <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-sm capitalize text-slate-700">{item.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ icon, label, value, detail }: { icon: JSX.Element; label: string; value: string; detail: string }): JSX.Element {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-indigo-600">{icon}<p className="text-sm font-medium text-slate-600">{label}</p></div>
      <p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }): JSX.Element {
  return <p className="px-5 py-8 text-sm text-slate-500 sm:px-6">{message}</p>;
}

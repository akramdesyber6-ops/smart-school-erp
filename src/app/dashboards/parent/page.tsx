'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, BookOpen, CalendarCheck, RefreshCw, Users, UserRound } from 'lucide-react';
import useAuthStore, { type AuthProfile, type AuthSession } from '@/lib/stores/useAuthStore';
import { supabase } from '@/lib/supabase/api';

type ParentRecord = {
  id: string;
  school_id: string;
  first_name: string;
  last_name: string;
};

type StudentRecord = {
  id: string;
  school_id: string;
  first_name: string;
  last_name: string;
  registration_number: string;
  is_primary_contact: boolean;
};

type ParentStudentLink = {
  is_primary_contact: boolean;
  students: {
    id: string;
    school_id: string;
    first_name: string;
    last_name: string;
    registration_number: string;
  } | Array<{
    id: string;
    school_id: string;
    first_name: string;
    last_name: string;
    registration_number: string;
  }> | null;
};

type EnrollmentRecord = {
  id: string;
  student_id: string;
  status: string;
  enrollment_date: string;
  classes: { name: string; stream: string | null } | null;
  academic_terms: { name: string } | null;
};

type MarkRecord = {
  id: string;
  student_id: string;
  raw_score: number | null;
  grade: string | null;
  descriptor: string | null;
  competency_score: number | null;
  subjects: { name: string } | null;
  academic_terms: { name: string } | null;
};

type AttendanceRecord = {
  id: string;
  student_id: string;
  date: string;
  status: string;
};

export default function ParentDashboard(): JSX.Element {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [parent, setParent] = useState<ParentRecord | null>(null);
  const [children, setChildren] = useState<StudentRecord[]>([]);
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
      if (profile.role !== 'parent') {
        router.replace('/');
        return;
      }
      if (sessionResult.session) {
        setSession({ session: sessionResult.session as AuthSession, profile: profile as AuthProfile });
      }

      const { data: parentRow, error: parentError } = await supabase
        .from('parents')
        .select('id, school_id, first_name, last_name')
        .eq('profile_id', profile.id)
        .eq('school_id', profile.school_id)
        .maybeSingle();

      if (parentError) throw parentError;
      if (!parentRow) {
        setParent(null);
        setChildren([]);
        setEnrollments([]);
        setMarks([]);
        setAttendance([]);
        return;
      }

      const { data: links, error: linksError } = await supabase
        .from('student_parents')
        .select('is_primary_contact, students!inner(id,school_id,first_name,last_name,registration_number)')
        .eq('parent_id', parentRow.id);

      if (linksError) throw linksError;

      const mappedChildren = ((links ?? []) as unknown as ParentStudentLink[])
        .map((link) => {
          const row = Array.isArray(link.students) ? link.students[0] : link.students;
          return row ? { ...row, is_primary_contact: link.is_primary_contact } : null;
        })
        .filter((row): row is StudentRecord => row !== null);

      const childIds = mappedChildren.map((child) => child.id);
      let enrollmentRows: EnrollmentRecord[] = [];
      let markRows: MarkRecord[] = [];
      let attendanceRows: AttendanceRecord[] = [];

      if (childIds.length > 0) {
        const [enrollmentResult, marksResult, attendanceResult] = await Promise.all([
          supabase
            .from('enrollments')
            .select('id, student_id, status, enrollment_date, classes!inner(name,stream), academic_terms!inner(name)')
            .in('student_id', childIds)
            .eq('school_id', parentRow.school_id)
            .order('enrollment_date', { ascending: false })
            .limit(Math.min(childIds.length * 5, 50)),
          supabase
            .from('markbook_entries')
            .select('id, student_id, raw_score, grade, descriptor, competency_score, subjects!inner(name), academic_terms!inner(name), updated_at')
            .in('student_id', childIds)
            .eq('school_id', parentRow.school_id)
            .order('updated_at', { ascending: false })
            .limit(Math.min(childIds.length * 10, 100)),
          supabase
            .from('attendance')
            .select('id, student_id, date, status')
            .in('student_id', childIds)
            .eq('school_id', parentRow.school_id)
            .order('date', { ascending: false })
            .limit(Math.min(childIds.length * 10, 100)),
        ]);

        if (enrollmentResult.error) throw enrollmentResult.error;
        if (marksResult.error) throw marksResult.error;
        if (attendanceResult.error) throw attendanceResult.error;

        enrollmentRows = (enrollmentResult.data ?? []) as unknown as EnrollmentRecord[];
        markRows = (marksResult.data ?? []) as unknown as MarkRecord[];
        attendanceRows = (attendanceResult.data ?? []) as AttendanceRecord[];
      }

      setParent(parentRow as ParentRecord);
      setChildren(mappedChildren);
      setEnrollments(enrollmentRows);
      setMarks(markRows);
      setAttendance(attendanceRows);
    } catch {
      setError('Family records could not be loaded. Confirm that the latest Supabase migrations are applied and that your school has linked your account to the correct parent record.');
    } finally {
      setLoading(false);
    }
  }, [router, setSession, retryKey]);

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  if (loading) {
    return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6"><p className="text-slate-600" role="status">Loading your family portal…</p></main>;
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <section className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-8 shadow-sm" aria-labelledby="parent-error-title">
          <AlertCircle className="mb-3 h-8 w-8 text-red-600" aria-hidden="true" />
          <h1 id="parent-error-title" className="text-xl font-semibold text-slate-900">Family portal unavailable</h1>
          <p className="mt-2 text-slate-600">{error}</p>
          <button type="button" onClick={() => setRetryKey((key) => key + 1)} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
          </button>
        </section>
      </main>
    );
  }

  if (!parent) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <section className="mx-auto mt-16 max-w-2xl rounded-2xl border bg-white p-8 shadow-sm">
          <UserRound className="h-9 w-9 text-indigo-600" aria-hidden="true" />
          <h1 className="mt-3 text-2xl font-bold text-slate-900">Your parent record is not linked yet</h1>
          <p className="mt-2 text-slate-600">Your account is signed in, but the school has not linked it to a parent record. No family or student data is displayed until that link is verified.</p>
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
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Parent portal</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Welcome, {parent.first_name} {parent.last_name}</h1>
            <p className="mt-1 text-slate-600">View school records for students linked to your account.</p>
          </div>
          <button type="button" onClick={() => router.replace('/login')} className="self-start rounded-lg border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">Sign-in screen</button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-4 sm:grid-cols-3" aria-label="Family record summary">
          <SummaryCard icon={<Users className="h-5 w-5" aria-hidden="true" />} label="Linked students" value={String(children.length)} />
          <SummaryCard icon={<BookOpen className="h-5 w-5" aria-hidden="true" />} label="Assessment records" value={String(marks.length)} />
          <SummaryCard icon={<CalendarCheck className="h-5 w-5" aria-hidden="true" />} label="Attendance records" value={String(attendance.length)} />
        </section>

        <section className="rounded-2xl border bg-white shadow-sm" aria-labelledby="children-heading">
          <div className="border-b px-5 py-4 sm:px-6"><h2 id="children-heading" className="text-lg font-semibold text-slate-900">Linked students</h2></div>
          {children.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500 sm:px-6">No student records are linked to this parent account yet. Contact the school office to verify the family relationship.</p>
          ) : (
            <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
              {children.map((child) => {
                const childEnrollments = enrollments.filter((item) => item.student_id === child.id).slice(0, 3);
                const childMarks = marks.filter((item) => item.student_id === child.id).slice(0, 5);
                const childAttendance = attendance.filter((item) => item.student_id === child.id).slice(0, 5);
                return (
                  <article key={child.id} className="min-w-0 rounded-xl border p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-lg font-semibold text-slate-900">{child.first_name} {child.last_name}</h3>
                        <p className="mt-1 break-all text-sm text-slate-500">Registration: {child.registration_number}</p>
                      </div>
                      {child.is_primary_contact && <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">Primary contact</span>}
                    </div>

                    <div className="mt-5 border-t pt-4">
                      <h4 className="text-sm font-semibold text-slate-900">Enrollment</h4>
                      {childEnrollments.length === 0 ? <p className="mt-2 text-sm text-slate-500">No enrollment records yet.</p> : (
                        <div className="mt-2 space-y-2">
                          {childEnrollments.map((item) => <div key={item.id} className="text-sm"><p className="font-medium text-slate-800">{item.classes?.name ?? 'Class not specified'}{item.classes?.stream ? ` · ${item.classes.stream}` : ''}</p><p className="text-slate-500">{item.academic_terms?.name ?? 'Term not specified'} · <span className="capitalize">{item.status}</span></p></div>)}
                        </div>
                      )}
                    </div>

                    <div className="mt-5 border-t pt-4">
                      <h4 className="text-sm font-semibold text-slate-900">Recent assessments</h4>
                      {childMarks.length === 0 ? <p className="mt-2 text-sm text-slate-500">No assessment records yet.</p> : (
                        <div className="mt-2 space-y-2">
                          {childMarks.map((mark) => <div key={mark.id} className="flex items-start justify-between gap-3 text-sm"><div className="min-w-0"><p className="break-words font-medium text-slate-800">{mark.subjects?.name ?? 'Subject'}</p><p className="text-slate-500">{mark.academic_terms?.name ?? 'Term not specified'}</p></div><p className="shrink-0 text-right font-medium text-slate-800">{mark.raw_score === null ? (mark.competency_score === null ? 'Pending' : `Competency ${mark.competency_score}/3`) : `${mark.raw_score}%`}<span className="block text-xs font-normal text-slate-500">{mark.grade ?? mark.descriptor ?? ''}</span></p></div>)}
                        </div>
                      )}
                    </div>

                    <div className="mt-5 border-t pt-4">
                      <h4 className="text-sm font-semibold text-slate-900">Recent attendance</h4>
                      {childAttendance.length === 0 ? <p className="mt-2 text-sm text-slate-500">No attendance records yet.</p> : (
                        <div className="mt-2 space-y-2">
                          {childAttendance.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-600">{item.date}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 capitalize text-slate-700">{item.status}</span></div>)}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ icon, label, value }: { icon: JSX.Element; label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-indigo-600">{icon}<p className="text-sm font-medium text-slate-600">{label}</p></div>
      <p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">From linked school records</p>
    </div>
  );
}

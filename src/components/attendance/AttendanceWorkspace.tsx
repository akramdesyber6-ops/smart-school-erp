'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Calendar, CheckCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase/api';

type AttendanceRole = 'teacher' | 'admin';
type ClassOption = { id: string; name: string; stream: string | null; school_id: string };
type TermOption = { id: string; name: string; is_current: boolean };
type StudentOption = {
  id: string;
  first_name: string;
  last_name: string;
  registration_number: string;
};
type EnrollmentOption = { student_id: string; students: StudentOption | StudentOption[] | null };
type AttendanceStatus = '' | 'present' | 'absent' | 'late' | 'excused';
type ExistingAttendance = { student_id: string; status: Exclude<AttendanceStatus, ''> };

const statusOptions: Array<{ value: AttendanceStatus; label: string }> = [
  { value: '', label: 'Not marked' },
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
  { value: 'excused', label: 'Excused' },
];

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500';
const primaryButtonClass = 'inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2';

function localDateString(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export default function AttendanceWorkspace({ requiredRole }: { requiredRole: AttendanceRole }): JSX.Element {
  const router = useRouter();
  const [profileId, setProfileId] = useState('');
  const [profileRole, setProfileRole] = useState<string>('');
  const [schoolId, setSchoolId] = useState('');
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [selectedDate, setSelectedDate] = useState(localDateString);
  const [roster, setRoster] = useState<StudentOption[]>([]);
  const [attendanceValues, setAttendanceValues] = useState<Record<string, AttendanceStatus>>({});
  const [search, setSearch] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    setError(null);
    try {
      const { data: authResult, error: authError } = await supabase.auth.getUser();
      if (authError || !authResult.user) {
        router.replace('/login');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, school_id, role, is_active')
        .eq('user_id', authResult.user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) {
        setError('An active school profile was not found. Contact your school administrator.');
        return;
      }

      const permitted = requiredRole === 'teacher'
        ? profile.role === 'teacher' || profile.role === 'admin'
        : profile.role === 'school_admin' || profile.role === 'admin';
      if (!permitted) {
        router.replace('/');
        return;
      }

      setProfileId(profile.id);
      setProfileRole(profile.role);
      setSchoolId(profile.school_id);

      const [classesResult, termsResult] = await Promise.all([
        supabase.from('classes')
          .select('id, name, stream, school_id')
          .eq('school_id', profile.school_id)
          .order('name', { ascending: true }),
        supabase.from('academic_terms')
          .select('id, name, is_current')
          .eq('school_id', profile.school_id)
          .order('start_date', { ascending: false }),
      ]);
      if (classesResult.error) throw classesResult.error;
      if (termsResult.error) throw termsResult.error;

      let availableClasses = (classesResult.data ?? []) as ClassOption[];
      if (requiredRole === 'teacher' && profile.role !== 'admin') {
        const { data: assignmentRows, error: assignmentError } = await supabase
          .from('class_subjects')
          .select('class_id')
          .eq('teacher_id', profile.id);
        if (assignmentError) throw assignmentError;
        const assignedClassIds = new Set((assignmentRows ?? []).map((row) => row.class_id));
        availableClasses = availableClasses.filter((item) => assignedClassIds.has(item.id));
      }

      const availableTerms = (termsResult.data ?? []) as TermOption[];
      setClasses(availableClasses);
      setTerms(availableTerms);
      setSelectedClassId((current) => availableClasses.some((item) => item.id === current) ? current : (availableClasses[0]?.id ?? ''));
      setSelectedTermId((current) => availableTerms.some((item) => item.id === current)
        ? current
        : (availableTerms.find((term) => term.is_current)?.id ?? availableTerms[0]?.id ?? ''));
    } catch {
      setError('Attendance options could not be loaded. Confirm your school configuration and database migrations, then try again.');
    } finally {
      setLoadingOptions(false);
    }
  }, [requiredRole, router]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const loadRoster = useCallback(async () => {
    if (!schoolId || !selectedClassId || !selectedTermId || !selectedDate) {
      setRoster([]);
      setAttendanceValues({});
      return;
    }

    setLoadingRoster(true);
    setError(null);
    try {
      const { data: enrollmentRows, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('student_id, students!inner(id,first_name,last_name,registration_number)')
        .eq('school_id', schoolId)
        .eq('class_id', selectedClassId)
        .eq('term_id', selectedTermId)
        .eq('status', 'active')
        .order('created_at', { ascending: true });
      if (enrollmentError) throw enrollmentError;

      const studentRows = ((enrollmentRows ?? []) as unknown as EnrollmentOption[])
        .map((row) => Array.isArray(row.students) ? row.students[0] : row.students)
        .filter((student): student is StudentOption => Boolean(student));
      setRoster(studentRows);

      if (studentRows.length === 0) {
        setAttendanceValues({});
        return;
      }

      const { data: recordedRows, error: attendanceError } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('school_id', schoolId)
        .eq('class_id', selectedClassId)
        .eq('term_id', selectedTermId)
        .eq('date', selectedDate)
        .in('student_id', studentRows.map((student) => student.id));
      if (attendanceError) throw attendanceError;

      const values: Record<string, AttendanceStatus> = {};
      studentRows.forEach((student) => { values[student.id] = ''; });
      (recordedRows ?? []).forEach((row) => {
        values[row.student_id] = row.status as Exclude<AttendanceStatus, ''>;
      });
      setAttendanceValues(values);
    } catch {
      setError('The attendance roster could not be loaded. Check your class assignment and row-level database permissions, then retry.');
    } finally {
      setLoadingRoster(false);
    }
  }, [schoolId, selectedClassId, selectedTermId, selectedDate]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  const filteredRoster = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return roster;
    return roster.filter((student) =>
      `${student.first_name} ${student.last_name} ${student.registration_number}`.toLocaleLowerCase().includes(term)
    );
  }, [roster, search]);

  const markedCount = roster.filter((student) => Boolean(attendanceValues[student.id])).length;
  const presentCount = roster.filter((student) => attendanceValues[student.id] === 'present').length;
  const absentCount = roster.filter((student) => attendanceValues[student.id] === 'absent').length;

  const saveAttendance = async () => {
    if (!schoolId || !profileId || !selectedClassId || !selectedTermId || !selectedDate) {
      setError('Choose a class, term, and date before saving attendance.');
      return;
    }

    const records = roster
      .filter((student) => Boolean(attendanceValues[student.id]))
      .map((student) => ({
        school_id: schoolId,
        student_id: student.id,
        class_id: selectedClassId,
        term_id: selectedTermId,
        date: selectedDate,
        status: attendanceValues[student.id] as Exclude<AttendanceStatus, ''>,
      }));

    if (records.length === 0) {
      setError('Mark at least one student before saving.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: saveError } = await supabase
        .from('attendance')
        .upsert(records, { onConflict: 'student_id,date' });
      if (saveError) throw saveError;
      setSuccess(`Saved attendance for ${records.length} student${records.length === 1 ? '' : 's'} on ${selectedDate}.`);
      await loadRoster();
    } catch {
      setError('Attendance was not saved. Confirm that the selected students are enrolled in this class and that you have permission to mark this date.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingOptions) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><p role="status" className="text-slate-600">Loading attendance workspace…</p></main>;
  }

  const title = requiredRole === 'teacher' && profileRole !== 'admin' ? 'Class attendance' : 'School attendance';
  const backHref = profileRole === 'teacher' ? '/dashboards/teacher' : '/dashboards/school-admin';

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Smart School ERP</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
            <p className="mt-1 text-sm text-slate-600">Mark and review attendance using enrolled student records and school permissions.</p>
          </div>
          <a href={backHref} className="w-fit rounded-lg border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">Back to dashboard</a>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><p className="flex-1">{error}</p><button type="button" onClick={() => { setError(null); void loadOptions(); }} className="font-semibold underline">Reload options</button></div>}
        {success && <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle className="mt-0.5 h-5 w-5 shrink-0" /><p>{success}</p></div>}

        <section className="grid gap-4 sm:grid-cols-3" aria-label="Attendance summary">
          <SummaryCard label="Enrolled students" value={roster.length} />
          <SummaryCard label="Marked today" value={markedCount} />
          <SummaryCard label="Present / absent" value={`${presentCount} / ${absentCount}`} />
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6" aria-label="Attendance filters">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><label htmlFor="attendance-class" className="mb-1 block text-sm font-medium text-slate-700">Class / stream</label><select id="attendance-class" value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)} className={inputClass} disabled={classes.length === 0}><option value="">Select class…</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}{item.stream ? ` · ${item.stream}` : ''}</option>)}</select></div>
            <div><label htmlFor="attendance-term" className="mb-1 block text-sm font-medium text-slate-700">Academic term</label><select id="attendance-term" value={selectedTermId} onChange={(event) => setSelectedTermId(event.target.value)} className={inputClass} disabled={terms.length === 0}><option value="">Select term…</option>{terms.map((term) => <option key={term.id} value={term.id}>{term.name}{term.is_current ? ' · Current' : ''}</option>)}</select></div>
            <div><label htmlFor="attendance-date" className="mb-1 block text-sm font-medium text-slate-700">Attendance date</label><input id="attendance-date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className={inputClass} /></div>
            <div><label htmlFor="attendance-search" className="mb-1 block text-sm font-medium text-slate-700">Search student</label><input id="attendance-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or registration number" className={inputClass} /></div>
          </div>
          {classes.length === 0 && <p className="mt-4 text-sm text-slate-600">{requiredRole === 'teacher' && profileRole !== 'admin' ? 'No assigned classes are available for attendance. Ask your school administrator to verify your class/subject assignments.' : 'No classes are configured for this school yet.'}</p>}
          {terms.length === 0 && <p className="mt-2 text-sm text-slate-600">Create an academic term before marking attendance.</p>}
        </section>

        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm" aria-labelledby="attendance-roster-heading">
          <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div><h2 id="attendance-roster-heading" className="text-lg font-semibold text-slate-900">Attendance register</h2><p className="mt-1 text-sm text-slate-500">{selectedDate || 'Choose a date'} · Blank entries are left unchanged when you save.</p></div>
            <button type="button" onClick={() => void loadRoster()} disabled={loadingRoster || !selectedClassId || !selectedTermId} className="inline-flex w-fit items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh register</button>
          </div>
          {loadingRoster ? <p className="px-5 py-10 text-sm text-slate-500 sm:px-6" role="status">Loading enrolled students and existing attendance…</p> : roster.length === 0 ? (
            <p className="px-5 py-10 text-sm text-slate-500 sm:px-6">No active enrollment records were found for the selected class and term.</p>
          ) : filteredRoster.length === 0 ? (
            <p className="px-5 py-10 text-sm text-slate-500 sm:px-6">No students match that search.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr><th scope="col" className="px-5 py-3 font-semibold">Student</th><th scope="col" className="px-5 py-3 font-semibold">Registration number</th><th scope="col" className="px-5 py-3 font-semibold">Status</th></tr>
                </thead>
                <tbody className="divide-y">
                  {filteredRoster.map((student) => (
                    <tr key={student.id}>
                      <td className="px-5 py-3 text-sm font-medium text-slate-900">{student.first_name} {student.last_name}</td>
                      <td className="px-5 py-3 text-sm text-slate-600">{student.registration_number}</td>
                      <td className="px-5 py-3"><label className="sr-only" htmlFor={`attendance-${student.id}`}>Attendance status for {student.first_name} {student.last_name}</label><select id={`attendance-${student.id}`} value={attendanceValues[student.id] ?? ''} onChange={(event) => setAttendanceValues((current) => ({ ...current, [student.id]: event.target.value as AttendanceStatus }))} className={inputClass}>{statusOptions.map((option) => <option key={option.value || 'unmarked'} value={option.value}>{option.label}</option>)}</select></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-col gap-3 border-t bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-sm text-slate-600">Only non-blank statuses are written. The database records the authenticated user as the marker.</p>
            <button type="button" onClick={() => void saveAttendance()} disabled={saving || loadingRoster || roster.length === 0} className={primaryButtonClass}><Calendar className="h-4 w-4" aria-hidden="true" />{saving ? 'Saving attendance…' : 'Save attendance'}</button>
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }): JSX.Element {
  return <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-600">{label}</p><p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{value}</p></div>;
}

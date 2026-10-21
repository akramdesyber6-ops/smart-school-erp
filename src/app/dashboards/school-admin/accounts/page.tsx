'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle, Link2, RefreshCw, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase/api';

type StudentRecord = {
  id: string;
  first_name: string;
  last_name: string;
  registration_number: string;
};
type ParentRecord = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
};
type ProfileChoice = {
  id: string;
  role: 'student' | 'parent';
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export default function AccountLinkingPage(): JSX.Element {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [unlinkedStudents, setUnlinkedStudents] = useState<StudentRecord[]>([]);
  const [unlinkedParents, setUnlinkedParents] = useState<ParentRecord[]>([]);
  const [studentProfiles, setStudentProfiles] = useState<ProfileChoice[]>([]);
  const [parentProfiles, setParentProfiles] = useState<ProfileChoice[]>([]);
  const [studentChoices, setStudentChoices] = useState<Record<string, string>>({});
  const [parentChoices, setParentChoices] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: userResult, error: userError } = await supabase.auth.getUser();
      if (userError || !userResult.user) {
        router.replace('/login');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, school_id, role, is_active')
        .eq('user_id', userResult.user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile || (profile.role !== 'admin' && profile.role !== 'school_admin')) {
        router.replace('/');
        return;
      }
      setSchoolId(profile.school_id);

      const [studentsResult, parentsResult, profilesResult, linkedStudentsResult, linkedParentsResult] = await Promise.all([
        supabase.from('students')
          .select('id, first_name, last_name, registration_number')
          .eq('school_id', profile.school_id)
          .is('profile_id', null)
          .order('last_name', { ascending: true }),
        supabase.from('parents')
          .select('id, first_name, last_name, email')
          .eq('school_id', profile.school_id)
          .is('profile_id', null)
          .order('last_name', { ascending: true }),
        supabase.from('profiles')
          .select('id, role, first_name, last_name, email')
          .eq('school_id', profile.school_id)
          .eq('is_active', true)
          .in('role', ['student', 'parent'])
          .order('last_name', { ascending: true }),
        supabase.from('students').select('profile_id').eq('school_id', profile.school_id).not('profile_id', 'is', null),
        supabase.from('parents').select('profile_id').eq('school_id', profile.school_id).not('profile_id', 'is', null),
      ]);

      if (studentsResult.error) throw studentsResult.error;
      if (parentsResult.error) throw parentsResult.error;
      if (profilesResult.error) throw profilesResult.error;
      if (linkedStudentsResult.error) throw linkedStudentsResult.error;
      if (linkedParentsResult.error) throw linkedParentsResult.error;

      const linkedStudentIds = new Set((linkedStudentsResult.data ?? []).map((row) => row.profile_id).filter(Boolean));
      const linkedParentIds = new Set((linkedParentsResult.data ?? []).map((row) => row.profile_id).filter(Boolean));
      const eligibleProfiles = (profilesResult.data ?? []) as ProfileChoice[];

      setUnlinkedStudents((studentsResult.data ?? []) as StudentRecord[]);
      setUnlinkedParents((parentsResult.data ?? []) as ParentRecord[]);
      setStudentProfiles(eligibleProfiles.filter((p) => p.role === 'student' && !linkedStudentIds.has(p.id)));
      setParentProfiles(eligibleProfiles.filter((p) => p.role === 'parent' && !linkedParentIds.has(p.id)));
    } catch {
      setError('Account-linking data could not be loaded. Confirm that the latest Supabase migrations are applied and that you are an active school administrator.');
    } finally {
      setLoading(false);
    }
  }, [router, retryKey]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const linkStudent = async (student: StudentRecord) => {
    const profileId = studentChoices[student.id];
    if (!profileId || !schoolId) {
      setError('Choose an existing student account before linking this record.');
      return;
    }

    setSavingKey(`student:${student.id}`);
    setError(null);
    setNotice(null);
    try {
      const { data, error: updateError } = await supabase
        .from('students')
        .update({ profile_id: profileId })
        .eq('id', student.id)
        .eq('school_id', schoolId)
        .is('profile_id', null)
        .select('id')
        .maybeSingle();

      if (updateError) throw updateError;
      if (!data) throw new Error('The record was already linked or is no longer available.');
      setNotice(`Student account linked to ${student.first_name} ${student.last_name}.`);
      setStudentChoices((current) => ({ ...current, [student.id]: '' }));
      await loadData();
    } catch {
      setError('Student account was not linked. Check the account role, school, and current link status, then refresh and try again.');
    } finally {
      setSavingKey(null);
    }
  };

  const linkParent = async (parent: ParentRecord) => {
    const profileId = parentChoices[parent.id];
    if (!profileId || !schoolId) {
      setError('Choose an existing parent account before linking this record.');
      return;
    }

    setSavingKey(`parent:${parent.id}`);
    setError(null);
    setNotice(null);
    try {
      const { data, error: updateError } = await supabase
        .from('parents')
        .update({ profile_id: profileId })
        .eq('id', parent.id)
        .eq('school_id', schoolId)
        .is('profile_id', null)
        .select('id')
        .maybeSingle();

      if (updateError) throw updateError;
      if (!data) throw new Error('The record was already linked or is no longer available.');
      setNotice(`Parent account linked to ${parent.first_name} ${parent.last_name}.`);
      setParentChoices((current) => ({ ...current, [parent.id]: '' }));
      await loadData();
    } catch {
      setError('Parent account was not linked. Check the account role, school, and current link status, then refresh and try again.');
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6"><p className="text-slate-600" role="status">Loading account links…</p></main>;
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">School administration</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Link student and parent accounts</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">Connect existing active portal profiles to matching school records. This page does not create passwords or authentication users.</p>
          </div>
          <a href="/dashboards/school-admin" className="inline-flex w-fit items-center rounded-lg border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">Back to dashboard</a>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Before linking:</strong> the account must already exist in Supabase Auth with an active profile in this same school and with the matching role. Database triggers and row-level policies validate the link as well; never share passwords between users.
        </div>

        {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><div className="flex-1">{error}</div><button type="button" onClick={() => setRetryKey((key) => key + 1)} className="inline-flex items-center gap-1 font-semibold underline"><RefreshCw className="h-4 w-4" /> Refresh</button></div>}
        {notice && <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle className="mt-0.5 h-5 w-5 shrink-0" />{notice}</div>}

        <section className="rounded-2xl border bg-white shadow-sm" aria-labelledby="student-links-heading">
          <div className="flex items-center justify-between border-b px-5 py-4 sm:px-6">
            <div className="flex items-center gap-2"><UserRound className="h-5 w-5 text-indigo-600" aria-hidden="true" /><h2 id="student-links-heading" className="text-lg font-semibold text-slate-900">Student records</h2></div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm tabular-nums text-slate-700">{unlinkedStudents.length} unlinked</span>
          </div>
          {unlinkedStudents.length === 0 ? <p className="px-5 py-8 text-sm text-slate-500 sm:px-6">All student records are linked, or no student records exist yet.</p> : (
            <div className="divide-y">
              {unlinkedStudents.map((student) => (
                <div key={student.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,1fr)_auto] sm:items-center sm:px-6">
                  <div className="min-w-0"><p className="font-medium text-slate-900">{student.first_name} {student.last_name}</p><p className="break-all text-sm text-slate-500">{student.registration_number}</p></div>
                  <div><label htmlFor={`student-profile-${student.id}`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Student account</label><select id={`student-profile-${student.id}`} value={studentChoices[student.id] ?? ''} onChange={(event) => setStudentChoices((current) => ({ ...current, [student.id]: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"><option value="">Choose account…</option>{studentProfiles.map((profile) => <option key={profile.id} value={profile.id}>{[profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email || profile.id}</option>)}</select></div>
                  <button type="button" disabled={!studentChoices[student.id] || savingKey !== null} onClick={() => void linkStudent(student)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"><Link2 className="h-4 w-4" aria-hidden="true" />{savingKey === `student:${student.id}` ? 'Linking…' : 'Link account'}</button>
                </div>
              ))}
            </div>
          )}
          {unlinkedStudents.length > 0 && studentProfiles.length === 0 && <p className="border-t bg-slate-50 px-5 py-3 text-sm text-slate-600">No unlinked active student profiles are available in this school. Provision the account through the trusted onboarding process first.</p>}
        </section>

        <section className="rounded-2xl border bg-white shadow-sm" aria-labelledby="parent-links-heading">
          <div className="flex items-center justify-between border-b px-5 py-4 sm:px-6">
            <div className="flex items-center gap-2"><UserRound className="h-5 w-5 text-indigo-600" aria-hidden="true" /><h2 id="parent-links-heading" className="text-lg font-semibold text-slate-900">Parent records</h2></div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm tabular-nums text-slate-700">{unlinkedParents.length} unlinked</span>
          </div>
          {unlinkedParents.length === 0 ? <p className="px-5 py-8 text-sm text-slate-500 sm:px-6">All parent records are linked, or no parent records exist yet.</p> : (
            <div className="divide-y">
              {unlinkedParents.map((parent) => (
                <div key={parent.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,1fr)_auto] sm:items-center sm:px-6">
                  <div className="min-w-0"><p className="font-medium text-slate-900">{parent.first_name} {parent.last_name}</p><p className="break-all text-sm text-slate-500">{parent.email ?? 'No email recorded'}</p></div>
                  <div><label htmlFor={`parent-profile-${parent.id}`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Parent account</label><select id={`parent-profile-${parent.id}`} value={parentChoices[parent.id] ?? ''} onChange={(event) => setParentChoices((current) => ({ ...current, [parent.id]: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"><option value="">Choose account…</option>{parentProfiles.map((profile) => <option key={profile.id} value={profile.id}>{[profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email || profile.id}</option>)}</select></div>
                  <button type="button" disabled={!parentChoices[parent.id] || savingKey !== null} onClick={() => void linkParent(parent)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"><Link2 className="h-4 w-4" aria-hidden="true" />{savingKey === `parent:${parent.id}` ? 'Linking…' : 'Link account'}</button>
                </div>
              ))}
            </div>
          )}
          {unlinkedParents.length > 0 && parentProfiles.length === 0 && <p className="border-t bg-slate-50 px-5 py-3 text-sm text-slate-600">No unlinked active parent profiles are available in this school. Provision the account through the trusted onboarding process first.</p>}
        </section>
      </div>
    </main>
  );
}

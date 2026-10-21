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
  profile_id: string | null;
};
type ParentRecord = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  profile_id: string | null;
};
type FamilyRelationship = {
  student_id: string;
  parent_id: string;
  is_primary_contact: boolean;
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
  const [schoolStudents, setSchoolStudents] = useState<StudentRecord[]>([]);
  const [schoolParents, setSchoolParents] = useState<ParentRecord[]>([]);
  const [relationships, setRelationships] = useState<FamilyRelationship[]>([]);
  const [studentProfiles, setStudentProfiles] = useState<ProfileChoice[]>([]);
  const [parentProfiles, setParentProfiles] = useState<ProfileChoice[]>([]);
  const [newParentForm, setNewParentForm] = useState({ studentId: '', firstName: '', lastName: '', email: '', phone: '', relationship: 'Guardian', isPrimaryContact: false });
  const [creatingParent, setCreatingParent] = useState(false);
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

      const [studentsResult, parentsResult, profilesResult, relationshipsResult] = await Promise.all([
        supabase.from('students')
          .select('id, first_name, last_name, registration_number, profile_id')
          .eq('school_id', profile.school_id)
          .order('last_name', { ascending: true }),
        supabase.from('parents')
          .select('id, first_name, last_name, email, profile_id')
          .eq('school_id', profile.school_id)
          .order('last_name', { ascending: true }),
        supabase.from('profiles')
          .select('id, role, first_name, last_name, email')
          .eq('school_id', profile.school_id)
          .eq('is_active', true)
          .in('role', ['student', 'parent'])
          .order('last_name', { ascending: true }),
        supabase.from('student_parents').select('student_id, parent_id, is_primary_contact'),
      ]);

      if (studentsResult.error) throw studentsResult.error;
      if (parentsResult.error) throw parentsResult.error;
      if (profilesResult.error) throw profilesResult.error;
      if (relationshipsResult.error) throw relationshipsResult.error;

      const allStudents = (studentsResult.data ?? []) as StudentRecord[];
      const allParents = (parentsResult.data ?? []) as ParentRecord[];
      const linkedStudentIds = new Set(allStudents.map((row) => row.profile_id).filter(Boolean));
      const linkedParentIds = new Set(allParents.map((row) => row.profile_id).filter(Boolean));
      const eligibleProfiles = (profilesResult.data ?? []) as ProfileChoice[];

      setSchoolStudents(allStudents);
      setSchoolParents(allParents);
      setRelationships((relationshipsResult.data ?? []) as FamilyRelationship[]);
      setUnlinkedStudents(allStudents.filter((row) => !row.profile_id));
      setUnlinkedParents(allParents.filter((row) => !row.profile_id));
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

  const createParentAndLinkStudent = async () => {
    if (!schoolId || !newParentForm.studentId) {
      setError('Choose a student before creating the parent contact.');
      return;
    }

    setCreatingParent(true);
    setError(null);
    setNotice(null);
    try {
      const { error: createError } = await supabase.rpc('create_parent_and_link_student', {
        target_school_id: schoolId,
        target_student_id: newParentForm.studentId,
        parent_first_name: newParentForm.firstName,
        parent_last_name: newParentForm.lastName,
        parent_email: newParentForm.email || null,
        parent_phone: newParentForm.phone || null,
        target_relationship: newParentForm.relationship || null,
        target_primary_contact: newParentForm.isPrimaryContact,
      });
      if (createError) throw createError;
      setNotice('Parent contact created and linked to the selected student.');
      setNewParentForm({ studentId: '', firstName: '', lastName: '', email: '', phone: '', relationship: 'Guardian', isPrimaryContact: false });
      await loadData();
    } catch {
      setError('Parent contact was not created. Confirm the selected student belongs to this school and that the current database migrations have been applied.');
    } finally {
      setCreatingParent(false);
    }
  };

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

        <section className="rounded-2xl border bg-white shadow-sm" aria-labelledby="family-relationships-heading">
          <div className="border-b px-5 py-4 sm:px-6"><h2 id="family-relationships-heading" className="text-lg font-semibold text-slate-900">Current family relationships</h2></div>
          {relationships.length === 0 ? <p className="px-5 py-6 text-sm text-slate-500 sm:px-6">No parent-to-student relationships are recorded yet.</p> : (
            <div className="divide-y">
              {relationships.map((relationship) => {
                const student = schoolStudents.find((row) => row.id === relationship.student_id);
                const parent = schoolParents.find((row) => row.id === relationship.parent_id);
                if (!student || !parent) return null;
                return <div key={`${relationship.student_id}-${relationship.parent_id}`} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"><p className="text-sm text-slate-800"><span className="font-medium">{parent.first_name} {parent.last_name}</span><span className="text-slate-500"> is linked to </span><span className="font-medium">{student.first_name} {student.last_name}</span></p>{relationship.is_primary_contact && <span className="w-fit rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">Primary contact</span>}</div>;
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border bg-white shadow-sm" aria-labelledby="new-parent-heading">
          <div className="border-b px-5 py-4 sm:px-6"><h2 id="new-parent-heading" className="text-lg font-semibold text-slate-900">Create a parent contact and link a student</h2><p className="mt-1 text-sm text-slate-600">The contact and relationship are created together by a database function that checks school-admin access and verifies the student belongs to this school.</p></div>
          <form className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6" onSubmit={(event) => { event.preventDefault(); void createParentAndLinkStudent(); }}>
            <div className="sm:col-span-2"><label htmlFor="parent-student" className="mb-1 block text-sm font-medium text-slate-700">Student</label><select id="parent-student" required value={newParentForm.studentId} onChange={(event) => setNewParentForm((current) => ({ ...current, studentId: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"><option value="">Choose student…</option>{schoolStudents.map((student) => <option key={student.id} value={student.id}>{student.first_name} {student.last_name} · {student.registration_number}</option>)}</select></div>
            <div><label htmlFor="parent-first-name" className="mb-1 block text-sm font-medium text-slate-700">First name</label><input id="parent-first-name" required maxLength={100} value={newParentForm.firstName} onChange={(event) => setNewParentForm((current) => ({ ...current, firstName: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
            <div><label htmlFor="parent-last-name" className="mb-1 block text-sm font-medium text-slate-700">Last name</label><input id="parent-last-name" required maxLength={100} value={newParentForm.lastName} onChange={(event) => setNewParentForm((current) => ({ ...current, lastName: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
            <div><label htmlFor="parent-email" className="mb-1 block text-sm font-medium text-slate-700">Email (optional)</label><input id="parent-email" type="email" maxLength={254} value={newParentForm.email} onChange={(event) => setNewParentForm((current) => ({ ...current, email: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
            <div><label htmlFor="parent-phone" className="mb-1 block text-sm font-medium text-slate-700">Phone (optional)</label><input id="parent-phone" type="tel" maxLength={40} value={newParentForm.phone} onChange={(event) => setNewParentForm((current) => ({ ...current, phone: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
            <div><label htmlFor="parent-relationship" className="mb-1 block text-sm font-medium text-slate-700">Relationship to student</label><input id="parent-relationship" maxLength={60} value={newParentForm.relationship} onChange={(event) => setNewParentForm((current) => ({ ...current, relationship: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
            <div className="flex items-center gap-2 self-end pb-2"><input id="primary-contact" type="checkbox" checked={newParentForm.isPrimaryContact} onChange={(event) => setNewParentForm((current) => ({ ...current, isPrimaryContact: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /><label htmlFor="primary-contact" className="text-sm text-slate-700">Primary contact for this student</label></div>
            <div className="sm:col-span-2"><button type="submit" disabled={creatingParent || schoolStudents.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">{creatingParent ? 'Creating contact…' : 'Create parent and link student'}</button>{schoolStudents.length === 0 && <p className="mt-2 text-sm text-slate-500">Create a student record before adding a parent contact.</p>}</div>
          </form>
        </section>
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

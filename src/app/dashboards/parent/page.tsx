'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, BookOpen, CheckCircle, Loader, UserCircle, Users } from 'lucide-react';
import useAuthStore from '@/lib/stores/useAuthStore';
import { supabase } from '@/lib/supabase/api';

interface LinkedChild {
  id: string;
  first_name: string;
  last_name: string;
  registration_number: string;
  class_name: string | null;
  stream: string | null;
  status: string | null;
}

interface ParentResult {
  id: string;
  student_name: string;
  subject_name: string | null;
  descriptor: string | null;
  competency_score: number | null;
  term_name: string | null;
}

export default function ParentDashboard(): JSX.Element {
  const router = useRouter();
  const { profile, activeSchoolId } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [parentName, setParentName] = useState('Parent');
  const [children, setChildren] = useState<LinkedChild[]>([]);
  const [results, setResults] = useState<ParentResult[]>([]);

  useEffect(() => {
    const loadParentDashboard = async () => {
      if (!profile || !activeSchoolId) {
        setError('Unauthorized: Missing authentication or school context.');
        setTimeout(() => router.push('/login'), 2000);
        return;
      }

      if (profile.role !== 'parent') {
        setError('Unauthorized: Only parents can access this dashboard.');
        setTimeout(() => router.push('/dashboard'), 2000);
        return;
      }

      try {
        const email = (profile as any)?.email ?? '';
        const { data: parentRows, error: parentError } = await supabase
          .from('parents')
          .select('*')
          .eq('school_id', activeSchoolId)
          .ilike('email', email || '%')
          .limit(1);

        if (parentError && parentError.code !== 'PGRST116') throw parentError;

        const matchedParent = parentRows?.[0] ?? null;
        if (!matchedParent) {
          setParentName('Parent');
          setChildren([]);
          setResults([]);
          setLoading(false);
          return;
        }

        setParentName(`${matchedParent.first_name ?? 'Parent'} ${matchedParent.last_name ?? ''}`.trim());

        const { data: childrenRows, error: childrenError } = await supabase
          .from('student_parents')
          .select('student_id, is_primary_contact, students!inner(id, first_name, last_name, registration_number), enrollments!inner(id, status, class_id, classes!inner(id, name, stream), term_id, academic_terms!inner(id, name))')
          .eq('parent_id', matchedParent.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (childrenError && childrenError.code !== 'PGRST116') throw childrenError;

        const nextChildren = (childrenRows || []).map((row: any) => ({
          id: row.students?.id,
          first_name: row.students?.first_name,
          last_name: row.students?.last_name,
          registration_number: row.students?.registration_number,
          class_name: row.enrollments?.classes?.name ?? 'Not assigned',
          stream: row.enrollments?.classes?.stream ?? 'General',
          status: row.enrollments?.status ?? 'active',
        }));

        setChildren(nextChildren);

        const childIds = nextChildren.map((child) => child.id);
        if (!childIds.length) {
          setResults([]);
          setLoading(false);
          return;
        }

        const { data: resultRows, error: resultError } = await supabase
          .from('markbook_entries')
          .select('id, student_id, subject_id, descriptor, competency_score, academic_terms!inner(id, name), subjects!inner(id, name), students!inner(id, first_name, last_name)')
          .in('student_id', childIds)
          .eq('school_id', activeSchoolId)
          .order('created_at', { ascending: false })
          .limit(20);

        if (resultError && resultError.code !== 'PGRST116') throw resultError;

        setResults(
          (resultRows || []).map((row: any) => ({
            id: row.id,
            student_name: `${row.students?.first_name ?? ''} ${row.students?.last_name ?? ''}`.trim() || 'Student',
            subject_name: row.subjects?.name ?? 'Subject',
            descriptor: row.descriptor ?? 'Pending',
            competency_score: row.competency_score ?? null,
            term_name: row.academic_terms?.name ?? 'Current Term',
          }))
        );
      } catch (err: any) {
        console.error('Parent dashboard error:', err);
        setError(err?.message || 'Failed to load your dashboard.');
      } finally {
        setLoading(false);
      }
    };

    loadParentDashboard();
  }, [profile, activeSchoolId, router]);

  const childCount = useMemo(() => children.length, [children]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader className="h-12 w-12 animate-spin text-indigo-600 mx-auto" />
          <p className="text-gray-600 text-lg">Loading parent dashboard...</p>
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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600">Parent Portal</p>
              <h1 className="text-3xl font-bold text-slate-900">{parentName}</h1>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
              <Users className="h-4 w-4" />
              {childCount} linked child{childCount === 1 ? '' : 'ren'}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Children</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">{childCount}</p>
              </div>
              <Users className="h-10 w-10 text-indigo-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Latest Result Entries</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">{results.length}</p>
              </div>
              <BookOpen className="h-10 w-10 text-emerald-500 opacity-20" />
            </div>
          </div>
        </div>

        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <UserCircle className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-slate-900">Linked children</h2>
          </div>
          {children.length > 0 ? (
            <div className="space-y-3">
              {children.map((child) => (
                <div key={child.id} className="rounded-lg border border-slate-200 p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-900">{child.first_name} {child.last_name}</p>
                    <p className="text-sm text-slate-500">{child.registration_number} • {child.class_name}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">{child.status ?? 'Active'}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              No children are linked to this parent profile yet.
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-slate-900">Latest child results</h2>
            </div>
          </div>
          {results.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Term</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Descriptor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {results.map((result) => (
                    <tr key={result.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{result.student_name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{result.subject_name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{result.term_name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{result.descriptor ?? 'Pending'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-10 text-center text-sm text-slate-500">No academic results are available for your linked children yet.</div>
          )}
        </section>
      </main>
    </div>
  );
}

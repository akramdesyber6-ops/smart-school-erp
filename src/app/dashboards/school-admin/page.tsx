'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/lib/stores/useAuthStore';
import { supabase, ClassRow } from '@/lib/supabase/api';
import { Users, BookOpen, GraduationCap, Plus, X, AlertCircle, CheckCircle, Loader } from 'lucide-react';

interface SchoolMetrics {
  totalStudents: number;
  totalTeachers: number;
  emisCode: string | null;
  schoolName: string;
}

interface AcademicTerm {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  school_id: string;
}

interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  registration_number: string;
  school_id: string;
  [key: string]: any;
}

interface ClassStream {
  id: string;
  name: string;
  stream: string | null;
  school_id: string;
}

type ModalType = 'create-stream' | 'onboard-student' | null;

export default function SchoolAdminDashboard(): JSX.Element {
  const router = useRouter();
  const { profile, activeSchoolId } = useAuthStore();

  // State management
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [metrics, setMetrics] = useState<SchoolMetrics | null>(null);
  const [classes, setClasses] = useState<ClassStream[]>([]);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState<ModalType>(null);

  // Form state
  const [streamForm, setStreamForm] = useState({ className: '', stream: '', curriculum: 'CBC' });
  const [studentForm, setStudentForm] = useState({
    firstName: '',
    lastName: '',
    registrationNumber: '',
    classId: '',
    termId: '',
  });
  const [formLoading, setFormLoading] = useState(false);

  // Authorization & Data Loading
  useEffect(() => {
    const checkAuthAndLoad = async () => {
      setLoading(true);
      setError(null);

      // Check authorization
      if (!profile || !activeSchoolId) {
        setError('Unauthorized: Missing authentication or school context.');
        setTimeout(() => router.push('/login'), 2000);
        return;
      }

      if (profile.role !== 'school_admin' && profile.role !== 'admin') {
        setError('Unauthorized: Only school admins can access this dashboard.');
        setTimeout(() => router.push('/dashboard'), 2000);
        return;
      }

      setIsAuthorized(true);

      try {
        // Fetch school profile metrics
        const { data: schoolData, error: schoolError } = await supabase
          .from('schools')
          .select('id, name, emis_code')
          .eq('id', activeSchoolId)
          .single();

        if (schoolError) throw schoolError;

        // Fetch student count
        const { data: studentsData, error: studentsError } = await supabase
          .from('students')
          .select('id')
          .eq('school_id', activeSchoolId);

        if (studentsError && studentsError.code !== 'PGRST116') throw studentsError;

        // Fetch teacher count
        const { data: teachersData, error: teachersError } = await supabase
          .from('profiles')
          .select('id')
          .eq('school_id', activeSchoolId)
          .eq('role', 'teacher');

        if (teachersError && teachersError.code !== 'PGRST116') throw teachersError;

        setMetrics({
          totalStudents: studentsData?.length || 0,
          totalTeachers: teachersData?.length || 0,
          emisCode: schoolData?.emis_code || null,
          schoolName: schoolData?.name || 'School',
        });

        // Fetch classes and streams
        const { data: classesData, error: classesError } = await supabase
          .from('classes')
          .select('id, name, stream, school_id')
          .eq('school_id', activeSchoolId)
          .order('name', { ascending: true });

        if (classesError && classesError.code !== 'PGRST116') throw classesError;
        setClasses((classesData as ClassStream[]) || []);

        // Fetch academic terms
        const { data: termsData, error: termsError } = await supabase
          .from('academic_terms')
          .select('id, name, start_date, end_date, school_id')
          .eq('school_id', activeSchoolId)
          .order('start_date', { ascending: false });

        if (termsError && termsError.code !== 'PGRST116') throw termsError;
        setTerms((termsData as AcademicTerm[]) || []);

        // Fetch active enrollments (last 10)
        const { data: enrollmentsData, error: enrollmentsError } = await supabase
          .from('enrollments')
          .select('id, student_id, class_id, term_id, status, students!inner(first_name, last_name, registration_number)')
          .eq('school_id', activeSchoolId)
          .order('created_at', { ascending: false })
          .limit(10);

        if (enrollmentsError && enrollmentsError.code !== 'PGRST116') throw enrollmentsError;
        setEnrollments(enrollmentsData || []);
      } catch (err: any) {
        console.error('Dashboard load error:', err);
        setError(err?.message || 'Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndLoad();
  }, [profile, activeSchoolId, router]);

  // Create Stream Handler
  const handleCreateStream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSchoolId) return;

    setFormLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('classes')
        .insert([
          {
            name: streamForm.className,
            stream: streamForm.stream || null,
            school_id: activeSchoolId,
            curriculum: streamForm.curriculum,
          },
        ])
        .select();

      if (err) throw err;

      setClasses([...classes, data[0]]);
      setSuccessMessage(`Stream '${streamForm.className}' created successfully!`);
      setStreamForm({ className: '', stream: '', curriculum: 'CBC' });
      setModalOpen(null);

      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to create stream.');
    } finally {
      setFormLoading(false);
    }
  };

  // Onboard Student Handler
  const handleOnboardStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSchoolId || !studentForm.classId || !studentForm.termId) {
      setError('Please fill in all required fields.');
      return;
    }

    setFormLoading(true);
    try {
      // Create student record
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .insert([
          {
            first_name: studentForm.firstName,
            last_name: studentForm.lastName,
            registration_number: studentForm.registrationNumber,
            school_id: activeSchoolId,
          },
        ])
        .select()
        .single();

      if (studentError) throw studentError;

      // Create enrollment record
      const { error: enrollmentError } = await supabase
        .from('enrollments')
        .insert([
          {
            student_id: studentData.id,
            class_id: studentForm.classId,
            term_id: studentForm.termId,
            school_id: activeSchoolId,
            status: 'active',
          },
        ]);

      if (enrollmentError) throw enrollmentError;

      setSuccessMessage(`Student '${studentForm.firstName} ${studentForm.lastName}' onboarded successfully!`);
      setStudentForm({ firstName: '', lastName: '', registrationNumber: '', classId: '', termId: '' });
      setModalOpen(null);

      // Refresh metrics and enrollments
      const { data: updatedStudents } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', activeSchoolId);

      if (metrics) {
        setMetrics({ ...metrics, totalStudents: updatedStudents?.length || 0 });
      }

      const { data: updatedEnrollments } = await supabase
        .from('enrollments')
        .select('id, student_id, class_id, term_id, status, students!inner(first_name, last_name, registration_number)')
        .eq('school_id', activeSchoolId)
        .order('created_at', { ascending: false })
        .limit(10);

      setEnrollments(updatedEnrollments || []);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to onboard student.');
    } finally {
      setFormLoading(false);
    }
  };

  // Render states
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader className="h-12 w-12 animate-spin text-indigo-600 mx-auto" />
          <p className="text-gray-600 text-lg">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized || error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="flex items-center space-x-3 mb-4">
            <AlertCircle className="h-6 w-6 text-red-600" />
            <h2 className="text-xl font-semibold text-gray-800">Access Denied</h2>
          </div>
          <p className="text-gray-600 mb-6">{error || 'You are not authorized to access this page.'}</p>
          <button
            onClick={() => router.push('/login')}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">{metrics?.schoolName} Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">EMIS Code: {metrics?.emisCode || 'Not assigned'}</p>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800">{successMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Students */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Students</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{metrics?.totalStudents || 0}</p>
              </div>
              <Users className="h-12 w-12 text-blue-600 opacity-20" />
            </div>
          </div>

          {/* Total Teachers */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Assigned Teachers</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{metrics?.totalTeachers || 0}</p>
              </div>
              <GraduationCap className="h-12 w-12 text-green-600 opacity-20" />
            </div>
          </div>

          {/* Active Classes */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Active Classes</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{classes.length}</p>
              </div>
              <BookOpen className="h-12 w-12 text-purple-600 opacity-20" />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setModalOpen('create-stream')}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition font-medium"
          >
            <Plus className="h-5 w-5" />
            Create Class Stream
          </button>
          <button
            onClick={() => setModalOpen('onboard-student')}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-medium"
          >
            <Plus className="h-5 w-5" />
            Onboard Student
          </button>
        </div>

        {/* Classes Section */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Class Streams</h2>
          </div>
          {classes.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No class streams configured yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-t">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Class Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Stream</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Curriculum</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((cls) => (
                    <tr key={cls.id} className="border-t hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{cls.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{cls.stream || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">CBC</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Enrollments */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Recent Enrollments</h2>
          </div>
          {enrollments.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No enrollments recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-t">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Student Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Reg. Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((enrollment) => (
                    <tr key={enrollment.id} className="border-t hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {enrollment.students?.first_name} {enrollment.students?.last_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{enrollment.students?.registration_number || '—'}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {enrollment.status || 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Stream Modal */}
      {modalOpen === 'create-stream' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Create Class Stream</h3>
              <button
                onClick={() => setModalOpen(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleCreateStream} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class Name *</label>
                <input
                  type="text"
                  value={streamForm.className}
                  onChange={(e) => setStreamForm({ ...streamForm, className: e.target.value })}
                  placeholder="e.g., Form 1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stream (Optional)</label>
                <input
                  type="text"
                  value={streamForm.stream}
                  onChange={(e) => setStreamForm({ ...streamForm, stream: e.target.value })}
                  placeholder="e.g., A, B, Blue"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Curriculum</label>
                <select
                  value={streamForm.curriculum}
                  onChange={(e) => setStreamForm({ ...streamForm, curriculum: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="CBC">CBC (Competency Based)</option>
                  <option value="NCDC">NCDC (National Curriculum)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                >
                  {formLoading ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Stream'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Onboard Student Modal */}
      {modalOpen === 'onboard-student' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Onboard Student</h3>
              <button
                onClick={() => setModalOpen(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleOnboardStudent} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input
                  type="text"
                  value={studentForm.firstName}
                  onChange={(e) => setStudentForm({ ...studentForm, firstName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input
                  type="text"
                  value={studentForm.lastName}
                  onChange={(e) => setStudentForm({ ...studentForm, lastName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
                <input
                  type="text"
                  value={studentForm.registrationNumber}
                  onChange={(e) => setStudentForm({ ...studentForm, registrationNumber: e.target.value })}
                  placeholder="e.g., STU-2024-001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class Stream *</label>
                <select
                  value={studentForm.classId}
                  onChange={(e) => setStudentForm({ ...studentForm, classId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Select a class...</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} {cls.stream ? `- ${cls.stream}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Academic Term *</label>
                <select
                  value={studentForm.termId}
                  onChange={(e) => setStudentForm({ ...studentForm, termId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Select a term...</option>
                  {terms.map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                >
                  {formLoading ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      Onboarding...
                    </>
                  ) : (
                    'Onboard Student'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

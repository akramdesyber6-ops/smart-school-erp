'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/lib/stores/useAuthStore';
import { supabase } from '@/lib/supabase/api';
import {
  BookOpen,
  AlertCircle,
  CheckCircle,
  Loader,
  X,
  Download,
  Plus,
  Sparkles,
  Save,
} from 'lucide-react';

interface TeacherClass {
  id: string;
  name: string;
  stream: string | null;
  curriculum: string;
  school_id: string;
}

interface StudentEnrollment {
  id: string;
  student_id: string;
  class_id: string;
  term_id: string;
  status: string;
  students?: {
    id: string;
    first_name: string;
    last_name: string;
    registration_number: string;
  };
}

interface MarkbookEntry {
  id?: string;
  student_id: string;
  class_id: string;
  subject_id: string;
  term_id: string;
  school_id: string;
  raw_score?: number | null;
  bot_score?: number | null; // Beginning of Term
  mot_score?: number | null; // Middle of Term
  eot_score?: number | null; // End of Term
  total_percentage?: number | null;
  grade?: string | null;
  descriptor?: string | null;
  competency_code?: string | null;
  competency_score?: number | null; // 1, 2, or 3 for CBC
  observation?: string | null;
}

interface LessonPlan {
  topic: string;
  objectives: string[];
  methodology: string;
  resources: string[];
  duration: string;
  assessment: string;
}

type GradebookTab = 'gradebook' | 'lessons';

const mapGradeToNcdcDivision = (percentage: number | null): string | null => {
  if (percentage === null) return null;
  if (percentage >= 75) return 'D1';
  if (percentage >= 70) return 'D2';
  if (percentage >= 65) return 'D3';
  if (percentage >= 60) return 'D4';
  if (percentage >= 55) return 'D5';
  if (percentage >= 50) return 'D6';
  if (percentage >= 45) return 'D7';
  if (percentage >= 40) return 'D8';
  return 'F9';
};

const generateAiLessonPlan = (subject: string, topic: string, curriculum: string): LessonPlan => {
  const isNcdc = curriculum === 'NCDC';
  return {
    topic: `${topic} (${subject})`,
    objectives: isNcdc
      ? [
          `Students will understand the key concepts of ${topic}`,
          `Students will apply ${topic} in practical scenarios`,
          `Students will evaluate and analyze ${topic}`,
        ]
      : [
          `Demonstrate competency in ${topic}`,
          `Apply integrated activities of integration (AOI) for ${topic}`,
          `Show evidence of mastery in ${topic}`,
        ],
    methodology: isNcdc
      ? 'Lecture, discussion, practical activities, and group work'
      : 'Competency-based learning with Activities of Integration (AOI), collaborative projects',
    resources: [
      `${subject} textbooks`,
      'Digital resources and multimedia',
      'Laboratory equipment (if applicable)',
      'Student worksheets and handouts',
    ],
    duration: isNcdc ? '40 minutes (single lesson)' : '80 minutes (integrated block)',
    assessment: isNcdc
      ? 'Formative: class participation, quizzes. Summative: end-of-term exam'
      : 'Portfolio assessment, competency rubrics, peer evaluation, self-reflection',
  };
};

export default function TeacherDashboard(): JSX.Element {
  const router = useRouter();
  const { profile, activeSchoolId } = useAuthStore();

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [selectedClass, setSelectedClass] = useState<TeacherClass | null>(null);
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);
  const [markbookData, setMarkbookData] = useState<Map<string, MarkbookEntry>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<GradebookTab>('gradebook');
  const [lessonPlan, setLessonPlan] = useState<LessonPlan | null>(null);
  const [lessonTopic, setLessonTopic] = useState('');
  const [lessonSubject, setLessonSubject] = useState('');

  // Authorization & Data Loading
  useEffect(() => {
    const checkAuthAndLoad = async () => {
      setLoading(true);
      setError(null);

      if (!profile || !activeSchoolId) {
        setError('Unauthorized: Missing authentication or school context.');
        setTimeout(() => router.push('/login'), 2000);
        return;
      }

      if (profile.role !== 'teacher' && profile.role !== 'admin') {
        setError('Unauthorized: Only teachers can access this dashboard.');
        setTimeout(() => router.push('/dashboard'), 2000);
        return;
      }

      setIsAuthorized(true);

      try {
        // Fetch classes assigned to this teacher
        const { data: classesData, error: classesError } = await supabase
          .from('classes')
          .select('id, name, stream, school_id, curriculum')
          .eq('school_id', activeSchoolId)
          .order('name', { ascending: true });

        if (classesError && classesError.code !== 'PGRST116') throw classesError;
        const fetchedClasses = (classesData as any[]) || [];
        setClasses(fetchedClasses);

        if (fetchedClasses.length > 0) {
          setSelectedClass(fetchedClasses[0]);
        }
      } catch (err: any) {
        console.error('Dashboard load error:', err);
        setError(err?.message || 'Failed to load teacher dashboard.');
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndLoad();
  }, [profile, activeSchoolId, router]);

  // Load enrollments when class changes
  useEffect(() => {
    const loadEnrollments = async () => {
      if (!selectedClass || !activeSchoolId) return;
      setLoading(true);
      setMarkbookData(new Map());
      try {
        const { data: enrollmentsData, error: enrollmentsError } = await supabase
          .from('enrollments')
          .select(
            'id, student_id, class_id, term_id, status, students!inner(id, first_name, last_name, registration_number)'
          )
          .eq('class_id', selectedClass.id)
          .eq('school_id', activeSchoolId)
          .order('students.first_name', { ascending: true });

        if (enrollmentsError && enrollmentsError.code !== 'PGRST116') throw enrollmentsError;
        setEnrollments((enrollmentsData || []) as StudentEnrollment[]);

        // Load existing markbook entries
        const { data: markbookData, error: markbookError } = await supabase
          .from('markbook_entries')
          .select('*')
          .eq('class_id', selectedClass.id)
          .eq('school_id', activeSchoolId);

        if (markbookError && markbookError.code !== 'PGRST116') throw markbookError;
        const newMarkbookMap = new Map();
        (markbookData || []).forEach((entry: any) => {
          newMarkbookMap.set(entry.student_id, entry);
        });
        setMarkbookData(newMarkbookMap);
      } catch (err: any) {
        setError(err?.message || 'Failed to load enrollments.');
      } finally {
        setLoading(false);
      }
    };

    loadEnrollments();
  }, [selectedClass, activeSchoolId]);

  // Calculate total percentage for NCDC
  const calculateNcdcTotal = (bot: number | null, mot: number | null, eot: number | null): number | null => {
    if (bot === null || mot === null || eot === null) return null;
    return bot * 0.1 + mot * 0.2 + eot * 0.7;
  };

  // Save markbook entry
  const saveMarkbookEntry = async (studentId: string, entry: MarkbookEntry) => {
    if (!selectedClass || !activeSchoolId) return;
    setSaving(true);
    try {
      const entryToSave = {
        student_id: studentId,
        class_id: selectedClass.id,
        subject_id: 'default-subject',
        term_id: 'current-term',
        school_id: activeSchoolId,
        ...entry,
      };

      // For CBC, save competency score and observation
      if (selectedClass.curriculum === 'CBC') {
        const { error: err } = await supabase.from('markbook_entries').upsert(
          {
            ...entryToSave,
            competency_score: entry.competency_score,
            observation: entry.observation,
          },
          { onConflict: 'student_id,class_id' }
        );
        if (err) throw err;
      } else {
        // For NCDC, calculate and save total percentage and grade
        const total = calculateNcdcTotal(entry.bot_score, entry.mot_score, entry.eot_score);
        const grade = mapGradeToNcdcDivision(total);
        const { error: err } = await supabase.from('markbook_entries').upsert(
          {
            ...entryToSave,
            bot_score: entry.bot_score,
            mot_score: entry.mot_score,
            eot_score: entry.eot_score,
            total_percentage: total,
            grade: grade,
            raw_score: total ? Math.round(total) : null,
          },
          { onConflict: 'student_id,class_id' }
        );
        if (err) throw err;
      }

      const updated = new Map(markbookData);
      updated.set(studentId, entry);
      setMarkbookData(updated);
      setSuccess('Grades saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save grades.');
    } finally {
      setSaving(false);
    }
  };

  // Handle CBC competency score change
  const handleCbcScoreChange = (studentId: string, score: number) => {
    const entry = markbookData.get(studentId) || { student_id: studentId };
    entry.competency_score = score;
    saveMarkbookEntry(studentId, entry as MarkbookEntry);
  };

  // Handle CBC observation change
  const handleCbcObservationChange = (studentId: string, observation: string) => {
    const entry = markbookData.get(studentId) || { student_id: studentId };
    entry.observation = observation;
  };

  // Handle NCDC score change
  const handleNcdcScoreChange = (studentId: string, field: 'bot' | 'mot' | 'eot', value: number) => {
    const entry = markbookData.get(studentId) || { student_id: studentId };
    if (field === 'bot') entry.bot_score = value;
    if (field === 'mot') entry.mot_score = value;
    if (field === 'eot') entry.eot_score = value;
    setMarkbookData(new Map(markbookData.set(studentId, entry as MarkbookEntry)));
  };

  // Save NCDC scores
  const saveNcdcGrades = async (studentId: string) => {
    const entry = markbookData.get(studentId);
    if (!entry) return;
    await saveMarkbookEntry(studentId, entry);
  };

  // Generate lesson plan
  const handleGenerateLessonPlan = () => {
    if (!lessonTopic || !lessonSubject) {
      setError('Please fill in both subject and topic.');
      return;
    }
    const curriculum = selectedClass?.curriculum || 'CBC';
    const plan = generateAiLessonPlan(lessonSubject, lessonTopic, curriculum);
    setLessonPlan(plan);
    setSuccess('Lesson plan generated successfully!');
    setTimeout(() => setSuccess(null), 3000);
  };

  // Download lesson plan as text
  const downloadLessonPlan = () => {
    if (!lessonPlan) return;
    const text = `
LESSON PLAN: ${lessonPlan.topic}
Curriculum: ${selectedClass?.curriculum}

OBJECTIVES:
${lessonPlan.objectives.map((obj) => `- ${obj}`).join('\n')}

METHODOLOGY:
${lessonPlan.methodology}

RESOURCES:
${lessonPlan.resources.map((res) => `- ${res}`).join('\n')}

DURATION: ${lessonPlan.duration}

ASSESSMENT:
${lessonPlan.assessment}
    `;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lesson-plan-${lessonPlan.topic.replace(/\s+/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader className="h-12 w-12 animate-spin text-indigo-600 mx-auto" />
          <p className="text-gray-600 text-lg">Loading teacher dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
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
          <h1 className="text-3xl font-bold text-gray-900">Teacher Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage grades, lessons, and student progress</p>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-green-800">{success}</p>
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
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Class Selector */}
        {classes.length > 0 && (
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Class Stream</label>
            <select
              value={selectedClass?.id || ''}
              onChange={(e) => {
                const cls = classes.find((c) => c.id === e.target.value);
                if (cls) setSelectedClass(cls);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} {cls.stream ? `- ${cls.stream}` : ''} ({cls.curriculum})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab('gradebook')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'gradebook'
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <BookOpen className="inline-block h-5 w-5 mr-2" />
            Gradebook
          </button>
          <button
            onClick={() => setActiveTab('lessons')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'lessons'
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Sparkles className="inline-block h-5 w-5 mr-2" />
            Lesson Planner
          </button>
        </div>

        {/* Gradebook Tab */}
        {activeTab === 'gradebook' && selectedClass && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedClass.curriculum === 'CBC' ? 'CBC Competency Gradebook' : 'NCDC Traditional Gradebook'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {selectedClass.curriculum === 'CBC'
                  ? 'Input competency scores (1-3) and observations'
                  : 'Input BOT (10%), MOT (20%), EOT (70%)'}
              </p>
            </div>

            {enrollments.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No students enrolled in this class yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {selectedClass.curriculum === 'CBC' ? (
                  // CBC Gradebook
                  <table className="w-full">
                    <thead className="bg-gray-50 border-t">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Student Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Reg. Number</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Competency Score</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Observation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrollments.map((enrollment) => {
                        const entry = markbookData.get(enrollment.student_id);
                        return (
                          <tr key={enrollment.student_id} className="border-t hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              {enrollment.students?.first_name} {enrollment.students?.last_name}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">{enrollment.students?.registration_number}</td>
                            <td className="px-6 py-4 text-sm">
                              <select
                                value={entry?.competency_score || ''}
                                onChange={(e) => handleCbcScoreChange(enrollment.student_id, parseInt(e.target.value))}
                                className="px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                <option value="">—</option>
                                <option value="1">1 - Initiating</option>
                                <option value="2">2 - Progressing</option>
                                <option value="3">3 - Achieving</option>
                              </select>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <textarea
                                value={entry?.observation || ''}
                                onChange={(e) => handleCbcObservationChange(enrollment.student_id, e.target.value)}
                                placeholder="Add observation..."
                                className="w-full px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                rows={2}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  // NCDC Gradebook
                  <table className="w-full">
                    <thead className="bg-gray-50 border-t">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Student Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Reg. Number</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">BOT (10%)</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">MOT (20%)</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">EOT (70%)</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Total %</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Grade</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrollments.map((enrollment) => {
                        const entry = markbookData.get(enrollment.student_id);
                        const total = calculateNcdcTotal(entry?.bot_score || null, entry?.mot_score || null, entry?.eot_score || null);
                        const grade = mapGradeToNcdcDivision(total);
                        return (
                          <tr key={enrollment.student_id} className="border-t hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              {enrollment.students?.first_name} {enrollment.students?.last_name}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">{enrollment.students?.registration_number}</td>
                            <td className="px-6 py-4 text-sm">
                              <input
                                type="number"
                                min="0"
                                max="10"
                                value={entry?.bot_score ?? ''}
                                onChange={(e) => handleNcdcScoreChange(enrollment.student_id, 'bot', parseFloat(e.target.value))}
                                placeholder="0"
                                className="w-16 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                              />
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <input
                                type="number"
                                min="0"
                                max="20"
                                value={entry?.mot_score ?? ''}
                                onChange={(e) => handleNcdcScoreChange(enrollment.student_id, 'mot', parseFloat(e.target.value))}
                                placeholder="0"
                                className="w-16 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                              />
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <input
                                type="number"
                                min="0"
                                max="70"
                                value={entry?.eot_score ?? ''}
                                onChange={(e) => handleNcdcScoreChange(enrollment.student_id, 'eot', parseFloat(e.target.value))}
                                placeholder="0"
                                className="w-16 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                              />
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              {total !== null ? `${total.toFixed(1)}%` : '—'}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold">
                              <span className="px-3 py-1 rounded-full text-white bg-indigo-600">{grade || '—'}</span>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <button
                                onClick={() => saveNcdcGrades(enrollment.student_id)}
                                disabled={saving}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-xs font-medium"
                              >
                                {saving ? (
                                  <Loader className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4" />
                                )}
                                Save
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

        {/* Lesson Planner Tab */}
        {activeTab === 'lessons' && (
          <div className="space-y-6">
            {/* Generate Lesson Plan */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Lesson Plan Generator</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                    <input
                      type="text"
                      value={lessonSubject}
                      onChange={(e) => setLessonSubject(e.target.value)}
                      placeholder="e.g., Mathematics, English, Science"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Topic/Lesson</label>
                    <input
                      type="text"
                      value={lessonTopic}
                      onChange={(e) => setLessonTopic(e.target.value)}
                      placeholder="e.g., Quadratic Equations, Photosynthesis"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <button
                  onClick={handleGenerateLessonPlan}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
                >
                  <Sparkles className="h-5 w-5" />
                  Generate Lesson Plan
                </button>
              </div>
            </div>

            {/* Lesson Plan Output */}
            {lessonPlan && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{lessonPlan.topic}</h3>
                  <button
                    onClick={downloadLessonPlan}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Learning Objectives</h4>
                    <ul className="space-y-2">
                      {lessonPlan.objectives.map((obj, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium">
                            {idx + 1}
                          </span>
                          <span className="text-gray-700">{obj}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Teaching Methodology</h4>
                    <p className="text-gray-700">{lessonPlan.methodology}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Required Resources</h4>
                    <ul className="space-y-1">
                      {lessonPlan.resources.map((res, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-gray-700">
                          <Plus className="h-4 w-4 text-indigo-600" />
                          {res}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Duration</h4>
                      <p className="text-gray-700">{lessonPlan.duration}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Assessment Methods</h4>
                      <p className="text-gray-700">{lessonPlan.assessment}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

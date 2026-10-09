'use client';

/**
 * MODULE 1: Target Marks Entry Dashboard - INTEGRATED VERSION
 * Wired to live Supabase backend with atomic bulk upsert and real-time sync
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Student, AssessmentType, GradeScale } from '@/types/assessment';
import { isValidScore } from '@/lib/gradeUtils';
import { useAssessmentMarks } from '@/hooks/useAssessmentMarks';
import { useSaveMarks } from '@/hooks/useSaveMarks';

interface MarksEntryDashboardProps {
  class: string;
  subject: string;
  term: string;
  subjectId: string;
  termId: string;
  classId: string;
  students: Student[];
  assessmentType: AssessmentType;
  teacherId: string;
  teacherInitials: string;
  onSaveSuccess?: () => void;
}

interface ScoreState {
  [studentId: string]: GradeScale | undefined;
}

interface TabConfig {
  type: AssessmentType;
  label: string;
  description: string;
}

const ASSESSMENT_TABS: TabConfig[] = [
  { type: 'AOI1', label: 'AOI 1', description: 'Activity of Integration 1' },
  { type: 'AOI2', label: 'AOI 2', description: 'Activity of Integration 2' },
  { type: 'AOI3', label: 'AOI 3', description: 'Activity of Integration 3' },
  { type: 'EOT', label: 'EOT', description: 'End of Term' },
];

export const MarksEntryDashboard: React.FC<MarksEntryDashboardProps> = ({
  class: studentClass,
  subject,
  term,
  subjectId,
  termId,
  classId,
  students,
  assessmentType: initialAssessmentType,
  teacherId,
  teacherInitials,
  onSaveSuccess,
}) => {
  const [activeAssessment, setActiveAssessment] =
    useState<AssessmentType>(initialAssessmentType);
  const [scores, setScores] = useState<ScoreState>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  // Fetch existing marks from Supabase
  const { marksMap, loading: marksLoading, error: marksError, refetch: refetchMarks } =
    useAssessmentMarks({
      subjectId,
      termId,
      assessmentType: activeAssessment,
      classId,
      enabled: true,
    });

  // Initialize scores from fetched marks on mount and tab change
  useEffect(() => {
    if (marksMap) {
      const initialScores: ScoreState = {};
      marksMap.forEach((score, studentId) => {
        initialScores[studentId] = score;
      });
      setScores(initialScores);
    }
  }, [marksMap]);

  // Save marks hook
  const { saveMarks, saving, error: saveError, lastResult } =
    useSaveMarks({
      onSuccess: (result) => {
        setSaveSuccess(true);
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 4000);
        onSaveSuccess?.();
        // Refetch marks to sync with latest DB state
        refetchMarks();
      },
      onError: (error) => {
        console.error('Save failed:', error);
      },
    });

  // Filter students based on search query
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;

    const query = searchQuery.toLowerCase();
    return students.filter((student) => {
      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
      return fullName.includes(query) || student.id.toLowerCase().includes(query);
    });
  }, [students, searchQuery]);

  // Calculate completion stats for active assessment
  const completionCount = useMemo(() => {
    return Object.values(scores).filter((score) => isValidScore(score)).length;
  }, [scores]);

  const totalCount = students.length;

  // Handle score input with validation
  const handleScoreChange = (studentId: string, value: string): void => {
    if (!value.trim()) {
      setScores((prev) => {
        const updated = { ...prev };
        delete updated[studentId];
        return updated;
      });
      return;
    }

    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 3) {
      setScores((prev) => ({
        ...prev,
        [studentId]: numValue,
      }));
    }
  };

  // Atomic bulk save handler
  const handleSaveAll = useCallback(async () => {
    const marksToSave = Object.entries(scores)
      .filter(([_, score]) => isValidScore(score))
      .map(([studentId, score]) => ({
        studentId,
        score: score as GradeScale,
      }));

    if (marksToSave.length === 0) {
      alert('No marks to save. Please enter at least one score.');
      return;
    }

    await saveMarks({
      assessmentType: activeAssessment,
      subjectId,
      termId,
      classId,
      marks: marksToSave,
      teacherId,
      teacherInitials,
    });
  }, [scores, activeAssessment, subjectId, termId, classId, teacherId, teacherInitials, saveMarks]);

  const handleExport = (format: 'excel' | 'pdf' | 'template'): void => {
    console.log(`Exporting ${format.toUpperCase()} for ${subject} - ${activeAssessment}`);
    // Export logic to be implemented
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Success Notification */}
      {showNotification && saveSuccess && (
        <div className="fixed right-4 top-4 z-50 rounded-lg bg-emerald-500 text-white shadow-lg p-4 animate-slide-in">
          <div className="flex items-center gap-3">
            <span className="text-lg">✓</span>
            <div>
              <p className="font-semibold">Marks Saved Successfully</p>
              <p className="text-sm text-emerald-100">
                {lastResult?.savedCount} record(s) saved
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Notification */}
      {showNotification && saveError && (
        <div className="fixed right-4 top-4 z-50 rounded-lg bg-red-500 text-white shadow-lg p-4 animate-slide-in">
          <div className="flex items-start gap-3">
            <span className="text-lg">✕</span>
            <div>
              <p className="font-semibold">Save Failed</p>
              <p className="text-sm text-red-100">{saveError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header Section */}
      <header className="mb-8 rounded-lg bg-emerald-700 text-white shadow-md">
        <div className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold">Target Marks Entry</h1>
            <p className="mt-2 text-emerald-100">
              <span className="font-semibold">{studentClass}</span> • 
              <span className="font-semibold ml-2">{subject}</span> • 
              <span className="font-semibold ml-2">{term}</span> • 
              <span className="font-semibold ml-2">{totalCount} Students</span>
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSaveAll}
              disabled={saving || marksLoading}
              className="rounded-md bg-white px-4 py-2 font-semibold text-emerald-700 shadow hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save All'}
            </button>
            <button
              onClick={() => handleExport('template')}
              disabled={marksLoading}
              className="rounded-md border border-white px-4 py-2 font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Export Template
            </button>
            <button
              onClick={() => handleExport('excel')}
              disabled={marksLoading}
              className="rounded-md border border-white px-4 py-2 font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Export Excel
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={marksLoading}
              className="rounded-md border border-white px-4 py-2 font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Export PDF
            </button>
          </div>
        </div>
      </header>

      {/* Data Loading or Error State */}
      {marksLoading && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <p className="font-semibold">Loading marks...</p>
        </div>
      )}

      {marksError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="font-semibold">⚠ Error loading marks:</p>
          <p className="text-sm">{marksError}</p>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {ASSESSMENT_TABS.map((tab) => (
            <button
              key={tab.type}
              onClick={() => setActiveAssessment(tab.type)}
              disabled={marksLoading}
              className={`flex flex-col gap-1 rounded-md px-4 py-3 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                activeAssessment === tab.type
                  ? 'bg-emerald-700 text-white shadow'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              title={tab.description}
            >
              <span>{tab.label}</span>
              <span className="text-xs font-normal">
                {completionCount} / {totalCount} targets set
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <input
          type="text"
          placeholder="Search by student name or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-4 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          disabled={marksLoading}
        />
        {searchQuery && (
          <p className="mt-2 text-sm text-slate-600">
            Showing {filteredStudents.length} of {totalCount} students
          </p>
        )}
      </div>

      {/* Student Marks Table */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 w-12">
                #
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 w-40">
                Student ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 flex-1 min-w-48">
                Full Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 w-24">
                Stream
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 w-32">
                Score (0–3)
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length > 0 ? (
              filteredStudents.map((student, index) => (
                <tr
                  key={student.id}
                  className="border-b border-slate-100 hover:bg-emerald-50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-slate-600">{index + 1}</td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-700">{student.id}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 uppercase">
                    {`${student.firstName} ${student.lastName}`}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{student.stream}</td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      min="0"
                      max="3"
                      step="0.1"
                      placeholder="e.g. 2.1 / 3"
                      value={scores[student.id] ?? ''}
                      onChange={(e) => handleScoreChange(student.id, e.target.value)}
                      disabled={marksLoading || saving}
                      className={`w-24 rounded-md border px-2 py-1 text-center text-sm font-semibold focus:outline-none focus:ring-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        scores[student.id] !== undefined
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-900 focus:border-emerald-500 focus:ring-emerald-200'
                          : 'border-slate-300 bg-white text-slate-900 focus:border-emerald-500 focus:ring-emerald-200'
                      }`}
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No students found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Stats */}
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-700">
          <span className="font-semibold">{completionCount}</span> of{' '}
          <span className="font-semibold">{totalCount}</span> scores entered for{' '}
          <span className="font-semibold text-emerald-700">{activeAssessment}</span>
          {marksLoading && <span className="ml-2 text-emerald-600">Syncing...</span>}
        </p>
      </div>
    </div>
  );
};

export default MarksEntryDashboard;

'use client';

/**
 * MODULE 2: Printable Assessment Report Card Component
 * Semantic, print-optimized React component for formal student transcript layout
 * MODULE 3: 'Scan to Verify' QR & Verification Footer
 */

import React, { useMemo } from 'react';
import QRCode from 'qrcode.react';
import {
  StudentGradeReport,
  SchoolProfile,
  SubjectAssessment,
  AlphaGrade,
} from '@/types/assessment';
import {
  scoreToAlphaGrade,
  scoreToAchievementLevel,
  scoreToOutOf20,
  calculateAverageScore,
  GRADE_RANGE_MAPPINGS,
} from '@/lib/gradeUtils';

interface ReportCardProps {
  report: StudentGradeReport;
  school: SchoolProfile;
  showQRCode?: boolean;
}

interface AOIKeyEntry {
  subject: string;
  description: string;
}

/**
 * Main Report Card Component
 */
export const ReportCard: React.FC<ReportCardProps> = ({
  report,
  school,
  showQRCode = true,
}) => {
  // Calculate overall statistics
  const overallStats = useMemo(() => {
    const allAOIScores = report.subjects.flatMap((s) => [
      s.aoi1Score,
      s.aoi2Score,
      s.aoi3Score,
    ]);
    const allScores = [
      ...allAOIScores,
      ...report.subjects.map((s) => s.eotScore),
    ];

    const validScores = allScores.filter((s) => s !== undefined) as number[];
    const average = validScores.length
      ? validScores.reduce((a, b) => a + b) / validScores.length
      : undefined;

    return {
      averageScore: average,
      finalGrade: average ? scoreToAlphaGrade(average) : undefined,
      achievementLevel: average ? scoreToAchievementLevel(average) : undefined,
    };
  }, [report.subjects]);

  // Build AOI Key
  const aoiKeyEntries: AOIKeyEntry[] = useMemo(() => {
    return report.subjects
      .filter((s) => s.aoiKey)
      .map((s) => ({
        subject: s.subjectName,
        description: s.aoiKey || '',
      }));
  }, [report.subjects]);

  // Generate verification URL and QR payload
  const verificationUrl = `https://ou-schoolpilot.org/verify/student/${report.student.id}`;

  return (
    <article
      className="w-full bg-white text-slate-900"
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Print-optimized wrapper */}
      <div className="print:p-0 p-4 md:p-8">
        {/* ===== SCHOOL LETTERHEAD ===== */}
        <header className="mb-8 border-b-2 border-emerald-700 pb-6 text-center">
          <div className="flex flex-col items-center justify-center gap-4 md:gap-6">
            {/* Logo Placeholder */}
            {school.logoUrl ? (
              <img
                src={school.logoUrl}
                alt="School Logo"
                className="h-16 w-16 print:h-12 print:w-12"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-700 text-white print:h-12 print:w-12">
                <span className="text-2xl font-bold print:text-xl">OU</span>
              </div>
            )}

            {/* School Name */}
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-emerald-900 print:text-xl">
                {school.name}
              </h1>
              <p className="text-sm font-semibold text-slate-600 print:text-xs">
                {school.location}
              </p>
              <p className="text-xs italic text-slate-500 print:text-xs">
                "{school.motto}"
              </p>
            </div>

            {/* Contact Info */}
            <div className="space-y-0.5 text-xs text-slate-600 print:text-xs">
              <p>📧 {school.contactEmail}</p>
              <p>📱 {school.contactPhone}</p>
            </div>
          </div>
        </header>

        {/* ===== STUDENT METADATA BANNER ===== */}
        <section className="mb-8 grid grid-cols-3 gap-4 rounded-lg bg-emerald-50 p-4 print:bg-white print:border print:border-slate-300 print:p-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-slate-500 print:text-xs">
              Student Name
            </p>
            <p className="text-sm font-bold text-slate-900 uppercase print:text-sm">
              {`${report.student.firstName} ${report.student.lastName}`}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-slate-500 print:text-xs">
              Student ID
            </p>
            <p className="font-mono text-sm font-bold text-slate-900 print:text-sm">
              {report.student.id}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-slate-500 print:text-xs">
              Class & Stream
            </p>
            <p className="text-sm font-bold text-slate-900 print:text-sm">
              {report.class} - {report.student.stream}
            </p>
          </div>
        </section>

        {/* ===== ACADEMIC SUMMARY GRID ===== */}
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-emerald-900 print:text-base">
            Academic Assessment Summary
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm print:text-xs">
              <thead>
                <tr className="bg-emerald-700 text-white">
                  <th className="border border-slate-300 px-3 py-2 text-left font-semibold print:px-2 print:py-1">
                    Subject
                  </th>
                  <th className="border border-slate-300 px-3 py-2 text-center font-semibold print:px-2 print:py-1">
                    AOI 1
                  </th>
                  <th className="border border-slate-300 px-3 py-2 text-center font-semibold print:px-2 print:py-1">
                    AOI 2
                  </th>
                  <th className="border border-slate-300 px-3 py-2 text-center font-semibold print:px-2 print:py-1">
                    AOI 3
                  </th>
                  <th className="border border-slate-300 px-3 py-2 text-center font-semibold print:px-2 print:py-1">
                    EOT
                  </th>
                  <th className="border border-slate-300 px-3 py-2 text-center font-semibold print:px-2 print:py-1">
                    Average
                  </th>
                  <th className="border border-slate-300 px-3 py-2 text-center font-semibold print:px-2 print:py-1">
                    /20
                  </th>
                  <th className="border border-slate-300 px-3 py-2 text-center font-semibold print:px-2 print:py-1">
                    Grade
                  </th>
                  <th className="border border-slate-300 px-3 py-2 text-center font-semibold print:px-2 print:py-1">
                    Initials
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.subjects.map((subject) => {
                  const subjectAvg = calculateAverageScore([
                    subject.aoi1Score,
                    subject.aoi2Score,
                    subject.aoi3Score,
                    subject.eotScore,
                  ]);
                  const outOf20 = subjectAvg ? scoreToOutOf20(subjectAvg) : undefined;
                  const grade = subjectAvg ? scoreToAlphaGrade(subjectAvg) : undefined;

                  return (
                    <tr
                      key={subject.subjectId}
                      className="border-b border-slate-200 hover:bg-emerald-50 print:hover:bg-white"
                    >
                      <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-900 print:px-2 print:py-1">
                        {subject.subjectName}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-mono print:px-2 print:py-1">
                        {subject.aoi1Score?.toFixed(1) ?? '—'}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-mono print:px-2 print:py-1">
                        {subject.aoi2Score?.toFixed(1) ?? '—'}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-mono print:px-2 print:py-1">
                        {subject.aoi3Score?.toFixed(1) ?? '—'}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-mono print:px-2 print:py-1">
                        {subject.eotScore?.toFixed(1) ?? '—'}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-mono font-semibold print:px-2 print:py-1">
                        {subjectAvg?.toFixed(2) ?? '—'}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-mono font-semibold print:px-2 print:py-1">
                        {outOf20?.toFixed(1) ?? '—'}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-bold text-emerald-700 print:px-2 print:py-1">
                        {grade ?? '—'}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-mono print:px-2 print:py-1">
                        {subject.teacherInitials}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary Footer Row */}
          <div className="mt-4 grid grid-cols-3 gap-4 print:grid-cols-3 print:gap-2 print:text-xs">
            <div className="rounded-lg bg-slate-100 p-4 print:bg-white print:border print:border-slate-300 print:p-2">
              <p className="text-xs font-semibold text-slate-500 print:text-xs">
                OVERALL AVERAGE
              </p>
              <p className="text-2xl font-bold text-emerald-700 print:text-lg">
                {overallStats.averageScore?.toFixed(2) ?? '—'}
              </p>
            </div>
            <div className="rounded-lg bg-slate-100 p-4 print:bg-white print:border print:border-slate-300 print:p-2">
              <p className="text-xs font-semibold text-slate-500 print:text-xs">
                FINAL GRADE
              </p>
              <p className="text-2xl font-bold text-emerald-700 print:text-lg">
                {overallStats.finalGrade ?? '—'}
              </p>
            </div>
            <div className="rounded-lg bg-slate-100 p-4 print:bg-white print:border print:border-slate-300 print:p-2">
              <p className="text-xs font-semibold text-slate-500 print:text-xs">
                ACHIEVEMENT
              </p>
              <p className="text-lg font-bold text-emerald-700 print:text-base">
                {overallStats.achievementLevel ?? '—'}
              </p>
            </div>
          </div>
        </section>

        {/* ===== TEACHER FEEDBACK SECTIONS ===== */}
        <section className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Class Teacher Comments */}
          <div className="rounded-lg border border-slate-300 p-4 print:border print:p-3">
            <h3 className="mb-3 text-sm font-bold text-emerald-900 print:text-xs">
              CLASS TEACHER COMMENTS
            </h3>
            <div className="mb-4 min-h-24 rounded border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-700 print:min-h-16 print:bg-white print:text-xs">
              {report.classTeacherComment || '(Comments to be filled by class teacher)'}
            </div>
            <div className="flex items-end justify-between">
              <span className="text-xs text-slate-500">Signature:</span>
              <div className="border-b border-slate-400 px-4 print:border-b-0"></div>
              <span className="text-xs font-mono text-slate-700 print:text-xs">
                {report.classTeacherInitials || 'CT'}
              </span>
            </div>
          </div>

          {/* Headteacher Comments */}
          <div className="rounded-lg border border-slate-300 p-4 print:border print:p-3">
            <h3 className="mb-3 text-sm font-bold text-emerald-900 print:text-xs">
              HEADTEACHER COMMENTS
            </h3>
            <div className="mb-4 min-h-24 rounded border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-700 print:min-h-16 print:bg-white print:text-xs">
              {report.headteacherComment || '(Comments to be filled by headteacher)'}
            </div>
            <div className="flex items-end justify-between">
              <span className="text-xs text-slate-500">Signature:</span>
              <div className="border-b border-slate-400 px-4 print:border-b-0"></div>
              <span className="text-xs font-mono text-slate-700 print:text-xs">
                {report.headteacherInitials || 'HT'}
              </span>
            </div>
          </div>
        </section>

        {/* ===== GRADING RANGE REFERENCE TABLE ===== */}
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-emerald-900 print:text-base">
            Grading Range Reference
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm print:text-xs">
              <thead>
                <tr className="bg-emerald-700 text-white">
                  <th className="border border-slate-300 px-3 py-2 text-left font-semibold print:px-2 print:py-1">
                    Grade
                  </th>
                  <th className="border border-slate-300 px-3 py-2 text-center font-semibold print:px-2 print:py-1">
                    Score Range
                  </th>
                  <th className="border border-slate-300 px-3 py-2 text-left font-semibold print:px-2 print:py-1">
                    Achievement Level
                  </th>
                  <th className="border border-slate-300 px-3 py-2 text-left font-semibold print:px-2 print:py-1">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {GRADE_RANGE_MAPPINGS.map((mapping) => (
                  <tr
                    key={mapping.alphaGrade}
                    className="border-b border-slate-200 hover:bg-emerald-50 print:hover:bg-white"
                  >
                    <td className="border border-slate-300 px-3 py-2 text-center font-bold text-emerald-700 print:px-2 print:py-1">
                      {mapping.alphaGrade}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-center font-mono print:px-2 print:py-1">
                      {mapping.minScore.toFixed(1)} – {mapping.maxScore.toFixed(1)}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-900 print:px-2 print:py-1">
                      {mapping.achievementLevel}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-slate-700 print:px-2 print:py-1">
                      {mapping.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ===== AOI KEY TABLE ===== */}
        {aoiKeyEntries.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-4 text-lg font-bold text-emerald-900 print:text-base">
              Activities of Integration (AOI) Key
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm print:text-xs">
                <thead>
                  <tr className="bg-emerald-700 text-white">
                    <th className="border border-slate-300 px-3 py-2 text-left font-semibold print:px-2 print:py-1">
                      Subject
                    </th>
                    <th className="border border-slate-300 px-3 py-2 text-left font-semibold print:px-2 print:py-1">
                      Competency Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {aoiKeyEntries.map((entry) => (
                    <tr
                      key={entry.subject}
                      className="border-b border-slate-200 hover:bg-emerald-50 print:hover:bg-white"
                    >
                      <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-900 print:px-2 print:py-1">
                        {entry.subject}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-slate-700 print:px-2 print:py-1">
                        {entry.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ===== MODULE 3: QR CODE VERIFICATION FOOTER ===== */}
        {showQRCode && (
          <footer className="border-t-2 border-emerald-700 pt-6 print:page-break-inside-avoid">
            <div className="flex items-center justify-center gap-6 print:gap-4">
              <div className="flex flex-col items-center justify-center">
                <div className="rounded-lg border-2 border-slate-300 bg-white p-2 print:border print:border-slate-300 print:p-1.5">
                  <QRCode
                    value={verificationUrl}
                    size={120}
                    level="H"
                    includeMargin={true}
                    className="print:w-20 print:h-20"
                  />
                </div>
                <p className="mt-2 text-center text-xs font-bold uppercase text-slate-700 tracking-widest print:text-xs">
                  SCAN TO VERIFY
                </p>
                <p className="mt-1 text-center text-xs text-slate-500 print:text-xs">
                  {report.student.id}
                </p>
              </div>
            </div>

            {/* Report metadata footer */}
            <div className="mt-6 border-t border-slate-300 pt-4 text-center text-xs text-slate-500 print:text-xs">
              <p>
                Report Date: <span className="font-mono">{report.reportDate || new Date().toLocaleDateString()}</span>
              </p>
              <p>Term: {report.term}</p>
              <p className="mt-2 italic">
                This is an official academic transcript. Tampering or reproduction without authorization is prohibited.
              </p>
            </div>
          </footer>
        )}
      </div>
    </article>
  );
};

export default ReportCard;

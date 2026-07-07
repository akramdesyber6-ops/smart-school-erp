'use client';

import React from 'react';
import ReportCard from '@/components/ReportCard';
import { StudentGradeReport, SchoolProfile } from '@/types/assessment';

// Mock school profile
const mockSchool: SchoolProfile = {
  name: 'ONWARDS AND UPWARDS SECONDARY SCHOOL - BULOBA',
  location: 'Buloba, Kampala, Uganda',
  motto: 'Excellence Through Competence',
  contactEmail: 'info@ou-schoolpilot.org',
  contactPhone: '+256-701-234-567',
  letterheadBgColor: 'bg-emerald-50',
};

// Mock student report
const mockReport: StudentGradeReport = {
  student: {
    id: 'OU-STD-2026-0001',
    firstName: 'John',
    lastName: 'Okello',
    stream: 'East',
    class: 'Senior One',
  },
  class: 'Senior One',
  term: 'Term 1 2026',
  academicYear: '2026',
  subjects: [
    {
      subjectId: 'AGR001',
      subjectName: 'Agriculture',
      teacherInitials: 'JM',
      aoi1Score: 2.8,
      aoi2Score: 2.5,
      aoi3Score: 2.9,
      eotScore: 2.7,
      aoiKey: 'Soil conservation and crop production techniques',
    },
    {
      subjectId: 'ENG001',
      subjectName: 'English Language',
      teacherInitials: 'SM',
      aoi1Score: 2.5,
      aoi2Score: 2.3,
      aoi3Score: 2.6,
      eotScore: 2.4,
      aoiKey: 'Written and oral communication skills',
    },
    {
      subjectId: 'MAT001',
      subjectName: 'Mathematics',
      teacherInitials: 'DK',
      aoi1Score: 2.2,
      aoi2Score: 2.0,
      aoi3Score: 2.4,
      eotScore: 2.1,
      aoiKey: 'Algebraic and geometric problem solving',
    },
    {
      subjectId: 'SCI001',
      subjectName: 'Integrated Science',
      teacherInitials: 'PN',
      aoi1Score: 2.6,
      aoi2Score: 2.7,
      aoi3Score: 2.8,
      eotScore: 2.9,
      aoiKey: 'Scientific inquiry and experimental methodology',
    },
    {
      subjectId: 'SOC001',
      subjectName: 'Social Studies',
      teacherInitials: 'RN',
      aoi1Score: 2.9,
      aoi2Score: 2.8,
      aoi3Score: 2.7,
      eotScore: 2.9,
      aoiKey: 'Civic and historical understanding',
    },
  ],
  classTeacherComment:
    'John demonstrates excellent engagement in class activities. He shows strong leadership qualities and consistently completes assignments on time. Continue focusing on collaborative skills.',
  headteacherComment:
    'John has shown remarkable improvement in academic performance this term. His participation in school activities is commendable. Maintain this positive trajectory.',
  classTeacherInitials: 'JM',
  headteacherInitials: 'AK',
  reportDate: new Date().toLocaleDateString('en-UG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }),
};

interface ReportCardPageProps {
  params: {
    studentId: string;
  };
}

export default function ReportCardPage({ params }: ReportCardPageProps) {
  // In a real app, fetch the report based on params.studentId
  // For now, using mock data

  return (
    <div className="min-h-screen bg-slate-100 py-8">
      <div className="mx-auto max-w-4xl">
        {/* Print and Download Controls */}
        <div className="mb-6 flex gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-emerald-700 px-6 py-2 font-semibold text-white shadow hover:bg-emerald-800 transition-colors"
          >
            🖨️ Print
          </button>
          <button
            onClick={() => {
              const element = document.getElementById('report-card');
              if (element) {
                // Trigger browser print dialog which can save as PDF
                window.print();
              }
            }}
            className="rounded-lg bg-blue-700 px-6 py-2 font-semibold text-white shadow hover:bg-blue-800 transition-colors"
          >
            📥 Save as PDF
          </button>
        </div>

        {/* Report Card Component */}
        <div
          id="report-card"
          className="rounded-lg shadow-lg print:rounded-none print:shadow-none"
        >
          <ReportCard report={mockReport} school={mockSchool} showQRCode={true} />
        </div>
      </div>
    </div>
  );
}

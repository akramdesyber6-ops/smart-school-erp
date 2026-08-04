// src/app/api/report-cards/route.ts
// Generate and retrieve report cards with auto-calculation

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/api';
import { 
  ReportCardRow,
  ApiListResponse, 
  ApiResponse, 
  ApiErrorResponse 
} from '@/lib/supabase/types';

/**
 * GET /api/report-cards
 * Retrieve report cards for a term/class/student
 * Query Parameters:
 *   - termId: string (required)
 *   - classId: string (optional)
 *   - studentId: string (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const termId = searchParams.get('termId');
    const classId = searchParams.get('classId');
    const studentId = searchParams.get('studentId');

    if (!termId) {
      return NextResponse.json(
        {
          success: false,
          error: 'termId parameter is required',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        } as ApiErrorResponse,
        { status: 400 }
      );
    }

    let query = supabase
      .from('report_cards')
      .select(`
        *,
        student:students(
          admission_number,
          user:users(first_name, last_name)
        ),
        term:terms(name),
        class:classes(name),
        subject_results(
          subject_id,
          total_marks,
          obtained_marks,
          grade,
          grade_points,
          subject:subjects(name, code)
        )
      `)
      .eq('term_id', termId);

    if (classId) {
      query = query.eq('class_id', classId);
    }

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    const { data, error } = await query.order('average_score', { ascending: false });

    if (error) {
      console.error('Error fetching report cards:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          statusCode: 500,
          timestamp: new Date().toISOString(),
        } as ApiErrorResponse,
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      total: data?.length || 0,
      timestamp: new Date().toISOString(),
    } as ApiListResponse<ReportCardRow>);
  } catch (error) {
    console.error('Unexpected error in GET /api/report-cards:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      } as ApiErrorResponse,
      { status: 500 }
    );
  }
}

/**
 * POST /api/report-cards
 * Generate report cards for a class in a term (auto-calculation from exam marks)
 * Body: { schoolId, termId, classId }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      school_id: string;
      term_id: string;
      class_id: string;
    };

    const { school_id, term_id, class_id } = body;

    if (!school_id || !term_id || !class_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: school_id, term_id, class_id',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        } as ApiErrorResponse,
        { status: 400 }
      );
    }

    // Get all students enrolled in the class for this term
    const { data: enrollments, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('student_id')
      .eq('class_id', class_id)
      .eq('term_id', term_id);

    if (enrollmentError || !enrollments || enrollments.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No students found for this class/term',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        } as ApiErrorResponse,
        { status: 404 }
      );
    }

    // Get all exams for this term and class
    const { data: exams, error: examsError } = await supabase
      .from('exams')
      .select('id, subject_id, total_marks, passing_marks')
      .eq('term_id', term_id)
      .eq('class_id', class_id);

    if (examsError || !exams || exams.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No exams found for this term/class',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        } as ApiErrorResponse,
        { status: 404 }
      );
    }

    const reportCards: any[] = [];

    // Generate report card for each student
    for (const enrollment of enrollments) {
      // Get marks for all exams for this student
      const { data: markEntries } = await supabase
        .from('markbook_entries')
        .select('exam_id, raw_score, grade, grade_points')
        .eq('student_id', enrollment.student_id)
        .in('exam_id', exams.map((e) => e.id));

      if (!markEntries || markEntries.length === 0) {
        continue;
      }

      // Calculate statistics
      const validMarks = markEntries.filter((m) => m.raw_score !== null);
      const averageScore = validMarks.length > 0
        ? validMarks.reduce((sum, m) => sum + (m.raw_score || 0), 0) / validMarks.length
        : 0;

      const passingYears = exams.filter((exam) => {
        const mark = markEntries.find((m) => m.exam_id === exam.id);
        return mark && mark.raw_score !== null && mark.raw_score >= exam.passing_marks;
      }).length;

      // Get overall grade based on average
      const { data: gradingScales } = await supabase
        .from('grading_scales')
        .select('min_score, max_score, grade')
        .eq('school_id', school_id)
        .lte('min_score', averageScore)
        .gte('max_score', averageScore)
        .limit(1);

      const overallGrade = gradingScales && gradingScales.length > 0
        ? gradingScales[0].grade
        : null;

      reportCards.push({
        school_id,
        student_id: enrollment.student_id,
        term_id,
        class_id,
        total_subjects: exams.length,
        subjects_passed: passingYears,
        average_score: Math.round(averageScore * 100) / 100,
        overall_grade: overallGrade,
        generated_at: new Date().toISOString(),
      });
    }

    // Insert report cards
    const { data, error } = await supabase
      .from('report_cards')
      .upsert(reportCards, {
        onConflict: 'school_id,student_id,term_id',
      })
      .select();

    if (error) {
      console.error('Error generating report cards:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          statusCode: 400,
          timestamp: new Date().toISOString(),
        } as ApiErrorResponse,
        { status: 400 }
      );
    }

    // Generate subject results for each report card (if needed)
    if (data && data.length > 0) {
      await generateSubjectResults(school_id, data, exams);
    }

    return NextResponse.json(
      {
        success: true,
        data,
        message: `Generated report cards for ${data.length} students`,
        timestamp: new Date().toISOString(),
      } as ApiResponse<ReportCardRow[]>,
      { status: 201 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/report-cards:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      } as ApiErrorResponse,
      { status: 500 }
    );
  }
}

/**
 * Helper function: Generate subject results for report cards
 */
async function generateSubjectResults(
  schoolId: string,
  reportCards: any[],
  exams: any[]
) {
  try {
    const subjectResults: any[] = [];

    for (const reportCard of reportCards) {
      for (const exam of exams) {
        const { data: markEntry } = await supabase
          .from('markbook_entries')
          .select('raw_score, grade, grade_points')
          .eq('student_id', reportCard.student_id)
          .eq('exam_id', exam.id)
          .single();

        if (markEntry) {
          subjectResults.push({
            school_id: schoolId,
            report_card_id: reportCard.id,
            subject_id: exam.subject_id,
            total_marks: exam.total_marks,
            obtained_marks: markEntry.raw_score,
            grade: markEntry.grade,
            grade_points: markEntry.grade_points,
          });
        }
      }
    }

    if (subjectResults.length > 0) {
      await supabase
        .from('subject_results')
        .upsert(subjectResults, {
          onConflict: 'school_id,report_card_id,subject_id',
        });
    }
  } catch (error) {
    console.error('Error generating subject results:', error);
  }
}

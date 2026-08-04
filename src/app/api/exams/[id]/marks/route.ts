// src/app/api/exams/[id]/marks/route.ts
// Submit and manage marks for exams with auto-grading

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/api';
import { 
  MarkbookEntryRow,
  SubmitMarksPayload,
  ApiResponse, 
  ApiListResponse,
  ApiErrorResponse 
} from '@/lib/supabase/types';

/**
 * GET /api/exams/[id]/marks
 * Get markbook entries for an exam
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { data, error } = await supabase
      .from('markbook_entries')
      .select(`
        *,
        exam:exams(name, total_marks, passing_marks),
        student:students(
          admission_number,
          user:users(first_name, last_name)
        ),
        submitted_by:users(first_name, last_name)
      `)
      .eq('exam_id', id)
      .order('raw_score', { ascending: false });

    if (error) {
      console.error('Error fetching marks:', error);
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
    } as ApiListResponse<MarkbookEntryRow>);
  } catch (error) {
    console.error('Unexpected error in GET /api/exams/[id]/marks:', error);
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
 * POST /api/exams/[id]/marks
 * Submit marks for students in an exam with auto-grading
 * Body: SubmitMarksPayload
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json() as SubmitMarksPayload;

    if (!Array.isArray(body.marks) || body.marks.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid marks array provided',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        } as ApiErrorResponse,
        { status: 400 }
      );
    }

    // Get exam details for grading
    const { data: examData, error: examError } = await supabase
      .from('exams')
      .select('*')
      .eq('id', id)
      .single();

    if (examError || !examData) {
      return NextResponse.json(
        {
          success: false,
          error: 'Exam not found',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        } as ApiErrorResponse,
        { status: 404 }
      );
    }

    // Get grading scale for the school
    const { data: gradingScale, error: gradingError } = await supabase
      .from('grading_scales')
      .select('*')
      .eq('school_id', examData.school_id)
      .order('min_score', { ascending: false });

    if (gradingError) {
      console.error('Error fetching grading scale:', gradingError);
    }

    // Process each mark entry
    const markbookEntries = body.marks.map((mark) => {
      const { grade, gradePoints } = calculateGrade(mark.raw_score, gradingScale || []);

      return {
        school_id: examData.school_id,
        exam_id: id,
        student_id: mark.student_id,
        raw_score: mark.raw_score,
        grade,
        grade_points: gradePoints,
        is_submitted: true,
        submitted_at: new Date().toISOString(),
      };
    });

    // Upsert markbook entries
    const { data, error } = await supabase
      .from('markbook_entries')
      .upsert(markbookEntries, {
        onConflict: 'school_id,exam_id,student_id',
      })
      .select();

    if (error) {
      console.error('Error submitting marks:', error);
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

    return NextResponse.json(
      {
        success: true,
        data,
        message: `Submitted marks for ${data.length} students with auto-grading`,
        timestamp: new Date().toISOString(),
      } as ApiResponse<MarkbookEntryRow[]>,
      { status: 201 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/exams/[id]/marks:', error);
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
 * Helper function: Calculate grade based on raw score and grading scale
 */
function calculateGrade(
  rawScore: number | null,
  gradingScale: any[]
): { grade: string | null; gradePoints: number | null } {
  if (rawScore === null || gradingScale.length === 0) {
    return { grade: null, gradePoints: null };
  }

  const gradeEntry = gradingScale.find(
    (scale) => rawScore >= scale.min_score && rawScore <= scale.max_score
  );

  if (!gradeEntry) {
    return { grade: null, gradePoints: null };
  }

  return {
    grade: gradeEntry.grade,
    gradePoints: gradeEntry.grade_points,
  };
}

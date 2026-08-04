// src/app/api/exams/route.ts
// Exam Management API
// GET: List exams, POST: Create exam

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/api';
import { 
  ExamRow,
  ApiListResponse, 
  ApiResponse, 
  CreateExamPayload,
  ApiErrorResponse 
} from '@/lib/supabase/types';

/**
 * GET /api/exams
 * List all exams with filters
 * Query Parameters:
 *   - termId: string (optional)
 *   - classId: string (optional)
 *   - subjectId: string (optional)
 *   - examType: string (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const termId = searchParams.get('termId');
    const classId = searchParams.get('classId');
    const subjectId = searchParams.get('subjectId');
    const examType = searchParams.get('examType');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const offset = (page - 1) * pageSize;

    let query = supabase
      .from('exams')
      .select(`
        *,
        term:terms(name, year:years(name)),
        subject:subjects(name, code),
        class:classes(name, level)
      `, { count: 'exact' });

    if (termId) {
      query = query.eq('term_id', termId);
    }
    if (classId) {
      query = query.eq('class_id', classId);
    }
    if (subjectId) {
      query = query.eq('subject_id', subjectId);
    }
    if (examType) {
      query = query.eq('exam_type', examType);
    }

    const { data, error, count } = await query
      .range(offset, offset + pageSize - 1)
      .order('exam_date', { ascending: false });

    if (error) {
      console.error('Error fetching exams:', error);
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

    const totalPages = count ? Math.ceil(count / pageSize) : 0;

    return NextResponse.json({
      success: true,
      data: data || [],
      total: count || 0,
      page,
      pageSize,
      totalPages,
      timestamp: new Date().toISOString(),
    } as ApiListResponse<ExamRow>);
  } catch (error) {
    console.error('Unexpected error in GET /api/exams:', error);
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
 * POST /api/exams
 * Create a new exam
 * Body: CreateExamPayload
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CreateExamPayload;

    // Validate required fields
    const requiredFields = ['school_id', 'term_id', 'subject_id', 'class_id', 'exam_type', 'name', 'exam_date', 'total_marks', 'passing_marks'];
    const missingFields = requiredFields.filter((field) => !body[field as keyof CreateExamPayload]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`,
          statusCode: 400,
          timestamp: new Date().toISOString(),
        } as ApiErrorResponse,
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('exams')
      .insert([{
        school_id: body.school_id,
        term_id: body.term_id,
        subject_id: body.subject_id,
        class_id: body.class_id,
        exam_type: body.exam_type,
        name: body.name,
        exam_date: body.exam_date,
        total_marks: body.total_marks,
        passing_marks: body.passing_marks,
        duration_minutes: body.duration_minutes,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating exam:', error);
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
        message: 'Exam created successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<ExamRow>,
      { status: 201 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/exams:', error);
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

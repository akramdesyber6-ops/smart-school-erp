// src/app/api/attendance/summary/route.ts
// Get attendance summaries for students

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/api';
import { 
  AttendanceSummaryRow,
  ApiListResponse, 
  ApiResponse, 
  ApiErrorResponse 
} from '@/lib/supabase/types';

/**
 * GET /api/attendance/summary
 * Get attendance summaries for students in a class/term
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
      .from('attendance_summaries')
      .select(`
        *,
        student:students(
          admission_number,
          user:users(first_name, last_name)
        ),
        enrollment:enrollments(class_id)
      `)
      .eq('term_id', termId);

    if (classId) {
      query = query.eq('enrollment.class_id', classId);
    }

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    const { data, error } = await query.order('attendance_percentage', { ascending: false });

    if (error) {
      console.error('Error fetching attendance summaries:', error);
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
    } as ApiResponse<AttendanceSummaryRow[]>);
  } catch (error) {
    console.error('Unexpected error in GET /api/attendance/summary:', error);
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

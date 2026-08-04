// src/app/api/attendance/route.ts
// Attendance tracking API
// GET: List attendance, POST: Record attendance

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/api';
import { 
  AttendanceRecordRow,
  RecordAttendancePayload,
  ApiListResponse, 
  ApiResponse, 
  ApiErrorResponse 
} from '@/lib/supabase/types';

/**
 * GET /api/attendance
 * List attendance records with filters
 * Query Parameters:
 *   - classId: string (required)
 *   - date: string (optional, filter by date)
 *   - studentId: string (optional, filter by student)
 *   - status: string (optional, filter by status)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const date = searchParams.get('date');
    const studentId = searchParams.get('studentId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');

    if (!classId) {
      return NextResponse.json(
        {
          success: false,
          error: 'classId parameter is required',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        } as ApiErrorResponse,
        { status: 400 }
      );
    }

    const offset = (page - 1) * pageSize;

    let query = supabase
      .from('attendance_records')
      .select(`
        *,
        student:students(admission_number, user:users(first_name, last_name)),
        recorded_by:users(first_name, last_name)
      `, { count: 'exact' })
      .eq('class_id', classId);

    if (date) {
      query = query.eq('date', date);
    }
    if (studentId) {
      query = query.eq('student_id', studentId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query
      .range(offset, offset + pageSize - 1)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching attendance:', error);
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
    } as ApiListResponse<AttendanceRecordRow>);
  } catch (error) {
    console.error('Unexpected error in GET /api/attendance:', error);
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
 * POST /api/attendance
 * Record attendance for multiple students in a class
 * Body: RecordAttendancePayload
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RecordAttendancePayload;

    // Validate required fields
    if (!body.class_id || !body.date || !Array.isArray(body.attendance) || body.attendance.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: class_id, date, attendance array',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        } as ApiErrorResponse,
        { status: 400 }
      );
    }

    // Get school_id from first enrollment (for multi-tenant support)
    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('school_id')
      .eq('class_id', body.class_id)
      .limit(1)
      .single();

    if (enrollmentError || !enrollmentData) {
      return NextResponse.json(
        {
          success: false,
          error: 'Class not found',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        } as ApiErrorResponse,
        { status: 404 }
      );
    }

    // Prepare attendance records
    const attendanceRecords = body.attendance.map((record) => ({
      school_id: enrollmentData.school_id,
      student_id: record.student_id,
      class_id: body.class_id,
      date: body.date,
      status: record.status,
      remarks: record.remarks,
      recorded_by: null, // Would be set from auth context in production
    }));

    // Insert attendance records
    const { data, error } = await supabase
      .from('attendance_records')
      .upsert(attendanceRecords, {
        onConflict: 'school_id,student_id,class_id,date',
      })
      .select();

    if (error) {
      console.error('Error recording attendance:', error);
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

    // Calculate and update attendance summary for this term
    await updateAttendanceSummary(enrollmentData.school_id, body.class_id, body.date);

    return NextResponse.json(
      {
        success: true,
        data,
        message: `Recorded attendance for ${data.length} students`,
        timestamp: new Date().toISOString(),
      } as ApiResponse<AttendanceRecordRow[]>,
      { status: 201 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/attendance:', error);
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
 * Helper function: Update attendance summaries for the term
 */
async function updateAttendanceSummary(
  schoolId: string,
  classId: string,
  recordDate: string
) {
  try {
    // Get the term for this date
    const { data: termData, error: termError } = await supabase
      .from('terms')
      .select('id')
      .eq('school_id', schoolId)
      .lte('start_date', recordDate)
      .gte('end_date', recordDate)
      .single();

    if (termError || !termData) {
      console.warn('Could not find term for date:', recordDate);
      return;
    }

    // Get all enrollments for this class in this term
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('student_id')
      .eq('class_id', classId)
      .eq('term_id', termData.id);

    if (!enrollments || enrollments.length === 0) {
      return;
    }

    // For each student, recalculate their attendance summary
    for (const enrollment of enrollments) {
      const { data: records } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('student_id', enrollment.student_id)
        .eq('class_id', classId)
        .gte('date', (await supabase
          .from('terms')
          .select('start_date')
          .eq('id', termData.id)
          .single()).data?.start_date)
        .lte('date', recordDate);

      if (!records) continue;

      const totalDays = records.length;
      const daysPresent = records.filter((r) => r.status === 'present').length;
      const daysAbsent = records.filter((r) => r.status === 'absent').length;
      const daysLate = records.filter((r) => r.status === 'late').length;
      const daysExcused = records.filter((r) => r.status === 'excused').length;
      const attendancePercentage = totalDays > 0 ? (daysPresent / totalDays) * 100 : 0;

      // Upsert summary
      await supabase
        .from('attendance_summaries')
        .upsert({
          school_id: schoolId,
          student_id: enrollment.student_id,
          term_id: termData.id,
          total_days: totalDays,
          days_present: daysPresent,
          days_absent: daysAbsent,
          days_late: daysLate,
          days_excused: daysExcused,
          attendance_percentage: Math.round(attendancePercentage * 100) / 100,
        }, {
          onConflict: 'school_id,student_id,term_id',
        });
    }
  } catch (error) {
    console.error('Error updating attendance summary:', error);
  }
}

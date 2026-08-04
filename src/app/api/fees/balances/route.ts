// src/app/api/fees/balances/route.ts
// Student Fee Balance Management with automatic calculations

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/api';
import { 
  StudentFeeBalanceRow,
  ProcessFeePaymentPayload,
  ApiListResponse, 
  ApiResponse, 
  ApiErrorResponse 
} from '@/lib/supabase/types';

/**
 * GET /api/fees/balances
 * Get fee balances for students
 * Query Parameters:
 *   - termId: string (required)
 *   - classId: string (optional)
 *   - studentId: string (optional)
 *   - status: string (optional, paid/pending/partial/overdue)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const termId = searchParams.get('termId');
    const classId = searchParams.get('classId');
    const studentId = searchParams.get('studentId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');

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

    const offset = (page - 1) * pageSize;

    let query = supabase
      .from('student_fee_balances')
      .select(`
        *,
        student:students(
          admission_number,
          user:users(first_name, last_name)
        ),
        term:terms(name),
        enrollment:enrollments(class_id, class:classes(name))
      `, { count: 'exact' })
      .eq('term_id', termId);

    if (classId) {
      query = query.eq('enrollment.class_id', classId);
    }

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query
      .range(offset, offset + pageSize - 1)
      .order('balance', { ascending: false });

    if (error) {
      console.error('Error fetching fee balances:', error);
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
    } as ApiListResponse<StudentFeeBalanceRow>);
  } catch (error) {
    console.error('Unexpected error in GET /api/fees/balances:', error);
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
 * POST /api/fees/balances/initialize
 * Initialize fee balances for students in a class/term based on fee structures
 * Body: { schoolId, classId, termId }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      school_id: string;
      class_id: string;
      term_id: string;
    };

    const { school_id, class_id, term_id } = body;

    if (!school_id || !class_id || !term_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: school_id, class_id, term_id',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        } as ApiErrorResponse,
        { status: 400 }
      );
    }

    // Get all fee structures for this class/term
    const { data: structures, error: structuresError } = await supabase
      .from('fee_structures')
      .select('amount')
      .eq('school_id', school_id)
      .eq('class_id', class_id)
      .eq('term_id', term_id)
      .eq('is_active', true);

    if (structuresError || !structures) {
      return NextResponse.json(
        {
          success: false,
          error: 'Error fetching fee structures',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        } as ApiErrorResponse,
        { status: 400 }
      );
    }

    const totalFees = structures.reduce((sum, s) => sum + (s.amount || 0), 0);

    // Get all enrollments for this class/term
    const { data: enrollments, error: enrollmentsError } = await supabase
      .from('enrollments')
      .select('student_id')
      .eq('class_id', class_id)
      .eq('term_id', term_id);

    if (enrollmentsError || !enrollments) {
      return NextResponse.json(
        {
          success: false,
          error: 'Error fetching enrollments',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        } as ApiErrorResponse,
        { status: 400 }
      );
    }

    // Create balance records for each student
    const balanceRecords = enrollments.map((e) => ({
      school_id,
      student_id: e.student_id,
      term_id,
      total_fees: totalFees,
      amount_paid: 0,
      balance: totalFees,
      status: 'pending' as const,
    }));

    const { data, error } = await supabase
      .from('student_fee_balances')
      .upsert(balanceRecords, {
        onConflict: 'school_id,student_id,term_id',
      })
      .select();

    if (error) {
      console.error('Error initializing fee balances:', error);
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
        message: `Initialized fee balances for ${data.length} students`,
        timestamp: new Date().toISOString(),
      } as ApiResponse<StudentFeeBalanceRow[]>,
      { status: 201 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/fees/balances/initialize:', error);
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

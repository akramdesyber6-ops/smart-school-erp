// src/app/api/students/route.ts
// Student Management API Routes
// GET: List students, POST: Create student

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/api';
import { 
  StudentRow, 
  ApiListResponse, 
  ApiResponse, 
  CreateStudentPayload,
  ApiErrorResponse 
} from '@/lib/supabase/types';

/**
 * GET /api/students
 * List all students for the authenticated user's school
 * Query Parameters:
 *   - page: number (default: 1)
 *   - pageSize: number (default: 20)
 *   - classId: string (optional, filter by class)
 *   - searchQuery: string (optional, search by name or admission number)
 *   - status: string (optional, filter by enrollment status)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const classId = searchParams.get('classId');
    const searchQuery = searchParams.get('searchQuery');
    const status = searchParams.get('status');

    // Validate pagination
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid pagination parameters',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        } as ApiErrorResponse,
        { status: 400 }
      );
    }

    const offset = (page - 1) * pageSize;

    // Build the base query
    let query = supabase
      .from('students')
      .select('*', { count: 'exact' });

    // Apply filters
    if (classId) {
      query = query.eq('id', classId);
    }

    if (searchQuery) {
      query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,admission_number.ilike.%${searchQuery}%`);
    }

    // Execute query
    const { data, error, count } = await query
      .range(offset, offset + pageSize - 1)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching students:', error);
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
    } as ApiListResponse<StudentRow>);
  } catch (error) {
    console.error('Unexpected error in GET /api/students:', error);
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
 * POST /api/students
 * Create a new student
 * Body: CreateStudentPayload
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CreateStudentPayload;

    // Validate required fields
    if (!body.school_id || !body.admission_number) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: school_id, admission_number',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        } as ApiErrorResponse,
        { status: 400 }
      );
    }

    // Insert student
    const { data, error } = await supabase
      .from('students')
      .insert([{
        school_id: body.school_id,
        user_id: body.user_id,
        admission_number: body.admission_number,
        date_of_birth: body.date_of_birth,
        gender: body.gender,
        parent_name: body.parent_name,
        parent_phone: body.parent_phone,
        parent_email: body.parent_email,
        address: body.address,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating student:', error);
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
        message: 'Student created successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<StudentRow>,
      { status: 201 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/students:', error);
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

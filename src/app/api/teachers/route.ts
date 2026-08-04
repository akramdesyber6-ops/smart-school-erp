// src/app/api/teachers/route.ts
// Teacher Management API Routes
// GET: List teachers, POST: Create teacher

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/api';
import { 
  TeacherRow, 
  ApiListResponse, 
  ApiResponse, 
  CreateTeacherPayload,
  ApiErrorResponse 
} from '@/lib/supabase/types';

/**
 * GET /api/teachers
 * List all teachers for the authenticated user's school
 * Query Parameters:
 *   - page: number (default: 1)
 *   - pageSize: number (default: 20)
 *   - status: string (optional, filter by status: active, inactive, on_leave)
 *   - searchQuery: string (optional, search by name or employee ID)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const status = searchParams.get('status');
    const searchQuery = searchParams.get('searchQuery');

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

    // Build query
    let query = supabase
      .from('teachers')
      .select(`
        *,
        user:users(id, first_name, last_name, email, phone)
      `, { count: 'exact' });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (searchQuery) {
      query = query.or(`employee_id.ilike.%${searchQuery}%`);
    }

    const { data, error, count } = await query
      .range(offset, offset + pageSize - 1)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching teachers:', error);
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
    } as ApiListResponse<TeacherRow>);
  } catch (error) {
    console.error('Unexpected error in GET /api/teachers:', error);
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
 * POST /api/teachers
 * Create a new teacher
 * Body: CreateTeacherPayload
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CreateTeacherPayload;

    // Validate required fields
    if (!body.school_id || !body.employee_id || !body.employment_date) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: school_id, employee_id, employment_date',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        } as ApiErrorResponse,
        { status: 400 }
      );
    }

    // Insert teacher
    const { data, error } = await supabase
      .from('teachers')
      .insert([{
        school_id: body.school_id,
        user_id: body.user_id,
        employee_id: body.employee_id,
        qualification: body.qualification,
        date_of_birth: body.date_of_birth,
        gender: body.gender,
        phone: body.phone,
        address: body.address,
        employment_date: body.employment_date,
        status: body.status || 'active',
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating teacher:', error);
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
        message: 'Teacher created successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<TeacherRow>,
      { status: 201 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/teachers:', error);
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

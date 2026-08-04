// src/app/api/classes/route.ts
// Class Management API Routes
// GET: List classes, POST: Create class

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/api';
import { 
  ClassRow, 
  ApiListResponse, 
  ApiResponse, 
  ApiErrorResponse 
} from '@/lib/supabase/types';

/**
 * GET /api/classes
 * List all classes for the school
 * Query Parameters:
 *   - page: number (default: 1)
 *   - pageSize: number (default: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

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

    const { data, error, count } = await supabase
      .from('classes')
      .select(`
        *,
        form_teacher:users(id, first_name, last_name, email),
        students:enrollments(count),
        subjects:class_subjects(subject_id, subject:subjects(name))
      `, { count: 'exact' })
      .range(offset, offset + pageSize - 1)
      .order('level', { ascending: true });

    if (error) {
      console.error('Error fetching classes:', error);
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
    } as ApiListResponse<ClassRow>);
  } catch (error) {
    console.error('Unexpected error in GET /api/classes:', error);
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
 * POST /api/classes
 * Create a new class
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<ClassRow>;

    // Validate required fields
    if (!body.school_id || !body.name || body.level === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: school_id, name, level',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        } as ApiErrorResponse,
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('classes')
      .insert([{
        school_id: body.school_id,
        name: body.name,
        stream: body.stream,
        level: body.level,
        form_teacher_id: body.form_teacher_id,
        capacity: body.capacity,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating class:', error);
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
        message: 'Class created successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<ClassRow>,
      { status: 201 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/classes:', error);
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

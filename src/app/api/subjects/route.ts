// src/app/api/subjects/route.ts
// Subject Management API Routes

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/api';
import { 
  SubjectRow, 
  ApiListResponse, 
  ApiResponse, 
  ApiErrorResponse 
} from '@/lib/supabase/types';

/**
 * GET /api/subjects
 * List all subjects for the school
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');

    const offset = (page - 1) * pageSize;

    const { data, error, count } = await supabase
      .from('subjects')
      .select('*', { count: 'exact' })
      .range(offset, offset + pageSize - 1)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching subjects:', error);
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
    } as ApiListResponse<SubjectRow>);
  } catch (error) {
    console.error('Unexpected error in GET /api/subjects:', error);
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
 * POST /api/subjects
 * Create a new subject
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<SubjectRow>;

    if (!body.school_id || !body.name) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: school_id, name',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        } as ApiErrorResponse,
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('subjects')
      .insert([{
        school_id: body.school_id,
        name: body.name,
        code: body.code,
        description: body.description,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating subject:', error);
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
        message: 'Subject created successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<SubjectRow>,
      { status: 201 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/subjects:', error);
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

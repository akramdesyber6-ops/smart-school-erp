// src/app/api/teachers/[id]/route.ts
// Teacher detail endpoints: GET, UPDATE, DELETE

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/api';
import { 
  TeacherRow, 
  ApiResponse, 
  UpdateTeacherPayload,
  ApiErrorResponse 
} from '@/lib/supabase/types';

/**
 * GET /api/teachers/[id]
 * Get a specific teacher by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { data, error } = await supabase
      .from('teachers')
      .select(`
        *,
        user:users(id, first_name, last_name, email, phone),
        assigned_classes:class_subjects(id, class_id, subject_id, subject:subjects(name))
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching teacher:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Teacher not found',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        } as ApiErrorResponse,
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    } as ApiResponse<TeacherRow>);
  } catch (error) {
    console.error('Unexpected error in GET /api/teachers/[id]:', error);
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
 * PATCH /api/teachers/[id]
 * Update a specific teacher
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json() as UpdateTeacherPayload;

    // Prevent updating school_id and employee_id
    if (body.school_id) {
      delete body.school_id;
    }
    if (body.employee_id) {
      delete body.employee_id;
    }

    const { data, error } = await supabase
      .from('teachers')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating teacher:', error);
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

    return NextResponse.json({
      success: true,
      data,
      message: 'Teacher updated successfully',
      timestamp: new Date().toISOString(),
    } as ApiResponse<TeacherRow>);
  } catch (error) {
    console.error('Unexpected error in PATCH /api/teachers/[id]:', error);
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
 * DELETE /api/teachers/[id]
 * Delete a specific teacher
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { error } = await supabase
      .from('teachers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting teacher:', error);
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

    return NextResponse.json({
      success: true,
      message: 'Teacher deleted successfully',
      timestamp: new Date().toISOString(),
    } as ApiResponse<null>);
  } catch (error) {
    console.error('Unexpected error in DELETE /api/teachers/[id]:', error);
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

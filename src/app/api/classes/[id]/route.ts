// src/app/api/classes/[id]/route.ts
// Class detail endpoints: GET, UPDATE, DELETE

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/api';
import { 
  ClassRow, 
  ApiResponse, 
  ApiErrorResponse 
} from '@/lib/supabase/types';

/**
 * GET /api/classes/[id]
 * Get a specific class by ID with full details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { data, error } = await supabase
      .from('classes')
      .select(`
        *,
        form_teacher:users(id, first_name, last_name, email),
        subjects:class_subjects(
          id,
          teacher_id,
          subject_id,
          is_compulsory,
          subject:subjects(id, name, code),
          teacher:users(id, first_name, last_name)
        ),
        enrollments:enrollments(
          id,
          student_id,
          status,
          student:students(id, admission_number, user:users(first_name, last_name))
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching class:', error);
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

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    } as ApiResponse<ClassRow>);
  } catch (error) {
    console.error('Unexpected error in GET /api/classes/[id]:', error);
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
 * PATCH /api/classes/[id]
 * Update a specific class
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json() as Partial<ClassRow>;

    // Prevent updating school_id
    if (body.school_id) {
      delete body.school_id;
    }

    const { data, error } = await supabase
      .from('classes')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating class:', error);
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
      message: 'Class updated successfully',
      timestamp: new Date().toISOString(),
    } as ApiResponse<ClassRow>);
  } catch (error) {
    console.error('Unexpected error in PATCH /api/classes/[id]:', error);
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
 * DELETE /api/classes/[id]
 * Delete a specific class
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting class:', error);
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
      message: 'Class deleted successfully',
      timestamp: new Date().toISOString(),
    } as ApiResponse<null>);
  } catch (error) {
    console.error('Unexpected error in DELETE /api/classes/[id]:', error);
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

// src/app/api/students/[id]/route.ts
// Student detail endpoints: GET, UPDATE, DELETE

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/api';
import { 
  StudentRow, 
  ApiResponse, 
  UpdateStudentPayload,
  ApiErrorResponse 
} from '@/lib/supabase/types';

/**
 * GET /api/students/[id]
 * Get a specific student by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching student:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Student not found',
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
    } as ApiResponse<StudentRow>);
  } catch (error) {
    console.error('Unexpected error in GET /api/students/[id]:', error);
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
 * PATCH /api/students/[id]
 * Update a specific student
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json() as UpdateStudentPayload;

    // Prevent updating school_id
    if (body.school_id) {
      delete body.school_id;
    }

    const { data, error } = await supabase
      .from('students')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating student:', error);
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
      message: 'Student updated successfully',
      timestamp: new Date().toISOString(),
    } as ApiResponse<StudentRow>);
  } catch (error) {
    console.error('Unexpected error in PATCH /api/students/[id]:', error);
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
 * DELETE /api/students/[id]
 * Delete a specific student (soft delete recommended)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting student:', error);
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
      message: 'Student deleted successfully',
      timestamp: new Date().toISOString(),
    } as ApiResponse<null>);
  } catch (error) {
    console.error('Unexpected error in DELETE /api/students/[id]:', error);
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

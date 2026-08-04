// src/app/api/subjects/[id]/route.ts
// Subject detail endpoints: GET, UPDATE, DELETE

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/api';
import { 
  SubjectRow, 
  ApiResponse, 
  ApiErrorResponse 
} from '@/lib/supabase/types';

/**
 * GET /api/subjects/[id]
 * Get a specific subject by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { data, error } = await supabase
      .from('subjects')
      .select(`
        *,
        classes:class_subjects(
          id,
          class_id,
          teacher_id,
          is_compulsory,
          class:classes(id, name, level),
          teacher:users(id, first_name, last_name)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching subject:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Subject not found',
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
    } as ApiResponse<SubjectRow>);
  } catch (error) {
    console.error('Unexpected error in GET /api/subjects/[id]:', error);
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
 * PATCH /api/subjects/[id]
 * Update a specific subject
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json() as Partial<SubjectRow>;

    // Prevent updating school_id
    if (body.school_id) {
      delete body.school_id;
    }

    const { data, error } = await supabase
      .from('subjects')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating subject:', error);
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
      message: 'Subject updated successfully',
      timestamp: new Date().toISOString(),
    } as ApiResponse<SubjectRow>);
  } catch (error) {
    console.error('Unexpected error in PATCH /api/subjects/[id]:', error);
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
 * DELETE /api/subjects/[id]
 * Delete a specific subject
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting subject:', error);
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
      message: 'Subject deleted successfully',
      timestamp: new Date().toISOString(),
    } as ApiResponse<null>);
  } catch (error) {
    console.error('Unexpected error in DELETE /api/subjects/[id]:', error);
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

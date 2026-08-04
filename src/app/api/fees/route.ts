// src/app/api/fees/route.ts
// Fee Management API - Fee structures and configuration

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/api';
import { 
  FeeStructureRow,
  ApiListResponse, 
  ApiResponse, 
  ApiErrorResponse 
} from '@/lib/supabase/types';

/**
 * GET /api/fees
 * List fee structures for a class/term
 * Query Parameters:
 *   - classId: string (optional)
 *   - termId: string (optional)
 *   - isActive: boolean (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const termId = searchParams.get('termId');
    const isActive = searchParams.get('isActive') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');

    const offset = (page - 1) * pageSize;

    let query = supabase
      .from('fee_structures')
      .select(`
        *,
        class:classes(name, level),
        term:terms(name, year:years(name)),
        fee_category:fee_categories(name, code)
      `, { count: 'exact' });

    if (classId) {
      query = query.eq('class_id', classId);
    }

    if (termId) {
      query = query.eq('term_id', termId);
    }

    if (isActive !== null) {
      query = query.eq('is_active', isActive);
    }

    const { data, error, count } = await query
      .range(offset, offset + pageSize - 1)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching fee structures:', error);
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
    } as ApiListResponse<FeeStructureRow>);
  } catch (error) {
    console.error('Unexpected error in GET /api/fees:', error);
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
 * POST /api/fees
 * Create a fee structure
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<FeeStructureRow>;

    const requiredFields = ['school_id', 'class_id', 'term_id', 'fee_category_id', 'amount', 'due_date'];
    const missingFields = requiredFields.filter((field) => !body[field as keyof FeeStructureRow]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`,
          statusCode: 400,
          timestamp: new Date().toISOString(),
        } as ApiErrorResponse,
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('fee_structures')
      .insert([{
        school_id: body.school_id,
        class_id: body.class_id,
        term_id: body.term_id,
        fee_category_id: body.fee_category_id,
        amount: body.amount,
        due_date: body.due_date,
        is_active: body.is_active !== false,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating fee structure:', error);
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
        message: 'Fee structure created successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<FeeStructureRow>,
      { status: 201 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/fees:', error);
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

// src/app/api/fees/payments/route.ts
// Fee Payment Processing with automatic balance updates

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/api';
import { 
  FeePaymentRow,
  ProcessFeePaymentPayload,
  ApiResponse, 
  ApiErrorResponse 
} from '@/lib/supabase/types';

/**
 * GET /api/fees/payments
 * Get payment history
 * Query Parameters:
 *   - studentId: string (optional)
 *   - termId: string (optional)
 *   - paymentMethod: string (optional)
 *   - startDate: string (optional)
 *   - endDate: string (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const termId = searchParams.get('termId');
    const paymentMethod = searchParams.get('paymentMethod');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');

    const offset = (page - 1) * pageSize;

    let query = supabase
      .from('fee_payments')
      .select(`
        *,
        student:students(
          admission_number,
          user:users(first_name, last_name)
        ),
        term:terms(name),
        received_by:users(first_name, last_name)
      `, { count: 'exact' });

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    if (termId) {
      query = query.eq('term_id', termId);
    }

    if (paymentMethod) {
      query = query.eq('payment_method', paymentMethod);
    }

    if (startDate) {
      query = query.gte('payment_date', startDate);
    }

    if (endDate) {
      query = query.lte('payment_date', endDate);
    }

    const { data, error, count } = await query
      .range(offset, offset + pageSize - 1)
      .order('payment_date', { ascending: false });

    if (error) {
      console.error('Error fetching payments:', error);
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
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/fees/payments:', error);
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
 * POST /api/fees/payments
 * Process a fee payment and update student balance
 * Body: ProcessFeePaymentPayload
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ProcessFeePaymentPayload;

    // Validate required fields
    const requiredFields = ['student_id', 'term_id', 'amount', 'payment_method'];
    const missingFields = requiredFields.filter((field) => !body[field as keyof ProcessFeePaymentPayload]);

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

    // Get school_id from student
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('school_id')
      .eq('id', body.student_id)
      .single();

    if (studentError || !studentData) {
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

    // Generate receipt number
    const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Record payment
    const { data: paymentData, error: paymentError } = await supabase
      .from('fee_payments')
      .insert([{
        school_id: studentData.school_id,
        student_id: body.student_id,
        term_id: body.term_id,
        amount: body.amount,
        payment_method: body.payment_method,
        reference_number: body.reference_number,
        payment_date: new Date().toISOString().split('T')[0], // Today's date
        received_by: body.received_by,
        receipt_number: receiptNumber,
        notes: body.notes,
      }])
      .select()
      .single();

    if (paymentError || !paymentData) {
      console.error('Error recording payment:', paymentError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to record payment',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        } as ApiErrorResponse,
        { status: 400 }
      );
    }

    // Update student fee balance
    const { data: balanceData, error: balanceError } = await supabase
      .from('student_fee_balances')
      .select('amount_paid, balance, total_fees')
      .eq('school_id', studentData.school_id)
      .eq('student_id', body.student_id)
      .eq('term_id', body.term_id)
      .single();

    if (!balanceError && balanceData) {
      const newAmountPaid = (balanceData.amount_paid || 0) + body.amount;
      const newBalance = balanceData.total_fees - newAmountPaid;

      // Determine new status
      let newStatus: 'paid' | 'pending' | 'partial' | 'overdue' = 'pending';
      if (newBalance <= 0) {
        newStatus = 'paid';
      } else if (newAmountPaid > 0) {
        newStatus = 'partial';
      }

      await supabase
        .from('student_fee_balances')
        .update({
          amount_paid: newAmountPaid,
          balance: Math.max(0, newBalance),
          status: newStatus,
          last_payment_date: new Date().toISOString().split('T')[0],
        })
        .eq('school_id', studentData.school_id)
        .eq('student_id', body.student_id)
        .eq('term_id', body.term_id);
    }

    // Create receipt
    await supabase
      .from('fee_receipts')
      .insert([{
        school_id: studentData.school_id,
        fee_payment_id: paymentData.id,
        receipt_number: receiptNumber,
        date_issued: new Date().toISOString().split('T')[0],
      }]);

    return NextResponse.json(
      {
        success: true,
        data: paymentData,
        message: `Payment of ${body.amount} recorded successfully. Receipt: ${receiptNumber}`,
        timestamp: new Date().toISOString(),
      } as ApiResponse<FeePaymentRow>,
      { status: 201 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/fees/payments:', error);
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

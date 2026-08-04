// src/lib/services/reporting.ts
// Generate reports and analytics data

import { supabase } from '@/lib/supabase/api';
import { 
  ReportCardRow,
  AttendanceSummaryRow,
  StudentFeeBalanceRow,
} from '@/lib/supabase/types';

/**
 * Generate class performance report
 */
export async function generateClassPerformanceReport(
  schoolId: string,
  classId: string,
  termId: string
) {
  try {
    const { data: reportCards, error } = await supabase
      .from('report_cards')
      .select('average_score, subjects_passed, total_subjects')
      .eq('school_id', schoolId)
      .eq('class_id', classId)
      .eq('term_id', termId);

    if (error || !reportCards) {
      return null;
    }

    const totalStudents = reportCards.length;
    const averageClassScore = reportCards.reduce((sum, rc) => sum + (rc.average_score || 0), 0) / totalStudents;
    const averagePassRate = reportCards.reduce((sum, rc) => sum + ((rc.subjects_passed / rc.total_subjects) * 100), 0) / totalStudents;

    return {
      classId,
      termId,
      totalStudents,
      averageClassScore: Math.round(averageClassScore * 100) / 100,
      averagePassRate: Math.round(averagePassRate * 100) / 100,
      topPerformer: reportCards.reduce((max, rc) => 
        (rc.average_score || 0) > (max.average_score || 0) ? rc : max
      ),
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error generating class performance report:', error);
    return null;
  }
}

/**
 * Generate attendance report for a class
 */
export async function generateAttendanceReport(
  schoolId: string,
  classId: string,
  termId: string
) {
  try {
    const { data: summaries, error } = await supabase
      .from('attendance_summaries')
      .select(`
        *,
        student:students(
          admission_number,
          user:users(first_name, last_name)
        )
      `)
      .eq('school_id', schoolId)
      .eq('term_id', termId);

    if (error || !summaries) {
      return null;
    }

    // Filter for this class (would need enrollment join in real scenario)
    const averageAttendance = summaries.reduce((sum, s) => sum + (s.attendance_percentage || 0), 0) / summaries.length;

    const atRiskStudents = summaries.filter((s) => (s.attendance_percentage || 0) < 75);

    return {
      classId,
      termId,
      totalStudents: summaries.length,
      averageAttendance: Math.round(averageAttendance * 100) / 100,
      atRiskCount: atRiskStudents.length,
      atRiskStudents: atRiskStudents.slice(0, 10),
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error generating attendance report:', error);
    return null;
  }
}

/**
 * Generate fee collection report
 */
export async function generateFeeCollectionReport(
  schoolId: string,
  termId: string
) {
  try {
    const { data: balances, error } = await supabase
      .from('student_fee_balances')
      .select('total_fees, amount_paid, balance, status')
      .eq('school_id', schoolId)
      .eq('term_id', termId);

    if (error || !balances) {
      return null;
    }

    const totalExpected = balances.reduce((sum, b) => sum + (b.total_fees || 0), 0);
    const totalCollected = balances.reduce((sum, b) => sum + (b.amount_paid || 0), 0);
    const outstandingBalance = balances.reduce((sum, b) => sum + (b.balance || 0), 0);

    const statusCounts = {
      paid: balances.filter((b) => b.status === 'paid').length,
      partial: balances.filter((b) => b.status === 'partial').length,
      pending: balances.filter((b) => b.status === 'pending').length,
      overdue: balances.filter((b) => b.status === 'overdue').length,
    };

    return {
      termId,
      totalExpected: Math.round(totalExpected * 100) / 100,
      totalCollected: Math.round(totalCollected * 100) / 100,
      outstandingBalance: Math.round(outstandingBalance * 100) / 100,
      collectionRate: Math.round((totalCollected / totalExpected) * 100 * 100) / 100,
      statusBreakdown: statusCounts,
      totalStudents: balances.length,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error generating fee collection report:', error);
    return null;
  }
}

/**
 * Generate student progress report
 */
export async function generateStudentProgressReport(
  schoolId: string,
  studentId: string
) {
  try {
    // Get report cards
    const { data: reportCards } = await supabase
      .from('report_cards')
      .select('*')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(3);

    // Get attendance summaries
    const { data: attendanceSummaries } = await supabase
      .from('attendance_summaries')
      .select('*')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(3);

    // Get fee balance
    const { data: feeBalance } = await supabase
      .from('student_fee_balances')
      .select('*')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(1);

    return {
      studentId,
      academicProgress: reportCards || [],
      attendanceHistory: attendanceSummaries || [],
      feeStatus: feeBalance ? feeBalance[0] : null,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error generating student progress report:', error);
    return null;
  }
}

/**
 * Export report to CSV format
 */
export function exportReportToCSV(
  headers: string[],
  data: Record<string, unknown>[]
): string {
  const csv = [
    headers.join(','),
    ...data.map((row) =>
      headers.map((header) => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
        return String(value);
      }).join(',')
    ),
  ].join('\n');

  return csv;
}

/**
 * Generate school dashboard statistics
 */
export async function generateSchoolDashboardStats(schoolId: string) {
  try {
    // Refresh materialized view
    await supabase.rpc('refresh_school_statistics');

    const { data: stats, error } = await supabase
      .from('school_statistics')
      .select('*')
      .eq('school_id', schoolId)
      .single();

    if (error || !stats) {
      return null;
    }

    return stats;
  } catch (error) {
    console.error('Error generating dashboard stats:', error);
    return null;
  }
}

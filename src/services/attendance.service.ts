import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecordBulkAttendanceInput } from "@/lib/validations/attendance";

export class AttendanceService {
  private db: SupabaseClient;

  constructor(supabaseServerClient: SupabaseClient) {
    this.db = supabaseServerClient;
  }

  // Calls the RPC that performs the transactional bulk upsert
  async recordBulkAttendance(input: {
    school_id: string;
    classId: string;
    streamId?: string | null;
    date: string; // ISO date string
    takenBy: string; // profile id
    records: Array<{ studentId: string; status: string; remarks?: string | null }>;
  }) {
    const params = {
      p_school_id: input.school_id,
      p_class_id: input.classId,
      p_stream_id: input.streamId ?? null,
      p_date: input.date,
      p_taken_by: input.takenBy,
      p_records: JSON.stringify(input.records)
    };

    const { data, error } = await this.db.rpc('save_bulk_attendance', params);
    if (error) throw error;
    return data; // expected { session_id, processed }
  }

  // Fetch attendance session and its student attendance rows for a given class/date
  async getClassAttendanceByDate(schoolId: string, classId: string, streamId: string | null, date: string) {
    // find session
    const { data: session, error: sessionErr } = await this.db
      .from('attendance_sessions')
      .select('*')
      .eq('school_id', schoolId)
      .eq('class_id', classId)
      .eq('date', date)
      .maybeSingle();

    if (sessionErr) throw sessionErr;

    if (!session) {
      return { session: null, records: [] };
    }

    const { data: records, error: recordsErr } = await this.db
      .from('student_attendance')
      .select('*, students(id, first_name, last_name, admission_number)')
      .eq('session_id', session.id)
      .order('students.first_name', { ascending: true });

    if (recordsErr) throw recordsErr;

    return { session, records: records ?? [] };
  }
}

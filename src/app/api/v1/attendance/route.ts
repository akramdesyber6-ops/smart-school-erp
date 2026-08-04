import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { AttendanceService } from "@/services/attendance.service";
import { recordBulkAttendanceSchema } from "@/lib/validations/attendance";
import type { ApiResponse } from "@/lib/types/api";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData.user) {
      const res: ApiResponse<null> = { success: false, error: "Unauthorized" };
      return NextResponse.json(res, { status: 401 });
    }

    // fetch tenant profile
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, school_id')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileErr || !profile?.school_id) {
      const res: ApiResponse<null> = { success: false, error: "Forbidden: no school associated with profile" };
      return NextResponse.json(res, { status: 403 });
    }

    const body = await req.json();
    const parsed = recordBulkAttendanceSchema.safeParse(body);
    if (!parsed.success) {
      const res: ApiResponse<null> = { success: false, error: "Invalid input", details: parsed.error.flatten() };
      return NextResponse.json(res, { status: 400 });
    }

    const svc = new AttendanceService(supabase);
    const result = await svc.recordBulkAttendance({
      school_id: profile.school_id,
      classId: parsed.data.classId,
      streamId: parsed.data.streamId ?? null,
      date: parsed.data.date,
      takenBy: profile.id,
      records: parsed.data.records.map(r => ({ studentId: r.studentId, status: r.status, remarks: r.remarks }))
    });

    const res: ApiResponse<any> = { success: true, data: result, message: 'Attendance recorded' };
    return NextResponse.json(res, { status: 200 });
  } catch (err: any) {
    const res: ApiResponse<null> = { success: false, error: 'Internal server error', details: err.message ?? err };
    return NextResponse.json(res, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData.user) {
      const res: ApiResponse<null> = { success: false, error: "Unauthorized" };
      return NextResponse.json(res, { status: 401 });
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, school_id')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileErr || !profile?.school_id) {
      const res: ApiResponse<null> = { success: false, error: "Forbidden: no school associated with profile" };
      return NextResponse.json(res, { status: 403 });
    }

    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const classId = params.classId;
    const streamId = params.streamId ?? null;
    const date = params.date; // expect ISO date string

    if (!classId || !date) {
      const res: ApiResponse<null> = { success: false, error: "classId and date are required query params" };
      return NextResponse.json(res, { status: 400 });
    }

    const svc = new AttendanceService(supabase);
    const result = await svc.getClassAttendanceByDate(profile.school_id, classId, streamId, date);

    const res: ApiResponse<typeof result> = { success: true, data: result };
    return NextResponse.json(res);
  } catch (err: any) {
    const res: ApiResponse<null> = { success: false, error: 'Internal server error', details: err.message ?? err };
    return NextResponse.json(res, { status: 500 });
  }
}

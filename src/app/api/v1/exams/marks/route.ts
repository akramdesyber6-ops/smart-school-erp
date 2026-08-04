import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ExamsService } from "@/services/exams.service";
import { recordBulkMarksSchema } from "@/lib/validations/exams";
import type { ApiResponse } from "@/lib/types/api";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData.user) {
      const res: ApiResponse<null> = { success: false, error: 'Unauthorized' };
      return NextResponse.json(res, { status: 401 });
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, school_id')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileErr || !profile?.school_id) {
      const res: ApiResponse<null> = { success: false, error: 'Forbidden: no school associated with profile' };
      return NextResponse.json(res, { status: 403 });
    }

    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const examId = params.examId;
    const classSubjectId = params.classSubjectId;

    if (!examId || !classSubjectId) {
      const res: ApiResponse<null> = { success: false, error: 'examId and classSubjectId are required' };
      return NextResponse.json(res, { status: 400 });
    }

    const svc = new ExamsService(supabase);
    const marks = await svc.getMarksByClassSubject(profile.school_id, examId, classSubjectId);

    const res: ApiResponse<typeof marks> = { success: true, data: marks };
    return NextResponse.json(res);
  } catch (err: any) {
    const res: ApiResponse<null> = { success: false, error: 'Internal server error', details: err.message ?? err };
    return NextResponse.json(res, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData.user) {
      const res: ApiResponse<null> = { success: false, error: 'Unauthorized' };
      return NextResponse.json(res, { status: 401 });
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, school_id')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileErr || !profile?.school_id) {
      const res: ApiResponse<null> = { success: false, error: 'Forbidden: no school associated with profile' };
      return NextResponse.json(res, { status: 403 });
    }

    const body = await req.json();
    const parsed = recordBulkMarksSchema.safeParse(body);
    if (!parsed.success) {
      const res: ApiResponse<null> = { success: false, error: 'Invalid input', details: parsed.error.flatten() };
      return NextResponse.json(res, { status: 400 });
    }

    const svc = new ExamsService(supabase);
    const result = await svc.recordBulkMarks({
      school_id: profile.school_id,
      examId: parsed.data.examId,
      classSubjectId: parsed.data.classSubjectId,
      marks: parsed.data.marks,
      enteredBy: profile.id
    });

    const res: ApiResponse<any> = { success: true, data: result, message: 'Marks recorded' };
    return NextResponse.json(res, { status: 200 });
  } catch (err: any) {
    const res: ApiResponse<null> = { success: false, error: 'Internal server error', details: err.message ?? err };
    return NextResponse.json(res, { status: 500 });
  }
}

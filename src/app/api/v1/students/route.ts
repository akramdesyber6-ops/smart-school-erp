import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@supabase/auth-helpers-nextjs"; // adjust import to your setup
import { StudentsService } from "@/services/students.service";
import { createStudentSchema } from "@/lib/validations/students";
import type { ApiResponse } from "@/lib/types/api";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient({ req }); // adapt to your supabase server client factory
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData.user) {
      const res: ApiResponse<null> = { success: false, error: "Unauthorized" };
      return NextResponse.json(res, { status: 401 });
    }

    // fetch profile to determine school_id. Adjust if you store school_id in jwt claims instead.
    const { data: profile, error: profileErr } = await supabase
      .from("users")
      .select("school_id")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      const res: ApiResponse<null> = { success: false, error: "User profile not found or missing school_id" };
      return NextResponse.json(res, { status: 403 });
    }

    const body = await req.json();
    const parse = createStudentSchema.safeParse({ ...body, school_id: profile.school_id });
    if (!parse.success) {
      const res: ApiResponse<null> = { success: false, error: "Invalid input", details: parse.error.flatten() };
      return NextResponse.json(res, { status: 400 });
    }

    const service = new StudentsService(supabase);
    const created = await service.create(parse.data);

    const res: ApiResponse<typeof created> = { success: true, data: created, message: "Student created" };
    return NextResponse.json(res, { status: 201 });
  } catch (err: any) {
    const res: ApiResponse<null> = { success: false, error: "Internal server error", details: err.message ?? err };
    return NextResponse.json(res, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient({ req });
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData.user) {
      const res: ApiResponse<null> = { success: false, error: "Unauthorized" };
      return NextResponse.json(res, { status: 401 });
    }

    const { data: profile, error: profileErr } = await supabase
      .from("users")
      .select("school_id")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      const res: ApiResponse<null> = { success: false, error: "User profile not found or missing school_id" };
      return NextResponse.json(res, { status: 403 });
    }

    // parse query params
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const page = Number(params.page ?? 1);
    const limit = Number(params.limit ?? 50);
    const class_id = params.class_id ?? null;
    const stream_id = params.stream_id ?? null;
    const status = params.status ?? null;
    const q = params.q ?? null;

    const service = new StudentsService(supabase);
    const result = await service.listBySchool(profile.school_id, { page, limit, class_id, stream_id, status, q });

    const res: ApiResponse<typeof result> = { success: true, data: result };
    return NextResponse.json(res);
  } catch (err: any) {
    const res: ApiResponse<null> = { success: false, error: "Internal server error", details: err.message ?? err };
    return NextResponse.json(res, { status: 500 });
  }
}

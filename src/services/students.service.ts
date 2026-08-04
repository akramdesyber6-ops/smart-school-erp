import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateStudentInput, UpdateStudentInput } from "@/lib/validations/students";

export class StudentsService {
  private db: SupabaseClient;

  constructor(supabaseServerClient: SupabaseClient) {
    this.db = supabaseServerClient;
  }

  // List students for a given school with pagination, filtering, and text search
  async listBySchool(schoolId: string, options?: {
    page?: number;
    limit?: number;
    class_id?: string | null;
    stream_id?: string | null;
    status?: string | null;
    q?: string | null; // text query
  }) {
    const page = options?.page && options.page > 0 ? Math.floor(options.page) : 1;
    const limit = options?.limit && options.limit > 0 ? Math.min(200, Math.floor(options.limit)) : 50;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Build base query
    let query = this.db
      .from("students")
      .select("*", { count: "exact" })
      .eq("school_id", schoolId);

    if (options?.class_id) query = query.eq("class_id", options.class_id);
    if (options?.stream_id) query = query.eq("stream_id", options.stream_id);
    if (options?.status) query = query.eq("status", options.status);

    if (options?.q) {
      const q = options.q.trim();
      if (q.length > 0) {
        // Use OR-style ilike search across first_name, last_name, admission_number
        const escaped = q.replace(/%/g, "\\%");
        const pattern = `%${escaped}%`;
        // supabase .or accepts a csv of conditions
        query = query.or(`first_name.ilike.${pattern},last_name.ilike.${pattern},admission_number.ilike.${pattern}`);
      }
    }

    query = query.order("created_at", { ascending: false }).range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;

    const totalCount = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    return {
      students: data ?? [],
      pagination: {
        page,
        limit,
        totalCount,
        totalPages
      }
    };
  }

  async getById(schoolId: string, id: string) {
    const { data, error } = await this.db
      .from("students")
      .select("*")
      .eq("school_id", schoolId)
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async create(input: CreateStudentInput) {
    const { data, error } = await this.db
      .from("students")
      .insert({
        school_id: input.school_id,
        first_name: input.first_name,
        last_name: input.last_name,
        admission_number: input.admission_number,
        class_id: input.class_id,
        stream_id: input.stream_id,
        status: input.status ?? 'active',
        email: input.email,
        dob: input.dob,
        enrolled_at: input.enrolled_at,
        metadata: input.metadata ?? {}
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(schoolId: string, input: UpdateStudentInput) {
    if (!input.id) throw new Error("student id required");
    const { data, error } = await this.db
      .from("students")
      .update({
        first_name: input.first_name,
        last_name: input.last_name,
        admission_number: input.admission_number,
        class_id: input.class_id,
        stream_id: input.stream_id,
        status: input.status,
        email: input.email,
        dob: input.dob,
        enrolled_at: input.enrolled_at,
        metadata: input.metadata
      })
      .eq("school_id", schoolId)
      .eq("id", input.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(schoolId: string, id: string) {
    const { data, error } = await this.db
      .from("students")
      .delete()
      .eq("school_id", schoolId)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

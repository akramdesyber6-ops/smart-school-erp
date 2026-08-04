import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateExamInput, RecordBulkMarksInput } from "@/lib/validations/exams";

export class ExamsService {
  private db: SupabaseClient;

  constructor(supabaseServerClient: SupabaseClient) {
    this.db = supabaseServerClient;
  }

  async createExam(input: { school_id: string } & CreateExamInput) {
    const { data, error } = await this.db
      .from('exams')
      .insert({
        school_id: input.school_id,
        academic_year_id: input.academicYearId,
        term_id: input.termId,
        exam_type_id: input.examTypeId,
        name: input.name
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getExams(schoolId: string) {
    const { data, error } = await this.db
      .from('exams')
      .select('*, exam_types(*)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async recordBulkMarks(input: { school_id: string } & RecordBulkMarksInput & { enteredBy: string }) {
    const params = {
      p_school_id: input.school_id,
      p_exam_id: input.examId,
      p_class_subject_id: input.classSubjectId,
      p_entered_by: input.enteredBy,
      p_marks: JSON.stringify(input.marks)
    };

    const { data, error } = await this.db.rpc('save_bulk_marks', params);
    if (error) throw error;
    return data;
  }

  async getMarksByClassSubject(schoolId: string, examId: string, classSubjectId: string) {
    const { data, error } = await this.db
      .from('marks_entries')
      .select('*, students(id, first_name, last_name, admission_number)')
      .eq('school_id', schoolId)
      .eq('exam_id', examId)
      .eq('class_subject_id', classSubjectId)
      .order('students.first_name', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }
}

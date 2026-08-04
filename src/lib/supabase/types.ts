// src/lib/supabase/types.ts
// Comprehensive TypeScript types for all Smart School ERP entities

// ============================================================================
// SCHOOL & TENANT
// ============================================================================

export type School = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  logo_url?: string | null;
  subscription_tier: 'free' | 'basic' | 'professional' | 'enterprise';
  subscription_status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
};

// ============================================================================
// USERS & ROLES
// ============================================================================

export type UserRole = 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'parent';

export type User = {
  id: string;
  school_id: string;
  auth_id?: string | null; // Links to Supabase Auth
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  role: UserRole;
  profile_picture_url?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// ============================================================================
// ACADEMIC STRUCTURE
// ============================================================================

export type Year = {
  id: string;
  school_id: string;
  name: string; // e.g., "2024"
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Term = {
  id: string;
  school_id: string;
  year_id: string;
  name: string; // e.g., "Term 1", "Term 2", "Term 3"
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Class = {
  id: string;
  school_id: string;
  name: string; // e.g., "Form 1", "Grade 5"
  stream?: string | null; // e.g., "A", "B", "C"
  level: number; // 1-12 or similar
  form_teacher_id?: string | null; // References Teacher
  capacity?: number | null;
  created_at: string;
  updated_at: string;
};

export type Subject = {
  id: string;
  school_id: string;
  name: string; // e.g., "Mathematics", "English"
  code?: string | null; // e.g., "MATH101"
  description?: string | null;
  created_at: string;
  updated_at: string;
};

export type ClassSubject = {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  is_compulsory: boolean;
  created_at: string;
  updated_at: string;
};

// ============================================================================
// STUDENTS & ENROLLMENT
// ============================================================================

export type Student = {
  id: string;
  school_id: string;
  user_id?: string | null; // References User
  admission_number: string;
  date_of_birth?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  parent_email?: string | null;
  address?: string | null;
  created_at: string;
  updated_at: string;
};

export type Enrollment = {
  id: string;
  school_id: string;
  student_id: string;
  class_id: string;
  term_id: string;
  enrollment_date: string;
  status: 'active' | 'inactive' | 'transferred' | 'graduated';
  created_at: string;
  updated_at: string;
};

// ============================================================================
// TEACHERS
// ============================================================================

export type Teacher = {
  id: string;
  school_id: string;
  user_id?: string | null; // References User
  employee_id: string;
  qualification?: string | null;
  date_of_birth?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  phone?: string | null;
  address?: string | null;
  employment_date: string;
  status: 'active' | 'inactive' | 'on_leave';
  created_at: string;
  updated_at: string;
};

// ============================================================================
// ATTENDANCE
// ============================================================================

export type AttendanceRecord = {
  id: string;
  school_id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  remarks?: string | null;
  recorded_by?: string | null; // References Teacher
  created_at: string;
  updated_at: string;
};

export type AttendanceSummary = {
  id: string;
  school_id: string;
  student_id: string;
  term_id: string;
  total_days: number;
  days_present: number;
  days_absent: number;
  days_late: number;
  days_excused: number;
  attendance_percentage: number;
  created_at: string;
  updated_at: string;
};

// ============================================================================
// EXAMS & GRADING
// ============================================================================

export type ExamType = 'aptitude_test' | 'monthly_test' | 'mid_term' | 'end_term' | 'mock' | 'final';

export type Exam = {
  id: string;
  school_id: string;
  term_id: string;
  subject_id: string;
  class_id: string;
  exam_type: ExamType;
  name: string;
  exam_date: string;
  total_marks: number;
  passing_marks: number;
  duration_minutes?: number | null;
  created_at: string;
  updated_at: string;
};

export type MarkbookEntry = {
  id: string;
  school_id: string;
  exam_id: string;
  student_id: string;
  raw_score: number | null;
  grade?: string | null; // e.g., "A", "B+", "C"
  grade_points?: number | null;
  is_submitted: boolean;
  submitted_by?: string | null; // References Teacher
  submitted_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type GradingScale = {
  id: string;
  school_id: string;
  name: string; // e.g., "Standard", "Advanced"
  min_score: number;
  max_score: number;
  grade: string;
  grade_points: number;
  created_at: string;
  updated_at: string;
};

export type ReportCard = {
  id: string;
  school_id: string;
  student_id: string;
  term_id: string;
  class_id: string;
  total_subjects: number;
  subjects_passed: number;
  average_score: number;
  overall_grade?: string | null;
  comments?: string | null;
  generated_at: string;
  created_at: string;
  updated_at: string;
};

export type SubjectResult = {
  id: string;
  school_id: string;
  report_card_id: string;
  subject_id: string;
  total_marks: number;
  obtained_marks: number;
  grade?: string | null;
  grade_points?: number | null;
  created_at: string;
  updated_at: string;
};

// ============================================================================
// FEES & PAYMENTS
// ============================================================================

export type FeeCategory = {
  id: string;
  school_id: string;
  name: string; // e.g., "Tuition", "Laboratory", "Sports"
  code?: string | null;
  created_at: string;
  updated_at: string;
};

export type FeeStructure = {
  id: string;
  school_id: string;
  class_id: string;
  term_id: string;
  fee_category_id: string;
  amount: number;
  due_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type StudentFeeBalance = {
  id: string;
  school_id: string;
  student_id: string;
  term_id: string;
  total_fees: number;
  amount_paid: number;
  balance: number;
  status: 'paid' | 'pending' | 'partial' | 'overdue';
  last_payment_date?: string | null;
  created_at: string;
  updated_at: string;
};

export type FeePayment = {
  id: string;
  school_id: string;
  student_id: string;
  term_id: string;
  amount: number;
  payment_method: 'cash' | 'bank_transfer' | 'mobile_money' | 'cheque';
  reference_number?: string | null;
  payment_date: string;
  received_by?: string | null; // References User
  receipt_number?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

export type FeeReceipt = {
  id: string;
  school_id: string;
  fee_payment_id: string;
  receipt_number: string;
  date_issued: string;
  pdf_url?: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================================================
// DASHBOARD & ANALYTICS
// ============================================================================

export type DashboardMetric = {
  id: string;
  school_id: string;
  metric_type: 'student_count' | 'teacher_count' | 'attendance_rate' | 'fee_collection' | 'pass_rate';
  metric_value: number;
  metric_date: string;
  period: 'daily' | 'weekly' | 'monthly' | 'termly' | 'yearly';
  created_at: string;
  updated_at: string;
};

// ============================================================================
// AUDIT & LOGGING
// ============================================================================

export type AuditLog = {
  id: string;
  school_id: string;
  user_id?: string | null;
  action: string; // e.g., "CREATE", "UPDATE", "DELETE"
  entity_type: string; // e.g., "Student", "Exam", "FeePayment"
  entity_id: string;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
};

// ============================================================================
// DATABASE ROW TYPES (for Supabase queries)
// ============================================================================

export type SchoolRow = School;
export type UserRow = User;
export type YearRow = Year;
export type TermRow = Term;
export type ClassRow = Class;
export type SubjectRow = Subject;
export type ClassSubjectRow = ClassSubject;
export type StudentRow = Student;
export type EnrollmentRow = Enrollment;
export type TeacherRow = Teacher;
export type AttendanceRecordRow = AttendanceRecord;
export type AttendanceSummaryRow = AttendanceSummary;
export type ExamRow = Exam;
export type MarkbookEntryRow = MarkbookEntry;
export type GradingScaleRow = GradingScale;
export type ReportCardRow = ReportCard;
export type SubjectResultRow = SubjectResult;
export type FeeCategoryRow = FeeCategory;
export type FeeStructureRow = FeeStructure;
export type StudentFeeBalanceRow = StudentFeeBalance;
export type FeePaymentRow = FeePayment;
export type FeeReceiptRow = FeeReceipt;
export type DashboardMetricRow = DashboardMetric;
export type AuditLogRow = AuditLog;

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
};

export type ApiListResponse<T> = {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error?: string;
  timestamp?: string;
};

export type ApiErrorResponse = {
  success: false;
  error: string;
  message?: string;
  statusCode: number;
  timestamp?: string;
};

// ============================================================================
// REQUEST/PAYLOAD TYPES
// ============================================================================

export type CreateStudentPayload = Omit<Student, 'id' | 'created_at' | 'updated_at'>;
export type UpdateStudentPayload = Partial<CreateStudentPayload>;

export type CreateTeacherPayload = Omit<Teacher, 'id' | 'created_at' | 'updated_at'>;
export type UpdateTeacherPayload = Partial<CreateTeacherPayload>;

export type CreateExamPayload = Omit<Exam, 'id' | 'created_at' | 'updated_at'>;
export type UpdateExamPayload = Partial<CreateExamPayload>;

export type SubmitMarksPayload = {
  exam_id: string;
  marks: Array<{
    student_id: string;
    raw_score: number;
  }>;
};

export type RecordAttendancePayload = {
  class_id: string;
  date: string;
  attendance: Array<{
    student_id: string;
    status: 'present' | 'absent' | 'late' | 'excused';
    remarks?: string;
  }>;
};

export type ProcessFeePaymentPayload = {
  student_id: string;
  term_id: string;
  amount: number;
  payment_method: 'cash' | 'bank_transfer' | 'mobile_money' | 'cheque';
  reference_number?: string;
  received_by?: string;
  notes?: string;
};

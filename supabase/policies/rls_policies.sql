-- supabase/policies/rls_policies.sql
-- Row-Level Security (RLS) Policies for Smart School ERP
-- Enforces multi-tenant access control at the database level

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE years ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE grading_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE markbook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_fee_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTION: Get current user's school_id
-- ============================================================================

CREATE OR REPLACE FUNCTION auth.get_school_id()
RETURNS UUID AS $$
  SELECT 
	COALESCE(
	  (auth.jwt() ->> 'school_id')::uuid,
	  (SELECT school_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
	)
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS VARCHAR AS $$
  SELECT 
	COALESCE(
	  auth.jwt() ->> 'role',
	  (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1)
	)
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION auth.get_user_id()
RETURNS UUID AS $$
  SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1
$$ LANGUAGE sql;

-- ============================================================================
-- SCHOOLS TABLE POLICIES
-- ============================================================================

-- Super admins can see all schools
CREATE POLICY "Super admins can view all schools" ON schools
  FOR SELECT
  USING (auth.get_user_role() = 'super_admin');

-- School admins and users can see their own school
CREATE POLICY "Users can view their own school" ON schools
  FOR SELECT
  USING (id = auth.get_school_id());

-- Super admins can create schools
CREATE POLICY "Super admins can create schools" ON schools
  FOR INSERT
  WITH CHECK (auth.get_user_role() = 'super_admin');

-- Only super admins and school admins of the school can update
CREATE POLICY "School admins can update their school" ON schools
  FOR UPDATE
  USING (
	auth.get_user_role() = 'super_admin' 
	OR (id = auth.get_school_id() AND auth.get_user_role() = 'school_admin')
  )
  WITH CHECK (
	auth.get_user_role() = 'super_admin' 
	OR (id = auth.get_school_id() AND auth.get_user_role() = 'school_admin')
  );

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================

-- Users can only see users from their own school
CREATE POLICY "Users can view their school's users" ON users
  FOR SELECT
  USING (school_id = auth.get_school_id());

-- Super admin can see all users
CREATE POLICY "Super admin can view all users" ON users
  FOR SELECT
  USING (auth.get_user_role() = 'super_admin')
  WITH CHECK (auth.get_user_role() = 'super_admin');

-- School admins can create users in their school
CREATE POLICY "School admins can create users in their school" ON users
  FOR INSERT
  WITH CHECK (
	school_id = auth.get_school_id() 
	AND (auth.get_user_role() = 'school_admin' OR auth.get_user_role() = 'super_admin')
  );

-- Users can update their own profile
CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- School admins can update users in their school
CREATE POLICY "School admins can update users in their school" ON users
  FOR UPDATE
  USING (
	school_id = auth.get_school_id() 
	AND (auth.get_user_role() = 'school_admin' OR auth.get_user_role() = 'super_admin')
  )
  WITH CHECK (
	school_id = auth.get_school_id() 
	AND (auth.get_user_role() = 'school_admin' OR auth.get_user_role() = 'super_admin')
  );

-- ============================================================================
-- ACADEMIC STRUCTURE: YEARS, TERMS, CLASSES, SUBJECTS
-- ============================================================================

-- Years: All school users can view, admins can create/update
CREATE POLICY "View years for your school" ON years
  FOR SELECT
  USING (school_id = auth.get_school_id());

CREATE POLICY "Admins can insert years" ON years
  FOR INSERT
  WITH CHECK (
	school_id = auth.get_school_id() 
	AND (auth.get_user_role() = 'school_admin' OR auth.get_user_role() = 'super_admin')
  );

CREATE POLICY "Admins can update years" ON years
  FOR UPDATE
  USING (
	school_id = auth.get_school_id() 
	AND (auth.get_user_role() = 'school_admin' OR auth.get_user_role() = 'super_admin')
  );

-- Terms: Similar to years
CREATE POLICY "View terms for your school" ON terms
  FOR SELECT
  USING (school_id = auth.get_school_id());

CREATE POLICY "Admins can insert/update terms" ON terms
  FOR INSERT
  WITH CHECK (
	school_id = auth.get_school_id() 
	AND (auth.get_user_role() = 'school_admin' OR auth.get_user_role() = 'super_admin')
  );

CREATE POLICY "Admins can update terms" ON terms
  FOR UPDATE
  USING (
	school_id = auth.get_school_id() 
	AND (auth.get_user_role() = 'school_admin' OR auth.get_user_role() = 'super_admin')
  );

-- Classes: All users can view, admins can manage
CREATE POLICY "View classes for your school" ON classes
  FOR SELECT
  USING (school_id = auth.get_school_id());

CREATE POLICY "Admins can insert classes" ON classes
  FOR INSERT
  WITH CHECK (
	school_id = auth.get_school_id() 
	AND (auth.get_user_role() = 'school_admin' OR auth.get_user_role() = 'super_admin')
  );

CREATE POLICY "Admins can update classes" ON classes
  FOR UPDATE
  USING (
	school_id = auth.get_school_id() 
	AND (auth.get_user_role() = 'school_admin' OR auth.get_user_role() = 'super_admin')
  );

-- Subjects: All users can view, admins can manage
CREATE POLICY "View subjects for your school" ON subjects
  FOR SELECT
  USING (school_id = auth.get_school_id());

CREATE POLICY "Admins can insert subjects" ON subjects
  FOR INSERT
  WITH CHECK (
	school_id = auth.get_school_id() 
	AND (auth.get_user_role() = 'school_admin' OR auth.get_user_role() = 'super_admin')
  );

CREATE POLICY "Admins can update subjects" ON subjects
  FOR UPDATE
  USING (
	school_id = auth.get_school_id() 
	AND (auth.get_user_role() = 'school_admin' OR auth.get_user_role() = 'super_admin')
  );

-- Class Subjects: Teachers can see their assigned subjects
CREATE POLICY "View class subjects for your school" ON class_subjects
  FOR SELECT
  USING (
	school_id = auth.get_school_id()
  );

CREATE POLICY "Teachers can view their assigned classes" ON class_subjects
  FOR SELECT
  USING (
	school_id = auth.get_school_id()
	AND (teacher_id = auth.get_user_id() OR auth.get_user_role() IN ('school_admin', 'super_admin'))
  );

-- ============================================================================
-- STUDENTS & ENROLLMENTS
-- ============================================================================

-- Students: Teachers and admins can view, admins manage
CREATE POLICY "View students for your school" ON students
  FOR SELECT
  USING (school_id = auth.get_school_id());

CREATE POLICY "Admins and teachers can view students" ON students
  FOR SELECT
  USING (
	school_id = auth.get_school_id()
	AND auth.get_user_role() IN ('school_admin', 'super_admin', 'teacher')
  );

CREATE POLICY "Admins can create students" ON students
  FOR INSERT
  WITH CHECK (
	school_id = auth.get_school_id() 
	AND (auth.get_user_role() = 'school_admin' OR auth.get_user_role() = 'super_admin')
  );

CREATE POLICY "Admins can update students" ON students
  FOR UPDATE
  USING (
	school_id = auth.get_school_id() 
	AND (auth.get_user_role() = 'school_admin' OR auth.get_user_role() = 'super_admin')
  );

-- Enrollments: All users can view enrollments for their school
CREATE POLICY "View enrollments for your school" ON enrollments
  FOR SELECT
  USING (school_id = auth.get_school_id());

CREATE POLICY "Admins can create enrollments" ON enrollments
  FOR INSERT
  WITH CHECK (
	school_id = auth.get_school_id() 
	AND (auth.get_user_role() = 'school_admin' OR auth.get_user_role() = 'super_admin')
  );

CREATE POLICY "Admins can update enrollments" ON enrollments
  FOR UPDATE
  USING (
	school_id = auth.get_school_id() 
	AND (auth.get_user_role() = 'school_admin' OR auth.get_user_role() = 'super_admin')
  );

-- ============================================================================
-- TEACHERS
-- ============================================================================

CREATE POLICY "View teachers for your school" ON teachers
  FOR SELECT
  USING (school_id = auth.get_school_id());

CREATE POLICY "Teachers can view their own record" ON teachers
  FOR SELECT
  USING (school_id = auth.get_school_id() AND user_id = auth.get_user_id());

CREATE POLICY "Admins can create teachers" ON teachers
  FOR INSERT
  WITH CHECK (
	school_id = auth.get_school_id() 
	AND (auth.get_user_role() = 'school_admin' OR auth.get_user_role() = 'super_admin')
  );

CREATE POLICY "Admins can update teachers" ON teachers
  FOR UPDATE
  USING (
	school_id = auth.get_school_id() 
	AND (auth.get_user_role() = 'school_admin' OR auth.get_user_role() = 'super_admin')
  );

-- ============================================================================
-- ATTENDANCE
-- ============================================================================

-- Teachers can record attendance for their classes
CREATE POLICY "Teachers can record attendance" ON attendance_records
  FOR INSERT
  WITH CHECK (
	school_id = auth.get_school_id()
	AND (
	  auth.get_user_role() = 'teacher'
	  OR auth.get_user_role() IN ('school_admin', 'super_admin')
	)
  );

-- All users can view attendance for their school
CREATE POLICY "View attendance for your school" ON attendance_records
  FOR SELECT
  USING (school_id = auth.get_school_id());

CREATE POLICY "Teachers can update their recorded attendance" ON attendance_records
  FOR UPDATE
  USING (
	school_id = auth.get_school_id()
	AND (recorded_by = auth.get_user_id() OR auth.get_user_role() IN ('school_admin', 'super_admin'))
  );

-- Attendance summaries: Read-only for teachers, full access for admins
CREATE POLICY "View attendance summaries for your school" ON attendance_summaries
  FOR SELECT
  USING (school_id = auth.get_school_id());

CREATE POLICY "Admins can update attendance summaries" ON attendance_summaries
  FOR UPDATE
  USING (
	school_id = auth.get_school_id() 
	AND (auth.get_user_role() = 'school_admin' OR auth.get_user_role() = 'super_admin')
  );

-- ============================================================================
-- EXAMS & GRADING
-- ============================================================================

-- Exams: All users can view
CREATE POLICY "View exams for your school" ON exams
  FOR SELECT
  USING (school_id = auth.get_school_id());

CREATE POLICY "Admins can create exams" ON exams
  FOR INSERT
  WITH CHECK (
	school_id = auth.get_school_id() 
	AND (auth.get_user_role() = 'school_admin' OR auth.get_user_role() = 'super_admin')
  );

-- Grading scales: All users can view
CREATE POLICY "View grading scales for your school" ON grading_scales
  FOR SELECT
  USING (school_id = auth.get_school_id());

-- Markbook entries: Teachers can create/update for their subjects
CREATE POLICY "View markbook for your school" ON markbook_entries
  FOR SELECT
  USING (school_id = auth.get_school_id());

CREATE POLICY "Teachers can create markbook entries" ON markbook_entries
  FOR INSERT
  WITH CHECK (
	school_id = auth.get_school_id()
	AND (
	  auth.get_user_role() = 'teacher'
	  OR auth.get_user_role() IN ('school_admin', 'super_admin')
	)
  );

CREATE POLICY "Teachers can update their markbook entries" ON markbook_entries
  FOR UPDATE
  USING (
	school_id = auth.get_school_id()
	AND (submitted_by = auth.get_user_id() OR auth.get_user_role() IN ('school_admin', 'super_admin'))
  );

-- Report cards: Students can view their own, teachers can view all for their classes, admins see all
CREATE POLICY "View report cards for your school" ON report_cards
  FOR SELECT
  USING (school_id = auth.get_school_id());

CREATE POLICY "Admins can create report cards" ON report_cards
  FOR INSERT
  WITH CHECK (
	school_id = auth.get_school_id() 
	AND (auth.get_user_role() = 'school_admin' OR auth.get_user_role() = 'super_admin')
  );

-- Subject results: Part of report cards, same access rules
CREATE POLICY "View subject results for your school" ON subject_results
  FOR SELECT
  USING (school_id = auth.get_school_id());

-- ============================================================================
-- FEES & PAYMENTS
-- ============================================================================

-- Fee categories: All users can view
CREATE POLICY "View fee categories for your school" ON fee_categories
  FOR SELECT
  USING (school_id = auth.get_school_id());

-- Fee structures: Admins manage, teachers view
CREATE POLICY "View fee structures for your school" ON fee_structures
  FOR SELECT
  USING (school_id = auth.get_school_id());

CREATE POLICY "Admins can manage fee structures" ON fee_structures
  FOR INSERT
  WITH CHECK (
	school_id = auth.get_school_id() 
	AND (auth.get_user_role() = 'school_admin' OR auth.get_user_role() = 'super_admin')
  );

-- Student fee balances: Admins manage, students and parents can view their own
CREATE POLICY "View fee balances for your school" ON student_fee_balances
  FOR SELECT
  USING (school_id = auth.get_school_id());

CREATE POLICY "Admins can update fee balances" ON student_fee_balances
  FOR UPDATE
  USING (
	school_id = auth.get_school_id() 
	AND (auth.get_user_role() = 'school_admin' OR auth.get_user_role() = 'super_admin')
  );

-- Fee payments: Admins can create/view, limited users can view their own
CREATE POLICY "View fee payments for your school" ON fee_payments
  FOR SELECT
  USING (school_id = auth.get_school_id());

CREATE POLICY "Admins can create fee payments" ON fee_payments
  FOR INSERT
  WITH CHECK (
	school_id = auth.get_school_id() 
	AND (auth.get_user_role() = 'school_admin' OR auth.get_user_role() = 'super_admin')
  );

-- Fee receipts: Read-only for most users
CREATE POLICY "View fee receipts for your school" ON fee_receipts
  FOR SELECT
  USING (school_id = auth.get_school_id());

CREATE POLICY "Admins can create receipts" ON fee_receipts
  FOR INSERT
  WITH CHECK (
	school_id = auth.get_school_id() 
	AND (auth.get_user_role() = 'school_admin' OR auth.get_user_role() = 'super_admin')
  );

-- ============================================================================
-- DASHBOARD & AUDIT
-- ============================================================================

-- Dashboard metrics: All users can view, admins can create
CREATE POLICY "View dashboard metrics for your school" ON dashboard_metrics
  FOR SELECT
  USING (school_id = auth.get_school_id());

CREATE POLICY "Admins can create dashboard metrics" ON dashboard_metrics
  FOR INSERT
  WITH CHECK (
	school_id = auth.get_school_id() 
	AND (auth.get_user_role() = 'school_admin' OR auth.get_user_role() = 'super_admin')
  );

-- Audit logs: Append-only, all users can view their own school's logs (security feature)
CREATE POLICY "View audit logs for your school" ON audit_logs
  FOR SELECT
  USING (school_id = auth.get_school_id());

CREATE POLICY "System can create audit logs" ON audit_logs
  FOR INSERT
  WITH CHECK (school_id = auth.get_school_id());

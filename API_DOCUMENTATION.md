// API_DOCUMENTATION.md
# Smart School ERP Backend API Documentation

## Table of Contents
1. [Authentication](#authentication)
2. [Students API](#students-api)
3. [Teachers API](#teachers-api)
4. [Classes & Subjects API](#classes--subjects-api)
5. [Attendance API](#attendance-api)
6. [Exams & Grading API](#exams--grading-api)
7. [Report Cards API](#report-cards-api)
8. [Fees Management API](#fees-management-api)
9. [Error Handling](#error-handling)

---

## Authentication

All API endpoints require authentication via Supabase Auth. Include the JWT token in the Authorization header:

\`\`\`
Authorization: Bearer <jwt_token>
\`\`\`

Multi-tenant isolation is enforced at the database layer via Row-Level Security (RLS) policies.

---

## Students API

### List Students

**Endpoint:** \`GET /api/students\`

**Query Parameters:**
- \`page\` (number, default: 1) - Page number for pagination
- \`pageSize\` (number, default: 20, max: 100) - Results per page
- \`classId\` (string, optional) - Filter by class ID
- \`searchQuery\` (string, optional) - Search by name or admission number
- \`status\` (string, optional) - Filter by enrollment status

**Response:**
\`\`\`json
{
  "success": true,
  "data": [...],
  "total": 100,
  "page": 1,
  "pageSize": 20,
  "totalPages": 5,
  "timestamp": "2024-01-15T10:30:00Z"
}
\`\`\`

### Create Student

**Endpoint:** \`POST /api/students\`

**Body:**
\`\`\`json
{
  "school_id": "uuid",
  "admission_number": "ADM2024001",
  "user_id": "uuid (optional)",
  "date_of_birth": "2010-05-15",
  "gender": "male",
  "parent_name": "John Doe",
  "parent_phone": "+256701234567",
  "parent_email": "parent@example.com",
  "address": "123 Main Street"
}
\`\`\`

### Get Student

**Endpoint:** \`GET /api/students/:id\`

### Update Student

**Endpoint:** \`PATCH /api/students/:id\`

**Body:** (any field is optional)
\`\`\`json
{
  "parent_name": "Jane Doe",
  "address": "456 New Street"
}
\`\`\`

### Delete Student

**Endpoint:** \`DELETE /api/students/:id\`

---

## Teachers API

### List Teachers

**Endpoint:** \`GET /api/teachers\`

**Query Parameters:**
- \`page\` (number, default: 1)
- \`pageSize\` (number, default: 20)
- \`status\` (string, optional) - Filter by status: active, inactive, on_leave
- \`searchQuery\` (string, optional) - Search by employee ID

### Create Teacher

**Endpoint:** \`POST /api/teachers\`

**Body:**
\`\`\`json
{
  "school_id": "uuid",
  "employee_id": "TEA2024001",
  "employment_date": "2024-01-15",
  "user_id": "uuid (optional)",
  "qualification": "B.Ed Mathematics",
  "date_of_birth": "1990-03-20",
  "gender": "male",
  "phone": "+256701234567",
  "address": "123 Teacher Street",
  "status": "active"
}
\`\`\`

### Get Teacher

**Endpoint:** \`GET /api/teachers/:id\`

Returns teacher details with assigned classes and subjects.

### Update Teacher

**Endpoint:** \`PATCH /api/teachers/:id\`

### Delete Teacher

**Endpoint:** \`DELETE /api/teachers/:id\`

---

## Classes & Subjects API

### List Classes

**Endpoint:** \`GET /api/classes\`

**Query Parameters:**
- \`page\` (number, default: 1)
- \`pageSize\` (number, default: 20)

### Create Class

**Endpoint:** \`POST /api/classes\`

**Body:**
\`\`\`json
{
  "school_id": "uuid",
  "name": "Form 1",
  "stream": "A",
  "level": 1,
  "form_teacher_id": "uuid (optional)",
  "capacity": 45
}
\`\`\`

### Get Class Details

**Endpoint:** \`GET /api/classes/:id\`

Returns full class details including form teacher, enrolled students, and subjects.

### List Subjects

**Endpoint:** \`GET /api/subjects\`

### Create Subject

**Endpoint:** \`POST /api/subjects\`

**Body:**
\`\`\`json
{
  "school_id": "uuid",
  "name": "Mathematics",
  "code": "MATH101",
  "description": "Advanced Mathematics"
}
\`\`\`

### Get Subject Details

**Endpoint:** \`GET /api/subjects/:id\`

---

## Attendance API

### Record Attendance

**Endpoint:** \`POST /api/attendance\`

**Body:**
\`\`\`json
{
  "class_id": "uuid",
  "date": "2024-01-15",
  "attendance": [
	{
	  "student_id": "uuid",
	  "status": "present",
	  "remarks": ""
	},
	{
	  "student_id": "uuid",
	  "status": "absent",
	  "remarks": "Medical appointment"
	}
  ]
}
\`\`\`

**Attendance Status:** present | absent | late | excused

### List Attendance Records

**Endpoint:** \`GET /api/attendance\`

**Query Parameters:**
- \`classId\` (string, required)
- \`date\` (string, optional) - Filter by date (YYYY-MM-DD)
- \`studentId\` (string, optional)
- \`status\` (string, optional)
- \`page\` (number, default: 1)
- \`pageSize\` (number, default: 50)

### Get Attendance Summary

**Endpoint:** \`GET /api/attendance/summary\`

**Query Parameters:**
- \`termId\` (string, required)
- \`classId\` (string, optional)
- \`studentId\` (string, optional)

Returns attendance percentages and day counts for the term.

---

## Exams & Grading API

### List Exams

**Endpoint:** \`GET /api/exams\`

**Query Parameters:**
- \`termId\` (string, optional)
- \`classId\` (string, optional)
- \`subjectId\` (string, optional)
- \`examType\` (string, optional) - aptitude_test, monthly_test, mid_term, end_term, mock, final
- \`page\` (number, default: 1)
- \`pageSize\` (number, default: 20)

### Create Exam

**Endpoint:** \`POST /api/exams\`

**Body:**
\`\`\`json
{
  "school_id": "uuid",
  "term_id": "uuid",
  "subject_id": "uuid",
  "class_id": "uuid",
  "exam_type": "end_term",
  "name": "Mathematics Final Exam",
  "exam_date": "2024-02-15",
  "total_marks": 100,
  "passing_marks": 40,
  "duration_minutes": 120
}
\`\`\`

### Submit Marks

**Endpoint:** \`POST /api/exams/:examId/marks\`

**Body:**
\`\`\`json
{
  "marks": [
	{
	  "student_id": "uuid",
	  "raw_score": 85
	},
	{
	  "student_id": "uuid",
	  "raw_score": 72
	}
  ]
}
\`\`\`

**Response:** Marks are auto-graded based on school's grading scale.

### Get Markbook

**Endpoint:** \`GET /api/exams/:examId/marks\`

---

## Report Cards API

### Generate Report Cards

**Endpoint:** \`POST /api/report-cards\`

**Body:**
\`\`\`json
{
  "school_id": "uuid",
  "term_id": "uuid",
  "class_id": "uuid"
}
\`\`\`

**Response:** Automatically calculates average scores, subjects passed, overall grades, and generates subject results.

### Get Report Cards

**Endpoint:** \`GET /api/report-cards\`

**Query Parameters:**
- \`termId\` (string, required)
- \`classId\` (string, optional)
- \`studentId\` (string, optional)

---

## Fees Management API

### List Fee Structures

**Endpoint:** \`GET /api/fees\`

**Query Parameters:**
- \`classId\` (string, optional)
- \`termId\` (string, optional)
- \`isActive\` (boolean, optional)
- \`page\` (number, default: 1)
- \`pageSize\` (number, default: 50)

### Create Fee Structure

**Endpoint:** \`POST /api/fees\`

**Body:**
\`\`\`json
{
  "school_id": "uuid",
  "class_id": "uuid",
  "term_id": "uuid",
  "fee_category_id": "uuid",
  "amount": 50000,
  "due_date": "2024-02-01",
  "is_active": true
}
\`\`\`

### Get Student Fee Balances

**Endpoint:** \`GET /api/fees/balances\`

**Query Parameters:**
- \`termId\` (string, required)
- \`classId\` (string, optional)
- \`studentId\` (string, optional)
- \`status\` (string, optional) - paid, pending, partial, overdue
- \`page\` (number, default: 1)
- \`pageSize\` (number, default: 50)

### Initialize Fee Balances

**Endpoint:** \`POST /api/fees/balances/initialize\`

**Body:**
\`\`\`json
{
  "school_id": "uuid",
  "class_id": "uuid",
  "term_id": "uuid"
}
\`\`\`

Automatically calculates total fees from fee structures.

### Process Payment

**Endpoint:** \`POST /api/fees/payments\`

**Body:**
\`\`\`json
{
  "student_id": "uuid",
  "term_id": "uuid",
  "amount": 25000,
  "payment_method": "bank_transfer",
  "reference_number": "TRF123456",
  "received_by": "uuid (optional)",
  "notes": "Partial payment"
}
\`\`\`

**Payment Method:** cash | bank_transfer | mobile_money | cheque

**Response:** Returns payment confirmation with receipt number.

### Get Payment History

**Endpoint:** \`GET /api/fees/payments\`

**Query Parameters:**
- \`studentId\` (string, optional)
- \`termId\` (string, optional)
- \`paymentMethod\` (string, optional)
- \`startDate\` (string, optional)
- \`endDate\` (string, optional)
- \`page\` (number, default: 1)
- \`pageSize\` (number, default: 50)

---

## Error Handling

All errors follow a consistent format:

\`\`\`json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400,
  "timestamp": "2024-01-15T10:30:00Z"
}
\`\`\`

**Common Status Codes:**
- 200: Success
- 201: Created
- 400: Bad Request
- 404: Not Found
- 500: Internal Server Error

---

## Business Logic Functions

The backend includes utility functions in \`src/lib/services/\`:

### Calculations (\`calculations.ts\`)
- \`calculateAttendancePercentage()\`
- \`calculateGradeFromScore()\`
- \`calculateAverageScore()\`
- \`countPassedSubjects()\`
- \`determineFeeStatus()\`
- \`getPerformanceCategory()\`
- \`getPromotionStatus()\`
- \`calculateGPA()\`

### Validations (\`validations.ts\`)
- \`isValidEmail()\`
- \`isValidPhone()\`
- \`isValidDate()\`
- \`isValidDateRange()\`
- \`isValidAdmissionNumber()\`
- \`validateStudentAge()\`
- \`validateTermDateOverlap()\`
- And 15+ more validators

### Reporting (\`reporting.ts\`)
- \`generateClassPerformanceReport()\`
- \`generateAttendanceReport()\`
- \`generateFeeCollectionReport()\`
- \`generateStudentProgressReport()\`
- \`generateSchoolDashboardStats()\`
- \`exportReportToCSV()\`

---

## Environment Variables

Required in \`.env.local\`:

\`\`\`
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxx
\`\`\`

---

## Database Migrations

Apply migrations in order:

1. \`supabase/migrations/001_init_schema.sql\` - Core tables and relationships
2. \`supabase/migrations/002_grading_defaults.sql\` - Default grading scales and fee categories
3. \`supabase/policies/rls_policies.sql\` - Row-Level Security policies

Run migrations:
\`\`\`bash
npm run db:setup
npm run db:seed
\`\`\`

---

## Testing API Endpoints

Example cURL commands:

### Create Student
\`\`\`bash
curl -X POST http://localhost:3000/api/students \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
	"school_id": "uuid",
	"admission_number": "ADM2024001",
	"parent_name": "John Doe"
  }'
\`\`\`

### Record Attendance
\`\`\`bash
curl -X POST http://localhost:3000/api/attendance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
	"class_id": "uuid",
	"date": "2024-01-15",
	"attendance": [
	  {"student_id": "uuid", "status": "present"}
	]
  }'
\`\`\`

### Process Fee Payment
\`\`\`bash
curl -X POST http://localhost:3000/api/fees/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
	"student_id": "uuid",
	"term_id": "uuid",
	"amount": 25000,
	"payment_method": "bank_transfer"
  }'
\`\`\`

---

## Next Steps

1. Deploy database migrations to Supabase
2. Enable RLS policies in Supabase dashboard
3. Test all API endpoints with proper authentication
4. Build frontend components to consume these APIs
5. Add rate limiting and caching for performance
6. Implement logging and monitoring

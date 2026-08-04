// src/lib/services/validations.ts
// Input validation and business rule checks

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (basic format)
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,4}[-\s.]?[0-9]{1,9}$/;
  return phoneRegex.test(phone);
}

/**
 * Validate date format (YYYY-MM-DD)
 */
export function isValidDate(dateString: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;

  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Validate date range (start_date < end_date)
 */
export function isValidDateRange(startDate: string, endDate: string): boolean {
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return false;
  }

  return new Date(startDate) < new Date(endDate);
}

/**
 * Validate student admission number (format: YYYYNNNNN)
 */
export function isValidAdmissionNumber(admissionNumber: string): boolean {
  // Custom format - adjust as needed
  const regex = /^[A-Z0-9]{1,50}$/;
  return regex.test(admissionNumber);
}

/**
 * Validate exam marks are within range
 */
export function isValidExamMarks(rawScore: number, totalMarks: number): boolean {
  return rawScore >= 0 && rawScore <= totalMarks && !isNaN(rawScore);
}

/**
 * Validate class level
 */
export function isValidClassLevel(level: number): boolean {
  return level >= 1 && level <= 12 && Number.isInteger(level);
}

/**
 * Validate enrollment status
 */
export function isValidEnrollmentStatus(status: string): boolean {
  const validStatuses = ['active', 'inactive', 'transferred', 'graduated'];
  return validStatuses.includes(status);
}

/**
 * Validate attendance status
 */
export function isValidAttendanceStatus(status: string): boolean {
  const validStatuses = ['present', 'absent', 'late', 'excused'];
  return validStatuses.includes(status);
}

/**
 * Validate payment method
 */
export function isValidPaymentMethod(method: string): boolean {
  const validMethods = ['cash', 'bank_transfer', 'mobile_money', 'cheque'];
  return validMethods.includes(method);
}

/**
 * Validate exam type
 */
export function isValidExamType(type: string): boolean {
  const validTypes = ['aptitude_test', 'monthly_test', 'mid_term', 'end_term', 'mock', 'final'];
  return validTypes.includes(type);
}

/**
 * Validate user role
 */
export function isValidUserRole(role: string): boolean {
  const validRoles = ['super_admin', 'school_admin', 'teacher', 'student', 'parent'];
  return validRoles.includes(role);
}

/**
 * Validate positive number
 */
export function isPositiveNumber(value: unknown): boolean {
  const num = Number(value);
  return !isNaN(num) && num > 0;
}

/**
 * Validate non-negative number
 */
export function isNonNegativeNumber(value: unknown): boolean {
  const num = Number(value);
  return !isNaN(num) && num >= 0;
}

/**
 * Validate school can have x students (capacity check)
 */
export function validateClassCapacity(currentCount: number, capacity: number | null): boolean {
  if (capacity === null) return true; // No limit
  return currentCount < capacity;
}

/**
 * Validate term doesn't overlap with existing terms
 */
export function validateTermDateOverlap(
  startDate: string,
  endDate: string,
  existingTerms: Array<{ start_date: string; end_date: string }>
): boolean {
  const newStart = new Date(startDate);
  const newEnd = new Date(endDate);

  return !existingTerms.some((term) => {
    const existingStart = new Date(term.start_date);
    const existingEnd = new Date(term.end_date);

    // Check if ranges overlap
    return newStart < existingEnd && newEnd > existingStart;
  });
}

/**
 * Validate student age (minimum age requirement)
 */
export function validateStudentAge(dateOfBirth: string, minimumAge: number = 4): boolean {
  if (!isValidDate(dateOfBirth)) return false;

  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();

  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age >= minimumAge;
}

/**
 * Validate subject can be taught by teacher (has qualification?)
 */
export function canTeacherTeachSubject(
  teacherQualifications: string | null,
  subjectCode: string
): boolean {
  if (!teacherQualifications) return true; // Assume capability unless specified

  // Simple check - can be enhanced with actual qualification mapping
  return teacherQualifications.toLowerCase().includes(subjectCode.toLowerCase());
}

/**
 * Batch validation helper
 */
export function validateObject(
  obj: Record<string, unknown>,
  schema: Record<string, (value: unknown) => boolean>
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  Object.entries(schema).forEach(([key, validator]) => {
    if (!validator(obj[key])) {
      errors[key] = `Invalid value for ${key}`;
    }
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

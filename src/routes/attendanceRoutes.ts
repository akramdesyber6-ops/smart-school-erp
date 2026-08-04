import { Router } from 'express';
import {
  getAttendance,
  markAttendance,
  updateAttendance,
  getAttendanceReport,
  getClassAttendanceReport,
} from '@/controllers/attendanceController';
import { authenticateToken, authorizeRole } from '@/middleware/auth';

const router = Router();

/**
 * GET /api/attendance
 * Get attendance records (with optional filters)
 */
router.get('/', authenticateToken, getAttendance);

/**
 * POST /api/attendance
 * Mark attendance (admin/teacher)
 */
router.post('/', authenticateToken, authorizeRole(['admin', 'teacher']), markAttendance);

/**
 * PUT /api/attendance/:id
 * Update attendance (admin/teacher)
 */
router.put('/:id', authenticateToken, authorizeRole(['admin', 'teacher']), updateAttendance);

/**
 * GET /api/attendance/report/:studentId/:courseId
 * Get attendance report for student and course
 */
router.get('/report/:studentId/:courseId', authenticateToken, getAttendanceReport);

/**
 * GET /api/attendance/class-report/:classId/:courseId/:date
 * Get class attendance report for specific date
 */
router.get(
  '/class-report/:classId/:courseId/:date',
  authenticateToken,
  authorizeRole(['admin', 'teacher']),
  getClassAttendanceReport
);

export default router;

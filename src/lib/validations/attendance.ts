import { z } from "zod";

export const attendanceRecordSchema = z.object({
  studentId: z.string().uuid(),
  status: z.enum(["present", "absent", "late", "excused"]),
  remarks: z.string().optional().nullable()
});

export const recordBulkAttendanceSchema = z.object({
  classId: z.string().uuid(),
  streamId: z.string().uuid().optional().nullable(),
  date: z.string().refine((d) => !Number.isNaN(Date.parse(d)), { message: "Invalid date" }),
  records: z.array(attendanceRecordSchema).min(1)
});

export type RecordBulkAttendanceInput = z.infer<typeof recordBulkAttendanceSchema>;

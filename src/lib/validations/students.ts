import { z } from "zod";

export const createStudentSchema = z.object({
  school_id: z.string().uuid(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  admission_number: z.string().optional().nullable(),
  class_id: z.string().uuid().optional().nullable(),
  stream_id: z.string().uuid().optional().nullable(),
  status: z.enum(["active", "inactive", "graduated"]).optional(),
  email: z.string().email().optional().nullable(),
  dob: z.string().optional().nullable(), // ISO date string (YYYY-MM-DD)
  enrolled_at: z.string().optional().nullable(), // ISO datetime
  metadata: z.record(z.any()).optional()
});

export const updateStudentSchema = z.object({
  id: z.string().uuid(),
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  admission_number: z.string().optional().nullable(),
  class_id: z.string().uuid().optional().nullable(),
  stream_id: z.string().uuid().optional().nullable(),
  status: z.enum(["active", "inactive", "graduated"]).optional(),
  email: z.string().email().optional().nullable(),
  dob: z.string().optional().nullable(),
  enrolled_at: z.string().optional().nullable(),
  metadata: z.record(z.any()).optional()
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

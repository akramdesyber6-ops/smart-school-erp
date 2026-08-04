import { z } from "zod";

export const createExamSchema = z.object({
  academicYearId: z.string().uuid(),
  termId: z.string().uuid(),
  examTypeId: z.string().uuid(),
  name: z.string().min(1)
});

export const createGradingScaleSchema = z.object({
  name: z.string().min(1),
  minScore: z.number(),
  maxScore: z.number(),
  grade: z.string().min(1),
  gpaPoint: z.number().optional(),
  remark: z.string().optional().nullable()
});

export const recordBulkMarksSchema = z.object({
  examId: z.string().uuid(),
  classSubjectId: z.string().uuid(),
  marks: z.array(
    z.object({
      studentId: z.string().uuid(),
      markObtained: z.number(),
      remarks: z.string().optional().nullable()
    })
  ).min(1)
});

export type CreateExamInput = z.infer<typeof createExamSchema>;
export type CreateGradingScaleInput = z.infer<typeof createGradingScaleSchema>;
export type RecordBulkMarksInput = z.infer<typeof recordBulkMarksSchema>;

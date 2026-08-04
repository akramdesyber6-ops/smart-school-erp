export type ApiResponse<T> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; details?: any };

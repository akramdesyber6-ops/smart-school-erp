import AttendanceWorkspace from '@/components/attendance/AttendanceWorkspace';

export default function TeacherAttendancePage(): JSX.Element {
  return <AttendanceWorkspace requiredRole="teacher" />;
}

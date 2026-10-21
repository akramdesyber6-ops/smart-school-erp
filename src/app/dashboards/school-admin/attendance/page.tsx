import AttendanceWorkspace from '@/components/attendance/AttendanceWorkspace';

export default function SchoolAttendancePage(): JSX.Element {
  return <AttendanceWorkspace requiredRole="admin" />;
}

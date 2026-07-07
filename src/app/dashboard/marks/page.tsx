import { Metadata } from 'next';
import MarksEntryDashboard from '@/components/MarksEntryDashboard';
import { Student } from '@/types/assessment';

export const metadata: Metadata = {
  title: 'Target Marks Entry | Smart School ERP',
  description: 'Teacher dashboard for entering student assessment scores',
};

// Mock data for demonstration
const mockStudents: Student[] = [
  {
    id: 'OU-STD-2026-0001',
    firstName: 'John',
    lastName: 'Okello',
    stream: 'East',
    class: 'Senior One',
  },
  {
    id: 'OU-STD-2026-0002',
    firstName: 'Mary',
    lastName: 'Nakamanya',
    stream: 'West',
    class: 'Senior One',
  },
  {
    id: 'OU-STD-2026-0003',
    firstName: 'Samuel',
    lastName: 'Mugwanya',
    stream: 'East',
    class: 'Senior One',
  },
  {
    id: 'OU-STD-2026-0004',
    firstName: 'Grace',
    lastName: 'Kyambire',
    stream: 'East',
    class: 'Senior One',
  },
  {
    id: 'OU-STD-2026-0005',
    firstName: 'Peter',
    lastName: 'Ssebunya',
    stream: 'West',
    class: 'Senior One',
  },
  {
    id: 'OU-STD-2026-0006',
    firstName: 'Alice',
    lastName: 'Namukasa',
    stream: 'East',
    class: 'Senior One',
  },
  {
    id: 'OU-STD-2026-0007',
    firstName: 'David',
    lastName: 'Ndawula',
    stream: 'West',
    class: 'Senior One',
  },
  {
    id: 'OU-STD-2026-0008',
    firstName: 'Hannah',
    lastName: 'Ntege',
    stream: 'East',
    class: 'Senior One',
  },
];

export default function MarksPage() {
  return (
    <div>
      <MarksEntryDashboard
        class="Senior One"
        subject="Agriculture"
        term="Term 1 2026"
        students={mockStudents}
        assessmentType="AOI1"
      />
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Loader2, Printer, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase/api';
import useAuthStore from '@/lib/stores/useAuthStore';
import { formatUgx } from '@/lib/finance/financeUtils';

type ReceiptRecord = {
  id: string;
  school_id: string;
  student_id: string;
  receipt_number: string;
  amount: number;
  payment_method: string;
  reference: string | null;
  received_at: string;
  status: 'posted' | 'reversed';
  reversal_reason: string | null;
  reversed_at: string | null;
  students: {
    first_name: string;
    last_name: string;
    registration_number: string;
  } | null;
};

type AllocationRecord = {
  amount: number;
  student_invoices: {
    invoice_number: string;
    due_date: string | null;
    term_id: string;
  } | null;
};

type SchoolRecord = {
  name: string;
  location: string | null;
  phone: string | null;
  email: string | null;
  emis_code: string | null;
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-UG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FinanceReceiptPage(): JSX.Element {
  const params = useParams<{ paymentId: string }>();
  const router = useRouter();
  const { profile } = useAuthStore();
  const [receipt, setReceipt] = useState<ReceiptRecord | null>(null);
  const [allocations, setAllocations] = useState<AllocationRecord[]>([]);
  const [school, setSchool] = useState<SchoolRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadReceipt = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: userResult, error: userError } = await supabase.auth.getUser();
        if (userError || !userResult.user) {
          router.replace('/login');
          return;
        }

        const { data: userProfile, error: profileError } = await supabase
          .from('profiles')
          .select('id, school_id, role, is_active')
          .eq('user_id', userResult.user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!userProfile || !['admin', 'school_admin', 'bursar'].includes(userProfile.role)) {
          router.replace('/');
          return;
        }

        const { data: paymentRow, error: paymentError } = await supabase
          .from('fee_payments')
          .select('id, school_id, student_id, receipt_number, amount, payment_method, reference, received_at, status, reversal_reason, reversed_at, students!inner(first_name,last_name,registration_number)')
          .eq('id', params.paymentId)
          .eq('school_id', userProfile.school_id)
          .maybeSingle();

        if (paymentError) throw paymentError;
        if (!paymentRow) throw new Error('This receipt was not found in your school.');

        const [allocationsResult, schoolResult] = await Promise.all([
          supabase
            .from('fee_payment_allocations')
            .select('amount, student_invoices!inner(invoice_number,due_date,term_id)')
            .eq('payment_id', paymentRow.id)
            .eq('school_id', userProfile.school_id),
          supabase
            .from('schools')
            .select('name, location, phone, email, emis_code')
            .eq('id', userProfile.school_id)
            .maybeSingle(),
        ]);

        if (allocationsResult.error) throw allocationsResult.error;
        if (schoolResult.error) throw schoolResult.error;
        if (active) {
          const student = Array.isArray(paymentRow.students) ? paymentRow.students[0] : paymentRow.students;
          setReceipt({ ...paymentRow, students: student } as unknown as ReceiptRecord);
          setAllocations((allocationsResult.data ?? []) as unknown as AllocationRecord[]);
          setSchool(schoolResult.data as SchoolRecord | null);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Receipt could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadReceipt();
    return () => { active = false; };
  }, [params.paymentId, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
        <span className="ml-3 text-sm text-slate-600">Loading receipt…</span>
      </main>
    );
  }

  if (error || !receipt) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <FileText className="h-8 w-8 text-indigo-600" />
          <h1 className="mt-3 text-xl font-bold text-slate-900">Receipt unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">{error ?? 'Receipt not found.'}</p>
          <Link href="/dashboards/finance" className="mt-5 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" /> Back to finance
          </Link>
        </section>
      </main>
    );
  }

  const student = receipt.students;
  const totalAllocated = allocations.reduce((total, item) => total + Number(item.amount), 0);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href="/dashboards/finance" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-700">
            <ArrowLeft className="h-4 w-4" /> Back to finance
          </Link>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
            <Printer className="h-4 w-4" /> Print receipt
          </button>
        </div>

        <article className="receipt-sheet overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b-4 border-indigo-600 bg-slate-950 px-6 py-7 text-white sm:px-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Official payment receipt</p>
                <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{school?.name ?? 'School'}</h1>
                {school?.location && <p className="mt-1 text-sm text-slate-300">{school.location}</p>}
                <div className="mt-3 space-y-1 text-xs text-slate-300">
                  {school?.phone && <p>Tel: {school.phone}</p>}
                  {school?.email && <p>Email: {school.email}</p>}
                  {school?.emis_code && <p>EMIS: {school.emis_code}</p>}
                </div>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/10 p-3 text-indigo-200">
                <ShieldCheck className="h-7 w-7" />
              </div>
            </div>
          </div>

          <div className="space-y-7 px-6 py-7 sm:px-10 sm:py-9">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Receipt number</p>
                <p className="mt-1 text-xl font-bold tracking-wide text-indigo-700">{receipt.receipt_number}</p>
                <p className="mt-2 text-sm text-slate-500">Payment date: {formatDate(receipt.received_at)}</p>
              </div>
              <div className={receipt.status === 'posted' ? 'rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold uppercase tracking-wider text-emerald-700' : 'rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold uppercase tracking-wider text-rose-700'}>
                {receipt.status === 'posted' ? 'Payment received' : 'Reversed receipt'}
              </div>
            </div>

            {receipt.status === 'reversed' && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                <p className="font-bold">This payment was reversed.</p>
                <p className="mt-1">Reason: {receipt.reversal_reason ?? 'Not recorded'}</p>
                {receipt.reversed_at && <p className="mt-1 text-xs">Reversed: {formatDate(receipt.reversed_at)}</p>}
              </div>
            )}

            <section className="rounded-xl border border-slate-200">
              <div className="border-b bg-slate-50 px-4 py-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Received from</h2>
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-500">Student name</p>
                  <p className="mt-1 font-semibold text-slate-900">{student ? `${student.first_name} ${student.last_name}` : 'Student'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Registration number</p>
                  <p className="mt-1 font-semibold text-slate-900">{student?.registration_number ?? '—'}</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Payment details</h2>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
                  <span className="text-sm text-slate-600">Payment method</span>
                  <span className="text-sm font-semibold capitalize text-slate-900">{receipt.payment_method.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
                  <span className="text-sm text-slate-600">Transaction reference</span>
                  <span className="break-all text-right text-sm font-semibold text-slate-900">{receipt.reference ?? '—'}</span>
                </div>
                {allocations.map((allocation, index) => (
                  <div key={index} className="flex items-center justify-between gap-4 border-b px-4 py-3">
                    <span className="text-sm text-slate-600">Invoice {allocation.student_invoices?.invoice_number ?? '—'}</span>
                    <span className="text-sm font-semibold text-slate-900">{formatUgx(allocation.amount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-4 bg-slate-50 px-4 py-4">
                  <span className="font-bold text-slate-800">Total received</span>
                  <span className="text-xl font-bold tabular-nums text-indigo-700">{formatUgx(receipt.amount)}</span>
                </div>
              </div>
              {totalAllocated !== Number(receipt.amount) && (
                <p className="mt-2 text-xs text-amber-700">The allocated invoice total differs from the receipt amount. Please contact the school finance office.</p>
              )}
            </section>

            <div className="border-t border-dashed border-slate-300 pt-5 text-center">
              <p className="text-sm font-semibold text-slate-800">Thank you for your payment.</p>
              <p className="mt-1 text-xs text-slate-500">Keep this receipt for your records. Verify any discrepancy with the school finance office.</p>
              <p className="mt-4 text-[10px] uppercase tracking-[0.2em] text-slate-400">Generated by Smart School ERP</p>
            </div>
          </div>
        </article>
      </div>
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { background: #ffffff !important; }
          main { min-height: auto !important; background: #ffffff !important; padding: 0 !important; }
          .receipt-sheet { max-width: none !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
          .print\\:hidden { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </main>
  );
}

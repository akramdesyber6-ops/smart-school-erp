'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  BookOpen,
  CheckCircle,
  CircleDollarSign,
  CreditCard,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Wallet,
} from 'lucide-react';
import useAuthStore from '@/lib/stores/useAuthStore';
import { supabase } from '@/lib/supabase/api';
import { formatUgx, summarizeFinance, type InvoiceStatus } from '@/lib/finance/financeUtils';

type TermOption = {
  id: string;
  name: string;
  academic_year_id: string;
  is_current: boolean;
};

type ClassOption = {
  id: string;
  name: string;
  stream: string | null;
};

type StudentOption = {
  id: string;
  first_name: string;
  last_name: string;
  registration_number: string;
};

type CategoryOption = {
  id: string;
  name: string;
};

type FeeStructure = {
  id: string;
  name: string;
  amount: number;
  class_id: string;
  term_id: string;
  category_id: string;
  due_date: string | null;
};

type EnrollmentOption = {
  student_id: string;
  term_id: string;
  class_id: string;
};

type InvoiceBalance = {
  id: string;
  student_id: string;
  term_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  status: InvoiceStatus;
  notes: string | null;
  first_name: string;
  last_name: string;
  registration_number: string;
  term_name: string;
  total_amount: number;
  paid_amount: number;
  balance: number;
  created_at: string;
};

type PaymentRow = {
  id: string;
  student_id: string;
  receipt_number: string;
  amount: number;
  payment_method: string;
  reference: string | null;
  received_at: string;
  status: 'posted' | 'reversed';
  students?: StudentOption | StudentOption[] | null;
};

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100';
const buttonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

function displayDate(value: string | null): string {
  if (!value) return 'Not set';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusClasses(status: InvoiceStatus): string {
  switch (status) {
    case 'paid':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-600/15';
    case 'partially_paid':
      return 'bg-amber-50 text-amber-700 ring-amber-600/15';
    case 'cancelled':
      return 'bg-slate-100 text-slate-600 ring-slate-500/15';
    default:
      return 'bg-indigo-50 text-indigo-700 ring-indigo-600/15';
  }
}

function humanStatus(status: string): string {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function FinanceDashboard(): JSX.Element {
  const router = useRouter();
  const { profile, activeSchoolId } = useAuthStore();

  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingStructure, setSavingStructure] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [terms, setTerms] = useState<TermOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentOption[]>([]);
  const [invoices, setInvoices] = useState<InvoiceBalance[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  const [categoryName, setCategoryName] = useState('');
  const [structureForm, setStructureForm] = useState({
    name: '',
    category_id: '',
    class_id: '',
    term_id: '',
    amount: '',
    due_date: '',
    description: '',
  });
  const [invoiceForm, setInvoiceForm] = useState({
    student_id: '',
    term_id: '',
    due_date: '',
    notes: '',
  });
  const [selectedFeeIds, setSelectedFeeIds] = useState<string[]>([]);
  const [paymentForm, setPaymentForm] = useState({
    invoice_id: '',
    amount: '',
    payment_method: 'cash',
    reference: '',
  });
  const paymentIdempotencyKey = useRef<string | null>(null);

  const loadData = useCallback(async () => {
    if (!activeSchoolId) return;
    setLoading(true);
    setError(null);

    try {
      const [
        termsResult,
        classesResult,
        studentsResult,
        categoriesResult,
        feesResult,
        enrollmentsResult,
        invoicesResult,
        paymentsResult,
      ] = await Promise.all([
        supabase
          .from('academic_terms')
          .select('id, name, academic_year_id, is_current')
          .eq('school_id', activeSchoolId)
          .order('start_date', { ascending: false }),
        supabase
          .from('classes')
          .select('id, name, stream')
          .eq('school_id', activeSchoolId)
          .order('name', { ascending: true }),
        supabase
          .from('students')
          .select('id, first_name, last_name, registration_number')
          .eq('school_id', activeSchoolId)
          .eq('is_active', true)
          .order('last_name', { ascending: true })
          .limit(1000),
        supabase
          .from('fee_categories')
          .select('id, name')
          .eq('school_id', activeSchoolId)
          .eq('is_active', true)
          .order('name', { ascending: true }),
        supabase
          .from('fee_structures')
          .select('id, name, amount, class_id, term_id, category_id, due_date')
          .eq('school_id', activeSchoolId)
          .eq('is_active', true)
          .order('name', { ascending: true }),
        supabase
          .from('enrollments')
          .select('student_id, term_id, class_id')
          .eq('school_id', activeSchoolId)
          .eq('status', 'active'),
        supabase
          .from('student_invoice_balances')
          .select('id, student_id, term_id, invoice_number, issue_date, due_date, status, notes, first_name, last_name, registration_number, term_name, total_amount, paid_amount, balance, created_at')
          .eq('school_id', activeSchoolId)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('fee_payments')
          .select('id, student_id, receipt_number, amount, payment_method, reference, received_at, status, students!inner(first_name,last_name,registration_number)')
          .eq('school_id', activeSchoolId)
          .order('received_at', { ascending: false })
          .limit(10),
      ]);

      const firstError = [
        termsResult.error,
        classesResult.error,
        studentsResult.error,
        categoriesResult.error,
        feesResult.error,
        enrollmentsResult.error,
        invoicesResult.error,
        paymentsResult.error,
      ].find(Boolean);
      if (firstError) throw firstError;

      setTerms((termsResult.data ?? []) as TermOption[]);
      setClasses((classesResult.data ?? []) as ClassOption[]);
      setStudents((studentsResult.data ?? []) as StudentOption[]);
      setCategories((categoriesResult.data ?? []) as CategoryOption[]);
      setFeeStructures((feesResult.data ?? []) as FeeStructure[]);
      setEnrollments((enrollmentsResult.data ?? []) as EnrollmentOption[]);
      setInvoices((invoicesResult.data ?? []) as InvoiceBalance[]);
      setPayments((paymentsResult.data ?? []) as PaymentRow[]);
    } catch (loadError) {
      console.error('Finance workspace load failed:', loadError);
      setError(
        'Finance data could not be loaded. Confirm that the fees-and-payments migration has been applied to this environment and that your finance permissions are active.'
      );
    } finally {
      setLoading(false);
    }
  }, [activeSchoolId]);

  useEffect(() => {
    if (!profile || !activeSchoolId) {
      router.replace('/login');
      return;
    }

    if (!['admin', 'school_admin', 'bursar'].includes(profile.role)) {
      router.replace('/');
      return;
    }

    setAuthorized(true);
    void loadData();
  }, [profile, activeSchoolId, loadData, router]);

  const summary = useMemo(() => summarizeFinance(invoices), [invoices]);
  const selectedEnrollment = enrollments.find(
    (enrollment) =>
      enrollment.student_id === invoiceForm.student_id &&
      enrollment.term_id === invoiceForm.term_id
  );
  const eligibleFeeStructures = feeStructures.filter(
    (fee) =>
      fee.term_id === invoiceForm.term_id &&
      fee.class_id === selectedEnrollment?.class_id
  );
  const selectedPaymentInvoice = invoices.find(
    (invoice) => invoice.id === paymentForm.invoice_id
  );
  const payableInvoices = invoices.filter(
    (invoice) => invoice.balance > 0 && invoice.status !== 'cancelled'
  );
  const filteredInvoices = invoices.filter((invoice) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return [
      invoice.invoice_number,
      invoice.first_name,
      invoice.last_name,
      invoice.registration_number,
      invoice.term_name,
    ].some((value) => value.toLowerCase().includes(needle));
  });

  const createCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeSchoolId || !categoryName.trim()) return;
    setSavingStructure(true);
    setError(null);
    setNotice(null);
    try {
      const { data, error: insertError } = await supabase
        .from('fee_categories')
        .insert({ school_id: activeSchoolId, name: categoryName.trim() })
        .select('id, name')
        .single();
      if (insertError) throw insertError;
      setCategories((current) => [...current, data as CategoryOption].sort((a, b) => a.name.localeCompare(b.name)));
      setCategoryName('');
      setNotice('Fee category created.');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Fee category could not be created.');
    } finally {
      setSavingStructure(false);
    }
  };

  const createFeeStructure = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeSchoolId || !profile?.id) return;
    const term = terms.find((item) => item.id === structureForm.term_id);
    if (!term || !structureForm.category_id || !structureForm.class_id) {
      setError('Choose a category, class and academic term for this fee.');
      return;
    }
    const amount = Number(structureForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a fee amount greater than zero.');
      return;
    }

    setSavingStructure(true);
    setError(null);
    setNotice(null);
    try {
      const { error: insertError } = await supabase.from('fee_structures').insert({
        school_id: activeSchoolId,
        academic_year_id: term.academic_year_id,
        term_id: term.id,
        class_id: structureForm.class_id,
        category_id: structureForm.category_id,
        name: structureForm.name.trim(),
        description: structureForm.description.trim() || null,
        amount,
        due_date: structureForm.due_date || null,
        created_by: profile.id,
      });
      if (insertError) throw insertError;
      setStructureForm({
        name: '',
        category_id: '',
        class_id: '',
        term_id: '',
        amount: '',
        due_date: '',
        description: '',
      });
      setNotice('Fee structure saved. You can now add it to a student invoice.');
      await loadData();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Fee structure could not be saved.');
    } finally {
      setSavingStructure(false);
    }
  };

  const issueInvoice = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!invoiceForm.student_id || !invoiceForm.term_id || selectedFeeIds.length === 0) {
      setError('Choose a student, term and at least one matching fee item.');
      return;
    }
    setSavingInvoice(true);
    setError(null);
    setNotice(null);
    try {
      const { error: rpcError } = await supabase.rpc('create_student_invoice', {
        target_student_id: invoiceForm.student_id,
        target_term_id: invoiceForm.term_id,
        target_due_date: invoiceForm.due_date || null,
        target_notes: invoiceForm.notes.trim() || null,
        target_fee_structure_ids: selectedFeeIds,
      });
      if (rpcError) throw rpcError;
      setInvoiceForm({ student_id: '', term_id: '', due_date: '', notes: '' });
      setSelectedFeeIds([]);
      setNotice('Student invoice issued successfully.');
      await loadData();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Invoice could not be issued.');
    } finally {
      setSavingInvoice(false);
    }
  };

  const recordPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(paymentForm.amount);
    if (!paymentForm.invoice_id || !Number.isFinite(amount) || amount <= 0) {
      setError('Choose an invoice and enter a payment amount greater than zero.');
      return;
    }
    if (selectedPaymentInvoice && amount > selectedPaymentInvoice.balance) {
      setError('The payment cannot exceed the selected invoice balance.');
      return;
    }

    setSavingPayment(true);
    setError(null);
    setNotice(null);
    try {
      // Keep the key until the server confirms success. Retrying an uncertain request
      // with the same key cannot create a duplicate receipt.
      if (!paymentIdempotencyKey.current) {
        paymentIdempotencyKey.current = crypto.randomUUID();
      }
      const { error: rpcError } = await supabase.rpc('record_fee_payment', {
        target_invoice_id: paymentForm.invoice_id,
        target_amount: amount,
        target_payment_method: paymentForm.payment_method,
        target_reference: paymentForm.reference.trim() || null,
        target_idempotency_key: paymentIdempotencyKey.current,
      });
      if (rpcError) throw rpcError;
      paymentIdempotencyKey.current = null;
      setPaymentForm({ invoice_id: '', amount: '', payment_method: 'cash', reference: '' });
      setNotice('Payment posted and receipt number generated.');
      await loadData();
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : 'Payment was not posted. Retry safely or contact the administrator.');
    } finally {
      setSavingPayment(false);
    }
  };

  if (!authorized || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          Loading finance workspace…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <Link href="/" className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 transition hover:text-indigo-700">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to portal
            </Link>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm">
                <Wallet className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Smart School ERP · Finance</p>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Fees &amp; payments</h1>
                <p className="mt-0.5 text-sm text-slate-500">Fee structures, student invoices, balances and receipts.</p>
              </div>
            </div>
          </div>
          <button type="button" onClick={() => void loadData()} className={secondaryButtonClass}>
            <RefreshCw className="h-4 w-4" /> Refresh finance data
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="flex-1">{error}</p>
            <button type="button" onClick={() => setError(null)} className="font-semibold underline">Dismiss</button>
          </div>
        )}
        {notice && (
          <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="flex-1">{notice}</p>
            <button type="button" onClick={() => setNotice(null)} className="font-semibold underline">Dismiss</button>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Finance summary">
          <SummaryCard icon={<FileText className="h-5 w-5" />} label="Total invoiced" value={formatUgx(summary.invoiced)} accent="indigo" />
          <SummaryCard icon={<Banknote className="h-5 w-5" />} label="Payments collected" value={formatUgx(summary.collected)} accent="emerald" />
          <SummaryCard icon={<Wallet className="h-5 w-5" />} label="Outstanding balance" value={formatUgx(summary.outstanding)} accent="violet" />
          <SummaryCard icon={<ArrowUpRight className="h-5 w-5" />} label="Overdue balance" value={formatUgx(summary.overdue)} accent="amber" footnote={`${summary.unpaidInvoices} invoice(s) still have a balance`} />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Setup</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">Fee categories &amp; structures</h2>
                  <p className="mt-1 text-sm text-slate-500">Define what each class is charged for in a term.</p>
                </div>
                <span className="rounded-xl bg-indigo-50 p-2.5 text-indigo-700"><BookOpen className="h-5 w-5" /></span>
              </div>

              <form onSubmit={createCategory} className="mb-5 flex flex-col gap-2 sm:flex-row">
                <label className="sr-only" htmlFor="fee-category-name">New fee category</label>
                <input id="fee-category-name" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} className={inputClass + ' mt-0 flex-1'} placeholder="Add category, e.g. Tuition or Boarding" required />
                <button type="submit" className={secondaryButtonClass} disabled={savingStructure || !categoryName.trim()}>
                  <Plus className="h-4 w-4" /> Add category
                </button>
              </form>

              <form onSubmit={createFeeStructure} className="space-y-4 border-t border-slate-100 pt-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Fee name">
                    <input className={inputClass} value={structureForm.name} onChange={(event) => setStructureForm({ ...structureForm, name: event.target.value })} placeholder="e.g. Term tuition" required />
                  </Field>
                  <Field label="Category">
                    <select className={inputClass} value={structureForm.category_id} onChange={(event) => setStructureForm({ ...structureForm, category_id: event.target.value })} required>
                      <option value="">Select category</option>
                      {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Class / stream">
                    <select className={inputClass} value={structureForm.class_id} onChange={(event) => setStructureForm({ ...structureForm, class_id: event.target.value })} required>
                      <option value="">Select class</option>
                      {classes.map((item) => <option key={item.id} value={item.id}>{item.name}{item.stream ? ` · ${item.stream}` : ''}</option>)}
                    </select>
                  </Field>
                  <Field label="Academic term">
                    <select className={inputClass} value={structureForm.term_id} onChange={(event) => setStructureForm({ ...structureForm, term_id: event.target.value })} required>
                      <option value="">Select term</option>
                      {terms.map((item) => <option key={item.id} value={item.id}>{item.name}{item.is_current ? ' · Current' : ''}</option>)}
                    </select>
                  </Field>
                  <Field label="Amount (UGX)">
                    <input className={inputClass} type="number" min="1" step="1" value={structureForm.amount} onChange={(event) => setStructureForm({ ...structureForm, amount: event.target.value })} placeholder="150000" required />
                  </Field>
                  <Field label="Due date (optional)">
                    <input className={inputClass} type="date" value={structureForm.due_date} onChange={(event) => setStructureForm({ ...structureForm, due_date: event.target.value })} />
                  </Field>
                </div>
                <Field label="Description (optional)">
                  <input className={inputClass} value={structureForm.description} onChange={(event) => setStructureForm({ ...structureForm, description: event.target.value })} placeholder="What this fee covers" />
                </Field>
                <button type="submit" className={buttonClass} disabled={savingStructure || categories.length === 0 || classes.length === 0 || terms.length === 0}>
                  {savingStructure ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Save fee structure
                </button>
                {categories.length === 0 && <p className="text-xs text-amber-700">Add a fee category before creating a fee structure.</p>}
              </form>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Billing</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">Issue student invoice</h2>
                  <p className="mt-1 text-sm text-slate-500">Only fee items matching the student’s class and term can be selected.</p>
                </div>
                <span className="rounded-xl bg-violet-50 p-2.5 text-violet-700"><FileText className="h-5 w-5" /></span>
              </div>

              <form onSubmit={issueInvoice} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Student">
                    <select className={inputClass} value={invoiceForm.student_id} onChange={(event) => { setInvoiceForm({ ...invoiceForm, student_id: event.target.value }); setSelectedFeeIds([]); }} required>
                      <option value="">Select student</option>
                      {students.map((student) => <option key={student.id} value={student.id}>{student.first_name} {student.last_name} · {student.registration_number}</option>)}
                    </select>
                  </Field>
                  <Field label="Academic term">
                    <select className={inputClass} value={invoiceForm.term_id} onChange={(event) => { setInvoiceForm({ ...invoiceForm, term_id: event.target.value }); setSelectedFeeIds([]); }} required>
                      <option value="">Select term</option>
                      {terms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                </div>

                {invoiceForm.student_id && invoiceForm.term_id && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-3 text-sm font-semibold text-slate-800">Available fee items</p>
                    {eligibleFeeStructures.length === 0 ? (
                      <p className="text-sm text-slate-500">No active fee structure matches this student’s current class and selected term.</p>
                    ) : (
                      <div className="space-y-2">
                        {eligibleFeeStructures.map((fee) => {
                          const checked = selectedFeeIds.includes(fee.id);
                          return (
                            <label key={fee.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:border-indigo-300">
                              <span className="flex min-w-0 items-center gap-3">
                                <input type="checkbox" checked={checked} onChange={(event) => setSelectedFeeIds((current) => event.target.checked ? [...current, fee.id] : current.filter((id) => id !== fee.id))} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-semibold text-slate-800">{fee.name}</span>
                                  <span className="block text-xs text-slate-500">Due {displayDate(fee.due_date)}</span>
                                </span>
                              </span>
                              <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">{formatUgx(fee.amount)}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-sm">
                      <span className="font-medium text-slate-600">Selected total</span>
                      <span className="font-bold text-slate-900">{formatUgx(eligibleFeeStructures.filter((fee) => selectedFeeIds.includes(fee.id)).reduce((sum, fee) => sum + Number(fee.amount), 0))}</span>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Invoice due date (optional)">
                    <input className={inputClass} type="date" value={invoiceForm.due_date} onChange={(event) => setInvoiceForm({ ...invoiceForm, due_date: event.target.value })} />
                  </Field>
                  <Field label="Notes (optional)">
                    <input className={inputClass} value={invoiceForm.notes} onChange={(event) => setInvoiceForm({ ...invoiceForm, notes: event.target.value })} placeholder="Invoice note" />
                  </Field>
                </div>
                <button type="submit" className={buttonClass} disabled={savingInvoice || selectedFeeIds.length === 0}>
                  {savingInvoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  Issue invoice
                </button>
              </form>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Collections</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">Record a payment</h2>
                  <p className="mt-1 text-sm text-slate-500">A payment is posted against one invoice and gets a unique receipt.</p>
                </div>
                <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><CreditCard className="h-5 w-5" /></span>
              </div>

              <form onSubmit={recordPayment} className="space-y-4">
                <Field label="Outstanding invoice">
                  <select className={inputClass} value={paymentForm.invoice_id} onChange={(event) => {
                    const selected = invoices.find((invoice) => invoice.id === event.target.value);
                    setPaymentForm({ ...paymentForm, invoice_id: event.target.value, amount: selected ? String(selected.balance) : '' });
                    paymentIdempotencyKey.current = null;
                  }} required>
                    <option value="">Select invoice</option>
                    {payableInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number} · {invoice.first_name} {invoice.last_name} · Due {formatUgx(invoice.balance)}</option>)}
                  </select>
                </Field>
                {selectedPaymentInvoice && (
                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4">
                    <div><p className="text-xs text-slate-500">Invoice total</p><p className="mt-1 font-semibold text-slate-900">{formatUgx(selectedPaymentInvoice.total_amount)}</p></div>
                    <div><p className="text-xs text-slate-500">Outstanding</p><p className="mt-1 font-semibold text-indigo-700">{formatUgx(selectedPaymentInvoice.balance)}</p></div>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Amount received (UGX)">
                    <input className={inputClass} type="number" min="1" step="1" max={selectedPaymentInvoice?.balance} value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} required />
                  </Field>
                  <Field label="Payment method">
                    <select className={inputClass} value={paymentForm.payment_method} onChange={(event) => setPaymentForm({ ...paymentForm, payment_method: event.target.value })}>
                      <option value="cash">Cash</option>
                      <option value="mobile_money">Mobile money</option>
                      <option value="bank_transfer">Bank transfer</option>
                      <option value="cheque">Cheque</option>
                      <option value="card">Card</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>
                </div>
                <Field label="Transaction reference (optional)">
                  <input className={inputClass} value={paymentForm.reference} onChange={(event) => setPaymentForm({ ...paymentForm, reference: event.target.value })} placeholder="Mobile money / bank reference" />
                </Field>
                <button type="submit" className={buttonClass} disabled={savingPayment || !paymentForm.invoice_id}>
                  {savingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleDollarSign className="h-4 w-4" />}
                  Post payment &amp; issue receipt
                </button>
                <p className="text-xs leading-relaxed text-slate-500">Posted receipts are not edited or deleted. Corrections must be handled as audited reversals by an authorised finance operator.</p>
              </form>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Recent receipts</h2>
                  <p className="mt-1 text-sm text-slate-500">Latest payments recorded for this school.</p>
                </div>
                <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><FileText className="h-5 w-5" /></span>
              </div>
              {payments.length === 0 ? (
                <EmptyState text="No payments have been recorded yet." />
              ) : (
                <div className="divide-y divide-slate-100">
                  {payments.map((payment) => {
                    const student = Array.isArray(payment.students) ? payment.students[0] : payment.students;
                    return (
                      <div key={payment.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">{payment.receipt_number}</p>
                          <p className="truncate text-xs text-slate-500">{student ? `${student.first_name} ${student.last_name}` : 'Student'} · {displayDate(payment.received_at)}</p>
                          <p className="text-xs text-slate-500">{humanStatus(payment.payment_method)}{payment.reference ? ` · ${payment.reference}` : ''}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold tabular-nums text-slate-900">{formatUgx(payment.amount)}</p>
                          <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${payment.status === 'posted' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{humanStatus(payment.status)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Student invoices &amp; balances</h2>
              <p className="mt-1 text-sm text-slate-500">Search by learner, admission number, term or invoice number.</p>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input aria-label="Search invoices" className={inputClass + ' mt-0 pl-9'} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoices…" />
            </div>
          </div>

          {filteredInvoices.length === 0 ? (
            <div className="px-5 py-12"><EmptyState text={invoices.length === 0 ? 'No invoices have been issued for this school yet.' : 'No invoices match your search.'} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Invoice / learner</th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Term</th>
                    <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Total</th>
                    <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Paid</th>
                    <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Balance</th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Due</th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="transition hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-4">
                        <p className="text-sm font-semibold text-indigo-700">{invoice.invoice_number}</p>
                        <p className="mt-0.5 text-sm font-medium text-slate-800">{invoice.first_name} {invoice.last_name}</p>
                        <p className="text-xs text-slate-500">{invoice.registration_number}</p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{invoice.term_name}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-right text-sm tabular-nums text-slate-700">{formatUgx(invoice.total_amount)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-right text-sm tabular-nums text-emerald-700">{formatUgx(invoice.paid_amount)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-bold tabular-nums text-slate-900">{formatUgx(invoice.balance)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{displayDate(invoice.due_date)}</td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClasses(invoice.status)}`}>{humanStatus(invoice.status)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {children}
    </label>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  accent,
  footnote,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: 'indigo' | 'emerald' | 'violet' | 'amber';
  footnote?: string;
}): JSX.Element {
  const accents = {
    indigo: 'bg-indigo-50 text-indigo-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    violet: 'bg-violet-50 text-violet-700',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={`rounded-xl p-2.5 ${accents[accent]}`}>{icon}</span>
      </div>
      <p className="mt-4 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{value}</p>
      {footnote && <p className="mt-1 text-xs text-slate-500">{footnote}</p>}
    </article>
  );
}

function EmptyState({ text }: { text: string }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-5 text-center">
      <span className="mb-3 rounded-xl bg-slate-100 p-3 text-slate-500"><FileText className="h-5 w-5" /></span>
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}

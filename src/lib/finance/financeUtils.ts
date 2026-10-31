export type InvoiceStatus = 'issued' | 'partially_paid' | 'paid' | 'cancelled';

export interface InvoiceBalanceInput {
  status: InvoiceStatus;
  total_amount: number | string;
  paid_amount: number | string;
  due_date: string | null;
}

export interface FinanceSummary {
  invoiced: number;
  collected: number;
  outstanding: number;
  overdue: number;
  unpaidInvoices: number;
}

function asAmount(value: number | string): number {
  const amount = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

export function summarizeFinance(
  invoices: readonly InvoiceBalanceInput[],
  today = new Date()
): FinanceSummary {
  return invoices.reduce<FinanceSummary>(
    (summary, invoice) => {
      if (invoice.status === 'cancelled') return summary;

      const total = asAmount(invoice.total_amount);
      const paid = Math.min(asAmount(invoice.paid_amount), total);
      const outstanding = Math.max(total - paid, 0);
      const dueDate = invoice.due_date ? new Date(`${invoice.due_date}T00:00:00`) : null;
      const isOverdue = outstanding > 0
        && dueDate !== null
        && !Number.isNaN(dueDate.getTime())
        && dueDate.getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

      summary.invoiced += total;
      summary.collected += paid;
      summary.outstanding += outstanding;
      if (isOverdue) summary.overdue += outstanding;
      if (outstanding > 0) summary.unpaidInvoices += 1;
      return summary;
    },
    { invoiced: 0, collected: 0, outstanding: 0, overdue: 0, unpaidInvoices: 0 }
  );
}

export function formatUgx(value: number | string): string {
  return `UGX ${new Intl.NumberFormat('en-UG', {
    maximumFractionDigits: 0,
  }).format(asAmount(value))}`;
}

export function isInvoiceOverdue(
  dueDate: string | null,
  status: InvoiceStatus,
  today = new Date()
): boolean {
  if (!dueDate || status === 'paid' || status === 'cancelled') return false;
  const parsed = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return parsed.getTime() < localToday.getTime();
}

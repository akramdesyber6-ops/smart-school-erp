import assert from 'node:assert/strict';
import test from 'node:test';
import { formatUgx, isInvoiceOverdue, summarizeFinance } from './financeUtils';

test('finance summary totals issued and part-paid invoices and ignores cancelled invoices', () => {
  const result = summarizeFinance([
    { status: 'issued', total_amount: '150000', paid_amount: '0', due_date: '2026-10-01' },
    { status: 'partially_paid', total_amount: 100000, paid_amount: 40000, due_date: '2026-12-01' },
    { status: 'paid', total_amount: 50000, paid_amount: 50000, due_date: '2026-10-01' },
    { status: 'cancelled', total_amount: 90000, paid_amount: 0, due_date: '2026-10-01' },
  ], new Date('2026-10-31T12:00:00'));

  assert.deepEqual(result, {
    invoiced: 300000,
    collected: 90000,
    outstanding: 210000,
    overdue: 150000,
    unpaidInvoices: 2,
  });
});

test('overdue checks exclude invoices due today, paid or cancelled', () => {
  const today = new Date('2026-10-31T15:00:00');
  assert.equal(isInvoiceOverdue('2026-10-30', 'issued', today), true);
  assert.equal(isInvoiceOverdue('2026-10-31', 'issued', today), false);
  assert.equal(isInvoiceOverdue('2026-10-01', 'paid', today), false);
  assert.equal(isInvoiceOverdue('2026-10-01', 'cancelled', today), false);
  assert.equal(isInvoiceOverdue(null, 'issued', today), false);
});

test('UGX formatting rounds to whole shillings', () => {
  assert.equal(formatUgx(125000), 'UGX 125,000');
  assert.equal(formatUgx('2400.50'), 'UGX 2,401');
});

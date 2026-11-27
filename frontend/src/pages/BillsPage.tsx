import React, { useEffect, useState } from 'react';
import {
  FileDown,
  Calculator,
  CheckCircle2,
  CreditCard as CardIcon,
  Info,
  FilePlus2,
} from 'lucide-react';
import { apiRequest, downloadProtectedFile } from '../lib/api';
import { INDIAN_BANKS, formatDate, formatINR } from '../lib/utils';
import type { CreditCard, Statement } from '../lib/types';
import { useToast } from '../context/ToastContext';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { Badge, Button, Card, ErrorState, Input, Modal, Select } from '../components/ui';

export function BillsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [estimates, setEstimates] = useState<any[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payForm, setPayForm] = useState({
    cardId: '',
    statementId: '',
    amount: '',
    paymentMethod: 'UPI',
    referenceNumber: '',
    notes: '',
  });

  const [genOpen, setGenOpen] = useState(false);
  const [genForm, setGenForm] = useState({
    cardId: '',
    statementMonth: new Date().toISOString().slice(0, 7),
  });

  const [calcInput, setCalcInput] = useState({
    bankName: 'HDFC Bank',
    outstandingAmount: '25000',
    annualInterestRate: '',
    daysOverdue: '15',
  });
  const [calcResult, setCalcResult] = useState<any>(null);

  const loadData = async (status = statusFilter) => {
    setError(null);
    try {
      const qs = status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
      const [billsRes, cardsRes] = await Promise.all([apiRequest(`/bills${qs}`), apiRequest('/cards')]);
      setStatements(billsRes.statements || []);
      setPayments(billsRes.payments || []);
      setEstimates(billsRes.unbilledEstimates || []);
      setCards(cardsRes.cards || []);
      if (!genForm.cardId && cardsRes.cards?.[0]) {
        setGenForm((f) => ({ ...f, cardId: cardsRes.cards[0].id }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load bills');
      toast(err.message || 'Failed to load bills', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    runCalculator();
  }, []);

  const runCalculator = async () => {
    try {
      const res = await apiRequest('/bills/calculators', {
        method: 'POST',
        body: JSON.stringify({
          bankName: calcInput.bankName,
          outstandingAmount: Number(calcInput.outstandingAmount || 0),
          annualInterestRate: calcInput.annualInterestRate ? Number(calcInput.annualInterestRate) : undefined,
          daysOverdue: Number(calcInput.daysOverdue || 0),
        }),
      });
      setCalcResult(res);
    } catch {
      // ignore
    }
  };

  const openRecordPayment = (stmt?: Statement) => {
    const fallbackCardId = stmt?.card_id || cards[0]?.id || '';
    const remaining = stmt ? Math.max(0, stmt.total_amount_due - stmt.amount_paid) : '';
    setPayForm({
      cardId: fallbackCardId,
      statementId: stmt?.id || '',
      amount: remaining ? String(remaining) : '',
      paymentMethod: 'UPI',
      referenceNumber: '',
      notes: '',
    });
    setPayModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/bills/payments', {
        method: 'POST',
        body: JSON.stringify({
          ...payForm,
          amount: Number(payForm.amount),
        }),
      });
      toast('Manual payment recorded and balances updated!', 'success');
      setPayModalOpen(false);
      loadData();
    } catch (err: any) {
      toast(err.message || 'Payment recording failed', 'error');
    }
  };

  const handleGenerateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/bills/generate', {
        method: 'POST',
        body: JSON.stringify(genForm),
      });
      toast('Monthly statement generated from card transactions!', 'success');
      setGenOpen(false);
      loadData();
    } catch (err: any) {
      toast(err.message || 'Statement generation failed', 'error');
    }
  };

  const handleDownloadStatementPdf = async (stmt: Statement) => {
    try {
      await downloadProtectedFile(
        `/bills/statements/${stmt.id}/pdf`,
        `cardwise-statement-${stmt.statement_month}-${stmt.last_four_digits}.pdf`
      );
      toast('PDF statement downloaded', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to download PDF', 'error');
    }
  };

  if (loading) return <LoadingSkeleton rows={3} />;
  if (error && statements.length === 0) return <ErrorState message={error} onRetry={() => loadData()} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bills & Payments</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Generate monthly bills, record payments, download PDFs, and estimate bank-specific charges
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setGenOpen(true)} disabled={cards.length === 0}>
            <FilePlus2 className="h-4 w-4" /> Generate Bill
          </Button>
          <Button onClick={() => openRecordPayment()} disabled={cards.length === 0}>
            <CheckCircle2 className="h-4 w-4" /> Record Manual Payment
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-sky-500/25 bg-sky-500/10 p-3.5 text-xs text-sky-700 dark:text-sky-300">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          CardWise tracks your bills and sends due-date reminders. Payments recorded here update your balances manually after you pay via your authorised bank app or UPI.
        </span>
      </div>

      {/* Statements Table */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Current & Previous Statements
          </h2>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-44 h-9 text-xs"
          >
            <option value="all">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Overdue">Overdue</option>
            <option value="Paid">Paid</option>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500">
                <th className="pb-2.5 pr-3">Card</th>
                <th className="pb-2.5 px-3">Billing Period</th>
                <th className="pb-2.5 px-3">Due Date</th>
                <th className="pb-2.5 px-3">Total Due</th>
                <th className="pb-2.5 px-3">Min Due</th>
                <th className="pb-2.5 px-3">Paid</th>
                <th className="pb-2.5 px-3">Status</th>
                <th className="pb-2.5 pl-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {statements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-slate-500">
                    No statements match this filter. Generate a bill or add transactions.
                  </td>
                </tr>
              ) : (
                statements.map((st) => {
                  const statusVariant =
                    st.payment_status === 'Paid'
                      ? 'success'
                      : st.payment_status === 'Overdue'
                        ? 'danger'
                        : st.payment_status === 'Partially Paid'
                          ? 'info'
                          : 'warning';
                  return (
                    <tr key={st.id}>
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-slate-900 dark:text-white">{st.card_name}</p>
                        <p className="text-xs text-slate-500">{st.bank_name} •••• {st.last_four_digits}</p>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-500">
                        <div>{st.statement_month} ({st.billing_period})</div>
                        <div>Gen: {formatDate(st.statement_generation_date)}</div>
                      </td>
                      <td className="py-3 px-3 text-xs font-medium whitespace-nowrap">{formatDate(st.payment_due_date)}</td>
                      <td className="py-3 px-3 font-semibold whitespace-nowrap">{formatINR(st.total_amount_due)}</td>
                      <td className="py-3 px-3 text-xs whitespace-nowrap">{formatINR(st.minimum_amount_due)}</td>
                      <td className="py-3 px-3 text-xs text-emerald-500 font-semibold whitespace-nowrap">{formatINR(st.amount_paid)}</td>
                      <td className="py-3 px-3">
                        <Badge variant={statusVariant}>{st.payment_status}</Badge>
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {st.payment_status !== 'Paid' && (
                            <Button size="sm" variant="secondary" onClick={() => openRecordPayment(st)}>
                              Pay
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadStatementPdf(st)}
                            title="Download PDF statement"
                          >
                            <FileDown className="h-3.5 w-3.5" />
                            PDF
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Bank-Specific Calculator + Estimated Next Bill */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Calculator className="h-4 w-4 text-sky-400" />
            Bank-Specific Late Fee & Interest Estimator
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="text-xs text-slate-500">Issuer Bank</label>
              <Select
                value={calcInput.bankName}
                onChange={(e) => setCalcInput({ ...calcInput, bankName: e.target.value })}
                className="mt-1"
              >
                {INDIAN_BANKS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Unpaid Amount (₹)</label>
              <Input
                type="number"
                value={calcInput.outstandingAmount}
                onChange={(e) => setCalcInput({ ...calcInput, outstandingAmount: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">APR % (Optional)</label>
              <Input
                type="number"
                placeholder="Default"
                value={calcInput.annualInterestRate}
                onChange={(e) => setCalcInput({ ...calcInput, annualInterestRate: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Days Overdue</label>
              <Input
                type="number"
                value={calcInput.daysOverdue}
                onChange={(e) => setCalcInput({ ...calcInput, daysOverdue: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <Button size="sm" onClick={runCalculator} className="mb-4">
            Calculate Bank Estimate
          </Button>

          {calcResult && (
            <div className="space-y-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/70 p-4 border border-slate-200 dark:border-slate-800">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-slate-500">Late Fee ({calcResult.lateFee.slab})</p>
                  <p className="font-bold text-sm mt-0.5">
                    {formatINR(calcResult.lateFee.totalFee)} <span className="text-[11px] font-normal text-slate-400">(incl. {calcResult.gstRatePct}% GST)</span>
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Interest ({calcResult.appliedApr}% APR / {calcResult.interest.monthlyRatePct}% mo)</p>
                  <p className="font-bold text-sm mt-0.5">
                    {formatINR(calcResult.interest.totalInterestCharge)} <span className="text-[11px] font-normal text-slate-400">(incl. GST)</span>
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <span className="font-semibold">Estimated Total Extra Cost</span>
                <span className="text-base font-bold text-rose-500">
                  {formatINR(calcResult.combinedPenaltyAndInterest)}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">{calcResult.disclaimer}</p>
            </div>
          )}
        </Card>

        <Card>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <CardIcon className="h-4 w-4 text-emerald-400" />
            Estimated Next Bill & Unbilled Tracker
          </h3>
          <div className="space-y-3">
            {estimates.map((e) => (
              <div
                key={e.cardId}
                className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs"
              >
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {e.bankName} • {e.cardName} (•••• {e.lastFourDigits})
                  </p>
                  <p className="text-slate-500">
                    Next Statement: {formatDate(e.nextStatementDate)} • Due: {formatDate(e.nextDueDate)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-500">Est. Next Bill</p>
                  <p className="text-sm font-bold text-sky-500">{formatINR(e.estimatedNextBill)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Payment History */}
      <Card>
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Payment History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500">
                <th className="pb-2">Date</th>
                <th className="pb-2">Card</th>
                <th className="pb-2">Method</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Reference</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-xs text-slate-500">
                    No recorded payments yet.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 text-xs">{formatDate(p.payment_date)}</td>
                    <td className="py-2.5 font-medium">{p.bank_name} • {p.card_name} (•••• {p.last_four_digits})</td>
                    <td className="py-2.5 text-xs">{p.payment_method}</td>
                    <td className="py-2.5"><Badge variant="success">{p.payment_type}</Badge></td>
                    <td className="py-2.5 font-mono text-xs text-slate-500">{p.reference_number}</td>
                    <td className="py-2.5 text-right font-bold text-emerald-500">{formatINR(p.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Generate Statement Modal */}
      <Modal
        open={genOpen}
        onClose={() => setGenOpen(false)}
        title="Generate Monthly Credit Card Statement"
        subtitle="Computes statement charges, credits, and bank-specific minimum amount due from recorded transactions."
      >
        <form onSubmit={handleGenerateBill} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-400">Select Card</label>
            <Select
              required
              value={genForm.cardId}
              onChange={(e) => setGenForm({ ...genForm, cardId: e.target.value })}
              className="mt-1"
            >
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.bank_name} • {c.card_name} (•••• {c.last_four_digits})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400">Statement Month (YYYY-MM)</label>
            <Input
              type="month"
              required
              value={genForm.statementMonth}
              onChange={(e) => setGenForm({ ...genForm, statementMonth: e.target.value })}
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setGenOpen(false)}>Cancel</Button>
            <Button type="submit">Generate Statement</Button>
          </div>
        </form>
      </Modal>

      {/* Record Manual Payment Modal */}
      <Modal
        open={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        title="Record Manual Card Payment"
        subtitle="Marks your bill as Paid / Partially Paid and restores available credit limit."
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-400">Select Card</label>
            <Select
              required
              value={payForm.cardId}
              onChange={(e) => setPayForm({ ...payForm, cardId: e.target.value })}
              className="mt-1"
            >
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.bank_name} • {c.card_name} (•••• {c.last_four_digits}) - Outst: {formatINR(c.outstanding_balance)}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-400">Amount Paid (₹)</label>
              <Input
                type="number"
                required
                min={1}
                step="0.01"
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400">Payment Method</label>
              <Select
                value={payForm.paymentMethod}
                onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                className="mt-1"
              >
                {['UPI', 'NEFT', 'IMPS', 'NetBanking', 'Cheque', 'Other'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400">UTR / Reference Number (Optional)</label>
            <Input
              value={payForm.referenceNumber}
              onChange={(e) => setPayForm({ ...payForm, referenceNumber: e.target.value })}
              placeholder="e.g. UPI4312985012"
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setPayModalOpen(false)}>Cancel</Button>
            <Button type="submit">Confirm & Update Balance</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

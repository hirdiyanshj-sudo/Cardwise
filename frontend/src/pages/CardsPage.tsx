import React, { useEffect, useState } from 'react';
import {
  Plus,
  CreditCard as CardIcon,
  Pencil,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import { apiRequest } from '../lib/api';
import { CARD_THEMES, INDIAN_BANKS, formatDate, formatINR } from '../lib/utils';
import type { CreditCard } from '../lib/types';
import { useToast } from '../context/ToastContext';
import { VirtualCard } from '../components/cards/VirtualCard';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import { Badge, Button, Card, ConfirmDialog, ErrorState, Input, Modal, Progress, Select } from '../components/ui';

const EMPTY_FORM = {
  bankName: 'HDFC Bank',
  cardName: '',
  cardNetwork: 'Visa',
  cardType: 'Rewards',
  lastFourDigits: '',
  creditLimit: '200000',
  outstandingBalance: '0',
  minimumAmountDue: '',
  interestRate: '42',
  annualFee: '0',
  joiningFee: '0',
  billingCycle: '16th - 15th',
  statementGenerationDate: new Date().toISOString().slice(0, 10),
  paymentDueDate: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
  rewardPointsBalance: '0',
  cardStatus: 'Active',
  cardColorTheme: 'navy-gold',
};

export function CardsPage() {
  const { toast } = useToast();
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [utilisationData, setUtilisationData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'cards' | 'utilisation'>('cards');
  const [formOpen, setFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [detailCard, setDetailCard] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<CreditCard | null>(null);

  const loadAll = async () => {
    setError(null);
    try {
      const [cRes, uRes] = await Promise.all([
        apiRequest('/cards'),
        apiRequest('/cards/utilisation'),
      ]);
      setCards(cRes.cards || []);
      setUtilisationData(uRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load cards');
      toast(err.message || 'Failed to load cards', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const openAdd = () => {
    setEditingCard(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (c: CreditCard) => {
    setEditingCard(c);
    setForm({
      bankName: c.bank_name,
      cardName: c.card_name,
      cardNetwork: c.card_network,
      cardType: c.card_type,
      lastFourDigits: c.last_four_digits,
      creditLimit: String(c.credit_limit),
      outstandingBalance: String(c.outstanding_balance),
      minimumAmountDue: String(c.minimum_amount_due),
      interestRate: String(c.interest_rate),
      annualFee: String(c.annual_fee),
      joiningFee: String(c.joining_fee),
      billingCycle: c.billing_cycle,
      statementGenerationDate: c.statement_generation_date || EMPTY_FORM.statementGenerationDate,
      paymentDueDate: c.payment_due_date || EMPTY_FORM.paymentDueDate,
      rewardPointsBalance: String(c.reward_points_balance),
      cardStatus: c.card_status,
      cardColorTheme: c.card_color_theme || 'navy-gold',
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(form.lastFourDigits)) {
      toast('Enter only the last 4 numeric digits (never full card number).', 'warning');
      return;
    }
    const payload = {
      ...form,
      creditLimit: Number(form.creditLimit),
      outstandingBalance: Number(form.outstandingBalance || 0),
      minimumAmountDue: form.minimumAmountDue ? Number(form.minimumAmountDue) : undefined,
      interestRate: Number(form.interestRate),
      annualFee: Number(form.annualFee),
      joiningFee: Number(form.joiningFee),
      rewardPointsBalance: editingCard ? undefined : Number(form.rewardPointsBalance || 0),
    };
    try {
      if (editingCard) {
        await apiRequest(`/cards/${editingCard.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        toast('Credit card updated', 'success');
      } else {
        await apiRequest('/cards', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast('Credit card added', 'success');
      }
      setFormOpen(false);
      loadAll();
    } catch (err: any) {
      toast(err.message || 'Save failed', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiRequest(`/cards/${deleteTarget.id}`, { method: 'DELETE' });
      toast('Credit card removed', 'info');
      if (detailCard?.card?.id === deleteTarget.id) setDetailCard(null);
      loadAll();
    } catch (err: any) {
      toast(err.message || 'Delete failed', 'error');
    }
  };

  const openDetail = async (id: string) => {
    try {
      const res = await apiRequest(`/cards/${id}`);
      setDetailCard(res);
    } catch (err: any) {
      toast(err.message || 'Failed to load card details', 'error');
    }
  };

  if (loading) return <LoadingSkeleton rows={2} />;
  if (error && cards.length === 0) return <ErrorState message={error} onRetry={loadAll} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Credit Cards</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage multiple Indian bank cards and monitor credit utilisation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-white dark:bg-slate-900">
            <button
              onClick={() => setTab('cards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                tab === 'cards' ? 'bg-sky-500 text-white' : 'text-slate-500'
              }`}
            >
              Cards Portfolio ({cards.length})
            </button>
            <button
              onClick={() => setTab('utilisation')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                tab === 'utilisation' ? 'bg-sky-500 text-white' : 'text-slate-500'
              }`}
            >
              Utilisation Tracker
            </button>
          </div>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add Credit Card
          </Button>
        </div>
      </div>

      {tab === 'cards' && (
        <>
          {cards.length === 0 ? (
            <EmptyState
              icon={<CardIcon className="h-10 w-10 text-sky-400" />}
              title="No credit cards in your vault"
              description="Add your credit cards using only the last 4 digits to track limits, due dates, and rewards."
              action={<Button onClick={openAdd}>Add Your First Card</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {cards.map((c) => (
                <div key={c.id} className="space-y-2.5">
                  <VirtualCard card={c} onClick={() => openDetail(c.id)} />
                  <Card className="p-3.5 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <p className="text-slate-500 dark:text-slate-400">
                        Limit: <strong className="text-slate-900 dark:text-white">{formatINR(c.credit_limit)}</strong> • Avail: <strong className="text-emerald-500">{formatINR(c.available_credit_limit)}</strong>
                      </p>
                      <p className="text-slate-500 dark:text-slate-400">
                        Due: <strong className="text-slate-900 dark:text-white">{formatDate(c.payment_due_date)}</strong> • Pts: <strong className="text-sky-400">{c.reward_points_balance.toLocaleString('en-IN')}</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(c)}
                        className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-sky-400"
                        title="Edit card"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-rose-400"
                        title="Remove card"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'utilisation' && utilisationData && (
        <div className="space-y-5">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Overall Credit Utilisation: {utilisationData.overall.utilisationPct}%
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Target threshold: &le;{utilisationData.threshold}% • Used {formatINR(utilisationData.overall.totalUsed)} of {formatINR(utilisationData.overall.totalLimit)}
                </p>
              </div>
              {utilisationData.overall.exceedsThreshold ? (
                <Badge variant="danger">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  High Utilisation Warning
                </Badge>
              ) : (
                <Badge variant="success">Optimal Credit Score Range</Badge>
              )}
            </div>
            <Progress
              value={utilisationData.overall.utilisationPct}
              indicatorClassName={
                utilisationData.overall.exceedsThreshold ? 'bg-amber-500' : 'bg-emerald-500'
              }
            />
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
                Individual Card Utilisation
              </h3>
              <div className="space-y-4">
                {utilisationData.cards.map((c: any) => (
                  <div key={c.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {c.bankName} • {c.cardName} (•••• {c.lastFourDigits})
                      </span>
                      <div className="flex items-center gap-2">
                        {c.exceedsThreshold && <Badge variant="warning">&gt;30%</Badge>}
                        {c.lowAvailableCredit && <Badge variant="danger">Low Avail</Badge>}
                        <span className="font-bold">{c.utilisationPct}%</span>
                      </div>
                    </div>
                    <Progress
                      value={c.utilisationPct}
                      indicatorClassName={
                        c.utilisationPct > 50
                          ? 'bg-rose-500'
                          : c.exceedsThreshold
                            ? 'bg-amber-500'
                            : 'bg-sky-500'
                      }
                    />
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Used: {formatINR(c.usedLimit)}</span>
                      <span>Available: {formatINR(c.availableLimit)} / {formatINR(c.creditLimit)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-sky-400" />
                Monthly Utilisation Trend (%)
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={utilisationData.history || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                    <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} />
                    <YAxis stroke="#94A3B8" fontSize={12} unit="%" />
                    <Tooltip formatter={(v: any) => `${v}%`} />
                    <Line type="monotone" dataKey="utilisationPct" stroke="#38BDF8" strokeWidth={2.5} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Add/Edit Card Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingCard ? 'Edit Credit Card' : 'Add New Credit Card'}
        subtitle="CardWise never collects or stores CVV, PIN, OTP, or full 16-digit card numbers."
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl bg-sky-500/10 border border-sky-500/25 p-3 text-xs text-sky-600 dark:text-sky-300">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            Security Reminder: Enter only the last 4 digits of your card.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-300">Bank Name</label>
              <Select value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} className="mt-1">
                {INDIAN_BANKS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-300">Card Name</label>
              <Input
                required
                placeholder="e.g. HDFC Millennia"
                value={form.cardName}
                onChange={(e) => setForm({ ...form, cardName: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-300">Network</label>
              <Select value={form.cardNetwork} onChange={(e) => setForm({ ...form, cardNetwork: e.target.value })} className="mt-1">
                {['Visa', 'Mastercard', 'RuPay', 'American Express'].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-300">Card Type</label>
              <Select value={form.cardType} onChange={(e) => setForm({ ...form, cardType: e.target.value })} className="mt-1">
                {['Lifetime Free', 'Cashback', 'Rewards', 'Travel', 'Shopping', 'Fuel'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-300">Last 4 Digits</label>
              <Input
                required
                maxLength={4}
                pattern="\d{4}"
                placeholder="4821"
                value={form.lastFourDigits}
                onChange={(e) => setForm({ ...form, lastFourDigits: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-300">Credit Limit (₹)</label>
              <Input
                type="number"
                required
                min={1000}
                value={form.creditLimit}
                onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-300">Outstanding Balance (₹)</label>
              <Input
                type="number"
                min={0}
                value={form.outstandingBalance}
                onChange={(e) => setForm({ ...form, outstandingBalance: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-300">Minimum Due (₹)</label>
              <Input
                type="number"
                min={0}
                placeholder="Auto bank rule if blank"
                value={form.minimumAmountDue}
                onChange={(e) => setForm({ ...form, minimumAmountDue: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-300">Interest Rate (% APR)</label>
              <Input
                type="number"
                step="0.1"
                value={form.interestRate}
                onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-300">Annual Fee (₹) / Joining Fee (₹)</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Input
                  type="number"
                  min={0}
                  value={form.annualFee}
                  onChange={(e) => setForm({ ...form, annualFee: e.target.value })}
                  placeholder="Annual"
                />
                <Input
                  type="number"
                  min={0}
                  value={form.joiningFee}
                  onChange={(e) => setForm({ ...form, joiningFee: e.target.value })}
                  placeholder="Joining"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-300">Billing Cycle</label>
              <Input
                value={form.billingCycle}
                onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-300">Statement Date & Due Date</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Input
                  type="date"
                  value={form.statementGenerationDate}
                  onChange={(e) => setForm({ ...form, statementGenerationDate: e.target.value })}
                />
                <Input
                  type="date"
                  value={form.paymentDueDate}
                  onChange={(e) => setForm({ ...form, paymentDueDate: e.target.value })}
                />
              </div>
            </div>
            {!editingCard && (
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-300">Opening Reward Points</label>
                <Input
                  type="number"
                  min={0}
                  value={form.rewardPointsBalance}
                  onChange={(e) => setForm({ ...form, rewardPointsBalance: e.target.value })}
                  className="mt-1"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-300">Status & Virtual Theme</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Select value={form.cardStatus} onChange={(e) => setForm({ ...form, cardStatus: e.target.value })}>
                  <option value="Active">Active</option>
                  <option value="Blocked">Blocked</option>
                  <option value="Expired">Expired</option>
                </Select>
                <Select value={form.cardColorTheme} onChange={(e) => setForm({ ...form, cardColorTheme: e.target.value })}>
                  {Object.keys(CARD_THEMES).map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit">{editingCard ? 'Update Card' : 'Save Card'}</Button>
          </div>
        </form>
      </Modal>

      {/* Individual Card Dashboard Modal */}
      <Modal
        open={Boolean(detailCard)}
        onClose={() => setDetailCard(null)}
        title={detailCard ? `${detailCard.card.bank_name} • ${detailCard.card.card_name}` : ''}
        subtitle={detailCard ? `•••• ${detailCard.card.last_four_digits} • Billing Cycle ${detailCard.card.billing_cycle}` : ''}
        maxWidth="max-w-3xl"
      >
        {detailCard && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <VirtualCard card={detailCard.card} />
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3">
                  <p className="text-slate-500">Credit Limit</p>
                  <p className="font-bold text-sm mt-0.5">{formatINR(detailCard.card.credit_limit)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3">
                  <p className="text-slate-500">Available Limit</p>
                  <p className="font-bold text-sm text-emerald-500 mt-0.5">{formatINR(detailCard.card.available_credit_limit)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3">
                  <p className="text-slate-500">Interest Rate</p>
                  <p className="font-bold text-sm mt-0.5">{detailCard.card.interest_rate}% APR</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3">
                  <p className="text-slate-500">Annual / Joining Fee</p>
                  <p className="font-bold text-sm mt-0.5">{formatINR(detailCard.card.annual_fee)} / {formatINR(detailCard.card.joining_fee)}</p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold mb-2">Card-Specific Transactions ({detailCard.transactions.length})</h4>
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
                {detailCard.transactions.length === 0 ? (
                  <p className="p-4 text-xs text-slate-500">No transactions recorded on this card yet.</p>
                ) : (
                  detailCard.transactions.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between p-3 text-xs">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{t.merchant}</p>
                        <p className="text-slate-500">{formatDate(t.transaction_date)} • {t.category_name}</p>
                      </div>
                      <span className="font-bold">{formatINR(t.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Remove Credit Card?"
        message={
          deleteTarget
            ? `Permanently remove ${deleteTarget.bank_name} ${deleteTarget.card_name} (•••• ${deleteTarget.last_four_digits}) and all linked transactions and statements?`
            : ''
        }
        confirmLabel="Remove Card"
      />
    </div>
  );
}

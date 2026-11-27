import React, { useEffect, useState } from 'react';
import { Plus, Search, Download, Trash2, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiRequest, downloadProtectedFile } from '../lib/api';
import { SPENDING_CATEGORIES, formatDate, formatINR } from '../lib/utils';
import type { CreditCard, Transaction } from '../lib/types';
import { useToast } from '../context/ToastContext';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { Badge, Button, Card, ConfirmDialog, ErrorState, Input, Modal, Select } from '../components/ui';

export function TransactionsPage() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cardFilter, setCardFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');
  const [sortBy, setSortBy] = useState('transaction_date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalCount: 0 });
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  const [form, setForm] = useState({
    cardId: '',
    merchant: '',
    description: '',
    amount: '',
    categoryName: '',
    transactionType: 'Debit',
    transactionDate: new Date().toISOString().slice(0, 10),
  });

  const loadData = async (targetPage = page) => {
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (cardFilter !== 'all') qs.set('cardId', cardFilter);
      if (catFilter !== 'all') qs.set('category', catFilter);
      if (search) qs.set('search', search);
      qs.set('sortBy', sortBy);
      qs.set('sortOrder', sortOrder);
      qs.set('page', String(targetPage));
      qs.set('limit', '15');

      const [txRes, cardRes] = await Promise.all([
        apiRequest(`/transactions?${qs.toString()}`),
        apiRequest('/cards'),
      ]);
      setTransactions(txRes.transactions || []);
      if (txRes.pagination) setPagination(txRes.pagination);
      setCards(cardRes.cards || []);
      if (!form.cardId && cardRes.cards?.[0]) {
        setForm((f) => ({ ...f, cardId: cardRes.cards[0].id }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load transactions');
      toast(err.message || 'Failed to load transactions', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadData(1);
  }, [cardFilter, catFilter, sortBy, sortOrder]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          categoryName: form.categoryName || undefined,
        }),
      });
      toast('Transaction recorded & card balance updated', 'success');
      setModalOpen(false);
      setForm({ ...form, merchant: '', description: '', amount: '', categoryName: '' });
      loadData(1);
    } catch (err: any) {
      toast(err.message || 'Failed to add transaction', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiRequest(`/transactions/${deleteTarget.id}`, { method: 'DELETE' });
      toast('Transaction deleted', 'info');
      loadData(page);
    } catch (err: any) {
      toast(err.message || 'Delete failed', 'error');
    }
  };

  if (loading) return <LoadingSkeleton rows={2} />;
  if (error && transactions.length === 0) return <ErrorState message={error} onRetry={() => loadData(page)} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Transactions</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Log card spends with automatic Indian merchant categorization & unusual spend detection
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadProtectedFile('/analytics/export/csv', 'cardwise-transactions.csv')}
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadProtectedFile('/analytics/export/pdf', 'cardwise-expense-report.pdf')}
          >
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
          <Button onClick={() => setModalOpen(true)} disabled={cards.length === 0}>
            <Plus className="h-4 w-4" /> Add Transaction
          </Button>
        </div>
      </div>

      {/* Filters & Sorting */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
            <Input
              placeholder="Search merchant or notes (press Enter)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  loadData(1);
                }
              }}
              className="pl-9"
            />
          </div>
          <Select value={cardFilter} onChange={(e) => setCardFilter(e.target.value)}>
            <option value="all">All Cards</option>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.bank_name} •••• {c.last_four_digits}
              </option>
            ))}
          </Select>
          <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            <option value="all">All Categories</option>
            {SPENDING_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </Select>
          <Select
            value={`${sortBy}:${sortOrder}`}
            onChange={(e) => {
              const [col, ord] = e.target.value.split(':');
              setSortBy(col);
              setSortOrder(ord as 'asc' | 'desc');
            }}
          >
            <option value="transaction_date:desc">Newest First</option>
            <option value="transaction_date:asc">Oldest First</option>
            <option value="amount:desc">Highest Amount</option>
            <option value="amount:asc">Lowest Amount</option>
          </Select>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500">
                <th className="pb-2.5">Date</th>
                <th className="pb-2.5">Merchant</th>
                <th className="pb-2.5">Card</th>
                <th className="pb-2.5">Category</th>
                <th className="pb-2.5">Type</th>
                <th className="pb-2.5 text-right">Amount</th>
                <th className="pb-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                    No matching transactions found.
                  </td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="py-3 text-xs text-slate-500">{formatDate(t.transaction_date)}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">{t.merchant}</span>
                        {Boolean(t.is_flagged_unusual) && (
                          <Badge variant="warning" title="Higher than average spend">
                            <AlertTriangle className="h-3 w-3" /> High
                          </Badge>
                        )}
                      </div>
                      {t.description && <p className="text-xs text-slate-500">{t.description}</p>}
                    </td>
                    <td className="py-3 text-xs">
                      {t.bank_name} •••• {t.last_four_digits}
                    </td>
                    <td className="py-3">
                      <Badge variant="outline">{t.category_name}</Badge>
                    </td>
                    <td className="py-3 text-xs">{t.transaction_type}</td>
                    <td className="py-3 text-right font-bold text-slate-900 dark:text-white">
                      {formatINR(t.amount)}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => setDeleteTarget(t)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500"
                        title="Delete transaction"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} total)
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => {
                const next = page - 1;
                setPage(next);
                loadData(next);
              }}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= pagination.totalPages}
              onClick={() => {
                const next = page + 1;
                setPage(next);
                loadData(next);
              }}
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Credit Card Transaction"
        subtitle="Leave category on Auto-detect to classify Indian merchants automatically."
      >
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-400">Card</label>
            <Select
              required
              value={form.cardId}
              onChange={(e) => setForm({ ...form, cardId: e.target.value })}
              className="mt-1"
            >
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.bank_name} • {c.card_name} (•••• {c.last_four_digits})
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-400">Merchant</label>
              <Input
                required
                placeholder="e.g. Swiggy, Amazon, IOCL"
                value={form.merchant}
                onChange={(e) => setForm({ ...form, merchant: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400">Amount (₹)</label>
              <Input
                type="number"
                required
                min={1}
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-400">Category</label>
              <Select
                value={form.categoryName}
                onChange={(e) => setForm({ ...form, categoryName: e.target.value })}
                className="mt-1"
              >
                <option value="">Auto-detect</option>
                {SPENDING_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400">Type</label>
              <Select
                value={form.transactionType}
                onChange={(e) => setForm({ ...form, transactionType: e.target.value })}
                className="mt-1"
              >
                {['Debit', 'EMI', 'Refund', 'Credit'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400">Date</label>
              <Input
                type="date"
                value={form.transactionDate}
                onChange={(e) => setForm({ ...form, transactionDate: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400">Notes (Optional)</label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Dinner with friends / Flight booking"
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save Transaction</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Transaction?"
        message={
          deleteTarget
            ? `Delete ${deleteTarget.merchant} (${formatINR(deleteTarget.amount)}) and adjust your card's outstanding balance?`
            : ''
        }
        confirmLabel="Delete"
      />
    </div>
  );
}

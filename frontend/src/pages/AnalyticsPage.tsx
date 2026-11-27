import React, { useEffect, useState } from 'react';
import { Download, Plus, Trash2, AlertTriangle, IndianRupee, TrendingUp, ReceiptText } from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import { apiRequest, downloadProtectedFile } from '../lib/api';
import { SPENDING_CATEGORIES, formatINR } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import { StatCard } from '../components/common/StatCard';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { Badge, Button, Card, Input, Modal, Progress, Select } from '../components/ui';

export function AnalyticsPage() {
  const { toast } = useToast();
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [budgetModal, setBudgetModal] = useState(false);
  const [budgetForm, setBudgetForm] = useState({
    categoryName: 'Shopping',
    monthlyLimit: '30000',
    alertThresholdPct: '80',
  });

  const loadAnalytics = async () => {
    try {
      const res = await apiRequest(`/analytics/spending?period=${period}`);
      setData(res);
    } catch (err: any) {
      toast(err.message || 'Failed to load analytics', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/analytics/budgets', {
        method: 'POST',
        body: JSON.stringify({
          categoryName: budgetForm.categoryName,
          monthlyLimit: Number(budgetForm.monthlyLimit),
          alertThresholdPct: Number(budgetForm.alertThresholdPct),
        }),
      });
      toast('Monthly budget saved', 'success');
      setBudgetModal(false);
      loadAnalytics();
    } catch (err: any) {
      toast(err.message || 'Failed to save budget', 'error');
    }
  };

  const handleDeleteBudget = async (id: string) => {
    try {
      await apiRequest(`/analytics/budgets/${id}`, { method: 'DELETE' });
      toast('Budget deleted', 'info');
      loadAnalytics();
    } catch (err: any) {
      toast(err.message || 'Delete failed', 'error');
    }
  };

  if (loading) return <LoadingSkeleton rows={3} />;
  const s = data?.summary || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Spending Analysis & Budgets
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Category breakdowns, card-wise spend, merchant insights & exportable reports
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-white dark:bg-slate-900">
            {(['weekly', 'monthly', 'yearly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize ${
                  period === p ? 'bg-sky-500 text-white' : 'text-slate-500'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadProtectedFile('/analytics/export/csv', 'cardwise-expense-report.csv')}
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
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={`Total (${period})`} value={formatINR(s.totalSpent)} icon={<IndianRupee className="h-5 w-5" />} accent="sky" />
        <StatCard label="Avg Monthly Spend" value={formatINR(s.averageMonthlyExpenditure)} icon={<TrendingUp className="h-5 w-5" />} accent="indigo" />
        <StatCard label="Top Category" value={s.highestSpendingCategory || 'N/A'} icon={<AlertTriangle className="h-5 w-5" />} accent="amber" />
        <StatCard label="Transactions" value={String(s.transactionCount || 0)} icon={<ReceiptText className="h-5 w-5" />} accent="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <h3 className="text-sm font-bold mb-3">Expense Categories (Pie Chart)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.categoryBreakdown || []} dataKey="amount" nameKey="category" innerRadius={42} outerRadius={82} paddingAngle={2}>
                  {(data.categoryBreakdown || []).map((c: any, idx: number) => (
                    <Cell key={idx} fill={c.color || '#38BDF8'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => formatINR(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {(data.categoryBreakdown || []).slice(0, 6).map((c: any) => (
              <div key={c.category} className="flex items-center justify-between gap-2 truncate">
                <span className="flex items-center gap-1.5 truncate text-slate-500 dark:text-slate-300">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color || '#38BDF8' }} />
                  <span className="truncate">{c.category}</span>
                </span>
                <span className="font-semibold shrink-0">{c.percentage}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-bold mb-3">Monthly Spending (Bar Chart)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} />
                <YAxis stroke="#94A3B8" fontSize={12} />
                <Tooltip formatter={(v: any) => formatINR(v)} />
                <Bar dataKey="spend" fill="#38BDF8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-bold mb-3">Spending Trend (Line Chart)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.monthlyTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} />
                <YAxis stroke="#94A3B8" fontSize={12} />
                <Tooltip formatter={(v: any) => formatINR(v)} />
                <Line type="monotone" dataKey="spend" stroke="#10B981" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-bold mb-3">Card-wise Expenditure Comparison</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.cardWiseSpend || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                <XAxis type="number" stroke="#94A3B8" fontSize={11} />
                <YAxis type="category" dataKey="card_name" stroke="#94A3B8" fontSize={11} width={115} />
                <Tooltip formatter={(v: any) => formatINR(v)} />
                <Bar dataKey="total" fill="#8B5CF6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Budgets & Top Merchants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold">Monthly Category Budgets</h3>
            <Button size="sm" onClick={() => setBudgetModal(true)}>
              <Plus className="h-3.5 w-3.5" /> Set Budget
            </Button>
          </div>
          <div className="space-y-4">
            {(data.budgets || []).length === 0 ? (
              <p className="text-xs text-slate-500">No budgets set yet.</p>
            ) : (
              data.budgets.map((b: any) => (
                <div key={b.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">{b.category_name}</span>
                    <div className="flex items-center gap-2">
                      {b.isExceeded ? (
                        <Badge variant="danger">Exceeded ({b.utilisationPct}%)</Badge>
                      ) : b.isOverAlert ? (
                        <Badge variant="warning">Near Limit ({b.utilisationPct}%)</Badge>
                      ) : (
                        <Badge variant="success">{b.utilisationPct}%</Badge>
                      )}
                      <button onClick={() => handleDeleteBudget(b.id)} className="text-slate-400 hover:text-rose-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <Progress
                    value={b.utilisationPct}
                    indicatorClassName={
                      b.isExceeded ? 'bg-rose-500' : b.isOverAlert ? 'bg-amber-500' : 'bg-emerald-500'
                    }
                  />
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Spent this month: {formatINR(b.spentThisMonth)}</span>
                    <span>Budget: {formatINR(b.monthly_limit)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <h3 className="text-base font-bold mb-4">Top Merchants</h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {(data.merchantWiseSpend || []).map((m: any) => (
              <div key={m.merchant} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{m.merchant}</p>
                  <p className="text-slate-500">{m.tx_count} transaction(s)</p>
                </div>
                <span className="font-bold text-sm">{formatINR(m.total)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Modal open={budgetModal} onClose={() => setBudgetModal(false)} title="Set Category Monthly Budget">
        <form onSubmit={handleSaveBudget} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400">Category</label>
            <Select value={budgetForm.categoryName} onChange={(e) => setBudgetForm({ ...budgetForm, categoryName: e.target.value })} className="mt-1">
              {SPENDING_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">Monthly Limit (₹)</label>
              <Input type="number" required min={500} value={budgetForm.monthlyLimit} onChange={(e) => setBudgetForm({ ...budgetForm, monthlyLimit: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Alert Threshold (%)</label>
              <Input type="number" min={10} max={100} value={budgetForm.alertThresholdPct} onChange={(e) => setBudgetForm({ ...budgetForm, alertThresholdPct: e.target.value })} className="mt-1" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setBudgetModal(false)}>Cancel</Button>
            <Button type="submit">Save Budget</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

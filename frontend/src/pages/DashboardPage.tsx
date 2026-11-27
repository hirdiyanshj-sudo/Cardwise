import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  IndianRupee,
  Wallet,
  TrendingUp,
  Gift,
  CalendarClock,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Tag,
  Clock,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { apiRequest } from '../lib/api';
import { formatDate, formatINR } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import { StatCard } from '../components/common/StatCard';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import { Badge, Button, Card, ErrorState, Progress } from '../components/ui';

const PIE_COLORS = ['#6366F1', '#0EA5E9', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6', '#EF4444'];

export function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [range, setRange] = useState<'7d' | '30d' | '90d' | '1y' | 'all'>('90d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const loadDashboard = async (selectedRange = range) => {
    setError(null);
    try {
      const res = await apiRequest(`/dashboard?range=${selectedRange}`);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
      toast(err.message || 'Failed to load dashboard', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard(range);
  }, [range]);

  const handleLoadDemo = async () => {
    try {
      await apiRequest('/auth/load-demo-data', { method: 'POST' });
      toast('Sample Indian credit cards loaded into your dashboard', 'success');
      loadDashboard(range);
    } catch (err: any) {
      toast(err.message || 'Failed to load demo data', 'error');
    }
  };

  if (loading) return <LoadingSkeleton rows={3} />;
  if (error && !data) return <ErrorState message={error} onRetry={() => loadDashboard(range)} />;

  const s = data?.summary || {};

  if (s.totalCards === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Financial Control Centre</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Your private credit card command centre
            </p>
          </div>
          <Button onClick={() => navigate('/cards')}>Add Your First Card</Button>
        </div>

        <EmptyState
          icon={<CreditCard className="h-10 w-10 text-sky-400" />}
          title="No credit cards added yet"
          description="Add your first Indian bank credit card (using only the last 4 digits—never CVV or PIN) or load our realistic sample Indian banking portfolio to explore all features."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={() => navigate('/cards')}>Add Credit Card</Button>
              <Button variant="secondary" onClick={handleLoadDemo}>
                <Sparkles className="h-4 w-4 text-amber-400" />
                Load Sample Indian Cards
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Date Range Filters + Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Financial Control Centre</h1>
            {s.hasDemoData && <Badge variant="warning">Includes Sample Demo Data</Badge>}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Live database totals for limits, bills, utilisation, rewards, and card spending
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-white dark:bg-slate-900">
            {([
              ['7d', '7D'],
              ['30d', '30D'],
              ['90d', '90D'],
              ['1y', '1Y'],
              ['all', 'All'],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setRange(val)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  range === val ? 'bg-sky-500 text-white' : 'text-slate-500 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/cards')}>
            + Add Card
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/transactions')}>
            + Log Spend
          </Button>
          <Button size="sm" onClick={() => navigate('/bills')}>
            Record Payment
          </Button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Credit Cards"
          value={String(s.totalCards)}
          subtext={`Overall utilisation: ${s.overallUtilisationPct}%`}
          icon={<CreditCard className="h-5 w-5" />}
          accent="sky"
        />
        <StatCard
          label="Total Credit Limit"
          value={formatINR(s.totalCreditLimit)}
          subtext={`Available: ${formatINR(s.totalAvailableCredit)}`}
          icon={<Wallet className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="Total Outstanding Bills"
          value={formatINR(s.totalOutstanding)}
          subtext={`Min Due: ${formatINR(s.totalMinDue)}`}
          icon={<IndianRupee className="h-5 w-5" />}
          accent={s.overallUtilisationPct > 30 ? 'amber' : 'indigo'}
        />
        <StatCard
          label="Total Reward Points"
          value={Number(s.totalRewardPoints || 0).toLocaleString('en-IN')}
          subtext={`Range Spend: ${formatINR(s.rangeExpenditure)} • Month: ${formatINR(s.monthlyExpenditure)}`}
          icon={<Gift className="h-5 w-5" />}
          accent="indigo"
        />
      </div>

      {/* Credit Utilisation Banner */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Overall Credit Utilisation ({s.overallUtilisationPct}%)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Used Credit {formatINR(s.totalUtilisedCredit)} of {formatINR(s.totalCreditLimit)} total limit • Available {formatINR(s.totalAvailableCredit)}
            </p>
          </div>
          {s.overallUtilisationPct > 30 ? (
            <Badge variant="warning">
              <AlertTriangle className="h-3.5 w-3.5" />
              Above recommended 30%
            </Badge>
          ) : (
            <Badge variant="success">Healthy Credit Ratio (&le; 30%)</Badge>
          )}
        </div>
        <Progress
          value={s.overallUtilisationPct}
          indicatorClassName={
            s.overallUtilisationPct > 50
              ? 'bg-rose-500'
              : s.overallUtilisationPct > 30
                ? 'bg-amber-500'
                : 'bg-emerald-500'
          }
        />
      </Card>

      {/* Interactive Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-sky-400" />
                Spending Trend ({range.toUpperCase()})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Actual recorded debit & EMI spends ({data.dateRange?.fromDate} to {data.dateRange?.toDate})
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/analytics')}>
              Full Analytics <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.charts?.monthlyTrend || []}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} />
                <YAxis stroke="#94A3B8" fontSize={12} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
                <Tooltip
                  formatter={(v: any) => [formatINR(v), 'Spend']}
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    color: '#F8FAFC',
                  }}
                />
                <Area type="monotone" dataKey="spend" stroke="#38BDF8" strokeWidth={2.5} fill="url(#spendGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
            Spend by Category
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Selected range breakdown
          </p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.charts?.categoryBreakdown || []}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={78}
                  paddingAngle={3}
                >
                  {(data.charts?.categoryBreakdown || []).map((_: any, idx: number) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => formatINR(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-2">
            {(data.charts?.categoryBreakdown || []).slice(0, 4).map((c: any, idx: number) => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                  />
                  {c.name}
                </span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatINR(c.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Card Utilisation Bar + Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Card-wise Utilisation (%)
            </h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/cards')}>
              Manage Cards
            </Button>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts?.cardUtilisation || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                <XAxis type="number" domain={[0, 100]} stroke="#94A3B8" fontSize={11} unit="%" />
                <YAxis type="category" dataKey="bankName" stroke="#94A3B8" fontSize={11} width={95} />
                <Tooltip formatter={(v: any) => `${v}%`} />
                <Bar dataKey="utilisationPct" fill="#6366F1" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-amber-400" />
              Upcoming Payment Deadlines
            </h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/bills')}>
              All Bills
            </Button>
          </div>
          <div className="space-y-3">
            {(data.upcomingDeadlines || []).length === 0 ? (
              <p className="text-xs text-slate-500">All bills are settled!</p>
            ) : (
              data.upcomingDeadlines.map((st: any) => (
                <div
                  key={st.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {st.bank_name} • {st.card_name} (•••• {st.last_four_digits})
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Due: {formatDate(st.payment_due_date)} • Min due {formatINR(st.minimum_amount_due)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {formatINR(Math.max(0, st.total_amount_due - st.amount_paid))}
                    </p>
                    <Badge
                      variant={
                        st.payment_status === 'Overdue'
                          ? 'danger'
                          : st.payment_status === 'Partially Paid'
                            ? 'info'
                            : 'warning'
                      }
                    >
                      {st.payment_status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Recent Activity Timeline + Recent Transactions + Offers & Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-sky-400" />
              Recent Activity Timeline
            </h3>
          </div>
          <div className="space-y-3">
            {(data.recentActivity || []).map((ev: any) => (
              <div key={ev.id} className="flex items-start gap-3 text-xs border-l-2 border-slate-200 dark:border-slate-700 pl-3 py-0.5">
                <div className="mt-0.5 shrink-0">
                  {ev.kind === 'payment' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  ) : ev.kind === 'alert' ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                  ) : (
                    <ArrowUpRight className="h-3.5 w-3.5 text-sky-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 dark:text-white truncate">{ev.title}</p>
                  <p className="text-slate-500 truncate">{ev.subtitle}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(ev.date)}</p>
                </div>
                {ev.amount !== undefined && (
                  <span className={`font-bold shrink-0 ${ev.kind === 'payment' ? 'text-emerald-500' : ''}`}>
                    {formatINR(ev.amount)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Transactions</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/transactions')}>
              View All
            </Button>
          </div>
          <div className="space-y-2.5">
            {(data.recentTransactions || []).slice(0, 6).map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800/70 pb-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-white truncate">{tx.merchant}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {tx.bank_name} •••• {tx.last_four_digits} • {formatDate(tx.transaction_date)}
                  </p>
                </div>
                <span className="font-bold shrink-0">{formatINR(tx.amount)}</span>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Tag className="h-4 w-4 text-sky-400" />
                Active Bank Offers
              </h3>
              <Button variant="ghost" size="sm" onClick={() => navigate('/offers')}>
                Explore
              </Button>
            </div>
            <div className="space-y-2.5">
              {(data.activeOffers || []).slice(0, 3).map((o: any) => (
                <div key={o.id} className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3 border border-slate-200/70 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-sky-500">{o.bank_name}</span>
                    <Badge variant={o.verification_status === 'verified' ? 'success' : 'warning'}>
                      {o.verification_status === 'verified' ? 'Verified' : o.offer_source === 'demo' ? 'Demo' : 'Manual'}
                    </Badge>
                  </div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white mt-1 line-clamp-1">
                    {o.title}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {o.merchant} • Expires {formatDate(o.expiry_date)}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Payment Reminders</h3>
              <Button variant="ghost" size="sm" onClick={() => navigate('/notifications')}>
                Centre
              </Button>
            </div>
            <div className="space-y-2">
              {(data.paymentReminders || []).length === 0 ? (
                <p className="text-xs text-slate-500">No active payment reminders.</p>
              ) : (
                data.paymentReminders.slice(0, 3).map((r: any) => (
                  <div key={r.id} className="text-xs rounded-xl border border-slate-200 dark:border-slate-800 p-2.5">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {r.card_name} (•••• {r.last_four_digits})
                    </p>
                    <p className="text-slate-500">
                      {r.reminder_stage.replace(/_/g, ' ')} • {formatINR(r.amount_due)} due {formatDate(r.due_date)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

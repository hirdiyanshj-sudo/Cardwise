import React, { useEffect, useState } from 'react';
import { Gift, Plus, AlertCircle, IndianRupee } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { apiRequest } from '../lib/api';
import { formatDate, formatINR } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import { StatCard } from '../components/common/StatCard';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { Badge, Button, Card, ErrorState, Input, Modal, Select } from '../components/ui';

export function RewardsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    cardId: '',
    actionType: 'Redeemed',
    points: '',
    cashbackInr: '',
    description: '',
    redemptionPartner: '',
  });

  const loadData = async () => {
    setError(null);
    try {
      const res = await apiRequest('/rewards');
      setData(res);
      if (!form.cardId && res.cardBalances?.[0]) {
        setForm((f) => ({ ...f, cardId: res.cardBalances[0].cardId }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load rewards');
      toast(err.message || 'Failed to load rewards', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/rewards/transactions', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          points: Number(form.points || 0),
          cashbackInr: Number(form.cashbackInr || 0),
        }),
      });
      toast('Reward & cashback ledger updated', 'success');
      setModalOpen(false);
      setForm({ ...form, points: '', cashbackInr: '', description: '', redemptionPartner: '' });
      loadData();
    } catch (err: any) {
      toast(err.message || 'Failed to update reward ledger', 'error');
    }
  };

  if (loading) return <LoadingSkeleton rows={2} />;
  if (error && !data) return <ErrorState message={error} onRetry={loadData} />;

  const t = data?.totals || {};
  const balances = data?.cardBalances || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Rewards & Cashback</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ledger-calculated reward points, cashback earned, redemptions & expiry reminders
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)} disabled={balances.length === 0}>
          <Plus className="h-4 w-4" /> Log Points / Cashback
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Active Points"
          value={Number(t.totalPoints || 0).toLocaleString('en-IN')}
          subtext={`Est. Value: ${formatINR(t.totalInrValue || 0)}`}
          icon={<Gift className="h-5 w-5" />}
          accent="indigo"
        />
        <StatCard
          label="Cashback Tracked"
          value={formatINR(t.totalCashbackInr || 0)}
          subtext={`Earned pts: ${Number(t.totalEarned || 0).toLocaleString('en-IN')}`}
          icon={<IndianRupee className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="Points Redeemed"
          value={Number(t.totalRedeemed || 0).toLocaleString('en-IN')}
          icon={<Gift className="h-5 w-5" />}
          accent="sky"
        />
        <StatCard
          label="Expiring Soon / Expired"
          value={`${Number(t.expiringSoon || 0).toLocaleString('en-IN')} pts`}
          subtext={`Expired to date: ${Number(t.totalExpired || 0).toLocaleString('en-IN')}`}
          icon={<AlertCircle className="h-5 w-5" />}
          accent="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
            Card-wise Reward Balances & Cashback
          </h3>
          <div className="space-y-3">
            {balances.map((b: any) => (
              <div
                key={b.cardId}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">
                      {b.bankName} • {b.cardName} (•••• {b.lastFourDigits})
                    </p>
                    <p className="text-slate-500 mt-0.5">
                      1 pt ≈ ₹{b.conversionRateInr} • Earned: {b.totalEarned.toLocaleString('en-IN')} • Cashback: {formatINR(b.totalCashbackInr || 0)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-sky-400">
                      {b.currentBalance.toLocaleString('en-IN')} pts
                    </p>
                    <p className="text-emerald-500 font-semibold">{formatINR(b.estimatedInrValue)}</p>
                  </div>
                </div>
                {b.expiringSoonPoints > 0 && b.nextExpiryDate && (
                  <div className="mt-2 flex items-center gap-1.5 text-amber-500 font-medium">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {b.expiringSoonPoints.toLocaleString('en-IN')} points expiring on {formatDate(b.nextExpiryDate)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
            Points Distribution by Card
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={balances}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                <XAxis dataKey="bankName" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip />
                <Bar dataKey="currentBalance" name="Active Points" fill="#6366F1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
          Reward & Cashback Ledger History
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500">
                <th className="pb-2">Date</th>
                <th className="pb-2">Card</th>
                <th className="pb-2">Action</th>
                <th className="pb-2">Description</th>
                <th className="pb-2 text-right">Points</th>
                <th className="pb-2 text-right">Cashback / Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {(data.history || []).map((h: any) => (
                <tr key={h.id}>
                  <td className="py-2.5 text-xs text-slate-500">{formatDate(h.transaction_date)}</td>
                  <td className="py-2.5 text-xs font-medium">{h.bank_name} •••• {h.last_four_digits}</td>
                  <td className="py-2.5">
                    <Badge
                      variant={
                        h.action_type === 'Earned'
                          ? 'success'
                          : h.action_type === 'Redeemed'
                            ? 'info'
                            : 'danger'
                      }
                    >
                      {h.action_type}
                    </Badge>
                  </td>
                  <td className="py-2.5 text-xs">
                    {h.description} {h.redemption_partner ? `(${h.redemption_partner})` : ''}
                  </td>
                  <td className="py-2.5 text-right font-bold">{Number(h.points).toLocaleString('en-IN')}</td>
                  <td className="py-2.5 text-right text-xs">
                    {Number(h.cashback_inr || 0) > 0 ? (
                      <span className="text-emerald-500 font-semibold">{formatINR(h.cashback_inr)} CB</span>
                    ) : (
                      formatINR(h.inr_value)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Record Reward or Cashback Activity">
        <form onSubmit={handleRecord} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400">Card</label>
            <Select value={form.cardId} onChange={(e) => setForm({ ...form, cardId: e.target.value })} className="mt-1">
              {balances.map((b: any) => (
                <option key={b.cardId} value={b.cardId}>
                  {b.bankName} • {b.cardName} ({b.currentBalance} pts)
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-400">Action</label>
              <Select value={form.actionType} onChange={(e) => setForm({ ...form, actionType: e.target.value })} className="mt-1">
                <option value="Redeemed">Redeemed</option>
                <option value="Earned">Earned</option>
                <option value="Expired">Expired</option>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Points</label>
              <Input type="number" min={0} value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Cashback (₹)</label>
              <Input type="number" min={0} step="0.01" value={form.cashbackInr} onChange={(e) => setForm({ ...form, cashbackInr: e.target.value })} className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400">Description</label>
            <Input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Monthly Amazon Cashback Credit" className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Redemption Partner (Optional)</label>
            <Input value={form.redemptionPartner} onChange={(e) => setForm({ ...form, redemptionPartner: e.target.value })} placeholder="e.g. Marriott Bonvoy / Statement Credit" className="mt-1" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save Ledger Entry</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

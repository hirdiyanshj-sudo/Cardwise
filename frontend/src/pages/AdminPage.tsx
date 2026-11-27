import React, { useEffect, useState } from 'react';
import { ShieldAlert, CheckCircle2, Trash2, RefreshCw, Plus } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { INDIAN_BANKS, formatDate } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { Badge, Button, Card, ErrorState, Input, Modal, Select } from '../components/ui';

export function AdminPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'offers' | 'banks' | 'catalog' | 'logs'>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  const [offerModal, setOfferModal] = useState(false);
  const [offerForm, setOfferForm] = useState({
    bankName: 'HDFC Bank',
    title: '',
    applicableCards: '',
    category: 'Shopping',
    merchant: '',
    discountPercentage: '10',
    maxDiscount: '1500',
    minTransactionAmount: '3000',
    expiryDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    sourceUrl: 'https://www.hdfcbank.com',
    verificationStatus: 'verified',
    termsAndConditions: 'Verified against official issuer offer page.',
  });

  const loadAdminData = async () => {
    setError(null);
    try {
      const [ov, of, bk, cat, lg] = await Promise.all([
        apiRequest('/admin/overview'),
        apiRequest('/admin/offers'),
        apiRequest('/admin/banks'),
        apiRequest('/admin/catalog'),
        apiRequest('/admin/audit-logs?limit=50'),
      ]);
      setOverview(ov);
      setOffers(of.offers || []);
      setBanks(bk.banks || []);
      setCatalog(cat.catalog || []);
      setLogs(lg.logs || []);
    } catch (err: any) {
      setError(err.message || 'Admin access required');
      toast(err.message || 'Failed to load admin console', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleCreateVerifiedOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/admin/offers', {
        method: 'POST',
        body: JSON.stringify({
          ...offerForm,
          discountPercentage: Number(offerForm.discountPercentage),
          maxDiscount: Number(offerForm.maxDiscount),
          minTransactionAmount: Number(offerForm.minTransactionAmount),
        }),
      });
      toast('Global offer published', 'success');
      setOfferModal(false);
      loadAdminData();
    } catch (err: any) {
      toast(err.message || 'Failed to create offer', 'error');
    }
  };

  const handleVerifyOffer = async (id: string, verificationStatus: string) => {
    try {
      await apiRequest(`/admin/offers/${id}/verify`, {
        method: 'PUT',
        body: JSON.stringify({ verificationStatus }),
      });
      toast(`Offer marked ${verificationStatus}`, 'success');
      loadAdminData();
    } catch (err: any) {
      toast(err.message || 'Update failed', 'error');
    }
  };

  const handleDeleteOffer = async (id: string) => {
    await apiRequest(`/admin/offers/${id}`, { method: 'DELETE' });
    toast('Offer deleted', 'info');
    loadAdminData();
  };

  const handleUpdateBankApr = async (bank: any, newApr: string) => {
    try {
      await apiRequest(`/admin/banks/${bank.id}`, {
        method: 'PUT',
        body: JSON.stringify({ defaultApr: Number(newApr) }),
      });
      toast(`${bank.name} default APR updated`, 'success');
      loadAdminData();
    } catch (err: any) {
      toast(err.message || 'Bank update failed', 'error');
    }
  };

  const handleResetDemo = async () => {
    try {
      await apiRequest('/admin/demo/reset', { method: 'POST' });
      toast('Demo portfolio re-seeded cleanly', 'success');
      loadAdminData();
    } catch (err: any) {
      toast(err.message || 'Demo reset failed', 'error');
    }
  };

  if (loading) return <LoadingSkeleton rows={2} />;
  if (error) return <ErrorState message={error} onRetry={loadAdminData} />;

  const stats = overview?.stats || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-400" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Administrator Console</h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Protected operations for banks, card catalogue, offer verification, demo data & audit logs
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleResetDemo}>
          <RefreshCw className="h-3.5 w-3.5" /> Reset Demo Portfolio
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['overview', 'offers', 'banks', 'catalog', 'logs'] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? 'primary' : 'outline'} onClick={() => setTab(t)} className="capitalize">
            {t === 'logs' ? 'System Audit Logs' : t}
          </Button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            ['Total Users', stats.totalUsers],
            ['Cards Tracked', stats.totalCardsTracked],
            ['Statements', stats.totalStatements],
            ['Global Offers', stats.totalOffers],
            ['Verified Offers', stats.verifiedOffers],
          ].map(([label, val]) => (
            <Card key={String(label)} className="p-4">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-2xl font-bold mt-1">{val ?? 0}</p>
            </Card>
          ))}
        </div>
      )}

      {tab === 'offers' && (
        <Card className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold">Manage & Verify Bank Offers</h2>
            <Button size="sm" onClick={() => setOfferModal(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Verified Offer
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                  <th className="pb-2">Bank</th>
                  <th className="pb-2">Title</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Expiry</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {offers.map((o) => (
                  <tr key={o.id}>
                    <td className="py-2.5 font-semibold">{o.bank_name}</td>
                    <td className="py-2.5">{o.title}</td>
                    <td className="py-2.5">
                      <Badge variant={o.verification_status === 'verified' ? 'success' : 'warning'}>
                        {o.verification_status}
                      </Badge>
                    </td>
                    <td className="py-2.5">{formatDate(o.expiry_date)}</td>
                    <td className="py-2.5 text-right space-x-1.5">
                      <Button size="sm" variant="secondary" onClick={() => handleVerifyOffer(o.id, 'verified')}>
                        <CheckCircle2 className="h-3 w-3" /> Verify
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleVerifyOffer(o.id, 'expired')}>
                        Expire
                      </Button>
                      <button onClick={() => handleDeleteOffer(o.id)} className="text-rose-400 p-1">
                        <Trash2 className="h-3.5 w-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'banks' && (
        <Card>
          <h2 className="text-base font-bold mb-4">Bank Interest & Fee Rules</h2>
          <div className="space-y-3 text-xs">
            {banks.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                <div>
                  <p className="font-bold text-sm">{b.name} ({b.code})</p>
                  <p className="text-slate-500">
                    Min Due: {b.min_due_pct}% (floor ₹{b.min_due_floor}) • GST: {b.gst_rate_pct}%
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Default APR %:</span>
                  <Input
                    type="number"
                    step="0.1"
                    defaultValue={b.default_apr}
                    className="w-24 h-8 text-xs"
                    onBlur={(e) => handleUpdateBankApr(b, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'catalog' && (
        <Card>
          <h2 className="text-base font-bold mb-4">Card Comparison Catalogue ({catalog.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {catalog.map((c) => (
              <div key={c.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex justify-between">
                <div>
                  <p className="font-bold">{c.bank_name} • {c.card_name}</p>
                  <p className="text-slate-500">{c.card_network} • {c.card_type} • Fee ₹{c.annual_fee}</p>
                </div>
                <Badge variant="outline">{c.reward_rate_pct}% / {c.cashback_pct}%</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'logs' && (
        <Card>
          <h2 className="text-base font-bold mb-3">Platform Security & Audit Logs</h2>
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {logs.map((l) => (
              <div key={l.id} className="py-2 flex justify-between gap-2">
                <div>
                  <span className="font-semibold text-sky-400">{l.action}</span>
                  <span className="text-slate-500 ml-2">{l.resource_type} • {l.ip_address}</span>
                </div>
                <span className="text-slate-500">{formatDate(l.created_at)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={offerModal} onClose={() => setOfferModal(false)} title="Publish Global Verified Offer">
        <form onSubmit={handleCreateVerifiedOffer} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <Select value={offerForm.bankName} onChange={(e) => setOfferForm({ ...offerForm, bankName: e.target.value })}>
              {INDIAN_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
            </Select>
            <Input required placeholder="Category (e.g. Shopping, Flights)" value={offerForm.category} onChange={(e) => setOfferForm({ ...offerForm, category: e.target.value })} />
          </div>
          <Input required placeholder="Offer Title" value={offerForm.title} onChange={(e) => setOfferForm({ ...offerForm, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input required placeholder="Merchant" value={offerForm.merchant} onChange={(e) => setOfferForm({ ...offerForm, merchant: e.target.value })} />
            <Input type="url" required placeholder="Official Source URL" value={offerForm.sourceUrl} onChange={(e) => setOfferForm({ ...offerForm, sourceUrl: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input type="number" placeholder="Discount %" value={offerForm.discountPercentage} onChange={(e) => setOfferForm({ ...offerForm, discountPercentage: e.target.value })} />
            <Input type="number" placeholder="Max ₹" value={offerForm.maxDiscount} onChange={(e) => setOfferForm({ ...offerForm, maxDiscount: e.target.value })} />
            <Input type="date" required value={offerForm.expiryDate} onChange={(e) => setOfferForm({ ...offerForm, expiryDate: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOfferModal(false)}>Cancel</Button>
            <Button type="submit">Publish Offer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

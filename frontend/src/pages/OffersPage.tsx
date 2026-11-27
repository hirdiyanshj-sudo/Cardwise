import React, { useEffect, useState } from 'react';
import { Bookmark, Plus, Search, Trash2, Info, ExternalLink } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { INDIAN_BANKS, formatDate, formatINR } from '../lib/utils';
import type { BankOffer } from '../lib/types';
import { useToast } from '../context/ToastContext';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { Badge, Button, Card, ErrorState, Input, Modal, Select } from '../components/ui';

const OFFER_CATEGORIES = [
  'Shopping',
  'Dining',
  'Food delivery',
  'Travel',
  'Flights',
  'Hotels',
  'Movies',
  'Entertainment',
  'Fuel',
  'Electronics',
  'Cashback',
  'EMI',
  'No-cost EMI',
  'Reward multipliers',
];

export function OffersPage() {
  const { toast } = useToast();
  const [offers, setOffers] = useState<BankOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bank, setBank] = useState('all');
  const [category, setCategory] = useState('all');
  const [verificationStatus, setVerificationStatus] = useState('all');
  const [expiryBefore, setExpiryBefore] = useState('');
  const [search, setSearch] = useState('');
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [newOffer, setNewOffer] = useState({
    bankName: 'HDFC Bank',
    title: '',
    applicableCards: '',
    category: 'Shopping',
    merchant: '',
    discountPercentage: '10',
    maxDiscount: '1500',
    minTransactionAmount: '3000',
    offerValidity: 'Valid this month',
    expiryDate: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10),
    termsAndConditions: 'Manually logged by cardholder.',
    promoCode: '',
    sourceUrl: '',
  });

  const loadOffers = async () => {
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (bank !== 'all') qs.set('bank', bank);
      if (category !== 'all') qs.set('category', category);
      if (verificationStatus !== 'all') qs.set('verificationStatus', verificationStatus);
      if (expiryBefore) qs.set('expiryBefore', expiryBefore);
      if (search) qs.set('search', search);
      if (bookmarkedOnly) qs.set('bookmarkedOnly', 'true');
      const res = await apiRequest(`/offers?${qs.toString()}`);
      setOffers(res.offers || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load offers');
      toast(err.message || 'Failed to load offers', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOffers();
  }, [bank, category, verificationStatus, bookmarkedOnly]);

  const toggleBookmark = async (id: string) => {
    try {
      const res = await apiRequest(`/offers/${id}/bookmark`, { method: 'POST' });
      setOffers((prev) =>
        prev.map((o) => (o.id === id ? { ...o, is_bookmarked: res.bookmarked } : o))
      );
      toast(res.bookmarked ? 'Offer bookmarked' : 'Removed from bookmarks', 'info');
    } catch (err: any) {
      toast(err.message || 'Failed to bookmark offer', 'error');
    }
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/offers', {
        method: 'POST',
        body: JSON.stringify({
          ...newOffer,
          discountPercentage: Number(newOffer.discountPercentage),
          maxDiscount: Number(newOffer.maxDiscount),
          minTransactionAmount: Number(newOffer.minTransactionAmount),
        }),
      });
      toast('Personal offer added to your offers vault', 'success');
      setAddOpen(false);
      loadOffers();
    } catch (err: any) {
      toast(err.message || 'Failed to save offer', 'error');
    }
  };

  const handleDeleteOffer = async (id: string) => {
    try {
      await apiRequest(`/offers/${id}`, { method: 'DELETE' });
      toast('Custom offer deleted', 'info');
      loadOffers();
    } catch (err: any) {
      toast(err.message || 'Delete failed', 'error');
    }
  };

  if (loading) return <LoadingSkeleton rows={2} />;
  if (error && offers.length === 0) return <ErrorState message={error} onRetry={loadOffers} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bank Offers & Discounts</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Browse verified or demo Indian bank deals across 14 categories, or log personal offers
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add Personal Offer
        </Button>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Transparency Notice: CardWise never fabricates live promotions. Pre-seeded records are clearly labeled <strong>Demo Data</strong>; administrator-reviewed deals show <strong>Verified</strong> with a source URL and verification timestamp.
        </span>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
            <Input
              placeholder="Search merchant, card or offer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadOffers()}
              className="pl-9"
            />
          </div>
          <Select value={bank} onChange={(e) => setBank(e.target.value)}>
            <option value="all">All 11 Banks</option>
            {INDIAN_BANKS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </Select>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All Categories</option>
            {OFFER_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <Select value={verificationStatus} onChange={(e) => setVerificationStatus(e.target.value)}>
            <option value="all">All Sources</option>
            <option value="verified">Admin Verified</option>
            <option value="demo">Demo Data</option>
            <option value="unverified">User Manual</option>
          </Select>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={expiryBefore}
              onChange={(e) => setExpiryBefore(e.target.value)}
              onBlur={loadOffers}
              title="Expiring before date"
            />
            <Button
              type="button"
              variant={bookmarkedOnly ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setBookmarkedOnly(!bookmarkedOnly)}
              title="Show bookmarked only"
            >
              <Bookmark className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Offers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {offers.map((o) => {
          const vStatus = o.verification_status || o.offer_source || 'demo';
          return (
            <Card key={o.id} className="flex flex-col justify-between p-5 hover:border-sky-500/40">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="info">{o.bank_name}</Badge>
                    <Badge variant="outline">{o.category}</Badge>
                    <Badge
                      variant={
                        vStatus === 'verified'
                          ? 'success'
                          : vStatus === 'demo'
                            ? 'warning'
                            : 'default'
                      }
                    >
                      {vStatus === 'verified' ? 'Verified' : vStatus === 'demo' ? 'Demo Data' : 'Unverified'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleBookmark(o.id)}
                      className={`p-1.5 rounded-lg transition ${
                        o.is_bookmarked ? 'text-amber-400 bg-amber-400/10' : 'text-slate-400 hover:text-amber-400'
                      }`}
                      title="Bookmark offer"
                    >
                      <Bookmark className="h-4 w-4" fill={o.is_bookmarked ? 'currentColor' : 'none'} />
                    </button>
                    {o.user_id && (
                      <button
                        onClick={() => handleDeleteOffer(o.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500"
                        title="Delete custom offer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white leading-snug">
                  {o.title}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Merchant: <strong className="text-slate-700 dark:text-slate-200">{o.merchant}</strong> • Cards: {o.applicable_cards}
                </p>

                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 dark:bg-slate-900/70 p-2.5 text-center text-xs">
                  <div>
                    <p className="text-[10px] text-slate-500">Discount</p>
                    <p className="font-bold text-emerald-500">{o.discount_percentage}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">Max Cap</p>
                    <p className="font-bold">{formatINR(o.max_discount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">Min Spend</p>
                    <p className="font-bold">{formatINR(o.min_transaction_amount)}</p>
                  </div>
                </div>

                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {o.terms_and_conditions}
                </p>

                {o.last_verified_at && (
                  <p className="mt-1.5 text-[11px] text-emerald-500">
                    Last verified: {formatDate(o.last_verified_at)}
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-500">
                  {o.offer_validity} • Exp {formatDate(o.expiry_date)}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {o.promo_code && (
                    <code className="rounded bg-sky-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-400">
                      {o.promo_code}
                    </code>
                  )}
                  {o.source_url && (
                    <a
                      href={o.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-400 hover:underline inline-flex items-center gap-0.5"
                      title="Open issuer offer source"
                    >
                      Source <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Personal Bank Offer"
        subtitle="Save a personal offer from your bank app, SMS, or merchant portal."
      >
        <form onSubmit={handleCreateOffer} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">Bank</label>
              <Select value={newOffer.bankName} onChange={(e) => setNewOffer({ ...newOffer, bankName: e.target.value })} className="mt-1">
                {INDIAN_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Category</label>
              <Select value={newOffer.category} onChange={(e) => setNewOffer({ ...newOffer, category: e.target.value })} className="mt-1">
                {OFFER_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400">Offer Title</label>
            <Input required value={newOffer.title} onChange={(e) => setNewOffer({ ...newOffer, title: e.target.value })} placeholder="e.g. 10% Instant Off on Nykaa" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">Merchant</label>
              <Input required value={newOffer.merchant} onChange={(e) => setNewOffer({ ...newOffer, merchant: e.target.value })} placeholder="Nykaa" className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Applicable Cards</label>
              <Input value={newOffer.applicableCards} onChange={(e) => setNewOffer({ ...newOffer, applicableCards: e.target.value })} placeholder="All HDFC Credit Cards" className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-400">Discount %</label>
              <Input type="number" value={newOffer.discountPercentage} onChange={(e) => setNewOffer({ ...newOffer, discountPercentage: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Max Discount (₹)</label>
              <Input type="number" value={newOffer.maxDiscount} onChange={(e) => setNewOffer({ ...newOffer, maxDiscount: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Min Txn (₹)</label>
              <Input type="number" value={newOffer.minTransactionAmount} onChange={(e) => setNewOffer({ ...newOffer, minTransactionAmount: e.target.value })} className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-400">Expiry Date</label>
              <Input type="date" required value={newOffer.expiryDate} onChange={(e) => setNewOffer({ ...newOffer, expiryDate: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Promo Code</label>
              <Input value={newOffer.promoCode} onChange={(e) => setNewOffer({ ...newOffer, promoCode: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Source URL (Optional)</label>
              <Input type="url" value={newOffer.sourceUrl} onChange={(e) => setNewOffer({ ...newOffer, sourceUrl: e.target.value })} placeholder="https://..." className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400">Terms & Conditions</label>
            <Input value={newOffer.termsAndConditions} onChange={(e) => setNewOffer({ ...newOffer, termsAndConditions: e.target.value })} className="mt-1" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit">Save Offer</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

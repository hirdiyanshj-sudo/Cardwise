import { useEffect, useState } from 'react';
import { Scale, Sparkles, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { INDIAN_BANKS, formatINR } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { Badge, Button, Card, Input } from '../components/ui';

const COMPARE_CRITERIA: Array<{ key: string; label: string; format?: (v: any) => string }> = [
  { key: 'annual_fee', label: 'Annual Fee', format: (v) => formatINR(v) },
  { key: 'joining_fee', label: 'Joining Fee', format: (v) => formatINR(v) },
  { key: 'interest_rate', label: 'Interest Rate (APR)', format: (v) => `${v}%` },
  { key: 'cashback_pct', label: 'Cashback %', format: (v) => `${v}%` },
  { key: 'reward_rate_pct', label: 'Base Reward Rate', format: (v) => `${v}%` },
  { key: 'lounge_access', label: 'Airport Lounge Access' },
  { key: 'dining_benefits', label: 'Dining Offers' },
  { key: 'shopping_benefits', label: 'Shopping Discounts' },
  { key: 'travel_benefits', label: 'Travel Benefits' },
  { key: 'fuel_benefits', label: 'Fuel Benefits' },
  { key: 'movie_benefits', label: 'Movie Offers' },
  { key: 'forex_markup_pct', label: 'Forex Markup', format: (v) => `${v}%` },
  { key: 'milestone_benefits', label: 'Milestone Benefits' },
  { key: 'eligibility_criteria', label: 'Eligibility Criteria' },
];

export function ComparePage() {
  const { toast } = useToast();
  const [catalog, setCatalog] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compared, setCompared] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'compare' | 'recommend'>('compare');

  const [recInput, setRecInput] = useState({
    monthlyExpenditure: 60000,
    shoppingSharePct: 35,
    travelSharePct: 20,
    diningSharePct: 20,
    fuelSharePct: 10,
    preferredBanks: [] as string[],
    preferNoAnnualFee: false,
    preferCashback: false,
  });
  const [recommendations, setRecommendations] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest('/cards/catalog');
        const list = res.catalog || [];
        setCatalog(list);
        const initial = list.slice(0, 3).map((c: any) => c.id);
        setSelectedIds(initial);
        if (initial.length >= 2) {
          const compRes = await apiRequest('/analytics/compare', {
            method: 'POST',
            body: JSON.stringify({ cardIds: initial }),
          });
          setCompared(compRes.comparedCards || []);
        }
        const recRes = await apiRequest('/analytics/recommendations', {
          method: 'POST',
          body: JSON.stringify(recInput),
        });
        setRecommendations(recRes.recommendations || []);
      } catch (err: any) {
        toast(err.message || 'Failed to load catalog', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) {
        toast('You can compare up to 4 cards simultaneously.', 'warning');
        return prev;
      }
      return [...prev, id];
    });
  };

  const runComparison = async () => {
    if (selectedIds.length < 2) {
      toast('Select at least 2 cards to compare.', 'warning');
      return;
    }
    try {
      const res = await apiRequest('/analytics/compare', {
        method: 'POST',
        body: JSON.stringify({ cardIds: selectedIds, title: 'Custom Comparison' }),
      });
      setCompared(res.comparedCards || []);
      toast('Comparison updated', 'success');
    } catch (err: any) {
      toast(err.message || 'Comparison failed', 'error');
    }
  };

  const runRecommendations = async () => {
    try {
      const res = await apiRequest('/analytics/recommendations', {
        method: 'POST',
        body: JSON.stringify(recInput),
      });
      setRecommendations(res.recommendations || []);
      toast('Personalized recommendations updated', 'success');
    } catch (err: any) {
      toast(err.message || 'Recommendation engine failed', 'error');
    }
  };

  const toggleBankPref = (bank: string) => {
    setRecInput((prev) => ({
      ...prev,
      preferredBanks: prev.preferredBanks.includes(bank)
        ? prev.preferredBanks.filter((b) => b !== bank)
        : [...prev.preferredBanks, bank],
    }));
  };

  if (loading) return <LoadingSkeleton rows={2} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Compare & Recommend Credit Cards
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Side-by-side comparison of up to 4 Indian cards & personalized annual savings estimator
          </p>
        </div>
        <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-white dark:bg-slate-900">
          <button
            onClick={() => setTab('compare')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${
              tab === 'compare' ? 'bg-sky-500 text-white' : 'text-slate-500'
            }`}
          >
            <Scale className="h-3.5 w-3.5 inline mr-1" /> Compare (Up to 4)
          </button>
          <button
            onClick={() => setTab('recommend')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${
              tab === 'recommend' ? 'bg-sky-500 text-white' : 'text-slate-500'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 inline mr-1" /> Recommendation Engine
          </button>
        </div>
      </div>

      {tab === 'compare' && (
        <div className="space-y-5">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Select 2 to 4 Indian Credit Cards ({selectedIds.length}/4 selected)
              </p>
              <Button size="sm" onClick={runComparison}>Compare Selected Cards</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {catalog.map((c) => {
                const active = selectedIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleSelect(c.id)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? 'border-sky-500 bg-sky-500/15 text-sky-400'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {c.bank_name.replace(' Bank', '')} • {c.card_name}
                  </button>
                );
              })}
            </div>
          </Card>

          {compared.length >= 2 && (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 px-3 text-left text-xs uppercase tracking-wider text-slate-500 w-44">
                      Feature
                    </th>
                    {compared.map((c) => (
                      <th key={c.id} className="py-3 px-3 text-left min-w-[220px]">
                        <p className="text-[11px] text-sky-400 font-semibold">{c.bank_name}</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{c.card_name}</p>
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <Badge variant="success" className="whitespace-nowrap">Score: {c.comparisonScore}/100</Badge>
                          <Badge variant="outline" className="whitespace-nowrap">{c.card_network}</Badge>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                  {COMPARE_CRITERIA.map((row) => (
                    <tr key={row.key}>
                      <td className="py-3 px-3 font-semibold text-slate-600 dark:text-slate-300">
                        {row.label}
                      </td>
                      {compared.map((c) => (
                        <td key={c.id} className="py-3 px-3 text-slate-800 dark:text-slate-200">
                          {row.format ? row.format(c[row.key]) : c[row.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {tab === 'recommend' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="space-y-4 h-fit">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Your Monthly Spending Profile
            </h3>
            <div>
              <label className="text-xs text-slate-500">Monthly Card Expenditure (₹)</label>
              <Input
                type="number"
                value={recInput.monthlyExpenditure}
                onChange={(e) => setRecInput({ ...recInput, monthlyExpenditure: Number(e.target.value) })}
                className="mt-1"
              />
            </div>

            {[
              { key: 'shoppingSharePct', label: 'Online Shopping Share (%)' },
              { key: 'travelSharePct', label: 'Travel & Hotels Share (%)' },
              { key: 'diningSharePct', label: 'Dining & Food Delivery (%)' },
              { key: 'fuelSharePct', label: 'Fuel Share (%)' },
            ].map((slider) => (
              <div key={slider.key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">{slider.label}</span>
                  <span className="font-bold text-sky-400">{(recInput as any)[slider.key]}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={60}
                  value={(recInput as any)[slider.key]}
                  onChange={(e) => setRecInput({ ...recInput, [slider.key]: Number(e.target.value) })}
                  className="w-full accent-sky-500"
                />
              </div>
            ))}

            <div>
              <label className="text-xs text-slate-500 block mb-1.5">Preferred Banks (Optional)</label>
              <div className="flex flex-wrap gap-1.5">
                {INDIAN_BANKS.slice(0, 7).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => toggleBankPref(b)}
                    className={`rounded-lg px-2 py-1 text-[11px] border ${
                      recInput.preferredBanks.includes(b)
                        ? 'border-sky-500 bg-sky-500/15 text-sky-400'
                        : 'border-slate-200 dark:border-slate-800 text-slate-500'
                    }`}
                  >
                    {b.replace(' Bank', '')}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-1 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recInput.preferNoAnnualFee}
                  onChange={(e) => setRecInput({ ...recInput, preferNoAnnualFee: e.target.checked })}
                />
                Prefer Lifetime Free / Zero Annual Fee
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recInput.preferCashback}
                  onChange={(e) => setRecInput({ ...recInput, preferCashback: e.target.checked })}
                />
                Prefer Direct Cashback Cards
              </label>
            </div>

            <Button onClick={runRecommendations} className="w-full">
              Calculate Best Cards
            </Button>
          </Card>

          <div className="lg:col-span-2 space-y-4">
            {recommendations.map((r, idx) => (
              <Card key={r.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={idx === 0 ? 'success' : 'info'}>#{idx + 1} Match ({r.matchScore}/100)</Badge>
                      <Badge variant="outline">{r.card_type}</Badge>
                      <Badge variant="outline">Fee: {r.effectiveAnnualFee === 0 ? '₹0' : formatINR(r.effectiveAnnualFee)}</Badge>
                    </div>
                    <h3 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                      {r.bank_name} • {r.card_name}
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-slate-500">Est. Net Annual Savings</p>
                    <p className="text-xl font-extrabold text-emerald-500">
                      {formatINR(r.estimatedNetAnnualSavings)}/yr
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {r.reasons.map((reason: string) => (
                    <span key={reason} className="inline-flex items-center gap-1 text-xs text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      {reason}
                    </span>
                  ))}
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                  <strong>Assumptions:</strong> {r.assumptions.join(' • ')}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import type { LateFeeSlab } from '../db/migrations.js';

export function calculateUtilisationPct(used: number, limit: number): number {
  if (!limit || limit <= 0) return 0;
  return Math.round((used / limit) * 10000) / 100;
}

const DEFAULT_FALLBACK_SLABS: LateFeeSlab[] = [
  { upTo: 100, fee: 0, label: 'Up to ₹100' },
  { upTo: 500, fee: 100, label: '₹101 – ₹500' },
  { upTo: 5000, fee: 500, label: '₹501 – ₹5,000' },
  { upTo: 10000, fee: 750, label: '₹5,001 – ₹10,000' },
  { upTo: 25000, fee: 1100, label: '₹10,001 – ₹25,000' },
  { upTo: 50000, fee: 1300, label: '₹25,001 – ₹50,000' },
  { upTo: null, fee: 1500, label: 'Above ₹50,000' },
];

export function calculateLatePaymentFee(
  outstandingAmount: number,
  bankSlabs?: LateFeeSlab[] | null,
  gstRatePct = 18
): {
  baseFee: number;
  gst: number;
  totalFee: number;
  slab: string;
  isEstimate: boolean;
} {
  const slabs = bankSlabs && bankSlabs.length > 0 ? bankSlabs : DEFAULT_FALLBACK_SLABS;
  const isEstimate = !bankSlabs || bankSlabs.length === 0;
  let baseFee = 0;
  let slab = slabs[0]?.label || '₹0';

  for (const s of slabs) {
    if (s.upTo === null || outstandingAmount <= s.upTo) {
      baseFee = s.fee;
      slab = s.label;
      break;
    }
  }

  const gst = Math.round(baseFee * (gstRatePct / 100) * 100) / 100;
  return {
    baseFee,
    gst,
    totalFee: Math.round((baseFee + gst) * 100) / 100,
    slab,
    isEstimate,
  };
}

export function calculateRevolvingInterest(
  unpaidBalance: number,
  annualRatePct: number,
  daysOverdue: number,
  gstRatePct = 18
): {
  monthlyRatePct: number;
  interestAmount: number;
  gstOnInterest: number;
  totalInterestCharge: number;
} {
  const safeBalance = Math.max(0, unpaidBalance);
  const safeDays = Math.max(0, daysOverdue);
  const dailyRate = annualRatePct / 100 / 365;
  const interestAmount = Math.round(safeBalance * dailyRate * safeDays * 100) / 100;
  const gstOnInterest = Math.round(interestAmount * (gstRatePct / 100) * 100) / 100;
  return {
    monthlyRatePct: Math.round((annualRatePct / 12) * 100) / 100,
    interestAmount,
    gstOnInterest,
    totalInterestCharge: Math.round((interestAmount + gstOnInterest) * 100) / 100,
  };
}

const CATEGORY_RULES: Array<{ category: string; keywords: string[] }> = [
  {
    category: 'Shopping',
    keywords: ['amazon', 'flipkart', 'myntra', 'ajio', 'croma', 'reliance digital', 'nykaa', 'meesho', 'tata cliq', 'apple', 'zara', 'decathlon'],
  },
  {
    category: 'Food and Dining',
    keywords: ['swiggy', 'zomato', 'restaurant', 'cafe', 'starbucks', 'dominos', 'mcdonald', 'kfc', 'dining', 'dineout', 'bakery', 'haldiram'],
  },
  {
    category: 'Travel',
    keywords: ['makemytrip', 'goibibo', 'indigo', 'air india', 'vistara', 'irctc', 'uber', 'ola', 'hotel', 'flight', 'marriott', 'taj', 'cleartrip', 'airport'],
  },
  {
    category: 'Fuel',
    keywords: ['indian oil', 'iocl', 'hpcl', 'bpcl', 'shell', 'petrol', 'diesel', 'fuel', 'pump'],
  },
  {
    category: 'Entertainment',
    keywords: ['bookmyshow', 'pvr', 'inox', 'netflix', 'spotify', 'prime video', 'hotstar', 'cinema', 'movie', 'gaming'],
  },
  {
    category: 'Groceries',
    keywords: ['blinkit', 'zepto', 'instamart', 'bigbasket', 'dmart', 'reliance fresh', 'supermarket', 'grocery'],
  },
  {
    category: 'Bills and Utilities',
    keywords: ['electricity', 'bescom', 'airtel', 'jio', 'vi ', 'broadband', 'gas', 'water', 'recharge', 'utility', 'insurance', 'act fibernet'],
  },
  {
    category: 'Healthcare',
    keywords: ['apollo', 'pharmeasy', '1mg', 'hospital', 'clinic', 'pharmacy', 'medical', 'health', 'dental', 'practo'],
  },
  {
    category: 'Education',
    keywords: ['udemy', 'coursera', 'school', 'college', 'tuition', 'books', 'exam', 'university', 'upgrad'],
  },
];

export function autoCategorizeMerchant(merchant: string, description = ''): string {
  const hay = `${merchant} ${description}`.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => hay.includes(kw))) {
      return rule.category;
    }
  }
  return 'Other expenses';
}

export interface RecommendationInput {
  monthlyExpenditure: number;
  shoppingSharePct: number;
  travelSharePct: number;
  diningSharePct: number;
  fuelSharePct: number;
  preferredBanks: string[];
  preferNoAnnualFee: boolean;
  preferCashback: boolean;
}

export interface CatalogCardRow {
  id: string;
  bank_name: string;
  card_name: string;
  card_network: string;
  card_type: string;
  annual_fee: number;
  joining_fee: number;
  interest_rate: number;
  cashback_pct: number;
  reward_rate_pct: number;
  lounge_access: string;
  dining_benefits: string;
  shopping_benefits: string;
  travel_benefits: string;
  fuel_benefits: string;
  movie_benefits: string;
  forex_markup_pct: number;
  milestone_benefits: string;
  eligibility_criteria: string;
  best_for_categories: string;
  color_theme: string;
}

export function scoreCardRecommendations(
  catalog: CatalogCardRow[],
  input: RecommendationInput
) {
  const annualSpend = Math.max(0, input.monthlyExpenditure) * 12;
  const shopSpend = annualSpend * (input.shoppingSharePct / 100);
  const travelSpend = annualSpend * (input.travelSharePct / 100);
  const diningSpend = annualSpend * (input.diningSharePct / 100);
  const fuelSpend = annualSpend * (input.fuelSharePct / 100);
  const otherSpend = Math.max(0, annualSpend - shopSpend - travelSpend - diningSpend - fuelSpend);

  return catalog
    .map((card) => {
      const effectiveBaseRate = Math.max(card.cashback_pct * 0.45, card.reward_rate_pct);
      const cats = card.best_for_categories.toLowerCase();

      const shopYield = cats.includes('shopping')
        ? Math.max(card.cashback_pct, card.reward_rate_pct * 1.4) / 100
        : effectiveBaseRate / 100;
      const travelYield = cats.includes('travel')
        ? Math.max(card.reward_rate_pct * 1.8, card.cashback_pct) / 100
        : effectiveBaseRate / 100;
      const diningYield = cats.includes('dining')
        ? Math.max(card.cashback_pct, card.reward_rate_pct * 1.5) / 100
        : effectiveBaseRate / 100;
      const fuelYield = cats.includes('fuel') ? 0.05 : 0.01;

      const grossAnnualValue = Math.round(
        shopSpend * shopYield +
          travelSpend * travelYield +
          diningSpend * diningYield +
          fuelSpend * fuelYield +
          otherSpend * (effectiveBaseRate / 100)
      );

      const feeWaived = annualSpend >= 250000 && card.annual_fee <= 1500;
      const effectiveFee = feeWaived ? 0 : card.annual_fee;
      const netAnnualSavings = Math.round(grossAnnualValue - effectiveFee);

      let score = Math.min(60, Math.round((netAnnualSavings / Math.max(1, annualSpend)) * 1200));
      if (input.preferredBanks.length === 0 || input.preferredBanks.includes(card.bank_name)) {
        score += 15;
      }
      if (input.preferNoAnnualFee && card.annual_fee === 0) score += 15;
      if (input.preferCashback && card.card_type === 'Cashback') score += 12;
      if (input.travelSharePct >= 25 && cats.includes('travel')) score += 10;
      if (input.fuelSharePct >= 15 && cats.includes('fuel')) score += 10;

      const reasons: string[] = [];
      if (card.annual_fee === 0) reasons.push('Zero annual fee (Lifetime Free)');
      if (feeWaived && card.annual_fee > 0) reasons.push('Estimated fee waiver threshold reached on projected spend');
      if (input.preferredBanks.includes(card.bank_name)) reasons.push(`Matches your preferred bank (${card.bank_name})`);
      if (input.shoppingSharePct >= 25 && cats.includes('shopping')) reasons.push('Strong accelerated returns on online shopping');
      if (input.travelSharePct >= 20 && cats.includes('travel')) reasons.push('High travel & airport lounge value');
      if (input.diningSharePct >= 15 && cats.includes('dining')) reasons.push('Elevated dining & food delivery rewards');
      if (input.fuelSharePct >= 10 && cats.includes('fuel')) reasons.push('High value-back & surcharge waiver on fuel');
      if (reasons.length === 0) reasons.push(`All-round ${card.card_type.toLowerCase()} rewards profile`);

      return {
        ...card,
        matchScore: Math.max(10, Math.min(99, score)),
        grossAnnualValue,
        effectiveAnnualFee: effectiveFee,
        estimatedNetAnnualSavings: netAnnualSavings,
        reasons,
        assumptions: [
          `Estimate only — actual eligibility and issuer approval depend on bank underwriting`,
          `Projected annual spend: ₹${annualSpend.toLocaleString('en-IN')} across your category mix`,
          feeWaived
            ? `Assumes ₹${card.annual_fee.toLocaleString('en-IN')} annual fee waiver on ₹2.5L+ annual spend`
            : `Deducts ₹${card.annual_fee.toLocaleString('en-IN')} annual fee from estimated gross rewards`,
        ],
      };
    })
    .sort((a, b) => b.estimatedNetAnnualSavings - a.estimatedNetAnnualSavings);
}

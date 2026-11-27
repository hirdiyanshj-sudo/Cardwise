import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(amount: number | string | null | undefined, compact = false): string {
  const num = Number(amount || 0);
  if (compact && Math.abs(num) >= 100000) {
    return `₹${(num / 100000).toFixed(2)}L`;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: num % 1 === 0 ? 0 : 2,
  }).format(num);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr.slice(0, 10));
  const today = new Date(new Date().toISOString().slice(0, 10));
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export const INDIAN_BANKS = [
  'HDFC Bank',
  'ICICI Bank',
  'SBI Card',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'IDFC FIRST Bank',
  'IndusInd Bank',
  'American Express',
  'AU Small Finance Bank',
  'Yes Bank',
  'Federal Bank',
];

export const SPENDING_CATEGORIES = [
  'Shopping',
  'Food and Dining',
  'Travel',
  'Fuel',
  'Entertainment',
  'Groceries',
  'Bills and Utilities',
  'Healthcare',
  'Education',
  'Other expenses',
];

export const CARD_THEMES: Record<string, string> = {
  'navy-gold': 'from-[#0B1736] via-[#13295B] to-[#1E3A8A] border-amber-400/30',
  'obsidian-amber': 'from-[#111827] via-[#1F2937] to-[#374151] border-amber-500/35',
  'cobalt-cyan': 'from-[#0F2942] via-[#144272] to-[#0E7490] border-cyan-400/30',
  'midnight-teal': 'from-[#0B1F2A] via-[#113946] to-[#0F766E] border-teal-400/30',
  'royal-indigo': 'from-[#1E1B4B] via-[#312E81] to-[#4338CA] border-indigo-400/30',
  'crimson-obsidian': 'from-[#2A0A12] via-[#4C0519] to-[#881337] border-rose-400/30',
  'emerald-slate': 'from-[#06281E] via-[#064E3B] to-[#047857] border-emerald-400/30',
};

import { Wifi } from 'lucide-react';
import { CARD_THEMES, cn, formatINR } from '../../lib/utils';
import type { CreditCard } from '../../lib/types';

function BankMonogram({ bankName }: { bankName: string }) {
  const short = bankName.slice(0, 2).toUpperCase();
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/15 text-[10px] font-extrabold tracking-tight text-white border border-white/20">
      {short}
    </span>
  );
}

function NetworkEmblem({ network }: { network: CreditCard['card_network'] }) {
  if (network === 'Mastercard') {
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex items-center">
          <span className="h-4 w-4 rounded-full bg-rose-500/90" />
          <span className="h-4 w-4 -ml-2 rounded-full bg-amber-400/90" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/95">Mastercard</span>
      </div>
    );
  }
  if (network === 'RuPay') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-1.5 rounded-sm bg-orange-400" />
        <span className="h-2.5 w-1.5 -ml-1 rounded-sm bg-emerald-400" />
        <span className="text-xs font-extrabold italic tracking-wide text-white">RuPay</span>
      </div>
    );
  }
  if (network === 'American Express') {
    return (
      <span className="rounded bg-sky-400/25 border border-sky-300/40 px-1.5 py-0.5 text-[10px] font-extrabold tracking-widest text-sky-100">
        AMEX
      </span>
    );
  }
  return <span className="text-sm font-black italic tracking-wider text-white">VISA</span>;
}

export function VirtualCard({
  card,
  onClick,
  compact = false,
}: {
  card: CreditCard;
  onClick?: () => void;
  compact?: boolean;
}) {
  const themeClass = CARD_THEMES[card.card_color_theme || 'navy-gold'] || CARD_THEMES['navy-gold'];
  const utilPct =
    card.utilisation_pct ?? Math.round((card.used_credit_limit / Math.max(1, card.credit_limit)) * 100);

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-gradient-to-br text-white shadow-xl transition-all duration-300 card-shine',
        themeClass,
        onClick && 'cursor-pointer hover:-translate-y-1 hover:shadow-2xl',
        compact ? 'p-4' : 'p-5 min-h-[210px] flex flex-col justify-between'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <BankMonogram bankName={card.bank_name} />
          <div>
            <p className="text-[11px] uppercase tracking-widest text-white/75 font-semibold">
              {card.bank_name}
            </p>
            <p className="text-base font-bold tracking-tight mt-0.5 leading-snug">{card.card_name}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="whitespace-nowrap rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-semibold backdrop-blur-sm">
            {card.card_type}
          </span>
          {card.is_demo && (
            <span className="whitespace-nowrap rounded-full bg-amber-400/25 border border-amber-300/40 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
              DEMO
            </span>
          )}
        </div>
      </div>

      <div className="my-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-7 w-10 rounded-md bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500 opacity-90 shadow-inner" />
          <Wifi className="h-4 w-4 rotate-90 text-white/70" />
        </div>
        <span
          className={cn(
            'text-[11px] px-2 py-0.5 rounded-full font-medium',
            card.card_status === 'Active'
              ? 'bg-emerald-400/20 text-emerald-200'
              : 'bg-rose-400/25 text-rose-200'
          )}
        >
          {card.card_status}
        </span>
      </div>

      <div>
        <p className="whitespace-nowrap font-mono text-sm sm:text-base tracking-[0.15em] text-white/90">
          •••• &nbsp;•••• &nbsp;•••• &nbsp;{card.last_four_digits}
        </p>

        <div className="mt-3 flex items-end justify-between text-xs">
          <div>
            <p className="text-white/60 text-[10px] uppercase">Outstanding</p>
            <p className="font-semibold text-sm">{formatINR(card.outstanding_balance)}</p>
          </div>
          <div>
            <p className="text-white/60 text-[10px] uppercase">Utilised</p>
            <p className={cn('font-semibold text-sm', utilPct > 30 ? 'text-amber-300' : 'text-emerald-300')}>
              {utilPct.toFixed(1)}%
            </p>
          </div>
          <div className="text-right">
            <NetworkEmblem network={card.card_network} />
          </div>
        </div>
      </div>
    </div>
  );
}

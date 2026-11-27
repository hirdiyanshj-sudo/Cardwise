import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { formatDate } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { Button, Card } from '../components/ui';

const EVENT_COLORS: Record<string, string> = {
  statement: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  due_date: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  offer_expiry: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  reward_expiry: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  reminder: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
};

export function CalendarPage() {
  const { toast } = useToast();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'monthly' | 'weekly'>('monthly');
  const [cursor, setCursor] = useState(() => new Date());

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest('/calendar');
        setEvents(res.events || []);
      } catch (err: any) {
        toast(err.message || 'Failed to load calendar', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <LoadingSkeleton rows={2} />;

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const shift = (dir: number) => {
    const next = new Date(cursor);
    if (view === 'monthly') next.setMonth(next.getMonth() + dir);
    else next.setDate(next.getDate() + dir * 7);
    setCursor(next);
  };

  // Weekly dates around cursor
  const startOfWeek = new Date(cursor);
  startOfWeek.setDate(cursor.getDate() - cursor.getDay());
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const eventsForDate = (isoDate: string) => events.filter((e) => e.date?.slice(0, 10) === isoDate);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Payment Calendar</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Statement generation dates, due dates, offer expiries, reward expiries & reminders
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-white dark:bg-slate-900">
            <button
              onClick={() => setView('monthly')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                view === 'monthly' ? 'bg-sky-500 text-white' : 'text-slate-500'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setView('weekly')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                view === 'weekly' ? 'bg-sky-500 text-white' : 'text-slate-500'
              }`}
            >
              Weekly
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => shift(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-bold min-w-[130px] text-center">
            {cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </span>
          <Button variant="outline" size="sm" onClick={() => shift(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {[
          ['statement', 'Statement Date'],
          ['due_date', 'Payment Due'],
          ['reminder', 'Payment Reminder'],
          ['offer_expiry', 'Offer Expiry'],
          ['reward_expiry', 'Reward Expiry'],
        ].map(([k, label]) => (
          <span key={k} className={`rounded-full border px-3 py-1 font-medium ${EVENT_COLORS[k]}`}>
            {label}
          </span>
        ))}
      </div>

      {view === 'monthly' ? (
        <Card className="p-3 sm:p-5 overflow-x-auto">
          <div className="grid grid-cols-7 gap-2 min-w-[640px]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-center text-xs font-bold text-slate-500 pb-2">
                {d}
              </div>
            ))}
            {Array.from({ length: firstDay }).map((_, idx) => (
              <div key={`empty-${idx}`} className="min-h-[92px] rounded-xl bg-slate-50/40 dark:bg-slate-900/30" />
            ))}
            {Array.from({ length: daysInMonth }, (_, idx) => {
              const day = idx + 1;
              const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEvents = eventsForDate(iso);
              const isToday = iso === new Date().toISOString().slice(0, 10);
              return (
                <div
                  key={day}
                  className={`min-h-[92px] rounded-xl border p-2 text-xs ${
                    isToday
                      ? 'border-sky-500 bg-sky-500/10'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50'
                  }`}
                >
                  <div className="font-bold text-slate-700 dark:text-slate-300 mb-1">{day}</div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        title={`${ev.title} - ${ev.subtitle}`}
                        className={`truncate rounded border px-1.5 py-0.5 text-[10px] font-medium ${EVENT_COLORS[ev.type]}`}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-slate-400">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekDays.map((d) => {
            const iso = d.toISOString().slice(0, 10);
            const dayEvents = eventsForDate(iso);
            return (
              <Card key={iso} className="p-3 min-h-[200px]">
                <p className="text-xs font-bold text-sky-400">
                  {d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
                <div className="mt-2 space-y-2">
                  {dayEvents.length === 0 ? (
                    <p className="text-[11px] text-slate-500">No events</p>
                  ) : (
                    dayEvents.map((ev) => (
                      <div key={ev.id} className={`rounded-lg border p-2 text-[11px] ${EVENT_COLORS[ev.type]}`}>
                        <p className="font-semibold">{ev.title}</p>
                        <p className="opacity-80 mt-0.5">{ev.subtitle}</p>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-sky-400" /> Upcoming Timeline
        </h3>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {events.slice(0, 12).map((ev) => (
            <div key={ev.id} className="flex items-center justify-between py-2.5 gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold shrink-0 ${EVENT_COLORS[ev.type]}`}>
                  {ev.type.replace('_', ' ')}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-white truncate">{ev.title}</p>
                  <p className="text-slate-500 truncate">{ev.subtitle}</p>
                </div>
              </div>
              <span className="font-medium text-slate-500 shrink-0">{formatDate(ev.date)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

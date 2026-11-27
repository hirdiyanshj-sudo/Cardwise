import { useEffect, useState } from 'react';
import { Bell, CheckCheck, RefreshCw } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { formatDate } from '../lib/utils';
import type { NotificationItem } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { Badge, Button, Card } from '../components/ui';

export function NotificationsPage() {
  const { toast } = useToast();
  const { refreshMe } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const loadData = async () => {
    try {
      const res = await apiRequest('/notifications');
      setNotifications(res.notifications || []);
      setReminders(res.reminders || []);
    } catch (err: any) {
      toast(err.message || 'Failed to load notifications', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const markRead = async (id: string) => {
    await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    refreshMe();
  };

  const markAllRead = async () => {
    await apiRequest('/notifications/read-all', { method: 'POST' });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast('All notifications marked read', 'success');
    refreshMe();
  };

  const triggerReminderCheck = async () => {
    try {
      const res = await apiRequest('/notifications/check-reminders', { method: 'POST' });
      toast(res.message, 'info');
      if (res.createdReminders > 0 && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('CardWise Payment Reminder', { body: res.message });
      }
      loadData();
      refreshMe();
    } catch (err: any) {
      toast(err.message || 'Check failed', 'error');
    }
  };

  const requestBrowserPush = async () => {
    if (!('Notification' in window)) {
      toast('Browser notifications are not supported in this browser.', 'warning');
      return;
    }
    const perm = await Notification.requestPermission();
    toast(`Browser notification permission: ${perm}`, perm === 'granted' ? 'success' : 'warning');
  };

  if (loading) return <LoadingSkeleton rows={2} />;

  const visible = filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notifications Centre</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Bill reminders, utilisation alerts, unusual spend warnings & confirmations
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={requestBrowserPush}>
            Enable Browser Alerts
          </Button>
          <Button variant="outline" size="sm" onClick={triggerReminderCheck}>
            <RefreshCw className="h-3.5 w-3.5" /> Run Due Check
          </Button>
          <Button size="sm" onClick={markAllRead}>
            <CheckCheck className="h-3.5 w-3.5" /> Mark All Read
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant={filter === 'all' ? 'primary' : 'outline'} onClick={() => setFilter('all')}>
          All ({notifications.length})
        </Button>
        <Button size="sm" variant={filter === 'unread' ? 'primary' : 'outline'} onClick={() => setFilter('unread')}>
          Unread ({notifications.filter((n) => !n.is_read).length})
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-3">
          {visible.length === 0 ? (
            <Card className="p-8 text-center text-sm text-slate-500">
              No notifications in this view.
            </Card>
          ) : (
            visible.map((n) => (
              <Card
                key={n.id}
                className={`p-4 flex items-start justify-between gap-4 ${
                  !n.is_read ? 'border-sky-500/40 bg-sky-500/5' : 'opacity-80'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant={
                        n.severity === 'danger'
                          ? 'danger'
                          : n.severity === 'warning'
                            ? 'warning'
                            : n.severity === 'success'
                              ? 'success'
                              : 'info'
                      }
                    >
                      {n.type.replace(/_/g, ' ')}
                    </Badge>
                    {!n.is_read && <span className="h-2 w-2 rounded-full bg-sky-400" />}
                    <span className="text-[11px] text-slate-500">{formatDate(n.created_at)}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{n.title}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{n.message}</p>
                </div>
                {!n.is_read && (
                  <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>
                    Mark read
                  </Button>
                )}
              </Card>
            ))
          )}
        </div>

        <Card className="h-fit">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-400" />
            Automated Reminder Log
          </h3>
          <p className="text-[11px] text-slate-500 mb-3">
            Reminders trigger 7 days, 3 days, 1 day before due date, on due date, and while overdue.
          </p>
          <div className="space-y-2.5 text-xs">
            {reminders.length === 0 ? (
              <p className="text-slate-500">No reminders triggered yet.</p>
            ) : (
              reminders.map((r) => (
                <div key={r.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-2.5">
                  <p className="font-semibold">{r.bank_name} • {r.card_name}</p>
                  <p className="text-slate-500 mt-0.5">
                    Stage: {r.reminder_stage.replace(/_/g, ' ')} • Due {formatDate(r.due_date)}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

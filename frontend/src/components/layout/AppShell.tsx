import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CreditCard,
  ReceiptText,
  ArrowLeftRight,
  Tag,
  Gift,
  Scale,
  BarChart3,
  CalendarDays,
  Bell,
  Settings,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { Badge } from '../ui';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/cards', label: 'My Credit Cards', icon: CreditCard },
  { to: '/bills', label: 'Bills and Payments', icon: ReceiptText },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/offers', label: 'Offers and Deals', icon: Tag },
  { to: '/rewards', label: 'Rewards', icon: Gift },
  { to: '/compare', label: 'Compare Cards', icon: Scale },
  { to: '/analytics', label: 'Spending Analytics', icon: BarChart3 },
  { to: '/calendar', label: 'Payment Calendar', icon: CalendarDays },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings', label: 'Profile and Settings', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, unreadNotifications, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  const navLinks =
    user?.role === 'admin'
      ? [...NAV_ITEMS, { to: '/admin', label: 'Admin Console', icon: ShieldAlert }]
      : NAV_ITEMS;

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-[#081020] text-slate-200 border-r border-slate-800/80">
      <div>
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 shadow-lg shadow-sky-500/25">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-display text-lg font-extrabold tracking-tight text-white">
                CardWise
              </span>
              <p className="text-[10px] uppercase tracking-widest text-sky-400 font-semibold">
                India Fintech
              </p>
            </div>
          </div>
          <button
            className="lg:hidden text-slate-400 hover:text-white"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-170px)]">
          {navLinks.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-gradient-to-r from-sky-500/20 to-indigo-500/15 text-sky-300 border border-sky-500/30 shadow-sm'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
                  )
                }
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.to === '/notifications' && unreadNotifications > 0 && (
                  <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {unreadNotifications}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-800/80 space-y-3">
        <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-white truncate">{user?.fullName}</p>
            {user?.role === 'admin' && <Badge variant="danger">ADMIN</Badge>}
          </div>
          <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/50 py-2 text-xs font-semibold text-slate-300 hover:bg-rose-500/15 hover:text-rose-300 hover:border-rose-500/30 transition"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#070D19]">
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">{sidebarContent}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="relative w-68 max-w-[80vw] h-full z-10">{sidebarContent}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-[#0B1426]/85 px-4 sm:px-6 py-3 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden rounded-xl p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 flex-wrap">
              {user?.isDemoAccount && (
                <Badge variant="warning">Demo Account • Sample Indian Banking Data</Badge>
              )}
              {user && !user.emailVerified && (
                <button onClick={() => navigate('/settings')}>
                  <Badge variant="info">Email Unverified • Verify in Settings</Badge>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="rounded-xl border border-slate-200 dark:border-slate-700/80 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label="Toggle color theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => navigate('/notifications')}
              className="relative rounded-xl border border-slate-200 dark:border-slate-700/80 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {unreadNotifications}
                </span>
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}

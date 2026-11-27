import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AppShell } from './components/layout/AppShell';
import { LoadingSkeleton } from './components/common/LoadingSkeleton';

import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { CardsPage } from './pages/CardsPage';
import { BillsPage } from './pages/BillsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { OffersPage } from './pages/OffersPage';
import { RewardsPage } from './pages/RewardsPage';
import { ComparePage } from './pages/ComparePage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { CalendarPage } from './pages/CalendarPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminPage } from './pages/AdminPage';

function ProtectedApp({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#070D19] p-8">
        <LoadingSkeleton rows={3} />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <AppShell>{children}</AppShell>;
}

function AdminOnlyApp({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#070D19] p-8">
        <LoadingSkeleton rows={3} />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return <AppShell>{children}</AppShell>;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/" element={<ProtectedApp><DashboardPage /></ProtectedApp>} />
      <Route path="/cards" element={<ProtectedApp><CardsPage /></ProtectedApp>} />
      <Route path="/bills" element={<ProtectedApp><BillsPage /></ProtectedApp>} />
      <Route path="/transactions" element={<ProtectedApp><TransactionsPage /></ProtectedApp>} />
      <Route path="/offers" element={<ProtectedApp><OffersPage /></ProtectedApp>} />
      <Route path="/rewards" element={<ProtectedApp><RewardsPage /></ProtectedApp>} />
      <Route path="/compare" element={<ProtectedApp><ComparePage /></ProtectedApp>} />
      <Route path="/analytics" element={<ProtectedApp><AnalyticsPage /></ProtectedApp>} />
      <Route path="/calendar" element={<ProtectedApp><CalendarPage /></ProtectedApp>} />
      <Route path="/notifications" element={<ProtectedApp><NotificationsPage /></ProtectedApp>} />
      <Route path="/settings" element={<ProtectedApp><SettingsPage /></ProtectedApp>} />
      <Route path="/admin" element={<AdminOnlyApp><AdminPage /></AdminOnlyApp>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

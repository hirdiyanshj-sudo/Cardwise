import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, setCachedCsrfToken } from '../lib/api';
import type { User, UserPreferences } from '../lib/types';

interface ServerCapabilities {
  googleOAuthConfigured: boolean;
  smtpConfigured: boolean;
  nodeEnv: string;
}

interface AuthContextValue {
  user: User | null;
  profile: Record<string, any> | null;
  preferences: UserPreferences | null;
  capabilities: ServerCapabilities;
  unreadNotifications: number;
  loading: boolean;
  refreshMe: () => Promise<void>;
  completeAuth: (csrfToken?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Record<string, any> | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [capabilities, setCapabilities] = useState<ServerCapabilities>({
    googleOAuthConfigured: false,
    smtpConfigured: false,
    nodeEnv: 'development',
  });
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const data = await apiRequest('/auth/me');
      setUser(data.user);
      setProfile(data.profile);
      setPreferences(data.preferences);
      if (data.capabilities) setCapabilities(data.capabilities);
      setUnreadNotifications(data.unreadNotifications || 0);
    } catch {
      setUser(null);
      setProfile(null);
      setPreferences(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Clean up any legacy token from older versions
    localStorage.removeItem('cardwise_token');
    refreshMe();
  }, [refreshMe]);

  const completeAuth = async (csrfToken?: string) => {
    if (csrfToken) setCachedCsrfToken(csrfToken);
    await refreshMe();
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // ignore if session already expired
    }
    setUser(null);
    setProfile(null);
    setPreferences(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        preferences,
        capabilities,
        unreadNotifications,
        loading,
        refreshMe,
        completeAuth,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

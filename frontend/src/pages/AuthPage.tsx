import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, Mail, User, Phone, KeyRound, Sparkles, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button, Card, Input, Badge } from '../components/ui';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset' | 'verify' | 'mfa';

export function AuthPage() {
  const { completeAuth } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthMode>('login');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [loadDemoData, setLoadDemoData] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [devHelperToken, setDevHelperToken] = useState<string | null>(null);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vToken = params.get('verifyToken');
    if (vToken) {
      setTokenInput(vToken);
      setMode('verify');
    }
  }, []);

  useEffect(() => {
    if (!googleClientId || mode !== 'login') return;
    const scriptId = 'google-gsi-client';
    if (!document.getElementById(scriptId)) {
      const s = document.createElement('script');
      s.id = scriptId;
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => initGoogleButton();
      document.body.appendChild(s);
    } else {
      initGoogleButton();
    }

    function initGoogleButton() {
      const g = (window as any).google;
      const target = document.getElementById('google-signin-btn');
      if (!g?.accounts?.id || !target) return;
      g.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response: any) => {
          setBusy(true);
          try {
            const res = await apiRequest('/auth/google', {
              method: 'POST',
              body: JSON.stringify({ idToken: response.credential }),
            });
            await completeAuth(res.csrfToken);
            toast('Signed in with Google', 'success');
            navigate('/');
          } catch (err: any) {
            toast(err.message || 'Google sign-in failed', 'error');
          } finally {
            setBusy(false);
          }
        },
      });
      g.accounts.id.renderButton(target, { theme: 'filled_black', size: 'large', width: 220 });
    }
  }, [googleClientId, mode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (res.mfaRequired) {
        setMfaToken(res.mfaToken);
        setMode('mfa');
        toast('Enter your 6-digit authenticator code', 'info');
        return;
      }
      await completeAuth(res.csrfToken);
      toast('Welcome back to CardWise', 'success');
      navigate('/');
    } catch (err: any) {
      toast(err.message || 'Login failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ fullName, email, mobileNumber, password, loadDemoData }),
      });
      await completeAuth(res.csrfToken);
      toast('Account created securely with HttpOnly session cookies', 'success');
      navigate('/');
    } catch (err: any) {
      toast(err.message || 'Registration failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDemoLogin = async () => {
    setBusy(true);
    try {
      const res = await apiRequest('/auth/demo-login', { method: 'POST' });
      await completeAuth(res.csrfToken);
      toast('Signed into Demo Account (Sample Indian Banking Data)', 'info');
      navigate('/');
    } catch (err: any) {
      toast(err.message || 'Demo login failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDevGoogleSignIn = async () => {
    setBusy(true);
    try {
      const targetEmail = email || 'google.user@cardwise.in';
      const targetName = fullName || 'Priya Nair';
      const res = await apiRequest('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ email: targetEmail, fullName: targetName }),
      });
      await completeAuth(res.csrfToken);
      toast('Signed in (Dev Google OAuth)', 'success');
      navigate('/');
    } catch (err: any) {
      toast(err.message || 'Google authentication failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiRequest('/auth/mfa/verify-login', {
        method: 'POST',
        body: JSON.stringify({ mfaToken, code: mfaCode }),
      });
      await completeAuth(res.csrfToken);
      toast('MFA verified. Welcome back!', 'success');
      navigate('/');
    } catch (err: any) {
      toast(err.message || 'Invalid MFA code', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      if (res.resetTokenDev) {
        setDevHelperToken(res.resetTokenDev);
        setTokenInput(res.resetTokenDev);
      }
      toast(res.message, 'info');
      setMode('reset');
    } catch (err: any) {
      toast(err.message || 'Request failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: tokenInput, newPassword }),
      });
      toast(res.message, 'success');
      setDevHelperToken(null);
      setMode('login');
    } catch (err: any) {
      toast(err.message || 'Reset failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiRequest('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token: tokenInput }),
      });
      toast('Email verified! You can now sign in.', 'success');
      setMode('login');
    } catch (err: any) {
      toast(err.message || 'Verification failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#070D19] text-slate-100">
      <div className="lg:w-1/2 relative overflow-hidden p-8 sm:p-12 lg:p-16 flex flex-col justify-between bg-gradient-to-br from-[#081226] via-[#0E1E3F] to-[#0B2A4A] border-b lg:border-b-0 lg:border-r border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-600 shadow-lg shadow-sky-500/30">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-white">CardWise</h1>
            <p className="text-xs uppercase tracking-widest text-sky-400 font-semibold">
              Smart Credit Card Manager
            </p>
          </div>
        </div>

        <div className="my-10 space-y-6 max-w-lg">
          <Badge variant="info">Built for Indian Credit Cardholders</Badge>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold leading-tight text-white">
            Every Indian bank card, bill, reward & offer in one private vault.
          </h2>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Monitor credit limits, stay under 30% utilisation, never miss a due date, compare cards across 11 Indian banks, and analyse spending with downloadable PDF & CSV reports.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {[
              'HttpOnly cookie auth, CSRF protection & rotating refresh tokens',
              'Zero CVV, PIN, OTP, or full card numbers stored',
              'TOTP Multi-Factor Authentication & session revocation',
              'Bank-specific billing rules & automated due reminders',
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 rounded-xl bg-white/5 border border-white/10 p-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-200">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Privacy Notice: CardWise never stores authentication secrets in browser localStorage and never collects CVV, ATM PIN, OTP, or full 16-digit card numbers.
        </p>
      </div>

      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <Card className="w-full max-w-md bg-[#0E182D] border-slate-800 p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">
                {mode === 'login' && 'Sign in to CardWise'}
                {mode === 'register' && 'Create your private account'}
                {mode === 'forgot' && 'Reset your password'}
                {mode === 'reset' && 'Set a new password'}
                {mode === 'verify' && 'Verify your email'}
                {mode === 'mfa' && 'Two-Factor Verification'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {mode === 'login' && 'Access your isolated personal credit card dashboard'}
                {mode === 'register' && 'Start tracking cards, bills, and rewards securely'}
                {mode === 'mfa' && 'Enter the 6-digit code from your authenticator app'}
              </p>
            </div>
            <Lock className="h-5 w-5 text-sky-400" />
          </div>

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300">Email Address</label>
                <div className="relative mt-1">
                  <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-9"
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium text-slate-300">Password</label>
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-xs text-sky-400 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1"
                />
              </div>

              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Signing in...' : 'Sign In'}
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-800" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#0E182D] px-2 text-slate-500">or continue with</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
                {googleClientId ? (
                  <div id="google-signin-btn" className="min-h-[40px]" />
                ) : (
                  !import.meta.env.PROD && (
                    <Button type="button" variant="outline" onClick={handleDevGoogleSignIn} disabled={busy} className="w-full sm:w-auto flex-1">
                      Google Sign-In (Dev)
                    </Button>
                  )
                )}
                <Button type="button" variant="secondary" onClick={handleDemoLogin} disabled={busy} className="w-full sm:w-auto flex-1">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  Try Demo Account
                </Button>
              </div>
              <p className="text-[11px] text-slate-400 text-center">
                Demo: <code className="text-sky-300">demo@cardwise.in</code> / <code className="text-sky-300">CardWise@2026</code>
              </p>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="text-xs font-medium text-slate-300">Full Name</label>
                <div className="relative mt-1">
                  <User className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                  <Input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Rohan Mehta"
                    className="pl-9"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-300">Email Address</label>
                <div className="relative mt-1">
                  <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="rohan@example.com"
                    className="pl-9"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-300">Mobile Number (India)</label>
                <div className="relative mt-1">
                  <Phone className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                  <Input
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="pl-9"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-300">Password (min 8 chars)</label>
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="mt-1"
                />
              </div>

              <label className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/60 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={loadDemoData}
                  onChange={(e) => setLoadDemoData(e.target.checked)}
                  className="rounded border-slate-600 text-sky-500"
                />
                <span className="text-xs text-slate-300">
                  Pre-load sample Indian bank demo cards (optional; clearly marked Demo)
                </span>
              </label>

              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>
          )}

          {mode === 'mfa' && (
            <form onSubmit={handleMfaVerify} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300">6-Digit Code or Backup Code</label>
                <div className="relative mt-1">
                  <KeyRound className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                  <Input
                    required
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    placeholder="123456"
                    className="pl-9 tracking-widest font-mono"
                  />
                </div>
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                Verify & Sign In
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMode('login')} className="w-full">
                Back to Sign In
              </Button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300">Account Email</label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1"
                />
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                Send Reset Token
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMode('login')} className="w-full">
                Back to Sign In
              </Button>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleReset} className="space-y-4">
              {devHelperToken && (
                <div className="rounded-xl bg-sky-500/10 border border-sky-500/30 p-3 text-xs text-sky-200">
                  Dev Preview Reset Token auto-filled: <code className="break-all">{devHelperToken}</code>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-slate-300">Reset Token</label>
                <Input
                  required
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="mt-1 font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-300">New Password</label>
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                Update Password
              </Button>
            </form>
          )}

          {mode === 'verify' && (
            <form onSubmit={handleVerifyEmail} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300">Email Verification Token</label>
                <Input
                  required
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Paste verification token"
                  className="mt-1 font-mono text-xs"
                />
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                Verify Email
              </Button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            {mode === 'login' ? (
              <>
                <span>New to CardWise?</span>
                <button onClick={() => setMode('register')} className="text-sky-400 font-semibold hover:underline">
                  Create Account
                </button>
              </>
            ) : (
              <>
                <span>Already have an account?</span>
                <button onClick={() => setMode('login')} className="text-sky-400 font-semibold hover:underline">
                  Sign In
                </button>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

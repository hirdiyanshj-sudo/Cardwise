import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Key,
  Smartphone,
  Download,
  Trash2,
  MailCheck,
  Monitor,
  History,
} from 'lucide-react';
import { apiRequest, downloadProtectedFile } from '../lib/api';
import { formatDate } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Badge, Button, Card, ConfirmDialog, Input, Modal, Select } from '../components/ui';

export function SettingsPage() {
  const { user, profile, preferences, capabilities, refreshMe, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [profForm, setProfForm] = useState({
    fullName: user?.fullName || '',
    mobileNumber: user?.mobileNumber || '',
    city: profile?.city || 'Bengaluru',
    monthlyIncomeBracket: profile?.monthlyIncomeBracket || '100000-200000',
    creditScoreSelfReported: profile?.creditScoreSelfReported || '',
    privacyAnalyticsOptIn: profile?.privacyAnalyticsOptIn ?? true,
    privacyMarketingOptIn: profile?.privacyMarketingOptIn ?? false,
  });

  const [prefForm, setPrefForm] = useState({
    timezone: preferences?.timezone || 'Asia/Kolkata',
    notifyInApp: preferences?.notifyInApp ?? true,
    notifyEmail: preferences?.notifyEmail ?? true,
    notifyBrowser: preferences?.notifyBrowser ?? true,
    notifySms: preferences?.notifySms ?? false,
    remind7Days: preferences?.remind7Days ?? true,
    remind3Days: preferences?.remind3Days ?? true,
    remind1Day: preferences?.remind1Day ?? true,
    remindDueDate: preferences?.remindDueDate ?? true,
    remindOverdue: preferences?.remindOverdue ?? true,
    utilisationAlertThreshold: preferences?.utilisationAlertThreshold ?? 30,
  });

  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '' });
  const [verifyToken, setVerifyToken] = useState('');
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; otpauthUri: string; backupCodes: string[] } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [disableMfaOpen, setDisableMfaOpen] = useState(false);
  const [disableMfaPwd, setDisableMfaPwd] = useState('');
  const [revokeSessionId, setRevokeSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [emailPreviews, setEmailPreviews] = useState<any[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState({ password: '', confirmText: '' });

  const loadSecurityData = async () => {
    try {
      const [sRes, aRes, eRes] = await Promise.all([
        apiRequest('/auth/sessions'),
        apiRequest('/auth/audit-logs'),
        apiRequest('/auth/email-previews'),
      ]);
      setSessions(sRes.sessions || []);
      setAuditLogs(aRes.logs || []);
      setEmailPreviews(eRes.emails || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadSecurityData();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          ...profForm,
          creditScoreSelfReported: profForm.creditScoreSelfReported ? Number(profForm.creditScoreSelfReported) : undefined,
        }),
      });
      toast('Profile and privacy settings saved', 'success');
      refreshMe();
    } catch (err: any) {
      toast(err.message || 'Save failed', 'error');
    }
  };

  const handleSavePreferences = async () => {
    try {
      await apiRequest('/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify(prefForm),
      });
      toast('Reminder preferences updated', 'success');
      refreshMe();
    } catch (err: any) {
      toast(err.message || 'Update failed', 'error');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(pwdForm),
      });
      toast('Password updated and other sessions revoked', 'success');
      setPwdForm({ currentPassword: '', newPassword: '' });
      loadSecurityData();
    } catch (err: any) {
      toast(err.message || 'Password change failed', 'error');
    }
  };

  const handleResendVerify = async () => {
    try {
      const res = await apiRequest('/auth/resend-verification', { method: 'POST' });
      if (res.verificationTokenDev) setVerifyToken(res.verificationTokenDev);
      toast(res.message || 'Verification email requested', 'info');
      loadSecurityData();
    } catch (err: any) {
      toast(err.message || 'Failed', 'error');
    }
  };

  const handleVerifyEmail = async () => {
    try {
      await apiRequest('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token: verifyToken }),
      });
      toast('Email verified!', 'success');
      refreshMe();
    } catch (err: any) {
      toast(err.message || 'Invalid verification token', 'error');
    }
  };

  const handleStartMfa = async () => {
    try {
      const res = await apiRequest('/auth/mfa/setup', { method: 'POST' });
      setMfaSetup(res);
    } catch (err: any) {
      toast(err.message || 'MFA setup failed', 'error');
    }
  };

  const handleEnableMfa = async () => {
    try {
      await apiRequest('/auth/mfa/enable', {
        method: 'POST',
        body: JSON.stringify({ code: mfaCode }),
      });
      toast('Two-factor authentication enabled!', 'success');
      setMfaSetup(null);
      setMfaCode('');
      refreshMe();
    } catch (err: any) {
      toast(err.message || 'Verification failed', 'error');
    }
  };

  const handleDisableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/auth/mfa/disable', {
        method: 'POST',
        body: JSON.stringify({ password: disableMfaPwd }),
      });
      toast('MFA disabled', 'info');
      setDisableMfaOpen(false);
      setDisableMfaPwd('');
      refreshMe();
    } catch (err: any) {
      toast(err.message || 'Failed to disable MFA', 'error');
    }
  };

  const confirmRevokeSession = async () => {
    if (!revokeSessionId) return;
    await apiRequest(`/auth/sessions/${revokeSessionId}`, { method: 'DELETE' });
    toast('Session revoked', 'info');
    loadSecurityData();
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/auth/account', {
        method: 'DELETE',
        body: JSON.stringify(deleteConfirm),
      });
      toast('Account permanently deleted', 'info');
      await logout();
      navigate('/auth');
    } catch (err: any) {
      toast(err.message || 'Account deletion failed', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Profile, Privacy & Security Centre</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Manage profile, consent, MFA, active sessions, reminder schedules & personal data export
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <h2 className="text-base font-bold mb-4">Profile & Consent Settings</h2>
          <form onSubmit={handleSaveProfile} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Full Name</label>
                <Input value={profForm.fullName} onChange={(e) => setProfForm({ ...profForm, fullName: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Mobile Number</label>
                <Input value={profForm.mobileNumber} onChange={(e) => setProfForm({ ...profForm, mobileNumber: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-slate-500">City</label>
                <Input value={profForm.city} onChange={(e) => setProfForm({ ...profForm, city: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Self-Reported CIBIL / Credit Score</label>
                <Input type="number" min={300} max={900} value={profForm.creditScoreSelfReported} onChange={(e) => setProfForm({ ...profForm, creditScoreSelfReported: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500">Monthly Income Bracket (₹)</label>
              <Select value={profForm.monthlyIncomeBracket} onChange={(e) => setProfForm({ ...profForm, monthlyIncomeBracket: e.target.value })} className="mt-1">
                <option value="25000-50000">₹25,000 – ₹50,000</option>
                <option value="50000-100000">₹50,000 – ₹1,00,000</option>
                <option value="100000-200000">₹1,00,000 – ₹2,00,000</option>
                <option value="200000-500000">₹2,00,000 – ₹5,00,000</option>
                <option value="500000+">₹5,00,000+</option>
              </Select>
            </div>
            <div className="space-y-2 text-xs pt-1">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={profForm.privacyAnalyticsOptIn} onChange={(e) => setProfForm({ ...profForm, privacyAnalyticsOptIn: e.target.checked })} />
                Consent to private spending analytics & card recommendations
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={profForm.privacyMarketingOptIn} onChange={(e) => setProfForm({ ...profForm, privacyMarketingOptIn: e.target.checked })} />
                Receive bank offer digest notifications
              </label>
            </div>
            <Button type="submit">Save Profile & Consent</Button>
          </form>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold">Payment Reminder Preferences</h2>
            <Badge variant={capabilities.smtpConfigured ? 'success' : 'warning'}>
              {capabilities.smtpConfigured ? 'SMTP Active' : 'SMTP Unconfigured'}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-2">
              <p className="font-semibold text-slate-500 uppercase">Channels</p>
              {[
                ['notifyInApp', 'In-App Notifications'],
                ['notifyEmail', 'Email Notifications'],
                ['notifyBrowser', 'Browser Push Alerts'],
                ['notifySms', 'Optional SMS Alerts'],
              ].map(([k, label]) => (
                <label key={k} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={(prefForm as any)[k]}
                    onChange={(e) => setPrefForm({ ...prefForm, [k]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-slate-500 uppercase">Schedule</p>
              {[
                ['remind7Days', '7 days before due date'],
                ['remind3Days', '3 days before due date'],
                ['remind1Day', '1 day before due date'],
                ['remindDueDate', 'On the due date'],
                ['remindOverdue', 'After due date if unpaid'],
              ].map(([k, label]) => (
                <label key={k} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={(prefForm as any)[k]}
                    onChange={(e) => setPrefForm({ ...prefForm, [k]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">Utilisation Alert (%)</label>
              <Input
                type="number"
                min={10}
                max={95}
                value={prefForm.utilisationAlertThreshold}
                onChange={(e) => setPrefForm({ ...prefForm, utilisationAlertThreshold: Number(e.target.value) })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Timezone</label>
              <Select
                value={prefForm.timezone}
                onChange={(e) => setPrefForm({ ...prefForm, timezone: e.target.value })}
                className="mt-1"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                <option value="UTC">UTC</option>
                <option value="Europe/London">Europe/London</option>
                <option value="America/New_York">America/New_York</option>
              </Select>
            </div>
          </div>
          <Button onClick={handleSavePreferences} className="mt-4">Save Preferences</Button>
        </Card>
      </div>

      {/* Security: Verification, Password & MFA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card>
          <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
            <MailCheck className="h-4 w-4 text-sky-400" /> Email Verification
          </h3>
          <div className="mb-3">
            <Badge variant={user?.emailVerified ? 'success' : 'warning'}>
              {user?.emailVerified ? 'Verified' : 'Unverified'}
            </Badge>
          </div>
          {!user?.emailVerified && (
            <div className="space-y-2.5">
              <Button size="sm" variant="outline" onClick={handleResendVerify}>
                Send Verification Email
              </Button>
              <Input
                placeholder="Paste verification token"
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                className="text-xs font-mono"
              />
              <Button size="sm" onClick={handleVerifyEmail}>Verify Email</Button>
            </div>
          )}
        </Card>

        <Card>
          <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
            <Key className="h-4 w-4 text-sky-400" /> Change Password
          </h3>
          <form onSubmit={handleChangePassword} className="space-y-2.5">
            <Input
              type="password"
              placeholder="Current password"
              value={pwdForm.currentPassword}
              onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
            />
            <Input
              type="password"
              required
              minLength={8}
              placeholder="New password (min 8 chars)"
              value={pwdForm.newPassword}
              onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
            />
            <Button size="sm" type="submit">Update Password</Button>
          </form>
        </Card>

        <Card>
          <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
            <Smartphone className="h-4 w-4 text-emerald-400" /> Multi-Factor Auth (TOTP)
          </h3>
          <div className="mb-3">
            <Badge variant={user?.mfaEnabled ? 'success' : 'outline'}>
              {user?.mfaEnabled ? 'MFA Active' : 'MFA Disabled'}
            </Badge>
          </div>
          {!user?.mfaEnabled && !mfaSetup && (
            <Button size="sm" onClick={handleStartMfa}>Setup Authenticator MFA</Button>
          )}
          {mfaSetup && (
            <div className="space-y-2 text-xs">
              <p className="text-slate-400">Add secret to Google Authenticator / Authy:</p>
              <code className="block rounded bg-slate-900 p-2 text-sky-300 font-mono break-all">
                {mfaSetup.secret}
              </code>
              <p className="text-[11px] text-slate-500">
                Backup codes: {mfaSetup.backupCodes.join(', ')}
              </p>
              <Input
                placeholder="Enter 6-digit code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                className="font-mono"
              />
              <Button size="sm" onClick={handleEnableMfa}>Verify & Enable MFA</Button>
            </div>
          )}
          {user?.mfaEnabled && (
            <Button size="sm" variant="danger" onClick={() => setDisableMfaOpen(true)}>
              Disable MFA
            </Button>
          )}
        </Card>
      </div>

      {/* Sessions + Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
            <Monitor className="h-4 w-4 text-sky-400" /> Active & Recent Sessions
          </h3>
          <div className="space-y-2.5 text-xs">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                <div>
                  <p className="font-semibold">
                    {s.device_label} {s.isCurrent && <Badge variant="success">Current</Badge>}
                    {s.isRevoked && <Badge variant="danger">Revoked</Badge>}
                  </p>
                  <p className="text-slate-500">IP: {s.ip_address} • Last active {formatDate(s.last_active_at)}</p>
                </div>
                {!s.isCurrent && !s.isRevoked && (
                  <Button size="sm" variant="outline" onClick={() => setRevokeSessionId(s.id)}>
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
            <History className="h-4 w-4 text-indigo-400" /> Security Activity Log
          </h3>
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {auditLogs.map((l) => (
              <div key={l.id} className="py-2 flex justify-between gap-2">
                <div>
                  <span className="font-semibold text-sky-400">{l.action}</span>
                  <span className="text-slate-500 ml-2">({l.resource_type})</span>
                </div>
                <span className="text-slate-500">{formatDate(l.created_at)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {emailPreviews.length > 0 && (
        <Card>
          <h3 className="text-sm font-bold mb-2">Recent Email Dispatch Log (Dev Mode)</h3>
          <div className="space-y-2 text-xs">
            {emailPreviews.slice(0, 4).map((e) => (
              <div key={e.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{e.subject}</p>
                  <Badge variant={e.deliveryStatus === 'Delivered' ? 'success' : 'warning'}>
                    {e.deliveryStatus}
                  </Badge>
                </div>
                <div className="text-slate-500 mt-1" dangerouslySetInnerHTML={{ __html: e.body }} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Privacy Disclosure, Data Export & Delete Account */}
      <Card className="border-rose-500/30">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <h3 className="text-base font-bold flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" /> Data Transparency, Export & Account Deletion
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              <strong>What we collect & why:</strong> CardWise collects your name, email, encrypted mobile number, credit card metadata (bank, card name, last 4 digits, limits, due dates), transactions, and reward logs strictly to power your personal credit card dashboard and reminders. We <strong>never</strong> store complete card numbers, CVV, ATM PIN, OTPs, or internet banking passwords.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => downloadProtectedFile('/auth/export-data', 'cardwise-personal-data.json')}
          >
            <Download className="h-4 w-4" /> Export My Data (JSON)
          </Button>
        </div>

        <form onSubmit={handleDeleteAccount} className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-rose-400 font-semibold">Type DELETE to confirm</label>
            <Input
              required
              placeholder="DELETE"
              value={deleteConfirm.confirmText}
              onChange={(e) => setDeleteConfirm({ ...deleteConfirm, confirmText: e.target.value })}
              className="mt-1 w-40"
            />
          </div>
          {!user?.isDemoAccount && (
            <div>
              <label className="text-xs text-slate-400">Password</label>
              <Input
                type="password"
                placeholder="Your password"
                value={deleteConfirm.password}
                onChange={(e) => setDeleteConfirm({ ...deleteConfirm, password: e.target.value })}
                className="mt-1 w-48"
              />
            </div>
          )}
          <Button type="submit" variant="danger">
            <Trash2 className="h-4 w-4" /> Permanently Delete Account
          </Button>
        </form>
      </Card>

      <Modal open={disableMfaOpen} onClose={() => setDisableMfaOpen(false)} title="Disable Two-Factor Auth">
        <form onSubmit={handleDisableMfa} className="space-y-4">
          <p className="text-xs text-slate-400">Confirm your account password to disable TOTP MFA.</p>
          <Input
            type="password"
            required
            placeholder="Your password"
            value={disableMfaPwd}
            onChange={(e) => setDisableMfaPwd(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDisableMfaOpen(false)}>Cancel</Button>
            <Button type="submit" variant="danger">Disable MFA</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(revokeSessionId)}
        onClose={() => setRevokeSessionId(null)}
        onConfirm={confirmRevokeSession}
        title="Revoke Session?"
        message="This device will be signed out immediately and its refresh token family invalidated."
        confirmLabel="Revoke Session"
      />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AdminRow } from '@engine';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { FullPageLoading } from '@/components/common/LoadingSpinner';
import { adminApi } from '@/services/api/adminApi';
import { getSupabase } from '@/services/supabase/client';

export function AdminAuthGate({
  children,
}: {
  children: (admin: AdminRow, onSignOut: () => Promise<void>) => React.ReactNode;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [checking, setChecking] = useState(true);
  const [admin, setAdmin] = useState<AdminRow | null>(null);
  const [isAnonUser, setIsAnonUser] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const sb = getSupabase();

    const verifyCurrentSession = async () => {
      try {
        const { data } = await sb.auth.getUser();
        if (!active) return;
        if (data.user?.is_anonymous) {
          await sb.auth.signOut();
          if (active) {
            setIsAnonUser(false);
            setAdmin(null);
          }
          return;
        }
        setIsAnonUser(false);
        const row = await adminApi.checkIsAdmin();
        if (active) setAdmin(row);
      } catch {
        if (active) setAdmin(null);
      } finally {
        if (active) setChecking(false);
      }
    };

    void verifyCurrentSession();

    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        if (active) setAdmin(null);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        void verifyCurrentSession();
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const row = await adminApi.signIn(email.trim(), password);
      setAdmin(row);
      setIsAnonUser(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setErrorMsg(msg === 'NOT_ADMIN' ? t('admin:auth.notAuthorized') : msg || t('common:app.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await adminApi.signOut();
    setAdmin(null);
  };

  if (checking) {
    return <FullPageLoading message={t('common:app.loading')} />;
  }

  if (admin) {
    return <>{children(admin, handleSignOut)}</>;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-4 text-white">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher dark />
      </div>
      <Card className="w-full max-w-md border-slate-800 bg-white text-slate-900 shadow-2xl">
        <CardContent className="space-y-5 p-7">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">{t('admin:auth.title')}</h1>
              <p className="text-xs text-slate-500">{t('admin:auth.subtitle')}</p>
            </div>
          </div>

          {isAnonUser && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">
              {t('admin:auth.anonWarning')}
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-email">{t('admin:auth.email')}</Label>
              <Input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-password">{t('admin:auth.password')}</Label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={submitting}
              data-testid="admin-login-btn"
            >
              {submitting ? t('admin:auth.signingIn') : t('admin:auth.signIn')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

import { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type AuthMode = 'login' | 'register' | 'forgot';

type AuthForm = {
  email: string;
  password: string;
  name: string;
  handle: string;
};

type AuthShellProps = {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  authForm: AuthForm;
  setAuthForm: (updater: (prev: AuthForm) => AuthForm) => void;
  forgotEmail: string;
  setForgotEmail: (value: string) => void;
  resetToken: string;
  setResetToken: (value: string) => void;
  resetNewPassword: string;
  setResetNewPassword: (value: string) => void;
  resetTokenPreview: string;
  resetTokenExpiresAt: string;
  busy: boolean;
  error: string;
  onAuthSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRequestPasswordReset: (event: FormEvent<HTMLFormElement>) => void;
  onResetPassword: (event: FormEvent<HTMLFormElement>) => void;
};

export function AuthShell({
  mode,
  setMode,
  authForm,
  setAuthForm,
  forgotEmail,
  setForgotEmail,
  resetToken,
  setResetToken,
  resetNewPassword,
  setResetNewPassword,
  resetTokenPreview,
  resetTokenExpiresAt,
  busy,
  error,
  onAuthSubmit,
  onRequestPasswordReset,
  onResetPassword,
}: AuthShellProps) {
  return (
    <main className="auth-shell">
      <section className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col gap-4">

        {/* Brand */}
        <div className="flex flex-col items-center gap-2 text-center">
          <img src="/tincan-logo.svg" alt="Tincan logo" className="w-12 h-12 object-contain" />
          <h1 className="text-xl font-semibold tracking-tight">Tincan</h1>
          <p className="text-sm text-muted-foreground">Private chat for your own people.</p>
        </div>

        {/* ── Forgot / reset ── */}
        {mode === 'forgot' ? (
          <div className="flex flex-col gap-3">
            <form autoComplete="off" onSubmit={onRequestPasswordReset} className="flex flex-col gap-2">
              <Input placeholder="Email" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required />
              <Button disabled={busy} type="submit">Request reset token</Button>
            </form>

            {resetTokenPreview ? (
              <div className="rounded-lg border border-dashed border-border bg-muted p-3 flex flex-col gap-1">
                <strong className="text-xs font-semibold">Recovery token</strong>
                <code className="text-xs break-all text-muted-foreground">{resetTokenPreview}</code>
                {resetTokenExpiresAt && (
                  <span className="text-xs text-muted-foreground">
                    Expires: {new Date(resetTokenExpiresAt).toLocaleString()}
                  </span>
                )}
              </div>
            ) : null}

            <form autoComplete="off" onSubmit={onResetPassword} className="flex flex-col gap-2">
              <Input placeholder="Reset token" value={resetToken} onChange={(e) => setResetToken(e.target.value)} required />
              <Input placeholder="New password" type="password" value={resetNewPassword} onChange={(e) => setResetNewPassword(e.target.value)} required />
              <Button disabled={busy} type="submit">Reset password</Button>
            </form>

            <Button variant="ghost" onClick={() => setMode('login')}>← Back to login</Button>
          </div>

        ) : (
          /* ── Login / register ── */
          <div className="flex flex-col gap-3">
            <form autoComplete="off" onSubmit={onAuthSubmit} className="flex flex-col gap-2">
              {mode === 'register' && (
                <>
                  <Input
                    placeholder="Name"
                    value={authForm.name}
                    onChange={(e) => setAuthForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                  <Input
                    placeholder="Handle"
                    value={authForm.handle}
                    onChange={(e) => setAuthForm((prev) => ({ ...prev, handle: e.target.value }))}
                    required
                  />
                </>
              )}
              <Input
                placeholder="Email"
                type="email"
                value={authForm.email}
                onChange={(e) => setAuthForm((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
              <Input
                placeholder="Password"
                type="password"
                value={authForm.password}
                onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
                required
              />
              <Button disabled={busy} type="submit">
                {mode === 'login' ? 'Log in' : 'Create account'}
              </Button>
            </form>

            <div className="flex flex-col gap-1">
              <Button variant="ghost" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
                {mode === 'login' ? 'Need an account?' : 'Already have an account?'}
              </Button>
              {mode === 'login' && (
                <Button variant="ghost" onClick={() => setMode('forgot')}>
                  Forgot password?
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <pre
            className={cn(
              'text-xs rounded-lg border border-destructive/40 bg-destructive/10 text-destructive px-3 py-2 whitespace-pre-wrap'
            )}
          >
            {error}
          </pre>
        )}
      </section>
    </main>
  );
}

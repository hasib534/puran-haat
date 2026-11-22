import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthProvider';
import { useAdminRole } from '../auth/useAdminRole';
import { Button, Field, Icon, inputClass, Spinner } from '../components/ui';

const HIGHLIGHTS = [
  { icon: 'verified_user', title: 'Verify traders', copy: 'Review identity documents before a badge is granted.' },
  { icon: 'gavel', title: 'Run auctions', copy: 'Schedule and moderate community eco-point auctions.' },
  { icon: 'workspace_premium', title: 'Reward impact', copy: 'Grant points and badges for verified sustainability.' },
];

export function LoginPage() {
  const { user, signIn, signOut, resetPassword, configured } = useAuth();
  const { loading, isAdmin, member } = useAdminRole();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'signin' | 'reset'>('signin');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (user && isAdmin) {
    return <Navigate to="/" replace />;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim()) {
      setError('Enter your admin email.');
      return;
    }
    if (mode === 'signin' && !password) {
      setError('Enter your security key.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
        setPassword('');
      } else {
        await resetPassword(email.trim());
        setNotice(`Password reset link sent to ${email.trim()}.`);
        setMode('signin');
      }
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (user && loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner label="Checking admin access…" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* Brand panel */}
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-primary p-xl text-on-primary lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary-fixed/10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-primary-fixed/10"
        />

        <div className="relative flex items-center gap-sm">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-fixed text-primary">
            <Icon name="forest" className="text-[30px]" />
          </span>
          <div>
            <p className="text-headline-sm font-semibold">Puran Haat</p>
            <p className="text-label-md uppercase tracking-[0.18em] text-primary-fixed/80">
              Management Portal
            </p>
          </div>
        </div>

        <div className="relative max-w-[28rem]">
          <h1 className="text-display-lg text-primary-fixed">
            Steward the circular neighbourhood.
          </h1>
          <p className="mt-sm text-body-md text-primary-fixed/75">
            One console for trust, auctions and the rewards that keep Puran Haat&apos;s second-hand
            economy moving.
          </p>

          <ul className="mt-lg flex flex-col gap-sm">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary-container text-primary-fixed">
                  <Icon name={item.icon} className="text-[19px]" />
                </span>
                <div>
                  <p className="text-body-sm font-semibold text-on-primary">{item.title}</p>
                  <p className="text-body-sm text-primary-fixed/70">{item.copy}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-label-md text-primary-fixed/60">
          Puran Haat · Community eco-trade · Dhaka
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex flex-1 items-center justify-center p-margin md:p-lg">
        <div className="w-full max-w-[28rem]">
          <div className="mb-md flex items-center gap-3 lg:hidden">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-fixed">
              <Icon name="forest" className="text-[24px]" />
            </span>
            <div>
              <p className="text-headline-sm text-primary">Puran Haat</p>
              <p className="text-label-md uppercase tracking-[0.16em] text-on-surface-variant">
                Management Portal
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-surface-variant/60 bg-surface-container-lowest p-md shadow-sm shadow-primary/5 md:p-lg">
            {user && !isAdmin ? (
              <div className="text-center">
                <span className="mx-auto mb-sm flex h-14 w-14 items-center justify-center rounded-full bg-error-container text-error">
                  <Icon name="lock" className="text-[26px]" />
                </span>
                <h2 className="text-headline-sm text-on-surface">Account not on the roster</h2>
                <p className="mt-2 text-body-sm text-on-surface-variant">
                  You are signed in as <span className="font-semibold">{user.email}</span>, but this
                  account has no row in the <code className="rounded bg-surface-container px-1">admins</code>{' '}
                  collection.
                </p>
                <div className="mt-md flex flex-col gap-xs">
                  <Button variant="primary" size="lg" icon="logout" onClick={() => void signOut()}>
                    Sign out
                  </Button>
                  <a
                    href="https://console.firebase.google.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-label-md text-on-surface-variant underline decoration-outline-variant underline-offset-4 hover:text-primary"
                  >
                    Ask a super admin to add you
                  </a>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-md">
                  <p className="text-label-md uppercase tracking-[0.16em] text-tertiary">
                    Secure admin access
                  </p>
                  <h2 className="mt-1 text-headline-md text-on-surface">
                    {mode === 'signin' ? 'Sign in to the console' : 'Reset your security key'}
                  </h2>
                  <p className="mt-1 text-body-sm text-on-surface-variant">
                    {mode === 'signin'
                      ? 'Authenticate with an account that has moderator or super-admin rights.'
                      : 'We will email a signed reset link to the address on file.'}
                  </p>
                </div>

                <form onSubmit={submit} className="flex flex-col gap-sm">
                  <Field label="Admin ID / Email" required>
                    <div className="relative">
                      <Icon
                        name="person"
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[19px] text-on-surface-variant"
                      />
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="admin@puranhaat.app"
                        autoComplete="username"
                        className={`${inputClass} pl-10`}
                        disabled={submitting}
                        required
                      />
                    </div>
                  </Field>

                  {mode === 'signin' ? (
                    <Field
                      label="Security Key"
                      required
                      hint={undefined}
                    >
                      <div className="relative">
                        <Icon
                          name="key"
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[19px] text-on-surface-variant"
                        />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="Your password"
                          autoComplete="current-password"
                          className={`${inputClass} pl-10 pr-11`}
                          disabled={submitting}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-on-surface-variant hover:bg-surface-container"
                        >
                          <Icon
                            name={showPassword ? 'visibility_off' : 'visibility'}
                            className="text-[19px]"
                          />
                        </button>
                      </div>
                    </Field>
                  ) : null}

                  {error ? (
                    <p role="alert" className="flex items-start gap-1.5 text-body-sm text-error">
                      <Icon name="error" className="text-[17px]" />
                      {error}
                    </p>
                  ) : null}
                  {notice ? (
                    <p role="status" className="flex items-start gap-1.5 text-body-sm text-primary">
                      <Icon name="mark_email_read" className="text-[17px]" />
                      {notice}
                    </p>
                  ) : null}

                  <Button
                    type="submit"
                    size="lg"
                    className="mt-2 w-full"
                    loading={submitting}
                    disabled={!configured}
                    icon={mode === 'signin' ? 'login' : 'send'}
                  >
                    {mode === 'signin' ? 'Authenticate' : 'Send reset link'}
                  </Button>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setMode(mode === 'signin' ? 'reset' : 'signin');
                        setError(null);
                        setNotice(null);
                      }}
                      className="text-label-md text-on-surface-variant underline decoration-outline-variant underline-offset-4 hover:text-primary"
                    >
                      {mode === 'signin' ? 'Forgot key?' : 'Back to sign in'}
                    </button>
                    <span className="text-label-md text-on-surface-variant">
                      New moderator?{' '}
                      <a
                        href="https://console.firebase.google.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-primary hover:underline"
                      >
                        Request access
                      </a>
                    </span>
                  </div>
                </form>
              </>
            )}
          </div>

          {member ? (
            <p className="mt-sm text-center text-label-md text-on-surface-variant">
              Signed in as {member.role === 'moderator' ? 'moderator' : 'super admin'}.
            </p>
          ) : null}

          <p className="mt-md text-center text-label-md text-on-surface-variant">
            Access is checked against the{' '}
            <code className="rounded bg-surface-container px-1">admins</code> collection.
          </p>
        </div>
      </main>
    </div>
  );
}
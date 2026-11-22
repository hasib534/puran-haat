import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../auth/AuthProvider';
import { useAdminRole } from '../auth/useAdminRole';
import { projectIdForConsole } from '../lib/firebase';
import { Button, Icon, Spinner } from './ui';

function CenteredPanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-margin">
      <div className="w-full max-w-[28rem] rounded-xl border border-surface-variant/60 bg-surface-container-lowest p-lg text-center shadow-sm shadow-primary/5">
        {children}
      </div>
    </div>
  );
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, configured, signOut } = useAuth();
  const { loading, isAdmin } = useAdminRole();
  const location = useLocation();

  if (!configured) {
    return (
      <CenteredPanel>
        <span className="mx-auto mb-sm flex h-14 w-14 items-center justify-center rounded-full bg-tertiary-fixed text-tertiary">
          <Icon name="settings_suggest" className="text-[26px]" />
        </span>
        <h1 className="text-headline-sm text-on-surface">Firebase is not configured</h1>
        <p className="mt-2 text-body-sm text-on-surface-variant">
          Add the <code className="rounded bg-surface-container px-1">VITE_FIREBASE_*</code> values
          to <code className="rounded bg-surface-container px-1">admin-web/.env.local</code> and
          restart the dev server.
        </p>
      </CenteredPanel>
    );
  }

  if (authLoading) {
    return (
      <CenteredPanel>
        <Spinner label="Restoring session…" />
      </CenteredPanel>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (loading) {
    return (
      <CenteredPanel>
        <Spinner label="Checking admin access…" />
      </CenteredPanel>
    );
  }

  if (!isAdmin) {
    return (
      <CenteredPanel>
        <span className="mx-auto mb-sm flex h-14 w-14 items-center justify-center rounded-full bg-error-container text-error">
          <Icon name="lock" className="text-[26px]" />
        </span>
        <h1 className="text-headline-sm text-on-surface">This account has no admin access</h1>
        <p className="mt-2 text-body-sm text-on-surface-variant">
          <span className="font-semibold text-on-surface">{user.email}</span> is signed in, but only
          accounts with a document under{' '}
          <code className="rounded bg-surface-container px-1">admins/{user.uid}</code> can open the
          portal.
        </p>
        <div className="mt-md flex flex-col items-center gap-xs">
          <Button
            variant="primary"
            size="lg"
            icon="logout"
            onClick={() => {
              void signOut();
            }}
          >
            Sign out
          </Button>
          <p className="text-label-md text-on-surface-variant">
            Project: {projectIdForConsole || 'unknown'}
          </p>
        </div>
      </CenteredPanel>
    );
  }

  return <>{children}</>;
}
import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAdminRole } from '../auth/useAdminRole';
import { useAuth } from '../auth/AuthProvider';
import { useLiveCollection } from '../hooks/useLive';
import { watchVerifications } from '../lib/admin';
import { toVerification } from '../lib/models';
import { Avatar, Icon, Pill } from './ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/verifications', label: 'User Verification', icon: 'verified_user', badge: 'verifications' },
  { to: '/auctions', label: 'Community Auctions', icon: 'gavel' },
  { to: '/users', label: 'User Management', icon: 'group' },
  { to: '/rewards', label: 'Sustainability Rewards', icon: 'workspace_premium' },
  { to: '/settings', label: 'System Settings', icon: 'settings' },
] as const;

const TITLES: Record<string, string> = {
  '/': 'Admin Overview',
  '/verifications': 'User Verification',
  '/auctions': 'Community Auctions',
  '/auctions/new': 'Schedule Auction',
  '/users': 'User Management',
  '/rewards': 'Rewards & Recognition',
  '/rewards/configure': 'Reward Configuration',
  '/settings': 'System Settings',
};

function titleFor(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith('/verifications/')) return 'Verification Detail';
  if (pathname.startsWith('/users/')) return 'User Investigation';
  return 'Admin';
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth();
  const { member } = useAdminRole();
  const navigate = useNavigate();

  const verifications = useLiveCollection(watchVerifications, toVerification);
  const pending = verifications.data.filter((entry) => entry.status === 'pending').length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-sm p-margin">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
          <Icon name="forest" className="text-[26px]" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-headline-sm text-primary">Puran Haat Admin</h1>
          <p className="text-body-sm text-on-surface-variant">
            {member?.role === 'moderator' ? 'Moderator Office' : 'Super Admin Office'}
          </p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-xs px-sm py-xs">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={'end' in item ? item.end : false}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-4 py-3 text-body-sm transition-colors ${
                isActive
                  ? 'bg-primary-container font-semibold text-on-primary-container'
                  : 'text-on-surface-variant hover:bg-secondary-container/50'
              }`
            }
          >
            <Icon name={item.icon} className="text-[20px]" />
            <span className="flex-1">{item.label}</span>
            {'badge' in item && pending > 0 ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-label-md text-on-primary">
                {pending}
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-outline-variant/40 p-sm">
        <div className="flex items-center gap-2 rounded-lg px-2 py-2">
          <Avatar name={user?.displayName || user?.email || 'Admin'} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-body-sm font-semibold text-on-surface">
              {user?.displayName || 'Puran Haat Admin'}
            </p>
            <p className="truncate text-label-md text-on-surface-variant">{user?.email}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between px-2">
          <Pill tone={member?.role === 'moderator' ? 'info' : 'ok'}>
            {member?.role === 'moderator' ? 'Moderator' : 'Super admin'}
          </Pill>
          <button
            type="button"
            onClick={() => {
              void signOut().then(() => navigate('/login', { replace: true }));
            }}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container hover:text-error"
          >
            <Icon name="logout" className="text-[16px]" />
            Sign out
          </button>
        </div>
        <p className="mt-3 px-2 text-label-md text-on-surface-variant opacity-70">v1.0.0</p>
      </div>
    </div>
  );
}

export function AppShell() {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const verifications = useLiveCollection(watchVerifications, toVerification);
  const pending = verifications.data.filter((entry) => entry.status === 'pending').length;

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop navigation drawer */}
      <aside className="fixed left-0 top-0 z-40 hidden h-full w-72 flex-col rounded-r-xl bg-surface-container-low shadow-sm shadow-primary/5 md:flex">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            role="presentation"
          />
          <div className="absolute left-0 top-0 h-full w-72 rounded-r-xl bg-surface-container-low shadow-xl">
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-screen flex-col md:ml-72">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-sm border-b border-outline-variant/30 bg-surface/85 px-margin py-sm backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-sm">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container md:hidden"
              aria-label="Open navigation"
            >
              <Icon name="menu" />
            </button>
            <h2 className="truncate text-headline-sm text-primary md:text-headline-md">
              {titleFor(location.pathname)}
            </h2>
          </div>

          <div className="flex items-center gap-xs">
            <NavLink
              to="/verifications"
              aria-label={
                pending > 0 ? `${pending} pending verifications` : 'Verifications'
              }
              className="relative rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
            >
              <Icon name="notifications" />
              {pending > 0 ? (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-tertiary px-1 text-[10px] font-bold text-on-tertiary">
                  {pending}
                </span>
              ) : null}
            </NavLink>
            <span className="hidden items-center gap-2 rounded-full bg-surface-container py-1 pl-1 pr-3 sm:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-label-md text-on-primary">
                PH
              </span>
              <span className="text-label-md text-on-surface-variant">Puran Haat Admin</span>
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-margin md:p-lg">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
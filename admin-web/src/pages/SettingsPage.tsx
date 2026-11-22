import { useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { useAdminRole } from '../auth/useAdminRole';
import {
  Button,
  Card,
  ConfirmButton,
  ErrorNote,
  Icon,
  PageHeader,
  Pill,
} from '../components/ui';
import { useLiveCollection } from '../hooks/useLive';
import {
  watchAuctions,
  watchBadges,
  watchGrants,
  watchReports,
  watchRewardRules,
  watchUsers,
  watchVerifications,
} from '../lib/admin';
import { loadDemoData } from '../lib/demo';
import { projectIdForConsole } from '../lib/firebase';
import { toAuction, toBadge, toGrant, toProfile, toReport, toRule, toVerification } from '../lib/models';

const CONSOLE_ROOT = 'https://console.firebase.google.com/project';

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const { member } = useAdminRole();

  const users = useLiveCollection(watchUsers, toProfile);
  const verifications = useLiveCollection(watchVerifications, toVerification);
  const reports = useLiveCollection(watchReports, toReport);
  const auctions = useLiveCollection(watchAuctions, toAuction);
  const rules = useLiveCollection(watchRewardRules, toRule);
  const badges = useLiveCollection(watchBadges, toBadge);
  const grants = useLiveCollection(watchGrants, toGrant);

  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const collections = [
    { name: 'users', count: users.data.length, loading: users.loading, icon: 'group' },
    { name: 'verifications', count: verifications.data.length, loading: verifications.loading, icon: 'verified_user' },
    { name: 'moderationReports', count: reports.data.length, loading: reports.loading, icon: 'report' },
    { name: 'auctions', count: auctions.data.length, loading: auctions.loading, icon: 'gavel' },
    { name: 'rewardRules', count: rules.data.length, loading: rules.loading, icon: 'trending_up' },
    { name: 'badges', count: badges.data.length, loading: badges.loading, icon: 'stars' },
    { name: 'rewardGrants', count: grants.data.length, loading: grants.loading, icon: 'redeem' },
  ];

  const seed = async () => {
    setSeeding(true);
    setError(null);
    setMessage(null);
    try {
      await loadDemoData();
      setMessage('Demo data loaded. Overview, auctions and rewards now have sample content.');
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="flex flex-col gap-md">
      <PageHeader
        title="System Settings"
        description="Portal configuration, data health and the steps that keep admin access locked down."
      />

      {message ? (
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary-fixed/40 px-3 py-2 text-body-sm text-on-primary-fixed">
          <Icon name="check_circle" className="text-[18px]" />
          <span>{message}</span>
        </div>
      ) : null}
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <Card>
          <h3 className="flex items-center gap-2 text-headline-sm text-on-surface">
            <Icon name="admin_panel_settings" className="text-[20px] text-primary" />
            Session
          </h3>
          <dl className="mt-sm flex flex-col gap-2 text-body-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-on-surface-variant">Signed in as</dt>
              <dd className="truncate font-semibold text-on-surface">{user?.email}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-on-surface-variant">Role</dt>
              <dd>
                <Pill tone={member?.role === 'moderator' ? 'info' : 'ok'}>
                  {member?.role === 'moderator' ? 'Moderator' : 'Super admin'}
                </Pill>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-on-surface-variant">UID</dt>
              <dd className="truncate font-mono text-label-md text-on-surface-variant">{user?.uid}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-on-surface-variant">Firebase project</dt>
              <dd className="font-mono text-label-md text-on-surface-variant">
                {projectIdForConsole || 'unknown'}
              </dd>
            </div>
          </dl>

          <div className="mt-md flex flex-wrap gap-xs">
            <Button variant="secondary" icon="logout" onClick={() => void signOut()}>
              Sign out
            </Button>
            <a
              href={`${CONSOLE_ROOT}/${projectIdForConsole}/firestore/data`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 px-4 py-2.5 text-label-md font-semibold text-primary transition-colors hover:bg-primary-fixed/40"
            >
              <Icon name="open_in_new" className="text-[17px]" />
              Open Firestore console
            </a>
          </div>
        </Card>

        <Card>
          <h3 className="flex items-center gap-2 text-headline-sm text-on-surface">
            <Icon name="database" className="text-[20px] text-primary" />
            Data health
          </h3>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Live document counts from each admin collection.
          </p>

          <ul className="mt-sm flex flex-col gap-2">
            {collections.map((collection) => (
              <li
                key={collection.name}
                className="flex items-center justify-between rounded-lg bg-surface-container-low px-3 py-2"
              >
                <span className="flex items-center gap-2 text-body-sm text-on-surface">
                  <Icon name={collection.icon} className="text-[18px] text-on-surface-variant" />
                  <code className="font-mono text-label-md">{collection.name}</code>
                </span>
                {collection.loading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
                ) : (
                  <span className="text-body-sm font-semibold text-primary">{collection.count}</span>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h3 className="flex items-center gap-2 text-headline-sm text-on-surface">
            <Icon name="verified_user" className="text-[20px] text-primary" />
            Admin access model
          </h3>
          <ol className="mt-sm flex flex-col gap-2 text-body-sm text-on-surface-variant">
            <li className="flex gap-2">
              <span className="font-semibold text-on-surface">1.</span>
              Every moderator needs a document under <code className="rounded bg-surface-container px-1">admins/&lt;uid&gt;</code>.
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-on-surface">2.</span>
              Firestore rules check that document before allowing any admin read or write.
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-on-surface">3.</span>
              To add someone, sign them in once, copy their UID from Authentication, then create the
              roster document in the console.
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-on-surface">4.</span>
              Rules ship from the repo: <code className="rounded bg-surface-container px-1">firebase deploy --only firestore:rules</code>.
            </li>
          </ol>
        </Card>

        <Card>
          <h3 className="flex items-center gap-2 text-headline-sm text-on-surface">
            <Icon name="science" className="text-[20px] text-primary" />
            Demo content
          </h3>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Fills the admin collections with the sample records from the design file. Demo rows use{' '}
            <code className="rounded bg-surface-container px-1">demo-</code> IDs, so re-running never
            touches a real trader or listing.
          </p>

          <div className="mt-sm">
            {collections.every((collection) => !collection.loading && collection.count === 0) ? (
              <div className="flex items-start gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-body-sm text-on-surface-variant">
                <Icon name="info" className="text-[18px]" />
                Every collection is empty — a good moment to load the demo set.
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-body-sm text-on-surface-variant">
                <Icon name="info" className="text-[18px]" />
                Re-running overwrites the same demo documents and leaves real records alone.
              </div>
            )}
          </div>

          <ConfirmButton
            label={seeding ? 'Loading…' : 'Load demo data'}
            icon="science"
            variant="secondary"
            size="lg"
            className="mt-sm w-full"
            disabled={seeding}
            title="Load demo data?"
            message="Adds the sample verification requests, reports, auctions, reward rules, badges and grants from the design file."
            confirmLabel="Load demo data"
            onConfirm={seed}
          />
        </Card>
      </div>
    </div>
  );
}

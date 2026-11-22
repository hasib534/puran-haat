import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthProvider';
import {
  Button,
  Card,
  EmptyState,
  Icon,
  Modal,
  PageHeader,
  Pill,
  Spinner,
  StatCard,
} from '../components/ui';
import { useLiveCollection } from '../hooks/useLive';
import {
  watchAuctions,
  watchReports,
  watchUsers,
  watchVerifications,
} from '../lib/admin';
import { loadDemoData } from '../lib/demo';
import { relativeTime } from '../lib/format';
import {
  toAuction,
  toProfile,
  toReport,
  toVerification,
} from '../lib/models';

interface ActivityEntry {
  id: string;
  icon: string;
  tone: 'pending' | 'report' | 'auction';
  text: string;
  highlight: string;
  meta: string;
  at: number;
  to?: string;
}

export function OverviewPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const verifications = useLiveCollection(watchVerifications, toVerification);
  const reports = useLiveCollection(watchReports, toReport);
  const users = useLiveCollection(watchUsers, toProfile);
  const auctions = useLiveCollection(watchAuctions, toAuction);

  const [demoOpen, setDemoOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  const pending = verifications.data.filter((entry) => entry.status === 'pending');
  const openReports = reports.data.filter((entry) => entry.status === 'open');
  const activeAuctions = auctions.data.filter((entry) => entry.status === 'active');

  const flagged = useMemo(() => {
    const ids = new Set<string>();
    users.data.forEach((profile) => {
      if (profile.moderation_status && profile.moderation_status !== 'clear') ids.add(profile.id);
    });
    openReports.forEach((report) => ids.add(report.user_id));
    return ids.size;
  }, [openReports, users.data]);

  const activity = useMemo<ActivityEntry[]>(() => {
    const entries: ActivityEntry[] = [];

    pending.forEach((request) => {
      entries.push({
        id: `v-${request.id}`,
        icon: 'person_add',
        tone: 'pending',
        text: 'New trader verification request from',
        highlight: request.full_name,
        meta: relativeTime(request.submitted_at),
        at: request.submitted_at,
        to: `/verifications/${request.id}`,
      });
    });

    openReports.forEach((report) => {
      const subject =
        users.data.find((profile) => profile.id === report.user_id)?.full_name ?? report.user_id;
      entries.push({
        id: `r-${report.id}`,
        icon: report.type === 'message' ? 'forum' : 'report',
        tone: 'report',
        text: 'User',
        highlight: subject,
        meta: `${report.title} · ${relativeTime(report.created_at)}`,
        at: report.created_at,
        to: `/users/${report.user_id}`,
      });
    });

    auctions.data
      .filter((auction) => auction.status !== 'scheduled')
      .forEach((auction) => {
        entries.push({
          id: `a-${auction.id}`,
          icon: 'gavel',
          tone: 'auction',
          text: 'Auction',
          highlight: auction.title,
          meta: auction.status === 'active' ? 'Live in community' : 'Ended',
          at: auction.starts_at,
          to: '/auctions',
        });
      });

    return entries.sort((a, b) => b.at - a.at).slice(0, 6);
  }, [auctions.data, openReports, pending, users.data]);

  const loading =
    verifications.loading && reports.loading && users.loading && auctions.loading;

  const collectionsEmpty =
    verifications.data.length === 0 && reports.data.length === 0 && auctions.data.length === 0;

  const runSeed = async () => {
    setSeeding(true);
    try {
      await loadDemoData();
      setSeedMessage('Demo data loaded. Every admin screen now has sample content.');
      setDemoOpen(false);
    } catch (error) {
      setSeedMessage(`Could not load demo data: ${(error as Error).message}`);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="flex flex-col gap-md">
      <PageHeader
        title={`Welcome back${user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}`}
        description="Review trust signals, keep auctions healthy and recognise the traders doing the most for the neighbourhood."
      >
        {collectionsEmpty ? (
          <Button variant="secondary" icon="science" onClick={() => setDemoOpen(true)}>
            Load demo data
          </Button>
        ) : null}
        <Button variant="primary" icon="verified_user" onClick={() => navigate('/verifications')}>
          Review queue
        </Button>
      </PageHeader>

      {seedMessage ? (
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary-fixed/40 px-3 py-2 text-body-sm text-on-primary-fixed">
          <Icon name="check_circle" className="text-[18px]" />
          <span>{seedMessage}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
        <StatCard
          icon="hourglass_empty"
          value={pending.length}
          label="Pending Verifications"
          hint="Requires admin review"
          onClick={() => navigate('/verifications')}
        />
        <StatCard
          icon="gavel"
          value={activeAuctions.length}
          label="Active Auctions"
          hint="Live in community"
          onClick={() => navigate('/auctions')}
        />
        <StatCard
          icon="flag"
          value={flagged}
          label="Flagged Users"
          hint="Needs immediate attention"
          tone="danger"
          onClick={() => navigate('/users')}
        />
      </div>

      <Card>
        <div className="mb-md flex items-center justify-between">
          <h2 className="text-headline-sm text-on-surface">Recent Activity</h2>
          <button
            type="button"
            onClick={() => navigate('/users')}
            className="text-label-md text-primary hover:text-primary-container"
          >
            View All
          </button>
        </div>

        {loading ? (
          <Spinner label="Loading activity…" />
        ) : activity.length === 0 ? (
          <EmptyState
            icon="inbox"
            title="No moderation activity yet"
            description="Verification requests, reports and auctions will appear here as the community uses Puran Haat."
          />
        ) : (
          <ul className="flex flex-col">
            {activity.map((entry, index) => (
              <li
                key={entry.id}
                className={`flex items-start gap-sm py-sm ${
                  index > 0 ? 'border-t border-primary/10' : ''
                }`}
              >
                <span
                  className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    entry.tone === 'report'
                      ? 'bg-error-container text-error'
                      : entry.tone === 'pending'
                        ? 'bg-secondary-container text-on-secondary-container'
                        : 'bg-surface-variant text-on-surface-variant'
                  }`}
                >
                  <Icon name={entry.icon} className="text-[18px]" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-body-md text-on-surface">
                    {entry.text} <span className="font-bold">{entry.highlight}</span>
                  </p>
                  <p className="mt-0.5 text-body-sm text-on-surface-variant">{entry.meta}</p>
                </div>

                {entry.to ? (
                  <Button
                    variant={entry.tone === 'report' ? 'danger' : 'primary'}
                    size="sm"
                    onClick={() => navigate(entry.to!)}
                  >
                    Review
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-sm lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="text-headline-sm text-on-surface">Queue at a glance</h2>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Live counts straight from Firestore.
          </p>
          <dl className="mt-md grid grid-cols-2 gap-sm">
            {[
              { label: 'Pending verifications', value: pending.length, icon: 'badge' },
              { label: 'Open reports', value: openReports.length, icon: 'report' },
              { label: 'Scheduled auctions', value: auctions.data.filter((a) => a.status === 'scheduled').length, icon: 'event' },
              { label: 'Registered traders', value: users.data.length, icon: 'group' },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-lg bg-surface-container-low px-3 py-2"
              >
                <dt className="flex items-center gap-2 text-body-sm text-on-surface-variant">
                  <Icon name={row.icon} className="text-[18px]" />
                  {row.label}
                </dt>
                <dd className="text-body-md font-semibold text-primary">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <h2 className="text-headline-sm text-on-surface">Portal status</h2>
          <ul className="mt-sm flex flex-col gap-2 text-body-sm">
            <li className="flex items-center justify-between">
              <span className="text-on-surface-variant">Signed in as</span>
              <span className="max-w-[60%] truncate font-semibold text-on-surface">
                {user?.email}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-on-surface-variant">Collections</span>
              <Pill tone={collectionsEmpty ? 'warn' : 'ok'}>
                {collectionsEmpty ? 'Empty' : 'Live'}
              </Pill>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-on-surface-variant">Rules</span>
              <Pill tone="info">Admin gated</Pill>
            </li>
          </ul>
          <Button
            variant="secondary"
            icon="settings"
            className="mt-md w-full"
            onClick={() => navigate('/settings')}
          >
            System settings
          </Button>
        </Card>
      </div>

      <Modal
        open={demoOpen}
        title="Load demo data?"
        description="Adds the sample verification requests, reports, auctions, reward rules, badges and grants from the design file. Demo rows use demo- IDs and never touch real trader profiles."
        onClose={() => (seeding ? undefined : setDemoOpen(false))}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDemoOpen(false)} disabled={seeding}>
              Cancel
            </Button>
            <Button onClick={runSeed} loading={seeding} icon="science">
              Load demo data
            </Button>
          </>
        }
      />
    </div>
  );
}
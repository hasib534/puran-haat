import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  Avatar,
  Button,
  Card,
  ConfirmButton,
  EmptyState,
  ErrorNote,
  Icon,
  Pill,
  Spinner,
  inputClass,
} from '../components/ui';
import { useLiveCollection, useLiveDocument } from '../hooks/useLive';
import { resolveReport, updateUserModeration, watchReports, watchUser } from '../lib/admin';
import { formatDateTime, memberSince, relativeTime } from '../lib/format';
import { toProfile, toReport, type ModerationReport } from '../lib/models';

const SUSPENSION_OPTIONS = [
  { hours: 24, label: '24 Hours' },
  { hours: 72, label: '3 Days' },
  { hours: 168, label: '7 Days' },
  { hours: 720, label: '30 Days' },
];

type ReportFilter = 'all' | 'message' | 'listing';

const FILTERS: Array<{ key: ReportFilter; label: string }> = [
  { key: 'all', label: 'All Flags' },
  { key: 'message', label: 'Messages' },
  { key: 'listing', label: 'Listings' },
];

const REPORT_ICON: Record<ModerationReport['type'], string> = {
  message: 'forum',
  listing: 'report',
  account: 'person',
};

export function UserInvestigationPage() {
  const { id = '' } = useParams();

  // Remounting on id change keeps per-trader drafts, filters and note text
  // from leaking into the next investigation.
  return <InvestigationView key={id} id={id} />;
}

function InvestigationView({ id }: { id: string }) {
  const navigate = useNavigate();

  const profile = useLiveDocument(watchUser, id, toProfile);
  const reports = useLiveCollection(watchReports, toReport, `reports-${id}`);

  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const [hours, setHours] = useState(24);
  const [filter, setFilter] = useState<ReportFilter>('all');
  const [noteState, setNoteState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [actionError, setActionError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const trader = profile.data;
  const displayName = trader?.full_name ?? 'Trader not found';
  const notes = notesDraft ?? trader?.admin_notes ?? '';
  const notesDirty = notesDraft !== null && notesDraft !== (trader?.admin_notes ?? '');

  const mine = useMemo(
    () =>
      reports.data
        .filter((report) => report.user_id === id)
        .sort((a, b) => b.created_at - a.created_at),
    [id, reports.data],
  );

  const openReports = mine.filter((report) => report.status === 'open');
  const last30Days = mine.filter((report) => report.created_at >= now - 30 * 86_400_000).length;

  const visible = mine.filter((report) => (filter === 'all' ? true : report.type === filter));

  if (profile.loading) return <Spinner label="Loading trader..." />;

  if (profile.error) return <ErrorNote>{profile.error}</ErrorNote>;

  const run = async (action: () => Promise<void>) => {
    setActionError(null);
    try {
      await action();
    } catch (caught) {
      setActionError((caught as Error).message);
    }
  };

  const suspendUntil = (value: number | undefined) => {
    if (!value) return null;
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  };

  const statusTone =
    trader?.moderation_status === 'banned' || trader?.moderation_status === 'suspended'
      ? 'danger'
      : openReports.length > 0
        ? 'warn'
        : 'ok';

  const statusLabel =
    trader?.moderation_status && trader.moderation_status !== 'clear'
      ? trader.moderation_status
      : openReports.length > 0
        ? 'flagged'
        : 'clear';

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <Link
          to="/users"
          className="inline-flex items-center gap-1 text-label-md text-on-surface-variant hover:text-primary"
        >
          <Icon name="arrow_back" className="text-[18px]" />
          Back to User List
        </Link>
        {openReports.length > 0 ? (
          <Pill tone="danger">
            <Icon name="priority_high" className="text-[15px]" />
            {openReports.length} open escalation{openReports.length === 1 ? '' : 's'}
          </Pill>
        ) : null}
      </div>

      {actionError ? <ErrorNote>{actionError}</ErrorNote> : null}

      {!trader ? (
        <ErrorNote>
          No <code className="rounded bg-surface-container px-1">users/{id}</code> document exists for
          this ID. Report history still loads, but moderation actions need a real profile document.
        </ErrorNote>
      ) : null}

      {trader?.moderation_status === 'banned' ? (
        <ErrorNote>This account is permanently banned from the community.</ErrorNote>
      ) : trader?.moderation_status === 'suspended' ? (
        <div className="flex items-start gap-2 rounded-lg border border-tertiary/25 bg-tertiary-fixed/50 px-3 py-2 text-body-sm text-on-tertiary-fixed">
          <Icon name="timer" className="text-[18px]" />
          <span>Suspended until {suspendUntil(trader.suspended_until) ?? 'unknown'}.</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-md">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-sm">
              <div className="min-w-0">
                <h2 className="text-headline-md text-on-surface">{displayName}</h2>
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  {trader?.username ? `@${trader.username} · ` : ''}
                  {memberSince(trader?.joined_at)}
                </p>
                <p className="mt-1 font-mono text-label-md text-on-surface-variant">ID: {id}</p>
              </div>
              <Pill tone={statusTone}>{statusLabel}</Pill>
            </div>

            <div className="mt-md grid grid-cols-1 gap-sm sm:grid-cols-3">
              <div className="rounded-lg bg-surface-container-low px-3 py-2">
                <p className="text-label-md text-on-surface-variant">Trust Score</p>
                <p
                  className={`mt-0.5 text-headline-sm font-semibold ${
                    (trader?.trust_score ?? 100) < 50 ? 'text-error' : 'text-primary'
                  }`}
                >
                  {trader?.trust_score ?? 100}
                  <span className="text-body-sm font-normal text-on-surface-variant"> / 100</span>
                </p>
              </div>
              <div className="rounded-lg bg-surface-container-low px-3 py-2">
                <p className="text-label-md text-on-surface-variant">Reports (30d)</p>
                <p className="mt-0.5 text-headline-sm font-semibold text-on-surface">{last30Days}</p>
              </div>
              <div className="rounded-lg bg-surface-container-low px-3 py-2">
                <p className="text-label-md text-on-surface-variant">Completed Trades</p>
                <p className="mt-0.5 text-headline-sm font-semibold text-on-surface">
                  {trader?.trade_count ?? 0}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="mb-sm flex flex-wrap items-center justify-between gap-sm">
              <h3 className="text-headline-sm text-on-surface">Reported Activity</h3>
              <div className="flex flex-wrap gap-1 rounded-full bg-surface-container p-1">
                {FILTERS.map((item) => {
                  const active = filter === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setFilter(item.key)}
                      className={`rounded-full px-3 py-1.5 text-label-md transition-colors ${
                        active ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-primary'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {reports.loading ? (
              <Spinner label="Loading reports..." />
            ) : visible.length === 0 ? (
              <EmptyState
                icon="flag"
                title="No reports on file"
                description={
                  filter === 'all'
                    ? 'Nothing has been reported for this account.'
                    : 'No reports of this type for this account.'
                }
              />
            ) : (
              <ul className="flex flex-col divide-y divide-outline-variant/30">
                {visible.map((report) => (
                  <li key={report.id} className="flex gap-sm py-sm">
                    <span
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        report.status === 'open'
                          ? 'bg-error-container text-error'
                          : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      <Icon name={REPORT_ICON[report.type]} className="text-[18px]" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-body-md font-semibold text-on-surface">{report.title}</p>
                        <Pill tone={report.status === 'open' ? 'danger' : 'neutral'}>
                          {report.status}
                        </Pill>
                      </div>
                      <p className="mt-0.5 text-body-sm text-on-surface-variant">
                        {formatDateTime(report.created_at)} · {relativeTime(report.created_at)}
                      </p>
                      <p className="mt-1.5 text-body-sm text-on-surface">{report.detail}</p>

                      {report.item_title ? (
                        <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-surface-container-low px-2.5 py-1 text-label-md text-on-surface-variant">
                          <Icon name="inventory_2" className="text-[15px]" />
                          {report.item_title}
                          {report.item_id ? ` · ${report.item_id}` : ''}
                        </p>
                      ) : null}
                    </div>

                    {report.status === 'open' ? (
                      <ConfirmButton
                        label="Resolve"
                        variant="ghost"
                        title="Resolve this report?"
                        message="Marks the report resolved. It stays in the trader's history."
                        confirmLabel="Resolve report"
                        onConfirm={() => run(() => resolveReport(report.id))}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-sm flex items-center justify-between gap-2">
              <h3 className="text-headline-sm text-on-surface">Reviewer Notes</h3>
              <span className="text-body-sm text-on-surface-variant">Internal documentation only</span>
            </div>
            <textarea
              rows={4}
              value={notes}
              onChange={(event) => setNotesDraft(event.target.value)}
              placeholder="Context for the next reviewer. Not visible to the trader."
              className={`${inputClass} resize-y`}
            />
            <div className="mt-sm flex flex-wrap items-center justify-end gap-xs">
              {noteState === 'saved' ? (
                <span className="text-label-md text-primary">Notes saved</span>
              ) : null}
              <Button
                variant="secondary"
                size="sm"
                icon="save"
                loading={noteState === 'saving'}
                disabled={!trader || !notesDirty}
                onClick={() =>
                  run(async () => {
                    if (!trader) return;
                    setNoteState('saving');
                    try {
                      await updateUserModeration(trader.id, { admin_notes: notes });
                      setNotesDraft(null);
                      setNoteState('saved');
                      window.setTimeout(() => setNoteState('idle'), 2000);
                    } catch (caught) {
                      setNoteState('idle');
                      throw caught;
                    }
                  })
                }
              >
                Save Notes
              </Button>
            </div>
          </Card>

          <Card className="bg-surface-container-low">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
                <Icon name="forum" className="text-[20px]" />
              </span>
              <div>
                <h3 className="text-body-md font-semibold text-on-surface">
                  Chat history is private
                </h3>
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  Firestore rules only expose a conversation to its two participants, so the portal
                  cannot read trader messages. Export the thread from the Firebase console with an
                  Admin SDK script if a case needs it.
                </p>
                <button
                  type="button"
                  disabled
                  className="mt-sm inline-flex cursor-not-allowed items-center gap-1.5 rounded-full border border-outline-variant/70 px-3 py-1.5 text-label-md text-on-surface-variant opacity-60"
                >
                  <Icon name="history" className="text-[17px]" />
                  View Full Chat History
                </button>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-md">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Actions</h3>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Moderation fields are the only profile fields an admin can write.
            </p>

            <div className="mt-sm flex flex-col gap-xs">
              <ConfirmButton
                label="Send Official Warning"
                icon="warning_amber"
                variant="secondary"
                size="lg"
                className="w-full"
                disabled={!trader}
                title={`Warn ${displayName}?`}
                message="Flags the account for review and drops the trust score by 5."
                confirmLabel="Send warning"
                onConfirm={() =>
                  run(async () => {
                    if (!trader) return;
                    await updateUserModeration(trader.id, {
                      moderation_status: 'flagged',
                      admin_notes: notes || 'Official warning issued.',
                      trust_score: Math.max(0, (trader.trust_score ?? 100) - 5),
                    });
                  })
                }
              />

              <div className="mt-sm">
                <p className="text-label-md text-on-surface">Temporary Suspension</p>
                <div className="mt-1.5 flex flex-wrap gap-1 rounded-full bg-surface-container p-1">
                  {SUSPENSION_OPTIONS.map((option) => (
                    <button
                      key={option.hours}
                      type="button"
                      onClick={() => setHours(option.hours)}
                      className={`flex-1 rounded-full px-3 py-1.5 text-label-md transition-colors ${
                        hours === option.hours
                          ? 'bg-primary text-on-primary shadow-sm'
                          : 'text-on-surface-variant hover:text-primary'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <ConfirmButton
                label="Suspend User"
                icon="timer"
                variant="danger"
                size="lg"
                className="w-full"
                disabled={!trader}
                title={`Suspend ${displayName}?`}
                message={`Blocks posting and trading for ${hours} hours.`}
                confirmLabel="Suspend"
                onConfirm={() =>
                  run(async () => {
                    if (!trader) return;
                    await updateUserModeration(trader.id, {
                      moderation_status: 'suspended',
                      suspended_until: Date.now() + hours * 3_600_000,
                    });
                  })
                }
              />

              <ConfirmButton
                label="Permanent Ban"
                icon="block"
                variant="danger"
                size="lg"
                className="w-full"
                disabled={!trader}
                title={`Permanently ban ${displayName}?`}
                message="This removes the account from the community and is hard to reverse."
                confirmLabel="Ban permanently"
                onConfirm={() =>
                  run(async () => {
                    if (!trader) return;
                    await updateUserModeration(trader.id, { moderation_status: 'banned' });
                  })
                }
              />

              {trader && trader.moderation_status && trader.moderation_status !== 'clear' ? (
                <Button
                  variant="ghost"
                  size="lg"
                  icon="check_circle"
                  className="w-full"
                  onClick={() =>
                    run(() =>
                      updateUserModeration(trader.id, { moderation_status: 'clear', suspended_until: 0 }),
                    )
                  }
                >
                  Clear moderation
                </Button>
              ) : null}
            </div>
          </Card>

          <Card>
            <div className="flex flex-col items-center text-center">
              <Avatar src={trader?.avatar_url} name={displayName} size="xl" />
              <h3 className="mt-sm text-headline-sm text-on-surface">{displayName}</h3>
              {trader?.username ? (
                <p className="text-body-sm text-on-surface-variant">@{trader.username}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                <Pill tone={statusTone}>{statusLabel}</Pill>
                {trader?.district ? <Pill tone="neutral">{trader.district}</Pill> : null}
              </div>
            </div>

            <dl className="mt-md grid grid-cols-2 gap-sm border-t border-outline-variant/40 pt-sm text-body-sm">
              <div>
                <dt className="text-on-surface-variant">Reports (all)</dt>
                <dd className="mt-0.5 font-semibold text-on-surface">{mine.length}</dd>
              </div>
              <div>
                <dt className="text-on-surface-variant">Rating</dt>
                <dd className="mt-0.5 font-semibold text-on-surface">
                  {trader?.rating ? trader.rating.toFixed(1) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-on-surface-variant">Eco points</dt>
                <dd className="mt-0.5 font-semibold text-on-surface">{trader?.eco_points ?? 0}</dd>
              </div>
              <div>
                <dt className="text-on-surface-variant">Verified</dt>
                <dd className="mt-0.5 font-semibold text-on-surface">
                  {trader?.is_verified ? 'Yes' : 'No'}
                </dd>
              </div>
            </dl>

            <Button
              variant="secondary"
              icon="gavel"
              className="mt-md w-full"
              onClick={() => navigate('/auctions')}
            >
              Review auctions
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

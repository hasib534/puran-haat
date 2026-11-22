import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  Avatar,
  Card,
  EmptyState,
  ErrorNote,
  Icon,
  PageHeader,
  Pill,
  Spinner,
  inputClass,
} from '../components/ui';
import { useLiveCollection } from '../hooks/useLive';
import { watchReports, watchUsers, watchVerifications } from '../lib/admin';
import { memberSince, relativeTime, riskLabel } from '../lib/format';
import { toProfile, toReport, toVerification, type Profile } from '../lib/models';

type Tab = 'pending' | 'flagged' | 'all';

function moderationLabel(profile: Profile, reportCount: number) {
  if (profile.moderation_status === 'banned') return { tone: 'danger' as const, label: 'Banned' };
  if (profile.moderation_status === 'suspended') return { tone: 'danger' as const, label: 'Suspended' };
  if (profile.moderation_status === 'flagged' || reportCount > 0) {
    return { tone: 'warn' as const, label: 'Flagged' };
  }
  return { tone: 'ok' as const, label: 'Clear' };
}

export function UsersPage() {
  const navigate = useNavigate();

  const users = useLiveCollection(watchUsers, toProfile);
  const reports = useLiveCollection(watchReports, toReport);
  const verifications = useLiveCollection(watchVerifications, toVerification);

  const [tab, setTab] = useState<Tab>('pending');
  const [query, setQuery] = useState('');

  const openReports = useMemo(
    () => reports.data.filter((report) => report.status === 'open'),
    [reports.data],
  );

  const reportsByUser = useMemo(() => {
    const map = new Map<string, number>();
    openReports.forEach((report) => {
      map.set(report.user_id, (map.get(report.user_id) ?? 0) + 1);
    });
    return map;
  }, [openReports]);

  const pending = useMemo(
    () =>
      verifications.data
        .filter((entry) => entry.status === 'pending')
        .sort((a, b) => b.submitted_at - a.submitted_at),
    [verifications.data],
  );

  const pendingByUser = useMemo(() => {
    const map = new Map<string, number>();
    pending.forEach((entry) => {
      map.set(entry.user_id, (map.get(entry.user_id) ?? 0) + 1);
    });
    return map;
  }, [pending]);

  const flagged = useMemo(
    () =>
      users.data
        .filter(
          (profile) =>
            (profile.moderation_status && profile.moderation_status !== 'clear') ||
            (reportsByUser.get(profile.id) ?? 0) > 0,
        )
        .sort((a, b) => (reportsByUser.get(b.id) ?? 0) - (reportsByUser.get(a.id) ?? 0)),
    [reportsByUser, users.data],
  );

  const needle = query.trim().toLowerCase();

  const pendingRows = useMemo(
    () =>
      pending.filter((entry) =>
        needle
          ? [entry.full_name, entry.username, entry.document_type, entry.user_id]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(needle))
          : true,
      ),
    [needle, pending],
  );

  const traderRows = useMemo(() => {
    const source = tab === 'flagged' ? flagged : users.data;
    return [...source]
      .filter((profile) =>
        needle
          ? [profile.full_name, profile.username, profile.district, profile.id]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(needle))
          : true,
      )
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [flagged, needle, tab, users.data]);

  const loading = users.loading || reports.loading || verifications.loading;
  const error = users.error || reports.error || verifications.error;

  const tabs: Array<{ key: Tab; label: string; count: number }> = [
    { key: 'pending', label: 'Pending Verification', count: pending.length },
    { key: 'flagged', label: 'Flagged Users', count: flagged.length },
    { key: 'all', label: 'All Traders', count: users.data.length },
  ];

  return (
    <div className="flex flex-col gap-md">
      <PageHeader
        title="User Management"
        description="Verify new traders and moderate flagged accounts to maintain community trust."
      >
        <div className="relative w-full sm:w-72">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[19px] text-on-surface-variant"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search traders..."
            aria-label="Search traders"
            className={`${inputClass} pl-10`}
          />
        </div>
      </PageHeader>

      {error ? <ErrorNote>Could not read user data: {error}</ErrorNote> : null}

      <div className="flex flex-wrap gap-1 rounded-full bg-surface-container p-1 sm:self-start">
        {tabs.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              aria-pressed={active}
              className={`rounded-full px-3.5 py-1.5 text-label-md transition-colors ${
                active ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              {item.label} ({item.count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <Spinner label="Loading traders..." />
      ) : tab === 'pending' ? (
        pendingRows.length === 0 ? (
          <EmptyState
            icon="verified_user"
            title="No requests waiting"
            description="Identity submissions appear here as traders request a verified badge."
          />
        ) : (
          <Card className="p-0">
            <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_120px_210px] gap-sm border-b border-outline-variant/40 px-md py-2 text-label-md uppercase tracking-wider text-on-surface-variant lg:grid">
              <span>Trader</span>
              <span>Documents</span>
              <span>Risk</span>
              <span className="text-right">Decision</span>
            </div>
            <ul className="divide-y divide-outline-variant/30">
              {pendingRows.map((request) => {
                const risk = riskLabel(request.risk_score);
                return (
                  <li
                    key={request.id}
                    className="flex flex-col gap-sm px-md py-sm transition-colors hover:bg-surface-container-low/60 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_120px_210px] lg:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-sm">
                      <Avatar src={request.avatar_url} name={request.full_name} />
                      <div className="min-w-0">
                        <p className="truncate text-body-md font-semibold text-on-surface">
                          {request.full_name}
                        </p>
                        <p className="truncate text-body-sm text-on-surface-variant">
                          {request.username ? `@${request.username} · ` : ''}
                          {request.district || 'District unknown'} · {relativeTime(request.submitted_at)}
                        </p>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-body-sm text-on-surface">
                        <Icon name="description" className="text-[17px] text-on-surface-variant" />
                        {request.document_type}
                      </p>
                      <p className="text-body-sm text-on-surface-variant">
                        {request.file_count} file{request.file_count === 1 ? '' : 's'} uploaded
                      </p>
                    </div>
                    <div>
                      <Pill tone={risk.tone === 'ok' ? 'ok' : risk.tone === 'warn' ? 'warn' : 'danger'}>
                        {risk.label}
                      </Pill>
                    </div>
                    <div className="flex flex-wrap items-center gap-xs lg:justify-end">
                      <button
                        type="button"
                        onClick={() => navigate(`/verifications/${request.id}`)}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-label-md text-primary transition-colors hover:bg-primary-fixed/40"
                      >
                        <Icon name="visibility" className="text-[17px]" />
                        View docs
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )
      ) : traderRows.length === 0 ? (
        <EmptyState
          icon={tab === 'flagged' ? 'flag' : 'group'}
          title={tab === 'flagged' ? 'No flagged accounts' : 'No traders found'}
          description={
            tab === 'flagged'
              ? 'Reports and moderation decisions will surface the accounts that need attention.'
              : 'Traders appear here once they create a profile from the app.'
          }
        />
      ) : (
        <Card className="p-0">
          <div className="hidden grid-cols-[minmax(0,2fr)_140px_150px_100px_120px_120px] gap-sm border-b border-outline-variant/40 px-md py-2 text-label-md uppercase tracking-wider text-on-surface-variant xl:grid">
            <span>Trader</span>
            <span>Joined</span>
            <span>Trust score</span>
            <span>Reports</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>
          <ul className="divide-y divide-outline-variant/30">
            {traderRows.map((profile) => {
              const reportCount = reportsByUser.get(profile.id) ?? 0;
              const trust = profile.trust_score ?? 100;
              const status = moderationLabel(profile, reportCount);
              const pendingCount = pendingByUser.get(profile.id) ?? 0;
              return (
                <li
                  key={profile.id}
                  className="flex flex-col gap-sm px-md py-sm transition-colors hover:bg-surface-container-low/60 xl:grid xl:grid-cols-[minmax(0,2fr)_140px_150px_100px_120px_120px] xl:items-center"
                >
                  <div className="flex min-w-0 items-center gap-sm">
                    <Avatar src={profile.avatar_url} name={profile.full_name} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-body-md font-semibold text-on-surface">
                        <Link to={`/users/${profile.id}`} className="hover:text-primary hover:underline">
                          {profile.full_name}
                        </Link>
                        {profile.is_verified ? (
                          <Icon name="verified" className="text-[16px] text-primary" filled />
                        ) : null}
                      </p>
                      <p className="truncate text-body-sm text-on-surface-variant">
                        {profile.username ? `@${profile.username} · ` : ''}
                        {profile.district || 'Location not shared'}
                      </p>
                    </div>
                  </div>

                  <p className="text-body-sm text-on-surface-variant">{memberSince(profile.joined_at)}</p>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-body-sm font-semibold ${trust < 50 ? 'text-error' : 'text-primary'}`}
                    >
                      {trust}
                    </span>
                    <span className="h-1.5 w-full max-w-24 overflow-hidden rounded-full bg-surface-variant">
                      <span
                        className={`block h-full rounded-full ${trust < 50 ? 'bg-error' : 'bg-primary'}`}
                        style={{ width: `${Math.max(0, Math.min(100, trust))}%` }}
                      />
                    </span>
                  </div>

                  <div>
                    {reportCount > 0 ? (
                      <Pill tone="danger">{reportCount} open</Pill>
                    ) : (
                      <span className="text-body-sm text-on-surface-variant">None</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Pill tone={status.tone}>{status.label}</Pill>
                    {pendingCount > 0 ? <Pill tone="info">Docs pending</Pill> : null}
                  </div>

                  <div className="flex justify-start xl:justify-end">
                    <Link
                      to={`/users/${profile.id}`}
                      className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-label-md text-primary transition-colors hover:bg-primary-fixed/40"
                    >
                      <Icon name="search" className="text-[17px]" />
                      Investigate
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthProvider';
import {
  Avatar,
  Card,
  ConfirmButton,
  EmptyState,
  ErrorNote,
  Icon,
  PageHeader,
  Pill,
  Spinner,
  inputClass,
} from '../components/ui';
import { useLiveCollection } from '../hooks/useLive';
import { decideVerification, watchVerifications } from '../lib/admin';
import { formatDate, riskLabel } from '../lib/format';
import { toVerification, type VerificationRequest, type VerificationStatus } from '../lib/models';

const FILTERS: Array<{ key: 'pending' | 'approved' | 'rejected' | 'all'; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

const STATUS_TONE: Record<VerificationStatus, 'warn' | 'ok' | 'danger'> = {
  pending: 'warn',
  approved: 'ok',
  rejected: 'danger',
};

export function VerificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error: liveError } = useLiveCollection(watchVerifications, toVerification);

  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('pending');
  const [query, setQuery] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      pending: data.filter((entry) => entry.status === 'pending').length,
      approved: data.filter((entry) => entry.status === 'approved').length,
      rejected: data.filter((entry) => entry.status === 'rejected').length,
      all: data.length,
    }),
    [data],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data
      .filter((entry) => (filter === 'all' ? true : entry.status === filter))
      .filter((entry) =>
        needle
          ? [entry.full_name, entry.username, entry.document_type, entry.user_id]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(needle))
          : true,
      )
      .sort((a, b) => b.submitted_at - a.submitted_at);
  }, [data, filter, query]);

  const decide = async (request: VerificationRequest, status: 'approved' | 'rejected') => {
    if (!user) return;
    setActionError(null);
    try {
      await decideVerification(request, status, user.uid);
    } catch (caught) {
      setActionError((caught as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-md">
      <PageHeader
        title="User Verification"
        description="Review identity documents before granting a verified badge. Approving a request also marks the trader verified on their public profile."
      >
        <Pill tone="warn">
          <Icon name="hourglass_empty" className="text-[15px]" />
          {counts.pending} pending
        </Pill>
      </PageHeader>

      <div className="flex flex-col gap-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1 rounded-full bg-surface-container p-1">
          {FILTERS.map((item) => {
            const active = filter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`rounded-full px-3.5 py-1.5 text-label-md transition-colors ${
                  active
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                {item.label} ({counts[item.key]})
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:max-w-[20rem]">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[19px] text-on-surface-variant"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, username or document"
            className={`${inputClass} pl-10`}
            aria-label="Search verification requests"
          />
        </div>
      </div>

      {liveError ? <ErrorNote>{liveError}</ErrorNote> : null}
      {actionError ? <ErrorNote>{actionError}</ErrorNote> : null}

      {loading ? (
        <Spinner label="Loading verification requests…" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="verified_user"
          title={filter === 'pending' ? 'No requests waiting' : 'Nothing in this view'}
          description={
            filter === 'pending'
              ? 'New identity submissions will appear here as traders request a verified badge.'
              : 'Try another filter or clear the search.'
          }
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
            {visible.map((request) => {
              const risk = riskLabel(request.risk_score);
              return (
                <li
                  key={request.id}
                  className="flex flex-col gap-sm px-md py-sm transition-colors hover:bg-surface-container-low/60 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_120px_210px] lg:items-center"
                >
                  <div className="flex min-w-0 items-center gap-sm">
                    <Avatar src={request.avatar_url} name={request.full_name} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-body-md font-semibold text-on-surface">
                        {request.full_name}
                        {request.status !== 'pending' ? (
                          <Pill tone={STATUS_TONE[request.status]}>{request.status}</Pill>
                        ) : null}
                      </p>
                      <p className="truncate text-body-sm text-on-surface-variant">
                        {request.username ? `@${request.username} · ` : ''}
                        {request.district || 'District unknown'} · submitted{' '}
                        {formatDate(request.submitted_at)}
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

                    {request.status === 'pending' ? (
                      <>
                        <ConfirmButton
                          label="Approve"
                          icon="check"
                          variant="primary"
                          title={`Approve ${request.full_name}?`}
                          message="The request moves to approved and the trader's profile is marked verified."
                          confirmLabel="Approve user"
                          onConfirm={() => decide(request, 'approved')}
                        />
                        <ConfirmButton
                          label="Reject"
                          icon="close"
                          variant="danger"
                          title={`Reject ${request.full_name}?`}
                          message="The request moves to rejected. The trader can submit new documents later."
                          confirmLabel="Reject request"
                          onConfirm={() => decide(request, 'rejected')}
                        />
                      </>
                    ) : null}
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
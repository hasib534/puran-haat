import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../auth/AuthProvider';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Icon,
  Modal,
  PageHeader,
  Pill,
  Spinner,
  inputClass,
} from '../components/ui';
import { useLiveCollection } from '../hooks/useLive';
import { grantReward, watchBadges, watchGrants, watchItems, watchUsers } from '../lib/admin';
import { formatDate, formatPoints } from '../lib/format';
import { toBadge, toGrant, toItem, toProfile, type Profile } from '../lib/models';

export function RewardsPage() {
  const { user } = useAuth();

  const users = useLiveCollection(watchUsers, toProfile);
  const items = useLiveCollection(watchItems, toItem);
  const grants = useLiveCollection(watchGrants, toGrant);
  const badges = useLiveCollection(watchBadges, toBadge);

  const [awardOpen, setAwardOpen] = useState(false);
  const [recipientId, setRecipientId] = useState('');
  const [points, setPoints] = useState('250');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const contributors = useMemo(
    () =>
      [...users.data]
        .sort((a, b) => (b.eco_points || b.trade_count) - (a.eco_points || a.trade_count))
        .slice(0, 5),
    [users.data],
  );

  const co2Prevented = useMemo(
    () => items.data.reduce((sum, item) => sum + (item.co2_saved_kg || 0), 0),
    [items.data],
  );

  const ecoPointsAwarded = useMemo(
    () => users.data.reduce((sum, profile) => sum + (profile.eco_points || 0), 0),
    [users.data],
  );

  const history = useMemo(
    () => [...grants.data].sort((a, b) => b.created_at - a.created_at),
    [grants.data],
  );

  const loading = users.loading && items.loading && grants.loading;

  const selected: Profile | undefined = users.data.find((profile) => profile.id === recipientId);

  const award = async () => {
    setError(null);
    const amount = Number(points.replace(/[^0-9.]/g, ''));
    if (!selected) {
      setError('Choose a recipient from the directory.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter how many eco-points to award.');
      return;
    }

    setBusy(true);
    try {
      await grantReward({
        recipient_id: selected.id,
        recipient_name: selected.full_name,
        reward_type: `Eco-Points (${formatPoints(amount)})`,
        reason: reason.trim() || 'Manual admin distribution',
        awarded_by: user?.email ?? 'Puran Haat Admin',
        created_at: Date.now(),
      });
      setNotice(`${formatPoints(amount)} eco-points recorded for ${selected.full_name}.`);
      setAwardOpen(false);
      setReason('');
      setRecipientId('');
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-md">
      <PageHeader
        title="Rewards & Recognition"
        description="Acknowledge and incentivise sustainable actions within the community."
      >
        <Button variant="primary" icon="send" onClick={() => setAwardOpen(true)}>
          Award points
        </Button>
        <Link
          to="/rewards/configure"
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-primary/25 px-4 py-2.5 text-label-md font-semibold text-primary transition-colors hover:bg-primary-fixed/40"
        >
          <Icon name="tune" className="text-[17px]" />
          Configure rewards
        </Link>
      </PageHeader>

      {error && !awardOpen ? <ErrorNote>{error}</ErrorNote> : null}
      {notice ? (
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary-fixed/40 px-3 py-2 text-body-sm text-on-primary-fixed">
          <Icon name="check_circle" className="text-[18px]" />
          <span>{notice}</span>
        </div>
      ) : null}

      {loading ? (
        <Spinner label="Loading reward data..." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Card>
              <div className="mb-sm flex items-center gap-2">
                <Icon name="leaderboard" className="text-[20px] text-primary" />
                <h3 className="text-headline-sm text-on-surface">Top Contributors</h3>
              </div>

              {contributors.length === 0 ? (
                <EmptyState
                  icon="emoji_events"
                  title="No contributors yet"
                  description="Traders appear here as they complete trades and earn eco-points."
                />
              ) : (
                <ul className="flex flex-col divide-y divide-outline-variant/30">
                  {contributors.map((profile, index) => (
                    <li key={profile.id} className="flex items-center gap-sm py-sm">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-label-md font-bold ${
                          index === 0 ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <Avatar src={profile.avatar_url} name={profile.full_name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-body-md font-semibold text-on-surface">
                          <Link to={`/users/${profile.id}`} className="hover:text-primary hover:underline">
                            {profile.full_name}
                          </Link>
                          {profile.is_verified ? (
                            <Icon name="verified" className="text-[15px] text-primary" filled />
                          ) : null}
                        </p>
                        <p className="truncate text-body-sm text-on-surface-variant">
                          {formatPoints(profile.eco_points)} EP · {profile.trade_count} trades
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="workspace_premium"
                        onClick={() => {
                          setRecipientId(profile.id);
                          setAwardOpen(true);
                        }}
                      >
                        Reward
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <div className="mb-sm flex items-center gap-2">
                <Icon name="eco" className="text-[20px] text-primary" />
                <h3 className="text-headline-sm text-on-surface">Community Impact</h3>
              </div>
              <p className="text-body-sm text-on-surface-variant">Total contributions across the marketplace.</p>

              <dl className="mt-sm flex flex-col gap-sm">
                <div className="rounded-lg bg-surface-container-low px-3 py-2.5">
                  <dt className="text-label-md text-on-surface-variant">CO2 Prevented</dt>
                  <dd className="mt-0.5 text-headline-md font-semibold text-primary">
                    {formatPoints(co2Prevented)} kg
                  </dd>
                </div>
                <div className="rounded-lg bg-surface-container-low px-3 py-2.5">
                  <dt className="text-label-md text-on-surface-variant">Items Diverted</dt>
                  <dd className="mt-0.5 text-headline-md font-semibold text-primary">
                    {formatPoints(items.data.length)}
                  </dd>
                </div>
                <div className="rounded-lg bg-surface-container-low px-3 py-2.5">
                  <dt className="text-label-md text-on-surface-variant">Eco-Points Awarded</dt>
                  <dd className="mt-0.5 text-headline-md font-semibold text-primary">
                    {formatPoints(ecoPointsAwarded)} EP
                  </dd>
                </div>
              </dl>
            </Card>
          </div>

          <Card className="p-0">
            <div className="flex items-center justify-between px-md py-sm">
              <h3 className="flex items-center gap-2 text-headline-sm text-on-surface">
                <Icon name="history" className="text-[20px] text-primary" />
                Reward History
              </h3>
              <span className="text-body-sm text-on-surface-variant">{history.length} grants</span>
            </div>

            {history.length === 0 ? (
              <div className="px-md pb-md">
                <EmptyState
                  icon="redeem"
                  title="No rewards granted yet"
                  description="Points, badges and manual grants will be listed here."
                />
              </div>
            ) : (
              <div className="overflow-x-auto border-t border-outline-variant/40">
                <table className="w-full min-w-[720px] text-left">
                  <thead className="bg-surface-container-low text-label-md uppercase tracking-wider text-on-surface-variant">
                    <tr>
                      <th className="px-md py-2 font-semibold">Date</th>
                      <th className="px-md py-2 font-semibold">Recipient</th>
                      <th className="px-md py-2 font-semibold">Reward Type</th>
                      <th className="px-md py-2 font-semibold">Reason</th>
                      <th className="px-md py-2 font-semibold">Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {history.map((grant) => (
                      <tr key={grant.id} className="align-top">
                        <td className="whitespace-nowrap px-md py-sm text-body-sm text-on-surface-variant">
                          {formatDate(grant.created_at)}
                        </td>
                        <td className="px-md py-sm text-body-sm font-semibold text-on-surface">
                          <Link to={`/users/${grant.recipient_id}`} className="hover:text-primary hover:underline">
                            {grant.recipient_name}
                          </Link>
                        </td>
                        <td className="px-md py-sm">
                          <Pill tone={grant.reward_type.includes('Badge') ? 'info' : 'ok'}>
                            {grant.reward_type}
                          </Pill>
                        </td>
                        <td className="px-md py-sm text-body-sm text-on-surface-variant">{grant.reason}</td>
                        <td className="px-md py-sm text-body-sm text-on-surface-variant">{grant.awarded_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-sm">
              <div>
                <h3 className="flex items-center gap-2 text-headline-sm text-on-surface">
                  <Icon name="stars" className="text-[20px] text-primary" />
                  Badge Management
                </h3>
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  Recognition tiers available to grant from this portal.
                </p>
              </div>
              <Link
                to="/rewards/configure"
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 px-3 py-1.5 text-label-md font-semibold text-primary transition-colors hover:bg-primary-fixed/40"
              >
                <Icon name="tune" className="text-[17px]" />
                Manage badges
              </Link>
            </div>

            {badges.data.length === 0 ? (
              <div className="mt-sm">
                <EmptyState
                  icon="workspace_premium"
                  title="No badges configured"
                  description="Create tiers like Sustainability Hero or Pro Fixer in Reward Configuration."
                />
              </div>
            ) : (
              <ul className="mt-sm grid grid-cols-1 gap-sm sm:grid-cols-2 xl:grid-cols-3">
                {badges.data.map((badge) => (
                  <li
                    key={badge.id}
                    className="flex items-start gap-3 rounded-lg border border-surface-variant/60 bg-surface-container-lowest p-sm"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container/20 text-primary">
                      <Icon name={badge.icon} className="text-[20px]" filled />
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-body-md font-semibold text-on-surface">
                        {badge.name}
                        <Pill tone={badge.active ? 'ok' : 'neutral'}>
                          {badge.active ? 'Active' : 'Inactive'}
                        </Pill>
                      </p>
                      <p className="mt-0.5 text-body-sm text-on-surface-variant">{badge.description}</p>
                      <p className="mt-1 text-label-md text-on-surface-variant">Tier {badge.tier}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <Modal
        open={awardOpen}
        title="Award eco-points"
        description="Records a manual reward grant. The mobile app reads this ledger when it awards points."
        onClose={() => (busy ? undefined : setAwardOpen(false))}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAwardOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" icon="send" onClick={award} loading={busy}>
              Award points
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-sm">
          <Field label="Recipient" required>
            <select
              value={recipientId}
              onChange={(event) => setRecipientId(event.target.value)}
              className={inputClass}
            >
              <option value="">Select a trader…</option>
              {[...users.data]
                .sort((a, b) => a.full_name.localeCompare(b.full_name))
                .map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name}
                    {profile.username ? ` (@${profile.username})` : ''}
                  </option>
                ))}
            </select>
          </Field>

          <Field label="Points to Award" required hint={`${formatPoints(Number(points) || 0)} EP`}>
            <input
              type="number"
              min={1}
              value={points}
              onChange={(event) => setPoints(event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Reason (optional)">
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Milestone: 50 items shared"
              className={inputClass}
              maxLength={140}
            />
          </Field>

          {error ? <ErrorNote>{error}</ErrorNote> : null}
        </div>
      </Modal>
    </div>
  );
}

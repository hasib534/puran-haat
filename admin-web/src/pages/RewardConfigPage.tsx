import { useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import {
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
import {
  grantReward,
  saveBadge,
  saveRewardRule,
  watchBadges,
  watchRewardRules,
  watchUsers,
} from '../lib/admin';
import { formatPoints } from '../lib/format';
import { toBadge, toProfile, toRule, type RewardBadge, type RewardRule } from '../lib/models';

const BADGE_ICONS = ['eco', 'build', 'local_shipping', 'workspace_premium', 'recycling', 'volunteer_activism'];

export function RewardConfigPage() {
  const { user } = useAuth();

  const rules = useLiveCollection(watchRewardRules, toRule);
  const badges = useLiveCollection(watchBadges, toBadge);
  const users = useLiveCollection(watchUsers, toProfile);

  const [ruleDraft, setRuleDraft] = useState<RewardRule | null>(null);
  const [badgeDraft, setBadgeDraft] = useState<RewardBadge | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [recipientId, setRecipientId] = useState('');
  const [points, setPoints] = useState('250');
  const [reason, setReason] = useState('');

  const newRule = (): RewardRule => ({
    id: `rule-${Date.now().toString(36)}`,
    name: '',
    multiplier: 2,
    active: true,
    note: '',
  });

  const newBadge = (): RewardBadge => ({
    id: `badge-${Date.now().toString(36)}`,
    name: '',
    description: '',
    tier: 1,
    active: true,
    icon: 'eco',
  });

  const run = async (key: string, action: () => Promise<void>, message: string) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      setNotice(message);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const award = async () => {
    const target = users.data.find((profile) => profile.id === recipientId);
    const amount = Number(points);
    setError(null);

    if (!target) {
      setError('Pick a trader from the directory.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a positive number of eco-points.');
      return;
    }

    await run(
      'award',
      () =>
        grantReward({
          recipient_id: target.id,
          recipient_name: target.full_name,
          reward_type: `Eco-Points (${formatPoints(amount)})`,
          reason: reason.trim() || 'Manual distribution',
          awarded_by: user?.email ?? 'Puran Haat Admin',
          created_at: Date.now(),
        }),
      `Awarded ${formatPoints(amount)} eco-points to ${target.full_name}.`,
    );
    setReason('');
  };

  return (
    <div className="flex flex-col gap-md">
      <PageHeader
        title="Reward Configuration"
        description="Manage multipliers, badges and manual distributions."
      >
        <Button variant="primary" icon="add" onClick={() => setRuleDraft(newRule())}>
          New Rule
        </Button>
      </PageHeader>

      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {notice ? (
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary-fixed/40 px-3 py-2 text-body-sm text-on-primary-fixed">
          <Icon name="check_circle" className="text-[18px]" />
          <span>{notice}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="p-0">
          <div className="flex items-center justify-between px-md py-sm">
            <h3 className="flex items-center gap-2 text-headline-sm text-on-surface">
              <Icon name="trending_up" className="text-[20px] text-primary" />
              Eco-Point Multipliers
            </h3>
            <span className="text-body-sm text-on-surface-variant">
              {rules.data.filter((rule) => rule.active).length} active
            </span>
          </div>

          {rules.loading ? (
            <div className="px-md pb-md">
              <Spinner label="Loading rules..." />
            </div>
          ) : rules.data.length === 0 ? (
            <div className="px-md pb-md">
              <EmptyState
                icon="trending_up"
                title="No multipliers configured"
                description="Add a rule to boost eco-points during campaigns or for new traders."
              >
                <Button variant="primary" icon="add" onClick={() => setRuleDraft(newRule())}>
                  New Rule
                </Button>
              </EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-outline-variant/30 border-t border-outline-variant/40">
              {rules.data.map((rule) => (
                <li key={rule.id} className="flex flex-wrap items-center gap-sm px-md py-sm">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-body-md font-semibold text-on-surface">
                      {rule.name || 'Untitled rule'}
                      <Pill tone={rule.active ? 'ok' : 'neutral'}>
                        {rule.active ? 'Active' : 'Inactive'}
                      </Pill>
                    </p>
                    <p className="text-body-sm text-on-surface-variant">{rule.note || 'No note'}</p>
                  </div>

                  <span className="rounded-full bg-primary-container/20 px-3 py-1 text-body-md font-semibold text-primary">
                    {rule.multiplier.toFixed(1)}x
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={rule.active ? 'toggle_on' : 'toggle_off'}
                      loading={busy === `toggle-${rule.id}`}
                      onClick={() =>
                        run(
                          `toggle-${rule.id}`,
                          () => saveRewardRule({ ...rule, active: !rule.active }),
                          `${rule.name || 'Rule'} is now ${rule.active ? 'inactive' : 'active'}.`,
                        )
                      }
                    >
                      {rule.active ? 'Disable' : 'Enable'}
                    </Button>
                    <Button variant="ghost" size="sm" icon="edit" onClick={() => setRuleDraft(rule)}>
                      Edit
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="flex items-center gap-2 text-headline-sm text-on-surface">
            <Icon name="send" className="text-[20px] text-primary" />
            Manual Distribution
          </h3>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Award points directly to a specific user account.
          </p>

          <div className="mt-sm flex flex-col gap-sm">
            <Field label="User" required hint="Traders come from the users collection.">
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

            <Field label="Points to Award" required>
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
                placeholder="Exceptional repair workshop"
                className={inputClass}
                maxLength={140}
              />
            </Field>

            <Button
              variant="primary"
              icon="send"
              loading={busy === 'award'}
              onClick={award}
              className="w-full"
            >
              Award Points
            </Button>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-sm">
          <h3 className="flex items-center gap-2 text-headline-sm text-on-surface">
            <Icon name="stars" className="text-[20px] text-primary" />
            Badge Management
          </h3>
          <Button variant="secondary" icon="add_circle" onClick={() => setBadgeDraft(newBadge())}>
            Create New Badge
          </Button>
        </div>

        {badges.loading ? (
          <div className="mt-sm">
            <Spinner label="Loading badges..." />
          </div>
        ) : badges.data.length === 0 ? (
          <div className="mt-sm">
            <EmptyState
              icon="workspace_premium"
              title="No badges yet"
              description="Create recognition tiers that admins can grant to traders."
            />
          </div>
        ) : (
          <ul className="mt-sm grid grid-cols-1 gap-sm sm:grid-cols-2 xl:grid-cols-3">
            {badges.data.map((badge) => (
              <li
                key={badge.id}
                className="flex flex-col gap-sm rounded-lg border border-surface-variant/60 bg-surface-container-lowest p-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container/20 text-primary">
                    <Icon name={badge.icon} className="text-[20px]" filled />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-body-md font-semibold text-on-surface">{badge.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-body-sm text-on-surface-variant">
                      {badge.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Pill tone={badge.active ? 'ok' : 'neutral'}>
                      {badge.active ? 'Active' : 'Inactive'}
                    </Pill>
                    <Pill tone="neutral">Tier {badge.tier}</Pill>
                  </span>
                  <Button variant="ghost" size="sm" icon="edit" onClick={() => setBadgeDraft(badge)}>
                    Edit
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Rule editor */}
      <Modal
        open={Boolean(ruleDraft)}
        title={ruleDraft && rules.data.some((rule) => rule.id === ruleDraft.id) ? 'Edit rule' : 'New multiplier rule'}
        description="Multipliers apply to eco-points earned while the rule is active."
        onClose={() => setRuleDraft(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRuleDraft(null)} disabled={busy === 'rule'}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon="save"
              loading={busy === 'rule'}
              onClick={() => {
                if (!ruleDraft) return;
                if (!ruleDraft.name.trim()) {
                  setError('Give the rule a name.');
                  return;
                }
                void run(
                  'rule',
                  () => saveRewardRule({ ...ruleDraft, name: ruleDraft.name.trim() }),
                  'Rule saved.',
                ).then(() => setRuleDraft(null));
              }}
            >
              Save rule
            </Button>
          </>
        }
      >
        {ruleDraft ? (
          <div className="flex flex-col gap-sm">
            <Field label="Rule name" required>
              <input
                value={ruleDraft.name}
                onChange={(event) => setRuleDraft({ ...ruleDraft, name: event.target.value })}
                placeholder="Weekend Trades"
                className={inputClass}
                maxLength={60}
              />
            </Field>
            <div className="grid grid-cols-2 gap-sm">
              <Field label="Multiplier" required>
                <input
                  type="number"
                  min={1}
                  step={0.5}
                  value={ruleDraft.multiplier}
                  onChange={(event) =>
                    setRuleDraft({ ...ruleDraft, multiplier: Number(event.target.value) || 1 })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Note">
                <input
                  value={ruleDraft.note}
                  onChange={(event) => setRuleDraft({ ...ruleDraft, note: event.target.value })}
                  placeholder="Active Sat–Sun"
                  className={inputClass}
                  maxLength={60}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2.5 rounded-lg bg-surface-container-low px-3 py-2.5 text-body-sm">
              <input
                type="checkbox"
                checked={ruleDraft.active}
                onChange={(event) => setRuleDraft({ ...ruleDraft, active: event.target.checked })}
                className="h-4 w-4 accent-[#154212]"
              />
              <span className="font-semibold text-on-surface">Rule is active</span>
            </label>
          </div>
        ) : null}
      </Modal>

      {/* Badge editor */}
      <Modal
        open={Boolean(badgeDraft)}
        title={badgeDraft && badges.data.some((badge) => badge.id === badgeDraft.id) ? 'Edit badge' : 'Create badge'}
        description="Badges are recognition tiers admins can grant from the rewards page."
        onClose={() => setBadgeDraft(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setBadgeDraft(null)} disabled={busy === 'badge'}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon="save"
              loading={busy === 'badge'}
              onClick={() => {
                if (!badgeDraft) return;
                if (!badgeDraft.name.trim()) {
                  setError('Give the badge a name.');
                  return;
                }
                void run(
                  'badge',
                  () => saveBadge({ ...badgeDraft, name: badgeDraft.name.trim() }),
                  'Badge saved.',
                ).then(() => setBadgeDraft(null));
              }}
            >
              Save badge
            </Button>
          </>
        }
      >
        {badgeDraft ? (
          <div className="flex flex-col gap-sm">
            <Field label="Badge name" required>
              <input
                value={badgeDraft.name}
                onChange={(event) => setBadgeDraft({ ...badgeDraft, name: event.target.value })}
                placeholder="Sustainability Hero"
                className={inputClass}
                maxLength={60}
              />
            </Field>
            <Field label="Description">
              <textarea
                value={badgeDraft.description}
                onChange={(event) => setBadgeDraft({ ...badgeDraft, description: event.target.value })}
                rows={2}
                placeholder="Awarded for saving 100kg of CO2 through trades."
                className={`${inputClass} resize-y`}
                maxLength={160}
              />
            </Field>
            <div className="grid grid-cols-2 gap-sm">
              <Field label="Tier">
                <select
                  value={badgeDraft.tier}
                  onChange={(event) => setBadgeDraft({ ...badgeDraft, tier: Number(event.target.value) })}
                  className={inputClass}
                >
                  {[1, 2, 3, 4, 5].map((tier) => (
                    <option key={tier} value={tier}>
                      Tier {tier}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Icon">
                <select
                  value={badgeDraft.icon}
                  onChange={(event) => setBadgeDraft({ ...badgeDraft, icon: event.target.value })}
                  className={inputClass}
                >
                  {BADGE_ICONS.map((icon) => (
                    <option key={icon} value={icon}>
                      {icon}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <label className="flex items-center gap-2.5 rounded-lg bg-surface-container-low px-3 py-2.5 text-body-sm">
              <input
                type="checkbox"
                checked={badgeDraft.active}
                onChange={(event) => setBadgeDraft({ ...badgeDraft, active: event.target.checked })}
                className="h-4 w-4 accent-[#154212]"
              />
              <span className="font-semibold text-on-surface">Badge is active</span>
            </label>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

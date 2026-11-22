import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Button,
  Card,
  ConfirmButton,
  EmptyState,
  ErrorNote,
  Icon,
  PageHeader,
  Pill,
  Spinner,
} from '../components/ui';
import { useLiveCollection } from '../hooks/useLive';
import { deleteAuction, saveAuction, watchAuctions } from '../lib/admin';
import { auctionCountdown, formatPoints, startsIn } from '../lib/format';
import { toAuction, type AuctionRecord, type AuctionStatus } from '../lib/models';

function statusTone(status: AuctionStatus) {
  if (status === 'active') return 'ok' as const;
  if (status === 'scheduled') return 'warn' as const;
  return 'neutral' as const;
}

export function AuctionsPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useLiveCollection(watchAuctions, toAuction);

  const [now, setNow] = useState(() => Date.now());
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const groups = useMemo(
    () => ({
      active: data.filter((auction) => auction.status === 'active'),
      scheduled: data.filter((auction) => auction.status === 'scheduled'),
      ended: data.filter((auction) => auction.status === 'ended'),
    }),
    [data],
  );

  const run = async (action: () => Promise<void>) => {
    setActionError(null);
    try {
      await action();
    } catch (caught) {
      setActionError((caught as Error).message);
    }
  };

  const setStatus = (auction: AuctionRecord, status: AuctionStatus) =>
    run(() =>
      saveAuction({
        ...auction,
        status,
        starts_at: status === 'active' ? Date.now() : auction.starts_at,
      }),
    );

  const totals = {
    active: groups.active.length,
    scheduled: groups.scheduled.length,
    bidders: groups.active.reduce((sum, auction) => sum + auction.participants, 0),
  };

  return (
    <div className="flex flex-col gap-md">
      <PageHeader
        title="Auction Control"
        description="Manage active and scheduled community auctions. Eco-point bids are reconciled by the app; the portal controls the schedule."
      >
        <Button variant="primary" icon="add" onClick={() => navigate('/auctions/new')}>
          Schedule auction
        </Button>
      </PageHeader>

      {error ? <ErrorNote>Could not read auctions: {error}</ErrorNote> : null}
      {actionError ? <ErrorNote>Could not update the auction: {actionError}</ErrorNote> : null}

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
        {[
          { label: 'Live auctions', value: totals.active, icon: 'gavel' },
          { label: 'Scheduled', value: totals.scheduled, icon: 'event' },
          { label: 'Active bidders', value: totals.bidders, icon: 'group' },
        ].map((item) => (
          <Card key={item.label} className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container/20 text-primary">
              <Icon name={item.icon} className="text-[20px]" />
            </span>
            <div>
              <p className="text-headline-sm font-semibold text-primary">{item.value}</p>
              <p className="text-body-sm text-on-surface-variant">{item.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {loading ? (
        <Spinner label="Loading auctions..." />
      ) : data.length === 0 ? (
        <EmptyState
          icon="gavel"
          title="No auctions yet"
          description="Schedule the first community auction to give eco-points somewhere to go."
        >
          <Button variant="primary" icon="add" onClick={() => navigate('/auctions/new')}>
            Schedule auction
          </Button>
        </EmptyState>
      ) : (
        <>
          <AuctionSection
            title="Active"
            hint="Bidding is open right now"
            auctions={groups.active}
            now={now}
            onStatus={setStatus}
            onDelete={(auction) => run(() => deleteAuction(auction.id))}
            onEdit={(auction) => navigate(`/auctions/new?id=${auction.id}`)}
          />
          <AuctionSection
            title="Scheduled"
            hint="Waiting for their start time"
            auctions={groups.scheduled}
            now={now}
            onStatus={setStatus}
            onDelete={(auction) => run(() => deleteAuction(auction.id))}
            onEdit={(auction) => navigate(`/auctions/new?id=${auction.id}`)}
          />
          <AuctionSection
            title="Ended"
            hint="Closed to new bids"
            auctions={groups.ended}
            now={now}
            onStatus={setStatus}
            onDelete={(auction) => run(() => deleteAuction(auction.id))}
            onEdit={(auction) => navigate(`/auctions/new?id=${auction.id}`)}
          />
        </>
      )}
    </div>
  );
}

function AuctionSection({
  title,
  hint,
  auctions,
  now,
  onStatus,
  onDelete,
  onEdit,
}: {
  title: string;
  hint: string;
  auctions: AuctionRecord[];
  now: number;
  onStatus: (auction: AuctionRecord, status: AuctionStatus) => void;
  onDelete: (auction: AuctionRecord) => void;
  onEdit: (auction: AuctionRecord) => void;
}) {
  if (auctions.length === 0) return null;

  return (
    <section className="flex flex-col gap-sm">
      <div className="flex items-center gap-2">
        <h3 className="text-headline-sm text-on-surface">{title}</h3>
        <Pill tone={statusTone(auctions[0].status)}>{auctions.length}</Pill>
        <span className="text-body-sm text-on-surface-variant">{hint}</span>
      </div>

      <div className="grid grid-cols-1 gap-sm lg:grid-cols-2 xl:grid-cols-3">
        {auctions.map((auction) => {
          const countdown = auctionCountdown(auction, now);
          const highBid = auction.current_bid ?? auction.starting_bid;

          return (
            <Card key={auction.id} className="flex flex-col gap-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                <Pill tone={statusTone(auction.status)}>{auction.status}</Pill>
                {auction.verified_only ? (
                  <Pill tone="info">
                    <Icon name="verified_user" className="text-[14px]" />
                    Verified bidders
                  </Pill>
                ) : null}
              </div>

              <div>
                <h4 className="text-body-lg font-semibold text-on-surface">{auction.title}</h4>
                {auction.description ? (
                  <p className="mt-1 line-clamp-2 text-body-sm text-on-surface-variant">
                    {auction.description}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2">
                <Icon
                  name={auction.status === 'active' ? 'timer' : auction.status === 'scheduled' ? 'schedule' : 'event_busy'}
                  className="text-[18px] text-on-surface-variant"
                />
                <span className="text-label-md text-on-surface-variant">
                  {auction.status === 'active' ? 'Time Remaining' : auction.status === 'scheduled' ? 'Starts In' : 'Closed'}
                </span>
                <span className="ml-auto font-mono text-body-md font-semibold text-primary">
                  {auction.status === 'active'
                    ? (countdown ?? '00:00:00')
                    : auction.status === 'scheduled'
                      ? startsIn(auction.starts_at)
                      : '—'}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-sm">
                <div>
                  <dt className="text-label-md text-on-surface-variant">
                    {auction.status === 'scheduled' ? 'Starting Bid' : 'Current High Bid'}
                  </dt>
                  <dd className="mt-0.5 flex items-center gap-1 text-body-md font-semibold text-primary">
                    <Icon name="eco" className="text-[16px]" />
                    {formatPoints(highBid)} EP
                  </dd>
                </div>
                <div>
                  <dt className="text-label-md text-on-surface-variant">
                    {auction.status === 'scheduled' ? 'Watchers' : 'Participants'}
                  </dt>
                  <dd className="mt-0.5 text-body-md font-semibold text-on-surface">
                    {auction.status === 'scheduled' ? auction.watchers : auction.participants}
                  </dd>
                </div>
              </dl>

              <div className="mt-auto flex flex-wrap items-center gap-xs border-t border-outline-variant/40 pt-sm">
                <Button variant="ghost" size="sm" icon="visibility" onClick={() => onEdit(auction)}>
                  View
                </Button>

                {auction.status === 'active' ? (
                  <ConfirmButton
                    label="End now"
                    icon="stop_circle"
                    size="sm"
                    variant="danger"
                    title={`End "${auction.title}"?`}
                    message="Bidding closes immediately. The winner keeps the current high bid."
                    confirmLabel="End auction"
                    onConfirm={() => onStatus(auction, 'ended')}
                  />
                ) : null}

                {auction.status === 'scheduled' ? (
                  <>
                    <ConfirmButton
                      label="Start now"
                      icon="play_arrow"
                      size="sm"
                      variant="primary"
                      title={`Start "${auction.title}" now?`}
                      message="Sets the start time to now and opens bidding."
                      confirmLabel="Start auction"
                      onConfirm={() => onStatus(auction, 'active')}
                    />
                    <Button variant="ghost" size="sm" icon="edit" onClick={() => onEdit(auction)}>
                      Edit Details
                    </Button>
                  </>
                ) : null}

                {auction.status === 'ended' ? (
                  <ConfirmButton
                    label="Re-queue"
                    icon="restart_alt"
                    size="sm"
                    variant="secondary"
                    title={`Re-queue "${auction.title}"?`}
                    message="Moves the auction back to scheduled so you can set a new start time."
                    confirmLabel="Re-queue"
                    onConfirm={() => onStatus(auction, 'scheduled')}
                  />
                ) : null}

                <ConfirmButton
                  label="Delete"
                  icon="delete"
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-error"
                  title={`Delete "${auction.title}"?`}
                  message="Removes the auction document permanently."
                  confirmLabel="Delete auction"
                  onConfirm={() => onDelete(auction)}
                />
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

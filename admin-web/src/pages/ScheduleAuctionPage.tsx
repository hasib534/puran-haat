import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import {
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Icon,
  PageHeader,
  Spinner,
  inputClass,
} from '../components/ui';
import { useLiveDocument } from '../hooks/useLive';
import { saveAuction, watchAuction } from '../lib/admin';
import { toAuction, type AuctionRecord, type AuctionStatus } from '../lib/models';
import { toDateTimeInput } from '../lib/format';

const CATEGORIES = [
  { id: 'furniture', name: 'Furniture & Woodwork' },
  { id: 'kitchen', name: 'Kitchen & Home Goods' },
  { id: 'electronics', name: 'Electronics' },
  { id: 'garden', name: 'Garden & Outdoors' },
  { id: 'books', name: 'Books & Media' },
  { id: 'clothing', name: 'Clothing' },
  { id: 'tools', name: 'Tools & Equipment' },
  { id: 'other', name: 'Other' },
];

const DURATIONS = [3, 6, 12, 24, 48, 72];

interface FormState {
  title: string;
  description: string;
  category_id: string;
  starting_bid: string;
  starts_at: string;
  duration_hours: string;
  verified_only: boolean;
  status: AuctionStatus;
}

const blankForm = (): FormState => ({
  title: '',
  description: '',
  category_id: 'furniture',
  starting_bid: '100',
  starts_at: toDateTimeInput(Date.now() + 3_600_000),
  duration_hours: '24',
  verified_only: true,
  status: 'scheduled',
});

const formFromAuction = (auction: AuctionRecord): FormState => ({
  title: auction.title,
  description: auction.description ?? '',
  category_id: auction.category_id,
  starting_bid: String(auction.starting_bid),
  starts_at: toDateTimeInput(auction.starts_at),
  duration_hours: String(auction.duration_hours),
  verified_only: auction.verified_only,
  status: auction.status,
});

export function ScheduleAuctionPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get('id') ?? '';

  const existing = useLiveDocument(watchAuction, editId, toAuction);

  // The form is a draft layered over either the untouched defaults or the
  // document being edited, so nothing has to be synced from an effect.
  const [defaults] = useState(blankForm);
  const [draft, setDraft] = useState<Partial<FormState>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = useMemo(
    () => (existing.data ? formFromAuction(existing.data) : defaults),
    [defaults, existing.data],
  );

  const form: FormState = { ...base, ...draft };

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setError(null);

    const startingBid = Number(form.starting_bid);
    const duration = Number(form.duration_hours);

    if (!form.title.trim()) {
      setError('Give the auction a title.');
      return;
    }
    if (!form.description.trim()) {
      setError('Add a short description so bidders know what they are bidding on.');
      return;
    }
    if (!Number.isFinite(startingBid) || startingBid <= 0) {
      setError('Starting bid must be a positive number of eco-points.');
      return;
    }
    if (!form.starts_at) {
      setError('Choose a start date and time.');
      return;
    }
    if (!Number.isFinite(duration) || duration < 1) {
      setError('Duration must be at least 1 hour.');
      return;
    }

    const startsAt = new Date(form.starts_at).getTime();
    if (Number.isNaN(startsAt)) {
      setError('That start date is not valid.');
      return;
    }

    setSaving(true);
    try {
      await saveAuction({
        id: existing.data?.id,
        title: form.title.trim(),
        description: form.description.trim(),
        category_id: form.category_id,
        starting_bid: startingBid,
        current_bid: existing.data?.current_bid,
        participants: existing.data?.participants ?? 0,
        watchers: existing.data?.watchers ?? 0,
        starts_at: startsAt,
        duration_hours: duration,
        status: existing.data?.status ?? (startsAt <= Date.now() ? 'active' : 'scheduled'),
        verified_only: form.verified_only,
        created_at: existing.data?.created_at ?? Date.now(),
      });
      navigate('/auctions');
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (editId && existing.loading) return <Spinner label="Loading auction..." />;

  if (editId && !existing.loading && !existing.data) {
    return (
      <EmptyState
        icon="search_off"
        title="Auction not found"
        description="This auction may have been deleted, or the link is out of date."
      >
        <Button variant="secondary" onClick={() => navigate('/auctions')}>
          Back to auctions
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-md">
      <Link
        to="/auctions"
        className="inline-flex items-center gap-1 text-label-md text-on-surface-variant hover:text-primary"
      >
        <Icon name="arrow_back" className="text-[18px]" />
        Back to auctions
      </Link>

      <PageHeader
        title={editId ? 'Edit Auction' : 'Schedule New Auction'}
        description="Configure settings for a community auction event. All required fields are marked."
      />

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-md">
          <Card>
            <h3 className="flex items-center gap-2 text-headline-sm text-on-surface">
              <Icon name="edit_document" className="text-[20px] text-primary" />
              Auction Details
            </h3>

            <div className="mt-sm flex flex-col gap-sm">
              <Field label="Auction Title" required>
                <input
                  value={form.title}
                  onChange={(event) => update('title', event.target.value)}
                  placeholder="Vintage Restored Bicycle"
                  className={inputClass}
                  maxLength={80}
                />
              </Field>

              <Field
                label="Item Description & Context"
                required
                hint="Shown on the auction card and the item page."
              >
                <textarea
                  value={form.description}
                  onChange={(event) => update('description', event.target.value)}
                  rows={4}
                  placeholder="Fully restored 1980s road bike, new tyres, chain and brake pads."
                  className={`${inputClass} resize-y`}
                  maxLength={400}
                />
              </Field>

              <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
                <Field label="Starting Bid (Eco-Points)" required>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={form.starting_bid}
                    onChange={(event) => update('starting_bid', event.target.value)}
                    className={inputClass}
                  />
                </Field>

                <Field label="Category">
                  <select
                    value={form.category_id}
                    onChange={(event) => update('category_id', event.target.value)}
                    className={inputClass}
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="flex items-center gap-2 text-headline-sm text-on-surface">
              <Icon name="schedule" className="text-[20px] text-primary" />
              Timing
            </h3>

            <div className="mt-sm grid grid-cols-1 gap-sm sm:grid-cols-2">
              <Field label="Start Date & Time" required>
                <input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(event) => update('starts_at', event.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Duration (Hours)" required hint="How long bidding stays open.">
                <div className="flex gap-sm">
                  <input
                    type="number"
                    min={1}
                    max={336}
                    value={form.duration_hours}
                    onChange={(event) => update('duration_hours', event.target.value)}
                    className={inputClass}
                  />
                </div>
              </Field>
            </div>

            <div className="mt-sm flex flex-wrap gap-1">
              {DURATIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => update('duration_hours', String(option))}
                  className={`rounded-full px-3 py-1.5 text-label-md transition-colors ${
                    Number(form.duration_hours) === option
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-on-surface-variant hover:text-primary'
                  }`}
                >
                  {option}h
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="flex items-center gap-2 text-headline-sm text-on-surface">
              <Icon name="gavel" className="text-[20px] text-primary" />
              Rules & Moderation
            </h3>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Enable strict moderation filters for high-value community exchanges.
            </p>

            <label className="mt-sm flex items-start gap-3 rounded-lg bg-surface-container-low px-3 py-2.5">
              <input
                type="checkbox"
                checked={form.verified_only}
                onChange={(event) => update('verified_only', event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#154212]"
              />
              <span>
                <span className="block text-body-sm font-semibold text-on-surface">
                  Enforce verified bidders only
                </span>
                <span className="block text-body-sm text-on-surface-variant">
                  Only traders with a verified badge can place a bid.
                </span>
              </span>
            </label>
          </Card>

          <div className="flex flex-wrap items-center justify-end gap-xs">
            <Button variant="ghost" onClick={() => navigate('/auctions')} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" icon="gavel" onClick={submit} loading={saving}>
              {editId ? 'Save changes' : 'Schedule Auction'}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-md">
          <Card className="bg-surface-container-low">
            <h3 className="flex items-center gap-1.5 text-body-md font-semibold text-on-surface">
              <Icon name="info" className="text-[18px]" />
              Preview
            </h3>
            <div className="mt-sm rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-sm">
              <p className="text-body-md font-semibold text-on-surface">
                {form.title.trim() || 'Auction title'}
              </p>
              <p className="mt-1 line-clamp-3 text-body-sm text-on-surface-variant">
                {form.description.trim() || 'The description bidders will read.'}
              </p>
              <div className="mt-sm flex items-center justify-between text-body-sm">
                <span className="flex items-center gap-1 font-semibold text-primary">
                  <Icon name="eco" className="text-[16px]" />
                  {Number(form.starting_bid) || 0} EP
                </span>
                <span className="text-on-surface-variant">{form.duration_hours}h window</span>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-body-md font-semibold text-on-surface">Before you publish</h3>
            <ul className="mt-sm flex flex-col gap-2 text-body-sm text-on-surface-variant">
              {[
                'Eco-points are debited from the winner when an auction closes.',
                'Auction documents are public-read so the mobile app can show them live.',
                'Scheduled auctions flip to active when their start time passes.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Icon name="check_circle" className="text-[17px] text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

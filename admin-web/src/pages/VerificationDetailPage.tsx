import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../auth/AuthProvider';
import {
  Avatar,
  Button,
  Card,
  ConfirmButton,
  EmptyState,
  ErrorNote,
  Field,
  Icon,
  Pill,
  Spinner,
  inputClass,
} from '../components/ui';
import { useLiveDocument } from '../hooks/useLive';
import {
  decideVerification,
  saveVerificationNotes,
  watchVerification,
} from '../lib/admin';
import { projectIdForConsole } from '../lib/firebase';
import { formatDate, formatDateTime, riskLabel } from '../lib/format';
import { toVerification } from '../lib/models';

export function VerificationDetailPage() {
  const { id = '' } = useParams();

  // Remounts on id change so notes from the previous request never linger.
  return <VerificationDetailView key={id} id={id} />;
}

function VerificationDetailView({ id }: { id: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error } = useLiveDocument(watchVerification, id, toVerification);

  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [noteState, setNoteState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const notes = notesDraft ?? data?.notes ?? '';
  const dirty = notesDraft !== null && notesDraft !== (data?.notes ?? '');

  if (loading) return <Spinner label="Loading verification…" />;

  if (error) return <ErrorNote>{error}</ErrorNote>;

  if (!data) {
    return (
      <EmptyState
        icon="search_off"
        title="Verification not found"
        description="This request may have been deleted, or the link is out of date."
      >
        <Button variant="secondary" onClick={() => navigate('/verifications')}>
          Back to queue
        </Button>
      </EmptyState>
    );
  }

  const risk = riskLabel(data.risk_score);
  const consoleUrl = `https://console.firebase.google.com/project/${projectIdForConsole}/firestore/data/~2Fverifications~2F${data.id}`;

  const decide = async (status: 'approved' | 'rejected') => {
    if (!user) return;
    setActionError(null);
    try {
      await decideVerification(data, status, user.uid, notes.trim() || undefined);
      navigate('/verifications');
    } catch (caught) {
      setActionError((caught as Error).message);
    }
  };

  const saveNotes = async () => {
    setNoteState('saving');
    setActionError(null);
    try {
      await saveVerificationNotes(data.id, notes.trim());
      setNotesDraft(null);
      setNoteState('saved');
      window.setTimeout(() => setNoteState('idle'), 2000);
    } catch (caught) {
      setActionError((caught as Error).message);
      setNoteState('idle');
    }
  };

  const documents =
    data.file_count > 1
      ? [
          { title: data.document_type, badge: 'Requires manual check', icon: 'badge' },
          { title: 'Proof of address', badge: 'Auto-verified', icon: 'receipt_long' },
        ]
      : [{ title: data.document_type, badge: 'Requires manual check', icon: 'badge' }];

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <Link
          to="/verifications"
          className="inline-flex items-center gap-1 text-label-md text-on-surface-variant hover:text-primary"
        >
          <Icon name="arrow_back" className="text-[18px]" />
          Back to verification queue
        </Link>

        <div className="flex flex-wrap items-center gap-xs">
          <ConfirmButton
            label="Reject"
            icon="close"
            variant="danger"
            size="md"
            title={`Reject ${data.full_name}?`}
            message="The request moves to rejected. The trader keeps their account and can resubmit documents."
            confirmLabel="Reject request"
            onConfirm={() => decide('rejected')}
          />
          <ConfirmButton
            label="Approve User"
            icon="check"
            variant="primary"
            size="md"
            title={`Approve ${data.full_name}?`}
            message="Marks the request approved and flags the trader as verified on their public profile."
            confirmLabel="Approve user"
            onConfirm={() => decide('approved')}
          />
        </div>
      </div>

      {actionError ? <ErrorNote>{actionError}</ErrorNote> : null}

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-md">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-sm">
              <div>
                <h2 className="text-headline-sm text-on-surface">{data.full_name}</h2>
                <p className="mt-1 font-mono text-body-sm text-on-surface-variant">
                  ID: {data.user_id}
                </p>
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  Submitted {formatDateTime(data.submitted_at)}
                  {data.district ? ` · ${data.district}` : ''}
                </p>
              </div>
              <Pill tone={data.status === 'pending' ? 'warn' : data.status === 'approved' ? 'ok' : 'danger'}>
                {data.status}
              </Pill>
            </div>

            <div className="mt-md grid grid-cols-1 gap-sm sm:grid-cols-3">
              <div className="rounded-lg bg-surface-container-low px-3 py-2">
                <p className="text-label-md text-on-surface-variant">Risk score</p>
                <p className="mt-0.5 text-body-md font-semibold text-on-surface">{risk.label}</p>
              </div>
              <div className="rounded-lg bg-surface-container-low px-3 py-2">
                <p className="text-label-md text-on-surface-variant">Files</p>
                <p className="mt-0.5 text-body-md font-semibold text-on-surface">
                  {data.file_count} uploaded
                </p>
              </div>
              <div className="rounded-lg bg-surface-container-low px-3 py-2">
                <p className="text-label-md text-on-surface-variant">Reviewed</p>
                <p className="mt-0.5 text-body-md font-semibold text-on-surface">
                  {data.reviewed_at ? formatDate(data.reviewed_at) : 'Not yet'}
                </p>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
            {documents.map((document) => (
              <Card key={document.title} className="flex flex-col gap-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-primary">
                    <Icon name={document.icon} className="text-[20px]" />
                  </span>
                  <Pill tone={document.badge === 'Auto-verified' ? 'ok' : 'warn'}>
                    {document.badge}
                  </Pill>
                </div>

                <div>
                  <h3 className="text-body-md font-semibold text-on-surface">{document.title}</h3>
                  <p className="mt-1 text-body-sm text-on-surface-variant">
                    Uploaded {formatDateTime(data.submitted_at)}
                  </p>
                </div>

                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-outline-variant/70 bg-surface-container-low text-on-surface-variant">
                  <div className="flex flex-col items-center gap-1">
                    <Icon name="image" className="text-[28px]" />
                    <span className="text-label-md">Preview in the Firebase console</span>
                  </div>
                </div>

                <a
                  href={consoleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-label-md text-primary hover:underline"
                >
                  <Icon name="open_in_new" className="text-[16px]" />
                  Open document record
                </a>
              </Card>
            ))}
          </div>

          <Card>
            <h3 className="text-body-md font-semibold text-on-surface">Admin notes</h3>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Internal documentation only. Never shown to the trader.
            </p>
            <textarea
              value={notes}
              onChange={(event) => setNotesDraft(event.target.value)}
              rows={4}
              placeholder="What did you check? Any follow-up needed?"
              className={`${inputClass} mt-sm resize-y`}
            />
            <div className="mt-sm flex items-center justify-end gap-xs">
              {noteState === 'saved' ? (
                <span className="text-label-md text-primary">Notes saved</span>
              ) : null}
              <Button
                variant="secondary"
                size="sm"
                icon="save"
                onClick={saveNotes}
                loading={noteState === 'saving'}
                disabled={!dirty}
              >
                Save notes
              </Button>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-md">
          <Card>
            <div className="flex flex-col items-center text-center">
              <Avatar src={data.avatar_url} name={data.full_name} size="xl" />
              <h3 className="mt-sm text-headline-sm text-on-surface">{data.full_name}</h3>
              {data.username ? (
                <p className="text-body-sm text-on-surface-variant">@{data.username}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                <Pill tone={risk.tone === 'ok' ? 'ok' : risk.tone === 'warn' ? 'warn' : 'danger'}>
                  {risk.label}
                </Pill>
                {data.district ? <Pill tone="neutral">{data.district}</Pill> : null}
              </div>
            </div>

            <dl className="mt-md flex flex-col gap-2 border-t border-outline-variant/40 pt-sm text-body-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-on-surface-variant">Document type</dt>
                <dd className="text-right font-semibold text-on-surface">{data.document_type}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-on-surface-variant">Submitted</dt>
                <dd className="text-right font-semibold text-on-surface">
                  {formatDate(data.submitted_at)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-on-surface-variant">Reviewed by</dt>
                <dd className="text-right font-semibold text-on-surface">
                  {data.reviewed_by || '—'}
                </dd>
              </div>
            </dl>

            <Button
              variant="secondary"
              icon="person"
              className="mt-md w-full"
              onClick={() => navigate(`/users/${data.user_id}`)}
            >
              Open trader investigation
            </Button>
          </Card>

          <Card className="bg-surface-container-low">
            <h3 className="flex items-center gap-1.5 text-body-md font-semibold text-on-surface">
              <Icon name="info" className="text-[18px]" />
              How verification works
            </h3>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Approval writes <code className="rounded bg-surface-container px-1">is_verified</code>{' '}
              to the trader&apos;s profile. Email verification still gates posting and trading in the
              mobile app, so approve only after the identity documents match the account holder.
            </p>
          </Card>

          <Field label="Reviewer" hint={user?.email ?? ''}>
            <input value={user?.displayName || 'Admin'} readOnly className={inputClass} />
          </Field>
        </div>
      </div>
    </div>
  );
}
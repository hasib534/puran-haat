import type { Profile, TradeProposal } from '../types';

interface ConversationSummary {
  id: string;
  itemTitle?: string;
  other: Profile;
  lastMessage: string;
  lastMessageAt?: number;
  unread: number;
}

export type NotificationKind = 'proposal' | 'trade' | 'message';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  icon: 'handshake' | 'check-circle' | 'cancel' | 'chat-bubble-outline';
  title: string;
  body: string;
  createdAt: number;
  unread: boolean;
  conversationId?: string;
}

const MAX_NOTIFICATIONS = 30;

function itemLabel(title?: string): string {
  return title ? `\u201c${title}\u201d` : 'a listing';
}

function nameOf(profile?: Profile): string {
  return profile?.full_name || 'A trader';
}

/**
 * Builds the notification feed from live proposals and conversations.
 * Nothing is fabricated: every row maps to a real document the user can open.
 *
 * The badge count only includes items that need attention (proposals awaiting
 * the user's response and unread chat messages) so it clears as they act.
 */
export function buildNotifications(params: {
  uid?: string;
  proposals: TradeProposal[];
  conversations: ConversationSummary[];
}): AppNotification[] {
  const { uid, proposals, conversations } = params;
  if (!uid) return [];

  const conversationById = new Map(conversations.map((entry) => [entry.id, entry]));
  const rows: AppNotification[] = [];

  for (const proposal of proposals) {
    const isReceiver = proposal.receiver_id === uid;
    const isProposer = proposal.proposer_id === uid;
    if (!isReceiver && !isProposer) continue;

    const conversationId = proposal.conversation_id;
    const itemTitle =
      proposal.requested_item_title ||
      proposal.requested_item?.title ||
      (conversationId ? conversationById.get(conversationId)?.itemTitle : undefined);
    const counterpart = nameOf(isReceiver ? proposal.proposer : proposal.receiver);
    const createdAt = Number.isFinite(Date.parse(proposal.created_at))
      ? Date.parse(proposal.created_at)
      : 0;
    const base = { createdAt, conversationId, id: `proposal-${proposal.id}` };

    if (proposal.status === 'pending') {
      if (!isReceiver) continue;
      rows.push({
        ...base,
        kind: 'proposal',
        icon: 'handshake',
        title: 'New barter proposal',
        body: `${counterpart} wants to trade for ${itemLabel(itemTitle)}.`,
        unread: true,
      });
      continue;
    }

    if (proposal.status === 'accepted') {
      rows.push({
        ...base,
        kind: 'trade',
        icon: 'check-circle',
        title: 'Trade accepted',
        body: isReceiver
          ? `You accepted ${counterpart}'s offer for ${itemLabel(itemTitle)}.`
          : `${counterpart} accepted your offer for ${itemLabel(itemTitle)}.`,
        unread: false,
      });
      continue;
    }

    if (proposal.status === 'declined' && isProposer) {
      rows.push({
        ...base,
        kind: 'trade',
        icon: 'cancel',
        title: 'Proposal declined',
        body: `${counterpart} declined your offer for ${itemLabel(itemTitle)}. You can send a new one from the listing.`,
        unread: false,
      });
      continue;
    }

    if (proposal.status === 'countered' && isProposer) {
      rows.push({
        ...base,
        kind: 'proposal',
        icon: 'handshake',
        title: 'Counter-offer received',
        body: `${counterpart} sent a counter-offer for ${itemLabel(itemTitle)}.`,
        unread: false,
      });
      continue;
    }

    if (proposal.status === 'completed') {
      rows.push({
        ...base,
        kind: 'trade',
        icon: 'check-circle',
        title: 'Trade completed',
        body: `Your swap with ${counterpart} for ${itemLabel(itemTitle)} is complete.`,
        unread: false,
      });
    }
  }

  for (const conversation of conversations) {
    if (conversation.unread <= 0) continue;
    rows.push({
      id: `message-${conversation.id}`,
      kind: 'message',
      icon: 'chat-bubble-outline',
      title: `New message from ${nameOf(conversation.other)}`,
      body:
        conversation.lastMessage.length > 100
          ? `${conversation.lastMessage.slice(0, 97)}...`
          : conversation.lastMessage,
      createdAt: conversation.lastMessageAt || 0,
      unread: true,
      conversationId: conversation.id,
    });
  }

  return rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_NOTIFICATIONS);
}

export function unreadNotificationCount(notifications: AppNotification[]): number {
  return notifications.filter((notification) => notification.unread).length;
}

export function relativeTime(timestamp: number): string {
  if (!timestamp) return '';
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

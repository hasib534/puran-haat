import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { MOCK_ITEMS } from '../data/mock-items';
import { Item, Profile, TradeProposal } from '../types';
import { useAuth } from './AuthContext';
import {
  clearConversationUnread,
  incrementUserStats,
  isFirebaseConfigured,
  newDocId,
  saveConversation,
  saveFavorite,
  saveItem,
  saveProposal,
  saveUserProfile,
  seedItemsToFirestore,
  sendMessage as sendMessageDoc,
  setConversationStatus,
  setProposalStatus,
  subscribeToConversations,
  subscribeToFavorites,
  subscribeToItems,
  subscribeToProposals,
  subscribeToUserProfile,
  updateConversation,
  uploadProfileAvatar,
  type ConversationDoc,
  type FirestoreRecord,
  type ProposalDoc,
} from '../lib/firebase';

export interface ChatMessage {
  id: string;
  sender: 'me' | 'other';
  text: string;
  time: string;
  createdAt?: number;
}

export interface Conversation {
  id: string;
  itemId: string;
  itemTitle?: string;
  itemImage?: string;
  other: Profile;
  lastMessage: string;
  lastMessageAt?: number;
  unread: number;
  status: 'pending' | 'accepted' | 'declined';
  messages: ChatMessage[];
  proposalId?: string;
  /** True while an optimistic conversation is still being written to Firestore. */
  pending?: boolean;
}

export interface NewProposalInput {
  requestedItem: Item;
  offeredItem?: Item;
  cashAdjustment: number;
  note: string;
}

interface AppContextValue {
  items: Item[];
  itemsLoading: boolean;
  favorites: string[];
  toggleFavorite: (id: string) => Promise<void>;
  addItem: (item: Item) => Promise<void>;
  seedItems: () => Promise<void>;
  conversations: Conversation[];
  getConversation: (id: string) => Conversation | undefined;
  ensureConversation: (itemId: string, other: Profile, firstMessage?: string) => string;
  sendMessage: (convId: string, text: string) => Promise<void>;
  markConversationRead: (convId: string) => Promise<void>;
  acceptTrade: (convId: string) => Promise<void>;
  declineTrade: (convId: string) => Promise<void>;
  proposals: TradeProposal[];
  sendProposal: (input: NewProposalInput) => Promise<string>;
  profile: Profile;
  ecoPoints: number;
  tradeCount: number;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
}

const currentUser: Profile = {
  id: 'me',
  full_name: 'Tanvir Ahmed',
  username: 'tanvir_haat',
  avatar_url:
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
  district: 'Dhaka',
  bio: 'Passionate about restoring old furniture and growing urban gardens. Always happy to trade seeds or advice!',
  rating: 4.9,
  trade_count: 18,
  eco_points: 340,
  is_verified: true,
};

const seedConversations: Conversation[] = [
  {
    id: 'c1',
    itemId: '1',
    itemTitle: MOCK_ITEMS[0].title,
    itemImage: MOCK_ITEMS[0].images[0],
    other: MOCK_ITEMS[0].user!,
    lastMessage: 'Saturday at 4:30 PM near Dhanmondi 27 works perfectly for me.',
    lastMessageAt: Date.now() - 1000 * 60 * 12,
    unread: 2,
    status: 'pending',
    messages: [
      {
        id: 'm1',
        sender: 'other',
        text: 'Salam! I saw your barter proposal. The item you offered looks great!',
        time: '10:14 AM',
      },
      {
        id: 'm2',
        sender: 'me',
        text: 'Salam! Can we meet around Dhanmondi Lake or TSC this weekend?',
        time: '10:16 AM',
      },
      {
        id: 'm3',
        sender: 'other',
        text: 'Saturday at 4:30 PM near Dhanmondi 27 works perfectly for me.',
        time: '10:18 AM',
      },
    ],
  },
  {
    id: 'c2',
    itemId: '2',
    itemTitle: MOCK_ITEMS[1].title,
    itemImage: MOCK_ITEMS[1].images[0],
    other: MOCK_ITEMS[1].user!,
    lastMessage: 'I can drop the planters at your place tomorrow morning.',
    lastMessageAt: Date.now() - 1000 * 60 * 60 * 20,
    unread: 1,
    status: 'pending',
    messages: [
      { id: 'm1', sender: 'other', text: 'Hi! The terracotta planters are still available.', time: 'Yesterday' },
      {
        id: 'm2',
        sender: 'me',
        text: 'Great, I would love them for my rooftop garden.',
        time: 'Yesterday',
      },
      {
        id: 'm3',
        sender: 'other',
        text: 'I can drop the planters at your place tomorrow morning.',
        time: 'Yesterday',
      },
    ],
  },
];

const emptyProfile: Profile = {
  id: '',
  full_name: 'Trader',
  district: 'Dhaka',
  rating: 0,
  trade_count: 0,
  eco_points: 0,
  is_verified: false,
};

const guestProfile: Profile = {
  ...emptyProfile,
  id: 'guest',
  full_name: 'Guest Trader',
  bio: 'Sign in to start trading and track your eco impact.',
};

const EMPTY_FAVORITES = new Set<string>();

function mapProfile(record: FirestoreRecord): Profile {
  return {
    id: record.id,
    full_name: String(record.full_name || 'Trader'),
    username: record.username ? String(record.username) : undefined,
    avatar_url: record.avatar_url ? String(record.avatar_url) : undefined,
    district: record.district ? String(record.district) : undefined,
    bio: record.bio ? String(record.bio) : undefined,
    rating: Number(record.rating || 0),
    trade_count: Number(record.trade_count || 0),
    eco_points: Number(record.eco_points || 0),
    is_verified: Boolean(record.is_verified),
  };
}

function mapItem(record: FirestoreRecord): Item {
  return {
    id: record.id,
    user_id: String(record.user_id || ''),
    title: String(record.title || 'Untitled item'),
    description: record.description ? String(record.description) : undefined,
    category_id: String(record.category_id || 'other'),
    condition: (record.condition as Item['condition']) || 'gently_used',
    trade_mode: (record.trade_mode as Item['trade_mode']) || 'trade',
    eco_impact_rating: (record.eco_impact_rating as Item['eco_impact_rating']) || 'Med',
    co2_saved_kg: Number(record.co2_saved_kg || 0),
    images: Array.isArray(record.images) ? (record.images as string[]) : [],
    location_name: String(record.location_name || 'Dhaka'),
    distance_km: record.distance_km !== undefined ? Number(record.distance_km) : undefined,
    is_favorite: Boolean(record.is_favorite),
    user: record.user ? (record.user as Profile) : undefined,
    created_at: String(record.created_at || ''),
  };
}

function mapConversation(record: FirestoreRecord, uid: string): Conversation {
  const participants = Array.isArray(record.participants) ? (record.participants as string[]) : [];
  const profiles = (record.profiles as Record<string, Profile>) || {};
  const otherId = participants.find((participant) => participant !== uid) || '';
  const unreadMap = (record.unread as Record<string, number>) || {};

  return {
    id: record.id,
    itemId: String(record.itemId || ''),
    itemTitle: record.itemTitle ? String(record.itemTitle) : undefined,
    itemImage: record.itemImage ? String(record.itemImage) : undefined,
    other:
      profiles[otherId] ||
      ({
        id: otherId,
        full_name: 'Trader',
        rating: 0,
        trade_count: 0,
        eco_points: 0,
        is_verified: false,
      } as Profile),
    lastMessage: String(record.lastMessage || ''),
    lastMessageAt: Number(record.lastMessageAt || 0),
    unread: Number(unreadMap[uid] || 0),
    status: (record.status as Conversation['status']) || 'pending',
    messages: [],
    proposalId: record.proposalId ? String(record.proposalId) : undefined,
    pending: false,
  };
}

function mapProposal(record: FirestoreRecord): TradeProposal {
  return {
    id: record.id,
    proposer_id: String(record.proposer_id || ''),
    receiver_id: String(record.receiver_id || ''),
    requested_item_id: String(record.requested_item_id || ''),
    offered_item_id: record.offered_item_id ? String(record.offered_item_id) : undefined,
    cash_adjustment: Number(record.cash_adjustment || 0),
    note: record.note ? String(record.note) : undefined,
    status: (record.status as TradeProposal['status']) || 'pending',
    created_at: String(record.created_at || ''),
    proposer: record.proposer ? (record.proposer as Profile) : undefined,
    receiver: record.receiver ? (record.receiver as Profile) : undefined,
    conversation_id: record.conversation_id ? String(record.conversation_id) : undefined,
  };
}

function formatMessageTime(createdAt: number): string {
  const date = new Date(createdAt);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [rawItems, setRawItems] = useState<Item[]>(isFirebaseConfigured ? [] : MOCK_ITEMS);
  const [itemsLoading, setItemsLoading] = useState(isFirebaseConfigured);

  const [favoriteState, setFavoriteState] = useState<{ uid: string; ids: Set<string> }>({
    uid: '',
    ids: new Set(MOCK_ITEMS.filter((item) => item.is_favorite).map((item) => item.id)),
  });

  const [conversationState, setConversationState] = useState<{ uid: string; rows: Conversation[] }>({
    uid: '',
    rows: isFirebaseConfigured ? [] : seedConversations,
  });

  const [proposalState, setProposalState] = useState<{ uid: string; rows: TradeProposal[] }>({
    uid: '',
    rows: [],
  });

  const [profileState, setProfileState] = useState<Profile>(currentUser);
  const [profileOwner, setProfileOwner] = useState('');

  // Live item feed.
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return subscribeToItems(
      (rows) => {
        const mapped = rows
          .map(mapItem)
          .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        setRawItems(mapped);
        setItemsLoading(false);
      },
      (error) => {
        console.warn('Items listener failed:', error.message);
        setItemsLoading(false);
      },
    );
  }, []);

  // Live favorites for the signed-in user.
  useEffect(() => {
    if (!isFirebaseConfigured || !user) return;
    const uid = user.uid;
    return subscribeToFavorites(
      uid,
      (rows) => {
        setFavoriteState({
          uid,
          ids: new Set(rows.map((row) => String(row.item_id))),
        });
      },
      (error) => console.warn('Favorites listener failed:', error.message),
    );
  }, [user]);

  // Live conversations for the signed-in user.
  useEffect(() => {
    if (!isFirebaseConfigured || !user) return;
    const uid = user.uid;
    return subscribeToConversations(
      uid,
      (rows) => {
        const mapped = rows
          .map((row) => mapConversation(row, uid))
          .sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
        setConversationState({ uid, rows: mapped });
      },
      (error) => console.warn('Conversations listener failed:', error.message),
    );
  }, [user]);

  // Live proposals for the signed-in user.
  useEffect(() => {
    if (!isFirebaseConfigured || !user) return;
    const uid = user.uid;
    return subscribeToProposals(
      uid,
      (rows) => {
        setProposalState({
          uid,
          rows: rows
            .map(mapProposal)
            .sort((a, b) => b.created_at.localeCompare(a.created_at)),
        });
      },
      (error) => console.warn('Proposals listener failed:', error.message),
    );
  }, [user]);

  // Live profile document, created on first sign-in if it does not exist.
  useEffect(() => {
    if (!isFirebaseConfigured || !user) return;
    const uid = user.uid;
    return subscribeToUserProfile(
      uid,
      (record) => {
        if (record) {
          const mapped = mapProfile(record);
          if (user.emailVerified && !mapped.is_verified) {
            mapped.is_verified = true;
            saveUserProfile(uid, { is_verified: true }).catch((error) =>
              console.warn('Could not sync verification badge:', error.message),
            );
          }
          setProfileOwner(uid);
          setProfileState((prev) => ({ ...prev, ...mapped, id: uid }));
          return;
        }
        const initial: Profile = {
          id: uid,
          full_name: user.displayName || user.email?.split('@')[0] || 'Trader',
          username: undefined,
          avatar_url: user.photoURL || undefined,
          district: 'Dhaka',
          bio: '',
          rating: 0,
          trade_count: 0,
          eco_points: 0,
          is_verified: user.emailVerified,
        };
        setProfileOwner(uid);
        setProfileState(initial);
        saveUserProfile(uid, initial).catch((error) =>
          console.warn('Could not create profile:', error.message),
        );
      },
      (error) => console.warn('Profile listener failed:', error.message),
    );
  }, [user]);

  const favoriteIds = useMemo(() => {
    if (!isFirebaseConfigured) return favoriteState.ids;
    if (!user) return EMPTY_FAVORITES;
    return favoriteState.uid === user.uid ? favoriteState.ids : EMPTY_FAVORITES;
  }, [favoriteState, user]);

  const items = useMemo(
    () => rawItems.map((item) => ({ ...item, is_favorite: favoriteIds.has(item.id) })),
    [rawItems, favoriteIds],
  );

  const fallbackProfile = useMemo<Profile>(() => {
    if (!user) return guestProfile;
    return {
      ...emptyProfile,
      id: user.uid,
      full_name: user.displayName || user.email?.split('@')[0] || 'Trader',
      avatar_url: user.photoURL || undefined,
      is_verified: user.emailVerified,
    };
  }, [user]);

  const profile = useMemo<Profile>(() => {
    if (!isFirebaseConfigured) return profileState;
    if (!user) return guestProfile;
    return profileOwner === user.uid ? profileState : fallbackProfile;
  }, [fallbackProfile, profileOwner, profileState, user]);

  const conversations = useMemo(() => {
    if (!isFirebaseConfigured) return conversationState.rows;
    if (!user) return [];
    return conversationState.uid === user.uid ? conversationState.rows : [];
  }, [conversationState, user]);

  const proposals = useMemo(() => {
    if (!isFirebaseConfigured) return proposalState.rows;
    if (!user) return [];
    return proposalState.uid === user.uid ? proposalState.rows : [];
  }, [proposalState, user]);

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!isFirebaseConfigured) {
        setProfileState((prev) => ({ ...prev, ...patch }));
        return;
      }
      if (!user) throw new Error('Sign in to update your profile.');

      let nextPatch = patch;
      if (patch.avatar_url && !/^https?:\/\//i.test(patch.avatar_url)) {
        // A picked image (file://, blob:, data:) must live in Storage before it
        // is written to Firestore so other devices can load it.
        nextPatch = {
          ...patch,
          avatar_url: await uploadProfileAvatar(user.uid, patch.avatar_url),
        };
      }

      setProfileOwner(user.uid);
      setProfileState((prev) => ({ ...prev, ...nextPatch }));
      await saveUserProfile(user.uid, nextPatch);
    },
    [user],
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      const currentlyFavorite = favoriteIds.has(id);
      const nextFavorite = !currentlyFavorite;

      if (!isFirebaseConfigured) {
        setFavoriteState((prev) => {
          const ids = new Set(prev.ids);
          if (nextFavorite) ids.add(id);
          else ids.delete(id);
          return { ...prev, ids };
        });
        return;
      }

      if (!user) throw new Error('Sign in to save favorites.');

      setFavoriteState((prev) => {
        const ids = new Set(prev.uid === user.uid ? prev.ids : []);
        if (nextFavorite) ids.add(id);
        else ids.delete(id);
        return { uid: user.uid, ids };
      });

      try {
        await saveFavorite(user.uid, id, nextFavorite);
      } catch (error) {
        // Roll back the optimistic update if the write is rejected.
        setFavoriteState((prev) => {
          const ids = new Set(prev.ids);
          if (currentlyFavorite) ids.add(id);
          else ids.delete(id);
          return { ...prev, ids };
        });
        throw error;
      }
    },
    [favoriteIds, user],
  );

  const seedItems = useCallback(async () => {
    if (!isFirebaseConfigured) throw new Error('Firebase is not configured.');
    if (!user) throw new Error('Sign in before seeding sample data.');
    await seedItemsToFirestore(MOCK_ITEMS, user.uid, profile);
  }, [profile, user]);

  const addItem = useCallback(
    async (item: Item) => {
      if (!isFirebaseConfigured) {
        setRawItems((prev) => [item, ...prev]);
        return;
      }
      if (!user) throw new Error('Sign in to post an item.');

      const nextItem: Item = {
        ...item,
        id: newDocId('items'),
        user_id: user.uid,
        user: {
          ...profile,
          id: user.uid,
          is_verified: user.emailVerified,
        },
        created_at: new Date().toISOString(),
      };

      setRawItems((prev) => [nextItem, ...prev]);
      try {
        await saveItem(nextItem);
      } catch (error) {
        setRawItems((prev) => prev.filter((entry) => entry.id !== nextItem.id));
        throw error;
      }
    },
    [profile, user],
  );

  const ensureConversation = useCallback(
    (itemId: string, other: Profile, firstMessage?: string) => {
      const existing = conversations.find(
        (conversation) => conversation.itemId === itemId && conversation.other.id === other.id,
      );
      if (existing) return existing.id;

      const item = items.find((entry) => entry.id === itemId);
      const message = firstMessage?.trim() || 'Hi! I would love to trade for your item.';
      const id = isFirebaseConfigured ? newDocId('conversations') : `c${Date.now()}`;
      const now = Date.now();

      const conversation: Conversation = {
        id,
        itemId,
        itemTitle: item?.title,
        itemImage: item?.images[0],
        other,
        lastMessage: message,
        lastMessageAt: now,
        unread: 0,
        status: 'pending',
        messages: [
          {
            id: `m${now}`,
            sender: 'me',
            text: message,
            time: formatMessageTime(now),
            createdAt: now,
          },
        ],
        pending: isFirebaseConfigured && Boolean(user),
      };

      if (isFirebaseConfigured && user) {
        const doc: ConversationDoc = {
          participants: [user.uid, other.id],
          profiles: {
            [user.uid]: { ...profile, id: user.uid },
            [other.id]: other,
          },
          itemId,
          itemTitle: item?.title || 'Barter item',
          itemImage: item?.images[0] || '',
          lastMessage: message,
          lastMessageAt: now,
          unread: { [user.uid]: 0, [other.id]: 0 },
          status: 'pending',
          created_at: now,
        };
        const optimistic = conversationState.uid === user.uid ? conversationState : { uid: user.uid, rows: [] };
        setConversationState({
          uid: user.uid,
          rows: [conversation, ...optimistic.rows.filter((entry) => entry.id !== id)],
        });
        saveConversation(id, doc)
          .then(() => {
            setConversationState((prev) => ({
              ...prev,
              rows: prev.rows.map((entry) =>
                entry.id === id ? { ...entry, pending: false } : entry,
              ),
            }));
            return sendMessageDoc(id, user.uid, [user.uid, other.id], message);
          })
          .catch((error) => console.warn('Could not create conversation:', error.message));
      } else {
        setConversationState((prev) => ({
          ...prev,
          rows: [conversation, ...prev.rows.filter((entry) => entry.id !== id)],
        }));
      }

      return id;
    },
    [conversationState, conversations, items, profile, user],
  );

  const sendMessage = useCallback(
    async (convId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const conversation =
        conversations.find((entry) => entry.id === convId || entry.itemId === convId) ||
        conversations[0];
      if (!conversation) throw new Error('Conversation not found.');

      if (!isFirebaseConfigured) {
        setConversationState((prev) => ({
          ...prev,
          rows: prev.rows.map((entry) => {
            if (entry.id !== conversation.id) return entry;
            const now = Date.now();
            return {
              ...entry,
              lastMessage: trimmed,
              lastMessageAt: now,
              unread: 0,
              messages: [
                ...entry.messages,
                {
                  id: `m${now}`,
                  sender: 'me',
                  text: trimmed,
                  time: formatMessageTime(now),
                  createdAt: now,
                },
              ],
            };
          }),
        }));
        return;
      }

      if (!user) throw new Error('Sign in to send messages.');
      const participants = [user.uid, conversation.other.id];
      await sendMessageDoc(conversation.id, user.uid, participants, trimmed);
    },
    [conversations, user],
  );

  const markConversationRead = useCallback(
    async (convId: string) => {
      const conversation = conversations.find((entry) => entry.id === convId);
      if (!conversation || conversation.unread === 0) return;

      setConversationState((prev) => ({
        ...prev,
        rows: prev.rows.map((entry) =>
          entry.id === convId ? { ...entry, unread: 0 } : entry,
        ),
      }));

      if (!isFirebaseConfigured || !user) return;
      try {
        await clearConversationUnread(convId, user.uid);
      } catch (error) {
        console.warn('Could not mark conversation read:', (error as Error).message);
      }
    },
    [conversations, user],
  );

  const acceptTrade = useCallback(
    async (convId: string) => {
      const conversation = conversations.find((entry) => entry.id === convId);
      if (!conversation) return;

      if (!isFirebaseConfigured) {
        setConversationState((prev) => ({
          ...prev,
          rows: prev.rows.map((entry) =>
            entry.id === convId ? { ...entry, status: 'accepted' } : entry,
          ),
        }));
        setProfileState((prev) => ({
          ...prev,
          eco_points: prev.eco_points + 50,
          trade_count: prev.trade_count + 1,
        }));
        return;
      }

      if (!user) throw new Error('Sign in to accept a trade.');

      setConversationState((prev) => ({
        ...prev,
        rows: prev.rows.map((entry) =>
          entry.id === convId ? { ...entry, status: 'accepted' } : entry,
        ),
      }));

      await setConversationStatus(convId, 'accepted');
      if (conversation.proposalId) {
        await setProposalStatus(conversation.proposalId, 'accepted');
      }
      await incrementUserStats(user.uid, 50, 1);
    },
    [conversations, user],
  );

  const declineTrade = useCallback(
    async (convId: string) => {
      const conversation = conversations.find((entry) => entry.id === convId);
      if (!conversation) return;

      setConversationState((prev) => ({
        ...prev,
        rows: prev.rows.map((entry) =>
          entry.id === convId ? { ...entry, status: 'declined' } : entry,
        ),
      }));

      if (!isFirebaseConfigured || !user) return;
      await setConversationStatus(convId, 'declined');
      if (conversation.proposalId) {
        await setProposalStatus(conversation.proposalId, 'declined');
      }
    },
    [conversations, user],
  );

  const sendProposal = useCallback(
    async ({ requestedItem, offeredItem, cashAdjustment, note }: NewProposalInput) => {
      const receiver = requestedItem.user;
      const receiverId = requestedItem.user_id;
      if (!receiver || !receiverId) throw new Error('This listing has no owner profile.');
      if (isFirebaseConfigured && !user) throw new Error('Sign in to send a proposal.');
      if (user && receiverId === user.uid) throw new Error('You cannot propose a trade on your own item.');

      const existing = conversations.find(
        (conversation) =>
          conversation.itemId === requestedItem.id && conversation.other.id === receiverId,
      );
      const conversationId =
        existing?.id || (isFirebaseConfigured ? newDocId('conversations') : `c${Date.now()}`);
      const proposalId = isFirebaseConfigured ? newDocId('proposals') : `p${Date.now()}`;
      const now = Date.now();
      const message = note.trim() || 'Barter proposal sent.';

      const proposal: TradeProposal = {
        id: proposalId,
        proposer_id: user?.uid || 'me',
        receiver_id: receiverId,
        requested_item_id: requestedItem.id,
        offered_item_id: offeredItem?.id,
        cash_adjustment: cashAdjustment,
        note: message,
        status: 'pending',
        created_at: new Date(now).toISOString(),
        proposer: profile,
        receiver,
        conversation_id: conversationId,
      };

      setProposalState((prev) => ({
        uid: user?.uid || 'me',
        rows: [proposal, ...prev.rows.filter((entry) => entry.id !== proposalId)],
      }));

      const conversation: Conversation = {
        id: conversationId,
        itemId: requestedItem.id,
        itemTitle: requestedItem.title,
        itemImage: requestedItem.images[0],
        other: receiver,
        lastMessage: message,
        lastMessageAt: now,
        unread: 0,
        status: 'pending',
        messages: [],
        proposalId,
        pending: isFirebaseConfigured && Boolean(user),
      };

      setConversationState((prev) => {
        const base =
          isFirebaseConfigured && user && prev.uid !== user.uid ? [] : prev.rows;
        return {
          uid: user?.uid || prev.uid,
          rows: [conversation, ...base.filter((entry) => entry.id !== conversationId)],
        };
      });

      if (!isFirebaseConfigured || !user) return conversationId;

      const conversationDoc: ConversationDoc = {
        participants: [user.uid, receiverId],
        profiles: {
          [user.uid]: { ...profile, id: user.uid },
          [receiverId]: receiver,
        },
        itemId: requestedItem.id,
        itemTitle: requestedItem.title,
        itemImage: requestedItem.images[0] || '',
        lastMessage: message,
        lastMessageAt: now,
        unread: { [user.uid]: 0, [receiverId]: 0 },
        status: 'pending',
        proposalId,
        created_at: now,
      };

      const proposalDoc: ProposalDoc = {
        participants: [user.uid, receiverId],
        proposer_id: user.uid,
        receiver_id: receiverId,
        proposer: { ...profile, id: user.uid },
        receiver,
        requested_item_id: requestedItem.id,
        requested_item_title: requestedItem.title,
        requested_item_image: requestedItem.images[0] || '',
        offered_item_id: offeredItem?.id,
        offered_item_title: offeredItem?.title,
        offered_item_image: offeredItem?.images[0],
        cash_adjustment: cashAdjustment,
        note: message,
        status: 'pending',
        conversation_id: conversationId,
        created_at: now,
      };

      if (existing) {
        await updateConversation(conversationId, {
          lastMessage: message,
          lastMessageAt: now,
          status: 'pending',
          proposalId,
          unread: { [user.uid]: 0, [receiverId]: 1 },
        });
      } else {
        await saveConversation(conversationId, conversationDoc);
      }
      await saveProposal(proposalId, proposalDoc);
      await sendMessageDoc(conversationId, user.uid, [user.uid, receiverId], message);
      setConversationState((prev) => ({
        ...prev,
        rows: prev.rows.map((entry) =>
          entry.id === conversationId ? { ...entry, pending: false } : entry,
        ),
      }));

      return conversationId;
    },
    [conversations, profile, user],
  );

  const getConversation = useCallback(
    (id: string) =>
      conversations.find((conversation) => conversation.id === id || conversation.itemId === id),
    [conversations],
  );

  const value: AppContextValue = {
    items,
    itemsLoading,
    favorites: Array.from(favoriteIds),
    toggleFavorite,
    addItem,
    seedItems,
    conversations,
    getConversation,
    ensureConversation,
    sendMessage,
    markConversationRead,
    acceptTrade,
    declineTrade,
    proposals,
    sendProposal,
    profile,
    ecoPoints: profile.eco_points,
    tradeCount: profile.trade_count,
    updateProfile,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextValue => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};

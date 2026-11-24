import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { MOCK_ITEMS } from '../data/mock-items';
import { Item, Profile, TradeProposal } from '../types';
import { useAuth } from './AuthContext';
import { useLocation } from './LocationContext';
import {
  clearConversationUnread,
  clearUserProfileLocation,
  createConversationWithMessage,
  deleteItemDoc,
  isFirebaseConfigured,
  newDocId,
  respondToProposal,
  saveFavorite,
  saveItem,
  saveProposalWithConversation,
  saveUserProfile,
  seedItemsToFirestore,
  sendMessage as sendMessageDoc,
  setTyping as setTypingDoc,
  subscribeToConversations,
  subscribeToFavorites,
  subscribeToItems,
  subscribeToPresence,
  subscribeToProposals,
  subscribeToUserProfile,
  type ConversationDoc,
  type FirestoreRecord,
  type ProposalDoc,
} from '../lib/firebase';
import { usePresenceHeartbeat } from '../hooks/usePresence';
import { usePushRegistration } from '../hooks/usePushRegistration';
import { notifyConversationMessage } from '../lib/push';
import type { PresenceEntry } from '../lib/presence';
import {
  cloudinaryConfigHint,
  isCloudinaryConfigured,
  uploadImageToCloudinary,
  uploadImagesToCloudinary,
} from '../lib/cloudinary';

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
  /** Who sent the current proposal (only set once a proposal exists). */
  proposerId?: string;
  /** Who must accept/decline the current proposal. */
  receiverId?: string;
  /** The other participant's live typing heartbeat, if any. */
  typingAt?: number;
  /** The timestamp the other participant has read the thread up to. */
  readWatermark?: number;
  /** True while an optimistic conversation is still being written to Firestore. */
  pending?: boolean;
}

export interface NewProposalInput {
  requestedItem: Item;
  offeredItem?: Item;
  cashAdjustment: number;
  note: string;
}

/** Fields a seller may change on an existing listing. */
export type EditableItemPatch = Partial<
  Pick<
    Item,
    | 'title'
    | 'description'
    | 'category_id'
    | 'condition'
    | 'trade_mode'
    | 'location_name'
    | 'latitude'
    | 'longitude'
    | 'images'
    | 'co2_saved_kg'
    | 'eco_impact_rating'
  >
>;

interface AppContextValue {
  items: Item[];
  itemsLoading: boolean;
  /**
   * True when the item feed has been serving from the Firestore cache long
   * enough that the backend is probably unreachable, so screens can say so
   * instead of pretending the haat is empty.
   */
  isOffline: boolean;
  favorites: string[];
  toggleFavorite: (id: string) => Promise<void>;
  addItem: (item: Item) => Promise<void>;
  updateItem: (id: string, patch: EditableItemPatch) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  seedItems: () => Promise<void>;
  conversations: Conversation[];
  getConversation: (id: string) => Conversation | undefined;
  ensureConversation: (itemId: string, other: Profile, firstMessage?: string) => string;
  sendMessage: (convId: string, text: string) => Promise<void>;
  markConversationRead: (convId: string) => Promise<void>;
  /** Publishes/clears the caller's live "typing" heartbeat for a thread. */
  setTyping: (convId: string, isTyping: boolean) => Promise<void>;
  /** Live online/last-seen map keyed by trader UID. */
  presence: Record<string, PresenceEntry>;
  acceptTrade: (convId: string) => Promise<void>;
  declineTrade: (convId: string) => Promise<void>;
  proposals: TradeProposal[];
  sendProposal: (input: NewProposalInput) => Promise<string>;
  profile: Profile;
  ecoPoints: number;
  tradeCount: number;
  updateProfile: (
    patch: Partial<Profile>,
  ) => Promise<{ avatarUploadFailed?: boolean; avatarError?: string }>;
  /** True when Cloudinary is configured and photo uploads can run. */
  canUploadPhotos: boolean;
  /** Uploads local listing photo URIs and resolves to their public URLs. */
  uploadListingImages: (uris: string[]) => Promise<string[]>;
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

/**
 * A client that dies without marking itself offline simply stops refreshing
 * its heartbeat, so an "online" row older than this is treated as offline.
 * Comfortably above the 25s heartbeat interval in usePresenceHeartbeat.
 */
const PRESENCE_STALE_MS = 70_000;

/** Only finite numbers are trusted; `null`/strings/NaN become undefined. */
function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function mapProfile(record: FirestoreRecord): Profile {
  return {
    id: record.id,
    full_name: String(record.full_name || 'Trader'),
    username: record.username ? String(record.username) : undefined,
    avatar_url: record.avatar_url ? String(record.avatar_url) : undefined,
    district: record.district ? String(record.district) : undefined,
    latitude: readNumber(record.latitude),
    longitude: readNumber(record.longitude),
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
    latitude: readNumber(record.latitude),
    longitude: readNumber(record.longitude),
    distance_km: readNumber(record.distance_km),
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
  const typingMap = (record.typing as Record<string, number>) || {};
  const readsMap = (record.reads as Record<string, number>) || {};

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
    proposerId: record.proposer_id ? String(record.proposer_id) : undefined,
    receiverId: record.receiver_id ? String(record.receiver_id) : undefined,
    typingAt: Number(typingMap[otherId] || 0) || undefined,
    readWatermark: Number(readsMap[otherId] || 0) || undefined,
    pending: false,
  };
}

function mapProposal(record: FirestoreRecord): TradeProposal {
  return {
    id: record.id,
    proposer_id: String(record.proposer_id || ''),
    receiver_id: String(record.receiver_id || ''),
    requested_item_id: String(record.requested_item_id || ''),
    requested_item_title: record.requested_item_title
      ? String(record.requested_item_title)
      : undefined,
    requested_item_image: record.requested_item_image
      ? String(record.requested_item_image)
      : undefined,
    offered_item_id: record.offered_item_id ? String(record.offered_item_id) : undefined,
    offered_item_title: record.offered_item_title
      ? String(record.offered_item_title)
      : undefined,
    offered_item_image: record.offered_item_image
      ? String(record.offered_item_image)
      : undefined,
    cash_adjustment: Number(record.cash_adjustment || 0),
    note: record.note ? String(record.note) : undefined,
    status: (record.status as TradeProposal['status']) || 'pending',
    created_at:
      typeof record.created_at === 'number'
        ? new Date(record.created_at).toISOString()
        : String(record.created_at || ''),
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
  // Items carry a live, real distance wherever the user's location is known.
  const { annotate } = useLocation();

  // Keeps this device's presence row current (online / last-seen).
  usePresenceHeartbeat(user?.uid);
  // Stores this device's push token so the Worker can reach the trader.
  usePushRegistration(user?.uid);

  // Derived primitives so the Firestore listeners below re-subscribe only when
  // the account really changes, instead of on every `refreshCurrentUser()`
  // (which hands back a fresh object on each app foreground and used to tear
  // down and rebuild all five listeners).
  const userUid = user?.uid;
  const userEmailVerified = user?.emailVerified;
  const userDisplayName = user?.displayName;
  const userEmail = user?.email;
  const userPhotoURL = user?.photoURL;

  const [rawItems, setRawItems] = useState<Item[]>(isFirebaseConfigured ? [] : MOCK_ITEMS);
  const [itemsLoading, setItemsLoading] = useState(isFirebaseConfigured);
  const [isOffline, setIsOffline] = useState(false);
  const offlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const [presence, setPresence] = useState<Record<string, PresenceEntry>>({});

  const [profileState, setProfileState] = useState<Profile>(currentUser);
  const [profileOwner, setProfileOwner] = useState('');
  // The last applied profile, so an optimistic edit can be rolled back if the
  // Firestore write is rejected.
  const profileStateRef = useRef(profileState);
  useEffect(() => {
    profileStateRef.current = profileState;
  }, [profileState]);

  // Live item feed.
  useEffect(() => {
    if (!isFirebaseConfigured) return;

    /**
     * Firestore reports `fromCache` on every snapshot. It is briefly true during
     * the first sync, so flipping the banner on immediately would flash it on a
     * healthy launch. We only call it offline if the cache is still the source
     * after this grace period.
     */
    const OFFLINE_GRACE_MS = 6000;
    // Safety net for the rare cold start where the listener never emits a
    // cache snapshot either, so the grace timer above has nothing to start.
    const OFFLINE_FALLBACK_MS = 10000;
    let sawServerSnapshot = false;
    const fallbackTimer = setTimeout(() => {
      if (!sawServerSnapshot) setIsOffline(true);
    }, OFFLINE_FALLBACK_MS);

    const handleCacheState = (fromCache: boolean) => {
      if (offlineTimer.current) {
        clearTimeout(offlineTimer.current);
        offlineTimer.current = null;
      }
      if (!fromCache) {
        sawServerSnapshot = true;
        clearTimeout(fallbackTimer);
        setIsOffline(false);
        return;
      }
      offlineTimer.current = setTimeout(() => {
        offlineTimer.current = null;
        setIsOffline(true);
      }, OFFLINE_GRACE_MS);
    };

    const unsubscribe = subscribeToItems(
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
      handleCacheState,
    );

    return () => {
      clearTimeout(fallbackTimer);
      if (offlineTimer.current) {
        clearTimeout(offlineTimer.current);
        offlineTimer.current = null;
      }
      unsubscribe();
    };
  }, []);

  // Live favorites for the signed-in user.
  useEffect(() => {
    if (!isFirebaseConfigured || !userUid) return;
    const uid = userUid;
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
  }, [userUid]);

  // Live conversations for the signed-in user.
  useEffect(() => {
    if (!isFirebaseConfigured || !userUid) return;
    const uid = userUid;
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
  }, [userUid]);

  // Live proposals for the signed-in user.
  useEffect(() => {
    if (!isFirebaseConfigured || !userUid) return;
    const uid = userUid;
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
  }, [userUid]);

  // Live presence for every trader, so a chat can show an online dot without
  // opening one listener per conversation. Rows that stopped heartbeating are
  // aged out here rather than trusted at face value.
  useEffect(() => {
    if (!isFirebaseConfigured || !userUid) return;
    return subscribeToPresence(
      (rows) => {
        const next: Record<string, PresenceEntry> = {};
        const now = Date.now();
        for (const row of rows) {
          const lastSeen = Number(row.last_seen || 0);
          const online = Boolean(row.online) && now - lastSeen < PRESENCE_STALE_MS;
          next[row.id] = { online, lastSeen };
        }
        setPresence(next);
      },
      (error) => console.warn('Presence listener failed:', error.message),
    );
  }, [userUid]);

  // Live profile document, created on first sign-in if it does not exist.
  useEffect(() => {
    if (!isFirebaseConfigured || !userUid) return;
    const uid = userUid;
    return subscribeToUserProfile(
      uid,
      (record) => {
        if (record) {
          const mapped = mapProfile(record);
          if (userEmailVerified && !mapped.is_verified) {
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
          full_name: userDisplayName || userEmail?.split('@')[0] || 'Trader',
          username: undefined,
          avatar_url: userPhotoURL || undefined,
          district: 'Dhaka',
          bio: '',
          rating: 0,
          trade_count: 0,
          eco_points: 0,
          is_verified: Boolean(userEmailVerified),
        };
        setProfileOwner(uid);
        setProfileState(initial);
        saveUserProfile(uid, initial).catch((error) =>
          console.warn('Could not create profile:', error.message),
        );
      },
      (error) => console.warn('Profile listener failed:', error.message),
    );
  }, [userUid, userEmailVerified, userDisplayName, userEmail, userPhotoURL]);

  const favoriteIds = useMemo(() => {
    if (!isFirebaseConfigured) return favoriteState.ids;
    if (!user) return EMPTY_FAVORITES;
    return favoriteState.uid === user.uid ? favoriteState.ids : EMPTY_FAVORITES;
  }, [favoriteState, user]);

  const items = useMemo(
    () =>
      annotate(
        rawItems.map((item) => ({ ...item, is_favorite: favoriteIds.has(item.id) })),
      ),
    [annotate, rawItems, favoriteIds],
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

  // Stats are derived from accepted proposals instead of client-writable
  // counters, so they cannot be farmed with a direct Firestore update. Both
  // participants see the trade because the proposals query is participant-based.
  const acceptedTradeCount = useMemo(
    () => proposals.filter((proposal) => proposal.status === 'accepted' || proposal.status === 'completed').length,
    [proposals],
  );
  const ecoPoints = isFirebaseConfigured ? acceptedTradeCount * 50 : profile.eco_points;
  const tradeCount = isFirebaseConfigured ? acceptedTradeCount : profile.trade_count;

  const updateProfile = useCallback(
    async (
      patch: Partial<Profile>,
    ): Promise<{ avatarUploadFailed?: boolean; avatarError?: string }> => {
      if (!isFirebaseConfigured) {
        setProfileState((prev) => ({ ...prev, ...patch }));
        return {};
      }
      if (!user) throw new Error('Sign in to update your profile.');

      let nextPatch = patch;
      let avatarUploadFailed = false;
      let avatarError: string | undefined;
      if (patch.avatar_url && !/^https?:\/\//i.test(patch.avatar_url)) {
        // A picked image (file://, blob:, data:) must be uploaded before it is
        // written to Firestore so other devices can load it.
        try {
          nextPatch = {
            ...patch,
            avatar_url: await uploadImageToCloudinary(patch.avatar_url, {
              folder: process.env.EXPO_PUBLIC_CLOUDINARY_FOLDER || 'puran-haat',
            }),
          };
        } catch (error) {
          // Uploads may be unconfigured or offline. Keep the existing photo
          // rather than losing every other profile edit the user just made, but
          // report the real reason instead of always blaming the config.
          avatarUploadFailed = true;
          avatarError = (error as Error).message;
          nextPatch = { ...patch };
          delete nextPatch.avatar_url;
          console.warn('Profile photo upload failed:', avatarError);
        }
      }

      const previous = profileStateRef.current;
      setProfileOwner(user.uid);
      setProfileState((prev) => ({ ...prev, ...nextPatch }));
      try {
        await saveUserProfile(user.uid, nextPatch);
      } catch (error) {
        // Roll the optimistic edit back so the form never shows values that were
        // not actually persisted.
        setProfileState(previous);
        throw error;
      }

      // Keep the stored pin consistent with the label: if the area changed but
      // no new coordinates came with it, drop the stale pin so distance is not
      // measured from the place the user just left.
      const hasCoords = nextPatch.latitude != null && nextPatch.longitude != null;
      if (nextPatch.district !== undefined && !hasCoords && nextPatch.district !== previous.district) {
        await clearUserProfileLocation(user.uid).catch((error) =>
          console.warn('Could not clear stale profile location:', (error as Error).message),
        );
      }

      return { avatarUploadFailed, avatarError };
    },
    [user],
  );

  const canUploadPhotos = isCloudinaryConfigured();

  const uploadListingImages = useCallback(
    async (uris: string[]): Promise<string[]> => {
      const cleaned = uris.map((uri) => uri.trim()).filter((uri) => uri.length > 0);
      const local = cleaned.filter((uri) => !/^https?:\/\//i.test(uri));
      if (local.length === 0) return cleaned;
      if (!canUploadPhotos) throw new Error(cloudinaryConfigHint());

      const uploaded = await uploadImagesToCloudinary(local, {
        folder: process.env.EXPO_PUBLIC_CLOUDINARY_FOLDER || 'puran-haat',
      });

      // Rebuild the array in order, swapping each local URI for its public URL.
      let cursor = 0;
      return cleaned.map((uri) =>
        /^https?:\/\//i.test(uri) ? uri : uploaded[cursor++],
      );
    },
    [canUploadPhotos],
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

  const updateItem = useCallback(
    async (id: string, patch: EditableItemPatch) => {
      const existing = rawItems.find((entry) => entry.id === id);
      if (!existing) throw new Error('Listing not found.');

      if (isFirebaseConfigured) {
        if (!user) throw new Error('Sign in to edit a listing.');
        if (existing.user_id !== user.uid) {
          throw new Error('You can only edit your own listings.');
        }
        if (!user.emailVerified) {
          throw new Error('Verify your email before editing a listing.');
        }
      }

      // Ownership, seller snapshot, and creation time are immutable in the
      // rules; keep them from the existing document on every edit.
      const nextItem: Item = {
        ...existing,
        ...patch,
        id: existing.id,
        user_id: existing.user_id,
        user: existing.user,
        created_at: existing.created_at,
      };

      setRawItems((prev) =>
        prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
      );

      if (!isFirebaseConfigured) return;

      try {
        await saveItem(nextItem);
      } catch (error) {
        setRawItems((prev) =>
          prev.map((entry) => (entry.id === id ? existing : entry)),
        );
        throw error;
      }
    },
    [rawItems, user],
  );

  const deleteItem = useCallback(
    async (id: string) => {
      const existing = rawItems.find((entry) => entry.id === id);
      if (!existing) throw new Error('Listing not found.');

      if (isFirebaseConfigured) {
        if (!user) throw new Error('Sign in to delete a listing.');
        if (existing.user_id !== user.uid) {
          throw new Error('You can only delete your own listings.');
        }
        if (!user.emailVerified) {
          throw new Error('Verify your email before deleting a listing.');
        }
      }

      setRawItems((prev) => prev.filter((entry) => entry.id !== id));

      if (!isFirebaseConfigured) return;

      try {
        await deleteItemDoc(id);
      } catch (error) {
        setRawItems((prev) =>
          [existing, ...prev].sort((a, b) =>
            (b.created_at || '').localeCompare(a.created_at || ''),
          ),
        );
        throw error;
      }
    },
    [rawItems, user],
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
        createConversationWithMessage(id, doc, user.uid, message)
          .then(() => {
            setConversationState((prev) => ({
              ...prev,
              rows: prev.rows.map((entry) =>
                entry.id === id ? { ...entry, pending: false } : entry,
              ),
            }));
            void notifyConversationMessage(id);
          })
          .catch((error) => {
            // Drop the optimistic thread so the chat screen shows its
            // "conversation not found" state instead of a fake history.
            setConversationState((prev) => ({
              ...prev,
              rows: prev.rows.filter((entry) => entry.id !== id),
            }));
            console.warn('Could not create conversation:', error.message);
          });
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
        conversations.find((entry) => entry.id === convId) ||
        conversations.find((entry) => entry.itemId === convId);
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
      // Sending ends the typing state immediately for the other side.
      await setTypingDoc(conversation.id, user.uid, false).catch(() => {});
      // Fire-and-forget: wake the recipient's device (no-op without a Worker).
      void notifyConversationMessage(conversation.id);
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
      // Guests (anonymous) may chat, but an unverified *email* account cannot
      // write to conversations yet — skip instead of a silent permission error.
      if (!user.isAnonymous && !user.emailVerified) return;
      try {
        await clearConversationUnread(convId, user.uid);
      } catch (error) {
        console.warn('Could not mark conversation read:', (error as Error).message);
      }
    },
    [conversations, user],
  );

  const setTyping = useCallback(
    async (convId: string, isTyping: boolean) => {
      if (!isFirebaseConfigured || !user) return;
      // Chat-capable only: guests qualify, unverified email accounts do not.
      if (!user.isAnonymous && !user.emailVerified) return;
      try {
        await setTypingDoc(convId, user.uid, isTyping);
      } catch (error) {
        console.warn('Could not update typing state:', (error as Error).message);
      }
    },
    [user],
  );

  const acceptTrade = useCallback(
    async (convId: string) => {
      const conversation = conversations.find((entry) => entry.id === convId);
      if (!conversation) throw new Error('Conversation not found.');
      if (isFirebaseConfigured) {
        if (!user) throw new Error('Sign in to accept a trade.');
        if (!conversation.proposalId) throw new Error('There is no proposal to accept.');
        // The proposer must never be able to accept their own offer.
        if (conversation.receiverId !== user.uid) {
          throw new Error('Only the recipient can accept this proposal.');
        }
      }

      const previousStatus = conversation.status;
      setConversationState((prev) => ({
        ...prev,
        rows: prev.rows.map((entry) =>
          entry.id === convId ? { ...entry, status: 'accepted' } : entry,
        ),
      }));

      if (!isFirebaseConfigured) {
        setProfileState((prev) => ({
          ...prev,
          eco_points: prev.eco_points + 50,
          trade_count: prev.trade_count + 1,
        }));
        return;
      }

      try {
        await respondToProposal(convId, conversation.proposalId, 'accepted');
      } catch (error) {
        setConversationState((prev) => ({
          ...prev,
          rows: prev.rows.map((entry) =>
            entry.id === convId ? { ...entry, status: previousStatus } : entry,
          ),
        }));
        throw error;
      }
    },
    [conversations, user],
  );

  const declineTrade = useCallback(
    async (convId: string) => {
      const conversation = conversations.find((entry) => entry.id === convId);
      if (!conversation) throw new Error('Conversation not found.');
      if (isFirebaseConfigured) {
        if (!user) throw new Error('Sign in to decline a trade.');
        if (!conversation.proposalId) throw new Error('There is no proposal to decline.');
        if (conversation.receiverId !== user.uid) {
          throw new Error('Only the recipient can decline this proposal.');
        }
      }

      const previousStatus = conversation.status;
      setConversationState((prev) => ({
        ...prev,
        rows: prev.rows.map((entry) =>
          entry.id === convId ? { ...entry, status: 'declined' } : entry,
        ),
      }));

      if (!isFirebaseConfigured) return;

      try {
        await respondToProposal(convId, conversation.proposalId, 'declined');
      } catch (error) {
        setConversationState((prev) => ({
          ...prev,
          rows: prev.rows.map((entry) =>
            entry.id === convId ? { ...entry, status: previousStatus } : entry,
          ),
        }));
        throw error;
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
      // A thread can hold one live proposal at a time. Reject early with a
      // readable message instead of letting Firestore return permission-denied.
      if (existing?.proposalId) {
        if (existing.status === 'pending') {
          throw new Error(
            'You already have a pending proposal for this item. Open the chat to continue the conversation.',
          );
        }
        if (existing.status === 'accepted') {
          throw new Error(
            `This swap with ${receiver.full_name} is already accepted. Open your chat to coordinate the handover.`,
          );
        }
      }
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
        proposerId: user?.uid,
        receiverId,
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
        proposer_id: user.uid,
        receiver_id: receiverId,
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

      try {
        await saveProposalWithConversation({
          conversationId,
          proposalId,
          proposal: proposalDoc,
          conversation: conversationDoc,
          conversationPatch: existing
            ? {
                lastMessage: message,
                lastMessageAt: now,
                status: 'pending',
                proposalId,
                proposer_id: user.uid,
                receiver_id: receiverId,
                unread: { [user.uid]: 0, [receiverId]: 1 },
              }
            : undefined,
          isNewConversation: !existing,
        });
        await sendMessageDoc(conversationId, user.uid, [user.uid, receiverId], message);
        void notifyConversationMessage(conversationId);
      } catch (error) {
        // Roll back the optimistic proposal/thread so a rejected write does not
        // leave a ghost trade in the UI.
        setProposalState((prev) => ({
          ...prev,
          rows: prev.rows.filter((entry) => entry.id !== proposalId),
        }));
        setConversationState((prev) => ({
          ...prev,
          rows: existing
            ? prev.rows.map((entry) => (entry.id === conversationId ? existing : entry))
            : prev.rows.filter((entry) => entry.id !== conversationId),
        }));
        throw error;
      }
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
    isOffline,
    favorites: Array.from(favoriteIds),
    toggleFavorite,
    addItem,
    updateItem,
    deleteItem,
    seedItems,
    conversations,
    getConversation,
    ensureConversation,
    sendMessage,
    markConversationRead,
    setTyping,
    presence,
    acceptTrade,
    declineTrade,
    proposals,
    sendProposal,
    profile,
    ecoPoints,
    tradeCount,
    updateProfile,
    canUploadPhotos,
    uploadListingImages,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextValue => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};

// Firestore document shapes shared with the mobile app (see src/types in the
// Expo project). The admin site reads the same collections, so the field names
// must stay in sync.

export type VerificationStatus = 'pending' | 'approved' | 'rejected';
export type ModerationStatus = 'clear' | 'flagged' | 'suspended' | 'banned';
export type AuctionStatus = 'scheduled' | 'active' | 'ended';

export type Doc = { id: string } & Record<string, unknown>;

export interface Profile {
  id: string;
  full_name: string;
  username?: string;
  avatar_url?: string;
  district?: string;
  bio?: string;
  rating: number;
  trade_count: number;
  eco_points: number;
  is_verified: boolean;
  trust_score?: number;
  moderation_status?: ModerationStatus;
  suspended_until?: number;
  admin_notes?: string;
  joined_at?: number;
}

export interface AdminMember {
  id: string;
  role: 'super_admin' | 'moderator';
  title?: string;
}

export interface VerificationRequest {
  id: string;
  user_id: string;
  full_name: string;
  username?: string;
  avatar_url?: string;
  district?: string;
  document_type: string;
  file_count: number;
  risk_score: number;
  status: VerificationStatus;
  submitted_at: number;
  reviewed_at?: number;
  reviewed_by?: string;
  notes?: string;
}

export interface ModerationReport {
  id: string;
  user_id: string;
  reporter_id?: string;
  type: 'listing' | 'message' | 'account';
  title: string;
  detail: string;
  item_id?: string;
  item_title?: string;
  created_at: number;
  status: 'open' | 'resolved';
}

export interface AuctionRecord {
  id: string;
  title: string;
  description?: string;
  category_id: string;
  starting_bid: number;
  current_bid?: number;
  participants: number;
  watchers: number;
  starts_at: number;
  duration_hours: number;
  status: AuctionStatus;
  verified_only: boolean;
  created_at: number;
}

export interface RewardRule {
  id: string;
  name: string;
  multiplier: number;
  active: boolean;
  note: string;
}

export interface RewardBadge {
  id: string;
  name: string;
  description: string;
  tier: number;
  active: boolean;
  icon: string;
}

export interface RewardGrant {
  id: string;
  recipient_id: string;
  recipient_name: string;
  reward_type: string;
  reason: string;
  awarded_by: string;
  created_at: number;
}

export interface Item {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  category_id: string;
  co2_saved_kg: number;
  images: string[];
  location_name: string;
  created_at: string;
  trade_mode: 'trade' | 'free' | 'auction';
}

// ---------------------------------------------------------------------------
// Boundary coercion: Firestore hands back untyped maps.
// ---------------------------------------------------------------------------

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const num = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const bool = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const optionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export function toProfile(record: Doc): Profile {
  return {
    id: record.id,
    full_name: str(record.full_name, 'Trader'),
    username: optionalString(record.username),
    avatar_url: optionalString(record.avatar_url),
    district: optionalString(record.district),
    bio: optionalString(record.bio),
    rating: num(record.rating),
    trade_count: num(record.trade_count),
    eco_points: num(record.eco_points),
    is_verified: bool(record.is_verified),
    trust_score: optionalNumber(record.trust_score),
    moderation_status: (record.moderation_status as ModerationStatus | undefined) ?? undefined,
    suspended_until: optionalNumber(record.suspended_until),
    admin_notes: optionalString(record.admin_notes),
    joined_at: optionalNumber(record.joined_at),
  };
}

export function toVerification(record: Doc): VerificationRequest {
  return {
    id: record.id,
    user_id: str(record.user_id),
    full_name: str(record.full_name, 'Trader'),
    username: optionalString(record.username),
    avatar_url: optionalString(record.avatar_url),
    district: optionalString(record.district),
    document_type: str(record.document_type, 'Identity document'),
    file_count: num(record.file_count),
    risk_score: num(record.risk_score),
    status: (record.status as VerificationStatus | undefined) ?? 'pending',
    submitted_at: num(record.submitted_at),
    reviewed_at: optionalNumber(record.reviewed_at),
    reviewed_by: optionalString(record.reviewed_by),
    notes: optionalString(record.notes),
  };
}

export function toReport(record: Doc): ModerationReport {
  return {
    id: record.id,
    user_id: str(record.user_id),
    reporter_id: optionalString(record.reporter_id),
    type: (record.type as ModerationReport['type'] | undefined) ?? 'account',
    title: str(record.title, 'Report'),
    detail: str(record.detail),
    item_id: optionalString(record.item_id),
    item_title: optionalString(record.item_title),
    created_at: num(record.created_at),
    status: record.status === 'resolved' ? 'resolved' : 'open',
  };
}

export function toAuction(record: Doc): AuctionRecord {
  return {
    id: record.id,
    title: str(record.title, 'Auction'),
    description: optionalString(record.description),
    category_id: str(record.category_id, 'home'),
    starting_bid: num(record.starting_bid),
    current_bid: optionalNumber(record.current_bid),
    participants: num(record.participants),
    watchers: num(record.watchers),
    starts_at: num(record.starts_at),
    duration_hours: num(record.duration_hours, 24),
    status: (record.status as AuctionStatus | undefined) ?? 'scheduled',
    verified_only: bool(record.verified_only),
    created_at: num(record.created_at),
  };
}

export function toRule(record: Doc): RewardRule {
  return {
    id: record.id,
    name: str(record.name, 'Rule'),
    multiplier: num(record.multiplier, 1),
    active: bool(record.active),
    note: str(record.note),
  };
}

export function toBadge(record: Doc): RewardBadge {
  return {
    id: record.id,
    name: str(record.name, 'Badge'),
    description: str(record.description),
    tier: num(record.tier, 1),
    active: bool(record.active),
    icon: str(record.icon, 'eco'),
  };
}

export function toGrant(record: Doc): RewardGrant {
  return {
    id: record.id,
    recipient_id: str(record.recipient_id),
    recipient_name: str(record.recipient_name, 'Trader'),
    reward_type: str(record.reward_type, 'Eco-Points'),
    reason: str(record.reason),
    awarded_by: str(record.awarded_by, 'Puran Haat Admin'),
    created_at: num(record.created_at),
  };
}

export function toItem(record: Doc): Item {
  return {
    id: record.id,
    user_id: str(record.user_id),
    title: str(record.title, 'Listing'),
    description: optionalString(record.description),
    category_id: str(record.category_id, 'home'),
    co2_saved_kg: num(record.co2_saved_kg),
    images: Array.isArray(record.images) ? record.images.filter((v): v is string => typeof v === 'string') : [],
    location_name: str(record.location_name, 'Dhaka'),
    created_at: str(record.created_at, ''),
    trade_mode: (record.trade_mode as Item['trade_mode'] | undefined) ?? 'trade',
  };
}

export function toAdminMember(record: Doc): AdminMember {
  return {
    id: record.id,
    role: record.role === 'moderator' ? 'moderator' : 'super_admin',
    title: optionalString(record.title),
  };
}
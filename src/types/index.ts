export type ConditionType = 'brand_new' | 'like_new' | 'gently_used' | 'fair';
export type TradeModeType = 'trade' | 'free' | 'auction';
export type EcoImpactType = 'High' | 'Med' | 'Low';
export type ProposalStatusType = 'pending' | 'accepted' | 'declined' | 'countered' | 'completed';
export type VerificationStatusType = 'pending' | 'approved' | 'rejected';

/**
 * An identity-review request filed from the app and decided in the admin
 * portal. `documents` holds the uploaded identity photo URLs; `risk_score` is
 * the client's own heuristic (the reviewer is never expected to trust it).
 */
export interface VerificationRequest {
  id: string;
  user_id: string;
  full_name: string;
  document_type: string;
  file_count: number;
  risk_score: number;
  status: VerificationStatusType;
  submitted_at: number;
  documents: string[];
  reviewed_at?: number;
  reviewed_by?: string;
  notes?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string; // Material icon name
}

export interface Profile {
  id: string;
  full_name: string;
  username?: string;
  avatar_url?: string;
  district?: string;
  /** Optional coordinates behind `district`, used for "near you" sorting. */
  latitude?: number;
  longitude?: number;
  bio?: string;
  rating: number;
  trade_count: number;
  eco_points: number;
  is_verified: boolean;
}

export interface Item {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  category_id: string;
  condition: ConditionType;
  trade_mode: TradeModeType;
  eco_impact_rating: EcoImpactType;
  co2_saved_kg: number;
  images: string[];
  /** Human-readable area, e.g. "Dhanmondi, Dhaka". Always present. */
  location_name: string;
  /** Coordinates of the pickup area when the poster shared them. */
  latitude?: number;
  longitude?: number;
  /**
   * Distance to the viewer in km. Computed live by the location layer — it is
   * not stored on the document and is absent when the viewer has no location.
   */
  distance_km?: number;
  is_favorite?: boolean;
  user?: Profile;
  created_at: string;
}

export interface TradeProposal {
  id: string;
  proposer_id: string;
  receiver_id: string;
  requested_item_id: string;
  requested_item_title?: string;
  requested_item_image?: string;
  offered_item_id?: string;
  offered_item_title?: string;
  offered_item_image?: string;
  cash_adjustment?: number;
  note?: string;
  status: ProposalStatusType;
  created_at: string;
  requested_item?: Item;
  offered_item?: Item;
  proposer?: Profile;
  receiver?: Profile;
  conversation_id?: string;
}

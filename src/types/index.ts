export type ConditionType = 'brand_new' | 'like_new' | 'gently_used' | 'fair';
export type TradeModeType = 'trade' | 'free' | 'auction';
export type EcoImpactType = 'High' | 'Med' | 'Low';
export type ProposalStatusType = 'pending' | 'accepted' | 'declined' | 'countered' | 'completed';

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
  location_name: string;
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
  offered_item_id?: string;
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

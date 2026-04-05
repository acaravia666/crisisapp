// ─── Enums ────────────────────────────────────────────────────────────────────

export type GearCategory =
  | 'cables'
  | 'microphones'
  | 'speakers'
  | 'stands'
  | 'pedals'
  | 'instruments'
  | 'lighting'
  | 'dj_gear'
  | 'power'
  | 'adapters'
  | 'accessories';

export type AvailabilityStatus = 'available' | 'lent_out' | 'unavailable';

export type UrgencyLevel = 'normal' | 'soon' | 'urgent' | 'emergency';

export type RequestAction = 'rent' | 'lend' | 'sell';

export type RequestStatus = 'open' | 'matched' | 'fulfilled' | 'expired' | 'cancelled';

export type TransactionType = 'rental' | 'loan' | 'sale';

export type TransactionStatus = 'pending' | 'active' | 'completed' | 'disputed' | 'cancelled';

export type NotificationType =
  | 'new_match'
  | 'emergency_broadcast'
  | 'message'
  | 'transaction_update'
  | 'review_received'
  | 'request_expired';

// ─── Domain Models ────────────────────────────────────────────────────────────

export interface User {
  id:            string;
  name:          string;
  email:         string;
  phone:         string | null;
  avatar_url:    string | null;
  bio:           string | null;
  avg_rating:    number;
  review_count:  number;
  response_rate: number;
  last_seen_at:  Date | null;
  is_active:     boolean;
  created_at:    Date;
  updated_at:    Date;
}

export interface GearItem {
  id:          string;
  owner_id:    string;
  name:        string;
  category:    GearCategory;
  description: string | null;
  brand:       string | null;
  model:       string | null;
  photo_urls:  string[];
  can_rent:    boolean;
  can_lend:    boolean;
  can_sell:    boolean;
  rent_price:  number | null;
  sell_price:  number | null;
  status:      AvailabilityStatus;
  condition:   'mint' | 'good' | 'fair' | 'worn' | null;
  tags:        string[];
  created_at:  Date;
  updated_at:  Date;
}

export interface GearRequest {
  id:               string;
  requester_id:     string;
  raw_text:         string | null;
  equipment:        string;
  category:         GearCategory | null;
  quantity:         number;
  urgency:          UrgencyLevel;
  action:           RequestAction;
  status:           RequestStatus;
  location:         { lat: number; lng: number };
  search_radius_km: number;
  expires_at:       Date;
  fulfilled_by_id:  string | null;
  matched_gear_id:  string | null;
  ai_confidence:    number | null;
  notes:            string | null;
  created_at:       Date;
  updated_at:       Date;
}

export interface Transaction {
  id:            string;
  request_id:    string | null;
  gear_item_id:  string;
  lender_id:     string;
  borrower_id:   string;
  type:          TransactionType;
  status:        TransactionStatus;
  agreed_price:  number | null;
  started_at:    Date | null;
  ended_at:      Date | null;
  notes:         string | null;
  created_at:    Date;
  updated_at:    Date;
}

export interface Message {
  id:             string;
  transaction_id: string | null;
  request_id:     string | null;
  sender_id:      string;
  recipient_id:   string;
  body:           string;
  is_read:        boolean;
  sent_at:        Date;
}

export interface Review {
  id:             string;
  transaction_id: string;
  reviewer_id:    string;
  reviewed_id:    string;
  rating:         number;
  comment:        string | null;
  created_at:     Date;
}

export interface Notification {
  id:            string;
  user_id:       string;
  type:          NotificationType;
  title:         string;
  body:          string | null;
  data:          Record<string, unknown> | null;
  is_read:       boolean;
  sent_via_push: boolean;
  created_at:    Date;
}

// ─── Parsed request from AI ───────────────────────────────────────────────────

export interface ParsedGearRequest {
  equipment:  string;
  category:   GearCategory;
  quantity:   number;
  urgency:    UrgencyLevel;
  action:     RequestAction;
  confidence: number;
  notes?:     string;
}

// ─── Fastify JWT augmentation ─────────────────────────────────────────────────

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string; type?: string };
    user:    { sub: string; email: string; type?: string };
  }
}

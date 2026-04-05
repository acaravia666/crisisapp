// Urgency level → request TTL in seconds
export const URGENCY_TTL: Record<string, number> = {
  emergency: 30 * 60,        //  30 minutes
  urgent:    2  * 60 * 60,   //   2 hours
  soon:      6  * 60 * 60,   //   6 hours
  normal:    24 * 60 * 60,   //  24 hours
};

// How many owners to notify per urgency level (non-emergency)
export const NOTIFY_COUNT: Record<string, number> = {
  urgent: 5,
  soon:   3,
  normal: 3,
};

// Gear categories list (mirrors DB enum)
export const GEAR_CATEGORIES = [
  'cables', 'microphones', 'speakers', 'stands', 'pedals',
  'instruments', 'lighting', 'dj_gear', 'power', 'adapters', 'accessories',
] as const;

// BullMQ queue names
export const QUEUES = {
  MATCH:        'match-requests',
  NOTIFY:       'notifications',
  NOTIFY_EMERGENCY: 'notifications-emergency',
} as const;

// Redis key prefixes
export const REDIS_KEYS = {
  USER_LOCATION:    'geo:users',
  USER_FCM_TOKEN:   (userId: string) => `fcm:${userId}`,
  REQUEST_CACHE:    (requestId: string) => `req:${requestId}`,
} as const;

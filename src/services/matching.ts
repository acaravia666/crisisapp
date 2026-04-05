import { pool } from '../db/pool';
import { redis } from '../db/redis';
import { GearRequest } from '../types';
import { NOTIFY_COUNT, REDIS_KEYS } from '../config/constants';

export interface MatchCandidate {
  gear_id:       string;
  owner_id:      string;
  owner_name:    string;
  gear_name:     string;
  category:      string;
  distance_m:    number;
  avg_rating:    number;
  response_rate: number;
  score:         number;
}

const W_DISTANCE  = 0.40;
const W_RATING    = 0.30;
const W_RESPONSE  = 0.20;
const W_AVAIL     = 0.10;
const MAX_DIST_M  = 5000;

function computeScore(candidate: Omit<MatchCandidate, 'score'>, maxDistM: number): number {
  const distScore     = Math.max(0, 1 - (candidate.distance_m / maxDistM));
  const ratingScore   = (candidate.avg_rating ?? 0) / 5;
  const responseScore = (candidate.response_rate ?? 0) / 100;

  return (
    W_DISTANCE  * distScore     +
    W_RATING    * ratingScore   +
    W_RESPONSE  * responseScore +
    W_AVAIL     * 1             // all candidates are 'available' by DB filter
  );
}

export async function findMatches(request: GearRequest): Promise<MatchCandidate[]> {
  // createRequest returns flat lat/lng; GearRequest type expects location object — handle both
  const nested = request.location as unknown as { lat: number; lng: number } | undefined;
  const flat   = request as unknown as { lat?: number; lng?: number };
  const loc    = (nested?.lat != null && nested?.lng != null)
    ? nested
    : { lat: flat.lat!, lng: flat.lng! };

  if (loc.lat == null || loc.lng == null) {
    console.error('[matching] findMatches called with no location — request:', request.id);
    return [];
  }

  const radiusM = request.search_radius_km * 1000;

  const actionCol =
    request.action === 'rent' ? 'gi.can_rent = true' :
    request.action === 'sell' ? 'gi.can_sell = true' :
                                'gi.can_lend = true';

  const values: unknown[] = [
    loc.lng, loc.lat,
    radiusM,
    request.category,
    request.requester_id,
  ];

  const { rows } = await pool.query<Omit<MatchCandidate, 'score'>>(
    `SELECT
       gi.id          AS gear_id,
       gi.owner_id,
       u.name         AS owner_name,
       gi.name        AS gear_name,
       gi.category,
       u.avg_rating,
       u.response_rate,
       ST_Distance(
         ul.location,
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
       ) AS distance_m
     FROM gear_items gi
     JOIN user_locations ul ON ul.user_id = gi.owner_id
     JOIN users u            ON u.id = gi.owner_id
     WHERE gi.status = 'available'
       AND ${actionCol}
       AND gi.owner_id != $5
       AND ST_DWithin(
         ul.location,
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
         $3
       )
       AND gi.category = $4
     ORDER BY distance_m ASC
     LIMIT 50`,
    values
  );

  const maxDist = radiusM || MAX_DIST_M;
  return rows.map(r => ({ ...r, score: computeScore(r, maxDist) }))
             .sort((a, b) => b.score - a.score);
}

export function getNotifyCount(urgency: string): number {
  return NOTIFY_COUNT[urgency] ?? 3;
}

// Fetch all FCM tokens for a list of user IDs
// Tries Redis first (fast), falls back to DB
export async function getDeviceTokens(userIds: string[]): Promise<Record<string, string>> {
  const tokenMap: Record<string, string> = {};

  await Promise.all(userIds.map(async (uid) => {
    const cached = await redis.get(REDIS_KEYS.USER_FCM_TOKEN(uid));
    if (cached) {
      tokenMap[uid] = cached;
      return;
    }

    const { rows } = await pool.query<{ fcm_token: string }>(
      `SELECT fcm_token FROM users WHERE id = $1 AND fcm_token IS NOT NULL`,
      [uid]
    );
    if (rows[0]?.fcm_token) {
      tokenMap[uid] = rows[0].fcm_token;
    }
  }));

  return tokenMap;
}

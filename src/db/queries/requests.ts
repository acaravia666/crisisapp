import { pool } from '../pool';
import { GearRequest, GearCategory, UrgencyLevel, RequestAction } from '../../types';
import { URGENCY_TTL } from '../../config/constants';

function expiresAt(urgency: UrgencyLevel): Date {
  const ttl = URGENCY_TTL[urgency] ?? URGENCY_TTL.normal;
  return new Date(Date.now() + ttl * 1000);
}

export async function createRequest(data: {
  requester_id:     string;
  equipment:        string;
  category?:        GearCategory;
  quantity?:        number;
  urgency:          UrgencyLevel;
  action:           RequestAction;
  lat:              number;
  lng:              number;
  search_radius_km?: number;
  raw_text?:        string;
  ai_confidence?:   number;
  notes?:           string;
}): Promise<GearRequest> {
  const expires = expiresAt(data.urgency);
  const { rows } = await pool.query<GearRequest>(
    `INSERT INTO gear_requests
      (requester_id, equipment, category, quantity, urgency, action,
       location, search_radius_km, expires_at, raw_text, ai_confidence, notes)
     VALUES ($1,$2,$3,$4,$5,$6,
             ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography,
             $9,$10,$11,$12,$13)
     RETURNING
       id, requester_id, raw_text, equipment, category, quantity,
       urgency, action, status, search_radius_km, expires_at,
       fulfilled_by_id, matched_gear_id, ai_confidence, notes,
       created_at, updated_at,
       ST_Y(location::geometry) AS lat,
       ST_X(location::geometry) AS lng`,
    [
      data.requester_id, data.equipment,
      data.category ?? null,
      data.quantity ?? 1,
      data.urgency, data.action,
      data.lng, data.lat,
      data.search_radius_km ?? 5,
      expires,
      data.raw_text ?? null,
      data.ai_confidence ?? null,
      data.notes ?? null,
    ]
  );
  return rows[0];
}

export async function getRequestById(id: string): Promise<GearRequest | null> {
  const { rows } = await pool.query<GearRequest>(
    `SELECT
       id, requester_id, raw_text, equipment, category, quantity,
       urgency, action, status, search_radius_km, expires_at,
       fulfilled_by_id, matched_gear_id, ai_confidence, notes,
       created_at, updated_at,
       ST_Y(location::geometry) AS lat,
       ST_X(location::geometry) AS lng
     FROM gear_requests WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function getOpenRequestsByUser(userId: string): Promise<GearRequest[]> {
  const { rows } = await pool.query<GearRequest>(
    `SELECT
       id, requester_id, raw_text, equipment, category, quantity,
       urgency, action, status, search_radius_km, expires_at,
       fulfilled_by_id, matched_gear_id, ai_confidence, notes,
       created_at, updated_at,
       ST_Y(location::geometry) AS lat,
       ST_X(location::geometry) AS lng
     FROM gear_requests
     WHERE requester_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

export async function getNearbyRequests(params: {
  lat:      number;
  lng:      number;
  radiusKm: number;
  limit?:   number;
}): Promise<(GearRequest & { distance_m: number; requester_name: string })[]> {
  const { rows } = await pool.query(
    `SELECT
       gr.*,
       u.name AS requester_name,
       ST_Distance(
         gr.location,
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
       ) AS distance_m,
       ST_Y(gr.location::geometry) AS lat,
       ST_X(gr.location::geometry) AS lng
     FROM gear_requests gr
     JOIN users u ON u.id = gr.requester_id
     WHERE gr.status = 'open'
       AND gr.expires_at > NOW()
       AND ST_DWithin(
         gr.location,
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
         $3
       )
     ORDER BY
       CASE gr.urgency
         WHEN 'emergency' THEN 1
         WHEN 'urgent'    THEN 2
         WHEN 'soon'      THEN 3
         ELSE 4
       END,
       distance_m ASC
     LIMIT $4`,
    [params.lng, params.lat, params.radiusKm * 1000, params.limit ?? 50]
  );
  return rows;
}

export async function updateRequestStatus(
  id: string,
  status: string,
  extra?: { fulfilled_by_id?: string; matched_gear_id?: string }
): Promise<void> {
  await pool.query(
    `UPDATE gear_requests
     SET status          = $1,
         fulfilled_by_id = COALESCE($2, fulfilled_by_id),
         matched_gear_id = COALESCE($3, matched_gear_id)
     WHERE id = $4`,
    [status, extra?.fulfilled_by_id ?? null, extra?.matched_gear_id ?? null, id]
  );
}

// Called by a cron-style worker to expire old requests
export async function expireStaleRequests(): Promise<string[]> {
  const { rows } = await pool.query<{ id: string }>(
    `UPDATE gear_requests
     SET status = 'expired'
     WHERE status = 'open' AND expires_at < NOW()
     RETURNING id`
  );
  return rows.map(r => r.id);
}

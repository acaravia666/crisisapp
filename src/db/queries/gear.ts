import { pool } from '../pool';
import { GearItem, GearCategory, AvailabilityStatus } from '../../types';

export async function createGearItem(data: {
  owner_id:    string;
  name:        string;
  category:    GearCategory;
  description?: string;
  brand?:      string;
  model?:      string;
  photo_urls?: string[];
  can_rent?:   boolean;
  can_lend?:   boolean;
  can_sell?:   boolean;
  rent_price?: number;
  sell_price?: number;
  condition?:  string;
  tags?:       string[];
}): Promise<GearItem> {
  const { rows } = await pool.query<GearItem>(
    `INSERT INTO gear_items
      (owner_id, name, category, description, brand, model,
       photo_urls, can_rent, can_lend, can_sell, rent_price, sell_price, condition, tags)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [
      data.owner_id, data.name, data.category,
      data.description ?? null, data.brand ?? null, data.model ?? null,
      data.photo_urls  ?? [],
      data.can_rent  ?? true,
      data.can_lend  ?? true,
      data.can_sell  ?? false,
      data.rent_price  ?? null,
      data.sell_price  ?? null,
      data.condition   ?? null,
      data.tags        ?? [],
    ]
  );
  return rows[0];
}

export async function getGearByOwner(ownerId: string): Promise<GearItem[]> {
  const { rows } = await pool.query<GearItem>(
    `SELECT * FROM gear_items WHERE owner_id = $1 ORDER BY created_at DESC`,
    [ownerId]
  );
  return rows;
}

export async function getGearById(id: string): Promise<GearItem | null> {
  const { rows } = await pool.query<GearItem>(
    `SELECT * FROM gear_items WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function updateGearItem(
  id: string,
  ownerId: string,
  data: Partial<GearItem>
): Promise<GearItem | null> {
  const allowed = [
    'name','category','description','brand','model',
    'can_rent','can_lend','can_sell','rent_price','sell_price',
    'condition','tags',
  ];

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const key of allowed) {
    if (key in data) {
      fields.push(`${key} = $${idx++}`);
      values.push((data as Record<string, unknown>)[key]);
    }
  }

  if (fields.length === 0) return getGearById(id);

  values.push(id, ownerId);
  const { rows } = await pool.query<GearItem>(
    `UPDATE gear_items SET ${fields.join(', ')}
     WHERE id = $${idx} AND owner_id = $${idx + 1}
     RETURNING *`,
    values
  );
  return rows[0] ?? null;
}

export async function updateGearStatus(
  id: string,
  ownerId: string,
  status: AvailabilityStatus
): Promise<GearItem | null> {
  const { rows } = await pool.query<GearItem>(
    `UPDATE gear_items SET status = $1
     WHERE id = $2 AND owner_id = $3
     RETURNING *`,
    [status, id, ownerId]
  );
  return rows[0] ?? null;
}

export async function deleteGearItem(id: string, ownerId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM gear_items WHERE id = $1 AND owner_id = $2`,
    [id, ownerId]
  );
  return (rowCount ?? 0) > 0;
}

export interface NearbyGear extends GearItem {
  distance_m:   number;
  owner_name:   string;
  owner_rating: number;
}

export async function getNearbyGear(params: {
  lat:      number;
  lng:      number;
  radiusKm: number;
  category?: GearCategory;
  action?:  'rent' | 'lend' | 'sell';
  limit?:   number;
}): Promise<NearbyGear[]> {
  const values: unknown[] = [
    params.lng, params.lat,
    params.radiusKm * 1000,
  ];

  let categoryFilter = '';
  let actionFilter = '';

  if (params.category) {
    values.push(params.category);
    categoryFilter = `AND gi.category = $${values.length}`;
  }

  if (params.action) {
    const col = params.action === 'rent' ? 'can_rent'
              : params.action === 'sell' ? 'can_sell'
              : 'can_lend';
    actionFilter = `AND gi.${col} = true`;
  }

  values.push(params.limit ?? 50);

  const { rows } = await pool.query<NearbyGear>(
    `SELECT
       gi.*,
       u.name        AS owner_name,
       u.avg_rating  AS owner_rating,
       ST_Distance(ul.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_m
     FROM gear_items gi
     JOIN user_locations ul ON ul.user_id = gi.owner_id
     JOIN users u            ON u.id = gi.owner_id
     WHERE gi.status = 'available'
       AND ST_DWithin(ul.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
       ${categoryFilter}
       ${actionFilter}
     ORDER BY distance_m ASC
     LIMIT $${values.length}`,
    values
  );
  return rows;
}

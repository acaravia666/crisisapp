import { pool } from '../pool';
import { User } from '../../types';

export async function createUser(data: {
  name: string;
  email: string;
  password_hash: string;
  phone?: string;
}): Promise<User> {
  const { rows } = await pool.query<User>(
    `INSERT INTO users (name, email, password_hash, phone)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, phone, avatar_url, bio,
               avg_rating, review_count, response_rate,
               last_seen_at, is_active, created_at, updated_at`,
    [data.name, data.email, data.password_hash, data.phone ?? null]
  );
  return rows[0];
}

export async function findUserByEmail(email: string): Promise<(User & { password_hash: string }) | null> {
  const { rows } = await pool.query<User & { password_hash: string }>(
    `SELECT id, name, email, phone, avatar_url, bio,
            avg_rating, review_count, response_rate,
            last_seen_at, is_active, created_at, updated_at,
            password_hash
     FROM users WHERE email = $1 AND is_active = true`,
    [email]
  );
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const { rows } = await pool.query<User>(
    `SELECT id, name, email, phone, avatar_url, bio,
            avg_rating, review_count, response_rate,
            is_verified, last_seen_at, is_active, created_at, updated_at
     FROM users WHERE id = $1 AND is_active = true`,
    [id]
  );
  return rows[0] ?? null;
}

export async function updateUser(id: string, data: Partial<{
  name: string;
  phone: string;
  avatar_url: string;
  bio: string;
}>): Promise<User | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(val);
    }
  }

  if (fields.length === 0) return findUserById(id);

  values.push(id);
  const { rows } = await pool.query<User>(
    `UPDATE users SET ${fields.join(', ')}
     WHERE id = $${idx} AND is_active = true
     RETURNING id, name, email, phone, avatar_url, bio,
               avg_rating, review_count, response_rate,
               last_seen_at, is_active, created_at, updated_at`,
    values
  );
  return rows[0] ?? null;
}

export async function updateUserLocation(userId: string, lat: number, lng: number, accuracy?: number): Promise<void> {
  await pool.query(
    `INSERT INTO user_locations (user_id, location, accuracy_m)
     VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4)
     ON CONFLICT (user_id) DO UPDATE
       SET location   = EXCLUDED.location,
           accuracy_m = EXCLUDED.accuracy_m,
           updated_at = NOW()`,
    [userId, lng, lat, accuracy ?? null]
  );

  // Also update last_seen_at
  await pool.query(
    `UPDATE users SET last_seen_at = NOW() WHERE id = $1`,
    [userId]
  );
}

export async function updateFcmToken(userId: string, token: string): Promise<void> {
  await pool.query(
    `UPDATE users SET fcm_token = $1 WHERE id = $2`,
    [token, userId]
  );
}

export async function recalcUserRating(userId: string): Promise<void> {
  await pool.query(
    `UPDATE users
     SET avg_rating   = (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE reviewed_id = $1),
         review_count = (SELECT COUNT(*)                 FROM reviews WHERE reviewed_id = $1)
     WHERE id = $1`,
    [userId]
  );
}

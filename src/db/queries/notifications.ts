import { pool } from '../pool';
import { Notification, NotificationType } from '../../types';

export async function createNotification(data: {
  user_id:        string;
  type:           NotificationType;
  title:          string;
  body?:          string;
  data?:          Record<string, unknown>;
  sent_via_push?: boolean;
}): Promise<Notification> {
  const { rows } = await pool.query<Notification>(
    `INSERT INTO notifications (user_id, type, title, body, data, sent_via_push)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [
      data.user_id, data.type, data.title,
      data.body          ?? null,
      data.data          ? JSON.stringify(data.data) : null,
      data.sent_via_push ?? false,
    ]
  );
  return rows[0];
}

export async function createNotificationsForUsers(
  userIds: string[],
  payload: Omit<Parameters<typeof createNotification>[0], 'user_id'>
): Promise<void> {
  if (userIds.length === 0) return;

  const values: unknown[] = [];
  const placeholders = userIds.map((uid, i) => {
    const base = i * 6;
    values.push(
      uid,
      payload.type,
      payload.title,
      payload.body          ?? null,
      payload.data          ? JSON.stringify(payload.data) : null,
      payload.sent_via_push ?? false,
    );
    return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6})`;
  });

  await pool.query(
    `INSERT INTO notifications (user_id, type, title, body, data, sent_via_push)
     VALUES ${placeholders.join(',')}`,
    values
  );
}

export async function getNotificationsForUser(
  userId: string,
  limit = 50,
  offset = 0
): Promise<Notification[]> {
  const { rows } = await pool.query<Notification>(
    `SELECT * FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return rows;
}

export async function markNotificationsRead(userId: string): Promise<void> {
  await pool.query(
    `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
    [userId]
  );
}

export async function markNotificationPushSent(id: string): Promise<void> {
  await pool.query(
    `UPDATE notifications SET sent_via_push = true WHERE id = $1`,
    [id]
  );
}

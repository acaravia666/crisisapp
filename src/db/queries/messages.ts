import { pool } from '../pool';
import { Message } from '../../types';

export async function createMessage(data: {
  transaction_id?: string;
  request_id?:     string;
  sender_id:       string;
  recipient_id:    string;
  body:            string;
}): Promise<Message> {
  const { rows } = await pool.query<Message>(
    `INSERT INTO messages (transaction_id, request_id, sender_id, recipient_id, body)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [
      data.transaction_id ?? null,
      data.request_id     ?? null,
      data.sender_id,
      data.recipient_id,
      data.body,
    ]
  );
  return rows[0];
}

export async function getMessagesByContext(
  contextId: string,
  userId: string
): Promise<Message[]> {
  const { rows } = await pool.query<Message>(
    `SELECT * FROM messages
     WHERE (transaction_id = $1 OR request_id = $1)
       AND (sender_id = $2 OR recipient_id = $2)
     ORDER BY sent_at ASC`,
    [contextId, userId]
  );
  return rows;
}

export async function markMessagesRead(contextId: string, recipientId: string): Promise<void> {
  await pool.query(
    `UPDATE messages
     SET is_read = true
     WHERE (transaction_id = $1 OR request_id = $1)
       AND recipient_id = $2
       AND is_read = false`,
    [contextId, recipientId]
  );
}

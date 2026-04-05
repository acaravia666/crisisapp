import { pool } from '../pool';
import { Transaction, TransactionType, TransactionStatus } from '../../types';

function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function createTransaction(data: {
  request_id?:   string;
  gear_item_id:  string;
  lender_id:     string;
  borrower_id:   string;
  type:          TransactionType;
  agreed_price?: number;
  notes?:        string;
}): Promise<Transaction> {
  const delivery_pin = generatePin();

  const { rows } = await pool.query<Transaction>(
    `INSERT INTO transactions
      (request_id, gear_item_id, lender_id, borrower_id, type, agreed_price, notes, delivery_pin)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      data.request_id   ?? null,
      data.gear_item_id,
      data.lender_id,
      data.borrower_id,
      data.type,
      data.agreed_price ?? null,
      data.notes        ?? null,
      delivery_pin,
    ]
  );
  return rows[0];
}

export async function getTransactionById(id: string): Promise<Transaction & { gear_name?: string; lender_name?: string; borrower_name?: string } | null> {
  const { rows } = await pool.query(
    `SELECT t.*,
            g.name           AS gear_name,
            lu.name          AS lender_name,
            lu.is_verified   AS lender_verified,
            bu.name          AS borrower_name,
            bu.is_verified   AS borrower_verified
     FROM transactions t
     LEFT JOIN gear_items g ON g.id = t.gear_item_id
     LEFT JOIN users lu     ON lu.id = t.lender_id
     LEFT JOIN users bu     ON bu.id = t.borrower_id
     WHERE t.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function getTransactionByRequestId(requestId: string): Promise<Transaction | null> {
  const { rows } = await pool.query<Transaction>(
    `SELECT * FROM transactions WHERE request_id = $1 AND status != 'cancelled' LIMIT 1`,
    [requestId]
  );
  return rows[0] ?? null;
}

export async function getTransactionsByUser(userId: string): Promise<(Transaction & { gear_name?: string })[]> {
  const { rows } = await pool.query(
    `SELECT t.*, g.name AS gear_name
     FROM transactions t
     LEFT JOIN gear_items g ON g.id = t.gear_item_id
     WHERE t.lender_id = $1 OR t.borrower_id = $1
     ORDER BY t.created_at DESC`,
    [userId]
  );
  return rows;
}

export async function updateTransactionStatus(
  id: string,
  status: TransactionStatus,
  userId: string
): Promise<Transaction | null> {
  const extra =
    status === 'active'    ? ', started_at = NOW()' :
    status === 'completed' ? ', ended_at   = NOW()' : '';

  const { rows } = await pool.query<Transaction>(
    `UPDATE transactions
     SET status = $1 ${extra}
     WHERE id = $2 AND (lender_id = $3 OR borrower_id = $3)
     RETURNING *`,
    [status, id, userId]
  );
  return rows[0] ?? null;
}

// Borrower enters delivery PIN + optional photos → active, generates return_pin
export async function confirmDelivery(
  id: string,
  borrowerId: string,
  pin: string,
  photos: string[] = []
): Promise<{ ok: boolean; tx?: Transaction; error?: string }> {
  const { rows: current } = await pool.query<Transaction>(
    `SELECT * FROM transactions WHERE id = $1 AND borrower_id = $2`,
    [id, borrowerId]
  );
  const tx = current[0];
  if (!tx)                     return { ok: false, error: 'Transaction not found' };
  if (tx.status !== 'pending') return { ok: false, error: 'Transaction is not pending' };
  if (tx.delivery_pin !== pin) return { ok: false, error: 'Invalid PIN' };

  const return_pin = generatePin();
  const { rows } = await pool.query<Transaction>(
    `UPDATE transactions
     SET status = 'active', started_at = NOW(), return_pin = $1,
         delivery_photos = $2
     WHERE id = $3
     RETURNING *`,
    [return_pin, JSON.stringify(photos), id]
  );
  return { ok: true, tx: rows[0] };
}

// Lender enters return PIN + optional photos → completed
export async function confirmReturn(
  id: string,
  lenderId: string,
  pin: string,
  photos: string[] = []
): Promise<{ ok: boolean; tx?: Transaction; error?: string }> {
  const { rows: current } = await pool.query<Transaction>(
    `SELECT * FROM transactions WHERE id = $1 AND lender_id = $2`,
    [id, lenderId]
  );
  const tx = current[0];
  if (!tx)                    return { ok: false, error: 'Transaction not found' };
  if (tx.status !== 'active') return { ok: false, error: 'Transaction is not active' };
  if (tx.return_pin !== pin)  return { ok: false, error: 'Invalid PIN' };

  const { rows } = await pool.query<Transaction>(
    `UPDATE transactions
     SET status = 'completed', ended_at = NOW(),
         return_photos = $1
     WHERE id = $2
     RETURNING *`,
    [JSON.stringify(photos), id]
  );
  return { ok: true, tx: rows[0] };
}

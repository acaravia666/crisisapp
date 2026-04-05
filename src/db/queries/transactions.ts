import { pool } from '../pool';
import { Transaction, TransactionType, TransactionStatus } from '../../types';

export async function createTransaction(data: {
  request_id?:   string;
  gear_item_id:  string;
  lender_id:     string;
  borrower_id:   string;
  type:          TransactionType;
  agreed_price?: number;
  notes?:        string;
}): Promise<Transaction> {
  const { rows } = await pool.query<Transaction>(
    `INSERT INTO transactions
      (request_id, gear_item_id, lender_id, borrower_id, type, agreed_price, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      data.request_id   ?? null,
      data.gear_item_id,
      data.lender_id,
      data.borrower_id,
      data.type,
      data.agreed_price ?? null,
      data.notes        ?? null,
    ]
  );
  return rows[0];
}

export async function getTransactionById(id: string): Promise<Transaction & { gear_name?: string; lender_name?: string; borrower_name?: string } | null> {
  const { rows } = await pool.query(
    `SELECT t.*,
            g.name        AS gear_name,
            lu.name       AS lender_name,
            bu.name       AS borrower_name
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

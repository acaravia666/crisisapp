import { pool } from '../pool';
import { Review } from '../../types';

export async function createReview(data: {
  transaction_id: string;
  reviewer_id:    string;
  reviewed_id:    string;
  rating:         number;
  comment?:       string;
}): Promise<Review> {
  const { rows } = await pool.query<Review>(
    `INSERT INTO reviews (transaction_id, reviewer_id, reviewed_id, rating, comment)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [
      data.transaction_id,
      data.reviewer_id,
      data.reviewed_id,
      data.rating,
      data.comment ?? null,
    ]
  );
  return rows[0];
}

export async function getReviewsByUser(userId: string): Promise<(Review & { reviewer_name: string })[]> {
  const { rows } = await pool.query<Review & { reviewer_name: string }>(
    `SELECT r.*, u.name AS reviewer_name
     FROM reviews r
     JOIN users u ON u.id = r.reviewer_id
     WHERE r.reviewed_id = $1
     ORDER BY r.created_at DESC`,
    [userId]
  );
  return rows;
}

export async function hasReviewed(transactionId: string, reviewerId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM reviews WHERE transaction_id = $1 AND reviewer_id = $2`,
    [transactionId, reviewerId]
  );
  return rows.length > 0;
}

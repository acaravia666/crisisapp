import { Pool } from 'pg';
import { env } from '../config/env';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max:              20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: {
    rejectUnauthorized: false // Required for Neon/Vercel Postgres unless a CA is provided
  },
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
});

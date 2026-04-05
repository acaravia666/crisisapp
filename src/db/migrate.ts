import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from './pool';

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id         SERIAL PRIMARY KEY,
        name       TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const migrationFiles = [
      '001_initial.sql',
    ];

    for (const file of migrationFiles) {
      const { rows } = await client.query(
        'SELECT id FROM migrations WHERE name = $1', [file]
      );

      if (rows.length > 0) {
        console.log(`[skip] ${file} already applied`);
        continue;
      }

      console.log(`[run]  ${file}`);
      const sql = readFileSync(join(__dirname, 'migrations', file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO migrations(name) VALUES($1)', [file]);
        await client.query('COMMIT');
        console.log(`[ok]   ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.log('All migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

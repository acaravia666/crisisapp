import { config } from 'dotenv';
config();

import bcrypt from 'bcryptjs';
import { pool } from './pool';

const TEST_USER = {
  name:     'Test User',
  email:    'test@crisisapp.dev',
  password: 'Crisis2024!',
  phone:    '+1 555-0100',
};

async function seed() {
  const client = await pool.connect();

  try {
    // Check if already exists
    const { rows: existing } = await client.query(
      `SELECT id FROM users WHERE email = $1`,
      [TEST_USER.email]
    );

    if (existing.length > 0) {
      console.log(`[seed] Test user already exists — id: ${existing[0].id}`);
      console.log(`[seed] email:    ${TEST_USER.email}`);
      console.log(`[seed] password: ${TEST_USER.password}`);
      return;
    }

    const password_hash = await bcrypt.hash(TEST_USER.password, 12);

    const { rows } = await client.query(
      `INSERT INTO users (name, email, password_hash, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, phone, created_at`,
      [TEST_USER.name, TEST_USER.email, password_hash, TEST_USER.phone]
    );

    const user = rows[0];

    // Add a location (Buenos Aires, Plaza de Mayo) so geo queries work
    await client.query(
      `INSERT INTO user_locations (user_id, location)
       VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography)`,
      [user.id, -58.3816, -34.6037]
    );

    console.log('');
    console.log('✓ Test user created');
    console.log('──────────────────────────────');
    console.log(`  id:       ${user.id}`);
    console.log(`  name:     ${user.name}`);
    console.log(`  email:    ${user.email}`);
    console.log(`  password: ${TEST_USER.password}`);
    console.log(`  phone:    ${user.phone}`);
    console.log(`  location: Buenos Aires (-34.6037, -58.3816)`);
    console.log('──────────────────────────────');
    console.log('');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('[seed] Error:', err.message);
  process.exit(1);
});

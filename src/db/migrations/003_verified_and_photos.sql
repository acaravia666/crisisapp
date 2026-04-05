-- Migration 003: Verified badge + handshake photos

-- A: Verified users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- B: Handshake photos stored as JSON arrays of URLs
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS delivery_photos JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS return_photos   JSONB DEFAULT '[]';

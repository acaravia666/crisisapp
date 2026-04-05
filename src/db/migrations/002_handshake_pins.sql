-- Migration 002: Digital handshake PINs for delivery and return verification
-- Run this against the Neon database before deploying

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS delivery_pin  CHAR(4),
  ADD COLUMN IF NOT EXISTS return_pin    CHAR(4);

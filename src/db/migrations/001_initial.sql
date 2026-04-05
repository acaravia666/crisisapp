-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE gear_category AS ENUM (
  'cables', 'microphones', 'speakers', 'stands', 'pedals',
  'instruments', 'lighting', 'dj_gear', 'power', 'adapters', 'accessories'
);

CREATE TYPE availability_status AS ENUM ('available', 'lent_out', 'unavailable');

CREATE TYPE urgency_level AS ENUM ('normal', 'soon', 'urgent', 'emergency');

CREATE TYPE request_action AS ENUM ('rent', 'lend', 'sell');

CREATE TYPE request_status AS ENUM ('open', 'matched', 'fulfilled', 'expired', 'cancelled');

CREATE TYPE transaction_type AS ENUM ('rental', 'loan', 'sale');

CREATE TYPE transaction_status AS ENUM ('pending', 'active', 'completed', 'disputed', 'cancelled');

CREATE TYPE notification_type AS ENUM (
  'new_match', 'emergency_broadcast', 'message', 'transaction_update',
  'review_received', 'request_expired'
);

-- ─── Users ────────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  phone         TEXT,
  password_hash TEXT NOT NULL,
  avatar_url    TEXT,
  bio           TEXT,
  avg_rating    NUMERIC(3,2)  DEFAULT 0,
  review_count  INTEGER       DEFAULT 0,
  response_rate NUMERIC(5,2)  DEFAULT 0,
  last_seen_at  TIMESTAMPTZ,
  fcm_token     TEXT,
  is_active     BOOLEAN       DEFAULT true,
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ─── User Locations (hot table) ───────────────────────────────────────────────

CREATE TABLE user_locations (
  user_id    UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  location   GEOGRAPHY(POINT, 4326) NOT NULL,
  accuracy_m NUMERIC(8,2),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_locations_geo ON user_locations USING GIST(location);

-- ─── Gear Items ───────────────────────────────────────────────────────────────

CREATE TABLE gear_items (
  id          UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT              NOT NULL,
  category    gear_category     NOT NULL,
  description TEXT,
  brand       TEXT,
  model       TEXT,
  photo_urls  TEXT[]            DEFAULT '{}',
  can_rent    BOOLEAN           DEFAULT true,
  can_lend    BOOLEAN           DEFAULT true,
  can_sell    BOOLEAN           DEFAULT false,
  rent_price  NUMERIC(10,2),
  sell_price  NUMERIC(10,2),
  status      availability_status DEFAULT 'available',
  condition   TEXT              CHECK (condition IN ('mint','good','fair','worn')),
  tags        TEXT[]            DEFAULT '{}',
  created_at  TIMESTAMPTZ       DEFAULT NOW(),
  updated_at  TIMESTAMPTZ       DEFAULT NOW()
);

CREATE INDEX idx_gear_items_owner    ON gear_items(owner_id);
CREATE INDEX idx_gear_items_category ON gear_items(category);
CREATE INDEX idx_gear_items_status   ON gear_items(status);
CREATE INDEX idx_gear_items_tags     ON gear_items USING GIN(tags);

-- ─── Gear Requests ────────────────────────────────────────────────────────────

CREATE TABLE gear_requests (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id     UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raw_text         TEXT,
  equipment        TEXT           NOT NULL,
  category         gear_category,
  quantity         INTEGER        DEFAULT 1,
  urgency          urgency_level  NOT NULL DEFAULT 'normal',
  action           request_action NOT NULL DEFAULT 'lend',
  status           request_status DEFAULT 'open',
  location         GEOGRAPHY(POINT, 4326) NOT NULL,
  search_radius_km NUMERIC(5,2)   DEFAULT 5,
  expires_at       TIMESTAMPTZ    NOT NULL,
  fulfilled_by_id  UUID           REFERENCES users(id),
  matched_gear_id  UUID           REFERENCES gear_items(id),
  ai_confidence    NUMERIC(4,3),
  notes            TEXT,
  created_at       TIMESTAMPTZ    DEFAULT NOW(),
  updated_at       TIMESTAMPTZ    DEFAULT NOW()
);

CREATE INDEX idx_gear_requests_geo     ON gear_requests USING GIST(location);
CREATE INDEX idx_gear_requests_status  ON gear_requests(status);
CREATE INDEX idx_gear_requests_urgency ON gear_requests(urgency);
CREATE INDEX idx_gear_requests_expires ON gear_requests(expires_at);
CREATE INDEX idx_gear_requests_requester ON gear_requests(requester_id);

-- ─── Transactions ─────────────────────────────────────────────────────────────

CREATE TABLE transactions (
  id            UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    UUID               REFERENCES gear_requests(id),
  gear_item_id  UUID               NOT NULL REFERENCES gear_items(id),
  lender_id     UUID               NOT NULL REFERENCES users(id),
  borrower_id   UUID               NOT NULL REFERENCES users(id),
  type          transaction_type   NOT NULL,
  status        transaction_status DEFAULT 'pending',
  agreed_price  NUMERIC(10,2),
  started_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ        DEFAULT NOW(),
  updated_at    TIMESTAMPTZ        DEFAULT NOW()
);

CREATE INDEX idx_transactions_lender   ON transactions(lender_id);
CREATE INDEX idx_transactions_borrower ON transactions(borrower_id);
CREATE INDEX idx_transactions_request  ON transactions(request_id);

-- ─── Messages ─────────────────────────────────────────────────────────────────

CREATE TABLE messages (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID        REFERENCES transactions(id),
  request_id     UUID        REFERENCES gear_requests(id),
  sender_id      UUID        NOT NULL REFERENCES users(id),
  recipient_id   UUID        NOT NULL REFERENCES users(id),
  body           TEXT        NOT NULL,
  is_read        BOOLEAN     DEFAULT false,
  sent_at        TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT messages_context_check CHECK (
    transaction_id IS NOT NULL OR request_id IS NOT NULL
  )
);

CREATE INDEX idx_messages_transaction ON messages(transaction_id);
CREATE INDEX idx_messages_request     ON messages(request_id);
CREATE INDEX idx_messages_recipient   ON messages(recipient_id, is_read);

-- ─── Reviews ─────────────────────────────────────────────────────────────────

CREATE TABLE reviews (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID        NOT NULL REFERENCES transactions(id),
  reviewer_id    UUID        NOT NULL REFERENCES users(id),
  reviewed_id    UUID        NOT NULL REFERENCES users(id),
  rating         SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(transaction_id, reviewer_id)
);

CREATE INDEX idx_reviews_reviewed ON reviews(reviewed_id);

-- ─── Notifications ────────────────────────────────────────────────────────────

CREATE TABLE notifications (
  id            UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          notification_type NOT NULL,
  title         TEXT              NOT NULL,
  body          TEXT,
  data          JSONB,
  is_read       BOOLEAN           DEFAULT false,
  sent_via_push BOOLEAN           DEFAULT false,
  created_at    TIMESTAMPTZ       DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at          BEFORE UPDATE ON users          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER gear_items_updated_at     BEFORE UPDATE ON gear_items     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER gear_requests_updated_at  BEFORE UPDATE ON gear_requests  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER transactions_updated_at   BEFORE UPDATE ON transactions   FOR EACH ROW EXECUTE FUNCTION set_updated_at();

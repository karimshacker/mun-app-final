-- MIANU-SM IV — initial schema
-- D1 (SQLite). All timestamps are ISO-8601 UTC strings.

-- ---------------------------------------------------------------- users
CREATE TABLE users (
  id              TEXT PRIMARY KEY,          -- cuid/uuid
  name            TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('HEAD', 'DEPUTY', 'ORGANIZER', 'IT_ADMIN')),
  committee_id    TEXT REFERENCES committees(id) ON DELETE SET NULL,
  phone           TEXT,
  pin_hash        TEXT NOT NULL,             -- SHA-256(pin || pin_salt)
  pin_salt        TEXT NOT NULL,
  push_subscription TEXT,                     -- Web Push subscription JSON
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(phone)
);

CREATE INDEX idx_users_role       ON users(role);
CREATE INDEX idx_users_committee  ON users(committee_id);

-- --------------------------------------------------------- participants
-- badge_uid is nullable until an IT admin links a pre-printed badge.
-- alt_code is the typed fallback for a dead/failed NFC chip.
CREATE TABLE participants (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  committee_id    TEXT REFERENCES committees(id) ON DELETE SET NULL,
  badge_uid       TEXT UNIQUE,                -- set at badge-linking time
  alt_code        TEXT NOT NULL UNIQUE,       -- printed on the badge, typed fallback
  balance_cents   INTEGER NOT NULL DEFAULT 0, -- meal balance
  meal_plan       TEXT NOT NULL DEFAULT 'FULL' CHECK (meal_plan IN ('FULL', 'BREAKFAST_ONLY', 'LUNCH_ONLY', 'NONE')),
  status          TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'BLOCKED', 'LEFT')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_participants_badge    ON participants(badge_uid);
CREATE INDEX idx_participants_alt_code ON participants(alt_code);
CREATE INDEX idx_participants_committee ON participants(committee_id);

-- ------------------------------------------------------------ committees
CREATE TABLE committees (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  hall_name       TEXT NOT NULL,
  hall_tag_uid    TEXT UNIQUE,                -- the mounted NFC tag at the hall door
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ----------------------------------------------------------- scan_events
-- Append-only audit log of every scan and typed code entry.
CREATE TABLE scan_events (
  id              TEXT PRIMARY KEY,
  participant_id  TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  station_type    TEXT NOT NULL CHECK (station_type IN ('CONFERENCE_IN','CONFERENCE_OUT','HALL_IN','HALL_OUT','MEAL')),
  committee_id    TEXT REFERENCES committees(id) ON DELETE SET NULL,
  scanned_by      TEXT NOT NULL REFERENCES users(id),
  entry_method    TEXT NOT NULL CHECK (entry_method IN ('NFC', 'ALT_CODE')),
  client_scan_id  TEXT NOT NULL,              -- idempotency key from the device
  at              TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(client_scan_id)                      -- a retry of the same scan writes no duplicate
);

CREATE INDEX idx_scans_participant ON scan_events(participant_id, at);
CREATE INDEX idx_scans_station     ON scan_events(station_type, at);
CREATE INDEX idx_scans_committee   ON scan_events(committee_id);

-- ------------------------------------------------------------- presence
-- Derived "where is this participant right now" state.
CREATE TABLE participant_presence (
  participant_id  TEXT PRIMARY KEY REFERENCES participants(id) ON DELETE CASCADE,
  in_conference   INTEGER NOT NULL DEFAULT 0,
  hall_id         TEXT REFERENCES committees(id) ON DELETE SET NULL,
  in_hall_since   TEXT,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ----------------------------------------------------------- meal_ledger
-- Append-only. balance_cents on participants is the derived current value.
CREATE TABLE meal_ledger (
  id              TEXT PRIMARY KEY,
  participant_id  TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  meal_type       TEXT NOT NULL CHECK (meal_type IN ('BREAKFAST', 'LUNCH')),
  amount_cents    INTEGER NOT NULL,           -- negative = debit, positive = top-up
  reason          TEXT NOT NULL DEFAULT 'MEAL' CHECK (reason IN ('MEAL', 'TOPUP', 'COMP', 'REFUND')),
  station_user_id TEXT REFERENCES users(id),  -- organizer who served/topped up
  scan_event_id   TEXT REFERENCES scan_events(id) ON DELETE SET NULL,
  at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_meal_ledger_participant ON meal_ledger(participant_id, at);
CREATE INDEX idx_meal_ledger_meal        ON meal_ledger(meal_type, at);

-- ------------------------------------------------------- meal_serve_log
-- Idempotency guard against double-serving inside a meal window.
CREATE TABLE meal_serve_log (
  participant_id  TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  meal_type       TEXT NOT NULL CHECK (meal_type IN ('BREAKFAST', 'LUNCH')),
  served_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (participant_id, meal_type, served_at)
);

-- --------------------------------------------------------- notifications
CREATE TABLE notifications (
  id              TEXT PRIMARY KEY,
  sent_by         TEXT NOT NULL REFERENCES users(id),
  audience        TEXT NOT NULL,             -- 'ALL' | committee id | hall id
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_notifications_at ON notifications(at);

CREATE TABLE notification_receipts (
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivered_at    TEXT,
  read_at         TEXT,
  PRIMARY KEY (notification_id, user_id)
);

-- ---------------------------------------------------------------- chats
CREATE TABLE chat_channels (
  id              TEXT PRIMARY KEY,
  kind            TEXT NOT NULL CHECK (kind IN ('HEAD_DEPUTY')),  -- extensible
  committee_id    TEXT REFERENCES committees(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE chat_channel_members (
  channel_id      TEXT NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE chat_messages (
  id              TEXT PRIMARY KEY,
  channel_id      TEXT NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  sender_id       TEXT NOT NULL REFERENCES users(id),
  body            TEXT NOT NULL,
  at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_chat_messages_channel ON chat_messages(channel_id, at);

-- ------------------------------------------------------------ locations
-- Organizer location stream. TTL-purged after the conference.
CREATE TABLE locations (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lat             REAL NOT NULL,
  lng             REAL NOT NULL,
  source          TEXT NOT NULL CHECK (source IN ('GPS', 'HALL_SCAN')),
  at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_locations_user ON locations(user_id, at);

-- --------------------------------------------------------- water_orders
CREATE TABLE water_orders (
  ref             TEXT PRIMARY KEY,          -- public reference, e.g. WO-7F3K
  committee_id    TEXT NOT NULL REFERENCES committees(id),
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  note            TEXT,
  status          TEXT NOT NULL DEFAULT 'RECEIVED'
                  CHECK (status IN ('RECEIVED', 'ACKNOWLEDGED', 'DELIVERED', 'CANCELLED')),
  requester_system TEXT NOT NULL,            -- name of the calling system
  api_key_id      TEXT NOT NULL REFERENCES api_keys(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_water_orders_status ON water_orders(status, created_at);
CREATE INDEX idx_water_orders_committee ON water_orders(committee_id);

-- ------------------------------------------------------------ api_keys
-- Issued by IT_ADMIN for the public endpoint. Keys are stored hashed (SHA-256).
CREATE TABLE api_keys (
  id              TEXT PRIMARY KEY,
  key_prefix      TEXT NOT NULL,             -- non-secret, for identification in UIs
  key_hash        TEXT NOT NULL UNIQUE,
  scopes          TEXT NOT NULL DEFAULT 'water.order',
  rate_limit_per_hour INTEGER NOT NULL DEFAULT 60,
  revoked_at      TEXT,
  created_by      TEXT NOT NULL REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------- sessions
CREATE TABLE sessions (
  id              TEXT PRIMARY KEY,          -- refresh token id
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at      TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sessions_user ON sessions(user_id);

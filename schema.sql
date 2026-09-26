-- UZ auth database schema (Cloudflare D1 / SQLite)
-- Apply with: wrangler d1 execute uz_db --file=./schema.sql

CREATE TABLE IF NOT EXISTS users (
  email         TEXT PRIMARY KEY,
  display_name  TEXT,
  password_hash TEXT,          -- "salt_hex:hash_hex", PBKDF2-SHA256, null until profile is set up
  discord_id    TEXT,          -- set if this account signed in with Discord
  avatar_url    TEXT,          -- Discord avatar CDN URL, null for email/code accounts
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS verification_codes (
  email      TEXT PRIMARY KEY,
  code       TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,   -- wrong-guess counter, blocks brute forcing a code
  sent_at    INTEGER NOT NULL              -- used to rate-limit resends
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_email ON sessions(email);

-- If you already ran the old version of this schema (before Discord login
-- was added), run these two lines once against your existing database
-- instead of the CREATE TABLE above:
--   ALTER TABLE users ADD COLUMN discord_id TEXT;
--   ALTER TABLE users ADD COLUMN avatar_url TEXT;

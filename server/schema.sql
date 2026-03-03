CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS ratings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wine_name TEXT NOT NULL,
  vintage TEXT,
  style TEXT,
  price TEXT,
  my_score REAL NOT NULL,
  we_score INTEGER,
  notes TEXT,
  source_url TEXT,
  favorite BOOLEAN DEFAULT false,
  tags TEXT[],
  is_public BOOLEAN DEFAULT false,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ratings_public
  ON ratings(is_public, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ratings_user
  ON ratings(user_id, created_at DESC);
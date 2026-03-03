CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ratings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  wine_name TEXT NOT NULL,
  vintage TEXT,
  style TEXT,
  price TEXT,
  my_score REAL NOT NULL,
  we_score INTEGER,
  notes TEXT,
  source_url TEXT,
  favorite INTEGER DEFAULT 0,
  tags TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
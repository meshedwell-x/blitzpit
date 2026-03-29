-- BLITZPIT P2E Arena -- D1 Database Schema
-- Apply: wrangler d1 execute blitzpit-db --file=schema.sql

CREATE TABLE IF NOT EXISTS tournaments (
  id TEXT PRIMARY KEY,
  tier TEXT NOT NULL,
  entry_fee REAL NOT NULL,
  prize_pool REAL DEFAULT 0,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS tournament_entries (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  best_score INTEGER DEFAULT 0,
  submitted_at INTEGER DEFAULT 0,
  prize_won REAL DEFAULT 0,
  paid INTEGER DEFAULT 0,
  stripe_session TEXT,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
);

CREATE TABLE IF NOT EXISTS season_scores (
  user_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Player',
  best_wave INTEGER DEFAULT 0,
  total_kills INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  updated_at INTEGER,
  PRIMARY KEY (user_id, season_id)
);

CREATE TABLE IF NOT EXISTS user_tiers (
  user_id TEXT PRIMARY KEY,
  total_spent REAL DEFAULT 0,
  tier TEXT DEFAULT 'free',
  country TEXT
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status, end_time);
CREATE INDEX IF NOT EXISTS idx_entries_tournament ON tournament_entries(tournament_id, user_id);
CREATE INDEX IF NOT EXISTS idx_entries_paid ON tournament_entries(tournament_id, paid);
CREATE INDEX IF NOT EXISTS idx_season_scores_season ON season_scores(season_id, score DESC);

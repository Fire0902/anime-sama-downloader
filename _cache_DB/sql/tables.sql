PRAGMA foreign_keys = ON;

-- =========================
-- Anime table
-- =========================
CREATE TABLE IF NOT EXISTS anime (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL
);

-- =========================
-- Seasons table
-- =========================
CREATE TABLE IF NOT EXISTS season (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anime_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  season_index INTEGER NOT NULL,

  FOREIGN KEY (anime_id)
    REFERENCES anime(id)
    ON DELETE CASCADE,

  UNIQUE (anime_id, season_index)
);

-- =========================
-- Episodes table
-- =========================
CREATE TABLE IF NOT EXISTS episode (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  episode_index INTEGER NOT NULL,

  FOREIGN KEY (season_id)
    REFERENCES season(id)
    ON DELETE CASCADE,

  UNIQUE (season_id, episode_index)
);

-- =========================
-- Players table (lecteurs)
-- =========================
CREATE TABLE IF NOT EXISTS player (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

-- =========================
-- Episode URLs table
-- =========================
CREATE TABLE IF NOT EXISTS episode_url (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  url TEXT NOT NULL,

  FOREIGN KEY (episode_id)
    REFERENCES episode(id)
    ON DELETE CASCADE,

  FOREIGN KEY (player_id)
    REFERENCES player(id)
    ON DELETE CASCADE,

  UNIQUE (episode_id, player_id)
);

-- =========================
-- Default insertion
-- =========================
INSERT OR IGNORE INTO player (name) VALUES
('Vidmoly'),
('Sibnet'),
('Other');

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
  url TEXT NOT NULL,

  FOREIGN KEY (season_id)
    REFERENCES season(id)
    ON DELETE CASCADE,

  UNIQUE (season_id, episode_index)
);

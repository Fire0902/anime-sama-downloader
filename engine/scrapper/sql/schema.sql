PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS anime (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    link TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'anime-sama'
);

CREATE TABLE IF NOT EXISTS season (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    anime_id INTEGER NOT NULL,
    season_index INTEGER NOT NULL,
    link TEXT NOT NULL,

    FOREIGN KEY (anime_id)
        REFERENCES anime(id)
        ON DELETE CASCADE,

    UNIQUE(anime_id, season_index)
);

CREATE INDEX IF NOT EXISTS idx_season_anime ON season(anime_id);

CREATE TABLE IF NOT EXISTS episode (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_index INTEGER NOT NULL,
    season_id INTEGER NOT NULL,
    name TEXT,

    FOREIGN KEY (season_id)
        REFERENCES season(id)
        ON DELETE CASCADE,

    UNIQUE(season_id, episode_index)
);

CREATE INDEX IF NOT EXISTS idx_episode_season ON episode(season_id);

CREATE TABLE IF NOT EXISTS reader (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS episode_reader (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    reader_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    FOREIGN KEY (episode_id)
        REFERENCES episode(id)
        ON DELETE CASCADE,
    FOREIGN KEY (reader_id)
        REFERENCES reader(id)
        ON DELETE CASCADE,
    UNIQUE(episode_id, reader_id)
);

CREATE INDEX IF NOT EXISTS idx_episode_reader_episode ON episode_reader(episode_id);
CREATE INDEX IF NOT EXISTS idx_episode_reader_reader ON episode_reader(reader_id);

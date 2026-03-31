CREATE TABLE IF NOT EXISTS leaderboard (
    username  TEXT PRIMARY KEY,
    score     INTEGER NOT NULL DEFAULT 0,
    guessed   JSONB   NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS matches (
    id               TEXT PRIMARY KEY,
    title            TEXT,
    type             TEXT,
    stream_url       TEXT,
    start_time_unix  BIGINT,
    timeline         JSONB
);

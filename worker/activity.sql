
CREATE TABLE IF NOT EXISTS steam_snapshots (
  account TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  observed_at INTEGER NOT NULL,
  totals TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS steam_activity (
  account TEXT NOT NULL,
  appid INTEGER NOT NULL,
  observed_from INTEGER NOT NULL,
  observed_to INTEGER NOT NULL,
  minutes INTEGER NOT NULL CHECK (minutes > 0),
  PRIMARY KEY (account, appid, observed_to)
);

CREATE INDEX IF NOT EXISTS steam_activity_recent ON steam_activity (account, observed_to DESC);

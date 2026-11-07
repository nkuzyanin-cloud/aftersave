
CREATE TABLE IF NOT EXISTS saved_devices (
  account TEXT NOT NULL,
  digest TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (account, digest)
);
CREATE INDEX IF NOT EXISTS saved_devices_expiry ON saved_devices (expires_at);
CREATE TABLE IF NOT EXISTS personal_library (
  account TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  snapshot TEXT NOT NULL
);

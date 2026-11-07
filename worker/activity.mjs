
const HISTORY_MS = 90 * 24 * 60 * 60 * 1000;

export async function recordSnapshot(database, account, timestamp, library) {
  const games = library?.games ?? [];
  if (!Number.isSafeInteger(library?.game_count) || library.game_count !== games.length ||
      !Array.isArray(games) || games.length > 10000) throw new Error('Incomplete Steam library');
  const totals = Object.create(null);
  for (const game of games) {
    if (!Number.isInteger(game.appid) || game.appid < 1 || game.appid > 4294967295 ||
        !Number.isSafeInteger(game.playtime_forever) || game.playtime_forever < 0 ||
        Object.hasOwn(totals, game.appid)) throw new Error('Invalid Steam counters');
    totals[game.appid] = game.playtime_forever;
  }
  const serialized = JSON.stringify(totals);
  await database.batch([
    database.prepare(`INSERT INTO steam_activity(account, appid, observed_from, observed_to, minutes)
      SELECT previous.account, CAST(next.key AS INTEGER), previous.observed_at, ?1, next.value - prior.value
      FROM steam_snapshots previous, json_each(previous.totals) prior
      JOIN json_each(?2) next ON next.key = prior.key
      WHERE previous.account = ?3 AND previous.observed_at < ?1 AND next.value > prior.value
      ON CONFLICT(account, appid, observed_to) DO NOTHING`).bind(timestamp, serialized, account),
    database.prepare(`INSERT INTO steam_snapshots(account, started_at, observed_at, totals) VALUES(?1, ?2, ?2, ?3)
      ON CONFLICT(account) DO UPDATE SET observed_at = excluded.observed_at, totals = (
        SELECT json_group_object(next.key, MAX(next.value, COALESCE(json_extract(steam_snapshots.totals, '$.' || next.key), 0)))
        FROM json_each(excluded.totals) next
      )
      WHERE excluded.observed_at > steam_snapshots.observed_at`).bind(account, timestamp, serialized),
    database.prepare('DELETE FROM steam_activity WHERE account = ?1 AND observed_to < ?2').bind(account, timestamp - HISTORY_MS)
  ]);
}

export async function readActivity(database, account) {
  const [baseline, records] = await database.batch([
    database.prepare('SELECT started_at AS startedAt, observed_at AS lastObserved FROM steam_snapshots WHERE account = ?1').bind(account),
    database.prepare(`SELECT appid, observed_from AS observedFrom, observed_to AS observedTo, minutes
      FROM steam_activity WHERE account = ?1 AND observed_to >= ?2
      ORDER BY observed_to DESC, appid ASC LIMIT 3000`).bind(account, Date.now() - HISTORY_MS)
  ]);
  const status = baseline.results[0];
  return { startedAt: status?.startedAt ?? 0, lastObserved: status?.lastObserved ?? 0, windows: records.results };
}

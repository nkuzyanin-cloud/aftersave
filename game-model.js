// Pure game statistics and shared status logic.
export const gameHours = game => Math.max(game.hours, (game.steam?.minutes ?? 0) / 60);

export function trophyFor(record) {
  if (!record?.total || !record.unlocked) return '';
  if (record.unlocked === record.total) return 'platinum';
  return record.unlocked * 5 <= record.total * 3 ? 'sapphire' : 'silver';
}

export function achievementPercent(record) {
  if (!record.unlocked) return 0;
  const rate = record.unlocked / record.total * 100;
  return rate === 100 ? 100 : Math.min(99.9, Math.max(0.1, Math.round(rate * 10) / 10));
}

export function displayName(game, full = false) {
  return game.steam?.appid === 292030 ? (full ? 'Ведьмак 3: Дикая Охота' : 'Ведьмак 3') : game.title;
}

export function collectionRate(entry) {
  return entry.total ? Math.round(entry.unlocked / entry.total * 100) : 0;
}

export function gameCompletion(game, record) {
  return trophyFor(record) === 'platinum' ? 'perfect' : game.status === 'completed' ? 'beaten' : '';
}

export function gameProgressState(game, record) {
  return gameCompletion(game, record) || (gameHours(game) > 0 || (record?.unlocked ?? 0) > 0 ? 'active' : 'unstarted');
}

export function countGameStatuses(games, summaryFor) {
  return games.reduce((counts, game) => {
    counts[gameProgressState(game, summaryFor(game))]++;
    return counts;
  }, {perfect:0,beaten:0,active:0,unstarted:0});
}

import { gameHours, displayName } from './game-model.js';

export function collectionTotals(group, summaryFor) {
  return group.reduce((totals,game) => {
    const record = summaryFor(game);
    return { minutes: totals.minutes + (game.steam?.minutes ?? Math.round(game.hours*60)),
      unlocked: totals.unlocked + (record?.unlocked ?? 0), total: totals.total + (record?.total ?? 0) };
  }, { minutes:0, unlocked:0, total:0 });
}

export function collectionShowcaseGames(grouped, limit) {
  return [...grouped].sort((a,b) => gameHours(b) - gameHours(a) ||
    displayName(a).localeCompare(displayName(b),'ru')).slice(0,limit);
}

export function collectionEntries(library, collections, collectionSort, summaryFor) {
  const list = collections.map(item => {
    const grouped = library.filter(game => game.collectionIds.includes(item.id));
    const totals = collectionTotals(grouped,summaryFor);
    return {item, grouped, ...totals, games:grouped.length, time:totals.minutes, achievements:totals.unlocked};
  });
  if (collectionSort === 'achievements') {
    const maxUnlocked = Math.max(1,...list.map(entry => entry.unlocked));
    const maxMinutes = Math.max(1,...list.map(entry => entry.minutes));
    const score = entry => 70 * (entry.total ? entry.unlocked / entry.total : 0) +
      15 * entry.unlocked / maxUnlocked + 15 * entry.minutes / maxMinutes;
    return list.sort((a,b) => score(b) - score(a) || a.item.name.localeCompare(b.item.name,'ru'));
  }
  return list.sort((a,b) => b[collectionSort] - a[collectionSort] || a.item.name.localeCompare(b.item.name,'ru'));
}

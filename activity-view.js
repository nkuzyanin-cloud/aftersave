// Steam's rolling counters are sampled by the Worker. Only observations that
// fit within a calendar day contribute to daily activity and streaks.
const DAY = 86400000;
export const dayNumber = value => {
  const date = new Date(value);
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY);
};

export const calendarDate = day => new Date(day * DAY);
const campaign = {
  1245620: ['ACH01', 'ACH02', 'ACH03'],
  292030: ['PASSED_THE_TRIAL'],
};

export function completionItems(record) {
  const ids = campaign[record?.appid];
  return ids ? record.items.filter(item => ids.includes(item.id)) : [];
}

export function steamStatus(record) {
  if (record?.total && record.unlocked === record.total) return 'perfect';
  return completionItems(record).some(item => item.unlocked) ? 'beaten' : '';
}

export function aggregateSessions(windows, gameByAppId) {
  const events = new Map();
  for (const { appid, minutes, observedFrom, observedTo } of windows ?? []) {
    const game = gameByAppId.get(appid);
    if (!game) continue;
    const from = dayNumber(observedFrom), to = dayNumber(observedTo);
    const key = from === to ? [appid, to].join(':') : [appid, observedFrom, observedTo].join(':');
    const previous = events.get(key);
    events.set(key, {
      game, minutes: minutes + (previous?.minutes ?? 0),
      observedTo: Math.max(observedTo, previous?.observedTo ?? 0),
      from, to,
    });
  }
  return [...events.values()].sort((a,b) => b.observedTo - a.observedTo);
}

export function addDaily(days, day, amount) {
  days.set(day, (days.get(day) ?? 0) + amount);
}

export function streaks(days, today) {
  const active = [...days.keys()].filter(day => day >= today - 364 && day <= today).sort((a,b) => a - b);
  let best = 0, run = 0, previous = -Infinity;
  for (const day of active) {
    run = day === previous + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return { best, current: previous >= today - 1 ? run : 0 };
}

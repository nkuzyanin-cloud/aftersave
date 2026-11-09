// Local dates follow the browser's calendar. Worker counters are observations.
const DAY = 86400000;
export const dayNumber = value => {
  const date = new Date(value);
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY);
};

export const calendarDate = day => new Date(day * DAY);
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
export function parseSteamProcessLog(text) {
  const open = new Map();
  const sessions = [];
  for (const line of text.split(/\r?\n/)) {
    const match = /^\[(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d)\] (.*)$/.exec(line);
    if (!match) continue;
    const [,year,month,day,hour,minute,second,event] = match;
    if (event.startsWith('Client version:')) open.clear();
    const start = /^AppID (\d+) adding PID \d+ as a tracked process\b/.exec(event);
    const end = /^Remove (\d+) from running list\b/.exec(event);
    if (!start && !end) continue;
    const appid = Number((start ?? end)[1]);
    const time = new Date(+year, +month - 1, +day, +hour, +minute, +second).getTime();
    if (!Number.isFinite(time) || !Number.isInteger(appid) || appid < 1 || appid > 4294967295) continue;
    if (start) {
      if (!open.has(appid)) open.set(appid,time);
    } else {
      const startedAt = open.get(appid);
      open.delete(appid);
      if (startedAt && time > startedAt) sessions.push({ appid, startedAt, endedAt:time });
    }
  }
  return sessions;
}

export function sessionsWithLocalHistory(windows, localSessions, gameByAppId) {
  const days = new Map();
  const exactByGame = new Map();
  const add = (game, day, minutes, observedTo, source) => {
    const key = game.steam.appid + ':' + day;
    const row = days.get(key) ?? { game, day, minutes:0, observedTo:0, local:false, estimated:false, uncertain:false };
    row.minutes += minutes;
    row.observedTo = Math.max(row.observedTo,observedTo);
    row[source] = true;
    days.set(key,row);
  };
  for (const {appid, startedAt, endedAt} of localSessions ?? []) {
    const game = gameByAppId.get(appid);
    if (!game) continue;
    const intervals = exactByGame.get(appid) ?? [];
    intervals.push({startedAt,endedAt});
    exactByGame.set(appid,intervals);
    let cursor = Math.max(startedAt,Date.UTC(2003,0,1));
    const end = Math.min(endedAt,Date.now());
    while (cursor < end) {
      const midnight = new Date(cursor);
      midnight.setHours(24,0,0,0);
      const stop = Math.min(end,midnight.getTime());
      add(game,dayNumber(cursor),(stop-cursor)/60000,stop,'local');
      cursor = stop;
    }
  }
  for (const {appid, minutes, observedFrom, observedTo} of windows ?? []) {
    const game = gameByAppId.get(appid);
    if (!game || exactByGame.get(appid)?.some(session => session.startedAt < observedTo && session.endedAt > observedFrom)) continue;
    const day = dayNumber(observedTo);
    add(game,day,minutes,observedTo,day === dayNumber(observedFrom) ? 'estimated' : 'uncertain');
  }
  return [...days.values()].sort((a,b) => b.day-a.day || b.observedTo-a.observedTo);
}

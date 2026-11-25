// Local dates follow the browser's calendar. Worker counters are observations.
const DAY = 86400000;
export const dayNumber = value => {
  const date = new Date(value);
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY);
};

export const calendarDate = day => new Date(day * DAY);
export const ACTIVITY_DAY_LIMIT = 20000;
export function addDaily(days, day, amount) {
  days.set(day, (days.get(day) ?? 0) + amount);
}

export function streaks(days, today, start = today - 364) {
  const active = [...days.keys()].filter(day => day >= start && day <= today).sort((a,b) => a - b);
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
    if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt <= startedAt) continue;
    const start = Math.max(startedAt,Date.UTC(2003,0,1));
    const end = Math.min(endedAt,Date.now());
    if (end <= start) continue;
    const intervals = exactByGame.get(appid) ?? [];
    intervals.push({startedAt:start,endedAt:end});
    exactByGame.set(appid,intervals);
  }
  // Merge overlapping imported intervals before counting exact minutes.
  for (const [appid, intervals] of exactByGame) {
    const game = gameByAppId.get(appid);
    const merged = [];
    for (const interval of intervals.sort((a,b) => a.startedAt - b.startedAt)) {
      const previous = merged[merged.length-1];
      if (previous && interval.startedAt <= previous.endedAt) {
        previous.endedAt = Math.max(previous.endedAt,interval.endedAt);
      } else merged.push({...interval});
    }
    exactByGame.set(appid,merged);
    for (const {startedAt,endedAt} of merged) {
      let cursor = startedAt;
      while (cursor < endedAt) {
        const midnight = new Date(cursor);
        midnight.setHours(24,0,0,0);
        const stop = Math.min(endedAt,midnight.getTime());
        add(game,dayNumber(cursor),(stop-cursor)/60000,stop,'local');
        cursor = stop;
      }
    }
  }
  for (const {appid, minutes, observedFrom, observedTo} of windows ?? []) {
    const game = gameByAppId.get(appid);
    if (!game || !Number.isFinite(minutes) || minutes <= 0 || !Number.isFinite(observedFrom) ||
        !Number.isFinite(observedTo) || observedTo <= observedFrom) continue;
    // Steam provides a cumulative delta, not exact start/end timestamps. Deduct only
    // known overlapping exact minutes instead of dropping the whole observation.
    const exact = (exactByGame.get(appid) ?? []).reduce((sum, session) =>
      sum + Math.max(0, Math.min(session.endedAt,observedTo) - Math.max(session.startedAt,observedFrom))/60000,0);
    const remaining = Math.max(0,minutes-exact);
    if (remaining <= 0) continue;
    const day = dayNumber(observedTo);
    add(game,day,remaining,observedTo,day === dayNumber(observedFrom) ? 'estimated' : 'uncertain');
  }
  return [...days.values()].sort((a,b) => b.day-a.day || b.observedTo-a.observedTo);
}

// Retain daily Steam totals locally after the Worker drops its rolling observations.
export function archiveActivityDays(saved, windows, today) {
  const archive = new Map((saved ?? []).map(row => [row.appid + ':' + row.day,row]));
  const totals = new Map();
  for (const {appid,minutes,observedTo} of windows ?? []) {
    const day = dayNumber(observedTo);
    if (day >= today) continue;
    const key = appid + ':' + day;
    const row = totals.get(key) ?? {appid,day,minutes:0};
    row.minutes += minutes;
    totals.set(key,row);
  }
  for (const [key,row] of totals) {
    if (row.minutes > (archive.get(key)?.minutes ?? 0)) archive.set(key,row);
  }
  return [...archive.values()].sort((a,b) => b.day-a.day || a.appid-b.appid).slice(0,ACTIVITY_DAY_LIMIT);
}

export function withArchivedActivity(events, archived, gameByAppId) {
  const days = new Map(events.map(event => [event.game.steam.appid + ':' + event.day,event]));
  for (const {appid,day,minutes} of archived ?? []) {
    const game = gameByAppId.get(appid);
    if (!game) continue;
    const key = appid + ':' + day;
    const current = days.get(key);
    if (!current || (!current.local && current.minutes < minutes)) days.set(key,{game,day,minutes,estimated:true});
  }
  return [...days.values()];
}

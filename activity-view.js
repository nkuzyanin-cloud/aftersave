// Steam's rolling counters are sampled by the Worker. Only observations that
// fit within a calendar day contribute to daily activity and streaks.
const DAY = 86400000;
export const dayNumber = value => {
  const date = new Date(value);
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY);
};

export const calendarDate = day => new Date(day * DAY);
const campaign = {
  620: ['ACH.SHOOT_THE_MOON'], // Portal 2
  374320: ['ACH01', 'ACH02', 'ACH03'], // Dark Souls III
  601150: ['Achievements_00', 'Achievements_01'], // Devil May Cry 5
  814380: ['ACH09', 'ACH10', 'ACH11', 'ACH12'], // Sekiro
  870780: ['WAKE_ACHIEVEMENT'], // Control
  883710: ['NEW_ACHIEVEMENT_1_7', 'NEW_ACHIEVEMENT_1_8', 'NEW_ACHIEVEMENT_1_9'], // Resident Evil 2
  952060: ['NEW_ACHIEVEMENT_1_19', 'NEW_ACHIEVEMENT_1_26'], // Resident Evil 3
  1086940: ['BG3_Quest04'], // Baldur's Gate 3
  1091500: ['TheWorld'], // Cyberpunk 2077
  1151640: ['NEW_ACHIEVEMENT_4_19', 'NEW_ACHIEVEMENT_4_24'], // Horizon Zero Dawn
  1174180: ['Achievement10'], // Red Dead Redemption 2
  1222140: ['46'], // Detroit: Become Human
  1245620: ['ACH01', 'ACH02', 'ACH03'],
  1252330: ['ach_3'], // Deathloop
  1259420: ['DG1_ACH_11'], // Days Gone
  1290000: ['TROPHY_30'], // PowerWash Simulator
  1378990: ['trophy.defeat_cortex_final'], // Crash Bandicoot 4
  1888930: ['284b17b75ee9e837'], // The Last of Us Part I
  2050650: ['12', '28'], // Resident Evil 4
  2215430: ['_autoGenTrophy_0012'], // Ghost of Tsushima
  292030: ['PASSED_THE_TRIAL'],
  2968420: ['TROPHY_2'], // PowerWash Simulator 2
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
  const byGame = new Map();
  const exact = [];
  for (const session of localSessions ?? []) {
    const game = gameByAppId.get(session.appid);
    if (!game) continue;
    const {startedAt, endedAt} = session;
    const group = byGame.get(session.appid) ?? [];
    group.push(session);
    byGame.set(session.appid,group);
    exact.push({game, startedAt, endedAt, observedTo:endedAt,
      from:dayNumber(startedAt), to:dayNumber(endedAt), minutes:Math.round((endedAt-startedAt)/60000)});
  }
  const estimated = (windows ?? []).filter(window => !byGame.get(window.appid)?.some(session =>
    session.startedAt < window.observedTo && session.endedAt > window.observedFrom));
  return [...exact,...aggregateSessions(estimated,gameByAppId)].sort((a,b) => b.observedTo-a.observedTo);
}

export function addSessionDays(days, session, earliest, latest) {
  if (!session.startedAt) {
    if (session.from === session.to && session.observedTo >= earliest && session.observedTo <= latest) {
      addDaily(days,session.to,session.minutes);
    }
    return;
  }
  let cursor = Math.max(session.startedAt, earliest);
  const end = Math.min(session.endedAt, latest);
  while (cursor < end) {
    const day = new Date(cursor);
    day.setHours(24,0,0,0);
    const stop = Math.min(day.getTime(),end);
    addDaily(days,dayNumber(cursor),(stop-cursor)/60000);
    cursor = stop;
  }
}

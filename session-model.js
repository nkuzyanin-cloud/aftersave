import { dayNumber, calendarDate } from './activity-view.js';
import { displayName } from './game-model.js';

const shortDay = new Intl.DateTimeFormat('ru', {day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'});

export function sessionDashboardData(context, sessionPeriod, today = dayNumber(Date.now())) {
  const valid = context.events.filter(event => event.minutes > 0 && Number.isFinite(event.minutes) &&
    Number.isInteger(event.day) && event.day <= today);
  const earliest = valid.reduce((first,event) => Math.min(first,event.day),today);
  const start = sessionPeriod === 'all' ? earliest : today - Number(sessionPeriod) + 1;
  const events = valid.filter(event => event.day >= start);
  const metrics = entries => {
    const minutes = entries.reduce((sum,event) => sum + event.minutes,0);
    const achievements = entries.reduce((sum,event) => sum +
      (context.unlocks.get(event.game.steam.appid + ':' + event.day)?.length ?? 0),0);
    return {minutes, count:entries.length, achievements};
  };
  const previousStart = start - Number(sessionPeriod);
  const previous = earliest <= previousStart
    ? metrics(valid.filter(event => event.day >= previousStart && event.day < start)) : null;
  const playedDays = new Set(valid.map(({day}) => day));
  const latestDay = playedDays.has(today) ? today : today - 1;
  let currentStreak = 0;
  while (playedDays.has(latestDay - currentStreak)) currentStreak++;
  return {today,start,events,metrics:{...metrics(events),currentStreak},previous,ranking:sessionRank(events),context};
}

export function sessionRank(events) {
  const byGame = new Map();
  for (const {game,minutes} of events) {
    const id = game.steam.appid;
    const entry = byGame.get(id) ?? {game,minutes:0,count:0};
    entry.minutes += minutes;
    entry.count++;
    byGame.set(id,entry);
  }
  return [...byGame.values()].sort((a,b) => b.minutes-a.minutes ||
    displayName(a.game).localeCompare(displayName(b.game),'ru'));
}

export function sessionChartPoints({start,today,events}, mode) {
  const monthName = new Intl.DateTimeFormat('ru-RU',{month:'short',timeZone:'UTC'});
  const fullMonth = new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'});
  const getKey = day => {
    const date = calendarDate(day);
    if (mode === 'weeks') return day - (date.getUTCDay()+6)%7;
    if (mode === 'years') return date.getUTCFullYear();
    if (mode === 'months') return date.getUTCFullYear()*12+date.getUTCMonth();
    return day;
  };
  const points = new Map();
  for (let key = getKey(start); key <= getKey(today); key += mode === 'weeks' ? 7 : 1) points.set(key,[]);
  for (const event of events) points.get(getKey(event.day)).push(event);
  return [...points].map(([key,entries]) => {
    const date = mode === 'months' ? new Date(Date.UTC(Math.floor(key/12),key%12,1)) : calendarDate(key);
    const label = mode === 'years' ? String(key) : mode === 'months'
      ? monthName.format(date).replace('.','') + ' ' + String(date.getUTCFullYear()).slice(-2)
      : shortDay.format(date).slice(0,5);
    const title = mode === 'years' ? label : mode === 'months' ? fullMonth.format(date) : mode === 'weeks'
      ? shortDay.format(calendarDate(Math.max(start,key))) + ' — ' + shortDay.format(calendarDate(Math.min(today,key+6)))
      : shortDay.format(date);
    return {label,title,minutes:entries.reduce((sum,event) => sum+event.minutes,0),games:sessionRank(entries)};
  });
}

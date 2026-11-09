
import {
  STORAGE_KEY, STATUSES, PLATFORMS, load, save, emptyState,
  createGame, exportJSON, importJSON, exportCSV, isEldenRing
} from './data.js';
import { icon } from './icons.js';
import { createCloudSync } from './cloud.js';
import { bossRegions, bossById } from './elden-ring.js';
import { bossArt } from './elden-ring-art.js';
import { mergeSteam, fetchLibrary, connect, disconnect, connected, steamCover, steamHeader, steamHero, fetchSteamArtwork,
  fetchAchievements, cachedAchievements, achievementRecords, achievementIconAlternatives } from './steam.js';
import { dayNumber, calendarDate, completionItems, steamStatus, aggregateSessions, addDaily, streaks } from './activity-view.js';

const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const toast = document.querySelector('#toast');
const labels = { library: 'Игры', achievements: 'Достижения', collections: 'Коллекции', sessions: 'Игровые сессии', stats: 'Статистика', settings: 'Настройки', game: 'Игра' };
const deskTabs = [['library','game'],['achievements','trophy'],['collections','layers'],['sessions','clock'],['stats','chart']];
const filter = { query: '', status: '' };
const cups = { platinum: 'Платина', silver: 'Серебро', sapphire: 'Сапфир' };
const number = new Intl.NumberFormat('ru', { maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', year: 'numeric' });

let state;
let storageError = '';
try { state = load(); } catch (error) { state = emptyState(); storageError = error.message; }
let shelfMode = 'all';
let achievementQuery = '';
let achievementSort = 'rare';
let revealHidden = false;
let toastTimer;
let route = getRoute();
let storagePending = false;
let syncingSteam = false;
let refreshingRecent = false;
let steamMessage = '';
let steamError = false;
let displayLimit = 24;
let achievementFilter = '';
let achievementLimit = 24;
let achievementView = 0;
let summaries = new Map();
let summaryAccount = null;
let feedLimit = 24;
let lockedFeed = false;
let scanningAchievements = false;
let stopAchievementScan = false;
let scanMessage = '';
let cloudMessage = '';
let cloudConflict = false;
let enableCloudAfterLogin = false;
let bossRegion = 0;
let bossArea = '';
const gameHours = game => Math.max(game.hours, (game.steam?.minutes ?? 0) / 60);
const steamDate = value => value ? dateFormat.format(new Date(value * 1000)) : '—';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const numeric = value => number.format(value);
const percent = value => Math.min(100, Math.max(0, Number(value) || 0));
const games = () => state.games;
const collections = () => state.collections;
const coverUrl = value => {
  if (/^\.?\/?assets\/covers\/[a-z0-9-]+\.jpg$/i.test(value ?? '')) return './' + value.replace(/^\.?\//, '');
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch { return ''; }
};

function getRoute() {
  const [original, id, tab, note] = location.hash.slice(1).split('/');
  const page = original === 'profile' ? 'settings' : original;
  return { page: Object.hasOwn(labels, page) ? page : 'library', id,
    tab: ['achievements', 'notes', 'sessions'].includes(tab) ? tab : 'overview',
    trophy: page === 'library' && id === 'cup' && Object.hasOwn(cups, tab) ? tab : '',
    ngPlus: tab === 'notes' && note === 'ng-plus' };
}

function go(page, id = '') {
  const target = page === 'library' ? '#library' : '#' + page + (id ? '/' + encodeURIComponent(id) : '');
  if (location.hash === target || (!location.hash && page === 'library')) return;
  location.hash = target;
}

function findByRoute(items) {
  return items.find(item => encodeURIComponent(item.id) === route.id);
}

function button(action, label, glyph, kind = 'secondary', extra = '') {
  return `<button type="button" class="btn btn-${kind}" data-action="${action}" ${extra}>${glyph ? icon(glyph, 17) : ''}<span>${label}</span></button>`;
}

function iconButton(action, label, glyph, extra = '') {
  return `<button type="button" class="icon-btn" data-action="${action}" aria-label="${label}" title="${label}" ${extra}>${icon(glyph, 18)}</button>`;
}

function notify(message, isError = false) {
  clearTimeout(toastTimer);
  toast.classList.toggle('toast-error', isError);
  toast.innerHTML = icon(isError ? 'shield' : 'check', 19) + `<span>${esc(message)}</span>`;
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, isError ? 7000 : 3200);
}

function commit(next, message, options) {
  if (storageError && !options?.replace) {
    notify('Откройте настройки, чтобы восстановить библиотеку из копии.', true);
    return false;
  }
  try {
    state = save(next, options);
    storageError = '';
    cloud.schedule();
    if (message) notify(message);
    return true;
  } catch (error) {
    notify(error.message || 'Не удалось сохранить данные.', true);
    if (dialog.open) formError(dialog.querySelector('form') || dialog, error.message);
    return false;
  }
}

function shell(content) {
  const workspace = deskTabs.some(([page]) => page === route.page);
  return `<main id="main" tabindex="-1" class="page page-${route.page}${workspace ? ' desk-workspace' : ''}">
    ${storageError ? `<div class="alert">${icon('shield',19)}<span>${esc(storageError)}</span><a href="#settings">Восстановить данные</a></div>` : ''}
    ${workspace ? deskHeader() : route.page === 'settings' ? `<a class="back-link" href="#library">${icon('back',17)} К играм</a>` : ''}
    ${content}
  </main>`;
}

const gameStatus = game => game.shelf && Object.hasOwn(STATUSES, game.status) ? game.status : '';

function trophyFor(record) {
  if (!record?.total || !record.unlocked) return '';
  if (record.unlocked === record.total) return 'platinum';
  return record.unlocked * 5 <= record.total * 3 ? 'sapphire' : 'silver';
}

function achievementPercent(record) {
  if (!record.unlocked) return 0;
  const rate = record.unlocked / record.total * 100;
  return rate === 100 ? 100 : Math.min(99.9, Math.max(0.1, Math.round(rate * 10) / 10));
}

function trophyBadge(trophy) {
  return trophy ? `<span class="cup-label cup-${trophy}">${icon('trophy',23)}<span>${cups[trophy]}</span></span>` : '';
}

function cover(game, className = '') {
  const id = game.steam?.appid;
  const custom = coverUrl(game.cover);
  const generated = id && custom === `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_600x900.jpg`;
  const url = (generated ? '' : custom) || steamCover(id);
  return `<div class="cover ${className}" style="--cover-accent:${/^#[\da-f]{6}$/i.test(game.accent ?? '') ? game.accent : '#7063a5'}">
    <span class="cover-fallback">${icon('game', 42)}</span>${url ? `<img src="${esc(url)}" alt="" decoding="async" loading="${className === 'game-poster' ? 'eager' : 'lazy'}" referrerpolicy="no-referrer" data-steam-art="${id ?? ''}" data-art-kind="cover">` : ''}</div>`;
}

function progressBar(value) {
  return `<div class="progress-track" role="progressbar" aria-label="Прогресс" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent(value)}"><span style="width:${percent(value)}%"></span></div>`;
}





function header(kicker, title, description, actions = '') {
  return `<div class="section-heading"><div><div class="eyebrow"><i></i>${kicker}</div><h1>${title}</h1>
    <p>${description}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ''}</div>`;
}

const byLastPlayed = (a,b) => (b.steam?.lastPlayed ?? 0) - (a.steam?.lastPlayed ?? 0);

function filtered(source) {
  const query = filter.query.trim().toLocaleLowerCase('ru');
  return source.filter(game => {
    const haystack = [game.title, displayName(game), game.genre, game.platform, game.steam?.appid, ...game.tags].join(' ').toLocaleLowerCase('ru');
    return (!query || query.split(/\s+/).every(term => haystack.includes(term))) &&
      (!filter.status || steamStatus(summaryFor(game)) === filter.status);
  }).sort((a,b) => byLastPlayed(a,b) || displayName(a).localeCompare(displayName(b),'ru'));
}

function displayName(game, full = false) {
  return game.steam?.appid === 292030 ? (full ? 'Ведьмак 3: Дикая Охота' : 'Ведьмак 3') : game.title;
}

function gameMenu(game, edit = false) {
  const notes = edit && (game.journal.length || game.runs.length)
    ? `<a class="btn btn-quiet" href="#game/${encodeURIComponent(game.id)}/notes">${icon('edit',17)} Личный журнал</a>` : '';
  return `<details class="game-menu"><summary class="icon-btn" aria-label="Действия с игрой" title="Действия с игрой">${icon('more',21)}</summary>
    <div class="game-menu-list">
      ${notes}
      ${edit ? button('edit-game','Редактировать игру','edit') : ''}
      ${button('hide-game',game.hidden ? 'Вернуть в библиотеку' : 'Скрыть игру',game.hidden ? 'eye' : 'eyeOff','quiet',`data-id="${esc(game.id)}"`)}
    </div></details>`;
}

function gameCard(game) {
  const total = summaryFor(game);
  const achieved = total?.total ? achievementPercent(total) : null;
  const status = steamStatus(total);
  const recent = recentUnlocks(total);
  return `<article class="game-card desk-game ${status}">
    <a href="#game/${encodeURIComponent(game.id)}" class="card-link" aria-label="Открыть ${esc(displayName(game))}">
      <div class="desk-identity"><div class="card-art">${cover(game)}</div><div><h3>${esc(displayName(game))} ${completionBadge(status)}</h3>
        <small>${game.steam ? icon('steam',13) + ' Steam' : esc(game.platform)}</small></div></div>
      <div class="desk-progress">${achieved === null ? '—' : progressBar(achieved) + '<span>' + icon('trophy',13) + ' ' + total.unlocked + ' / ' + total.total + '</span>'}</div>
      <div class="desk-recent">${recent.length ? `<div>${recent.slice(0,5).map(trophyIcon).join('')}${recent.length > 5 ? `<small>+${recent.length-5}</small>` : ''}</div>
        ${recent[0].time ? `<small>Последнее ${relativeDate(recent[0].time * 1000)}</small>` : ''}` : '—'}</div>
      <div class="desk-activity"><strong>${icon('clock',14)} ${duration(game.steam?.minutes ?? Math.round(gameHours(game)*60))}</strong><small>${game.steam?.lastPlayed ? relativeDate(game.steam.lastPlayed*1000) : '—'}</small></div>
    </a>
    <div class="card-tools">${iconButton('favorite', game.favorite ? 'Убрать из избранного' : 'В избранное', 'bookmark',
      `data-id="${esc(game.id)}" aria-pressed="${game.favorite}"`)}${gameMenu(game)}</div>
  </article>`;
}

function gameList(source) {
  const result = filtered(source);
  if (!result.length) {
    const isFiltered = Boolean(filter.query || filter.status || route.trophy);
    return `<div class="empty"><span class="empty-icon">${icon(isFiltered ? 'search' : 'game', 29)}</span>
      <h2>${isFiltered ? 'Игры не найдены' : 'Здесь пока пусто'}</h2>
      <p>${isFiltered ? 'Попробуйте другой запрос или сбросьте фильтры.' :
        route.page === 'library' && shelfMode === 'hidden' ? 'Скрытые игры можно вернуть в библиотеку в любой момент.' :
        route.page === 'library' && shelfMode === 'favorite' ? 'Нажми на закладку у игры, чтобы добавить её в избранное.' :
        route.page === 'collections' ? 'Выбери игры из своей библиотеки.' : 'Подключи Steam в настройках, чтобы загрузить библиотеку.'}</p>
      ${isFiltered ? button('clear-filters', 'Сбросить фильтры', 'x') :
        route.page === 'library' && shelfMode === 'hidden' ? button('shelf', 'Все игры', 'library', 'secondary', 'data-value="all"') :
        route.page === 'collections' ? button('pick-collection','Выбрать игру','plus','primary') : '<a class="btn btn-primary" href="#settings">Настройки Steam</a>'}</div>`;
  }
  return `<div class="library-columns desk-columns" aria-hidden="true"><span>Игра</span><span>Прогресс</span><span>Недавние</span><span>Активность</span></div>
    <div class="game-grid list-view">${result.slice(0, displayLimit).map(gameCard).join('')}</div>
    ${result.length > displayLimit ? `<div class="load-more">${button('more-games', 'Показать ещё игры', 'down')}</div>` : ''}`;
}

function option(value, title, selected) {
  return `<option value="${esc(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${esc(title)}</option>`;
}

function searchField(id = 'global-search') {
  return `<label class="searchbox">${icon('search',22)}<input type="search" id="${id}" placeholder="Поиск по библиотеке" aria-label="Поиск по библиотеке" value="${esc(filter.query)}"></label>`;
}

function viewControls() {
  return `<div class="library-controls library-controls-compact">
    ${searchField()}
    ${route.page === 'library' && !route.trophy ? `<select id="shelf-mode" aria-label="Раздел библиотеки">${[['all','Все игры'],['favorite','Избранное'],['hidden','Скрытые']]
      .map(([id,label]) => option(id,label,shelfMode)).join('')}</select>` : ''}
    <select id="status-filter" aria-label="Статус игры">${[['','Статус'],['perfect','Идеально'],['beaten','Пройдено']].map(([id,label])=>option(id,label,filter.status)).join('')}</select>
  </div>`;
}

function sourceForPage() {
  if (route.trophy) return games().filter(game => trophyFor(summaryFor(game)) === route.trophy);
  if (route.page === 'library') return games().filter(game => shelfMode === 'hidden' ? game.hidden :
    !game.hidden && (shelfMode !== 'favorite' || game.favorite));
  const collection = route.page === 'collections' && findByRoute(collections());
  if (collection) return games().filter(game => game.collectionIds.includes(collection.id));
  return games();
}

function gameResults(source) {
  return `<div id="game-results">${gameList(source)}</div>`;
}

function library() {
  return `<section class="library-section" aria-label="Библиотека">
    ${route.trophy ? `<div class="cup-filter">${trophyBadge(route.trophy)} <a class="quiet-link" href="#library">${icon('x',16)} Сбросить кубок</a></div>` : ''}
    ${viewControls()}${gameResults(sourceForPage())}
  </section>`;
}

function librarySummary() {
  const linked = games().filter(game => game.steam);
  const hours = linked.reduce((total,game) => total + game.steam.minutes, 0) / 60;
  const earned = linked.reduce((total,game) => total + (summaryFor(game)?.unlocked ?? 0), 0);
  const perfect = linked.filter(game => trophyFor(summaryFor(game)) === 'platinum').length;
  const metrics = [[numeric(linked.length),'Игр в Steam'],[numeric(Math.round(hours))+' ч','Время в играх'],
    [numeric(earned),'Получено достижений'],[numeric(perfect),'Идеально']];
  return `<dl id="library-summary" class="library-summary" aria-label="Сводка Steam">${metrics.map(([value,label]) =>
    `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
}




const shortDay = new Intl.DateTimeFormat('ru', { day:'2-digit', month:'2-digit', year:'numeric', timeZone:'UTC' });
const fullMoment = new Intl.DateTimeFormat('ru', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
const relativeTime = new Intl.RelativeTimeFormat('ru', { numeric:'auto' });

function duration(minutes) {
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return [hours ? numeric(hours) + ' ч' : '', rest || !hours ? rest + ' мин' : ''].filter(Boolean).join(' ');
}

function relativeDate(value) {
  const elapsed = Math.max(0, Date.now() - value);
  if (elapsed < 3600000) return elapsed < 60000 ? 'только что' : relativeTime.format(-Math.floor(elapsed/60000),'minute');
  if (elapsed < 86400000) return relativeTime.format(-Math.floor(elapsed/3600000),'hour');
  const days = dayNumber(Date.now()) - dayNumber(value);
  return days < 14 ? relativeTime.format(-days,'day') : shortDay.format(calendarDate(dayNumber(value)));
}

function recentUnlocks(record) {
  return (record?.items ?? []).filter(item => item.unlocked).sort((a,b) => b.time-a.time);
}

function completionBadge(status) {
  return status ? `<span class="desk-badge ${status}">${icon(status === 'perfect' ? 'trophy' : 'check',13)} ${status === 'perfect' ? 'Идеально' : 'Пройдено'}</span>` : '';
}

function trophyIcon(item, concealed = false) {
  return `<span class="desk-trophy-icon" title="${esc(concealed ? 'Скрытое достижение' : item.name)}">${icon('trophy',14)}
    ${item.icon && !concealed ? `<img src="${esc(item.icon)}" data-achievement-icon data-fallback-icon="${esc(item.fallbackIcon)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</span>`;
}

function gameHref(game, tab = '') {
  return '#game/' + encodeURIComponent(game.id) + (tab ? '/' + tab : '');
}

function deskHeader() {
  return `<header class="desk-header">
    <div class="desk-overview"><a class="desk-brand" href="#library">${icon('ribbon',25)} AFTERSAVE</a>${librarySummary()}</div>
    <nav class="desk-tabs" aria-label="Разделы библиотеки">${deskTabs.map(([page,glyph]) =>
      `<a href="#${page}" ${route.page === page ? 'aria-current="page"' : ''}>${icon(glyph,16)} ${labels[page]}</a>`).join('')}
      <a class="desk-settings" href="#settings" aria-label="Настройки" title="Настройки">${icon('gear',17)}</a>
    </nav>
  </header>`;
}

function collectionTotals(group) {
  return group.reduce((totals,game) => {
    const record = summaryFor(game);
    return { minutes: totals.minutes + (game.steam?.minutes ?? Math.round(game.hours*60)),
      unlocked: totals.unlocked + (record?.unlocked ?? 0), total: totals.total + (record?.total ?? 0) };
  }, { minutes:0, unlocked:0, total:0 });
}

function achievementEntries(game) {
  return (game ? [game] : games().filter(item => !item.hidden)).flatMap(game =>
    (summaryFor(game)?.items ?? []).map(item => ({game,item})));
}

function heatmap(days, today, firstKnown = -Infinity, count = 147, time = false) {
  const thresholds = time ? [60,120,240] : [2,5,12];
  return `<div class="desk-heatmap" style="--weeks:${Math.ceil(count / 7)}" aria-label="Тепловая карта активности">${Array.from({length:count},(_,i) => {
    const day = today-count+1+i, amount = days.get(day) ?? 0;
    const level = day < firstKnown ? 'unknown' : amount > 0 ? 1 + thresholds.filter(min => amount >= min).length : 0;
    return `<span class="heat-${level}" title="${shortDay.format(calendarDate(day))} · ${day < firstKnown ? 'нет данных' : time ? duration(amount) : numeric(amount)}"></span>`;
  }).join('')}</div>`;
}

function streakPanel(days, today, firstKnown, total, label, time = false) {
  const series = streaks(days,today);
  return `<section class="desk-panel desk-streak"><div><small>Текущая серия</small><strong>${series.current} <small>дн.</small></strong></div>
    <div class="desk-week">${Array.from({length:7},(_,i) => {
      const day = today - 6 + i;
      return `<span class="${days.has(day) ? 'active' : ''}" title="${shortDay.format(calendarDate(day))}">${calendarDate(day).getUTCDate()}</span>`;
    }).join('')}</div></section>
    <section class="desk-panel desk-year"><h2>За последний год</h2><div class="desk-year-values">
      <div><small>Самая длинная серия</small><strong>${series.best} дн.</strong></div><div><small>${label}</small><strong>${total}</strong></div>
    </div>${heatmap(days,today,firstKnown,147,time)}
    <details><summary>Открыть годовую карту</summary>${heatmap(days,today,firstKnown,364,time)}</details>
    ${Number.isFinite(firstKnown) ? `<p class="desk-muted">Наблюдения с ${shortDay.format(calendarDate(firstKnown))}</p>` : ''}</section>`;
}

function feedMore(count) {
  return count > feedLimit ? `<div class="load-more">${button('desk-feed-more','Показать ещё','down')}</div>` : '';
}

function achievementsPage() {
  const entries = achievementEntries();
  const earned = entries.filter(({item}) => item.unlocked && item.time).sort((a,b) => b.item.time - a.item.time);
  const locked = entries.filter(({item}) => !item.unlocked);
  const visible = lockedFeed ? locked : earned;
  const days = new Map(), today = dayNumber(Date.now());
  for (const {item} of earned) addDaily(days,dayNumber(item.time*1000),1);
  const year = [...days].reduce((total,[day,n]) => total + (day >= today-364 && day <= today ? n : 0),0);
  return `<div id="desk-feed" class="desk-split"><div>
    <div class="desk-feed-head"><h1>${lockedFeed ? 'Заблокированные достижения' : 'Последние достижения'}</h1>
      ${lockedFeed ? button('desk-locked','К полученным','back','quiet') : ''}</div>
    ${visible.length ? visible.slice(0,feedLimit).map(({game,item}) => `<article class="desk-panel desk-unlock">
      <div>${trophyIcon(item,item.hidden&&!item.unlocked)}<div><strong>${esc(item.name)}</strong>
      <p>${esc(item.hidden&&!item.unlocked ? 'Скрытое условие' : item.description)}</p>
      ${Number.isFinite(item.percent) ? `<small>${numeric(item.percent)}% игроков Steam</small>` : ''}</div></div>
      <footer><a href="${gameHref(game,'achievements')}">${icon('steam',14)} ${esc(displayName(game))}</a>
      ${item.time ? `<time>${fullMoment.format(item.time*1000)}</time>` : ''}</footer></article>`).join('') :
      `<p class="desk-panel desk-muted">${lockedFeed ? 'Нет заблокированных достижений в загруженных данных.' : 'Пока нет загруженных достижений с датой. Обнови достижения Steam в настройках.'}</p>`}
    ${feedMore(visible.length)}
  </div><aside>${streakPanel(days,today,-Infinity,numeric(year),'Получено достижений')}
    <section class="desk-panel"><h2>Что дальше</h2><p class="desk-muted">По играм с загруженными данными Steam.</p>
    ${button('desk-locked', (lockedFeed ? 'К полученным достижениям' : 'Заблокированные · ' + numeric(locked.length)), 'right','quiet')}</section>
  </aside></div>`;
}

function sessionsPage(game) {
  const linked = new Map((game ? [game] : games().filter(item => !item.hidden)).filter(item => item.steam).map(item => [item.steam.appid,item]));
  const activity = state.steam?.activity;
  const events = aggregateSessions(activity?.windows,linked);
  const days = new Map(), unlocks = new Map(), today = dayNumber(Date.now());
  for (const {item,game:owner} of achievementEntries(game)) {
    if (!item.unlocked || !item.time || !owner.steam) continue;
    const key = owner.steam.appid + ':' + dayNumber(item.time*1000);
    const items = unlocks.get(key) ?? [];
    items.push(item);
    unlocks.set(key,items);
  }
  for (const {from,to,minutes} of events) if (from === to) addDaily(days,to,minutes);
  const first = activity?.startedAt ? Math.max(today-89,dayNumber(activity.startedAt)) : Infinity;
  const observedMinutes = events.reduce((sum,event) => sum + (event.from >= today-364 && event.to <= today ? event.minutes : 0),0);
  const launches = [...linked.values()].filter(item => item.steam.lastPlayed).sort(byLastPlayed);
  return `<div id="desk-feed" class="desk-split"><div>
    <div class="desk-feed-head"><h1>Игровые сессии</h1>${button('steam-sync','Обновить','download','quiet',syncingSteam ? 'disabled' : '')}</div>
    ${steamMessage ? `<p class="steam-message desk-muted" role="status">${esc(steamMessage)}</p>` : ''}
    ${events.length ? events.slice(0,feedLimit).map(({game,minutes,from,to}) => {
      const earned = from === to ? unlocks.get(game.steam.appid+':'+to) ?? [] : [];
      const date = (from === to ? '' : shortDay.format(calendarDate(from))+' — ')+shortDay.format(calendarDate(to));
      return `<article class="desk-panel desk-session"><div>${cover(game)}<p>${from === to ? 'Играл' : 'Учтено'} <strong>${duration(minutes)}</strong> в <a href="${gameHref(game)}">${esc(displayName(game))}</a>
      ${earned.length ? `<small>Достижений за день: ${earned.length}</small>` : ''}</p><time>${date}</time></div>
      ${earned.length ? `<footer>${earned.slice(0,6).map(item => trophyIcon(item)).join('')}${earned.length > 6 ? `<small>ещё ${earned.length-6}</small>` : ''}</footer>` : ''}</article>`;
    }).join('') : `<p class="desk-panel desk-muted">Пока нет наблюдений игрового времени. Ниже даты последних запусков, полученные от Steam.</p>
      ${launches.slice(0,feedLimit).map(item => `<article class="desk-panel desk-session"><div>${cover(item)}<a href="${gameHref(item)}">${esc(displayName(item))}</a>
      <time>${steamDate(item.steam.lastPlayed)}</time></div></article>`).join('')}`}
    ${feedMore(events.length || launches.length)}
  </div><aside>${streakPanel(days,today,first,duration(observedMinutes),'Учтённое время',true)}
    <p class="desk-muted">Серия считается по дням с подтверждённым приростом времени. Даты начала и окончания отдельной сессии Steam не передаёт.</p>
  </aside></div>`;
}

function statsPage() {
  const linked = games().filter(game => game.steam && !game.hidden);
  const known = linked.map(game => summaryFor(game)).filter(record => record?.total);
  const perfect = known.filter(record => steamStatus(record) === 'perfect').length;
  const beaten = known.filter(record => steamStatus(record) === 'beaten').length;
  const other = Math.max(0, linked.length-perfect-beaten);
  const totals = collectionTotals(linked);
  const earned = achievementEntries().filter(({item}) => item.unlocked);
  const rare = earned.filter(({item}) => Number.isFinite(item.percent)).sort((a,b) => a.item.percent - b.item.percent).slice(0,5);
  const months = new Map(), days = new Map(), genres = new Map();
  for (const game of linked) if (game.genre.trim()) addDaily(genres,game.genre.trim(),game.steam.minutes);
  for (const {item} of earned) if (item.time) {
    const date = new Date(item.time*1000);
    addDaily(months,date.getFullYear()*12+date.getMonth(),1);
    addDaily(days,dayNumber(date),1);
  }
  const timeline = [...months].sort((a,b) => a[0]-b[0]);
  let sum = 0;
  const max = timeline.reduce((n,[,count]) => n+count,0);
  const points = timeline.map(([month,count]) => {
    sum += count;
    return (12+((month-timeline[0][0]) / Math.max(1,timeline.at(-1)[0]-timeline[0][0]))*576).toFixed(1)+','+(152-sum/Math.max(1,max)*138).toFixed(1);
  }).join(' ');
  const buckets = [0,0,0,0,0,0];
  for (const record of known) {
    const progress = achievementPercent(record);
    buckets[progress === 0 ? 0 : progress === 100 ? 5 : Math.min(4,Math.ceil(progress/25))]++;
  }
  const maxBucket = Math.max(1,...buckets);
  const bestDay = [...days].sort((a,b) => b[1]-a[1])[0];
  const bestMonth = [...months].sort((a,b) => b[1]-a[1])[0];
  return `<div id="desk-feed" class="desk-stat-grid">
    <section class="desk-panel"><h2>Обзор библиотеки</h2><small>Количество игр</small><strong class="desk-stat-value">${numeric(linked.length)}</strong>
    <div class="desk-donut" style="--perfect:${perfect/Math.max(1,linked.length)*100}%;--beaten:${(perfect+beaten)/Math.max(1,linked.length)*100}%" role="img" aria-label="Распределение по прохождению"></div>
    <div class="desk-legend"><span><i></i>${perfect} Идеально</span><span><i></i>${beaten} Пройдено</span><span><i></i>${other} Без подтверждения</span></div></section>
    <section class="desk-panel"><h2>Прохождение игр</h2><small>Средний прогресс по играм с данными</small>
    <strong class="desk-stat-value">${known.length ? numeric(known.reduce((n,r) => n+achievementPercent(r),0)/known.length)+'%' : '—'}</strong>
    <div class="desk-bars">${buckets.map((n,i) => `<div><span>${n}</span><i style="--bar:${n/maxBucket*100}%"></i><small>${['0%','до 25%','25–50%','50–75%','75–99%','100%'][i]}</small></div>`).join('')}</div></section>
    <section class="desk-panel"><h2>Самые редкие достижения</h2>${rare.length ? rare.map(({game,item}) => `<a class="desk-rare" href="${gameHref(game,'achievements')}">${trophyIcon(item)}
    <span><strong>${esc(item.name)}</strong><small>${esc(displayName(game))}</small></span><b>${numeric(item.percent)}%</b></a>`).join('') : '<p class="desk-muted">Пока нет данных о редкости.</p>'}</section>
    <section class="desk-panel desk-history"><h2>Общий прогресс достижений</h2><div class="desk-year-values"><div><small>Получено</small><strong>${numeric(totals.unlocked)}</strong></div>
    <div><small>Заблокировано</small><strong>${numeric(totals.total-totals.unlocked)}</strong></div>
    <div><small>Максимум за день</small><strong>${bestDay ? numeric(bestDay[1]) : '—'}</strong></div>
    <div><small>Максимум за месяц</small><strong>${bestMonth ? numeric(bestMonth[1]) : '—'}</strong></div></div>
    <small>Данные по ${known.length} из ${linked.length} игр</small>
    ${points ? `<svg viewBox="0 0 600 165" preserveAspectRatio="none" role="img" aria-label="Накопление достижений по датам Steam">
    <path d="M12 40H588M12 78H588M12 116H588M12 153H588" stroke="#303340" stroke-dasharray="4 4"/>
    <polyline points="${points}" fill="none" stroke="#6875ff" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
    <div class="desk-chart-years"><small>${Math.floor(timeline[0][0]/12)}</small><small>${Math.floor(timeline.at(-1)[0]/12)}</small></div>` : '<p class="desk-muted">Достижения с датами пока не загружены.</p>'}</section>
    <section class="desk-panel"><h2>Больше всего времени</h2>${[...linked].sort((a,b)=>b.steam.minutes-a.steam.minutes).slice(0,5).map(game =>
      `<a class="desk-rare" href="${gameHref(game)}">${cover(game)}<strong>${esc(displayName(game))}</strong><b>${duration(game.steam.minutes)}</b></a>`).join('')}</section>
    ${genres.size ? `<section class="desk-panel"><h2>Игры по жанрам</h2>${[...genres].sort((a,b) => b[1]-a[1]).slice(0,6).map(([genre,minutes]) =>
      `<div class="desk-rare"><strong>${esc(genre)}</strong><b>${duration(minutes)}</b></div>`).join('')}<small>Только игры с указанным жанром.</small></section>` : ''}
  </div>`;
}

function refreshDeskFeed() {
  const feed = app.querySelector('#desk-feed');
  if (!feed) return;
  const view = route.page === 'achievements' ? achievementsPage() : route.page === 'stats' ? statsPage() :
    sessionsPage(route.page === 'game' ? findByRoute(games()) : undefined);
  feed.outerHTML = view;
  imageFallbacks(app.querySelector('#desk-feed'));
}

function collectionsPage() {
  const collection = findByRoute(collections());
  if (collection) {
    const source = sourceForPage();
    const actions = button('pick-collection', 'Выбрать игру', 'plus', 'primary') + button('edit-collection', 'Редактировать', 'edit', 'secondary', `data-id="${esc(collection.id)}"`);
    return `<a class="back-link" href="#collections">${icon('back', 17)} Все коллекции</a>
      ${header('ПОДБОРКА', esc(collection.name), 'Игры из этой коллекции.', actions)}
      ${viewControls(source)}${gameResults(source)}`;
  }
  const list = collections();
  return `<div class="desk-collections"><div>${header('ПОДБОРКИ', 'Коллекции игр', 'Собирай игры по сериям, жанрам или для следующего прохождения.', button('new-collection', 'Новая коллекция', 'plus', 'primary'))}</div>
    <div class="desk-collection-list">${list.length ? list.map(item => {
      const grouped = games().filter(game => game.collectionIds.includes(item.id));
      const {minutes,unlocked,total} = collectionTotals(grouped);
      return `<a href="#collections/${encodeURIComponent(item.id)}" class="desk-panel desk-collection">
        <h2>${esc(item.name)}</h2><div class="desk-collection-covers">${grouped.slice(0,5).map(game => cover(game)).join('')}${grouped.length > 5 ? `<span>+${grouped.length-5}</span>` : ''}</div>
        <footer><small>${grouped.length} игр</small><small>${duration(minutes)}</small>${total ? `<small>${unlocked} / ${total}</small>${progressBar(unlocked/total*100)}` : ''}</footer></a>`;
    }).join('') : '<p class="desk-panel desk-muted">Здесь появятся твои коллекции и их прогресс.</p>'}</div></div>`;
}


function dateLabel(value) {
  if (!value) return '—';
  const date = new Date(value + 'T12:00:00');
  return Number.isNaN(date.valueOf()) ? '—' : dateFormat.format(date);
}

function gamePage() { return gameDashboard(); }

function wideCover(game, showFallback = false) {
  const id = game.steam?.appid;
  return id ? `<div class="cover wide-cover" style="--cover-accent:#7363a2">${showFallback ? `<span class="cover-fallback">${icon('game',24)}</span>` : ''}<img src="${esc(steamHeader(id))}" alt="" loading="lazy" data-steam-art="${id}" data-art-kind="cover"></div>` : cover(game,'wide-cover');
}

function settingsPage() {
  return `${header('ЛИЧНОЕ', labels.settings, 'Данные библиотеки, резервные копии и установка приложения.')}
    <div class="settings-grid">
      <section class="panel settings-panel"><span class="metric-icon violet">${icon('globe',21)}</span><h2>Облачное сохранение</h2>
        <p>Статусы, теги, избранное, коллекции и заметки на ПК и телефоне.</p>
        <div class="settings-actions">${button('cloud-toggle',cloud.enabled() ? 'Выключить на этом устройстве' : 'Включить облачное сохранение','globe','primary')}
          ${cloud.enabled() ? button('cloud-sync','Синхронизировать','download') : ''}</div>
        ${cloudMessage ? `<p class="cloud-status" role="status">${esc(cloudMessage)}</p>` : ''}
        ${cloudConflict ? `<div class="settings-actions">${button('cloud-local','В спорных записях взять с устройства','','secondary')}${button('cloud-remote','В спорных записях взять из облака','','secondary')}</div>` : ''}</section>
      <section class="panel settings-panel"><span class="metric-icon lime">${icon('shield', 21)}</span><h2>Данные на устройстве</h2>
        <p>Библиотека сохраняется в этом браузере. Сделай копию перед очисткой данных, сменой браузера или переносом на другое устройство.</p>
        <div class="settings-actions">${button('export-json', 'Скачать JSON', 'download', 'primary', storageError ? 'disabled' : '')}
          ${button('import-json', 'Восстановить JSON', 'upload')}
          ${button('export-csv', 'Скачать CSV', 'download', 'secondary', storageError ? 'disabled' : '')}</div>
        <input id="backup-file" type="file" accept=".json,application/json" hidden></section>
      <section class="panel settings-panel"><span class="metric-icon aqua">${icon('monitor', 21)}</span><h2>Приложение на экране «Домой»</h2>
        <p>На iPhone открой AFTERSAVE в Safari и выбери «Поделиться» → «На экран “Домой”». На компьютере используй пункт установки приложения в браузере, если он доступен.</p>
        <small id="offline-label">${'serviceWorker' in navigator && navigator.serviceWorker.controller ? 'Офлайн-режим готов на этом устройстве.' : 'Офлайн-режим доступен после первой загрузки по HTTPS.'}</small></section>
      <section class="panel settings-panel"><span class="metric-icon amber">${icon('globe', 21)}</span><h2>Игровые аккаунты</h2>
        <p>Синхронизация библиотеки Steam и достижений.</p>${steamPanel()}
        ${connected() && games().some(game => game.steam) ? `<div class="settings-actions">${button(scanningAchievements ? 'achievement-stop' : 'achievement-scan',
          scanningAchievements ? 'Остановить обновление' : 'Обновить достижения всех игр','download')}</div>` : ''}
        ${scanMessage ? `<p class="scan-status" role="status">${esc(scanMessage)}</p>` : ''}</section>
    </div>`;
}

function render(focusMain = false) {
  const views = { library, collections: collectionsPage, achievements: achievementsPage, sessions: sessionsPage, stats: statsPage, settings: settingsPage, game: gamePage };
  const regionOffset = app.querySelector('.boss-region-index')?.scrollTop;
  app.innerHTML = shell(views[route.page]());
  restoreBossRegionScroll(regionOffset);

  imageFallbacks(app);
  if (route.page === 'game') showAchievements();
  document.title = route.page === 'library' ? 'AFTERSAVE — игровая библиотека' : `${labels[route.page]} · AFTERSAVE`;
  if (focusMain) app.querySelector('#main').focus({ preventScroll: true });
}

function renderResults(more = false) {
  if (!more) displayLimit = 24;
  const current = document.querySelector('#game-results');
  if (current) {
    current.outerHTML = gameResults(sourceForPage());
    imageFallbacks(document.querySelector('#game-results'));
  }
}

function showDialog(title, eyebrow, content, className = '') {
  dialog.className = className;
  dialog.innerHTML = `<div class="dialog-head"><div><div class="eyebrow"><i></i>${eyebrow}</div><h2 id="dialog-title">${title}</h2></div>${iconButton('close-dialog', 'Закрыть', 'x')}</div>${content}`;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  dialog.querySelector('[autofocus], input:not([type=hidden]), .dialog-body button, .dialog-head button')?.focus();
}

function inputField(label, name, value, attrs = '', type = 'text') {
  return `<label class="field"><span>${label}</span><input type="${type}" name="${name}" value="${esc(value)}" ${attrs}></label>`;
}

function errorLine() { return '<p class="form-error" role="alert" hidden></p>'; }

function formError(form, message) {
  const line = form.querySelector('.form-error');
  if (line) { line.textContent = message; line.hidden = false; }
}

function formFooter(label, glyph = 'check') {
  return `<div class="dialog-footer">${button('close-dialog', 'Отмена', '', 'secondary')}<button type="submit" class="btn btn-primary">${icon(glyph, 17)}<span>${label}</span></button></div>`;
}

let draft = null;

function openGameForm(game = {}, editing = false) {
  draft = { editing, game };
  const title = editing ? 'Редактировать игру' : 'Новая игра';
  const knownPlatform = game.platform || 'PC';
  const platforms = [...new Set([...PLATFORMS, knownPlatform])];
  showDialog(title, 'ИГРОВОЙ ЖУРНАЛ', `<form id="game-form"><div class="dialog-body form-grid">
    ${inputField('Название', 'title', game.title, 'required maxlength="160" autofocus')}
    <label class="field"><span>Платформа</span><select name="platform">${platforms.map(value => option(value, value, knownPlatform)).join('')}</select></label>
    <label class="field"><span>Статус</span><select name="status">
      ${!gameStatus(game) ? option('', 'Без статуса', '') : ''}
      ${Object.entries(STATUSES).map(([value, label]) => option(value, label, gameStatus(game))).join('')}</select></label>
    ${inputField('Время, ч', 'hours', game.hours ?? 0, 'min="0" max="100000" step="any" required', 'number')}
    ${inputField('Дата начала', 'startedAt', game.startedAt, '', 'date')}
    ${inputField('Дата завершения', 'finishedAt', game.finishedAt, '', 'date')}
    ${inputField('Жанр', 'genre', game.genre, 'maxlength="80" placeholder="Например, RPG"')}
    ${inputField('Год выпуска', 'year', game.year, 'min="1900" max="2100" step="1" placeholder="Например, 2022"', 'number')}
    ${inputField('Теги через запятую', 'tags', (game.tags || []).join(', '), 'maxlength="819" placeholder="кооператив, уютные игры"')}
    <label class="field"><span>Обложка по HTTPS</span><input name="cover" value="${esc(coverUrl(game.cover).startsWith('https:') ? game.cover : '')}" type="url" placeholder="https://…" maxlength="2048"></label>
    <label class="checkbox span-all"><input name="wishlist" type="checkbox" ${game.wishlist ? 'checked' : ''}> В списке желаний</label>
    ${state.collections.length ? `<fieldset class="fieldset span-all"><legend>Коллекции</legend>
      ${state.collections.map(item => `<label class="checkbox"><input type="checkbox" name="collection" value="${esc(item.id)}" ${game.collectionIds?.includes(item.id) ? 'checked' : ''}> ${esc(item.name)}</label>`).join('')}</fieldset>` : ''}
    ${errorLine()}</div>${formFooter(editing ? 'Сохранить изменения' : 'Добавить в библиотеку', editing ? 'check' : 'plus')}</form>`);
}

function openCollectionForm(item) {
  showDialog(item ? 'Редактировать коллекцию' : 'Новая коллекция', 'ПОДБОРКИ', `<form id="collection-form" data-id="${esc(item?.id)}">
    <div class="dialog-body single-form">${inputField('Название', 'name', item?.name, 'required maxlength="64" autofocus')}
      ${item ? button('delete-collection', 'Удалить коллекцию', 'trash', 'danger', `data-id="${esc(item.id)}"`) : ''}${errorLine()}</div>
    ${formFooter('Сохранить')}</form>`);
}



function confirmAction(title, message, confirmLabel, action, danger = false) {
  showDialog(title, 'ПОДТВЕРЖДЕНИЕ', `<form id="confirm-form"><div class="dialog-body"><p>${message}</p>${errorLine()}</div>
    <div class="dialog-footer">${button('close-dialog', 'Отмена', '', 'secondary')}<button type="submit" class="btn btn-${danger ? 'danger' : 'primary'}">${confirmLabel}</button></div></form>`);
  dialog.querySelector('#confirm-form').addEventListener('submit', event => {
    event.preventDefault();
    if (action()) dialog.close();
  });
}

function saveGame(form) {
  const fields = new FormData(form);
  const coverInput = fields.get('cover').trim();
  const title = fields.get('title').trim();
  const startedAt = fields.get('startedAt');
  const finishedAt = fields.get('finishedAt');
  const status = fields.get('status');
  if (!title) return formError(form, 'Введите название игры.');
  if (coverInput && !coverUrl(coverInput).startsWith('https:')) return formError(form, 'Адрес обложки должен начинаться с https://.');
  if (startedAt && finishedAt && finishedAt < startedAt) return formError(form, 'Дата завершения должна быть не раньше даты начала.');
  const value = {
    ...draft.game, title, platform: fields.get('platform'), status: status || draft.game.status || 'planned',
    hours: Number(fields.get('hours')),
    startedAt, finishedAt, shelf: Boolean(status || draft.game.shelf), genre: fields.get('genre'), year: fields.get('year') ? Number(fields.get('year')) : null,
    tags: fields.get('tags').split(',').map(tag => tag.trim()).filter(Boolean), wishlist: fields.has('wishlist'),
    collectionIds: fields.getAll('collection'), cover: coverInput || (coverUrl(draft.game.cover).startsWith('./') ? draft.game.cover : ''),
    demo: false, updatedAt: new Date().toISOString()
  };
  try {
    const record = createGame(value);
    const allGames = draft.editing ? state.games.map(game => game.id === record.id ? record : game) : [...state.games, record];
    if (commit({ ...state, showDemo: false, games: allGames }, draft.editing ? 'Изменения сохранены' : 'Игра добавлена')) {
      dialog.close();
      go('game', record.id);
      render();
    }
  } catch (error) { formError(form, error.message || 'Проверьте поля и попробуйте ещё раз.'); }
}

function clearFilters() {
  Object.assign(filter, { query: '', status: '' });
  displayLimit = 24;
}



function download(name, data, mime) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function dateStamp(now = new Date()) {
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}


const actions = {
  'desk-feed-more': () => { feedLimit += 24; refreshDeskFeed(); },
  'desk-locked': () => { lockedFeed = !lockedFeed; feedLimit = 24; refreshDeskFeed(); },
  'boss-region': control => {
    const index = Number(control.dataset.region);
    if (index === bossRegion) return;
    bossRegion = index;
    bossArea = '';
    refreshBossTracker(control);
  },
  'boss-area': control => {
    bossArea = control.dataset.area;
    refreshBossTracker(control);
  },
  'boss-win': control => updateBossProgress(control),
  'boss-death': control => updateBossProgress(control, Number(control.dataset.delta)),
  'boss-map': control => {
    control.focus({ preventScroll: true });
    showBossMap(bossById.get(control.dataset.id));
  },
  'boss-map-place': control => showBossMap(bossById.get(control.dataset.id), Number(control.dataset.place)),
  'more-games': () => { displayLimit += 24; renderResults(true); },
  'steam-sync': () => steamSync(),
  'cloud-toggle': () => {
    if (!connected() || !state.steam) {
      enableCloudAfterLogin = true;
      return connected() ? steamSync() : openSteamLogin();
    }
    try { cloud.toggle(); } catch { notify('Не удалось сохранить настройку облака.',true); }
  },
  'cloud-sync': () => cloud.sync(),
  'cloud-local': () => cloud.sync('local'),
  'cloud-remote': () => cloud.sync('remote'),
  'top-search': () => {
    const field = document.querySelector('#global-search');
    if (field) field.focus();
    else { searchPending = true; go('library'); }
  },
  'pick-collection': openCollectionPicker,
  'achievement-state': control => {
    achievementFilter = control.dataset.value;
    achievementLimit = 24;
    for (const button of app.querySelectorAll('[data-action="achievement-state"]')) {
      button.setAttribute('aria-pressed', String(button === control));
    }
    updateAchievementRows();
  },
  'achievement-more': () => {
    achievementLimit += 24;
    updateAchievementRows(true);
  },
  'shelf': control => { shelfMode = control.dataset.value; displayLimit = 24; render(); },
  'hide-game': control => {
    const game = state.games.find(item => item.id === control.dataset.id) ?? findByRoute(state.games);
    if (game && updateGame(game, { hidden: !game.hidden }, game.hidden ? 'Игра возвращена' : 'Игра скрыта')) render();
  },
  'new-note': () => openJournal(),
  'edit-note': control => openJournal(control.dataset.id),
  'delete-journal': control => deleteJournal(control.dataset.id),
  'steam-disconnect': () => { disconnect(); stopAchievementScan = true; render(); },
  'achievement-reload': () => showAchievements(true),
  'achievement-scan': scanAchievements,
  'achievement-stop': () => { stopAchievementScan = true; },
  'new-run': () => openRun(),
  'edit-run': control => openRun(control.dataset.id),
  'delete-run': control => deleteRun(control.dataset.id),
  'favorite': control => {
    const game = state.games.find(item => item.id === control.dataset.id) ?? findByRoute(state.games);
    if (game && updateGame(game, { favorite: !game.favorite }, game.favorite ? 'Убрано из избранного' : 'В избранном')) render();
  },


  'edit-game': () => {
    const game = findByRoute(state.games);
    if (game) openGameForm(game, true);
  },
  'delete-game': () => {
    const game = findByRoute(state.games);
    if (!game) return;
    confirmAction('Удалить игру?', `«${esc(game.title)}» и её прогресс будут удалены из библиотеки.`, 'Удалить игру', () => {
      if (!commit({ ...state, games: state.games.filter(item => item.id !== game.id) }, 'Игра удалена')) return false;
      go('library');
      return true;
    }, true);
  },


  'clear-filters': () => { clearFilters(); if (route.trophy) go('library'); else render(); },
  'new-collection': () => openCollectionForm(),
  'edit-collection': control => {
    const item = state.collections.find(item => item.id === control.dataset.id);
    if (item) openCollectionForm(item);
  },
  'delete-collection': control => {
    const item = state.collections.find(item => item.id === control.dataset.id);
    if (!item) return;
    confirmAction('Удалить коллекцию?', `Подборка «${esc(item.name)}» исчезнет. Её игры останутся в библиотеке.`, 'Удалить коллекцию', () => {
      const next = state.collections.filter(collection => collection.id !== item.id);
      const updated = state.games.map(game => ({ ...game, collectionIds: game.collectionIds.filter(id => id !== item.id) }));
      if (!commit({ ...state, collections: next, games: updated }, 'Коллекция удалена')) return false;
      go('collections');
      return true;
    }, true);
  },
  'export-json': () => download(`aftersave-${dateStamp()}.json`, exportJSON(state), 'application/json;charset=utf-8'),
  'export-csv': () => download(`aftersave-${dateStamp()}.csv`, exportCSV(state), 'text/csv;charset=utf-8'),
  'import-json': () => app.querySelector('#backup-file')?.click(),
  'close-dialog': () => dialog.close(),


};

document.addEventListener('click', event => {
  const status = app.querySelector('.status-picker[open]');
  if (status && !status.contains(event.target)) status.open = false;
  const control = event.target.closest('[data-action]');
  const action = control?.dataset.action;
  if (Object.hasOwn(actions, action)) actions[action](control);
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const status = app.querySelector('.status-picker[open]');
  if (status) {
    status.open = false;
    status.querySelector('summary').focus({ preventScroll: true });
  }
});

document.addEventListener('input', event => {
  if (event.target.id === 'global-search') {
    filter.query = event.target.value;
    if (!app.querySelector('#game-results')) {
      searchPending = true;
      go('library');
    } else renderResults();
  }
  if (event.target.id === 'collection-query') filterCollectionChoices(event.target.value);
  if (event.target.id === 'achievement-query') {
    achievementQuery = event.target.value;
    achievementLimit = 24;
    updateAchievementRows();
  }
});

app.addEventListener('change', async event => {
  const field = event.target;
  if (field.id === 'achievement-sort') {
    achievementSort = field.value;
    achievementLimit = 24;
    updateAchievementRows();
  }
  if (field.id === 'achievement-reveal') {
    revealHidden = field.checked;
    updateAchievementRows();
  }
  if (field.id === 'shelf-mode' || field.id === 'status-filter') {
    if (field.id === 'shelf-mode') shelfMode = field.value;
    else filter.status = field.value;
    renderResults();
  }
  if (field.id !== 'backup-file' || !field.files.length) return;
  const file = field.files[0];
  field.value = '';
  if (file.size > 12 * 1024 * 1024) return notify('Файл копии превышает 12 МБ.', true);
  try {
    const backup = importJSON(await file.text());
    confirmAction('Восстановить библиотеку?', `В копии ${backup.games.length} игр и ${backup.collections.length} коллекций. Она заменит текущую библиотеку и профиль.`, 'Восстановить', () => {
      if (!commit(backup, 'Библиотека восстановлена', { replace: true })) return false;
      clearFilters();
      render();
      return true;
    });
  } catch (error) { notify(error.message || 'Не удалось прочитать файл копии.', true); }
});

dialog.addEventListener('submit', event => {
  const form = event.target;
  event.preventDefault();
  if (form.id === 'steam-login-form') loginSteam(form);
  if (form.id === 'run-form') saveRun(form);
  if (form.id === 'journal-form') saveJournal(form);
  if (form.id === 'collection-picker') saveCollectionChoices(form);
  if (form.id === 'game-form') saveGame(form);


  if (form.id === 'collection-form') {
    const name = new FormData(form).get('name').trim();
    if (!name) return formError(form, 'Введите название коллекции.');
    const id = form.dataset.id || crypto.randomUUID();
    const item = { id, name };
    const list = form.dataset.id ? state.collections.map(record => record.id === id ? item : record) : [...state.collections, item];
    if (commit({ ...state, showDemo: false, collections: list }, 'Коллекция сохранена')) {
      dialog.close();
      go('collections', id);
      render();
    }
  }
});



let searchPending = false;
window.addEventListener('hashchange', () => {
  if (location.hash === '#main') {
    app.querySelector('#main')?.focus();
    return;
  }
  const next = getRoute();
  if (next.page !== route.page && next.page !== 'game' && route.page !== 'game') {
    const query = searchPending ? filter.query : '';
    clearFilters();
    filter.query = query;
  }
  const previousGameId = route.id;
  route = next;
  if (route.trophy) shelfMode = 'all';
  if (next.id !== previousGameId) {
    bossRegion = 0;
    bossArea = '';
  }


  displayLimit = 24;
  feedLimit = 24;
  lockedFeed = false;
  achievementFilter = '';
  achievementQuery = '';
  achievementLimit = 24;
  if (next.id !== previousGameId) {
    achievementSort = 'rare';
    revealHidden = false;
  }
  window.scrollTo(0, 0);
  if (dialog.open) dialog.close();
  render(!searchPending);
  if (searchPending) {
    app.querySelector('#global-search')?.focus();

    searchPending = false;
  }
});

function refreshFromStorage() {
  try {
    state = load();
    storageError = '';
  } catch (error) {
    storageError = error.message;
  }
  render();
}

window.addEventListener('storage', event => {
  if (event.storageArea !== localStorage || (event.key !== null && event.key !== STORAGE_KEY)) return;
  if (dialog.open) {
    storagePending = true;
    const form = dialog.querySelector('form');
    if (form) formError(form, 'Библиотека изменилась в другой вкладке. Закройте форму и откройте её снова.');
  } else refreshFromStorage();
});

dialog.addEventListener('close', () => {
  if (dialog.open) return;
  if (!syncingSteam && dialog.querySelector('#steam-login-form')) enableCloudAfterLogin = false;
  draft = null;
  if (storagePending) {
    storagePending = false;
    refreshFromStorage();
  }
});

document.addEventListener('keydown', event => {
  if (event.key !== '/' || event.altKey || event.ctrlKey || event.metaKey || dialog.open ||
    event.target.closest('input,textarea,select,[contenteditable]')) return;
  event.preventDefault();
  actions['top-search']();

});


function imageFallbacks(root) {
  root.querySelectorAll('img').forEach(image => {
    const id = Number(image.dataset.steamArt);
    const isCover = image.dataset.artKind === 'cover';
    const tried = new Set([image.src]);
    let artwork;
    let pending = false;
    const fail = async () => {
      if (pending) return;
      pending = true;
      const coverAlternatives = () => [steamCover(id), steamHeader(id), steamHero(id)];
      const staticCover = isCover && id ? coverAlternatives().find(url => url && !tried.has(url)) : '';
      // Try the current catalogue after the main capsule fails. The remaining images are local to Steam's CDN.
      if (id && artwork === undefined && (!isCover || staticCover !== steamCover(id))) artwork = await fetchSteamArtwork(id);
      if (!image.isConnected) return;
      const alternatives = image.hasAttribute('data-achievement-icon') ?
        [image.dataset.fallbackIcon, ...achievementIconAlternatives(image.src), ...achievementIconAlternatives(image.dataset.fallbackIcon)] :
        isCover && id ? [artwork?.cover, artwork?.header, ...coverAlternatives(), artwork?.hero] : [artwork?.hero];
      const next = alternatives.find(url => url && !tried.has(url));
      pending = false;
      if (next) {
        tried.add(next);
        image.src = next;
      } else {
        image.hidden = true;
        image.removeEventListener('error', fail);
      }
    };
    image.addEventListener('error', fail);
    if (image.complete && !image.naturalWidth) fail();
  });
}

function steamPanel() {
  const active = connected();
  const last = state.steam ? 'Последняя синхронизация · ' + new Date(state.steam.lastSync).toLocaleString('ru') :
    'Игры и время появятся после первого импорта.';
  return `<section class="panel steam-panel" aria-label="Синхронизация Steam">
    <div><div class="eyebrow"><i></i>STEAM</div>
      <h2>Библиотека Steam</h2><p>${esc(last)}</p></div>
    <div class="settings-actions">${button('steam-sync', 'Синхронизировать Steam', 'download', 'primary', syncingSteam ? 'disabled' : '')}
      ${active ? button('steam-disconnect', 'Выйти на этом устройстве', 'x', 'secondary', syncingSteam ? 'disabled' : '') : ''}</div>
    ${syncingSteam ? '<progress class="steam-progress" aria-label="Синхронизация Steam"></progress>' : ''}
    ${steamMessage ? `<p class="steam-message ${steamError ? 'form-error' : ''}" role="status">${esc(steamMessage)}</p>` : ''}
  </section>`;
}

function openSteamLogin() {
  showDialog('Подключить Steam', 'ЗАЩИЩЁННЫЙ WORKER', `<form id="steam-login-form"><div class="dialog-body single-form">
    <p>Введи пароль AFTERSAVE. Вход сохранится на этом устройстве.</p>
    ${inputField('Пароль доступа', 'password', '', 'required autofocus autocomplete="current-password" maxlength="256"', 'password')}
    ${errorLine()}</div>${formFooter('Войти и синхронизировать', 'download')}</form>`);
}

async function loginSteam(form) {
  const submit = form.querySelector('[type=submit]');
  submit.disabled = true;
  try {
    await connect(new FormData(form).get('password'), state.steam?.account);
    if (form.isConnected && dialog.open) {
      dialog.close();
      await steamSync();
    } else disconnect();
  } catch (error) { formError(form, error.message); }
  finally { submit.disabled = false; }
}

async function steamSync() {
  if (syncingSteam) return;
  if (!connected()) return openSteamLogin();
  if (storageError) return notify('Сначала восстановите библиотеку из копии.', true);
  const originalAccount = state.steam?.account;
  let succeeded = false;
  syncingSteam = true;
  steamError = false;
  steamMessage = 'Подключаемся к Worker…';
  render();
  try {
    const response = await fetchLibrary(false, originalAccount, step => {
      steamMessage = step;
      const status = app.querySelector('.steam-message');
      if (status) status.textContent = step;
    });
    if (storageError || state.steam?.account !== originalAccount) throw new Error('Библиотека изменилась во время синхронизации. Повторите попытку.');
    const result = mergeSteam(state, response);
    if (!commit(result.state)) throw new Error('Данные Steam не сохранены. Проверьте сообщение и повторите попытку.');
    succeeded = true;
    steamMessage = response.entries.length ? `Получено ${response.entries.length} игр · добавлено ${result.added} · обновлено ${result.updated}.` :
      'Steam вернул пустую библиотеку. Личные записи сохранены.';
    refreshRecentSteamAchievements();
    cloud.schedule(0);
  } catch (error) {
    steamError = true;
    steamMessage = error.message;
  } finally {
    syncingSteam = false;
    if (enableCloudAfterLogin && succeeded) {
      enableCloudAfterLogin = false;
      if (!cloud.enabled()) {
        try { cloud.toggle(); } catch { notify('Не удалось сохранить настройку облака.',true); }
      }
    }
    render();
  }
}



async function refreshSteamSummaries(repaint = true) {
  const account = state.steam?.account ?? null;
  const records = await achievementRecords(account);
  if (account !== (state.steam?.account ?? null)) return;
  summaryAccount = account;
  summaries = new Map(records.map(record => [record.appid,record]));
  if (!repaint || dialog.open) return;
  const summary = app.querySelector('#library-summary');
  if (summary) summary.outerHTML = librarySummary();
  if (['library','collections'].includes(route.page)) renderResults(true);
  if (['achievements','sessions','stats'].includes(route.page) || route.page === 'game' && route.tab === 'sessions') refreshDeskFeed();
}

async function refreshRecentSteamAchievements() {
  if (refreshingRecent) return;
  refreshingRecent = true;
  const account = state.steam?.account;
  try {
    await refreshSteamSummaries();
    if (account !== state.steam?.account || scanningAchievements || !connected()) return;
    const earliest = Date.now() - 7 * 86400000;
    const recent = games().filter(game => {
      const last = (game.steam?.lastPlayed ?? 0) * 1000;
      return !game.hidden && last >= earliest && (summaryFor(game)?.fetchedAt ?? 0) < last;
    }).sort(byLastPlayed).slice(0,5);
    for (const game of recent) {
      if (account !== state.steam?.account || scanningAchievements || !connected()) break;
      try { await fetchAchievements(account,game.steam.appid,false,true); }
      catch (error) {
        if (/ограничил запросы|Worker недоступен|Требуется вход/.test(error.message)) break;
      }
    }
    if (recent.length && account === state.steam?.account) await refreshSteamSummaries();
  } finally { refreshingRecent = false; }
}



async function scanAchievements() {
  if (scanningAchievements) return;
  if (!connected()) return openSteamLogin();
  const account = state.steam?.account;
  const linked = state.games.filter(game => game.steam).sort(byLastPlayed);
  scanningAchievements = true;
  stopAchievementScan = false;
  let checked = 0;
  let failed = 0;
  let interruption = '';
  scanMessage = 'Загружаем сводку по очереди…';
  render();
  for (const game of linked) {
    if (stopAchievementScan || state.steam?.account !== account || !(connected())) break;
    try { await fetchAchievements(account, game.steam.appid, false); }
    catch (error) {
      failed++;
      if (/ограничил запросы|Worker недоступен|Требуется вход/.test(error.message)) {
        interruption = error.message;
        break;
      }
    }
    checked++;
    scanMessage = `Проверено ${checked} из ${linked.length} · недоступно ${failed}.`;
    const status = app.querySelector('.scan-status');
    if (status) status.textContent = scanMessage;
    await new Promise(resolve => setTimeout(resolve, 1100));
  }
  scanningAchievements = false;
  scanMessage = `${interruption ? interruption + ' ' : ''}Проверено ${checked} из ${linked.length} · недоступно ${failed}.`;
  await refreshSteamSummaries();
  if (route.page === 'settings' && !dialog.open) render();
}

function updateGame(game, changes, message) {
  const next = { ...game, ...changes, updatedAt: new Date().toISOString() };
  return commit({ ...state, games: state.games.map(item => item.id === game.id ? next : item) }, message);
}

function runsPanel(game) {
  return `<section class="panel steam-section"><div class="steam-section-head"><div><div class="eyebrow"><i></i>ЛИЧНЫЙ ЖУРНАЛ</div>
    <h2>Прохождения</h2><p>${game.runs.length} записей · даты, билды и циклы NG+</p></div>${button('new-run', 'Добавить прохождение', 'plus')}</div>
    ${game.runs.length ? `<div class="runs-grid">${game.runs.map((run, index) => `<article class="run-card"><div class="steam-section-head">
      <div><small>ПРОХОЖДЕНИЕ ${index + 1}${run.cycle ? ' · ' + esc(run.cycle) : ''}</small><h3>${esc(run.title)}</h3></div>
      ${iconButton('edit-run', 'Редактировать прохождение', 'edit', `data-id="${esc(run.id)}"`)}</div>
      <p>${dateLabel(run.startedAt)} → ${dateLabel(run.finishedAt)}</p>
      ${run.build || run.difficulty ? `<p>${[run.build, run.difficulty].filter(Boolean).map(esc).join(' · ')}</p>` : ''}
      ${run.notes ? `<p class="notes">${esc(run.notes)}</p>` : ''}</article>`).join('')}</div>` : ''}</section>`;
}

function openRun(id) {
  const game = findByRoute(state.games);
  if (!game) return;
  const run = game.runs.find(item => item.id === id);
  if (id && !run) return;
  showDialog(run ? 'Редактировать прохождение' : 'Новое прохождение', 'ЛИЧНЫЙ ЖУРНАЛ', `<form id="run-form" data-id="${esc(id)}"><div class="dialog-body form-grid">
    ${inputField('Название', 'title', run?.title, 'required maxlength="120" placeholder="Например, Путь Миледи" autofocus')}
    ${inputField('Цикл', 'cycle', run?.cycle, 'maxlength="40" placeholder="Например, NG+"')}
    ${inputField('Дата начала', 'startedAt', run?.startedAt, '', 'date')}
    ${inputField('Дата завершения', 'finishedAt', run?.finishedAt, '', 'date')}
    ${inputField('Билд или персонаж', 'build', run?.build, 'maxlength="150"')}
    ${inputField('Сложность', 'difficulty', run?.difficulty, 'maxlength="80"')}
    <label class="field span-all"><span>Заметки</span><textarea name="notes" rows="4" maxlength="5000">${esc(run?.notes)}</textarea></label>
    ${run ? button('delete-run', 'Удалить прохождение', 'trash', 'danger', `data-id="${esc(run.id)}"`) : ''}${errorLine()}</div>
    ${formFooter('Сохранить')}</form>`);
}

function saveRun(form) {
  const game = findByRoute(state.games);
  if (!game) return;
  const fields = Object.fromEntries(new FormData(form));
  if (!fields.title.trim()) return formError(form, 'Введите название прохождения.');
  const id = form.dataset.id || crypto.randomUUID();
  const run = { ...game.runs.find(item => item.id === id), ...fields, id };
  const runs = form.dataset.id ? game.runs.map(item => item.id === id ? run : item) : [...game.runs, run];
  if (updateGame(game, { runs }, 'Прохождение сохранено')) {
    dialog.close();
    render();
  }
}

function deleteRun(id) {
  const game = findByRoute(state.games);
  if (!game || !game.runs.some(run => run.id === id)) return;
  confirmAction('Удалить прохождение?', 'Запись исчезнет из личного журнала.', 'Удалить', () => {
    if (!updateGame(game, { runs: game.runs.filter(run => run.id !== id) }, 'Прохождение удалено')) return false;
    render();
    return true;
  }, true);
}

function summaryFor(game) {
  return summaryAccount === state.steam?.account && game.steam ?
    summaries.get(game.steam.appid) : undefined;
}

function steamEntry() {
  if (connected()) return steamSync();
  openSteamLogin();
}

function panelHeading(glyph, title, action = '', subtitle = '') {
  return `<div class="dashboard-panel-head"><div><h2>${icon(glyph, 20)}<span>${title}</span></h2>
    ${subtitle ? `<p>${subtitle}</p>` : ''}</div>${action}</div>`;
}

function journalOrder(items) {
  return [...items].reverse().sort((a, b) => b.date.localeCompare(a.date));
}




function storyPanel(record) {
  const items = completionItems(record);
  if (!items.length) return '';
  const beaten = items.some(item => item.unlocked);
  return `<section class="desk-panel desk-story"><h2>${beaten ? 'Игра пройдена' : 'Сюжетное прохождение'}</h2>
    ${items.map(item => `<div class="desk-rare">${trophyIcon(item,item.hidden&&!item.unlocked)}<span>
      <strong>${esc(item.hidden&&!item.unlocked ? 'Скрытое сюжетное достижение' : item.name)}</strong>
      <small>${item.unlocked ? 'Получено' : 'Не получено'}</small></span></div>`).join('')}
    <p class="desk-muted">Любое из этих достижений подтверждает прохождение сюжета.</p></section>`;
}

function gameDashboard() {
  const game = findByRoute(games());
  if (!game) return `<div class="empty"><h2>Игра не найдена</h2><a class="btn btn-secondary" href="#library">К играм</a></div>`;
  if (route.ngPlus && isEldenRing(game)) return bossTracker(game);
  const url = gameHref(game);
  const summary = summaryFor(game);
  const status = steamStatus(summary);
  const achievementBox = `<section class="game-achievements" id="steam-achievements">
    ${panelHeading('trophy','Достижения')}<p class="dash-empty">${game.steam ? 'Загружаем достижения…' : 'Для этой игры нет данных Steam.'}</p></section>`;
  const content = route.tab === 'sessions' ? sessionsPage(game) : route.tab === 'notes'
    ? notesPanel(game) + (game.runs.length ? `<details class="panel saved-runs"><summary>Прохождения · ${game.runs.length}</summary>${runsPanel(game)}</details>` : '')
    : `<div class="desk-split desk-game-content">${achievementBox}<aside id="game-story">${storyPanel(summary)}</aside></div>`;
  const hero = isEldenRing(game) ? './assets/elden-ring-hero.jpg' : steamHero(game.steam?.appid);
  return `<div class="desk-game-page">
    <section class="desk-game-hero">
      ${hero ? `<img class="desk-hero-art" src="${esc(hero)}" alt="" referrerpolicy="no-referrer" ${game.steam ? `data-steam-art="${game.steam.appid}" data-art-kind="hero"` : ''}>` : ''}
      <div class="desk-game-inner">
        <div class="desk-game-crumb"><a href="#library">${icon('back',17)} Игры</a><div>
          ${iconButton('favorite',game.favorite ? 'Убрать из избранного' : 'В избранное','bookmark', `aria-pressed="${game.favorite}"`)}
          ${gameMenu(game,true)}</div></div>
        <div class="desk-game-heading">${wideCover(game,true)}
          <div class="desk-game-title"><h1>${esc(displayName(game,true))} <span id="game-trophy">${completionBadge(status)}</span></h1>
            <small>${game.steam ? icon('steam',14) + ' Steam' : esc(game.platform)}</small>
            <div class="desk-game-links">
            ${game.steam ? `<a href="https://store.steampowered.com/app/${game.steam.appid}/" target="_blank" rel="noopener">${icon('upRight',14)} Страница игры</a>
              <a href="${url}/sessions">${icon('clock',14)} Игровые сессии</a>` : ''}
            ${isEldenRing(game) ? `<a class="desk-ng-link" href="${url}/notes/ng-plus">${icon('checklist',16)} NG+</a>` : ''}
            </div>
          </div>
          <dl class="desk-game-metrics">
            <div><dt>Достижения</dt><dd id="game-achievement-count">${summary?.total ? summary.unlocked+' / '+summary.total : '—'}</dd></div>
            <div><dt>Время игры</dt><dd>${duration(game.steam?.minutes ?? Math.round(game.hours*60))}</dd></div>
            <div><dt>Последний запуск</dt><dd>${steamDate(game.steam?.lastPlayed)}</dd></div>
          </dl>
        </div>
        ${route.tab === 'sessions' || route.tab === 'notes' ? `<a class="quiet-link" href="${url}">${icon('back',15)} К достижениям</a>` : ''}
      </div>
    </section>
    <div class="desk-game-inner desk-game-body">${content}</div>
  </div>`;
}

function bossSummary(game, bosses = bossById.values()) {
  let won = 0;
  let deaths = 0;
  let total = 0;
  for (const boss of bosses) {
    total++;
    const saved = game.bossProgress[boss.id];
    if (saved?.won) won++;
    deaths += Object.values(saved?.deaths ?? {}).reduce((total, count) => total + count, 0);
  }
  return { won, deaths, total, percent: total ? Math.round(won * 1000 / total) / 10 : 0 };
}

function bossNote(game) {
  const stats = bossSummary(game);
  return `<a class="boss-note" href="#game/${encodeURIComponent(game.id)}/notes/ng-plus">
    <span class="boss-note-icon">${icon('checklist',28)}</span>
    <span><strong>${stats.won ? 'Продолжить NG+' : 'Открыть NG+'}</strong><small>${stats.won} из ${stats.total} целей</small></span>
    ${progressBar(stats.percent)}${icon('right',24)}</a>`;
}

function bossRow(game, boss) {
  const { won, deaths } = bossSummary(game, [boss]);
  const id = `data-id="${esc(boss.id)}"`;
  const type = boss.type ? `<span class="boss-type">${esc(boss.type)}</span>` : '';
  const portrait = bossArt[boss.id];
  const deathButton = (delta, label, glyph, disabled = false) => iconButton('boss-death',
    `${label}: ${esc(boss.name)}`, glyph, `${id} data-delta="${delta}" ${disabled ? 'disabled' : ''}`);
  return `<li class="boss-row${won ? ' is-defeated' : ''}">
    <button type="button" class="boss-win" data-action="boss-win" ${id} role="checkbox" aria-checked="${Boolean(won)}" aria-label="Побеждён: ${esc(boss.name)}">${won ? icon('check',23) : ''}</button>
    <div class="boss-portrait" aria-hidden="true">${icon('shield',23)}${portrait ? `<img src="${esc(portrait)}" alt="" loading="lazy" decoding="async">` : ''}</div>
    <div class="boss-row-copy">
      <strong>${boss.night ? `<span title="Появляется ночью">${icon('moon',19)}</span> ` : ''}${esc(boss.name)} ${type}</strong>
      <span>${esc(boss.location)}</span>
      ${boss.note ? `<small>${esc(boss.note)}</small>` : ''}
    </div>
    <div class="boss-row-actions">
      <div class="boss-death-stepper" role="group" aria-label="Смерти: ${esc(boss.name)}">
        ${deathButton(1, 'Добавить смерть', 'plus')}<span aria-label="${deaths} смертей">${numeric(deaths)}</span>
        ${deathButton(-1, 'Убавить смерть', 'minus', !deaths)}
      </div>
      ${button('boss-map', 'На карте', 'pin', 'secondary', `${id} aria-haspopup="dialog"`)}
    </div></li>`;
}

function bossRegionPanel(game, region, stats, defeatedOpen, celebrated) {
  const filter = region.areas.find(area => area.name === bossArea);
  const remaining = [];
  const defeated = [];
  for (const boss of filter?.bosses ?? region.bosses) {
    (game.bossProgress[boss.id]?.won ? defeated : remaining).push(boss);
  }
  const areaButton = (name, label) => `<button type="button" data-action="boss-area" data-area="${esc(name)}" aria-pressed="${bossArea === name}">${label}</button>`;
  return `<section id="boss-region-bosses" class="boss-region" aria-labelledby="boss-region-heading">
    <header class="boss-region-head"><h2 id="boss-region-heading">${esc(region.name)}</h2><span>${stats.won} из ${stats.total}</span></header>
    ${region.areas.length > 1 ? `<div class="boss-area-tabs" role="group" aria-label="Части региона">
      ${areaButton('', 'Все')}${region.areas.map(area =>
        areaButton(area.name,`<span>${esc(area.name)}</span> <small>${bossSummary(game, area.bosses).won}/${area.bosses.length}</small>`)).join('')}
    </div>` : ''}
    ${remaining.length ? `<h3 class="boss-list-heading">Осталось · ${remaining.length}</h3>
      <ul class="boss-list">${remaining.map(boss => bossRow(game, boss)).join('')}</ul>` :
      `<p class="boss-list-empty${celebrated ? ' just-cleared' : ''}">${icon('check',18)}
        ${stats.won === stats.total ? 'Регион зачищен' : 'Все боссы в этой части повержены'}</p>`}
    ${defeated.length ? `<details class="boss-defeated" ${defeatedOpen ? 'open' : ''}>
      <summary>${icon('down',17)} Поверженные · ${defeated.length}</summary>
      <ul class="boss-list">${defeated.map(boss => bossRow(game, boss)).join('')}</ul></details>` : ''}
  </section>`;
}

function showBossMap(boss, index = 0) {
  const place = boss?.maps[index];
  if (!place) return;
  const wasOpen = dialog.open;
  const path = './assets/elden-ring/maps/' + place.file;
  showDialog(esc(boss.name), 'КАРТА БОССА', `
    ${boss.maps.length > 1 ? `<div class="boss-area-tabs" role="group" aria-label="Места встречи">${boss.maps.map((item,i) =>
      `<button type="button" data-action="boss-map-place" data-id="${esc(boss.id)}" data-place="${i}" aria-pressed="${index === i}">${esc(item.label)}</button>`).join('')}</div>` : ''}
    <a class="boss-map-image" href="${esc(path)}" target="_blank" rel="noopener" aria-label="Открыть карту в полном размере">
      <img src="${esc(path)}" alt="Метка на карте: ${esc(boss.name)}" decoding="async" width="1280" height="720"></a>
    <p class="boss-map-error" role="status" hidden>Карта недоступна. Если вы офлайн, откройте её после подключения к сети.</p>
    <footer><p>${esc(place.location || boss.location)}</p><a href="https://game-checklists.com/elden-ring/all-bosses/#${esc(place.source)}" target="_blank" rel="noopener noreferrer">Game Checklists ${icon('upRight',15)}</a></footer>
  `, 'boss-map-panel');
  const image = dialog.querySelector('.boss-map-image img');
  const unavailable = () => {
    if (!image.isConnected) return;
    image.closest('a').hidden = true;
    dialog.querySelector('.boss-map-error').hidden = false;
  };
  image.addEventListener('error', unavailable, { once: true });
  if (image.complete && !image.naturalWidth) unavailable();
  if (wasOpen) dialog.querySelector(`[data-place="${index}"]`)?.focus({ preventScroll: true });
}

function bossRegionButton(region, stats, celebrated) {
  const cleared = stats.won === stats.total;
  return `<button type="button" class="boss-region-choice${cleared ? ' is-cleared' : ''}${celebrated ? ' just-cleared' : ''}"
    data-action="boss-region" data-region="${region.index}" aria-pressed="${bossRegion === region.index}" aria-controls="boss-region-bosses">
    <span><strong>${esc(region.name)}</strong>${cleared ? '<small>Зачищено</small>' : ''}</span>
    <span class="boss-region-score">${stats.won}/${stats.total}${cleared ? icon('check',16) : ''}</span>
  </button>`;
}

function bossTracker(game, { defeatedOpen = false, clearedIndex = null } = {}) {
  const stats = bossSummary(game);
  const regions = bossRegions.map(region => [region, bossSummary(game, region.bosses)]);
  const [active, activeStats] = regions[bossRegion];
  const cleared = regions.filter(([,counts]) => counts.won === counts.total).length;
  const percentLabel = numeric(stats.percent) + '%';
  return `<div id="boss-tracker">
    <header class="boss-tracker-heading">
      <nav aria-label="Путь к трекеру"><a href="#library">${icon('back',17)} Библиотека</a><span aria-hidden="true">/</span><a href="#game/${encodeURIComponent(game.id)}">Elden Ring</a></nav>
      <div><h1>NG+</h1><span>Охота на боссов</span></div>
    </header>
    <div class="boss-workspace">
      <aside class="boss-sidebar" aria-label="Прогресс и регионы">
        <section class="boss-run-summary">
          <h2>Прогресс забега</h2>
          <div class="boss-ring" style="--boss-percent:${stats.percent}%" role="img" aria-label="${percentLabel}, ${stats.won} из ${stats.total} боссов">
            <div aria-hidden="true"><strong>${percentLabel}</strong><span>${stats.won} из ${stats.total} боссов</span></div>
          </div>
          <dl class="boss-run-metrics">
            <div><dt>Зачищено регионов</dt><dd>${numeric(cleared)}</dd></div>
            <div class="boss-death-total"><dt>Смертей на боссах</dt><dd>${numeric(stats.deaths)}</dd></div>
          </dl>
        </section>
        <section class="boss-regions">
          <h2>Регионы</h2>
          <div class="boss-region-index">${regions.map(([region,counts]) => bossRegionButton(region, counts, region.index === clearedIndex)).join('')}</div>
        </section>
      </aside>
      ${bossRegionPanel(game, active, activeStats, defeatedOpen, active.index === clearedIndex)}
    </div>
  </div>`;
}

function restoreBossRegionScroll(offset) {
  const index = app.querySelector('.boss-region-index');
  if (!index || offset === undefined) return;
  index.scrollTop = offset;
}

function refreshBossTracker(control, clearedIndex = null) {
  const game = findByRoute(games());
  const current = app.querySelector('#boss-tracker');
  if (!current || !isEldenRing(game)) return;
  const offset = current.querySelector('.boss-region-index').scrollTop;
  const sameList = control.dataset.action !== 'boss-region' && control.dataset.action !== 'boss-area';
  const defeatedOpen = sameList && current.querySelector('.boss-defeated')?.open;
  current.outerHTML = bossTracker(game, { defeatedOpen, clearedIndex });
  imageFallbacks(app.querySelector('#boss-tracker'));
  restoreBossRegionScroll(offset);
  const selector = [...control.attributes].filter(attribute => attribute.name.startsWith('data-'))
    .map(attribute => `[${attribute.name}="${CSS.escape(attribute.value)}"]`).join('');
  const target = app.querySelector(`#boss-tracker ${selector}`);
  const collapsed = target?.closest('.boss-defeated:not([open])');
  const focus = collapsed ? app.querySelector('.boss-list .boss-win') ?? collapsed.querySelector('summary')
    : target?.disabled ? target.parentElement.querySelector('button:not(:disabled)') : target;
  focus?.focus({ preventScroll: true });
}

function updateBossProgress(control, delta = 0) {
  const id = control.dataset.id;
  const game = findByRoute(games());
  if (!route.ngPlus || !isEldenRing(game) || !bossById.has(id)) return;
  const saved = game.bossProgress[id] ?? { won: false, deaths: {} };
  let next = { ...saved, won: !saved.won };
  if (delta === 1) {
    const key = STORAGE_KEY + ':boss-device';
    try {
      const device = localStorage.getItem(key) || crypto.randomUUID();
      localStorage.setItem(key, device);
      next = { ...saved, deaths: { ...saved.deaths, [device]: Math.min(1000000, (saved.deaths[device] ?? 0) + 1) } };
    } catch {
      notify('Не удалось сохранить смерть на этом устройстве.', true);
      return;
    }
  } else if (delta === -1) {
    const deaths = { ...saved.deaths };
    const localDevice = localStorage.getItem(STORAGE_KEY + ':boss-device');
    const device = deaths[localDevice] ? localDevice : Object.keys(deaths)[0];
    if (!device) return;
    if (--deaths[device] === 0) delete deaths[device];
    next = { ...saved, deaths };
  }
  const region = bossRegions[bossRegion];
  const cleared = !delta && next.won && bossSummary(game, region.bosses).won === region.bosses.length - 1;
  if (updateGame(game, { bossProgress: { ...game.bossProgress, [id]: next } }, cleared ? `Регион «${region.name}» зачищен` : '')) {
    refreshBossTracker(control, cleared ? region.index : null);
  }
}

function notesPanel(game) {
  const rows = journalOrder(game.journal);
  const action = button('new-note', 'Новая заметка','plus');
  const tracker = isEldenRing(game) ? bossNote(game) : '';
  return `<section class="panel dash-panel journal-panel">${panelHeading('edit', 'Заметки', action)}
    ${tracker}
    ${rows.length ? `<ul class="journal-list">${rows.map(item=>`<li>
      <div><strong>${item.date ? dateLabel(item.date) : 'Без даты'}</strong></div>
      ${item.text ? `<p class="notes">${esc(item.text)}</p>` : ''}
      ${iconButton('edit-note', 'Редактировать заметку','edit', `data-id="${esc(item.id)}"`)}
    </li>`).join('')}</ul>` : tracker ? '' : '<p class="dash-empty">Заметок пока нет.</p>'}
  </section>`;
}

function openCollectionPicker() {
  const collection = findByRoute(collections());
  if (!collection) return;
  const source = [...games()].sort((a,b)=>displayName(a).localeCompare(displayName(b),'ru'));
  showDialog('Выбрать игру',esc(collection.name),`<form id="collection-picker"><div class="dialog-body">
    ${source.length ? `<label class="searchbox">${icon('search',20)}<input id="collection-query" type="search" placeholder="Найти игру в библиотеке" aria-label="Поиск игры" autofocus></label>
    <div class="collection-choices">${source.map(game=>`<label class="checkbox" data-title="${esc((displayName(game)+' '+game.title).toLowerCase())}">
      <input type="checkbox" name="game" value="${esc(game.id)}" ${game.collectionIds.includes(collection.id) ? 'checked' : ''}>
      <span>${esc(displayName(game))}</span>` + (game.hidden ? '<small>Скрытая</small>' : '') + '</label>').join('')}
    </div><p id="collection-no-matches" hidden>По этому запросу игр нет.</p>` : '<p>После импорта Steam здесь появятся игры библиотеки.</p>'}
    ${errorLine()}</div>${formFooter('Сохранить состав')}</form>`);
}

function filterCollectionChoices(value) {
  const query = value.trim().toLowerCase();
  const choices = [...dialog.querySelectorAll('.collection-choices [data-title]')];
  for (const choice of choices) choice.hidden = !choice.dataset.title.includes(query);
  const empty = dialog.querySelector('#collection-no-matches');
  if (empty) empty.hidden = choices.some(choice=>!choice.hidden);
}

function saveCollectionChoices(form) {
  const collection = findByRoute(collections());
  if (!collection) return;
  const selected = new Set(new FormData(form).getAll('game'));
  const next = games().map(game => {
    const included = game.collectionIds.includes(collection.id);
    if (included === selected.has(game.id)) return game;
    return {...game, collectionIds: included ? game.collectionIds.filter(id=>id!==collection.id) : [...game.collectionIds,collection.id],
      updatedAt: new Date().toISOString()};
  });
  if (commit({...state,games:next},'Коллекция сохранена')) { dialog.close(); render(); }
}

function openJournal(id) {
  const game = findByRoute(state.games);
  if (!game) return;
  const item = game.journal.find(row => row.id === id);
  if (id && !item) return;
  showDialog(id ? 'Редактировать заметку' : 'Новая заметка', 'ЛИЧНЫЙ ЖУРНАЛ',
    `<form id="journal-form" data-id="${esc(id)}"><div class="dialog-body single-form">
      <label class="field"><span>Текст заметки</span><textarea name="text" rows="5" maxlength="5000" required autofocus>${esc(item?.text)}</textarea></label>
      ${id ? button('delete-journal','Удалить запись','trash','danger',`data-id="${esc(id)}"`) : ''}
      ${errorLine()}</div>${formFooter('Сохранить')}</form>`);
}

function saveJournal(form) {
  const game = findByRoute(state.games);
  const { id } = form.dataset;
  if (!game) return;
  const fields = new FormData(form);
  const text = fields.get('text').trim();
  if (!text) return formError(form,'Введите текст заметки.');
  const existing = game.journal.find(item => item.id === id);
  if (id && !existing) return formError(form,'Запись больше недоступна.');
  const item = { id: id || crypto.randomUUID(), date: existing?.date ?? dateStamp(), text };
  const entries = existing ? game.journal.map(row => row.id === id ? item : row) : [...game.journal, item];
  if (updateGame(game, { journal: entries }, 'Запись сохранена')) { dialog.close(); render(); }
}

function deleteJournal(id) {
  const game = findByRoute(state.games);
  if (!game) return;
  confirmAction('Удалить запись?', 'Запись будет удалена из журнала игры.', 'Удалить', () => {
    if (!updateGame(game, { journal: game.journal.filter(row => row.id !== id) }, 'Запись удалена')) return false;
    render();
    return true;
  }, true);
}

let displayedAchievements;
const iconRefreshes = new Set();
async function showAchievements(force = false) {
  const game = findByRoute(games());
  if (!game?.steam) return;
  const account = state.steam?.account;
  const id = game.steam.appid;
  const box = document.querySelector('#steam-achievements');
  const view = ++achievementView;
  const cached = await cachedAchievements(account, id);
  if (view !== achievementView || route.page !== 'game' || findByRoute(games())?.steam?.appid !== id) return;
  const active = connected();
  const repairKey = account + ':' + id;
  const needsIcons = cached?.items.some(item => item.unlocked && !item.icon) && !iconRefreshes.has(repairKey);
  const fresh = cached && Date.now() - cached.fetchedAt < 24 * 60 * 60 * 1000;
  drawAchievements(box, cached, !active && !cached ? 'Подключи Steam, чтобы загрузить достижения.' : '');
  if (force && !active) return steamEntry();
  if (!active || (!force && fresh && !needsIcons) || !box) return;
  if (needsIcons) iconRefreshes.add(repairKey);
  drawAchievements(box, cached, 'Загружаем достижения…');
  try {
    const record = await fetchAchievements(account,id,false,force || needsIcons);
    if (view === achievementView) drawAchievements(box, record);
    await refreshSteamSummaries(false);
  } catch (error) {
    if (view === achievementView) drawAchievements(box, cached, error.message);
  }
}

function drawAchievements(box, record, message = '') {
  const count = document.querySelector('#game-achievement-count');
  if (count && record?.total) {
    count.textContent = record.unlocked + ' / ' + record.total;
    const badge = document.querySelector('#game-trophy');
    if (badge) badge.innerHTML = completionBadge(steamStatus(record));
  }
  const story = document.querySelector('#game-story');
  if (story) {
    story.innerHTML = storyPanel(record);
    imageFallbacks(story);
  }
  if (!box?.isConnected) return;
  displayedAchievements = record;
  const action = button('achievement-reload', connected() ? 'Обновить' : 'Подключить Steam',
    'steam', 'secondary', message === 'Загружаем достижения…' ? 'disabled' : '');
  const hasRarity = record?.items.some(item => Number.isFinite(item.percent));
  box.innerHTML = panelHeading('trophy','Достижения',action) +
    (record?.total ? `<div class="achievement-overview ${trophyFor(record) === 'platinum' ? 'cup-platinum' : ''}"><strong>${record.unlocked} / ${record.total}</strong>
      <div><span>${numeric(achievementPercent(record))}%</span>${progressBar(achievementPercent(record))}</div></div>` : '') +
    (message ? `<p class="dash-empty" role="status">${esc(message)}</p>` : '') +
    (!record?.total && !message ? `<p class="dash-empty">${record ? 'Steam сообщает, что у игры нет достижений.' : 'Данные пока недоступны.'}</p>` : '') +
    (record?.total ? `<div class="achievement-toolbar">
      <div class="achievement-states" role="group" aria-label="Статус достижения">
        ${[['','Все',record.total],['yes','Получено',record.unlocked],['no','Осталось',record.total - record.unlocked]].map(([id,label,count]) =>
          `<button type="button" data-action="achievement-state" data-value="${id}" aria-pressed="${achievementFilter === id}">${label} <span>${count}</span></button>`).join('')}
      </div><div class="achievement-filters">
      <label class="searchbox">${icon('search',17)}<input type="search" id="achievement-query" aria-label="Поиск по достижениям" placeholder="Найти достижение" value="${esc(achievementQuery)}"></label>
      <select id="achievement-sort" aria-label="Сортировка достижений">
        ${option('default','Порядок Steam',!hasRarity && achievementSort === 'rare' ? 'default' : achievementSort)}
        ${hasRarity ? option('rare','Редкие сначала',achievementSort) : ''}
        ${option('recent','Недавно полученные',achievementSort)}
      </select>
    </div></div><div class="achievement-options">${record.items.some(item => item.hidden && !item.unlocked) ?
      `<label class="checkbox"><input id="achievement-reveal" type="checkbox" ${revealHidden ? 'checked' : ''}> Показать условия скрытых достижений</label>` : ''}
      ${hasRarity ? '<p class="rarity-label">Проценты у достижений — доля игроков Steam.</p>' : ''}</div>` : '') +
    (record?.total ? '<div id="achievement-rows"></div>' : '');
  updateAchievementRows();
}

const isRare = item => Number.isFinite(item.percent) && item.percent < 10;

function updateAchievementRows(more = false) {
  const target = document.querySelector('#achievement-rows');
  if (!target || !displayedAchievements) return;
  const query = achievementQuery.trim().toLocaleLowerCase('ru');
  const items = displayedAchievements.items.filter(item => (!achievementFilter || item.unlocked === (achievementFilter === 'yes')) &&
    (!query || (item.name + ' ' + (item.hidden && !item.unlocked && !revealHidden ? '' : item.description)).toLocaleLowerCase('ru').includes(query)));
  if (achievementSort === 'rare') items.sort((a,b) => (a.percent ?? Infinity) - (b.percent ?? Infinity));
  if (achievementSort === 'recent') items.sort((a,b) => Number(b.unlocked) - Number(a.unlocked) || b.time - a.time);
  target.innerHTML = items.length ? `<ul class="achievement-list redesign-achievements">${items.slice(0, achievementLimit).map(item => {
    const concealed = item.hidden && !item.unlocked && !revealHidden;
    return `<li class="${item.unlocked ? (isRare(item) ? 'unlocked rare' : 'unlocked') : ''}">
    <span class="achievement-icon">${icon(item.unlocked ? 'trophy' : 'shield',22)}${item.icon && !concealed ? `<img src="${esc(item.icon)}" data-achievement-icon data-fallback-icon="${esc(item.fallbackIcon)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</span>
    <div><strong>${esc(item.name)}</strong>${concealed ? '<p>Скрытое условие</p>' : item.description ? `<p>${esc(item.description)}</p>` : ''}</div>
    <small>${Number.isFinite(item.percent) ? `<b>${numeric(item.percent)}%</b>` : ''}${item.unlocked ? item.time ? steamDate(item.time) : 'Получено' : 'Не получено'}</small>
  </li>`;
  }).join('')}</ul>
  ${items.length > achievementLimit ? `<div class="load-more">${button('achievement-more', 'Показать ещё · ' + (items.length - achievementLimit), 'down')}</div>` : ''}` :
    '<p class="dash-empty" role="status">Достижения по этим фильтрам не найдены.</p>';
  imageFallbacks(target);
  if (more) {
    const firstNew = target.querySelectorAll('li')[achievementLimit - 24];
    firstNew.tabIndex = -1;
    firstNew.focus();
  }
}
const cloud = createCloudSync({
  state: () => state,
  commit: next => {
    const ok = commit(next);
    if (ok && !dialog.open) render();
    return ok;
  },
  blocked: () => Boolean(storageError || dialog.open || syncingSteam),
  status: (message, conflict) => {
    cloudMessage = message;
    cloudConflict = conflict;
    if (route.page === 'settings' && !dialog.open) render();
  }
});
render();
refreshSteamSummaries();
window.addEventListener('online', () => cloud.schedule(0));
document.addEventListener('visibilitychange', () => { if (!document.hidden) cloud.schedule(0); });
cloud.schedule(0);
setInterval(() => {
  if (!document.hidden) cloud.schedule(0);
  if (state.steam && Date.now() - Date.parse(state.steam.lastSync) >= 30 * 60 * 1000 &&
      (connected()) && !document.hidden && !dialog.open && navigator.onLine) steamSync();
}, 60 * 1000);
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(new URL('./sw.js', import.meta.url)).catch(error => console.warn('AFTERSAVE offline:', error));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const offline = app.querySelector('#offline-label');
    if (offline) offline.textContent = 'Офлайн-режим готов на этом устройстве.';
  });
}

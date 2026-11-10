
import {
  STORAGE_KEY, load, save, emptyState, exportJSON, importJSON, exportCSV, isEldenRing
} from './data.js';
import { icon } from './icons.js';
import { createCloudSync } from './cloud.js';
import { bossRegions, bossById } from './elden-ring.js';
import { bossArt } from './elden-ring-art.js';
import { mergeSteam, fetchLibrary, connect, disconnect, connected, steamCover, steamHeader, steamHero, fetchSteamArtwork,
  fetchAchievements, cachedAchievements, achievementRecords, achievementIconAlternatives,
  cachedSteamProfile, fetchSteamProfile, fetchSteamFeed } from './steam.js';
import { dayNumber, calendarDate, addDaily, streaks,
  parseSteamProcessLog, sessionsWithLocalHistory } from './activity-view.js';

const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const toast = document.querySelector('#toast');
const labels = { library: 'Игры', wishlist: 'Список желаемого', achievements: 'Достижения', collections: 'Коллекции', sessions: 'Игровые сессии', stats: 'Статистика', news: 'Новости', settings: 'Настройки', game: 'Игра' };
const deskTabs = [['library','game'],['wishlist','bookmark'],['achievements','trophy'],['collections','layers'],['sessions','clock'],['stats','chart'],['news','news']];
const achievementOrders = [['common','По убыванию'],['rare','Редкие'],['recent','Недавно полученные']];
const storeFeeds = new Map();
let majorNewsOnly = false;
const filter = { query: '', status: '' };
const cups = { platinum: 'Платина', silver: 'Серебро', sapphire: 'Сапфир' };
const number = new Intl.NumberFormat('ru', { maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', year: 'numeric' });
const monthFormat = new Intl.DateTimeFormat('ru', { month:'long', year:'numeric' });
const STEAM_AUTO_SYNC_MS = 5 * 60 * 1000;
const STEAM_RECENT_PLAY_MS = 2 * 60 * 60 * 1000;
const openedAt = Date.now();
const completionMemory = new Map();
const animatedCompletions = new Set();

let state;
let storageError = '';
try { state = load(); } catch (error) { state = emptyState(); storageError = error.message; }
let steamProfile = cachedSteamProfile(state.steam?.account);
let loadingSteamProfile = false;
let librarySearchOpen = false;
let libraryHidden = false;
let achievementQuery = '';
let achievementSort = 'rare';
let collectionSort = 'games';
let revealHidden = true;
let toastTimer;
let route = getRoute();
let storagePending = false;
let syncingSteam = false;
let lastSteamAttempt = 0;
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
let achievementYear = '';
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
  return `<div class="section-heading"><div>${kicker ? `<div class="eyebrow"><i></i>${kicker}</div>` : ''}<h1>${title}</h1>
    ${description ? `<p>${description}</p>` : ''}</div>${actions ? `<div class="heading-actions">${actions}</div>` : ''}</div>`;
}

const byLastPlayed = (a,b) => (b.steam?.lastPlayed ?? 0) - (a.steam?.lastPlayed ?? 0);

function filtered(source) {
  const query = route.page === 'library' ? filter.query.trim().toLocaleLowerCase('ru') : '';
  const status = route.page === 'library' ? filter.status : '';
  return source.filter(game => {
    const haystack = [game.title, displayName(game), game.genre, game.platform, game.steam?.appid, ...game.tags].join(' ').toLocaleLowerCase('ru');
    return (!query || query.split(/\s+/).every(term => haystack.includes(term))) &&
      (!status || completionFor(game) === status);
  }).sort((a,b) => byLastPlayed(a,b) || displayName(a).localeCompare(displayName(b),'ru'));
}

function displayName(game, full = false) {
  return game.steam?.appid === 292030 ? (full ? 'Ведьмак 3: Дикая Охота' : 'Ведьмак 3') : game.title;
}

function gameCard(game) {
  const total = summaryFor(game);
  const achieved = total?.total ? achievementPercent(total) : null;
  const status = completionFor(game,total);
  const recent = recentUnlocks(total);
  const canRestore = route.page === 'library' && libraryHidden && game.hidden;
  const identity = `<div class="card-art">${cover(game)}</div>`;
  const name = esc(displayName(game));
  const results = `data-action="completion-results" data-id="${esc(game.id)}" aria-haspopup="dialog"`;
  const notice = status === 'perfect' && route.page === 'library' && !canRestore && completionNotice(total);
  if (notice?.pending) {
    const key = completionKey(total) + ':' + notice.event;
    const animate = !document.hidden && !animatedCompletions.has(key);
    if (animate) animatedCompletions.add(key);
    return `<article class="game-card desk-game perfect desk-celebration${animate ? ' desk-celebration-new' : ''}">
      <div class="card-link desk-celebration-row" aria-hidden="true">
        <div class="desk-identity">${identity}<strong>${name}</strong></div>
        <span class="desk-celebration-message">${icon('trophy',21)} Все достижения получены</span>
        <span class="desk-celebration-action">Посмотреть итоги ${icon('right',16)}</span>
      </div>
      <button type="button" class="desk-celebration-button" ${results} aria-label="${name}. Все достижения получены. Посмотреть итоги"></button>
    </article>`;
  }
  const link = `href="${gameHref(game)}" aria-label="Открыть ${name}"`;
  const perfect = status === 'perfect';
  return `<article class="game-card desk-game ${status}${canRestore ? ' desk-can-restore' : ''}">
    ${perfect ? '<div class="card-link">' : `<a class="card-link" ${link}>`}
      <div class="desk-identity">${identity}<div><h3>${perfect ?
        `<a class="desk-game-stretched" ${link}>${name}</a> <button class="desk-results-link" type="button" ${results} aria-label="Идеально. Итоги игры ${name}" title="Посмотреть итоги">${completionBadge(status)}</button>` :
        `${name} ${completionBadge(status)}`}</h3>
        ${game.steam ? '' : `<small>${esc(game.platform)}</small>`}</div></div>
      <div class="desk-progress">${achieved === null ? '—' : progressBar(achieved) + '<span>' + icon('trophy',13) + ' ' + total.unlocked + ' / ' + total.total + '</span>'}</div>
      <div class="desk-recent">${recent.length ? `<div>${recent.slice(0,5).map(item => trophyIcon(item)).join('')}${recent.length > 5 ? `<small>+${recent.length-5}</small>` : ''}</div>
        ${recent[0].time ? `<small title="Дата последнего достижения">${relativeDate(recent[0].time * 1000)}</small>` : ''}` : '—'}</div>
      <div class="desk-activity"><strong title="Общее игровое время">${icon('clock',14)} ${duration(game.steam?.minutes ?? Math.round(gameHours(game)*60))}</strong><small title="Последний запуск">${game.steam?.lastPlayed ? relativeDate(game.steam.lastPlayed*1000) : '—'}</small></div>
    ${perfect ? '</div>' : '</a>'}
    ${canRestore ? iconButton('restore-game','Вернуть в библиотеку','eye',`data-id="${esc(game.id)}"`) : ''}
  </article>`;
}

function gameList(source) {
  const result = filtered(source);
  if (!result.length) {
    const isFiltered = route.page === 'library' && Boolean(filter.query || filter.status || route.trophy || libraryHidden);
    return `<div class="empty"><span class="empty-icon">${icon(isFiltered ? 'search' : 'game', 29)}</span>
      <h2>${isFiltered ? 'Игры не найдены' : 'Здесь пока пусто'}</h2>
      <p>${isFiltered ? 'Попробуйте другой запрос или сбросьте фильтры.' :
        route.page === 'collections' ? 'Выбери игры из своей библиотеки.' : 'Подключи Steam в настройках, чтобы загрузить библиотеку.'}</p>
      ${isFiltered ? button('clear-filters', 'Сбросить фильтры', 'x') :
        route.page === 'collections' ? button('pick-collection','Выбрать игру','plus','primary') : '<a class="btn btn-primary" href="#settings">Настройки Steam</a>'}</div>`;
  }
  return `<div class="library-columns desk-columns${route.page === 'library' && libraryHidden ? ' desk-can-restore' : ''}" aria-hidden="true"><span>Игра</span><span>Прогресс</span><span>Последние достижения</span><span>Активность</span></div>
    <div class="game-grid list-view">${result.slice(0, displayLimit).map(gameCard).join('')}</div>
    ${result.length > displayLimit ? `<div class="load-more">${button('more-games', 'Показать ещё игры', 'down')}</div>` : ''}`;
}

function option(value, title, selected) {
  return `<option value="${esc(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${esc(title)}</option>`;
}

function libraryTools() {
  return `<div class="desk-library-tools">
    <div id="desk-library-search" class="desk-library-search" data-open="${librarySearchOpen}" ${librarySearchOpen ? '' : 'inert'}>
      <label class="searchbox">${icon('search',18)}<input type="search" id="global-search" placeholder="Поиск по библиотеке" aria-label="Поиск по библиотеке" value="${esc(filter.query)}"></label>
    </div>
    ${iconButton('library-search','Поиск по библиотеке','search',`aria-controls="desk-library-search" aria-expanded="${librarySearchOpen}"`)}
    <details class="desk-library-filter">
      <summary class="icon-btn" aria-label="Фильтры библиотеки" title="Фильтры библиотеки" data-active="${Boolean(filter.status || libraryHidden)}">${icon('filter',18)}</summary>
      <div class="desk-library-filter-panel" role="group" aria-label="Статус игры">
        ${[['','Все'],['perfect','Идеально'],['beaten','Пройдено']].map(([value,label]) => {
          const active = filter.status === value;
          return button('library-status',label,'check','quiet',`data-value="${value}" aria-pressed="${active}"`);
        }).join('')}
        ${!route.trophy && games().some(game => game.hidden) ? `<label class="desk-hidden-filter"><input type="checkbox" id="library-hidden" ${libraryHidden ? 'checked' : ''}> Ранее скрытые игры</label>` : ''}
      </div>
    </details>
  </div>`;
}

function sourceForPage() {
  if (route.trophy) return games().filter(game => trophyFor(summaryFor(game)) === route.trophy);
  if (route.page === 'library') return games().filter(game => game.hidden === libraryHidden);
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
    ${gameResults(sourceForPage())}
  </section>`;
}

function librarySummary() {
  const linked = games().filter(game => game.steam);
  const hours = linked.reduce((total,game) => total + game.steam.minutes, 0) / 60;
  const earned = linked.reduce((total,game) => total + (summaryFor(game)?.unlocked ?? 0), 0);
  const perfect = linked.filter(game => trophyFor(summaryFor(game)) === 'platinum').length;
  const metrics = [[numeric(linked.length),'Игр в Steam','game'],[numeric(Math.round(hours))+' ч','Время в играх','clock'],
    [numeric(earned),'Получено достижений','trophy'],[numeric(perfect),'Идеально','crown']];
  return `<dl id="library-summary" class="library-summary" aria-label="Сводка Steam">${metrics.map(([value,label,glyph]) =>
    `<div><dt>${label}</dt><dd class="desk-metric" data-glyph="${glyph}">${icon(glyph,17)}${value}</dd></div>`).join('')}</dl>`;
}




const shortDay = new Intl.DateTimeFormat('ru', { day:'2-digit', month:'2-digit', year:'numeric', timeZone:'UTC' });
const heatDate = new Intl.DateTimeFormat('ru', { weekday:'short', day:'numeric', month:'short', year:'numeric', timeZone:'UTC' });
const heatMonth = new Intl.DateTimeFormat('ru', { month:'short', timeZone:'UTC' });
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

function completionFor(game, record = summaryFor(game)) {
  return trophyFor(record) === 'platinum' ? 'perfect' : game.status === 'completed' ? 'beaten' : '';
}

function completionBadge(status) {
  return status ? `<span class="desk-badge ${status}">${icon(status === 'perfect' ? 'trophy' : 'check',13)} ${status === 'perfect' ? 'Идеально' : 'Пройдено'}</span>` : '';
}

function completionKey(record) {
  return `${STORAGE_KEY}:completion:${record.account}:${record.appid}`;
}

function completionNotice(record) {
  const key = completionKey(record);
  try { return JSON.parse(localStorage.getItem(key)) ?? completionMemory.get(key); }
  catch { return completionMemory.get(key); }
}

function saveCompletionNotice(record, notice) {
  const key = completionKey(record);
  try { localStorage.setItem(key, JSON.stringify(notice)); }
  catch { completionMemory.set(key,notice); }
}

function trackCompletion(record, previous) {
  if (trophyFor(record) !== 'platinum' || trophyFor(previous) === 'platinum') return;
  const last = recentUnlocks(record).find(item => item.time > 0);
  const fresh = record.fetchedAt >= openedAt && last && last.time * 1000 >= Date.now() - 2 * 86400000;
  if (previous ? record.unlocked <= previous.unlocked : !fresh) return;
  const event = JSON.stringify([record.total,last?.id,last?.time]);
  if (completionNotice(record)?.event !== event) saveCompletionNotice(record,{event,pending:true});
}

function trophyIcon(item) {
  return `<span class="desk-trophy-icon${item.unlocked && isRare(item) ? ' rare-achievement' : ''}" title="${esc(item.name)}">${icon('trophy',14)}
    ${item.icon ? `<img src="${esc(item.icon)}" data-achievement-icon data-fallback-icon="${esc(item.fallbackIcon)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</span>`;
}

function gameHref(game, tab = '') {
  return '#game/' + encodeURIComponent(game.id) + (tab ? '/' + tab : '');
}

function deskAccount() {
  const profile = steamProfile;
  if (!profile || profile.account !== state.steam?.account) {
    return `<a id="desk-account" class="desk-brand" href="#library">${icon('ribbon',25)} AFTERSAVE</a>`;
  }
  const { name, avatar, account, createdAt, level, xp, levelStart, remaining } = profile;
  const gained = xp !== null && levelStart !== null && xp >= levelStart ? xp-levelStart : null;
  const span = gained !== null && remaining !== null ? gained+remaining : 0;
  const joined = createdAt ? dateFormat.formatToParts(createdAt*1000)
    .filter(part => part.type === 'month' || part.type === 'year').map(part => part.value).join(' ') : '';
  return `<div id="desk-account" class="desk-account">
    <span class="desk-avatar" aria-hidden="true">
      ${icon('steam',30)}${avatar ? `<img src="${esc(avatar)}" alt="" referrerpolicy="no-referrer">` : ''}
    </span>
    <div class="desk-account-info">
      <a class="desk-persona" href="https://steamcommunity.com/profiles/${account}/" target="_blank" rel="noopener noreferrer">${esc(name)} ${icon('steam',16)}</a>
      ${level !== null || xp !== null || remaining !== null ? `<div class="desk-steam-rank">
        ${level !== null ? `<span class="desk-steam-level" aria-label="Уровень Steam ${level}" title="Уровень Steam">${level}</span>` : ''}
        ${xp !== null || remaining !== null ? `<div class="desk-xp"><div class="desk-xp-label">
          ${xp !== null ? `<span>${numeric(xp)} XP</span>` : ''}
          ${remaining !== null && level !== null ? `<span>${numeric(remaining)} XP до ${level+1}-го уровня</span>` : ''}</div>
          ${span > 0 ? `<progress aria-label="Прогресс уровня Steam" value="${gained}" max="${span}"></progress>` : ''}
        </div>` : ''}
      </div>` : ''}
      ${joined ? `<small class="desk-member-since">В Steam с ${joined} г.</small>` : ''}
    </div>
  </div>`;
}

async function refreshSteamProfile() {
  const account = state.steam?.account;
  if (!account || !connected() || loadingSteamProfile || !navigator.onLine) return;
  loadingSteamProfile = true;
  try {
    const profile = await fetchSteamProfile(account);
    if (!profile || account !== state.steam?.account || !connected()) return;
    if (JSON.stringify(profile) === JSON.stringify(steamProfile)) return;
    steamProfile = profile;
    const accountElement = app.querySelector('#desk-account');
    if (accountElement) {
      accountElement.outerHTML = deskAccount();
      imageFallbacks(app.querySelector('#desk-account'));
    }
  } catch { /* The header keeps the last available profile. */ }
  finally { loadingSteamProfile = false; }
}

function deskHeader() {
  const inLibrary = route.page === 'library';
  return `<header class="desk-header">
    <div class="desk-overview">${deskAccount()}${librarySummary()}
      <a class="desk-settings icon-btn" href="#settings" aria-label="Настройки" title="Настройки">${icon('gear',17)}</a>
    </div>
    <div class="desk-nav-row"><nav class="desk-tabs" aria-label="Разделы библиотеки">${deskTabs.map(([page,glyph]) =>
      `<a href="#${page}" aria-label="${labels[page]}" ${route.page === page ? 'aria-current="page"' : ''}>${icon(glyph,16)}<span>${labels[page]}</span></a>`).join('')}
    </nav>${inLibrary ? libraryTools() : ''}</div>
  </header>`;
}

function storeFeedPage() {
  return `<section class="desk-store-feed" aria-labelledby="store-feed-title">
    <div class="desk-store-heading"><h1 id="store-feed-title">${labels[route.page]}</h1>${route.page === 'news' ? '<span id="store-feed-checked"></span>' : ''}</div>
    ${route.page === 'news' ? `<div class="desk-news-filters" role="group" aria-label="Виды новостей">
      ${button('news-category','Все публикации','','quiet',`data-major="false" aria-pressed="${!majorNewsOnly}"`)}
      ${button('news-category','Крупные обновления','','quiet',`data-major="true" aria-pressed="${majorNewsOnly}"`)}
    </div>` : ''}
    <div id="store-feed-content"></div>
  </section>`;
}

function releaseSortDate(label = '') {
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) return Date.parse(label);
  const yearMatch = /\b[1-9]\d{3}\b/.exec(label);
  if (!yearMatch) return NaN;
  const year = Number(yearMatch[0]);
  const period = label.toLowerCase().replace(/\s+(?:г\.?|года)\s*$/u, '').replace(yearMatch[0], '').trim();
  const quarter = /(?:\bq\s*([1-4])\b|\b([1-4])\s*(?:-?й\s*)?(?:кв\.|квартал))/u.exec(period);
  if (quarter) return Date.UTC(year, Number(quarter[1] ?? quarter[2]) * 3, 0);
  const monthName = /[а-яёa-z]{3,}/u.exec(period)?.[0].slice(0,3);
  const months = monthName && /^[a-z]/.test(monthName) ?
    ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'] :
    ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  const month = months.indexOf(monthName === 'мая' ? 'май' : monthName);
  if (month >= 0) {
    const day = /\b(?:[1-9]|[12]\d|3[01])\b/.exec(period);
    return day ? Date.UTC(year,month,Number(day[0])) : Date.UTC(year,month+1,0);
  }
  return period ? NaN : Date.UTC(year,11,31);
}

function wishlistGroups(items) {
  const today = Date.parse(dateStamp());
  const released = [], upcoming = [], undated = [];
  for (const item of items) {
    if (!item.name) continue;
    const date = releaseSortDate(item.releaseDate);
    const group = !Number.isFinite(date) ? undated : date < today ? released : upcoming;
    group.push({item,date});
  }
  return [
    ['Уже вышли', released.sort((a,b) => b.date-a.date)],
    ['Предстоящие релизы', upcoming.sort((a,b) => a.date-b.date)],
    ['Дата не объявлена', undated]
  ];
}

function storeFeedContent() {
  const page = route.page;
  if (!state.steam?.account || !connected()) {
    return '<p class="dash-empty">Подключи Steam в <a href="#settings">настройках</a>.</p>';
  }
  const record = storeFeeds.get(page);
  const data = record?.account === state.steam.account ? record.data : null;
  if (!data || data.status === 'pending' || data.status === 'unavailable') {
    const message = record?.error ? record.error : data?.status === 'pending' ?
      'Первая загрузка начнётся при ближайшей проверке Steam.' : data?.status === 'unavailable' ?
      'Steam не вернул список желаемого. Возможно, он пуст или скрыт настройками приватности.' : 'Загрузка данных Steam…';
    return `<p class="dash-empty" role="status">${esc(message)}</p>`;
  }
  if (page === 'wishlist') {
    const groups = wishlistGroups(data.items);
    const shown = groups.reduce((count,[,rows]) => count + rows.length,0);
    const release = value => /^\d{4}-\d{2}-\d{2}$/.test(value) ? dateLabel(value) : value || 'Дата не объявлена';
    return (record.error ? `<p class="dash-empty" role="status">${esc(record.error)}</p>` : '') +
      groups.filter(([,rows]) => rows.length).map(([label,rows]) => `<section class="desk-wishlist-group">
        <h2>${label}</h2>
        <ul class="desk-wishlist">${rows.map(({item}) => `<li>
          ${wideCover({steam:{appid:item.appid}},true)}
          <strong>${esc(item.name)}</strong><span class="desk-wishlist-date">${esc(release(item.releaseDate))}</span>
        </li>`).join('')}</ul>
      </section>`).join('') +
      (data.status === 'updating' ? '<p class="dash-empty" role="status">Загружаем данные игр…</p>' :
        !data.items.length ? '<p class="dash-empty">Список желаемого пуст.</p>' :
          shown < data.items.length ? '<p class="dash-empty">Для некоторых игр Steam не предоставил данные магазина.</p>' : '');
  }
  const items = majorNewsOnly ? data.items.filter(item => item.major) : data.items;
  const featured = items.find(item => item.major);
  const latest = items.filter(item => item !== featured);
  return (record.error ? `<p class="dash-empty" role="status">${esc(record.error)}</p>` : '') +
    (featured ? newsCard(featured,true) : '') +
    (latest.length ? `<h2>Последние публикации</h2><ul class="desk-news-list">${latest.map(item => `<li>${newsCard(item)}</li>`).join('')}</ul>` :
      featured ? '' : `<p class="dash-empty">${data.status === 'updating' ? 'Проверяем новости по библиотеке…' :
        data.status === 'partial' && !data.items.length ? 'Steam пока не загрузил новости для всей библиотеки.' :
        majorNewsOnly ? 'Крупных обновлений пока нет.' : 'Свежих публикаций пока нет.'}</p>`);
}

function newsCard(item, featured = false) {
  const first = item.games[0];
  if (!first || !Number.isInteger(first.appid) || !/^\d{1,24}$/.test(item.gid)) return '';
  const url = `https://steamcommunity.com/games/${first.appid}/announcements/detail/${item.gid}`;
  const art = coverUrl(item.image) || (featured ? steamHero(first.appid) : steamHeader(first.appid));
  const gameNames = item.games.map(game => game.name).filter(Boolean);
  const names = gameNames.slice(0,2).join(', ') + (gameNames.length > 2 ? ` и ещё ${gameNames.length-2}` : '');
  return `<a class="desk-news-card${featured ? ' desk-news-featured' : ''}" href="${url}" target="_blank" rel="noopener noreferrer">
    <span class="desk-news-art">${icon('news',24)}<img src="${esc(art)}" alt="" loading="lazy" data-steam-art="${first.appid}" data-art-kind="${featured ? 'hero' : 'wide'}"></span>
    <span class="desk-news-copy">${item.major ? '<small class="desk-news-tag">Крупное обновление</small>' : ''}
      <strong>${esc(item.title)}</strong><small title="${esc(gameNames.join(', '))}">${esc(names || 'Steam')}</small>
      ${featured ? `<small class="desk-news-link">Читать в Steam ${icon('upRight',14)}</small>` : ''}
    </span>
    <time datetime="${new Date(item.date*1000).toISOString()}">${steamDate(item.date)}</time>${featured ? '' : icon('upRight',16)}
  </a>`;
}

function updateStoreFeed() {
  const content = app.querySelector('#store-feed-content');
  if (!content) return;
  content.innerHTML = storeFeedContent();
  imageFallbacks(content);
  const data = storeFeeds.get(route.page)?.data;
  const checked = app.querySelector('#store-feed-checked');
  if (checked) checked.textContent = data?.status === 'updating' ? 'Проверяем новости…' :
    data?.checked ? 'Проверено · ' + fullMoment.format(data.checked*1000) : '';
}

async function refreshStoreFeed() {
  const page = route.page;
  const account = state.steam?.account;
  if ((page !== 'wishlist' && page !== 'news') || !account || !connected()) return;
  let record = storeFeeds.get(page);
  if (record?.account !== account) {
    record = {account};
    storeFeeds.set(page,record);
  }
  const interval = record.data?.status === 'ready' ? 15 : 5;
  if (record.loading || Date.now() - (record.attempted ?? 0) < interval*60000) return;
  if (!navigator.onLine) {
    record.error = 'Нет соединения со Steam.';
    updateStoreFeed();
    return;
  }
  record.loading = true;
  record.attempted = Date.now();
  try {
    const data = await fetchSteamFeed(page);
    if (data?.account !== account || !Array.isArray(data.items)) throw new Error('Steam вернул некорректные данные.');
    record.data = data;
    record.error = '';
  } catch (error) {
    record.error = /\(404\)/.test(error.message) ? 'Раздел станет доступен после обновления Cloudflare Worker.' : error.message;
  } finally {
    record.loading = false;
    if (route.page === page && state.steam?.account === account) updateStoreFeed();
  }
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

function heatmap(days, today, firstKnown, count, unlocks) {
  const thresholds = unlocks ? [60,120,240] : [2,5,12];
  const start = today-count+1;
  const offset = (calendarDate(start).getUTCDay()+6)%7;
  const weeks = Math.ceil((count+offset)/7);
  const months = [];
  const cells = Array.from({length:count},(_,i) => {
    const day = start+i, amount = days.get(day) ?? 0;
    const calendar = calendarDate(day);
    const column = Math.floor((i+offset)/7)+1;
    const row = (i+offset)%7+1;
    if ((i === 0 || calendar.getUTCDate() === 1) && column <= weeks-1 && (months.at(-1)?.column ?? -2) <= column-3) {
      months.push({column,label:heatMonth.format(calendar)});
    }
    const level = day < firstKnown ? 'unknown' : amount > 0 ? 1 + thresholds.filter(min => amount >= min).length : 0;
    const date = heatDate.format(calendar);
    const time = unlocks ? (day < firstKnown ? 'Время неизвестно' : amount > 0 && amount < .5 ? 'Меньше минуты' : duration(Math.round(amount))) : '';
    const earned = numeric(unlocks ? unlocks.get(day) ?? 0 : amount);
    return `<button type="button" class="heat-${level}" style="grid-column:${column};grid-row:${row}" tabindex="${day === today ? 0 : -1}"
      data-heat-day="${day}" data-date="${esc(date)}" data-time="${esc(time)}" data-earned="${earned}"
      aria-label="${esc([date,time,`Достижений: ${earned}`].filter(Boolean).join(' · '))}"></button>`;
  });
  return `<div class="desk-heat-scroll"><div class="desk-heat-chart" style="--weeks:${weeks}">
    <div class="desk-heat-months" aria-hidden="true">${months.map(({column,label}) => `<span style="grid-column:${column}">${label}</span>`).join('')}</div>
    <div class="desk-heat-weekdays" aria-hidden="true"><span>Пн</span><span>Ср</span><span>Пт</span><span>Вс</span></div>
    <div class="desk-heatmap" role="group" aria-label="Дни активности">${cells.join('')}</div>
    <div class="desk-heat-tooltip" aria-hidden="true" hidden><strong></strong><div>
      ${unlocks ? `<span class="desk-icon-text">${icon('clock',14)}<span data-heat-time></span></span>` : ''}
      <span class="desk-icon-text">${icon('trophy',14)}<span data-heat-earned></span></span>
    </div></div></div></div>`;
}

function streakPanel(days, today, firstKnown, total, unlocks) {
  const series = streaks(days,today);
  return `<section class="desk-panel desk-streak"><div><small>Текущая серия</small><strong class="desk-metric" data-glyph="flame">${icon('flame',17)}${series.current} дн.</strong></div>
    <div class="desk-week">${Array.from({length:7},(_,i) => {
      const day = today - 6 + i;
      return `<span class="${days.has(day) ? 'active' : ''}" title="${shortDay.format(calendarDate(day))}">${calendarDate(day).getUTCDate()}</span>`;
    }).join('')}</div></section>
    <section class="desk-panel desk-year"><h2 class="desk-heading">${icon('calendar',18)}За последний год</h2><div class="desk-year-values">
      ${unlocks ? '' : `<div><small>Самая длинная серия</small><strong class="desk-metric" data-glyph="flame">${icon('flame',16)}${series.best} дн.</strong></div>`}
      <div>${unlocks ? '<small title="Сумма записанных сессий за последние 365 дней">Время по сессиям</small>' : '<small>Получено достижений</small>'}<strong class="desk-metric">${icon(unlocks ? 'clock' : 'trophy',16)}${total}</strong></div>
    </div>${heatmap(days,today,firstKnown,147,unlocks)}
    ${button('desk-heat-year','Открыть годовую карту','calendar','quiet')}</section>`;
}

function feedMore(count) {
  return count > feedLimit ? `<div class="load-more">${button('desk-feed-more','Показать ещё','down')}</div>` : '';
}

function achievementDays(entries) {
  const days = new Map();
  for (const {item} of entries) if (item.unlocked && item.time) addDaily(days,dayNumber(item.time*1000),1);
  return days;
}

function achievementsPage() {
  const entries = achievementEntries();
  const earned = entries.filter(({item}) => item.unlocked && item.time).sort((a,b) => b.item.time - a.item.time);
  const locked = entries.filter(({item}) => !item.unlocked);
  const years = [...new Set(earned.map(({item}) => new Date(item.time*1000).getFullYear()))];
  const visible = lockedFeed ? locked : achievementYear ? earned.filter(({item}) => String(new Date(item.time*1000).getFullYear()) === achievementYear) : earned;
  const days = achievementDays(earned), today = dayNumber(Date.now());
  const year = [...days].reduce((total,[day,n]) => total + (day >= today-364 && day <= today ? n : 0),0);
  return `<div id="desk-feed" class="desk-split"><div>
    <div class="desk-feed-head"><h1 class="desk-heading">${icon(lockedFeed ? 'lock' : 'trophy',20)}${lockedFeed ? 'Заблокированные достижения' : 'Последние достижения'}</h1><div class="desk-feed-actions">
      ${lockedFeed ? button('desk-locked','К полученным','back','quiet') : years.length ? `<select id="desk-unlock-year" aria-label="Год получения">
      ${option('','Все годы',achievementYear)}${years.map(year => option(year,year,achievementYear)).join('')}</select>` : ''}
    </div></div>
    ${visible.length ? visible.slice(0,feedLimit).map(({game,item}) => `<article class="desk-panel desk-unlock">
      <div>${trophyIcon(item)}<div><strong>${esc(item.name)}</strong>
      ${item.description || item.hidden ? `<p>${esc(item.description || 'Steam не предоставил условие')}</p>` : ''}
      ${Number.isFinite(item.percent) ? `<small class="desk-icon-text">${icon('user',14)}${numeric(item.percent)}% игроков Steam</small>` : ''}</div></div>
      <footer><a href="${gameHref(game,'achievements')}">${icon('steam',14)} ${esc(displayName(game))}</a>
      ${item.time ? `<time class="desk-icon-text">${icon('calendar',14)}${fullMoment.format(item.time*1000)}</time>` : ''}</footer></article>`).join('') :
      `<p class="desk-panel desk-muted">${lockedFeed ? 'Нет заблокированных достижений в загруженных данных.' : 'Пока нет загруженных достижений с датой. Обнови достижения Steam в настройках.'}</p>`}
    ${feedMore(visible.length)}
  </div><aside>${streakPanel(days,today,-Infinity,numeric(year))}
    ${lockedFeed ? '' : `<section class="desk-panel"><h2 class="desk-heading">${icon('checklist',18)}Что дальше</h2>
    ${button('desk-locked','Заблокированные · ' + numeric(locked.length),'lock','quiet')}</section>`}
  </aside></div>`;
}


function sessionContext(game) {
  const linked = new Map((game ? [game] : games().filter(item => !item.hidden)).filter(item => item.steam).map(item => [item.steam.appid,item]));
  const activity = state.steam?.activity;
  const events = sessionsWithLocalHistory(activity?.windows,state.steam?.localSessions,linked);
  const launches = [...linked.values()].filter(item => item.steam.lastPlayed).sort(byLastPlayed);
  const unlocks = new Map();
  const dailyUnlocks = new Map();
  for (const {item,game:owner} of achievementEntries(game)) {
    if (!item.unlocked || !item.time || !linked.has(owner.steam?.appid)) continue;
    const day = dayNumber(item.time*1000);
    addDaily(dailyUnlocks,day,1);
    const key = owner.steam.appid + ':' + day;
    const items = unlocks.get(key) ?? [];
    items.push(item);
    unlocks.set(key,items);
  }
  return { events, launches, unlocks, dailyUnlocks };
}

function sessionRows({events,launches,unlocks}, limit, modal = false) {
  if (!events.length) return `<p class="desk-panel desk-muted">${launches.length ? 'Steam передал дату последнего запуска. Длительность сессии пока неизвестна.' :
    modal ? 'Пока нет данных о запусках этой игры.' : 'Пока нет данных об игровых сессиях.'}</p>
    ${launches.slice(0,limit).map(item => `<article class="desk-panel desk-session"><div>${cover(item)}<a href="${gameHref(item)}">${esc(displayName(item))}</a>
    <time class="desk-icon-text">${icon('calendar',14)}${steamDate(item.steam.lastPlayed)}</time></div></article>`).join('')}`;
  return events.slice(0,limit).map(({game,minutes,day,estimated,uncertain}) => {
    const earned = unlocks.get(game.steam.appid+':'+day) ?? [];
    const date = shortDay.format(calendarDate(day));
    const rounded = Math.round(minutes);
    const label = rounded ? duration(rounded) : 'меньше минуты';
    const approximate = estimated || uncertain;
    return `<article class="desk-panel desk-session"><div>${cover(game)}<p>Играл <strong${approximate ? ' title="Прирост игрового времени в Steam между проверками"' : ''}>${label}</strong>
      ${modal ? '' : ` в <a href="${gameHref(game)}">${esc(displayName(game))}</a>`}
      ${earned.length ? `<small class="desk-icon-text">${icon('trophy',14)}Достижений за день · ${earned.length}</small>` : ''}</p><time class="desk-icon-text">${icon('calendar',14)}${date}</time></div>
      ${earned.length ? `<footer>${earned.slice(0,modal ? 12 : 6).map(item => trophyIcon(item)).join('')}${earned.length > (modal ? 12 : 6) ? `<small>ещё ${earned.length-(modal ? 12 : 6)}</small>` : ''}</footer>` : ''}</article>`;
  }).join('');
}

function openGameSessions(game, control, limit = 15) {
  if (!game?.steam) return;
  const context = sessionContext(game);
  control?.focus({preventScroll:true});
  const content = `<div class="dialog-body desk-session-modal">
    ${sessionRows(context,limit,true)}
    ${context.events.length > limit ? button('desk-game-sessions-more','Показать ещё','down','quiet',`data-limit="${limit+15}"`) : ''}
  </div>`;
  if (dialog.open && dialog.matches('.desk-sessions-dialog')) {
    const current = dialog.querySelector('.desk-session-modal');
    const scroll = current.scrollTop;
    current.outerHTML = content;
    const panel = dialog.querySelector('.desk-session-modal');
    panel.scrollTop = scroll;
    (panel.querySelector('[data-action="desk-game-sessions-more"]') ?? dialog.querySelector('[data-action="close-dialog"]')).focus({preventScroll:true});
  } else {
    showDialog('Игровые сессии',esc(displayName(game,true)),content,'desk-sessions-dialog');
  }
  imageFallbacks(dialog);
}

function sessionYear(events, today) {
  const activity = state.steam?.activity;
  const days = new Map();
  for (const event of events) if (event.day >= today-364 && event.day <= today) addDaily(days,event.day,event.minutes);
  const observed = activity?.startedAt ? Math.max(today-89,dayNumber(activity.startedAt)) : Infinity;
  return {days,first:events.reduce((value,event) => Math.min(value,event.day),observed)};
}

function openHeatYear(control) {
  const today = dayNumber(Date.now());
  const sessions = route.page !== 'achievements';
  let days, first = -Infinity, unlocks;
  if (sessions) {
    const {events,dailyUnlocks} = sessionContext(route.page === 'game' ? findByRoute(games()) : undefined);
    ({days,first} = sessionYear(events,today));
    unlocks = dailyUnlocks;
  } else days = achievementDays(achievementEntries());
  const start = calendarDate(today-364), end = calendarDate(today);
  control.focus({preventScroll:true});
  showDialog(sessions ? 'Игровая активность' : 'История достижений',
    `${shortDay.format(start)} — ${shortDay.format(end)}`,`<div class="dialog-body">${heatmap(days,today,first,365,unlocks)}</div>`,
    'desk-heat-dialog');
  const scroll = dialog.querySelector('.desk-heat-scroll');
  scroll.scrollLeft = scroll.scrollWidth;
}

function sessionsPage(game) {
  const context = sessionContext(game);
  const {events,launches,dailyUnlocks} = context;
  const today = dayNumber(Date.now()), {days,first} = sessionYear(events,today);
  const dailyMinutes = [...days.values()].reduce((sum,minutes) => sum+minutes,0);
  return `<div id="desk-feed" class="desk-split"><div>
    <div class="desk-feed-head"><h1 class="desk-heading">${icon('clock',20)}Игровые сессии</h1><div class="desk-feed-actions">
      ${button('steam-sync','Обновить','download','quiet',syncingSteam ? 'disabled' : '')}
    </div></div>
    ${steamMessage && (syncingSteam || steamError) ? `<p class="steam-message desk-muted" role="status">${esc(steamMessage)}</p>` : ''}
    ${sessionRows(context,feedLimit)}${feedMore(events.length || launches.length)}
  </div><aside>${streakPanel(days,today,first,duration(Math.round(dailyMinutes)),dailyUnlocks)}</aside></div>`;
}

async function importSteamLog(file) {
  const account = state.steam?.account;
  if (!account) return;
  if (file.size > 20 * 1024 * 1024) return notify('Журнал Steam превышает 20 МБ.',true);
  try {
    const sessions = parseSteamProcessLog(await file.text());
    if (!sessions.length) return notify('Не найдены завершённые сессии. Выбери gameprocess_log.txt.',true);
    if (account !== state.steam?.account) return;
    const old = state.steam.localSessions ?? [];
    const unique = new Map([...old,...sessions].map(item => [[item.appid,item.startedAt,item.endedAt].join(':'),item]));
    const localSessions = [...unique.values()].sort((a,b)=>b.endedAt-a.endedAt).slice(0,10000);
    const library = new Set(state.games.map(game => game.steam?.appid));
    const matched = localSessions.filter(item => library.has(item.appid)).length;
    commit({...state,steam:{...state.steam,localSessions}}, `Сессий из журнала по играм библиотеки · ${numeric(matched)}`);
  } catch (error) { notify(error.message || 'Не удалось прочитать журнал Steam.',true); }
}

function statsPage() {
  const linked = games().filter(game => game.steam && !game.hidden);
  const known = linked.map(game => summaryFor(game)).filter(record => record?.total);
  const perfect = known.filter(record => trophyFor(record) === 'platinum').length;
  const beaten = linked.filter(game => completionFor(game) === 'beaten').length;
  const other = Math.max(0, linked.length-perfect-beaten);
  const totals = collectionTotals(linked);
  const earned = achievementEntries().filter(({item}) => item.unlocked);
  const rare = earned.filter(({item}) => Number.isFinite(item.percent)).sort((a,b) => a.item.percent - b.item.percent).slice(0,5);
  const months = new Map(), days = new Map();
  for (const {item} of earned) if (item.time) {
    const date = new Date(item.time*1000);
    addDaily(months,date.getFullYear()*12+date.getMonth(),1);
    addDaily(days,dayNumber(date),1);
  }
  const buckets = [0,0,0,0,0,0];
  for (const record of known) {
    const progress = achievementPercent(record);
    buckets[progress === 0 ? 0 : progress === 100 ? 5 : Math.min(4,Math.ceil(progress/25))]++;
  }
  const maxBucket = Math.max(1,...buckets);
  const bestDay = [...days].sort((a,b) => b[1]-a[1])[0];
  const bestMonth = [...months].sort((a,b) => b[1]-a[1])[0];
  return `<div id="desk-feed" class="desk-stat-grid">
    <section class="desk-panel"><h2 class="desk-heading">${icon('library',19)}Обзор библиотеки</h2><small>Количество игр</small><strong class="desk-stat-value">${numeric(linked.length)}</strong>
    <div class="desk-donut" style="--perfect:${perfect/Math.max(1,linked.length)*100}%;--beaten:${(perfect+beaten)/Math.max(1,linked.length)*100}%" role="img" aria-label="Распределение по прохождению"></div>
    <div class="desk-legend"><span><i></i>${perfect} Идеально</span><span><i></i>${beaten} Пройдено</span><span><i></i>${other} Без отметки</span></div></section>
    <section class="desk-panel"><h2 class="desk-heading">${icon('chart',19)}Прохождение игр</h2><small>Средний прогресс по играм с данными</small>
    <strong class="desk-stat-value">${known.length ? numeric(known.reduce((n,r) => n+achievementPercent(r),0)/known.length)+'%' : '—'}</strong>
    <div class="desk-bars">${buckets.map((n,i) => `<div><span>${n}</span><i style="--bar:${n/maxBucket*100}%"></i><small>${['0%','до 25%','25–50%','50–75%','75–99%','100%'][i]}</small></div>`).join('')}</div></section>
    <section class="desk-panel"><h2 class="desk-heading">${icon('gem',19)}Самые редкие достижения</h2>${rare.length ? rare.map(({game,item}) => `<a class="desk-rare" href="${gameHref(game,'achievements')}">${trophyIcon(item)}
    <span><strong>${esc(item.name)}</strong><small>${esc(displayName(game))}</small></span><b>${numeric(item.percent)}%</b></a>`).join('') : '<p class="desk-muted">Пока нет данных о редкости.</p>'}</section>
    <section class="desk-panel desk-history"><h2 class="desk-heading">${icon('trend',19)}Общий прогресс достижений</h2><div class="desk-year-values">
    ${[[numeric(totals.unlocked),'Получено','trophy'],[numeric(totals.total-totals.unlocked),'Заблокировано','lock'],
      [bestDay ? numeric(bestDay[1]) : '—','Максимум за день','flame'],[bestMonth ? numeric(bestMonth[1]) : '—','Максимум за месяц','calendar']].map(([value,label,glyph]) =>
      `<div><small>${label}</small><strong class="desk-metric" data-glyph="${glyph}">${icon(glyph,16)}${value}</strong></div>`).join('')}</div>
    <small>Данные по ${known.length} из ${linked.length} игр</small>
    ${achievementTimeline(months)}</section>
    <section class="desk-panel"><h2 class="desk-heading">${icon('clock',19)}Больше всего времени</h2>${[...linked].sort((a,b)=>b.steam.minutes-a.steam.minutes).slice(0,5).map(game =>
      `<a class="desk-rare" href="${gameHref(game)}">${cover(game)}<strong>${esc(displayName(game))}</strong><b>${duration(game.steam.minutes)}</b></a>`).join('')}</section>
  </div>`;
}

function achievementTimeline(months) {
  const now = new Date();
  const last = now.getFullYear()*12+now.getMonth();
  const keys = [...months.keys()].filter(month => month >= 2003*12 && month <= last);
  if (!keys.length) return '<p class="desk-muted">Достижения с датами пока не загружены.</p>';
  const first = Math.min(...keys), length = last-first+1;
  const total = keys.reduce((sum,key) => sum+months.get(key),0);
  let cumulative = 0;
  const points = Array.from({length},(_,index) => {
    const month = first+index, count = months.get(month) ?? 0;
    cumulative += count;
    const x = (length === 1 ? 300 : index/(length-1)*600).toFixed(2);
    const y = (151-cumulative/total*136).toFixed(2);
    return {x,y,count,cumulative,label:monthFormat.format(new Date(Math.floor(month/12),month%12,1))};
  });
  const firstYear = Math.floor(first/12), lastYear = Math.floor(last/12);
  const step = Math.max(1,Math.ceil((lastYear-firstYear)/6));
  const ticks = Array.from({length:lastYear-firstYear+1},(_,index) => firstYear+index)
    .filter(year => year === lastYear || (year-firstYear)%step === 0 && lastYear-year >= step);
  return `<div class="desk-timeline" data-timeline>
    <svg viewBox="0 0 600 165" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 40H600M0 78H600M0 116H600M0 153H600" stroke="#303340" stroke-dasharray="4 4"/>
      <polyline points="${length === 1 ? `0,${points[0].y} 600,${points[0].y}` : points.map(({x,y}) => x+','+y).join(' ')}" fill="none" stroke="#6875ff" stroke-width="2" vector-effect="non-scaling-stroke"/>
      ${points.map(({x,y,count,cumulative,label},index) => `<circle cx="${x}" cy="${y}" r="3.5" hidden
        data-timeline-point="${index}" data-period="${label}" data-month-count="${numeric(count)}" data-total-count="${numeric(cumulative)}"/>`).join('')}
      <line class="desk-timeline-guide" y1="10" y2="153" hidden/>
    </svg>
    <input type="range" min="0" max="${length-1}" value="${length-1}" aria-label="Месяц на графике достижений">
    <div class="desk-timeline-tooltip" hidden><strong></strong><span></span></div>
  </div><div class="desk-chart-years">${ticks.map((year,index) => {
    const x = index === 0 ? 0 : year === lastYear ? 100 : (year*12-first)/(length-1)*100;
    return `<small style="left:${x}%">${year}</small>`;
  }).join('')}</div>`;
}

function showTimelinePoint(graph, index) {
  const input = graph.querySelector('input');
  const point = graph.querySelector(`[data-timeline-point="${index}"]`);
  if (!point) return;
  const previous = graph.querySelector('[data-timeline-point]:not([hidden])');
  if (previous === point) return;
  if (previous && previous !== point) previous.setAttribute('hidden','');
  point.removeAttribute('hidden');
  const x = Number(point.getAttribute('cx'));
  const guide = graph.querySelector('line');
  guide.setAttribute('x1',x);
  guide.setAttribute('x2',x);
  guide.removeAttribute('hidden');
  const tooltip = graph.querySelector('.desk-timeline-tooltip');
  const detail = `За месяц: ${point.dataset.monthCount} · Всего: ${point.dataset.totalCount}`;
  tooltip.querySelector('strong').textContent = point.dataset.period;
  tooltip.querySelector('span').textContent = detail;
  tooltip.style.setProperty('--point-x',x/6+'%');
  tooltip.hidden = false;
  input.value = index;
  input.setAttribute('aria-valuetext',point.dataset.period+' '+detail);
}

app.addEventListener('pointermove',event => {
  const graph = event.target.closest('[data-timeline]');
  if (!graph) return;
  const bounds = graph.getBoundingClientRect();
  const max = Number(graph.querySelector('input').max);
  showTimelinePoint(graph,Math.round(percent((event.clientX-bounds.left)/bounds.width*100)/100*max));
});
app.addEventListener('input',event => {
  const graph = event.target.closest('[data-timeline]');
  if (graph) showTimelinePoint(graph,Number(event.target.value));
});
app.addEventListener('focusin',event => {
  const graph = event.target.closest('[data-timeline]');
  if (graph) showTimelinePoint(graph,Number(event.target.value));
});
function showHeatDay(event) {
  const cell = event.target.closest('[data-heat-day]');
  if (!cell) return;
  const chart = cell.closest('.desk-heat-chart');
  const tooltip = chart.querySelector('.desk-heat-tooltip');
  const time = tooltip.querySelector('[data-heat-time]');
  tooltip.querySelector('strong').textContent = cell.dataset.date;
  if (time) time.textContent = cell.dataset.time;
  tooltip.querySelector('[data-heat-earned]').textContent = cell.dataset.earned;
  tooltip.hidden = false;
  const bounds = chart.getBoundingClientRect();
  const viewport = chart.parentElement.getBoundingClientRect();
  const target = cell.getBoundingClientRect();
  const maxX = Math.min(bounds.right,viewport.right)-tooltip.offsetWidth;
  const left = Math.max(Math.max(bounds.left,viewport.left),Math.min(maxX,target.left + (target.width-tooltip.offsetWidth)/2));
  const above = target.top-tooltip.offsetHeight-5 >= bounds.top;
  tooltip.style.left = left-bounds.left+'px';
  tooltip.style.top = (above ? target.top-tooltip.offsetHeight-5 : target.bottom+5)-bounds.top+'px';
}
for (const event of ['pointerover','click','focusin']) document.addEventListener(event,showHeatDay);
document.addEventListener('pointerout',event => {
  const chart = event.target.closest('.desk-heat-chart');
  if (chart && !chart.contains(event.relatedTarget)) chart.querySelector('.desk-heat-tooltip').hidden = true;
});
document.addEventListener('keydown',event => {
  const cell = event.target.closest('[data-heat-day]');
  if (!cell) return;
  const steps = {ArrowLeft:-7,ArrowRight:7,ArrowUp:-1,ArrowDown:1};
  const step = steps[event.key];
  if (!step) return;
  event.preventDefault();
  const grid = cell.parentElement;
  const next = grid.querySelector(`[data-heat-day="${Number(cell.dataset.heatDay)+step}"]`);
  if (!next) return;
  grid.querySelector('[tabindex="0"]').tabIndex = -1;
  next.tabIndex = 0;
  next.focus();
});

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
      <div class="desk-collection-detail">${header('', esc(collection.name), '', actions)}${gameResults(source)}</div>`;
  }
  const list = collections().map(item => {
    const grouped = games().filter(game => game.collectionIds.includes(item.id));
    const totals = collectionTotals(grouped);
    return { item, grouped, ...totals, games: grouped.length, time: totals.minutes, achievements: totals.unlocked };
  }).sort((a, b) => b[collectionSort] - a[collectionSort] || a.item.name.localeCompare(b.item.name, 'ru'));
  const sorts = [['games', 'Игры', 'game'], ['time', 'Время', 'clock'], ['achievements', 'Достижения', 'trophy']];
  return `<div class="desk-collections">
    <div>${header('ПОДБОРКИ', 'Коллекции игр', 'Собирай игры по сериям, жанрам или для следующего прохождения.', button('new-collection', 'Новая коллекция', 'plus', 'primary'))}</div>
    <div class="desk-collection-results">
      ${list.length ? `<div class="desk-collection-sort" role="group" aria-label="Сортировать коллекции по убыванию">
        <span class="desk-collection-sort-heading">Сортировать по убыванию</span>
        <div class="desk-collection-sort-controls">${sorts.map(([value, label, glyph]) =>
          `<button type="button" class="desk-collection-sort-btn" data-action="collection-sort" data-value="${value}"
            aria-pressed="${collectionSort === value}" title="Сортировать по: ${label.toLocaleLowerCase('ru')}">${icon(glyph, 15)}<span>${label}</span></button>`
        ).join('')}</div></div>` : ''}
      <div class="desk-collection-list">${list.length ? list.map(({item, grouped, minutes, unlocked, total}) =>
        `<a href="#collections/${encodeURIComponent(item.id)}" class="desk-panel desk-collection">
          <h2>${esc(item.name)}</h2><div class="desk-collection-covers">${grouped.slice(0,5).map(game => cover(game)).join('')}${grouped.length > 5 ? `<span>+${grouped.length-5}</span>` : ''}</div>
          <footer><small class="desk-icon-text">${icon('game',15)}${grouped.length} игр</small><small class="desk-icon-text">${icon('clock',15)}${duration(minutes)}</small>
            ${total ? `<small class="desk-icon-text">${icon('trophy',15)}${unlocked} / ${total}</small>${progressBar(unlocked/total*100)}` : ''}</footer></a>`
      ).join('') : '<p class="desk-panel desk-muted">Здесь появятся твои коллекции и их прогресс.</p>'}</div>
    </div>
  </div>`;
}


function dateLabel(value) {
  if (!value) return '—';
  const date = new Date(value + 'T12:00:00');
  return Number.isNaN(date.valueOf()) ? '—' : dateFormat.format(date);
}

function gamePage() { return gameDashboard(); }

function wideCover(game, showFallback = false) {
  const id = game.steam?.appid;
  return id ? `<div class="cover wide-cover" style="--cover-accent:#7363a2">${showFallback ? `<span class="cover-fallback">${icon('game',24)}</span>` : ''}<img src="${esc(steamHeader(id))}" alt="" decoding="async" referrerpolicy="no-referrer" data-steam-art="${id}" data-art-kind="wide"></div>` : cover(game,'wide-cover');
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
        ${state.steam ? `<div class="settings-actions"><label class="btn btn-secondary desk-log-import">${icon('upload',16)} Импорт журнала Steam
          <input type="file" accept=".txt,text/plain" id="steam-log-file" aria-label="Импорт журнала Steam"></label></div>
          <p>Чтобы дополнить старые сессии, выбери <code>logs/gameprocess_log.txt</code> из папки Steam.</p>` : ''}
        ${scanMessage ? `<p class="scan-status" role="status">${esc(scanMessage)}</p>` : ''}</section>
    </div>`;
}

function render(focusMain = false) {
  const views = { library, wishlist:storeFeedPage, news:storeFeedPage, collections: collectionsPage, achievements: achievementsPage, sessions: sessionsPage, stats: statsPage, settings: settingsPage, game: gamePage };
  const regionOffset = app.querySelector('.boss-region-index')?.scrollTop;
  app.innerHTML = shell(views[route.page]());
  restoreBossRegionScroll(regionOffset);
  const currentTab = app.querySelector('.desk-tabs [aria-current="page"]');
  if (currentTab) {
    const nav = currentTab.parentElement;
    nav.scrollLeft = Math.max(0,currentTab.getBoundingClientRect().right - nav.getBoundingClientRect().right);
  }

  imageFallbacks(app);
  if (route.page === 'game') showAchievements();
  if (route.page === 'wishlist' || route.page === 'news') {
    updateStoreFeed();
    void refreshStoreFeed();
  }
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
  dialog.innerHTML = `<div class="dialog-head"><div>${eyebrow ? `<div class="eyebrow"><i></i>${eyebrow}</div>` : ''}<h2 id="dialog-title">${title}</h2></div>${iconButton('close-dialog', 'Закрыть', 'x')}</div>${content}`;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  dialog.querySelector('[autofocus], input:not([type=hidden]), .dialog-body button, .dialog-head button')?.focus();
}

function openCompletionResults(control) {
  const game = games().find(item => item.id === control.dataset.id);
  if (!game) return;
  const record = summaryFor(game);
  if (trophyFor(record) !== 'platinum') return;
  const unlocked = recentUnlocks(record);
  const dated = unlocked.filter(item => item.time > 0);
  const hasCompleteDates = dated.length === record.total;
  const last = hasCompleteDates ? dated[0] : null;
  const rarest = unlocked.filter(item => Number.isFinite(item.percent)).sort((a,b) => a.percent-b.percent)[0];
  const milestones = [
    ['Первое достижение', hasCompleteDates ? dated.at(-1) : null],
    ['Самое редкое', rarest],
    ['Последнее достижение', last]
  ];
  const finish = last ? last.time * 1000 : 0;
  const windows = state.steam?.activity?.windows?.filter(row => row.appid === game.steam.appid && row.observedTo <= finish);
  const local = state.steam?.localSessions?.filter(row => row.appid === game.steam.appid && row.startedAt < finish)
    .map(row => ({...row,endedAt:Math.min(row.endedAt,finish)}));
  const days = sessionsWithLocalHistory(windows,local,new Map([[game.steam.appid,game]]));
  const minutes = Math.round(days.reduce((sum,day) => sum + day.minutes,0));
  const hero = steamHero(game.steam.appid);
  const notice = completionNotice(record);
  if (notice?.pending) {
    saveCompletionNotice(record,{...notice,pending:false});
    renderResults(true);
    [...app.querySelectorAll('.desk-results-link')].find(item => item.dataset.id === game.id)?.focus({preventScroll:true});
  }
  showDialog(esc(displayName(game,true)), '', `<div class="desk-completion-body">
    <div class="desk-completion-art" aria-hidden="true">${hero ? `<img src="${esc(hero)}" alt="" referrerpolicy="no-referrer" data-steam-art="${game.steam.appid}" data-art-kind="hero">` : ''}</div>
    <div class="desk-completion-score">${icon('trophy',28)} <strong>${record.unlocked} / ${record.total}</strong></div>
    <p class="desk-completion-caption">Все достижения получены</p>
    <ol class="desk-completion-timeline">${milestones.map(([label,item]) => `<li>
      <small>${label}</small>
      ${item ? `${trophyIcon(item)}<strong>${esc(item.name)}</strong>
        ${item.time ? `<time>${steamDate(item.time)}</time>` : ''}
        ${label === 'Самое редкое' ? `<small>${numeric(item.percent)}% игроков Steam</small>` : ''}` : '<span class="desk-muted">Нет данных Steam</span>'}
    </li>`).join('')}</ol>
    ${days.length ? `<footer class="desk-completion-metrics" aria-label="Учтённые сессии до последнего достижения">
      <span>${icon('clock',16)} ${duration(minutes)} по сессиям до 100%</span>
      <span>${icon('calendar',16)} Игровых дней по журналу: ${numeric(days.length)}</span>
    </footer>` : ''}
  </div>`,'desk-completion-dialog');
  imageFallbacks(dialog);
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

function openCollectionForm(item) {
  const members = item ? games().filter(game => game.collectionIds.includes(item.id)).sort(byLastPlayed) : [];
  showDialog(item ? 'Редактировать коллекцию' : 'Новая коллекция', 'ПОДБОРКИ', `<form id="collection-form" data-id="${esc(item?.id)}">
    <div class="dialog-body single-form">${inputField('Название', 'name', item?.name, 'required maxlength="64" autofocus')}
      ${item ? `<section class="desk-collection-members" aria-labelledby="collection-members-title">
        <h3 id="collection-members-title">Игры в коллекции</h3>
        <ul class="desk-collection-member-list">${members.map(game => `<li>${cover(game)}<span>${esc(displayName(game))}</span>
          ${iconButton('remove-collection-member',`Убрать «${esc(displayName(game))}» из коллекции`,'x',`data-id="${esc(game.id)}"`)}</li>`).join('')}</ul>
        <p class="desk-muted" id="collection-members-empty" ${members.length ? 'hidden' : ''}>В коллекции пока нет игр.</p></section>
        ${button('delete-collection', 'Удалить коллекцию', 'trash', 'danger', `data-id="${esc(item.id)}"`)}` : ''}${errorLine()}</div>
    ${formFooter('Сохранить')}</form>`,'desk-collection-dialog');
  imageFallbacks(dialog);
}



function confirmAction(title, message, confirmLabel, action, danger = false) {
  showDialog(title, 'ПОДТВЕРЖДЕНИЕ', `<form id="confirm-form"><div class="dialog-body"><p>${message}</p>${errorLine()}</div>
    <div class="dialog-footer">${button('close-dialog', 'Отмена', '', 'secondary')}<button type="submit" class="btn btn-${danger ? 'danger' : 'primary'}">${confirmLabel}</button></div></form>`);
  dialog.querySelector('#confirm-form').addEventListener('submit', event => {
    event.preventDefault();
    if (action()) dialog.close();
  });
}

function clearFilters() {
  Object.assign(filter, { query: '', status: '' });
  librarySearchOpen = false;
  libraryHidden = false;
  displayLimit = 24;
}

function toggleLibrarySearch(open) {
  const panel = app.querySelector('#desk-library-search');
  const control = app.querySelector('[data-action="library-search"]');
  if (!panel || !control) return;
  librarySearchOpen = open;
  control.setAttribute('aria-expanded',String(open));
  if (!open) control.focus({preventScroll:true});
  panel.inert = !open;
  panel.dataset.open = String(open);
  const field = panel.querySelector('input');
  if (open) field.focus({preventScroll:true});
  else if (filter.query) {
    field.value = '';
    filter.query = '';
    renderResults();
  }
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
  'news-category': control => {
    majorNewsOnly = control.dataset.major === 'true';
    for (const button of control.parentElement.querySelectorAll('button')) {
      button.setAttribute('aria-pressed',String(button === control));
    }
    updateStoreFeed();
  },
  'achievement-order': control => {
    achievementSort = control.dataset.value;
    achievementLimit = 24;
    const menu = control.closest('details');
    for (const button of menu.querySelectorAll('[data-action="achievement-order"]')) {
      button.setAttribute('aria-pressed',String(button === control));
    }
    menu.open = false;
    menu.querySelector('summary').focus({preventScroll:true});
    updateAchievementRows();
  },
  'desk-feed-more': () => { feedLimit += 24; refreshDeskFeed(); },
  'desk-locked': () => { lockedFeed = !lockedFeed; feedLimit = 24; refreshDeskFeed(); },
  'desk-heat-year': openHeatYear,
  'desk-game-sessions': control => openGameSessions(findByRoute(games()),control),
  'desk-game-sessions-more': control => openGameSessions(findByRoute(games()),null,Number(control.dataset.limit)),
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
  'completion-results': openCompletionResults,
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
    if (route.page === 'library') return toggleLibrarySearch(true);
    searchPending = true;
    go('library');
  },
  'library-search': () => toggleLibrarySearch(!librarySearchOpen),
  'library-status': control => {
    filter.status = control.dataset.value;
    const menu = control.closest('details');
    const summary = menu.querySelector('summary');
    for (const item of menu.querySelectorAll('[data-action="library-status"]')) {
      item.setAttribute('aria-pressed',String(item === control));
    }
    summary.dataset.active = String(Boolean(filter.status || libraryHidden));
    menu.open = false;
    summary.focus({preventScroll:true});
    renderResults();
  },
  'pick-collection': openCollectionPicker,
  'achievement-more': () => {
    achievementLimit += 24;
    updateAchievementRows(true);
  },
  'restore-game': control => {
    const game = games().find(item => item.id === control.dataset.id && item.hidden);
    if (game && updateGame(game, { hidden: false }, 'Игра возвращена в библиотеку')) {
      if (!games().some(item => item.hidden)) libraryHidden = false;
      render();
    }
  },
  'new-note': () => openJournal(),
  'edit-note': control => openJournal(control.dataset.id),
  'delete-journal': control => deleteJournal(control.dataset.id),
  'steam-disconnect': () => { disconnect(); stopAchievementScan = true; render(); },
  'achievement-reload': control => {
    control.disabled = true;
    control.setAttribute('aria-busy','true');
    showAchievements(true);
  },
  'achievement-scan': scanAchievements,
  'achievement-stop': () => { stopAchievementScan = true; },
  'new-run': () => openRun(),
  'edit-run': control => openRun(control.dataset.id),
  'delete-run': control => deleteRun(control.dataset.id),
  'clear-filters': () => { clearFilters(); if (route.trophy) go('library'); else render(); },
  'collection-sort': control => {
    const value = control.dataset.value;
    if (!['games', 'time', 'achievements'].includes(value) || collectionSort === value) return;
    collectionSort = value;
    render();
    app.querySelector(`.desk-collection-sort-btn[data-value="${value}"]`)?.focus({ preventScroll: true });
  },
  'new-collection': () => openCollectionForm(),
  'edit-collection': control => {
    const item = state.collections.find(item => item.id === control.dataset.id);
    if (item) openCollectionForm(item);
  },
  'remove-collection-member': control => {
    const row = control.closest('li');
    const form = control.closest('form');
    const removed = document.createElement('input');
    removed.type = 'hidden';
    removed.name = 'removed';
    removed.value = control.dataset.id;
    form.append(removed);
    const focus = (row.nextElementSibling ?? row.previousElementSibling)?.querySelector('button');
    const list = row.parentElement;
    row.remove();
    form.querySelector('#collection-members-empty').hidden = list.children.length > 0;
    (focus ?? form.elements.name).focus({preventScroll:true});
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
  for (const menu of app.querySelectorAll('.desk-achievement-menu[open], .desk-library-filter[open]')) {
    if (!menu.contains(event.target)) menu.open = false;
  }
  const control = event.target.closest('[data-action]');
  const action = control?.dataset.action;
  if (Object.hasOwn(actions, action)) actions[action](control);
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || event.defaultPrevented || dialog.open) return;
  const menu = app.querySelector('.desk-achievement-menu[open], .desk-library-filter[open]');
  if (menu) {
    menu.open = false;
    menu.querySelector('summary').focus({ preventScroll: true });
  } else if (librarySearchOpen && event.target.closest('#desk-library-search,[data-action="library-search"]')) toggleLibrarySearch(false);
});

document.addEventListener('input', event => {
  if (event.target.id === 'global-search') {
    filter.query = event.target.value;
    renderResults();
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
  if (field.id === 'steam-log-file') {
    if (field.files.length) await importSteamLog(field.files[0]);
    return;
  }
  if (field.id === 'game-completed') {
    const game = findByRoute(games());
    if (!game) return;
    if (updateGame(game,{status:field.checked ? 'completed' : 'planned',shelf:true})) {
      const badge = app.querySelector('#game-trophy');
      if (badge && !badge.querySelector('.perfect')) badge.innerHTML = completionBadge(completionFor(findByRoute(games())));
    } else field.checked = game.status === 'completed';
    return;
  }
  if (field.id === 'desk-unlock-year') {
    achievementYear = field.value;
    feedLimit = 24;
    refreshDeskFeed();
    app.querySelector('#desk-unlock-year')?.focus({preventScroll:true});
  }
  if (field.id === 'achievement-state') {
    achievementFilter = field.value;
    achievementLimit = 24;
    updateAchievementRows();
  }
  if (field.id === 'achievement-reveal') {
    revealHidden = field.checked;
    updateAchievementRows();
  }
  if (field.id === 'library-hidden') {
    libraryHidden = field.checked;
    const icon = app.querySelector('.desk-library-filter summary');
    if (icon) icon.dataset.active = String(Boolean(filter.status || libraryHidden));
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


  if (form.id === 'collection-form') {
    const fields = new FormData(form);
    const name = fields.get('name').trim();
    if (!name) return formError(form, 'Введите название коллекции.');
    const id = form.dataset.id || crypto.randomUUID();
    const list = form.dataset.id ? state.collections.map(record => record.id === id ? {...record,name} : record) : [...state.collections, {id,name}];
    const removed = new Set(fields.getAll('removed'));
    const updatedAt = new Date().toISOString();
    const next = removed.size ? games().map(game => removed.has(game.id) ? setCollectionMembership(game,id,false,updatedAt) : game) : games();
    if (commit({ ...state, showDemo: false, collections: list, games:next }, 'Коллекция сохранена')) {
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
  if (route.trophy) libraryHidden = false;
  if (next.id !== previousGameId) {
    bossRegion = 0;
    bossArea = '';
  }


  displayLimit = 24;
  feedLimit = 24;
  lockedFeed = false;
  achievementYear = '';
  achievementFilter = '';
  achievementQuery = '';
  achievementLimit = 24;
  if (next.id !== previousGameId) {
    achievementSort = 'rare';
    revealHidden = true;
  }
  window.scrollTo(0, 0);
  if (dialog.open) dialog.close();
  render(!searchPending);
  if (searchPending) {
    toggleLibrarySearch(true);
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
    const kind = image.dataset.artKind;
    const tried = new Set([image.src]);
    let artwork;
    let pending = false;
    const fail = async () => {
      if (pending) return;
      pending = true;
      const portrait = steamCover(id);
      // Try a regular portrait before looking up newer, versioned Steam assets.
      if (id && artwork === undefined && (kind !== 'cover' || tried.has(portrait))) artwork = await fetchSteamArtwork(id);
      if (!image.isConnected) return;
      const alternatives = image.hasAttribute('data-achievement-icon') ?
        [image.dataset.fallbackIcon, ...achievementIconAlternatives(image.src), ...achievementIconAlternatives(image.dataset.fallbackIcon)] :
        kind === 'cover' ? [portrait, artwork?.cover, artwork?.header, steamHeader(id), artwork?.hero, steamHero(id)] :
        kind === 'wide' ? [artwork?.header, portrait, artwork?.cover] : [artwork?.hero];
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

async function steamSync({background = false} = {}) {
  if (syncingSteam) return;
  if (!connected()) return openSteamLogin();
  if (storageError) return notify('Сначала восстановите библиотеку из копии.', true);
  const originalAccount = state.steam?.account;
  let succeeded = false;
  syncingSteam = true;
  lastSteamAttempt = Date.now();
  if (!background) {
    steamError = false;
    steamMessage = 'Подключаемся к Worker…';
    render();
  }
  try {
    const response = await fetchLibrary(false, originalAccount, step => {
      if (background) return;
      steamMessage = step;
      const status = app.querySelector('.steam-message');
      if (status) status.textContent = step;
    });
    if (storageError || state.steam?.account !== originalAccount) throw new Error('Библиотека изменилась во время синхронизации. Повторите попытку.');
    const result = mergeSteam(state, response);
    if (!commit(result.state)) throw new Error('Данные Steam не сохранены. Проверьте сообщение и повторите попытку.');
    succeeded = true;
    refreshSteamProfile();
    steamError = false;
    steamMessage = response.entries.length ? '' :
      'Steam вернул пустую библиотеку. Личные записи сохранены.';
    refreshRecentSteamAchievements();
    cloud.schedule(0);
  } catch (error) {
    if (!background) {
      steamError = true;
      steamMessage = error.message;
    }
  } finally {
    syncingSteam = false;
    if (enableCloudAfterLogin && succeeded) {
      enableCloudAfterLogin = false;
      if (!cloud.enabled()) {
        try { cloud.toggle(); } catch { notify('Не удалось сохранить настройку облака.',true); }
      }
    }
    if (!background || succeeded && !dialog.open && route.page === 'settings') render();
  }
}

function maybeSyncSteam() {
  if (!state.steam || syncingSteam || storageError || !connected() || document.hidden || dialog.open || !navigator.onLine) return;
  const lastSync = Date.parse(state.steam.lastSync) || 0;
  if (Date.now() - Math.max(lastSteamAttempt,lastSync) >= STEAM_AUTO_SYNC_MS) void steamSync({background:true});
}


async function refreshSteamSummaries(repaint = true) {
  const account = state.steam?.account ?? null;
  const records = await achievementRecords(account);
  if (account !== (state.steam?.account ?? null)) return;
  for (const record of records) trackCompletion(record, summaryAccount === account ? summaries.get(record.appid) : null);
  summaryAccount = account;
  summaries = new Map(records.map(record => [record.appid,record]));
  if (!repaint || dialog.open) return;
  const summary = app.querySelector('#library-summary');
  if (summary) summary.outerHTML = librarySummary();
  if (['library','collections'].includes(route.page)) renderResults(true);
  if (['achievements','sessions','stats'].includes(route.page) || route.page === 'game' && route.tab === 'sessions') refreshDeskFeed();
  const game = route.page === 'game' ? findByRoute(games()) : null;
  if (game?.steam && displayedAchievements) {
    const box = app.querySelector('#steam-achievements');
    const record = summaryFor(game);
    const refresh = app.querySelector('[data-action="achievement-reload"]');
    if (box && !refresh?.disabled && record?.key === displayedAchievements.key &&
        record.fetchedAt > displayedAchievements.fetchedAt) drawAchievements(box,record);
  }
}

async function refreshRecentSteamAchievements() {
  if (refreshingRecent) return;
  refreshingRecent = true;
  const account = state.steam?.account;
  try {
    await refreshSteamSummaries();
    if (account !== state.steam?.account || scanningAchievements || !connected()) return;
    const now = Date.now();
    const observed = new Map();
    for (const {appid,observedTo} of state.steam?.activity?.windows ?? []) {
      observed.set(appid,Math.max(observed.get(appid) ?? 0,observedTo));
    }
    const recent = games().filter(game => game.steam && !game.hidden).map(game => ({
      game, last:Math.max(game.steam.lastPlayed * 1000,observed.get(game.steam.appid) ?? 0)
    })).filter(({game,last}) => {
      const fetchedAt = summaryFor(game)?.fetchedAt ?? 0;
      // The previous achievement request can finish just after its library poll.
      return last >= now - 7 * 86400000 && (fetchedAt < last ||
        last >= now - STEAM_RECENT_PLAY_MS && now - fetchedAt >= STEAM_AUTO_SYNC_MS - 30000);
    }).sort((a,b) => b.last-a.last).slice(0,5);
    for (const {game} of recent) {
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
    try { await fetchAchievements(account, game.steam.appid, false, true); }
    catch (error) {
      failed++;
      if (/ограничил запросы|с Cloudflare недоступна|Worker недоступен|Войди в Steam|продлить вход/i.test(error.message)) {
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




function gameDashboard() {
  const game = findByRoute(games());
  if (!game) return `<div class="empty"><h2>Игра не найдена</h2><a class="btn btn-secondary" href="#library">К играм</a></div>`;
  if (route.ngPlus && isEldenRing(game)) return bossTracker(game);
  const url = gameHref(game);
  const summary = summaryFor(game);
  const status = completionFor(game,summary);
  const achievementBox = `<section class="game-achievements" id="steam-achievements" aria-label="Достижения">
    <p class="dash-empty" role="status">${game.steam ? 'Загружаем достижения…' : 'Для этой игры нет данных Steam.'}</p></section>`;
  const content = route.tab === 'sessions' ? sessionsPage(game) : route.tab === 'notes'
    ? notesPanel(game) + (game.runs.length ? `<details class="panel saved-runs"><summary>Прохождения · ${game.runs.length}</summary>${runsPanel(game)}</details>` : '')
    : `<div class="desk-game-content">${achievementBox}</div>`;
  const hero = isEldenRing(game) ? './assets/elden-ring-hero.jpg' : steamHero(game.steam?.appid);
  return `<div class="desk-game-page">
    <section class="desk-game-hero">
      ${hero ? `<img class="desk-hero-art" src="${esc(hero)}" alt="" referrerpolicy="no-referrer" ${game.steam ? `data-steam-art="${game.steam.appid}" data-art-kind="hero"` : ''}>` : ''}
      <div class="desk-game-inner">
        <div class="desk-game-crumb"><a href="#library">${icon('back',17)} Игры</a>
          <div class="desk-game-actions">
            <label class="desk-completed" title="Игра пройдена"><input type="checkbox" id="game-completed" aria-label="Игра пройдена" ${game.status === 'completed' ? 'checked' : ''}>
              <span aria-hidden="true">${icon('check',20)}</span></label>
            ${game.steam && !['sessions','notes'].includes(route.tab) ? iconButton('achievement-reload',connected() ? 'Обновить достижения Steam' : 'Подключить Steam','cloudDownload') : ''}
          </div>
        </div>
        <div class="desk-game-heading">${wideCover(game,true)}
          <div class="desk-game-title"><h1>${esc(displayName(game,true))} <span id="game-trophy">${completionBadge(status)}</span></h1>
            <small>${game.steam ? icon('steam',14) + ' Steam' : esc(game.platform)}</small>
            <div class="desk-game-links">
            ${game.steam ? `<a href="https://store.steampowered.com/app/${game.steam.appid}/" target="_blank" rel="noopener">${icon('upRight',14)} Страница игры</a>
              <button type="button" data-action="desk-game-sessions" aria-haspopup="dialog">${icon('clock',14)} Игровые сессии</button>` : ''}
            ${isEldenRing(game) ? `<a class="desk-ng-link" href="${url}/notes/ng-plus">${icon('checklist',16)} NG+</a>` : ''}
            ${game.journal.length || game.runs.length ? `<a href="${url}/notes">${icon('edit',14)} Личный журнал</a>` : ''}
            </div>
          </div>
          <dl class="desk-game-metrics">
            <div><dt class="desk-icon-text">${icon('trophy',15)}Достижения</dt><dd id="game-achievement-count">${summary?.total ? summary.unlocked+' / '+summary.total : '—'}</dd></div>
            <div><dt class="desk-icon-text">${icon('clock',15)}Время игры</dt><dd>${duration(game.steam?.minutes ?? Math.round(game.hours*60))}</dd></div>
            <div><dt class="desk-icon-text">${icon('calendar',15)}Последний запуск</dt><dd>${steamDate(game.steam?.lastPlayed)}</dd></div>
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
    <div class="collection-choices" role="group" aria-label="Игры библиотеки">${source.map(game=>`<label class="desk-collection-choice" data-title="${esc((displayName(game)+' '+game.title).toLowerCase())}">
      ${cover(game)}<span>${esc(displayName(game))}${game.hidden ? '<small>Скрытая</small>' : ''}</span>
      <input type="checkbox" name="game" value="${esc(game.id)}" ${game.collectionIds.includes(collection.id) ? 'checked' : ''}>
      </label>`).join('')}
    </div><p id="collection-no-matches" hidden>По этому запросу игр нет.</p>` : '<p>После импорта Steam здесь появятся игры библиотеки.</p>'}
    ${errorLine()}</div>${formFooter('Сохранить состав')}</form>`,'desk-collection-dialog');
  imageFallbacks(dialog);
}

function filterCollectionChoices(value) {
  const query = value.trim().toLowerCase();
  const choices = [...dialog.querySelectorAll('.collection-choices [data-title]')];
  for (const choice of choices) choice.hidden = !choice.dataset.title.includes(query);
  const empty = dialog.querySelector('#collection-no-matches');
  if (empty) empty.hidden = choices.some(choice=>!choice.hidden);
}

function setCollectionMembership(game, id, included, updatedAt) {
  if (game.collectionIds.includes(id) === included) return game;
  const collectionIds = included ? [...game.collectionIds,id] : game.collectionIds.filter(item => item !== id);
  return {...game,collectionIds,updatedAt};
}

function saveCollectionChoices(form) {
  const collection = findByRoute(collections());
  if (!collection) return;
  const selected = new Set(new FormData(form).getAll('game'));
  const updatedAt = new Date().toISOString();
  const next = games().map(game => setCollectionMembership(game,collection.id,selected.has(game.id),updatedAt));
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
  const box = document.querySelector('#steam-achievements');
  if (!game?.steam || !box) return;
  const account = state.steam?.account;
  const id = game.steam.appid;
  const view = ++achievementView;
  const cached = await cachedAchievements(account, id);
  if (view !== achievementView || route.page !== 'game' || findByRoute(games())?.steam?.appid !== id) return;
  const active = connected();
  const repairKey = account + ':' + id;
  const needsIcons = cached?.items.some(item => item.unlocked && !item.icon) && !iconRefreshes.has(repairKey);
  const fresh = cached && Date.now() - cached.fetchedAt < 24 * 60 * 60 * 1000;
  if (!active || (!force && fresh && !needsIcons)) {
    drawAchievements(box, cached, !active && !cached ? 'Подключи Steam, чтобы загрузить достижения.' : '');
    if (force && !active) steamEntry();
    return;
  }
  if (needsIcons) iconRefreshes.add(repairKey);
  drawAchievements(box, cached, 'Загружаем достижения…',true);
  try {
    const record = await fetchAchievements(account,id,false,force || needsIcons);
    if (view === achievementView) {
      drawAchievements(box, record);
      if (force) notify('Достижения обновлены');
    }
    await refreshSteamSummaries(false);
  } catch (error) {
    if (view === achievementView) drawAchievements(box, cached, error.message);
  }
}

function drawAchievements(box, record, message = '', loading = false) {
  if (!box?.isConnected) return;
  const refresh = app.querySelector('.desk-game-actions [data-action="achievement-reload"]');
  if (refresh) {
    refresh.disabled = loading;
    refresh.setAttribute('aria-busy',String(loading));
  }
  const count = document.querySelector('#game-achievement-count');
  if (count && record) {
    count.textContent = record.total ? record.unlocked + ' / ' + record.total : '—';
    const badge = document.querySelector('#game-trophy');
    if (badge) {
      const game = findByRoute(games());
      badge.innerHTML = completionBadge(completionFor(game,record));
    }
  }
  displayedAchievements = record;
  const menuOpen = box.querySelector('.desk-achievement-menu')?.open;
  const focusedField = box.contains(document.activeElement) ? document.activeElement.id : '';
  box.innerHTML = (message ? `<p class="dash-empty" role="status">${esc(message)}</p>` : '') +
    (!record?.total && !message ? `<p class="dash-empty">${record ? 'Steam сообщает, что у игры нет достижений.' : 'Данные пока недоступны.'}</p>` : '') +
    (record?.total ? `<div class="desk-achievement-tools">
      <label class="searchbox">${icon('search',17)}<input type="search" id="achievement-query" aria-label="Поиск по достижениям" placeholder="Поиск" value="${esc(achievementQuery)}"></label>
      <div class="desk-achievement-controls">
        <label class="desk-achievement-reveal" title="Показать условия скрытых достижений"><input id="achievement-reveal" type="checkbox" ${revealHidden ? 'checked' : ''}> Показывать секретные</label>
        <select id="achievement-state" aria-label="Статус достижения">
          ${option('','Все достижения',achievementFilter)}
          ${option('yes','Получено · '+record.unlocked,achievementFilter)}
          ${option('no','Не получено · '+(record.total-record.unlocked),achievementFilter)}
        </select>
        <details class="desk-achievement-menu"${menuOpen ? ' open' : ''}>
          <summary id="achievement-order-control">${icon('filter',17)} Фильтры</summary>
          <div class="desk-library-filter-panel" role="group" aria-label="Сортировка достижений">
            ${achievementOrders.map(([value,label]) => button('achievement-order',label,'check','quiet',
              `data-value="${value}" aria-pressed="${value === achievementSort}"`)).join('')}
          </div>
        </details>
      </div>
    </div><div id="achievement-rows"></div>` : '');
  updateAchievementRows();
  if (focusedField) document.getElementById(focusedField)?.focus({preventScroll:true});
}

const isRare = item => Number.isFinite(item.percent) && item.percent < 10;

function updateAchievementRows(more = false) {
  const target = document.querySelector('#achievement-rows');
  if (!target || !displayedAchievements) return;
  const query = achievementQuery.trim().toLocaleLowerCase('ru');
  const items = displayedAchievements.items.filter(item => (!achievementFilter || item.unlocked === (achievementFilter === 'yes')) &&
    (!query || (item.name + ' ' + (item.hidden && !item.unlocked && !revealHidden ? '' : item.description)).toLocaleLowerCase('ru').includes(query)));
  if (achievementSort === 'rare' || achievementSort === 'common') {
    const direction = achievementSort === 'rare' ? 1 : -1;
    const key = item => Number.isFinite(item.percent) ? item.percent*direction : Infinity;
    items.sort((a,b) => key(a)-key(b));
  }
  if (achievementSort === 'recent') items.sort((a,b) => Number(b.unlocked) - Number(a.unlocked) || b.time - a.time);
  target.innerHTML = items.length ? `<ul class="achievement-list">${items.slice(0, achievementLimit).map(item => {
    const concealed = item.hidden && !item.unlocked && !revealHidden;
    return `<li class="${item.unlocked ? (isRare(item) ? 'unlocked rare' : 'unlocked') : ''}">
    <span class="achievement-icon">${icon(item.unlocked ? 'trophy' : 'shield',22)}${item.icon && !concealed ? `<img src="${esc(item.icon)}" data-achievement-icon data-fallback-icon="${esc(item.fallbackIcon)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</span>
    <div><strong>${esc(item.name)}</strong>${concealed ? '<p>Скрытое условие</p>' : item.description ? `<p>${esc(item.description)}</p>` : ''}
      ${Number.isFinite(item.percent) ? `<small class="desk-achievement-rarity" title="Доля игроков Steam">${icon('user',13)} ${numeric(item.percent)}%</small>` : ''}</div>
    <small class="desk-achievement-date">${item.unlocked ? `${icon('trophy',14)} Получено${item.time ? ` <time datetime="${new Date(item.time*1000).toISOString()}">${fullMoment.format(item.time*1000)}</time>` : ''}` : 'Не получено'}</small>
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
refreshSteamProfile();
window.addEventListener('online', () => { cloud.schedule(0); refreshSteamProfile(); maybeSyncSteam(); void refreshStoreFeed(); });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { cloud.schedule(0); maybeSyncSteam(); void refreshStoreFeed(); }
});
cloud.schedule(0);
setInterval(() => {
  if (!document.hidden) { cloud.schedule(0); void refreshStoreFeed(); }
}, 60 * 1000);
setInterval(maybeSyncSteam, 15 * 1000);
maybeSyncSteam();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(new URL('./sw.js', import.meta.url)).catch(error => console.warn('AFTERSAVE offline:', error));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const offline = app.querySelector('#offline-label');
    if (offline) offline.textContent = 'Офлайн-режим готов на этом устройстве.';
  });
}

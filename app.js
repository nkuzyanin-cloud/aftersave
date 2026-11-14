
import { 
  STORAGE_KEY, load, save, emptyState, exportJSON, importJSON, exportCSV, isEldenRing
} from './data.js';
import { icon } from './icons.js';
import { bossRegions, bossById } from './elden-ring.js';
import { bossArt } from './elden-ring-art.js';
import { mergeSteam, fetchLibrary, connect, disconnect, connected, steamCover, steamHeader, steamHero, fetchSteamArtwork,
  fetchAchievements, cachedAchievements, achievementRecords, achievementIconAlternatives,
  cachedSteamProfile, fetchSteamProfile, fetchSteamFeed } from './steam.js';
import { dayNumber, calendarDate, addDaily, streaks,
  parseSteamProcessLog, sessionsWithLocalHistory } from './activity-view.js';

const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const sectionDialog = document.querySelector('#section-dialog');
let libraryHash = '#library';
let sectionOpener = null;
const toast = document.querySelector('#toast');
const labels = { library: 'Игры', wishlist: 'Список желаемого', achievements: 'Достижения', collections: 'Коллекции', sessions: 'Игровые сессии', stats: 'Статистика', news: 'Новости', settings: 'Настройки', game: 'Игра' };
const sectionIcons = {wishlist:'bookmark',achievements:'trophy',collections:'layers',sessions:'clock',
  stats:'chart',news:'news',settings:'gear'};
const HOME_GAME_LIMIT = 6;
const storeFeeds = new Map();
let majorNewsOnly = false;
const filter = { query: '', status: '' };
const cups = { platinum: 'Платина', silver: 'Серебро', sapphire: 'Сапфир' };
const number = new Intl.NumberFormat('ru', { maximumFractionDigits: 2 });
const achievementPlural = new Intl.PluralRules('ru');
const dateFormat = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', year: 'numeric' });
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
let libraryHidden = false;
let achievementQuery = '';
let achievementSort = 'common';
let collectionSort = 'games';
let statsTimeMode = 'months';
let sessionPeriod = '30';
let sessionGrouping = 'days';
let revealHidden = true;
let toastTimer;
let route = getRoute();
let storagePending = false;
let appUpdateReady = false;
let syncingSteam = false;
let lastSteamAttempt = 0;
let refreshingRecent = false;
let steamMessage = '';
let steamError = false;
let displayLimit = HOME_GAME_LIMIT;
let collectionLimit = 24;
let achievementFilter = '';
let achievementLimit = 24;
let achievementView = 0;
let summaries = new Map();
let summaryAccount = null;
let feedLimit = 24;
let lockedFeed = false;
let lockedAchievementOrder = 'common';
let achievementYear = '';
let recentRevealStartedAt;
let scanningAchievements = false;
let stopAchievementScan = false;
let scanMessage = '';
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
  const target = original === 'profile' ? 'settings' : original;
  const section = Object.hasOwn(sectionIcons,target) ? target : '';
  return {page:target === 'game' ? 'game' : 'library', section, id,
    tab: ['notes', 'sessions'].includes(tab) ? tab : 'overview',
    trophy: !section && target === 'library' && id === 'cup' && Object.hasOwn(cups,tab) ? tab : '',
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
    if (message) notify(message);
    return true;
  } catch (error) {
    notify(error.message || 'Не удалось сохранить данные.', true);
    if (dialog.open) formError(dialog.querySelector('form') || dialog, error.message);
    return false;
  }
}

function updateNotice() {
  return `<div class="app-update-notice" role="status">
    <span>${icon('download',18)} Обновление AFTERSAVE готово</span>
    ${button('reload-after-update', 'Обновить', 'refresh', 'primary')}
  </div>`;
}

function shell(content, enter) {
  const workspace = route.page === 'library';
  return `<main id="main" tabindex="-1" class="page page-${route.page}${workspace ? ' desk-workspace home-page' : ''}${enter ? ' route-enter' : ''}">
    ${appUpdateReady ? updateNotice() : ''}
    ${storageError ? `<div class="alert">${icon('shield',19)}<span>${esc(storageError)}</span><a href="#settings">Восстановить данные</a></div>` : ''}
    ${workspace ? deskHeader() : ''}
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
  return `<div class="cover ${className}" style="--cover-accent:${/^#[\da-f]{6}$/i.test(game.accent ?? '') ? game.accent : '#5083a7'}">
    <span class="cover-fallback">${icon('game', 42)}</span>${url ? `<img src="${esc(url)}" alt="" decoding="async" loading="${className === 'game-poster' ? 'eager' : 'lazy'}" referrerpolicy="no-referrer" data-steam-art="${id ?? ''}" data-art-kind="cover">` : ''}</div>`;
}

function progressBar(value) {
  return `<div class="progress-track" role="progressbar" aria-label="Прогресс" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent(value)}"><span style="width:${percent(value)}%"></span></div>`;
}





const byLastPlayed = (a,b) => (b.steam?.lastPlayed ?? 0) - (a.steam?.lastPlayed ?? 0);

function filtered(source, inLibrary) {
  const query = inLibrary ? filter.query.trim().toLocaleLowerCase('ru') : '';
  const status = inLibrary ? filter.status : '';
  return source.filter(game => {
    const haystack = [game.title, displayName(game), game.genre, game.platform, game.steam?.appid, ...game.tags].join(' ').toLocaleLowerCase('ru');
    return (!query || query.split(/\s+/).every(term => haystack.includes(term))) &&
      (!status || completionFor(game) === status);
  }).sort((a,b) => byLastPlayed(a,b) || displayName(a).localeCompare(displayName(b),'ru'));
}

function displayName(game, full = false) {
  return game.steam?.appid === 292030 ? (full ? 'Ведьмак 3: Дикая Охота' : 'Ведьмак 3') : game.title;
}

function gameCard(game, inLibrary) {
  const total = summaryFor(game);
  const achieved = total?.total ? achievementPercent(total) : null;
  const status = completionFor(game,total);
  const recent = recentUnlocks(total);
  const canRestore = inLibrary && libraryHidden && game.hidden;
  const identity = `<div class="card-art">${cover(game)}</div>`;
  const name = esc(displayName(game));
  const results = `data-action="completion-results" data-id="${esc(game.id)}" aria-haspopup="dialog"`;
  const notice = status === 'perfect' && inLibrary && !canRestore && completionNotice(total);
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
      <div class="desk-progress">${achieved === null ? '<span>Нет достижений</span>' : progressBar(achieved) + '<span>' + icon('trophy',13) + ' ' + total.unlocked + ' / ' + total.total + '</span>'}</div>
      <div class="desk-recent">${recent.length ? `<div>${recent.slice(0,5).map(item => trophyIcon(item)).join('')}${recent.length > 5 ? `<small>+${recent.length-5}</small>` : ''}</div>
        ${recent[0].time ? `<small title="Дата последнего достижения">${relativeDate(recent[0].time * 1000)}</small>` : ''}` : (total?.total ? '—' : '')}</div>
      <div class="desk-activity"><strong title="Общее игровое время">${icon('clock',14)} ${duration(game.steam?.minutes ?? Math.round(gameHours(game)*60))}</strong><small title="Последний запуск">${game.steam?.lastPlayed ? relativeDate(game.steam.lastPlayed*1000) : '—'}</small></div>
    ${perfect ? '</div>' : '</a>'}
    ${canRestore ? iconButton('restore-game','Вернуть в библиотеку','eye',`data-id="${esc(game.id)}"`) : ''}
  </article>`;
}

function gameList(source, inLibrary) {
  const result = filtered(source,inLibrary);
  if (!result.length) {
    const isFiltered = inLibrary && Boolean(filter.query || filter.status || route.trophy || libraryHidden);
    return `<div class="empty"><span class="empty-icon">${icon(isFiltered ? 'search' : 'game',29)}</span>
      <h2>${isFiltered ? 'Игры не найдены' : 'Здесь пока пусто'}</h2>
      <p>${isFiltered ? 'Попробуйте другой запрос или сбросьте фильтры.' :
        inLibrary ? 'Подключи Steam в настройках, чтобы загрузить библиотеку.' : 'Выбери игры из своей библиотеки.'}</p>
      ${isFiltered ? button('clear-filters','Сбросить фильтры','x') : inLibrary ?
        '<a class="btn btn-primary" href="#settings" aria-haspopup="dialog">Настройки Steam</a>' : button('pick-collection','Выбрать игру','plus','primary')}</div>`;
  }
  const limit = inLibrary ? displayLimit : collectionLimit;
  return `<div class="library-columns desk-columns${inLibrary && libraryHidden ? ' desk-can-restore' : ''}" aria-hidden="true"><span>Игра</span><span>Прогресс</span><span>Последние достижения</span><span>Активность</span></div>
    <div class="game-grid list-view">${result.slice(0,limit).map(game => gameCard(game,inLibrary)).join('')}</div>
    ${result.length > limit ? `<div class="home-more">${button('more-games','Показать ещё','down','quiet',inLibrary ? '' : 'data-collection')}</div>` : ''}`;
}

function option(value, title, selected) {
  return `<option value="${esc(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${esc(title)}</option>`;
}

function libraryTools() {
  return `<div class="desk-library-tools">
    <label class="searchbox home-search">${icon('search',17)}<input type="search" id="global-search"
      placeholder="Поиск по библиотеке" aria-label="Поиск по библиотеке" value="${esc(filter.query)}"></label>
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

function libraryGames() {
  return route.trophy ? games().filter(game => trophyFor(summaryFor(game)) === route.trophy) :
    games().filter(game => game.hidden === libraryHidden);
}

function gameResults(source, inLibrary = true) {
  return `<div id="${inLibrary ? 'game-results' : 'collection-game-results'}">${gameList(source,inLibrary)}</div>`;
}

function homeLink(page, label) {
  return `<a class="home-action" href="#${page}" aria-haspopup="dialog">${label} ${icon('right',15)}</a>`;
}

function homePanel(page, title, action) {
  return `<section class="home-panel home-${page}" aria-labelledby="home-${page}-title">
    <header><h2 id="home-${page}-title">${icon(sectionIcons[page],20)}${title}</h2>${homeLink(page,action)}</header>
    <div class="home-panel-items" data-home-feed="${page}">${homePreview(page)}</div></section>`;
}

function homePreview(page) {
  if (page === 'achievements') {
    const recent = achievementEntries().filter(({item}) => item.unlocked && item.time > 0)
      .sort((a,b) => b.item.time-a.item.time).slice(0,3);
    return recent.map(({game,item}) => homeRow(gameHref(game,'achievements'),trophyIcon(item),
      item.name,displayName(game))).join('') || homeEmpty('Пока нет полученных достижений.');
  }
  if (page === 'sessions') {
    return sessionContext().events.slice(0,3).map(({game,minutes,day}) =>
      homeRow(gameHref(game),cover(game),displayName(game),sessionDuration(minutes),shortDay.format(calendarDate(day)))
    ).join('') || homeEmpty('Пока нет записей об игровых сессиях.');
  }
  if (page === 'collections') {
    return collectionEntries().slice(0,2).map(({item,grouped}) => {
      const posters = collectionShowcaseGames(grouped,3).map(game => cover(game)).join('');
      const count = grouped.length;
      const noun = {one:'игра',few:'игры'}[achievementPlural.select(count)] ?? 'игр';
      return homeRow('#collections/' + encodeURIComponent(item.id),
        `<span class="home-posters" aria-hidden="true">${posters || icon('layers',22)}</span>`,
        item.name,numeric(count) + ' ' + noun,'','aria-haspopup="dialog"');
    }).join('') || homeEmpty('Пока нет коллекций.');
  }
  const record = storeFeeds.get(page);
  const data = record?.account === state.steam?.account ? record?.data : null;
  if (!state.steam?.account || !connected()) return homeEmpty('Подключи Steam в настройках.');
  if (!data?.items.length) {
    if (record?.error) return homeEmpty('Не удалось загрузить данные Steam.');
    if (data?.status === 'unavailable') return homeEmpty('Steam не предоставил список желаемого.');
    if (!data || ['pending','updating'].includes(data.status)) return homeEmpty('Ожидаем данные Steam…');
    return homeEmpty(page === 'wishlist' ? 'Список желаемого пуст.' : 'Свежих публикаций пока нет.');
  }
  if (page === 'wishlist') {
    return wishlistGroups(data.items).flatMap(([,rows]) => rows).slice(0,2).map(({item}) =>
      homeRow('#wishlist',wideCover({steam:{appid:item.appid}},true),item.name,wishlistDate(item.releaseDate),'','aria-haspopup="dialog"')
    ).join('') || homeEmpty('Данные игр пока недоступны.');
  }
  return data.items.slice(0,2).map(item => {
    const url = newsUrl(item);
    if (!url) return '';
    const game = item.games[0];
    const artwork = coverUrl(item.image);
    const art = artwork ? `<span class="cover home-news-art"><img src="${esc(artwork)}" alt="" loading="lazy"></span>` :
      cover({steam:{appid:game.appid}});
    return homeRow(url,art,item.title,steamDate(item.date),'','target="_blank" rel="noopener noreferrer"');
  }).join('') || homeEmpty('Свежих публикаций пока нет.');
}

function homeRow(href, art, title, subtitle, detail = '', attrs = '') {
  return `<a class="home-row" href="${esc(href)}" ${attrs}>${art}
    <span class="home-row-copy"><strong>${esc(title)}</strong><small>${esc(subtitle)}</small></span>
    ${detail ? `<small class="home-row-detail">${esc(detail)}</small>` : ''}</a>`;
}

function homeEmpty(message) {
  return `<p class="home-empty">${esc(message)}</p>`;
}

function refreshHomePreview(page) {
  const content = app.querySelector(`[data-home-feed="${page}"]`);
  if (!content) return;
  content.innerHTML = homePreview(page);
  imageFallbacks(content);
}

function library() {
  return `<div class="home-dashboard">
    <div class="home-primary">
      <section class="library-section home-panel" aria-labelledby="home-games-title">
        <header><h1 id="home-games-title">${icon('game',22)}Игры</h1>${libraryTools()}</header>
        ${route.trophy ? `<div class="cup-filter">${trophyBadge(route.trophy)} <a class="quiet-link" href="#library">${icon('x',16)} Сбросить кубок</a></div>` : ''}
        ${gameResults(libraryGames())}
      </section>
      <aside class="home-activity" aria-label="Последняя активность">
        ${homePanel('achievements','Последние достижения','Все')}
        ${homePanel('sessions','Игровые сессии','Подробнее')}
      </aside>
    </div>
    <div class="home-secondary">
      ${homePanel('collections','Коллекции','Все коллекции')}
      ${homePanel('wishlist','Список желаемого','Весь список')}
      ${homePanel('news','Новости','Все')}
    </div>
  </div>`;
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
    return `<div id="desk-account" class="desk-account"><a class="desk-brand" href="#library">${icon('ribbon',25)} AFTERSAVE</a>
   <a class="desk-persona-settings" href="#settings" aria-label="Настройки" title="Настройки">${icon('gear',17)}</a></div>`;
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
      <div class="desk-persona"><a class="desk-persona-link" href="https://steamcommunity.com/profiles/${account}/" target="_blank" rel="noopener noreferrer">${esc(name)} ${icon('steam',16)}</a>
      <a class="desk-persona-settings" href="#settings" aria-label="Настройки" title="Настройки">${icon('gear',17)}</a></div>
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
  return `<header class="desk-header home-header">
    <div class="desk-overview">${deskAccount()}
      <div class="home-overview-metrics">${librarySummary()}${homeLink('stats','Вся статистика')}</div>
    </div>
  </header>`;
}

function storeFeedPage(page) {
  return `<section class="desk-store-feed" aria-label="${labels[page]}">
    ${page === 'news' ? `<div class="home-news-tools"><div class="desk-news-filters" role="group" aria-label="Виды новостей">
      ${button('news-category','Все публикации','','quiet',`data-major="false" aria-pressed="${!majorNewsOnly}"`)}
      ${button('news-category','Крупные обновления','','quiet',`data-major="true" aria-pressed="${majorNewsOnly}"`)}
    </div><small id="store-feed-checked"></small></div>` : ''}
    <div id="store-feed-content">${storeFeedContent(page)}</div>
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

function wishlistDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? dateLabel(value) : value || 'Дата не объявлена';
}

function storeFeedContent(page) {
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
    return (record.error ? `<p class="dash-empty" role="status">${esc(record.error)}</p>` : '') +
      groups.filter(([,rows]) => rows.length).map(([label,rows]) => `<section class="desk-wishlist-group">
        <h2>${label}</h2>
        <ul class="desk-wishlist">${rows.map(({item}) => `<li>
          ${wideCover({steam:{appid:item.appid}},true)}
          <strong>${esc(item.name)}</strong><span class="desk-wishlist-date">${esc(wishlistDate(item.releaseDate))}</span>
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

function newsUrl(item) {
  const first = item.games?.[0];
  return first && Number.isInteger(first.appid) && /^\d{1,24}$/.test(item.gid) ?
    `https://steamcommunity.com/games/${first.appid}/announcements/detail/${item.gid}` : '';
}

function newsCard(item, featured = false) {
  const url = newsUrl(item);
  if (!url) return '';
  const first = item.games[0];
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

function updateStoreFeed(page, animate = false) {
  if (route.section !== page) return;
  const content = sectionDialog.querySelector('#store-feed-content');
  if (!content) return;
  content.innerHTML = storeFeedContent(page);
  content.classList.toggle('store-enter',animate);
  imageFallbacks(content);
  const data = storeFeeds.get(page)?.data;
  const checked = sectionDialog.querySelector('#store-feed-checked');
  if (checked) checked.textContent = data?.status === 'updating' ? 'Проверяем новости…' :
    data?.checked ? 'Проверено · ' + fullMoment.format(data.checked*1000) : '';
}

async function refreshStoreFeed(page) {
  const account = state.steam?.account;
  if (!account || !connected()) return;
  let record = storeFeeds.get(page);
  if (record?.account !== account) {
    record = {account};
    storeFeeds.set(page,record);
  }
  const now = Date.now();
  const retryAt = (record.attempted ?? 0) + (record.error ? 5 : 15)*60000;
  const nextCheck = !record.error && Number.isFinite(record.data?.nextCheck)
    ? Math.max((record.attempted ?? 0)+60000,record.data.nextCheck*1000) : retryAt;
  if (record.loading || now < nextCheck || !navigator.onLine) return;
  record.loading = true;
  record.attempted = now;
  try {
    const data = await fetchSteamFeed(page);
    if (data?.account !== account || !Array.isArray(data.items)) throw new Error('Steam вернул некорректные данные.');
    record.data = data;
    record.error = '';
  } catch (error) {
    record.error = error.message;
  } finally {
    record.loading = false;
    if (state.steam?.account === account) {
      updateStoreFeed(page);
      refreshHomePreview(page);
    }
  }
}

function refreshStoreFeeds() {
  if (route.page === 'library') {
    void refreshStoreFeed('wishlist');
    void refreshStoreFeed('news');
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

function achievementRarityLabel(item) {
  return Number.isFinite(item.percent) ?
    icon('trophy',14) + '<span>' + numeric(Math.round(item.percent*10)/10) + '%</span>' :
    '<span title="Редкость неизвестна" aria-label="Редкость неизвестна">—</span>';
}

function achievementItemRow(entry, locked = false) {
  const {game,item} = entry;
  return '<article class="ach-item">' +
    trophyIcon(item) +
    '<div class="ach-item-info"><strong>' + esc(item.name) + '</strong>' +
      (locked && (item.description || item.hidden) ? '<p>' + esc(item.description || 'Условие скрыто в Steam') + '</p>' : '') +
      '<a class="ach-item-game" href="' + gameHref(game,'achievements') + '">' + icon('steam',13) + esc(displayName(game)) + '</a>' +
    '</div>' +
    '<span class="ach-item-rarity">' + achievementRarityLabel(item) + '</span>' +
    (locked ? '' : '<div class="ach-item-date"><time datetime="' + new Date(item.time*1000).toISOString() + '">' +
      esc(achievementMomentLabel(item.time)) + '</time></div>') +
    '<a class="ach-item-open" href="' + gameHref(game,'achievements') + '" aria-label="Открыть достижения игры ' +
      esc(displayName(game)) + '">' + icon('right',16) + '</a>' +
  '</article>';
}

function achievementFeatureRow(entry) {
  const {game,item} = entry;
  return '<div class="ach-feature-row">' +
    trophyIcon(item) +
    '<div class="ach-feature-info"><strong>' + esc(item.name) + '</strong>' +
      '<small>' + esc(displayName(game)) + '</small></div>' +
    '<span class="ach-feature-date">' + esc(achievementMomentLabel(item.time)) + '</span>' +
    '<span class="ach-feature-rarity">' + achievementRarityLabel(item) + '</span>' +
  '</div>';
}

function achievementIncompleteGames() {
  return games().filter(game => !game.hidden && game.steam).map(game => {
    const record = summaryFor(game);
    if (!record?.total || !Array.isArray(record.items)) return null;
    const remaining = record.items.filter(item => !item.unlocked);
    if (!remaining.length) return null;
    return {game,record,remaining,missing:remaining.length,
      ratio:record.unlocked/record.total*100,hours:gameHours(game)};
  }).filter(Boolean);
}

function compareAchievementPercent(a,b, order = 'common') {
  const direction = order === 'rare' ? 1 : -1;
  const rank = item => Number.isFinite(item.percent) ? item.percent * direction : Infinity;
  return rank(a) - rank(b) || a.name.localeCompare(b.name,'ru') || a.id.localeCompare(b.id);
}

function achievementMomentLabel(time) {
  const date = new Date(time*1000);
  return [String(date.getDate()).padStart(2,'0'),
    String(date.getMonth()+1).padStart(2,'0'),
    date.getFullYear()].join('.');
}

function achievementEarnedContent(earned, totalUnlocked) {
  const selected = achievementYear ? earned.filter(({item}) =>
    String(new Date(item.time*1000).getFullYear()) === achievementYear) : earned;
  const recent=selected.slice(0,5);
  const remaining=selected.slice(5).sort((a,b)=>compareAchievementPercent(a.item,b.item));
  const since=Date.now()-7*24*60*60*1000;
  const lastWeek=earned.filter(({item})=>item.time*1000 >= since && item.time*1000 <= Date.now()).length;
  const now = performance.now();
  if (recent.length) recentRevealStartedAt ??= now;
  const elapsed = now - (recentRevealStartedAt ?? -Infinity);
  const historyDelay = 480 + Math.max(0,recent.length - 1) * 250;
  const reveal = recent.length > 0 && elapsed < historyDelay + 270;
  return '<div class="ach-earned-content' + (reveal ?
    ' ach-recent-reveal" style="--reveal-elapsed:' + elapsed + 'ms;--history-delay:' + historyDelay + 'ms"' : '"') + '>' +
    '<section class="ach-feature ach-earned-feature" aria-label="Недавние полученные достижения">' +
    '<div class="ach-earned-intro">' +
      '<div class="ach-intro-copy"><h1>Недавние достижения</h1>' +
        '<p>Последние разблокированные достижения<br>из ваших игр</p></div>' +
      '<div class="ach-hero-metrics">' +
        '<div class="ach-hero-metric ach-hero-total">' + icon('trophy',34) +
          '<div><strong>' + numeric(totalUnlocked) + '</strong><small>всего достижений</small></div></div>' +
        '<div class="ach-hero-metric ach-hero-week"><div><strong>+' + numeric(lastWeek) +
          '</strong><small>за последние 7 дней</small></div></div>' +
      '</div>' +
    '</div>' +
    '<div class="ach-feature-list">' +
      (recent.length ? recent.map(achievementFeatureRow).join('') :
      '<p class="ach-feature-empty">В выбранном году нет полученных достижений с известной датой.</p>') +
    '</div></section>' +
    '<div class="ach-earned-history">' +
    (remaining.length ? '<div class="ach-items ach-history-table ach-earned-items">' +
      '<div class="ach-history-columns" aria-hidden="true"><span>Достижение</span><span>Редкость</span><span>Получено</span></div>' +
      remaining.slice(0,feedLimit).map(entry=>achievementItemRow(entry)).join('') + '</div>' :
      '<p class="ach-empty">' + (recent.length ? 'Других достижений за выбранный период нет.' :
      'Попробуй выбрать другой год или обновить достижения Steam.') + '</p>') +
    feedMore(remaining.length) + '</div></div>';
}

function achievementLockedContent(locked) {
  const available=achievementIncompleteGames();
  const near=available.filter(entry => entry.ratio >= 80 && entry.missing <= 20);
  const candidates=near.length ? near : available;
  const featured=[...candidates].sort((a,b)=>b.hours-a.hours||b.ratio-a.ratio||a.missing-b.missing)[0];
  const other=[...available].filter(entry => entry !== featured)
    .sort((a,b)=>a.missing-b.missing||b.ratio-a.ratio||b.hours-a.hours).slice(0,5);
  const all=[...locked].sort((a,b)=>compareAchievementPercent(a.item,b.item,lockedAchievementOrder) ||
    displayName(a.game).localeCompare(displayName(b.game),'ru'));
  const remaining = featured ? [...featured.remaining].sort(compareAchievementPercent).slice(0,4) : [];
  const missing = featured?.missing ?? 0;
  const noun = {one:'достижение',few:'достижения',many:'достижений'}[achievementPlural.select(missing)];
  const feature=featured ? '<section class="ach-feature ach-locked-feature" aria-label="Игра с незавершёнными достижениями">' +
    '<div class="ach-locked-spotlight"><a class="ach-feature-cover" href="' + gameHref(featured.game,'achievements') +
      '">' + cover(featured.game) + '</a><div class="ach-locked-info">' +
      '<h1><a href="' + gameHref(featured.game,'achievements') + '">' + esc(displayName(featured.game)) + '</a></h1>' +
      '<div class="ach-locked-count">' + icon('trophy',17) + '<strong>' + numeric(featured.record.unlocked) +
      ' / ' + numeric(featured.record.total) + '</strong> достижений <b>' +
      numeric(Math.round(featured.ratio)) + '%</b></div>' +
      '<div class="ach-progress-track" role="progressbar" aria-label="Прогресс достижений игры" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
        percent(featured.ratio) + '"><i style="width:' + percent(featured.ratio) + '%"></i></div>' +
      '<p>' + icon('clock',15) + duration(Math.round(featured.hours*60)) + ' в игре</p>' +
    '</div></div>' +
    '<div class="ach-locked-missing"><h2>' + icon('lock',18) + 'Осталось ' + numeric(missing) + ' ' + noun + '</h2>' +
      '<div class="ach-missing-list">' +
        remaining.map(item => '<div class="ach-missing-row">' + trophyIcon(item) +
          '<div><strong>' + esc(item.name) + '</strong><p>' +
          esc(item.description || (item.hidden ? 'Условие скрыто в Steam' : 'Описание недоступно')) +
          '</p></div><span class="ach-missing-rarity">' + achievementRarityLabel(item) + '</span></div>').join('') +
      '</div>' + (missing > remaining.length ? '<a class="ach-missing-more" href="' +
        gameHref(featured.game,'achievements') + '">Все достижения игры ' + icon('right',15) + '</a>' : '') +
    '</div></section>' :
    '<section class="ach-feature ach-feature-empty"><h1>Пока нет незавершённых игр</h1>' +
      '<p>Загрузи достижения Steam, чтобы увидеть оставшиеся цели.</p></section>';
  return feature +
    '<div class="ach-locked-columns">' +
      '<section class="ach-near-games"><header class="ach-column-heading"><h2>' + icon('trophy',19) +
        'Близкие к завершению</h2></header>' +
        (other.length ? other.map(({game,record,missing,ratio}) =>
          '<a class="ach-near-game" href="' + gameHref(game,'achievements') + '">' +
            cover(game) + '<div><strong>' + esc(displayName(game)) + '</strong>' +
            '<small>' + numeric(record.unlocked) + ' / ' + numeric(record.total) +
            ' · Осталось ' + numeric(missing) + '</small>' +
            '<div class="ach-progress-track" aria-hidden="true"><i style="width:' + percent(ratio) +
            '%"></i></div></div>' + icon('right',16) + '</a>'
        ).join('') : '<p class="ach-empty">Других незавершённых игр с загруженными достижениями нет.</p>') +
      '</section>' +
      '<section class="ach-locked-all"><header class="ach-column-heading ach-locked-list-head"><h2>' +
        icon('lock',19) + 'Заблокированные достижения</h2>' +
        '<label>Сортировка <select id="ach-locked-order" aria-label="Сортировка заблокированных достижений">' +
          option('common','Популярные',lockedAchievementOrder) +
          option('rare','Редкие',lockedAchievementOrder) +
        '</select></label></header>' +
        (all.length ? '<div class="ach-items ach-history-table ach-locked-items">' +
          '<div class="ach-history-columns" aria-hidden="true"><span>Достижение</span><span>Редкость</span></div>' +
          all.slice(0,feedLimit).map(entry=>achievementItemRow(entry,true)).join('') + '</div>' :
          '<p class="ach-empty">Нет заблокированных достижений в загруженных данных.</p>') +
        feedMore(all.length) +
      '</section>' +
    '</div>';
}

function achievementsPage() {
  const entries=achievementEntries();
  const earned=entries.filter(({item})=>item.unlocked && item.time && Number.isFinite(item.time))
    .sort((a,b)=>b.item.time-a.item.time);
  const locked=entries.filter(({item})=>!item.unlocked);
  const years=[...new Set(earned.map(({item})=>new Date(item.time*1000).getFullYear()))]
    .sort((a,b)=>b-a);
  return '<div id="desk-feed" class="achievements-v3">' +
    '<div class="ach-toolbar"><div class="ach-tabs" role="group" aria-label="Тип достижений">' +
      '<button type="button" data-action="desk-locked" data-value="earned" class="ach-tab' +
        (!lockedFeed ? ' is-active' : '') + '" aria-pressed="' + (!lockedFeed) + '">' +
        icon('trophy',16) + 'Полученные</button>' +
      '<button type="button" data-action="desk-locked" data-value="locked" class="ach-tab' +
        (lockedFeed ? ' is-active' : '') + '" aria-pressed="' + lockedFeed + '">' +
        icon('lock',16) + 'Заблокированные</button></div>' +
    (!lockedFeed && years.length ? '<label class="ach-select-label"><select id="desk-unlock-year" aria-label="Год получения">' +
      option('','Все годы',achievementYear) +
      years.map(year=>option(year,year,achievementYear)).join('') + '</select></label>' : '') +
    '</div>' +
    (lockedFeed ? achievementLockedContent(locked) : achievementEarnedContent(earned, entries.filter(({item})=>item.unlocked).length)) +
  '</div>';
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
  const sessions = route.section !== 'achievements';
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

function legacySessionsPage(game) {
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



function sessionDuration(minutes) {
  return minutes > 0 && minutes < .5 ? 'меньше минуты' : duration(Math.round(minutes));
}

function sessionRecordCount(count) {
  const form = new Intl.PluralRules('ru').select(count);
  return numeric(count) + ' ' + ({one:'запись',few:'записи'}[form] ?? 'записей');
}

function sessionDashboardData(context) {
  const today = dayNumber(Date.now());
  const valid = context.events.filter(event => event.minutes > 0 && Number.isFinite(event.minutes) &&
    Number.isInteger(event.day) && event.day <= today);
  const earliest = valid.reduce((first,event) => Math.min(first,event.day),today);
  const start = sessionPeriod === 'all' ? earliest : today - Number(sessionPeriod) + 1;
  const events = valid.filter(event => event.day >= start);
  const metrics = entries => {
    const minutes = entries.reduce((sum,event) => sum + event.minutes,0);
    const achievements = entries.reduce((sum,event) => sum +
      (context.unlocks.get(event.game.steam.appid + ':' + event.day)?.length ?? 0),0);
    return {minutes, count:entries.length, average:entries.length ? minutes/entries.length : 0, achievements};
  };
  const previousStart = start - Number(sessionPeriod);
  const previous = earliest <= previousStart
    ? metrics(valid.filter(event => event.day >= previousStart && event.day < start)) : null;
  return {today,start,events,metrics:metrics(events),previous,ranking:sessionRank(events),context};
}

function sessionRank(events) {
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

function sessionChartPoints({start,today,events}) {
  const monthName = new Intl.DateTimeFormat('ru-RU',{month:'short',timeZone:'UTC'});
  const fullMonth = new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'});
  const mode = sessionGrouping;
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

function sessionSwitch(action, label, options, selected) {
  return `<div class="session-switch" role="group" aria-label="${label}">
    ${options.map(([value,name]) => `<button type="button" data-action="${action}" data-value="${value}"
      aria-pressed="${selected === value}">${name}</button>`).join('')}</div>`;
}

function sessionActivityChart(data) {
  const points = sessionChartPoints(data);
  const max = Math.max(0,...points.map(point => point.minutes));
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(1,max/300)));
  const step = [1,2,3,5,10].map(value => value*magnitude).find(value => value >= max/300);
  const divisions = Math.ceil(max/(step*60)) || 1;
  const options = sessionPeriod === 'all' ? [['months','По месяцам'],['years','По годам']] : [['days','По дням'],['weeks','По неделям']];
  const heading = {days:'по дням',weeks:'по неделям',months:'по месяцам',years:'по годам'}[sessionGrouping];
  const labelEvery = points.length <= 31 ? 1 : 3;
  return `<section class="session-card session-chart-panel">
    <div class="session-panel-head"><h2>${icon('chart',19)}Игровое время ${heading}</h2>
      ${sessionSwitch('session-group','Группировка графика',options,sessionGrouping)}</div>
    ${max ? `<div class="session-chart-frame">
      <div class="session-chart-axis" aria-hidden="true">${Array.from({length:divisions+1},(_,index) =>
        `<span>${numeric((divisions-index)*step)} ч</span>`).join('')}</div>
      <div class="session-chart-scroll" aria-label="Игровое время за выбранный период">
        <div class="session-bars" style="--session-bars:${points.length};--session-ticks:${divisions}">
          ${points.map((point,index) => `<div class="session-bar-col">
            <div class="session-bar-track" ${point.minutes ? `tabindex="0" data-session-bar
              aria-label="${esc([point.title,sessionDuration(point.minutes),...point.games.map(({game,minutes}) =>
                displayName(game) + ' — ' + sessionDuration(minutes))].join(', '))}"` : ''}>
              ${point.minutes ? `<i style="--session-height:${point.minutes/(divisions*step*60)*100}%;--item-delay:${Math.min(index,24)*12}ms"></i>
                <template><header><strong>${esc(point.title)}</strong><b>${sessionDuration(point.minutes)}</b></header>
                  <ul>${point.games.map(({game,minutes}) => `<li><span>${esc(displayName(game))}</span>
                    <b>${sessionDuration(minutes)}</b></li>`).join('')}</ul></template>` : ''}
            </div><small aria-hidden="true">${index%labelEvery === 0 ? esc(point.label) : ''}</small></div>`).join('')}
        </div>
      </div></div><div class="session-chart-tooltip" role="tooltip" hidden></div>` :
      '<p class="session-empty">За этот период игровое время пока не записано.</p>'}
  </section>`;
}

function sessionTopRows(ranking) {
  return `<ul class="session-top-list">${ranking.map(({game,count,minutes}) => `<li>
    <a href="${gameHref(game)}" class="session-top-game">${cover(game)}
      <span class="session-top-copy"><strong>${esc(displayName(game))}</strong>
        <small>${icon('clock',12)}${sessionRecordCount(count)}</small></span>
      <strong class="session-top-time">${sessionDuration(minutes)}</strong>
    </a></li>`).join('')}</ul>`;
}

function sessionTopGames(data) {
  return `<section class="session-card session-top-panel">
    <div class="session-panel-head"><h2>${icon('game',19)}Топ игр за период</h2>
      ${data.ranking.length > 5 ? `<button type="button" class="session-text-action" data-action="session-top" aria-haspopup="dialog">Подробнее ${icon('right',15)}</button>` : ''}
    </div>${data.ranking.length ? sessionTopRows(data.ranking.slice(0,5)) : '<p class="session-empty">Нет данных за этот период.</p>'}
  </section>`;
}

function sessionRecentCards(data) {
  return `<section class="session-card session-recent-panel">
    <div class="session-panel-head"><h2>${icon('clock',19)}Последние сессии</h2>
      ${data.events.length ? `<button type="button" class="session-text-action" data-action="session-archive" aria-haspopup="dialog">Все сессии ${icon('right',15)}</button>` : ''}
    </div>${data.events.length ? `<div class="session-recent-grid">
      ${data.events.slice(0,4).map(({game,day,minutes}) => {
        const earned = data.context.unlocks.get(game.steam.appid + ':' + day) ?? [];
        return `<a class="session-recent-card" href="${gameHref(game)}">${cover(game)}
          <span class="session-recent-copy"><strong>${esc(displayName(game))}</strong>
            <small>${icon('calendar',14)}${shortDay.format(calendarDate(day))}</small>
            <small>${icon('clock',14)}<b>${sessionDuration(minutes)}</b></small>
            ${earned.length ? `<small>${icon('trophy',14)}Достижений: +${numeric(earned.length)}</small>` : ''}
          </span></a>`;
      }).join('')}</div>` : '<p class="session-empty">Игровые записи за период не найдены.</p>'}
  </section>`;
}

function sessionRingSegment(start,end) {
  const point = (turn,radius) => {
    const angle = turn*2*Math.PI - Math.PI/2;
    return `${100+radius*Math.cos(angle)} ${100+radius*Math.sin(angle)}`;
  };
  const large = Number(end-start > .5);
  return `M ${point(start,98)} A 98 98 0 ${large} 1 ${point(end,98)}
    L ${point(end,60)} A 60 60 0 ${large} 0 ${point(start,60)} Z`;
}

function sessionGameDistribution(data) {
  const colors = ['#4f9fe9','#57c4e3','#37bcb6','#4778bb','#80a7c9','#a3bdd0'];
  const total = data.metrics.minutes;
  const top = data.ranking.slice(0,5);
  const items = top.map(({game,minutes}) => ({label:displayName(game),minutes}));
  const other = data.ranking.slice(5).reduce((sum,item) => sum+item.minutes,0);
  if (other) items.push({label:'Другие игры',minutes:other});
  let start = 0;
  const segments = items.map((item,index) => {
    const end = start+item.minutes/total;
    const props = `data-session-share="${index}"`;
    const shape = items.length === 1 ? `<circle ${props} cx="100" cy="100" r="79" fill="none" stroke="${colors[index]}" stroke-width="38"/>` :
      `<path ${props} d="${sessionRingSegment(start,end)}" fill="${colors[index]}"/>`;
    start = end;
    return shape;
  }).join('');
  return `<section class="session-card session-share-panel">
    <div class="session-panel-head"><h2>${icon('pie',19)}Распределение по играм</h2></div>
    ${total ? `<div class="session-share-layout"><div class="session-donut">
      <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">
        <defs><mask id="session-donut-mask"><circle class="session-ring-sweep" cx="100" cy="100" r="79" pathLength="100"
          fill="none" stroke="white" stroke-width="42" transform="rotate(-90 100 100)"/></mask></defs>
        <g mask="url(#session-donut-mask)">${segments}</g></svg>
      <div class="session-donut-total"><strong>${sessionDuration(total)}</strong><small>всего</small></div></div>
      <ul class="session-share-list">${items.map(({label,minutes},index) =>
        `<li data-session-share="${index}" tabindex="0"><i style="background:${colors[index]}"></i>
          <span title="${esc(label)}">${esc(label)}</span>
          <strong>${numeric(Math.round(minutes/total*1000)/10)}%</strong>
          <small>${sessionDuration(minutes)}</small></li>`).join('')}</ul></div>` :
      '<p class="session-empty">Появится после записи игрового времени.</p>'}
  </section>`;
}

function sessionDelta(value, previous, mode) {
  if (!previous) return '';
  const difference = value - previous;
  const amount = mode === 'duration' ? Math.round(Math.abs(difference)) :
    mode === 'percent' ? Math.round(Math.abs(difference)/previous*100) : Math.abs(difference);
  if (!amount) return '';
  const sign = difference > 0 ? '+' : '−';
  const text = mode === 'duration' ? duration(amount) : numeric(amount) + (mode === 'percent' ? '%' : '');
  return `<span class="session-delta ${difference < 0 ? 'is-down' : ''}" title="По сравнению с предыдущим таким же периодом">
    ${sign}${text}</span>`;
}

function sessionsPage(game, inSection = false) {
  if (game) return legacySessionsPage(game);
  const data = sessionDashboardData(sessionContext());
  const period = sessionPeriod === 'all' ? 'за всё время' : 'за ' + sessionPeriod + ' дней';
  const cards = [
    ['clock','Время ' + period,'minutes','percent',''],
    ['game','Записей сессий','count','count','Одна запись на игру за календарный день'],
    ['timer','Среднее за запись','average','duration','Среднее по записям, сгруппированным по игре и дню'],
    ['trophy','Достижений за сессии','achievements','percent','Достижения, полученные в игре в день с записью']
  ];
  return `<div id="desk-feed" class="session-dashboard">
    <div class="session-dashboard-head">${inSection ? '' : '<h1>' + icon('clock',22) + 'Игровые сессии</h1>'}
      <div class="session-dashboard-actions">
        ${sessionSwitch('session-period','Период',[['7','7 дней'],['30','30 дней'],['all','Всё время']],sessionPeriod)}
        ${button('steam-sync','Обновить','refresh','quiet',syncingSteam ? 'disabled' : '')}</div></div>
    ${steamMessage && (syncingSteam || steamError) ? `<p class="steam-message" role="status">${esc(steamMessage)}</p>` : ''}
    <div class="session-kpis">${cards.map(([glyph,title,key,mode,tip]) => {
      const value = data.metrics[key];
      const label = ['minutes','average'].includes(key) ? sessionDuration(value) : (key === 'achievements' && value ? '+' : '') + numeric(value);
      return `<section class="session-card session-kpi" ${tip ? `title="${tip}"` : ''}>
        <div class="session-kpi-icon">${icon(glyph,22)}</div><div><small>${title}</small>
          <div class="session-kpi-value"><strong>${key === 'average' && !data.metrics.count ? '—' : label}</strong>
          ${sessionDelta(value,data.previous?.[key],mode)}</div></div></section>`;
    }).join('')}</div>
    <div class="session-main-grid">${sessionActivityChart(data)}${sessionTopGames(data)}</div>
    <div class="session-bottom-grid">${sessionRecentCards(data)}${sessionGameDistribution(data)}</div>
  </div>`;
}

function showSessionChartHover(event) {
  const target = event.target instanceof Element ? event.target : null;
  const from = target?.closest('[data-session-bar]');
  const to = event.relatedTarget instanceof Element ? event.relatedTarget.closest('[data-session-bar]') : null;
  if (!from || from === to) return;
  const panel = from.closest('.session-chart-panel');
  const tooltip = panel.querySelector('.session-chart-tooltip');
  const isLeaving = event.type === 'pointerout' || event.type === 'focusout';
  if (isLeaving) {
    if (!to && (event.type === 'focusout' || document.activeElement !== from)) tooltip.hidden = true;
    return;
  }
  tooltip.replaceChildren(from.querySelector('template').content.cloneNode(true));
  tooltip.hidden = false;
  const anchor = from.querySelector('i').getBoundingClientRect();
  const box = panel.getBoundingClientRect();
  const left = anchor.left - box.left + (anchor.width-tooltip.offsetWidth)/2;
  tooltip.style.left = Math.max(8,Math.min(left,box.width-tooltip.offsetWidth-8)) + 'px';
  const top = anchor.top - box.top;
  tooltip.style.top = (top-tooltip.offsetHeight-8 < 0 ? top+12 : top-tooltip.offsetHeight-8) + 'px';
}

function showSessionShareHover(event) {
  const target = event.target instanceof Element ? event.target.closest('[data-session-share]') : null;
  const panel = target?.closest('.session-share-panel');
  if (!panel) return;
  const related = event.relatedTarget instanceof Element ? event.relatedTarget.closest('[data-session-share]') : null;
  const isLeaving = event.type === 'pointerout' || event.type === 'focusout';
  const focusedLegend = document.activeElement?.matches('.session-share-list [data-session-share]:focus-visible') ? document.activeElement : null;
  const next = isLeaving ? related ?? (event.type === 'pointerout' ? focusedLegend : null) : target;
  const active = panel.contains(next) ? next.dataset.sessionShare : undefined;
  panel.querySelectorAll('[data-session-share]').forEach(item => {
    item.classList.toggle('is-dimmed',active !== undefined && item.dataset.sessionShare !== active);
    item.classList.toggle('is-highlighted',item.dataset.sessionShare === active);
  });
}

for (const event of ['pointerover','pointerout','focusin','focusout']) {
  sectionDialog.addEventListener(event,showSessionChartHover);
  sectionDialog.addEventListener(event,showSessionShareHover);
}


function openSessionArchive(limit=20) {
  if (route.section !== 'sessions') return;
  const context=sessionContext(),data=sessionDashboardData(context);
  const content='<div class="dialog-body session-archive-body">' +
    '<p class="session-archive-caption">Записи сгруппированы по игре и календарному дню.</p>' +
    sessionRows({...context,events:data.events,launches:[]},limit,false) +
    (data.events.length>limit ? '<div class="load-more">' +
      button('session-archive-more','Показать ещё','down','secondary','data-limit="' + (limit+20) + '"') +
    '</div>' : '') + '</div>';
  if (dialog.open && dialog.classList.contains('session-archive-dialog')) {
    const pane=dialog.querySelector('.session-archive-body');
    const scroll=pane?.scrollTop || 0;
    if (pane) pane.outerHTML=content;
    const refreshed=dialog.querySelector('.session-archive-body');
    if (refreshed) refreshed.scrollTop=scroll;
  } else {
    const title=sessionPeriod==='7'?'Последние 7 дней':sessionPeriod==='30'?'Последние 30 дней':'Все время';
    showDialog('Игровые записи',title,content,'session-archive-dialog');
  }
  imageFallbacks(dialog);
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

function statsHourChart(events) {
  const now = new Date();
  const anchor = statsTimeMode === 'years' ? now.getUTCFullYear() : now.getUTCFullYear()*12+now.getUTCMonth();
  const count = statsTimeMode === 'years' ? 7 : 12;
  const first = anchor-count+1;
  const amounts = new Map();
  for (const event of events) {
    if (!Number.isFinite(event.day) || !Number.isFinite(event.minutes) || event.minutes <= 0) continue;
    const date = calendarDate(event.day);
    const key = statsTimeMode === 'years' ? date.getUTCFullYear() :
      date.getUTCFullYear()*12+date.getUTCMonth();
    if (key >= first && key <= anchor) addDaily(amounts,key,event.minutes);
  }
  const points = Array.from({length:count},(_,i) => {
    const key = first+i;
    const label = statsTimeMode === 'years' ? String(key) :
      new Intl.DateTimeFormat('ru',{month:'short',timeZone:'UTC'}).format(new Date(Date.UTC(Math.floor(key/12),key%12,1))).replace('.','');
    return {key,label,minutes:amounts.get(key) ?? 0};
  });
  const max = Math.max(0,...points.map(point=>point.minutes));
  if (!max) return '<div class="stats-time-chart-empty">Нет записанных сессий за выбранный период.</div>';
  return '<div class="stats-time-chart" style="--stats-chart-columns:'+count+'" role="img" aria-label="Игровые часы по записанным сессиям">'+
    points.map(point=>'<div class="stats-time-column" title="'+esc(point.label+': '+duration(Math.round(point.minutes)))+'">'+
      '<strong>'+(point.minutes ? numeric(Math.round(point.minutes/60))+' ч' : '')+'</strong>'+
      '<div class="stats-time-column-track"><i style="height:'+percent(point.minutes/max*100)+'%"></i></div>'+
      '<small>'+esc(point.label)+'</small></div>').join('')+'</div>';
}

function statsPage() {
  const linked = games().filter(game => game.steam && !game.hidden);
  const records = linked.map(game => summaryFor(game)).filter(record => record?.total);
  const totals = collectionTotals(linked);
  const completed = linked.filter(game => completionFor(game) === 'perfect').length;
  const beaten = linked.filter(game => completionFor(game) === 'beaten').length;
  const other = Math.max(0,linked.length-completed-beaten);
  const unlocked = totals.unlocked, total = totals.total;
  const completionRate = total ? unlocked/total*100 : 0;
  const finished = completed+beaten;
  const libraryRate = linked.length ? finished/linked.length*100 : 0;
  const earned = achievementEntries().filter(({item}) => item.unlocked);
  const dated = earned.filter(({item}) => item.time > 0);
  const days = achievementDays(dated);
  const today = dayNumber(Date.now());
  const earnedThisYear = [...days].reduce((sum,[day,value]) =>
    sum+(day >= today-364 && day <= today ? value : 0),0);
  const streak = streaks(days,today);
  const rarityMeasured = earned.filter(({item}) => Number.isFinite(item.percent));
  const rareCount = rarityMeasured.filter(({item}) => item.percent < 10).length;
  const top = [...linked].sort((a,b)=>(b.steam?.minutes ?? 0)-(a.steam?.minutes ?? 0)).slice(0,5);
  const topMax = top[0]?.steam?.minutes || 1;
  const sessions = sessionContext().events;
  const latest = statsTimeMode === 'years' ? 'По годам' : 'По месяцам';
  return '<div id="desk-feed" class="stats-dashboard">'+
    '<section class="stats-panel stats-panel-achievements">'+
      '<h2 class="stats-heading">'+icon('trophy',23)+'Достижения</h2>'+
      '<span class="stats-watermark" aria-hidden="true">'+icon('trophy',118)+'</span>'+
      '<div class="stats-achievements-value"><strong>'+numeric(unlocked)+'</strong><span>/ '+numeric(total)+'</span></div>'+
      '<div class="stats-achievements-progress">'+
        '<div class="stats-track" role="progressbar" aria-label="Получено достижений" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(completionRate)+'">'+
          '<i style="width:'+percent(completionRate)+'%"></i></div>'+
        '<strong>'+numeric(Math.round(completionRate*10)/10)+'%</strong>'+
      '</div>'+
      '<p class="stats-achievements-year">'+icon('trend',19)+'<strong>+'+numeric(earnedThisYear)+'</strong><span>за последние 365 дней</span></p>'+
    '</section>'+
    '<section class="stats-panel stats-panel-games">'+
      '<h2 class="stats-heading">'+icon('game',23)+'Игры</h2>'+
      '<span class="stats-watermark" aria-hidden="true">'+icon('game',112)+'</span>'+
      '<div class="stats-games-content">'+
        '<div class="stats-games-total"><strong>'+numeric(linked.length)+'</strong><span>игр</span></div>'+
        '<div class="stats-games-split">'+
          '<div><span class="stats-games-symbol">'+icon('trophy',20)+'</span><strong>'+numeric(completed)+'</strong><small>идеально</small></div>'+
          '<div><span class="stats-games-symbol">'+icon('check',20)+'</span><strong>'+numeric(beaten)+'</strong><small>пройдено</small></div>'+
          '<div><span class="stats-games-symbol stats-unmarked-symbol" aria-hidden="true"></span><strong>'+numeric(other)+'</strong><small>без отметки</small></div>'+
        '</div></div>'+
    '</section>'+
    '<section class="stats-panel stats-panel-time">'+
      '<div class="stats-panel-top"><h2 class="stats-heading">'+icon('clock',23)+'Игровое время</h2>'+
        '<div class="stats-period-controls" role="group" aria-label="Период истории игровых сессий">'+
          '<button type="button" data-action="stats-time-period" data-value="months" aria-pressed="'+(statsTimeMode==='months')+'">По месяцам</button>'+
          '<button type="button" data-action="stats-time-period" data-value="years" aria-pressed="'+(statsTimeMode==='years')+'">По годам</button>'+
        '</div></div>'+
      '<div class="stats-total-hours"><strong>'+numeric(Math.round(totals.minutes/60))+' ч</strong>'+
        '<span>общее время Steam</span></div>'+
      statsHourChart(sessions)+
      
    '</section>'+
    '<section class="stats-panel stats-panel-top-time">'+
      '<h2 class="stats-heading">'+icon('trophy',23)+'Топ игр по времени</h2>'+
      '<div class="stats-top-list">'+
        (top.length ? top.map((game,index) => {
          const minutes=game.steam?.minutes??0;
          return '<a class="stats-top-game" href="'+gameHref(game)+'">'+
            '<span class="stats-top-index">'+(index+1)+'.</span>'+cover(game)+
            '<div class="stats-top-game-info"><div><strong>'+esc(displayName(game))+'</strong>'+
              '<span>'+duration(minutes)+'</span></div>'+
            '<div class="stats-top-track"><i style="width:'+percent(minutes/topMax*100)+'%"></i></div>'+
            '</div></a>';
        }).join('') : '<p class="stats-empty">Нет данных об игровом времени.</p>')+
      '</div></section>'+
    '<section class="stats-panel stats-panel-rare">'+
      '<h2 class="stats-heading">'+icon('gem',23)+'Редкие достижения</h2>'+
      '<span class="stats-bottom-watermark" aria-hidden="true">'+icon('gem',108)+'</span>'+
      '<strong class="stats-bottom-value">'+(rarityMeasured.length ? numeric(rareCount) : '—')+'</strong>'+
      '<p>Получено достижений с редкостью менее 10% игроков Steam.</p>'+
      
    '</section>'+
    '<section class="stats-panel stats-panel-streak">'+
      '<h2 class="stats-heading">'+icon('flame',23)+'Серия достижений</h2>'+
      '<span class="stats-bottom-watermark" aria-hidden="true">'+icon('flame',112)+'</span>'+
      '<strong class="stats-bottom-value">'+numeric(streak.current)+' <span>дн.</span></strong>'+
      
      '<div class="stats-record">'+icon('trophy',17)+'Рекорд за 365 дней: <strong>'+numeric(streak.best)+' дн.</strong></div>'+
    '</section>'+
    '<section class="stats-panel stats-panel-library">'+
      '<h2 class="stats-heading">'+icon('layers',23)+'Прогресс библиотеки</h2>'+
      '<div class="stats-library-inner"><div>'+
        '<strong class="stats-bottom-value">'+numeric(Math.round(libraryRate*10)/10)+'%</strong>'+
        '<p>Пройдено игр ('+numeric(finished)+' из '+numeric(linked.length)+')</p>'+
      '</div><div class="stats-library-ring" role="img" aria-label="Пройдено '+numeric(Math.round(libraryRate*10)/10)+'% игр" style="--stats-library-pct:'+percent(libraryRate)+'%"></div></div>'+
    '</section>'+
  '</div>';
}

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

function refreshDeskFeed(motionClass) {
  const root = route.section ? sectionDialog : app;
  const feed = root.querySelector('#desk-feed');
  if (!feed) return;
  const view = route.section === 'achievements' ? achievementsPage() : route.section === 'stats' ? statsPage() :
    sessionsPage(route.page === 'game' ? findByRoute(games()) : undefined, route.section === 'sessions');
  feed.outerHTML = view;
  const updated = root.querySelector('#desk-feed');
  if (motionClass) updated.classList.add(motionClass);
  imageFallbacks(updated);
}

function collectionShowcaseGames(grouped, limit = 7) {
  return [...grouped].sort((a,b) => gameHours(b) - gameHours(a) ||
    displayName(a).localeCompare(displayName(b),'ru')).slice(0,limit);
}

function collectionMetrics(entry, hero = false) {
  const { grouped, minutes, unlocked, total } = entry;
  const rate = total ? unlocked / total * 100 : 0;
  const values = '<div class="collection-metrics-values">' +
    '<span><strong>' + numeric(grouped.length) + '</strong><small>игр</small></span>' +
    '<span><strong>' + duration(minutes) + '</strong><small>время в играх</small></span>' +
    '<span><strong>' + numeric(unlocked) + ' / ' + numeric(total) + '</strong><small>достижений</small></span></div>';
  const bar = '<div class="collection-metrics-progress"><span>' +
    (total ? Math.round(rate) + '% достижений' : 'Нет данных о достижениях') +
    '</span>' + progressBar(rate) + '</div>';
  return '<div class="collection-metrics' + (hero ? ' collection-metrics-hero' : '') + '">' + values + bar + '</div>';
}

function collectionLeader(grouped) {
  const game = collectionShowcaseGames(grouped,1)[0];
  return game && gameHours(game) > 0 ? 'Больше всего времени: ' + displayName(game) :
    grouped.length ? 'Игры из твоей библиотеки' : 'Пока нет игр';
}

function collectionHero(entry) {
  const { item, grouped } = entry;
  const selected = collectionShowcaseGames(grouped,7);
  const game = selected.find(game => game.steam?.appid) || selected[0];
  const id = game?.steam?.appid;
  const backdrop = id ? steamHero(id) : (game ? coverUrl(game.cover) : '');
  const image = backdrop ? '<img src="' + esc(backdrop) + '" alt="" decoding="async" loading="lazy"' +
    (id ? ' data-steam-art="' + id + '" data-art-kind="collection-hero"' : '') + '>' : '';
  return '<a href="#collections/' + encodeURIComponent(item.id) + '" class="collection-hero">' +
    '<div class="collection-hero-background" aria-hidden="true">' + image + '</div>' +
    '<div class="collection-hero-copy">' +
    '<h2>' + esc(item.name) + '</h2><p>' + esc(collectionLeader(grouped)) + '</p>' +
    collectionMetrics(entry,true) + '</div>' +
    '<div class="collection-hero-deck" aria-hidden="true">' +
    selected.map(game => cover(game,'collection-hero-poster')).join('') + '</div></a>';
}

function collectionRow(entry) {
  const { item, grouped } = entry;
  const selection = collectionShowcaseGames(grouped,5);
  return '<a href="#collections/' + encodeURIComponent(item.id) + '" class="collection-shelf">' +
    '<div class="collection-shelf-title"><h2>' + esc(item.name) + '</h2>' +
    '<p title="' + esc(collectionLeader(grouped)) + '">' + esc(collectionLeader(grouped)) + '</p></div>' +
    '<div class="collection-shelf-posters" aria-hidden="true">' +
    selection.map(game=>cover(game,'collection-shelf-poster')).join('') +
    (grouped.length > selection.length ? '<span class="collection-shelf-overflow">+' +
      numeric(grouped.length - selection.length) + '</span>' : '') + '</div>' +
    collectionMetrics(entry) + '</a>';
}

function collectionEntries() {
  const list = collections().map(item => {
    const grouped = games().filter(game => game.collectionIds.includes(item.id));
    const totals = collectionTotals(grouped);
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

function collectionsPage(collection) {
  if (collection) {
    const source = games().filter(game => game.collectionIds.includes(collection.id));
    const actions = button('pick-collection','Выбрать игру','plus','primary') +
      button('edit-collection','Редактировать','edit','secondary',`data-id="${esc(collection.id)}"`);
    return `<div class="desk-collection-detail"><div class="collection-detail-toolbar">
      <a class="back-link" href="#collections">${icon('back',17)} Все коллекции</a>
      <div class="heading-actions">${actions}</div></div>${gameResults(source,false)}</div>`;
  }
  const list = collectionEntries();
  const sorts = [['games', 'Игры', 'game'], ['time', 'Время', 'clock'], ['achievements', 'Достижения', 'trophy']];
  const featured = list[0];
  const rest = list.slice(1);
  const sortControls = list.length ? '<details class="desk-collection-sort">' +
    '<summary class="desk-collection-filter-trigger icon-btn" aria-label="Фильтры коллекций" title="Фильтры коллекций">' +
      icon('filter',18) + '</summary>' +
    '<div class="desk-collection-sort-controls" role="group" aria-label="Сортировать коллекции по убыванию">' +
      '<span class="desk-collection-sort-heading">Сортировать по убыванию</span>' +
      sorts.map(([value,label,glyph]) =>
        '<button type="button" class="desk-collection-sort-btn" data-action="collection-sort" data-value="' + value +
        '" aria-pressed="' + (collectionSort === value) + '" title="Сортировать по: ' +
        label.toLocaleLowerCase('ru') + '">' + icon(glyph,15) + '<span>' + label + '</span></button>'
      ).join('') + '</div></details>' : '';
  return '<div class="desk-collections">' +
    '<div class="desk-collection-toolbar"><span class="desk-collection-count">' +
      numeric(list.length) + ' коллекций</span><div class="desk-collection-controls">' +
      sortControls + button('new-collection','Новая коллекция','plus','primary') + '</div></div>' +
    (featured ? collectionHero(featured) : '') +
    '<div class="desk-collection-list">' +
      (rest.length ? rest.map(collectionRow).join('') :
        (featured ? '' : '<p class="desk-collection-empty">Здесь появятся твои коллекции. Начни с первой подборки.</p>')) +
    '</div></div>';

}


function dateLabel(value) {
  if (!value) return '—';
  const date = new Date(value + 'T12:00:00');
  return Number.isNaN(date.valueOf()) ? '—' : dateFormat.format(date);
}

function gamePage() { return gameDashboard(); }

function wideCover(game, showFallback = false) {
  const id = game.steam?.appid;
  return id ? `<div class="cover wide-cover" style="--cover-accent:#5083a7">${showFallback ? `<span class="cover-fallback">${icon('game',24)}</span>` : ''}<img src="${esc(steamHeader(id))}" alt="" decoding="async" referrerpolicy="no-referrer" data-steam-art="${id}" data-art-kind="wide"></div>` : cover(game,'wide-cover');
}

function settingsPage() {
  return `<div class="settings-grid">
      <section class="panel settings-panel"><span class="metric-icon">${icon('shield', 21)}</span><h2>Данные на устройстве</h2>
        <p>Библиотека сохраняется в этом браузере. Сделай копию перед очисткой данных, сменой браузера или переносом на другое устройство.</p>
        <div class="settings-actions">${button('export-json', 'Скачать JSON', 'download', 'primary', storageError ? 'disabled' : '')}
          ${button('import-json', 'Восстановить JSON', 'upload')}
          ${button('export-csv', 'Скачать CSV', 'download', 'secondary', storageError ? 'disabled' : '')}</div>
        <input id="backup-file" type="file" accept=".json,application/json" hidden></section>
      <section class="panel settings-panel"><span class="metric-icon">${icon('steam',21)}</span>
        <h2>Steam</h2>${steamPanel()}
        ${connected() && games().some(game => game.steam) ? `<div class="settings-actions">${button(scanningAchievements ? 'achievement-stop' : 'achievement-scan',
          scanningAchievements ? 'Остановить обновление' : 'Обновить достижения всех игр','download')}</div>` : ''}
        ${state.steam ? `<div class="settings-actions"><label class="btn btn-secondary desk-log-import">${icon('upload',16)} Импорт журнала Steam
          <input type="file" accept=".txt,text/plain" id="steam-log-file" aria-label="Импорт журнала Steam"></label></div>
          <p>Чтобы дополнить старые сессии, выбери <code>logs/gameprocess_log.txt</code> из папки Steam.</p>` : ''}
        ${scanMessage ? `<p class="scan-status" role="status">${esc(scanMessage)}</p>` : ''}</section>
    </div>`;
}

function render(focusMain = false, enter = false) {
  const regionOffset = app.querySelector('.boss-region-index')?.scrollTop;
  app.innerHTML = shell(route.page === 'game' ? gamePage() : library(),enter);
  restoreBossRegionScroll(regionOffset);
  imageFallbacks(app);
  if (route.page === 'game') showAchievements();
  else refreshStoreFeeds();
  document.title = route.page === 'library' ? 'AFTERSAVE — игровая библиотека' : 'Игра · AFTERSAVE';
  if (focusMain) app.querySelector('#main').focus({preventScroll:true});
  renderSection();
}

function renderSection() {
  const page = route.section;
  if (!page) {
    if (sectionDialog.open) sectionDialog.close();
    return;
  }
  const collection = page === 'collections' ? findByRoute(collections()) : null;
  const views = {wishlist:storeFeedPage,news:storeFeedPage,collections:() => collectionsPage(collection),
    achievements:achievementsPage,sessions:() => sessionsPage(undefined,true),stats:statsPage,settings:settingsPage};
  const wasOpen = sectionDialog.open;
  const changed = sectionDialog.dataset.page !== page || sectionDialog.dataset.id !== (route.id ?? '');
  const active = sectionDialog.contains(document.activeElement) ? document.activeElement : null;
  const body = sectionDialog.querySelector('.section-dialog-body');
  const scroll = changed ? 0 : body?.scrollTop ?? 0;
  sectionDialog.dataset.page = page;
  sectionDialog.dataset.id = route.id ?? '';
  sectionDialog.innerHTML = `<div class="dialog-head"><h2 id="section-dialog-title">
    ${icon(sectionIcons[page],23)}${esc(collection?.name ?? labels[page])}</h2>
    ${iconButton('close-section','Закрыть','x')}</div>
    <div class="dialog-body section-dialog-body page page-${page}">${views[page](page)}</div>`;
  if (!wasOpen) sectionDialog.showModal();
  if (!wasOpen || changed) {
    sectionDialog.querySelector('[data-action="close-section"]').focus({preventScroll:true});
    sectionDialog.querySelector('.desk-collections')?.classList.add('collection-reveal');
    if (page === 'stats') sectionDialog.querySelector('.stats-dashboard').classList.add('stats-charts-enter');
    if (page === 'sessions') sectionDialog.querySelector('.session-dashboard').classList.add('session-charts-enter');
  } else if (active) {
    const target = active.id ? sectionDialog.querySelector('#' + CSS.escape(active.id)) :
      active.dataset.action ? sectionDialog.querySelector('[data-action="' + CSS.escape(active.dataset.action) + '"]') : null;
    (target ?? sectionDialog.querySelector('[data-action="close-section"]')).focus({preventScroll:true});
  }
  sectionDialog.querySelector('.section-dialog-body').scrollTop = scroll;
  if (page === 'news' || page === 'wishlist') {
    updateStoreFeed(page,!wasOpen || changed);
    void refreshStoreFeed(page);
  }
  imageFallbacks(sectionDialog);
}

function renderResults(more = false, inLibrary = true) {
  const collection = !inLibrary && findByRoute(collections());
  if (!more && inLibrary) displayLimit = HOME_GAME_LIMIT;
  const root = inLibrary ? app : sectionDialog;
  const selector = inLibrary ? '#game-results' : '#collection-game-results';
  const current = root.querySelector(selector);
  if (!current || !inLibrary && !collection) return;
  const source = inLibrary ? libraryGames() : games().filter(game => game.collectionIds.includes(collection.id));
  current.outerHTML = gameResults(source,inLibrary);
  imageFallbacks(root.querySelector(selector));
}

function closeSection() {
  history.replaceState(null,'',libraryHash);
  updateRoute();
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
  libraryHidden = false;
  displayLimit = HOME_GAME_LIMIT;
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
    const major = control.dataset.major === 'true';
    if (major === majorNewsOnly) return;
    majorNewsOnly = major;
    for (const button of control.parentElement.querySelectorAll('button')) {
      button.setAttribute('aria-pressed',String(button === control));
    }
    updateStoreFeed('news',true);
  },
  'stats-time-period': control => {
    const mode = control.dataset.value;
    if (!['months','years'].includes(mode) || mode === statsTimeMode) return;
    statsTimeMode = mode;
    const chart = sectionDialog.querySelector('.stats-time-chart, .stats-time-chart-empty');
    chart.outerHTML = statsHourChart(sessionContext().events);
    sectionDialog.querySelector('.stats-time-chart')?.classList.add('chart-enter');
    for (const button of control.parentElement.querySelectorAll('button')) {
      button.setAttribute('aria-pressed',String(button === control));
    }
  },
  'desk-feed-more': () => { feedLimit += 24; refreshDeskFeed(); },
  'session-period': control => {
    const value = control.dataset.value;
    if (!['7','30','all'].includes(value) || sessionPeriod === value) return;
    sessionPeriod = value;
    sessionGrouping = value === 'all' ? 'months' : 'days';
    refreshDeskFeed('session-charts-enter');
    sectionDialog.querySelector('[data-action="session-period"][aria-pressed="true"]')?.focus({preventScroll:true});
  },
  'session-group': control => {
    const value = control.dataset.value;
    const allowed = sessionPeriod === 'all' ? ['months','years'] : ['days','weeks'];
    if (!allowed.includes(value) || sessionGrouping === value) return;
    sessionGrouping = value;
    sectionDialog.querySelector('.session-chart-panel').outerHTML = sessionActivityChart(sessionDashboardData(sessionContext()));
    const chart = sectionDialog.querySelector('.session-chart-panel');
    chart.classList.add('session-charts-enter');
    chart.querySelector('[data-action="session-group"][aria-pressed="true"]')?.focus({preventScroll:true});
  },
  'session-top': control => {
    const data = sessionDashboardData(sessionContext());
    control.focus({preventScroll:true});
    showDialog('Топ игр за период','', '<div class="dialog-body session-archive-body">' +
      sessionTopRows(data.ranking) + '</div>','session-archive-dialog');
    imageFallbacks(dialog);
  },
  'session-archive': () => openSessionArchive(),
  'session-archive-more': control => openSessionArchive(Number(control.dataset.limit) || 20),
  'desk-locked': control => {
    const next = control.dataset.value === 'locked';
    if (lockedFeed === next) return;
    lockedFeed = next;
    feedLimit = 24;
    recentRevealStartedAt = undefined;
    refreshDeskFeed(lockedFeed ? 'locked-enter' : undefined);
    sectionDialog.querySelector('.ach-tab.is-active')?.focus({preventScroll:true});
  },
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
  'more-games': control => {
    const inLibrary = !control.hasAttribute('data-collection');
    const root = inLibrary ? app : sectionDialog;
    const limit = inLibrary ? displayLimit : collectionLimit;
    if (inLibrary) displayLimit += 24;
    else collectionLimit += 24;
    renderResults(true,inLibrary);
    const list = root.querySelector(inLibrary ? '#game-results' : '#collection-game-results');
    list?.querySelectorAll('.desk-game')[limit]?.querySelector('a')?.focus({preventScroll:true});
  },
  'completion-results': openCompletionResults,
  'steam-sync': () => steamSync(),
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
    renderSection();
    sectionDialog.querySelector('.desk-collections')?.classList.add('collection-reveal','collection-sort-reveal');
    refreshHomePreview('collections');
    sectionDialog.querySelector('.desk-collection-filter-trigger')?.focus({preventScroll:true});
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
      refreshHomePreview('collections');
      go('collections');
      return true;
    }, true);
  },
  'export-json': () => download(`aftersave-${dateStamp()}.json`, exportJSON(state), 'application/json;charset=utf-8'),
  'export-csv': () => download(`aftersave-${dateStamp()}.csv`, exportCSV(state), 'text/csv;charset=utf-8'),
  'import-json': () => sectionDialog.querySelector('#backup-file')?.click(),
  'reload-after-update': () => location.reload(),
  'close-dialog': () => dialog.close(),
  'close-section': closeSection,


};

document.addEventListener('click', event => {
  const opener = event.target.closest('#app a[aria-haspopup="dialog"]');
  if (opener && !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) sectionOpener = opener;
  for (const menu of document.querySelectorAll('.desk-library-filter[open], .desk-collection-sort[open], .af-ach-extra[open]')) {
    if (!menu.contains(event.target)) menu.open = false;
  }
  const control = event.target.closest('[data-action]');
  const action = control?.dataset.action;
  if (Object.hasOwn(actions, action)) actions[action](control);
});

document.addEventListener('keydown', event => {
  if (event.target.id === 'game-playthrough-count' && (event.key === 'Enter' || event.key === 'Escape')) {
    const field = event.target;
    event.preventDefault();
    if (event.key === 'Escape') field.value = field.defaultValue;
    field.blur();
    return;
  }
  if (event.key !== 'Escape' || event.defaultPrevented || dialog.open) return;
  const menu = document.querySelector('.desk-library-filter[open], .desk-collection-sort[open], .af-ach-extra[open]');
  if (menu) {
    menu.open = false;
    menu.querySelector('summary').focus({ preventScroll: true });
  }
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

document.addEventListener('change', async event => {
  const field = event.target;
  if (field.id === 'steam-log-file') {
    if (field.files.length) await importSteamLog(field.files[0]);
    return;
  }
  if (field.id === 'game-playthrough-count') {
    const game = findByRoute(games());
    if (!game) return;
    const count = field.value === '' ? 0 : field.valueAsNumber;
    if (!field.validity.valid || !Number.isSafeInteger(count)) {
      field.value = game.playthroughCount;
      notify('Введи целое число от нуля.', true);
    } else if (count === game.playthroughCount || updateGame(game,{playthroughCount:count},'Количество прохождений сохранено')) {
      field.defaultValue = field.value = count;
    } else field.value = game.playthroughCount;
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
    recentRevealStartedAt = undefined;
    refreshDeskFeed();
    sectionDialog.querySelector('#desk-unlock-year')?.focus({preventScroll:true});
  }
  if (field.id === 'ach-locked-order') {
    if (!['common','rare'].includes(field.value)) return;
    lockedAchievementOrder = field.value;
    feedLimit = 24;
    refreshDeskFeed('locked-list-enter');
    sectionDialog.querySelector('#ach-locked-order')?.focus({preventScroll:true});
  }
  if (field.id === 'achievement-order') {
    if (!['rare','common','recent'].includes(field.value)) return;
    achievementSort = field.value;
    achievementLimit = 24;
    updateAchievementRows(false,true);
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
      refreshHomePreview('collections');
      if (route.id === encodeURIComponent(id)) renderSection();
      else go('collections',id);
    }
  }
});



function updateRoute() {
  if (location.hash === '#main') {
    app.querySelector('#main')?.focus();
    return;
  }
  const next = getRoute();
  const previous = route;
  if (next.section !== previous.section) recentRevealStartedAt = undefined;
  if (!next.section && next.page === 'library') libraryHash = location.hash || '#library';
  route = next.section && previous.page === 'library' ? {...next,trophy:previous.trophy} : next;
  if (next.page === 'library' && previous.page === 'library' && (next.section || previous.section)) {
    if (dialog.open) dialog.close();
    if (!next.section && next.trophy !== previous.trophy) libraryHidden = false;
    if (next.section !== previous.section) {
      feedLimit = 24;
      lockedFeed = false;
      lockedAchievementOrder = 'common';
      achievementYear = '';
    }
    if (next.id !== previous.id) collectionLimit = 24;
    if (!next.section && next.trophy !== previous.trophy) {
      render(false);
      return;
    }
    renderSection();
    return;
  }
  if (next.page === 'library' && previous.page === 'library') displayLimit = HOME_GAME_LIMIT;
  if (next.trophy) libraryHidden = false;
  if (next.id !== previous.id) {
    bossRegion = 0;
    bossArea = '';
    achievementSort = 'common';
    revealHidden = true;
  }
  feedLimit = 24;
  lockedFeed = false;
  lockedAchievementOrder = 'common';
  achievementYear = '';
  achievementFilter = '';
  achievementQuery = '';
  achievementLimit = 24;
  if (dialog.open) dialog.close();
  if (sectionDialog.open && !next.section) sectionDialog.close();
  window.scrollTo(0,0);
  render(true,true);
}

window.addEventListener('hashchange',updateRoute);

for (const modal of [sectionDialog,dialog]) {
  let pressedOutside = false;
  const outside = event => {
    if (event.target !== modal) return false;
    const bounds = modal.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX >= bounds.right ||
      event.clientY < bounds.top || event.clientY >= bounds.bottom;
  };
  modal.addEventListener('pointerdown',event => { pressedOutside = outside(event); });
  modal.addEventListener('pointercancel',() => { pressedOutside = false; });
  modal.addEventListener('click',event => {
    const dismiss = pressedOutside && outside(event);
    pressedOutside = false;
    if (!dismiss) return;
    if (modal === sectionDialog) closeSection();
    else modal.close();
  });
}
sectionDialog.addEventListener('cancel',event => {
  event.preventDefault();
  const menu = sectionDialog.querySelector('.desk-collection-sort[open]');
  if (menu) {
    menu.open = false;
    menu.querySelector('summary').focus({preventScroll:true});
  } else closeSection();
});
sectionDialog.addEventListener('close',() => {
  if (sectionDialog.open) return;
  if (route.page === 'library' && !route.section && sectionOpener) {
    const target = sectionOpener.isConnected ? sectionOpener :
      app.querySelector('a[href="' + CSS.escape(sectionOpener.getAttribute('href')) + '"]');
    (target ?? app.querySelector('#main')).focus({preventScroll:true});
  }
  sectionOpener = null;
  if (storagePending && !dialog.open) {
    storagePending = false;
    refreshFromStorage();
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
  if (dialog.open || sectionDialog.open) {
    storagePending = true;
    const form = dialog.querySelector('form');
    if (form) formError(form, 'Библиотека изменилась в другой вкладке. Закройте форму и откройте её снова.');
  } else refreshFromStorage();
});

dialog.addEventListener('close', () => {
  if (dialog.open) return;
  if (storagePending && !sectionDialog.open) {
    storagePending = false;
    refreshFromStorage();
  }
});

document.addEventListener('keydown', event => {
  if (event.key !== '/' || event.altKey || event.ctrlKey || event.metaKey || dialog.open || sectionDialog.open ||
    event.target.closest('input,textarea,select,[contenteditable]')) return;
  event.preventDefault();
  if (route.page === 'library') app.querySelector('#global-search')?.focus();
  else go('library');

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
        kind === 'wide' ? [artwork?.header, portrait, artwork?.cover] :
        kind === 'collection-hero' ? [steamHeader(id), artwork?.hero, artwork?.header, portrait] : [artwork?.hero];
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
  return `<div class="steam-panel"><p>${esc(last)}</p>
    <div class="settings-actions">${button('steam-sync', 'Синхронизировать Steam', 'download', 'primary', syncingSteam ? 'disabled' : '')}
      ${active ? button('steam-disconnect', 'Выйти на этом устройстве', 'x', 'secondary', syncingSteam ? 'disabled' : '') : ''}</div>
    ${syncingSteam ? '<progress class="steam-progress" aria-label="Синхронизация Steam"></progress>' : ''}
    ${steamMessage ? `<p class="steam-message ${steamError ? 'form-error' : ''}" role="status">${esc(steamMessage)}</p>` : ''}
  </div>`;
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
  const syncControl = document.activeElement?.matches('[data-action="steam-sync"]');
  syncingSteam = true;
  lastSteamAttempt = Date.now();
  if (!background) {
    steamError = false;
    steamMessage = 'Подключаемся к Worker…';
    if (route.section) renderSection();
    else render();
  }
  try {
    const response = await fetchLibrary(false, originalAccount, step => {
      if (background) return;
      steamMessage = step;
      const status = sectionDialog.querySelector('.steam-message');
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
  } catch (error) {
    if (!background) {
      steamError = true;
      steamMessage = error.message;
    }
  } finally {
    syncingSteam = false;
    if (route.page === 'library') {
      if (succeeded) refreshLibrary();
      if (!background && route.section && !dialog.open) {
        renderSection();
        if (syncControl) sectionDialog.querySelector('[data-action="steam-sync"]')?.focus({preventScroll:true});
      }
    } else if (!background && !dialog.open) render();
  }
}

function maybeSyncSteam() {
  if (!state.steam || syncingSteam || storageError || !connected() || document.hidden || dialog.open || !navigator.onLine) return;
  const lastSync = Date.parse(state.steam.lastSync) || 0;
  if (Date.now() - Math.max(lastSteamAttempt,lastSync) >= STEAM_AUTO_SYNC_MS) void steamSync({background:true});
}


function refreshLibrary() {
  const summary = app.querySelector('#library-summary');
  if (summary) summary.outerHTML = librarySummary();
  renderResults(true);
  for (const page of ['achievements','sessions','collections']) refreshHomePreview(page);
}

async function refreshSteamSummaries(repaint = true) {
  const account = state.steam?.account ?? null;
  const records = await achievementRecords(account);
  if (account !== (state.steam?.account ?? null)) return;
  const firstLoad = summaries.size === 0 && records.length > 0;
  for (const record of records) trackCompletion(record, summaryAccount === account ? summaries.get(record.appid) : null);
  summaryAccount = account;
  summaries = new Map(records.map(record => [record.appid,record]));
  if (!repaint || dialog.open) return;
  if (route.page === 'library') refreshLibrary();
  if (['achievements','sessions','stats'].includes(route.section) || route.page === 'game' && route.tab === 'sessions') {
    refreshDeskFeed(firstLoad ? ({stats:'stats-charts-enter',sessions:'session-charts-enter'})[route.section] : undefined);
  }
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
  renderSection();
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
    const status = sectionDialog.querySelector('.scan-status');
    if (status) status.textContent = scanMessage;
    await new Promise(resolve => setTimeout(resolve, 1100));
  }
  scanningAchievements = false;
  scanMessage = `${interruption ? interruption + ' ' : ''}Проверено ${checked} из ${linked.length} · недоступно ${failed}.`;
  await refreshSteamSummaries();
  if (route.section === 'settings' && !dialog.open) renderSection();
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
  const achievementBox = `<section class="game-achievements af-game-achievements" id="steam-achievements" aria-label="Достижения">
    <p class="dash-empty" role="status">${game.steam ? 'Загружаем достижения…' : 'Для этой игры нет данных Steam.'}</p></section>`;
  const content = route.tab === 'sessions' ? sessionsPage(game) : route.tab === 'notes'
    ? notesPanel(game) + (game.runs.length ? `<details class="panel saved-runs"><summary>Прохождения · ${game.runs.length}</summary>${runsPanel(game)}</details>` : '')
    : `<div class="desk-game-content">${achievementBox}</div>`;
  const hero = isEldenRing(game) ? './assets/elden-ring-hero.jpg' : steamHero(game.steam?.appid);
  return `<div class="desk-game-page${route.tab === 'overview' ? ' desk-game-achievement-view' : ''}">
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
        <div class="desk-game-heading">${route.tab === "overview" ? cover(game,"game-poster") : wideCover(game,true)}
          <div class="desk-game-title"><h1>${esc(displayName(game,true))} <span id="game-trophy">${completionBadge(status)}</span></h1>
            ${route.tab === 'overview' ? '' : '<small>' + (game.steam ? icon('steam',14) + ' Steam' : esc(game.platform)) + '</small>'}
            <div class="desk-game-links">
            ${game.steam ? `<a href="https://store.steampowered.com/app/${game.steam.appid}/" target="_blank" rel="noopener">${icon('upRight',14)} Страница игры</a>
              <button type="button" data-action="desk-game-sessions" aria-haspopup="dialog">${icon('clock',14)} Игровые сессии</button>` : ''}
            ${isEldenRing(game) ? `<a class="desk-ng-link" href="${url}/notes/ng-plus">${icon('checklist',16)} NG+</a>` : ''}
            ${game.journal.length || game.runs.length ? `<a href="${url}/notes">${icon('edit',14)} Личный журнал</a>` : ''}
            </div>
            <label class="desk-playthrough">
              ${icon('checklist',15)} <span>Количество прохождений</span>
              <input id="game-playthrough-count" type="number" inputmode="numeric" min="0" max="${Number.MAX_SAFE_INTEGER}"
                step="1" value="${game.playthroughCount}" title="Изменить количество прохождений">
              ${icon('edit',13)}
            </label>
          </div>
          <dl class="desk-game-metrics">
            <div><dt class="desk-icon-text">${icon('trophy',15)}Достижения</dt><dd id="game-achievement-count">${summary?.total ? summary.unlocked+' / '+summary.total : 'Нет достижений'}</dd></div>
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
  const updated = app.querySelector('#boss-tracker');
  if (!sameList) updated.querySelector('.boss-region').classList.add('region-enter');
  imageFallbacks(updated);
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
  if (commit({...state,games:next},'Коллекция сохранена')) {
    dialog.close();
    renderResults(true,false);
    refreshHomePreview('collections');
  }
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
    if (view === achievementView) drawAchievements(box, cached,
      /\(404\)/.test(error.message) ? 'Нет достижений' : error.message);
  }
}

function gameAchievementDate(time) {
  if (!(time > 0)) return '';
  const when = new Date(time*1000);
  if (Number.isNaN(when.valueOf())) return '';
  return achievementMomentLabel(time) + ', ' +
    new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit'}).format(when);
}

function drawAchievements(box, record, message = '', loading = false) {
  if (!box?.isConnected) return;
  const firstDraw = record?.total > 0 && !box.querySelector('.af-game-ach-shell');
  const refresh = app.querySelector('.desk-game-actions [data-action="achievement-reload"]');
  if (refresh) {
    refresh.disabled = loading;
    refresh.setAttribute('aria-busy',String(loading));
  }
  const count = document.querySelector('#game-achievement-count');
  if (count && record) {
    count.textContent = record.total ? record.unlocked + ' / ' + record.total : 'Нет достижений';
    const badge = document.querySelector('#game-trophy');
    if (badge) {
      const game = findByRoute(games());
      badge.innerHTML = completionBadge(completionFor(game,record));
    }
  }
  displayedAchievements = record;
  const extraOpen = box.querySelector('.af-ach-extra')?.open;
  const focusedField = box.contains(document.activeElement) ? document.activeElement.id : '';
  const total = Number(record?.total) || 0;
  const earned = Number(record?.unlocked) || 0;
  box.innerHTML = (message ? '<p class="dash-empty" role="status">' + esc(message) + '</p>' : '') +
    (!total && !message ? '<p class="dash-empty">' + (record ? 'Нет достижений' : 'Данные пока недоступны.') + '</p>' : '') +
    (total ? '<div class="af-game-ach-shell">' +
      '<div class="af-game-ach-toolbar">' +
        '<label class="searchbox">' + icon('search',19) +
          '<input type="search" id="achievement-query" aria-label="Поиск достижений" placeholder="Поиск достижений…" value="' + esc(achievementQuery) + '"></label>' +
        '<div class="af-game-ach-filters">' +
          '<label class="af-ach-select-label"><span>Статус</span><select id="achievement-state" aria-label="Статус достижения">' +
            option('','Все',achievementFilter) +
            option('yes','Получено · '+earned,achievementFilter) +
            option('no','Не получено · '+(total-earned),achievementFilter) +
          '</select></label>' +
          '<label class="af-ach-select-label"><span>Сортировка</span><select id="achievement-order" aria-label="Сортировка достижений">' +
            option('common','Сначала распространённые',achievementSort) +
            option('rare','Сначала редкие',achievementSort) +
            option('recent','Сначала полученные',achievementSort) +
          '</select></label>' +
          '<details class="af-ach-extra"' + (extraOpen ? ' open' : '') + '><summary title="Дополнительно" aria-label="Дополнительные настройки достижений">' +
             icon('settings',18) + '</summary><label><input id="achievement-reveal" type="checkbox" ' +
             (revealHidden ? 'checked' : '') + '> Показывать условия секретных достижений</label></details>' +
        '</div>' +
      '</div>' +
      '<div id="achievement-rows"></div>' +
    '</div>' : '');
  updateAchievementRows(false,firstDraw);
  if (focusedField) document.getElementById(focusedField)?.focus({preventScroll:true});
}

const isRare = item => Number.isFinite(item.percent) && item.percent < 10;

function updateAchievementRows(more = false, animate = false) {
  const target = document.querySelector('#achievement-rows');
  if (!target || !displayedAchievements) return;
  const query = achievementQuery.trim().toLocaleLowerCase('ru');
  const items = displayedAchievements.items.filter(item =>
    (!achievementFilter || item.unlocked === (achievementFilter === 'yes')) &&
    (!query || (item.name + ' ' + (item.hidden && !item.unlocked && !revealHidden ? '' : item.description)).toLocaleLowerCase('ru').includes(query))
  );
  items.sort(achievementSort === 'recent'
    ? (a,b)=>Number(b.unlocked)-Number(a.unlocked) || b.time-a.time || compareAchievementPercent(a,b)
    : (a,b)=>compareAchievementPercent(a,b,achievementSort));
  target.innerHTML = items.length ? '<ul class="achievement-list af-ach-list">' +
    items.slice(0,achievementLimit).map(item => {
      const concealed = item.hidden && !item.unlocked && !revealHidden;
      const stamp = item.unlocked ? gameAchievementDate(item.time) : '';
      return '<li class="af-ach-row' + (item.unlocked ? ' is-earned' : ' is-locked') + '">' +
        '<span class="achievement-icon af-ach-icon">' +
          icon(item.unlocked ? 'trophy' : 'lock',22) +
          (item.icon && !concealed ? '<img src="' + esc(item.icon) +
            '" data-achievement-icon data-fallback-icon="' + esc(item.fallbackIcon) +
            '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') +
        '</span>' +
        '<div class="af-ach-copy"><strong>' + esc(item.name) + '</strong>' +
          (concealed ? '<p>Скрытое условие</p>' : item.description ? '<p>' + esc(item.description) + '</p>' : '') +
        '</div>' +
        '<span class="af-ach-rarity" title="Доля игроков Steam">' +
          icon('gem',17) + '<span>' + (Number.isFinite(item.percent) ? numeric(item.percent) + '%' : '—') +
          '</span></span>' +
        '<span class="af-ach-status">' +
          (item.unlocked ? '<span class="af-ach-status-earned">Получено</span>' +
            (stamp ? '<time datetime="' + new Date(item.time*1000).toISOString() + '">' + esc(stamp) + '</time>' : '') :
            '<span class="af-ach-status-locked">Не получено</span>') +
        '</span>' +
      '</li>';
    }).join('') + '</ul>' +
    (items.length > achievementLimit ?
      '<div class="load-more">' + button('achievement-more','Показать ещё · ' + (items.length-achievementLimit),'down') + '</div>' : '') :
    '<p class="dash-empty" role="status">Достижения по этим фильтрам не найдены.</p>';
  if (animate) target.querySelector('.af-ach-list')?.classList.add('game-achievements-enter');
  imageFallbacks(target);
  if (more) {
    const firstNew = target.querySelectorAll('li')[achievementLimit - 24];
    if (firstNew) { firstNew.tabIndex = -1;firstNew.focus(); }
  }
}

if (!route.section && route.page === 'library') libraryHash = location.hash || '#library';
render(false,true);
refreshSteamSummaries();
refreshSteamProfile();
window.addEventListener('online', () => { refreshSteamProfile(); maybeSyncSteam(); refreshStoreFeeds(); });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { maybeSyncSteam(); refreshStoreFeeds(); }
});
setInterval(() => {
  if (!document.hidden) { refreshStoreFeeds(); }
}, 60 * 1000);
setInterval(maybeSyncSteam, 15 * 1000);
maybeSyncSteam();
if ('serviceWorker' in navigator) {
  const controlledAtStart = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.register(new URL('./sw.js', import.meta.url))
    .then(registration => registration.update().catch(() => {}))
    .catch(error => console.warn('AFTERSAVE offline:', error));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Do not discard in-progress form edits when an update becomes active.
    if (!controlledAtStart || appUpdateReady) return;
    appUpdateReady = true;
    if (!app.querySelector('.app-update-notice')) {
      app.querySelector('#main')?.insertAdjacentHTML('afterbegin', updateNotice());
    }
  });
}

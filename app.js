
import {
  STORAGE_KEY, STATUSES, PLATFORMS, load, save, emptyState,
  createGame, exportJSON, importJSON, exportCSV, isEldenRing
} from './data.js';
import { icon } from './icons.js';
import { createCloudSync } from './cloud.js';
import { bossRegions, bossById } from './elden-ring.js';
import { mergeSteam, fetchLibrary, connect, disconnect, connected, steamCover, steamHeader, steamHero, fetchSteamArtwork,
  fetchAchievements, cachedAchievements, achievementSummaries, achievementIconAlternatives } from './steam.js';

const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const mapDialog = document.querySelector('#boss-map-dialog');
const toast = document.querySelector('#toast');
const labels = { library: 'Библиотека', collections: 'Коллекции', stats: 'Статистика', settings: 'Настройки', game: 'Игра' };
const filter = { query: '', status: '', platform: '', tag: '', collection: '', sort: 'recent' };
const cups = { platinum: 'Платина', silver: 'Серебро', sapphire: 'Сапфир' };
const grades = [...'SABCDEF'];
const number = new Intl.NumberFormat('ru', { maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', year: 'numeric' });

let state;
let storageError = '';
try { state = load(); } catch (error) { state = emptyState(); storageError = error.message; }
let shelfMode = 'all';
let statsOrder = 'time';
let statsGrade = '';
let statsExpanded = false;
let tierDrag = null;
let achievementQuery = '';
let achievementSort = 'rare';
let revealHidden = false;
const gameTabs = [['overview', 'Обзор'], ['achievements', 'Достижения'], ['notes', 'Заметки']];
let toastTimer;
let route = getRoute();
let storagePending = false;
let syncingSteam = false;
let steamMessage = '';
let steamError = false;
let displayLimit = 24;
let achievementFilter = '';
let achievementView = 0;
let summaries = [];
let summaryAccount = null;
let scanningAchievements = false;
let stopAchievementScan = false;
let scanMessage = '';
let cloudMessage = '';
let cloudConflict = false;
let enableCloudAfterLogin = false;
let bossRegion = 0;
let bossArea = '';
let bossMap = null;
let bossMapIndex = 0;
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
    tab: ['achievements', 'notes'].includes(tab) ? tab : 'overview',
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
  const active = route.page === 'stats' ? 'stats' : 'library';
  return `<header class="topbar violet-header">
    <a class="violet-brand" href="#library" aria-label="AFTERSAVE, библиотека">${icon('ribbon',33)}<span>AFTERSAVE</span></a>
    <nav class="violet-nav" aria-label="Навигация">
      <a href="#library" ${active === 'library' ? 'aria-current="page"' : ''}>Библиотека</a>
      <a href="#stats" ${active === 'stats' ? 'aria-current="page"' : ''}>Статистика</a>
    </nav>
    <div class="violet-tools">${iconButton('top-search','Найти игру','search')}
      <a href="#settings" class="icon-btn settings-link" title="Настройки" aria-label="Настройки" ${route.page === 'settings' ? 'aria-current="page"' : ''}>${icon('gear',24)}</a>
    </div>
  </header>
  <main id="main" tabindex="-1" class="page page-${route.page}">
    ${storageError ? `<div class="alert">${icon('shield',19)}<span>${esc(storageError)}</span><a href="#settings">Восстановить данные</a></div>` : ''}
    ${content}
  </main>`;
}

const statusIcon = { playing: 'game', completed: 'check', dropped: 'x' };
const gameStatus = game => game.shelf && Object.hasOwn(STATUSES, game.status) ? game.status : '';

function statusBadge(status) {
  return `<span class="status status-${status}">${icon(statusIcon[status],18)}${STATUSES[status]}</span>`;
}

function statusMenu(game) {
  const status = gameStatus(game);
  return `<details class="status-picker"><summary id="game-status" aria-label="Статус игры: ${STATUSES[status] || 'не выбран'}">
    <span>${status ? icon(statusIcon[status],19) : ''}${STATUSES[status] || 'Выбрать статус'}</span>${icon('down',18)}</summary>
    <div class="status-options" role="group" aria-label="Выбрать статус игры">
      ${Object.entries(STATUSES).map(([key,label]) => `<button type="button" data-action="game-status" data-value="${key}" aria-pressed="${key === status}">
        ${icon(statusIcon[key],19)}<span>${label}</span>${key === status ? icon('check',16) : ''}</button>`).join('')}
    </div></details>`;
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
  return `<div class="section-heading"><div><div class="eyebrow"><i></i>${kicker}</div><h1>${title}</h1>
    <p>${description}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ''}</div>`;
}

function filtered(source) {
  const query = filter.query.trim().toLocaleLowerCase('ru');
  const result = source.filter(game => {
    const haystack = [game.title, displayName(game), game.genre, game.platform, game.steam?.appid, ...game.tags].join(' ').toLocaleLowerCase('ru');
    return (!query || query.split(/\s+/).every(term => haystack.includes(term))) &&
      (!filter.status || gameStatus(game) === filter.status) &&
      (!filter.platform || game.platform === filter.platform) &&
      (!filter.tag || game.tags.includes(filter.tag)) &&
      (!filter.collection || game.collectionIds.includes(filter.collection));
  });
  const sorts = {
    title: (a, b) => a.title.localeCompare(b.title, 'ru'),
    hours: (a, b) => gameHours(b) - gameHours(a),
    lastPlayed: (a, b) => (b.steam?.lastPlayed ?? 0) - (a.steam?.lastPlayed ?? 0),
    rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1),
    progress: (a, b) => b.progress - a.progress
  };
  if (filter.sort === 'recent') return result.sort((a,b) => Math.max(Date.parse(b.updatedAt), (b.steam?.lastPlayed || 0)*1000) - Math.max(Date.parse(a.updatedAt), (a.steam?.lastPlayed || 0)*1000));
  return sorts[filter.sort] ? result.sort(sorts[filter.sort]) : result;
}

function displayName(game, full = false) {
  return game.steam?.appid === 292030 ? (full ? 'Ведьмак 3: Дикая Охота' : 'Ведьмак 3') : game.title;
}

function gameMenu(game, edit = false) {
  return `<details class="game-menu"><summary class="icon-btn" aria-label="Действия с игрой" title="Действия с игрой">${icon('more',21)}</summary>
    <div class="game-menu-list">
      ${edit ? button('edit-game','Редактировать игру','edit') : ''}
      ${button('hide-game',game.hidden ? 'Вернуть в библиотеку' : 'Скрыть игру',game.hidden ? 'eye' : 'eyeOff','quiet',`data-id="${esc(game.id)}"`)}
    </div></details>`;
}

function gameCard(game) {
  const total = summaryFor(game);
  const achieved = total?.total ? achievementPercent(total) : null;
  const trophy = trophyFor(total);
  const status = gameStatus(game);
  return `<article class="game-card ${trophy ? 'cup-' + trophy : ''}">
    <a href="#game/${encodeURIComponent(game.id)}" class="card-link" aria-label="Открыть ${esc(displayName(game))}">
      <div class="card-art">${cover(game)}</div>
      <div class="card-body"><div class="card-title"><h3>${esc(displayName(game))}</h3>${trophyBadge(trophy)}</div>
        ${status ? `<div class="card-status">${statusBadge(status)}</div>` : ''}
        <div class="card-meta"><span>${icon('clock',21)} ${numeric(Math.round(gameHours(game)))} ч</span>
          <span>${icon('trophy',21)} ${total?.total ? total.unlocked + ' из ' + total.total : '—'}</span></div>
        <div class="card-progress">${achieved === null ? '<div class="progress-track"></div>' : progressBar(achieved)}
          <span>${achieved === null ? '—' : numeric(achieved) + '%'}</span></div>
      </div>
    </a>
    <div class="card-tools">${iconButton('favorite', game.favorite ? 'Убрать из избранного' : 'В избранное', 'bookmark',
      `data-id="${esc(game.id)}" aria-pressed="${game.favorite}"`)}${gameMenu(game)}</div>
  </article>`;
}

function gameList(source) {
  const result = filtered(source);
  if (!result.length) {
    const isFiltered = Boolean(filter.query || filter.status || filter.platform || filter.tag || filter.collection || route.trophy);
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
  return `<div class="game-grid list-view">${result.slice(0, displayLimit).map(gameCard).join('')}</div>
    ${result.length > displayLimit ? `<div class="load-more">${button('more-games', 'Показать ещё игры', 'down')}</div>` : ''}`;
}

function option(value, title, selected) {
  return `<option value="${esc(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${esc(title)}</option>`;
}

function searchField(id = 'global-search') {
  return `<label class="searchbox">${icon('search',22)}<input type="search" id="${id}" placeholder="Поиск по библиотеке" aria-label="Поиск по библиотеке" value="${esc(filter.query)}"></label>`;
}

function viewControls() {
  return `<div class="library-controls">
    ${searchField()}
    <select id="status-filter" aria-label="Статус игры">${[['','Статус'],...Object.entries(STATUSES)].map(([id,label])=>option(id,label,filter.status)).join('')}</select>
    <select id="sort" aria-label="Сортировка">${[['recent','По активности'],['lastPlayed','Последний запуск'],['title','По названию'],['hours','По времени'],['rating','По оценке']]
      .map(([id,label])=>option(id,label,filter.sort)).join('')}</select>
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
  return `<section class="library-section">
    <div class="library-heading"><h1>Библиотека</h1><a class="quiet-link" href="#collections">${icon('layers',20)} Коллекции</a></div>
    ${route.trophy ? `<div class="cup-filter">${trophyBadge(route.trophy)} <a class="quiet-link" href="#library">${icon('x',16)} Сбросить кубок</a></div>` :
      `<div class="shelf-switch" aria-label="Раздел библиотеки">${[['all','Все игры'],['hidden','Скрытые'],['favorite','Избранное']].map(([id,label]) =>
        `<button type="button" data-action="shelf" data-value="${id}" aria-pressed="${shelfMode === id}">${label}</button>`).join('')}</div>`}
    ${viewControls()}${gameResults(sourceForPage())}
  </section>`;
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
  return `${header('ПОДБОРКИ', labels.collections, 'Группируй игры по серии, настроению или любому другому принципу.', button('new-collection', 'Новая коллекция', 'plus', 'primary'))}
    ${list.length ? `<div class="collection-grid">${list.map(item => {
      const grouped = games().filter(game => game.collectionIds.includes(item.id));
      return `<a href="#collections/${encodeURIComponent(item.id)}" class="collection-card panel">
        <div class="collection-covers">${grouped.length ? cover(grouped[0]) : icon('layers', 40)}</div>
        <div><h2>${esc(item.name)}</h2><p>${grouped.length} игр</p></div><span class="collection-arrow">${icon('right', 22)}</span></a>`;
    }).join('')}</div>` : `<div class="empty"><span class="empty-icon">${icon('layers', 28)}</span><h2>Собери первую подборку</h2>
      <p>Создай коллекцию, затем выбери игры из своей библиотеки.</p>${button('new-collection', 'Новая коллекция', 'plus', 'primary')}</div>`}`;
}


function dateLabel(value) {
  if (!value) return '—';
  const date = new Date(value + 'T12:00:00');
  return Number.isNaN(date.valueOf()) ? '—' : dateFormat.format(date);
}

function gamePage() { return gameDashboard(); }

function tierBoard() {
  const groups = new Map([...grades, ''].map(grade => [grade, []]));
  for (const game of games()) {
    if (!game.hidden) groups.get(gradeFor(game)).push(game);
  }
  return `<section class="panel tier-board" aria-label="Распределение игр по оценкам">
    ${[...groups].map(([grade, group]) => `<div class="tier-row ${grade ? 'grade-' + grade : 'tier-unrated'}" data-tier="${grade}"
      role="group" aria-label="${grade ? 'Тир ' + grade : 'Без оценки'}">
      <span class="tier-letter" aria-hidden="true">${grade || 'Без оценки'}</span>
      <div class="tier-covers">${group.length ? group.map(game => {
        const title = esc(displayName(game));
        return `<div class="tier-card" draggable="true" data-tier-game="${esc(game.id)}">
          ${wideCover(game)}
          <button type="button" class="tier-cover-action" data-action="tier-picker" aria-haspopup="dialog"
            aria-label="Изменить оценку: ${title}" title="${title}"><span class="tier-fallback" aria-hidden="true">${title}</span></button>
        </div>`;
      }).join('') : '<span class="tier-empty">Пока пусто</span>'}</div>
    </div>`).join('')}
  </section>`;
}

function statsPage() {
  const linked = games().filter(game => game.steam);
  const achievements = totalsFor(linked);
  const completed = games().filter(game => gameStatus(game) === 'completed').length;
  const cupTotals = { platinum: 0, silver: 0, sapphire: 0 };
  for (const { record } of achievements.included) {
    const tier = trophyFor(record);
    if (tier) cupTotals[tier]++;
  }
  const hours = linked.reduce((sum,game) => sum + game.steam.minutes,0) / 60;
  return `<div class="stats-dashboard"><h1>Статистика</h1>
    ${tierBoard()}
    <div class="stats-metrics panel">${[[numeric(Math.round(hours))+' ч','Время в Steam','clock'],[completed,'Пройдено игр','game'],[cupTotals.platinum,'Игр со всеми достижениями','trophy']].map(([value,label,glyph])=>
      `<div>${icon(glyph,26)}<div><strong>${value}</strong><span>${label}</span></div></div>`).join('')}</div>
    <div class="stats-layout">
      ${statsRanking(linked)}
      <div class="stats-side">
        <section class="panel stats-achievements"><div class="stats-heading"><h2>Достижения Steam</h2>
          ${iconButton(scanningAchievements ? 'achievement-stop' : 'achievement-scan',scanningAchievements ? 'Остановить загрузку' : 'Обновить по всем играм','download')}</div>
          ${achievements.total ? `<strong>${numeric(achievements.unlocked)} из ${numeric(achievements.total)}</strong>
            <div class="stats-progress">${progressBar(achievements.percentage)}<span>${achievements.percentage}%</span></div>` :
            '<p class="dash-empty">Пока нет данных о достижениях.</p>'}
          <p class="stats-coverage">Данные по ${numeric(achievements.included.length)} из ${numeric(linked.length)} игр</p>
          ${scanMessage ? `<p class="scan-status" role="status">${esc(scanMessage)}</p>` : ''}
        </section>
        <section class="stats-cups panel" aria-labelledby="stats-cup-heading">
          <h2 id="stats-cup-heading">Кубки</h2>
          ${Object.entries(cups).map(([tier,label]) => `<a href="#library/cup/${tier}" class="cup-${tier}" aria-label="${label}, игр: ${cupTotals[tier]}">
            ${icon('trophy',23)}<span>${label}</span><strong>${numeric(cupTotals[tier])}</strong>${icon('right',16)}</a>`).join('')}
        </section>
      </div>
    </div></div>`;
}

function statsRanking(linked) {
  const byTime = statsOrder === 'time';
  const score = game => byTime ? game.steam.minutes : summaryFor(game)?.unlocked || 0;
  const top = linked.filter(game => score(game) > 0 &&
    (!statsGrade || gradeFor(game) === (statsGrade === 'unrated' ? '' : statsGrade)))
    .sort((a,b) => score(b) - score(a)).slice(0,10);
  return `<section class="panel stats-ranking">
    <div class="stats-heading"><h2>${byTime ? 'Больше всего времени' : 'Больше всего достижений'}</h2>
      <div class="stats-filters">
        <select id="stats-order" aria-label="Показатель рейтинга">${option('time','По времени',statsOrder)}${option('achievements','По достижениям',statsOrder)}</select>
        <select id="stats-grade" aria-label="Оценка игр в рейтинге">${option('','Все оценки',statsGrade)}
          ${grades.map(grade => option(grade,grade,statsGrade)).join('')}${option('unrated','Без оценки',statsGrade)}</select>
      </div></div>
    ${top.length ? `<div class="stats-rows" id="stats-rows">${top.slice(0,statsExpanded ? 10 : 5).map((game,index) => {
      const grade = gradeFor(game);
      const value = score(game);
      return `<a href="#game/${encodeURIComponent(game.id)}">
        <span class="stats-rank-number" aria-label="Место ${index + 1}">${String(index + 1).padStart(2,'0')}</span>${wideCover(game)}
        <div class="stats-rank-game"><div><strong>${esc(displayName(game))}</strong>${grade ? `<span class="stats-rank-grade grade-${grade}" aria-label="Оценка ${grade}">${grade}</span>` : ''}</div>
        ${progressBar(value / score(top[0]) * 100)}</div>
        <span class="stats-rank-value">${byTime ? numeric(Math.round(value/60)) + ' ч' : numeric(value)}</span>
      </a>`;
    }).join('')}</div>` : '<p class="dash-empty">Для этой выборки пока нет данных.</p>'}
    ${top.length > 5 ? `<button type="button" class="quiet-link stats-more" data-action="stats-more" aria-expanded="${statsExpanded}" aria-controls="stats-rows">
      ${statsExpanded ? 'Свернуть список' : 'Показать все ' + top.length} ${icon('right',15)}</button>` : ''}
  </section>`;
}

function refreshStatsRanking(focusSelector) {
  const panel = app.querySelector('.stats-ranking');
  if (!panel) return;
  panel.outerHTML = statsRanking(games().filter(game => game.steam));
  const next = app.querySelector('.stats-ranking');
  imageFallbacks(next);
  next.querySelector(focusSelector)?.focus({ preventScroll: true });
}

function wideCover(game) {
  const id = game.steam?.appid;
  return id ? `<div class="cover wide-cover" style="--cover-accent:#7363a2"><img src="${esc(steamHeader(id))}" alt="" loading="lazy" data-steam-art="${id}" data-art-kind="cover"></div>` : cover(game,'wide-cover');
}

function settingsPage() {
  return `${header('ЛИЧНОЕ', labels.settings, 'Данные библиотеки, резервные копии и установка приложения.')}
    <div class="settings-grid">
      <section class="panel settings-panel"><span class="metric-icon violet">${icon('globe',21)}</span><h2>Облачное сохранение</h2>
        <p>Статусы, теги, избранное, оценки, коллекции, заметки и ручные сессии на ПК и телефоне.</p>
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
        <p>Синхронизация библиотеки Steam и достижений.</p>${steamPanel()}</section>
    </div>`;
}

function render(focusMain = false) {
  const views = { library, collections: collectionsPage, stats: statsPage, settings: settingsPage, game: gamePage };
  clearTierDrag();
  app.innerHTML = shell(views[route.page]());

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
    ${inputField('Оценка / 10', 'rating', game.rating, 'min="0" max="10" step="any" placeholder="Без оценки"', 'number')}
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
    rating: fields.get('rating') === '' ? null : Number(fields.get('rating')),
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
  Object.assign(filter, { query: '', status: '', platform: '', tag: '', collection: '' });
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
  'stats-more': () => {
    statsExpanded = !statsExpanded;
    refreshStatsRanking('[data-action="stats-more"]');
  },
  'boss-region': control => {
    bossRegion = Number(control.dataset.region) === bossRegion ? -1 : Number(control.dataset.region);
    bossArea = '';
    bossMap = null;
    refreshBossTracker(control);
    if (bossRegion !== -1) app.querySelector('[aria-expanded="true"].boss-region-toggle')?.scrollIntoView({ block: 'nearest' });
  },
  'boss-area': control => {
    bossArea = control.dataset.area;
    bossMap = null;
    refreshBossTracker(control);
  },
  'boss-win': control => updateBossProgress(control, false),
  'boss-death': control => updateBossProgress(control, true),
  'boss-map': control => {
    bossMap = bossById.get(control.dataset.id);
    bossMapIndex = 0;
    drawBossMap();
    if (!mapDialog.open) mapDialog.showModal();
    mapDialog.querySelector('[data-action="boss-close-map"]').focus({ preventScroll: true });
  },
  'boss-map-place': control => {
    bossMapIndex = Number(control.dataset.place);
    drawBossMap();
    mapDialog.querySelector(`[data-place="${bossMapIndex}"]`)?.focus({ preventScroll: true });
  },
  'boss-close-map': () => mapDialog.close(),
  'game-status': control => {
    const game = findByRoute(games());
    const status = control.dataset.value;
    if (game && Object.hasOwn(STATUSES, status) && updateGame(game, { status, shelf: true }, 'Статус сохранён')) {
      render();
      app.querySelector('#game-status')?.focus({ preventScroll: true });
    }
  },
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
  'grade': control => {
    const game = findByRoute(games());
    const grade = control.dataset.value;
    if (game && saveGrade(game, gradeFor(game) === grade ? '' : grade)) render();
  },
  'tier-picker': control => openTierPicker(control.closest('[data-tier-game]').dataset.tierGame),
  'tier-set': control => moveTierGame(control.dataset.id, control.dataset.value, true),
  'tier-open-game': () => dialog.close(),
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
      if (filter.collection === item.id) filter.collection = '';
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
  if (event.target === mapDialog) mapDialog.close();
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

function clearTierDrag() {
  if (!tierDrag) return;
  tierDrag.card.classList.remove('is-dragging');
  tierDrag.board.classList.remove('is-dragging');
  tierDrag.target?.classList.remove('is-drop-target');
  tierDrag = null;
}

app.addEventListener('dragstart', event => {
  const card = event.target.closest('[data-tier-game]');
  if (!card || !event.dataTransfer) return;
  clearTierDrag();
  const board = card.closest('.tier-board');
  tierDrag = { card, board, target: null };
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', card.dataset.tierGame);
  card.classList.add('is-dragging');
  board.classList.add('is-dragging');
});

app.addEventListener('dragover', event => {
  const row = event.target.closest('[data-tier]');
  if (!tierDrag || !row || !tierDrag.board.contains(row)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  if (row === tierDrag.target) return;
  tierDrag.target?.classList.remove('is-drop-target');
  row.classList.add('is-drop-target');
  tierDrag.target = row;
});

app.addEventListener('dragleave', event => {
  const row = tierDrag?.target;
  if (row && !row.contains(event.relatedTarget)) {
    row.classList.remove('is-drop-target');
    tierDrag.target = null;
  }
});

app.addEventListener('drop', event => {
  const row = event.target.closest('[data-tier]');
  if (!tierDrag || !row || !tierDrag.board.contains(row)) return;
  event.preventDefault();
  const id = tierDrag.card.dataset.tierGame;
  clearTierDrag();
  moveTierGame(id, row.dataset.tier);
});

app.addEventListener('dragend', clearTierDrag);

mapDialog.addEventListener('close', () => {
  if (!bossMap || mapDialog.open) return;
  const id = bossMap.id;
  bossMap = null;
  mapDialog.replaceChildren();
  app.querySelector(`[data-action="boss-map"][data-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
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
    updateAchievementRows();
  }
});

app.addEventListener('change', async event => {
  const field = event.target;
  if (field.id === 'stats-order' || field.id === 'stats-grade') {
    if (field.id === 'stats-order') statsOrder = field.value;
    else statsGrade = field.value;
    statsExpanded = false;
    refreshStatsRanking('#' + field.id);
  }
  if (field.id === 'achievement-filter') {
    achievementFilter = field.value;
    updateAchievementRows();
  }
  if (field.id === 'achievement-sort') {
    achievementSort = field.value;
    updateAchievementRows();
  }
  if (field.id === 'achievement-reveal') {
    revealHidden = field.checked;
    updateAchievementRows();
  }
  const fields = { sort: 'sort', 'status-filter': 'status' };
  if (Object.hasOwn(fields, field.id)) {
    filter[fields[field.id]] = field.value;


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
  if (mapDialog.open) mapDialog.close();
  bossMap = null;
  mapDialog.replaceChildren();
  if (route.trophy) shelfMode = 'all';
  if (next.id !== previousGameId) {
    bossRegion = 0;
    bossArea = '';
  }


  displayLimit = 24;
  achievementFilter = '';
  achievementQuery = '';
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
  if (event.key !== '/' || event.altKey || event.ctrlKey || event.metaKey || dialog.open || mapDialog.open ||
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
    refreshSteamSummaries();
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
  const records = await achievementSummaries(account);
  if (account !== (state.steam?.account ?? null)) return;
  summaryAccount = account;
  summaries = records;
  if (repaint && !dialog.open && route.page === 'stats') render();
  if (repaint && !dialog.open && ['library','collections'].includes(route.page) && records.length) renderResults(true);
}



async function scanAchievements() {
  if (scanningAchievements) return;
  if (!connected()) return openSteamLogin();
  const account = state.steam?.account;
  const linked = state.games.filter(game => game.steam).sort((a, b) => b.steam.lastPlayed - a.steam.lastPlayed);
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
      <p>${dateLabel(run.startedAt)} → ${dateLabel(run.finishedAt)}${run.rating !== null ? ` · ★ ${numeric(run.rating)} / 10` : ''}</p>
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
    ${inputField('Оценка / 10', 'rating', run?.rating, 'min="0" max="10" step="any"', 'number')}
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
  const run = { ...fields, id, rating: fields.rating === '' ? null : Number(fields.rating) };
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
    summaries.find(record => record.appid === game.steam.appid) : undefined;
}

function totalsFor(source) {
  const included = source.flatMap(game => {
    const record = summaryFor(game);
    return record ? [{ game, record }] : [];
  });
  const total = included.reduce((sum, item) => sum + item.record.total, 0);
  const unlocked = included.reduce((sum, item) => sum + item.record.unlocked, 0);
  return { included, total, unlocked, percentage: total ? Math.round(unlocked / total * 100) : 0 };
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



function gradeFor(game) {
  if (game.gradeCleared || game.rating === null && !game.grade) return '';
  return game.grade || grades[Math.min(6, Math.max(0, 9 - Math.floor(game.rating)))];
}

function saveGrade(game, grade) {
  return updateGame(game, { grade, gradeCleared: !grade }, grade ? 'Оценка сохранена' : 'Оценка снята');
}

function openTierPicker(id) {
  const game = games().find(item => item.id === id && !item.hidden);
  if (!game) return;
  const current = gradeFor(game);
  showDialog(esc(displayName(game)), 'ОЦЕНКА ИГРЫ', `<div class="dialog-body">
    <div class="tier-picker-grades" role="group" aria-label="Выбрать оценку">
      ${grades.map(grade => `<button type="button" class="grade grade-${grade}" data-action="tier-set" data-id="${esc(id)}" data-value="${grade}"
        aria-label="Оценка ${grade}" aria-pressed="${grade === current}" ${grade === current ? 'autofocus' : ''}>${grade}</button>`).join('')}
    </div>
  </div><div class="dialog-footer">
    <a href="#game/${encodeURIComponent(id)}" class="btn btn-secondary" data-action="tier-open-game">Открыть игру ${icon('right',16)}</a>
    ${button('tier-set', 'Без оценки', '', 'secondary', `data-id="${esc(id)}" data-value="" aria-pressed="${!current}"`)}
  </div>`, 'tier-picker');
  dialog.querySelector('[data-action="tier-set"][aria-pressed="true"]').focus();
}

function moveTierGame(id, grade, fromPicker = false) {
  const game = games().find(item => item.id === id && !item.hidden);
  if (!game || route.page !== 'stats' || (grade !== '' && !grades.includes(grade))) return;
  const changed = grade !== gradeFor(game);
  if (changed && !saveGrade(game, grade)) return;
  if (fromPicker) dialog.close();
  if (changed) render();
  app.querySelector(`[data-tier-game="${CSS.escape(id)}"] button`)?.focus({ preventScroll: !fromPicker });
}

function gameDashboard() {
  const game = findByRoute(games());
  if (!game) return `<div class="empty"><h2>Игра не найдена</h2><a class="btn btn-secondary" href="#library">К библиотеке</a></div>`;
  const url = '#game/' + encodeURIComponent(game.id);
  const summary = summaryFor(game);
  const grade = gradeFor(game);
  const achievementBox = `<section class="panel dash-panel game-achievements" id="steam-achievements" ${game.steam ? `data-appid="${game.steam.appid}"` : ''}>
    ${panelHeading('trophy','Достижения')}<p class="dash-empty">${game.steam ? 'Загружаем достижения…' : 'Для этой игры нет данных Steam.'}</p></section>`;
  const compact = route.tab === 'overview';
  const tracking = route.ngPlus && isEldenRing(game);
  const notes = notesPanel(game, compact);
  const trophy = trophyFor(summary);
  const content = {
    overview: `<div class="game-overview">${achievementBox}<div>${notes}</div></div>`,
    achievements: achievementBox,
    notes: tracking ? bossTracker(game) : notes + (game.runs.length ?
      `<details class="panel saved-runs"><summary>Прохождения · ${game.runs.length}</summary>${runsPanel(game)}</details>` : '')
  };
  const hero = isEldenRing(game) ? './assets/elden-ring-hero.jpg' : steamHero(game.steam?.appid);
  return `<div class="game-dashboard">
    <section class="game-banner${tracking ? ' game-banner-compact' : ''}">
      ${hero ? `<img class="game-hero-art" src="${esc(hero)}" alt="" referrerpolicy="no-referrer" ${game.steam ? `data-steam-art="${game.steam.appid}" data-art-kind="hero"` : ''}>` : ''}
      <div class="game-identity">
        <a class="back-link" href="#library">${icon('back',22)} Библиотека</a>
        <h1>${isEldenRing(game) ? 'Elden Ring' : esc(displayName(game,true))}</h1>
        ${tracking ? '' : `
        <p>${game.steam ? icon('steam',24) + ' Steam' : esc(game.platform)}</p>
        <div class="detail-actions">
          ${game.steam ? `<a href="https://store.steampowered.com/app/${game.steam.appid}/" target="_blank" rel="noopener noreferrer" class="btn btn-primary">Открыть в Steam ${icon('upRight',21)}</a>` : ''}
          ${statusMenu(game)}
          ${iconButton('favorite',game.favorite ? 'Убрать из избранного' : 'В избранное','bookmark', `aria-pressed="${game.favorite}"`)}
          ${gameMenu(game,true)}
        </div>
        <div class="game-totals"><span>${icon('clock',23)} ${numeric(Math.round(game.steam ? game.steam.minutes / 60 : game.hours))} ч${game.steam ? ' в Steam' : ''}</span>
          <span>${icon('trophy',23)} <span id="game-achievement-count">${summary?.total ? summary.unlocked + ' из ' + summary.total + ' достижений' : 'Достижения'}</span></span>
          <span id="game-trophy" ${trophy ? '' : 'hidden'}>${trophyBadge(trophy)}</span></div>
        <div class="game-grade"><span>Моя оценка</span><div role="group" aria-label="Оценка игры">${grades.map(letter =>
          `<button type="button" class="grade grade-${letter}" data-action="grade" data-value="${letter}" aria-label="Оценка ${letter}" aria-pressed="${grade === letter}">${letter}</button>`).join('')}</div></div>`}
      </div>
    </section>
    <nav class="game-tabs" aria-label="Разделы игры">${gameTabs.map(([id,label]) => `<a href="${url}${id === 'overview' ? '' : '/' + id}" ${route.tab === id ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
    <div class="game-tab-content">${content[route.tab]}</div>
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
    <span><strong>NG+</strong><small>${stats.won} из ${stats.total} целей</small></span>
    ${progressBar(stats.percent)}${icon('right',24)}</a>`;
}

function bossRow(game, boss) {
  const { won, deaths } = bossSummary(game, [boss]);
  const id = `data-id="${esc(boss.id)}"`;
  const type = boss.type ? `<span class="boss-type">${esc(boss.type)}</span>` : '';
  return `<li class="boss-row">
    <button type="button" class="boss-win" data-action="boss-win" ${id} role="checkbox" aria-checked="${Boolean(won)}" aria-label="Побеждён: ${esc(boss.name)}">${won ? icon('check',23) : ''}</button>
    <div class="boss-row-copy">
      <strong>${boss.night ? `<span title="Появляется ночью">${icon('moon',19)}</span> ` : ''}${esc(boss.name)} ${type}</strong>
      <span>${esc(boss.location)}</span>
      ${boss.note ? `<small>${esc(boss.note)}</small>` : ''}
    </div>
    <div class="boss-row-actions">
      ${button('boss-death', '+1 смерть', '', 'secondary', `${id} aria-label="Добавить смерть: ${esc(boss.name)}"`)}
      ${button('boss-map', 'На карте', 'pin', 'secondary', `${id} aria-haspopup="dialog"`)}
      ${deaths ? `<small class="boss-row-deaths">Смертей: ${numeric(deaths)}</small>` : ''}
    </div></li>`;
}

function bossRegionPanel(game, region) {
  const open = bossRegion === region.index;
  const stats = bossSummary(game, region.bosses);
  const filter = region.areas.find(area => area.name === bossArea);
  const areaButton = (name, label) => `<button type="button" data-action="boss-area" data-area="${esc(name)}" aria-pressed="${bossArea === name}">${label}</button>`;
  return `<section class="boss-region">
    <h3><button type="button" class="boss-region-toggle" data-action="boss-region" data-region="${region.index}" aria-expanded="${open}" aria-controls="boss-region-${region.index}">
      ${icon(open ? 'down' : 'right',24)}<span>${esc(region.name)}</span><span>${stats.won}/${stats.total}</span></button></h3>
    <div id="boss-region-${region.index}" ${open ? '' : 'hidden'}>${open ? `
      ${region.areas.length > 1 ? `<div class="boss-area-tabs" role="group" aria-label="Части региона">
        ${areaButton('', 'Все')}${region.areas.map(area => `${areaButton(area.name,`<span>${esc(area.name)}</span> <small>${bossSummary(game, area.bosses).won}/${area.bosses.length}</small>`)}`).join('')}
      </div>` : ''}
      <ul class="boss-list">${(filter?.bosses ?? region.bosses).map(boss => bossRow(game, boss)).join('')}</ul>` : ''}</div>
  </section>`;
}

function drawBossMap() {
  const place = bossMap.maps[bossMapIndex];
  const path = './assets/elden-ring/maps/' + place.file;
  mapDialog.innerHTML = `<section class="boss-map-panel">
    <header><h2 id="boss-map-title">${esc(bossMap.name)}</h2>${iconButton('boss-close-map', 'Закрыть карту', 'x')}</header>
    ${bossMap.maps.length > 1 ? `<div class="boss-area-tabs" role="group" aria-label="Места встречи">${bossMap.maps.map((item,i) =>
      `<button type="button" data-action="boss-map-place" data-place="${i}" aria-pressed="${bossMapIndex === i}">${esc(item.label)}</button>`).join('')}</div>` : ''}
    <a class="boss-map-image" href="${esc(path)}" target="_blank" rel="noopener" aria-label="Открыть карту в полном размере">
      <img src="${esc(path)}" alt="Метка на карте: ${esc(bossMap.name)}" decoding="async" width="1280" height="720"></a>
    <p class="boss-map-error" role="status" hidden>Карта недоступна. Если вы офлайн, откройте её после подключения к сети.</p>
    <footer><p>${esc(place.location || bossMap.location)}</p><a href="https://game-checklists.com/elden-ring/all-bosses/#${esc(place.source)}" target="_blank" rel="noopener noreferrer">Game Checklists ${icon('upRight',15)}</a></footer>
  </section>`;
  const image = mapDialog.querySelector('.boss-map-image img');
  const unavailable = () => {
    if (!image.isConnected) return;
    image.closest('a').hidden = true;
    mapDialog.querySelector('.boss-map-error').hidden = false;
  };
  image.addEventListener('error', unavailable, { once: true });
  if (image.complete && !image.naturalWidth) unavailable();
}

function bossTracker(game) {
  const stats = bossSummary(game);
  const active = bossRegions[bossRegion];
  const pending = [];
  const cleared = [];
  for (const region of bossRegions) {
    if (region === active) continue;
    const { won, total } = bossSummary(game, region.bosses);
    (won === total ? cleared : pending).push(bossRegionPanel(game, region));
  }
  return `<div id="boss-tracker">
    <div class="boss-tracker-main">
      <a class="back-link" href="#game/${encodeURIComponent(game.id)}/notes">${icon('back',22)} К заметкам</a>
      <h2>NG+</h2><p class="boss-subtitle">Боссы по регионам</p>
      <div class="boss-metrics" aria-live="polite">
        <section class="panel boss-metric"><div><strong>${stats.won} из ${stats.total} целей</strong><span>${numeric(stats.percent)}%</span></div>${progressBar(stats.percent)}</section>
        <section class="panel boss-metric boss-death-total"><strong>Смерти</strong><span>${numeric(stats.deaths)} на боссах</span></section>
      </div>
      <div class="boss-regions">${active ? bossRegionPanel(game, active) : ''}${pending.join('')}
        ${cleared.length ? `<details class="boss-region boss-cleared"><summary>Зачищенные · ${cleared.length}</summary><div>${cleared.join('')}</div></details>` : ''}</div>
    </div>
  </div>`;
}

function refreshBossTracker(control) {
  const game = findByRoute(games());
  const current = app.querySelector('#boss-tracker');
  if (!current || !isEldenRing(game)) return;
  current.outerHTML = bossTracker(game);
  if (!control) return;
  const selector = [...control.attributes].filter(attribute => attribute.name.startsWith('data-'))
    .map(attribute => `[${attribute.name}="${CSS.escape(attribute.value)}"]`).join('');
  app.querySelector(`#boss-tracker ${selector}`)?.focus({ preventScroll: true });
}

function updateBossProgress(control, death) {
  const id = control.dataset.id;
  const game = findByRoute(games());
  if (!route.ngPlus || !isEldenRing(game) || !bossById.has(id)) return;
  const saved = game.bossProgress[id] ?? { won: false, deaths: {} };
  let next = { ...saved, won: !saved.won };
  if (death) {
    const key = STORAGE_KEY + ':boss-device';
    try {
      const device = localStorage.getItem(key) || crypto.randomUUID();
      localStorage.setItem(key, device);
      next = { ...saved, deaths: { ...saved.deaths, [device]: Math.min(1000000, (saved.deaths[device] ?? 0) + 1) } };
    } catch {
      notify('Не удалось сохранить смерть на этом устройстве.', true);
      return;
    }
  }
  if (updateGame(game, { bossProgress: { ...game.bossProgress, [id]: next } })) refreshBossTracker(control);
}

function notesPanel(game, compact) {
  const rows = journalOrder(game.journal).slice(0,compact ? 3 : undefined);
  const action = button('new-note', 'Новая заметка','plus');
  const all = compact && rows.length ? `<a class="quiet-link" href="#game/${encodeURIComponent(game.id)}/notes">Все записи ${icon('right',15)}</a>` : '';
  const tracker = isEldenRing(game) ? bossNote(game) : '';
  return `<section class="panel dash-panel journal-panel">${panelHeading('edit', 'Заметки', `<div class="journal-actions">${all}${action}</div>`)}
    ${tracker}
    ${rows.length ? `<ul class="journal-list">${rows.map(item=>`<li>
      <div><strong>${item.date ? dateLabel(item.date) : 'Без даты'}</strong></div>
      ${item.text ? `<p class="notes ${compact ? 'note-preview' : ''}">${esc(item.text)}</p>` : ''}
      ${compact ? '' : iconButton('edit-note', 'Редактировать заметку','edit', `data-id="${esc(item.id)}"`)}
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
  drawAchievements(box, cached, !active && !cached ? 'Подключи Steam в профиле, чтобы загрузить достижения.' : '');
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
    count.textContent = record.unlocked + ' из ' + record.total + ' достижений';
    const badge = document.querySelector('#game-trophy');
    const tier = trophyFor(record);
    if (badge) {
      badge.innerHTML = trophyBadge(tier);
      badge.hidden = !tier;
    }
  }
  if (!box?.isConnected) return;
  displayedAchievements = record;
  const overview = route.tab === 'overview';
  const game = findByRoute(games());
  const action = overview ? `<a href="#game/${encodeURIComponent(game.id)}/achievements" class="quiet-link">Все достижения ${icon('right',14)}</a>` :
    button('achievement-reload', 'Обновить','download','secondary',message === 'Загружаем достижения…' ? 'disabled' : '');
  const hasRarity = record?.items.some(item => Number.isFinite(item.percent));
  box.innerHTML = panelHeading('trophy','Достижения',action) +
    (record?.total ? `<div class="achievement-overview ${trophyFor(record) === 'platinum' ? 'cup-platinum' : ''}"><strong>${record.unlocked} / ${record.total}</strong>
      <div><span>${numeric(achievementPercent(record))}%</span>${progressBar(achievementPercent(record))}</div></div>` : '') +
    (message ? `<p class="dash-empty" role="status">${esc(message)}</p>` : '') +
    (!record?.total && !message ? `<p class="dash-empty">${record ? 'Steam сообщает, что у игры нет достижений.' : 'Данные пока недоступны.'}</p>` : '') +
    (record?.total && !overview ? `<div class="achievement-filters">
      <label class="searchbox">${icon('search',17)}<input type="search" id="achievement-query" aria-label="Поиск по достижениям" placeholder="Найти достижение" value="${esc(achievementQuery)}"></label>
      <select id="achievement-filter" aria-label="Статус достижения">${[['','Все'],['yes','Полученные'],['no','Неполученные']].map(([id,label]) => option(id,label,achievementFilter)).join('')}</select>
      <select id="achievement-sort" aria-label="Сортировка достижений" ${hasRarity ? '' : 'disabled'}>${option('default','Порядок Steam',hasRarity ? achievementSort : 'default')}${hasRarity ? option('rare','Редкие сначала',achievementSort) : ''}</select>
    </div><div class="achievement-options">${record.items.some(item => item.hidden && !item.unlocked) ?
      `<label class="checkbox"><input id="achievement-reveal" type="checkbox" ${revealHidden ? 'checked' : ''}> Показать условия скрытых достижений</label>` : ''}
      ${hasRarity ? '<p class="rarity-label">Проценты показывают долю игроков Steam.</p>' : '<p class="rarity-label">Доли игроков доступны после обновления Worker, если Steam их публикует.</p>'}</div>` : '') +
    (record?.total ? '<div id="achievement-rows"></div>' : '');
  updateAchievementRows();
}

const isRare = item => Number.isFinite(item.percent) && item.percent < 10;

function updateAchievementRows() {
  const target = document.querySelector('#achievement-rows');
  if (!target || !displayedAchievements) return;
  const overview = route.tab === 'overview';
  const query = achievementQuery.trim().toLocaleLowerCase('ru');
  let items = displayedAchievements.items;
  if (overview) items = items.filter(item=>item.unlocked).sort((a,b) => Number(isRare(b)) - Number(isRare(a)) || b.time-a.time).slice(0,16);
  else {
    items = items.filter(item => (!achievementFilter || item.unlocked === (achievementFilter === 'yes')) &&
      (!query || (item.name + ' ' + (item.hidden && !item.unlocked && !revealHidden ? '' : item.description)).toLocaleLowerCase('ru').includes(query)));
    if (achievementSort === 'rare') items.sort((a,b) => (a.percent ?? Infinity) - (b.percent ?? Infinity));
  }
  target.innerHTML = items.length ? `<ul class="achievement-list redesign-achievements">${items.map(item => {
    const concealed = item.hidden && !item.unlocked && !revealHidden;
    return `<li class="${item.unlocked ? (isRare(item) ? 'unlocked rare' : 'unlocked') : ''}">
    <span class="achievement-icon">${icon(item.unlocked ? 'trophy' : 'shield',22)}${item.icon && !concealed ? `<img src="${esc(item.icon)}" data-achievement-icon data-fallback-icon="${esc(item.fallbackIcon)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</span>
    <div><strong>${esc(item.name)}</strong>${concealed ? '<p>Скрытое условие</p>' : item.description ? `<p>${esc(item.description)}</p>` : ''}</div>
    <small>${overview ? (item.unlocked && isRare(item) ? 'Редкое' : '') : Number.isFinite(item.percent) ? `<b>${numeric(item.percent)}%</b>` : ''}${overview ? '' : item.unlocked ? item.time ? steamDate(item.time) : 'Получено' : 'Не получено'}</small>
  </li>`;
  }).join('')}</ul>` : '<p class="dash-empty">Достижения по этим фильтрам не найдены.</p>';
  imageFallbacks(target);
  fitAchievementPreview();
}

function fitAchievementPreview() {
  if (route.page !== 'game' || route.tab !== 'overview') return;
  const rows = [...app.querySelectorAll('.game-overview .achievement-list li')];
  for (const row of rows) row.hidden = false;
  const bottom = document.documentElement.clientHeight - 20;
  const fit = rows.filter(row => row.getBoundingClientRect().bottom + window.scrollY <= bottom).length;
  for (const row of rows.slice(Math.max(2, fit))) row.hidden = true;
}

window.addEventListener('resize', fitAchievementPreview);
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

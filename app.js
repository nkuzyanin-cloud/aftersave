
import {
  STORAGE_KEY, STATUSES, PLATFORMS, load, save, emptyState,
  createGame, exportJSON, importJSON, exportCSV, isEldenRing
} from './data.js';
import { icon } from './icons.js';
import { createCloudSync } from './cloud.js';
import { bossRegions, bossById } from './elden-ring.js';
import { regionArt, bossArt } from './elden-ring-art.js';
import { mergeSteam, fetchLibrary, connect, disconnect, connected, steamCover, steamHeader, steamHero, fetchSteamArtwork,
  fetchAchievements, cachedAchievements, achievementSummaries, achievementIconAlternatives } from './steam.js';

const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const toast = document.querySelector('#toast');
const labels = { library: 'Библиотека', collections: 'Коллекции', settings: 'Настройки', game: 'Игра' };
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
let steamMessage = '';
let steamError = false;
let displayLimit = 24;
let achievementFilter = '';
let achievementLimit = 24;
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
let bossMapScroll = null;
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
  return `<main id="main" tabindex="-1" class="page page-${route.page}">
    ${storageError ? `<div class="alert">${icon('shield',19)}<span>${esc(storageError)}</span><a href="#settings">Восстановить данные</a></div>` : ''}
    ${route.page === 'settings' || route.page === 'collections' ? `<a class="back-link" href="#library">${icon('back',17)} К играм</a>` : ''}
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

const byLastPlayed = (a,b) => (b.steam?.lastPlayed ?? 0) - (a.steam?.lastPlayed ?? 0);

function filtered(source) {
  const query = filter.query.trim().toLocaleLowerCase('ru');
  return source.filter(game => {
    const haystack = [game.title, displayName(game), game.genre, game.platform, game.steam?.appid, ...game.tags].join(' ').toLocaleLowerCase('ru');
    return (!query || query.split(/\s+/).every(term => haystack.includes(term))) &&
      (!filter.status || gameStatus(game) === filter.status);
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
  const trophy = trophyFor(total);
  const status = gameStatus(game);
  const appid = game.steam?.appid;
  const useCapsule = appid && (!game.cover || game.cover === steamCover(appid) ||
    game.cover === `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`);
  return `<article class="game-card ${trophy ? 'cup-' + trophy : ''}">
    <a href="#game/${encodeURIComponent(game.id)}" class="card-link" aria-label="Открыть ${esc(displayName(game))}">
      <div class="card-art">${useCapsule ? wideCover(game, true) : cover(game)}</div>
      <div class="card-body"><div class="card-title"><h3>${esc(displayName(game))}</h3>${trophyBadge(trophy)}</div>
        <div class="card-status">${status ? statusBadge(status) : '<span class="card-no-status">Без статуса</span>'}</div>
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
  return `<div class="library-columns" aria-hidden="true"><span>Игра</span><span>Статус</span><span>Время</span><span>Достижения</span></div>
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
    <select id="status-filter" aria-label="Статус игры">${[['','Статус'],...Object.entries(STATUSES)].map(([id,label])=>option(id,label,filter.status)).join('')}</select>
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
    ${librarySummary()}
    ${route.trophy ? `<div class="cup-filter">${trophyBadge(route.trophy)} <a class="quiet-link" href="#library">${icon('x',16)} Сбросить кубок</a></div>` : ''}
    ${viewControls()}${gameResults(sourceForPage())}
    <footer class="library-footer"><a href="#collections">Коллекции</a><a href="#settings">Настройки</a></footer>
  </section>`;
}

function librarySummary() {
  const linked = games().filter(game => game.steam);
  const hours = linked.reduce((total,game) => total + game.steam.minutes, 0) / 60;
  const completed = linked.filter(game => gameStatus(game) === 'completed').length;
  const perfect = linked.filter(game => trophyFor(summaryFor(game)) === 'platinum').length;
  const metrics = [[numeric(linked.length),'Игр в Steam'],[numeric(Math.round(hours))+' ч','Время в играх'],
    [numeric(completed),'Пройдено'],[numeric(perfect),'Со всеми достижениями']];
  return `<dl id="library-summary" class="library-summary" aria-label="Сводка Steam">${metrics.map(([value,label]) =>
    `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
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
  const views = { library, collections: collectionsPage, settings: settingsPage, game: gamePage };
  const railOffset = app.querySelector('.boss-region-rail')?.scrollLeft;
  app.innerHTML = shell(views[route.page]());
  bindBossTracker(railOffset);

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
  'boss-region': control => {
    const index = Number(control.dataset.region);
    if (index === bossRegion) return;
    bossRegion = index;
    bossArea = '';
    bossMap = null;
    bossMapScroll = null;
    refreshBossTracker(control);
  },
  'boss-scroll': control => {
    const rail = app.querySelector('.boss-region-rail');
    if (!rail) return;
    rail.scrollBy({ left: Number(control.dataset.direction) * rail.clientWidth * .87,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  },
  'boss-area': control => {
    bossArea = control.dataset.area;
    bossMap = null;
    bossMapScroll = null;
    refreshBossTracker(control);
  },
  'boss-win': control => updateBossProgress(control),
  'boss-death': control => updateBossProgress(control, Number(control.dataset.delta)),
  'boss-map': control => {
    bossMap = bossById.get(control.dataset.id);
    bossMapIndex = 0;
    bossMapScroll = matchMedia('(max-width: 860px)').matches ? window.scrollY : null;
    refreshBossVisual();
    const panel = app.querySelector('#boss-visual');
    if (bossMapScroll !== null) panel?.scrollIntoView({ block: 'start', behavior: 'instant' });
    panel?.querySelector('[data-action="boss-close-map"]').focus({ preventScroll: true });
  },
  'boss-map-place': control => {
    bossMapIndex = Number(control.dataset.place);
    refreshBossVisual();
    app.querySelector(`#boss-visual [data-place="${bossMapIndex}"]`)?.focus({ preventScroll: true });
  },
  'boss-close-map': closeBossMap,
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
  if (bossMap && route.ngPlus && !dialog.open) closeBossMap();
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
  bossMap = null;
  bossMapScroll = null;
  if (route.trophy) shelfMode = 'all';
  if (next.id !== previousGameId) {
    bossRegion = 0;
    bossArea = '';
  }


  displayLimit = 24;
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
  if (!repaint || dialog.open) return;
  const summary = app.querySelector('#library-summary');
  if (summary) summary.outerHTML = librarySummary();
  if (['library','collections'].includes(route.page)) renderResults(true);
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
    summaries.find(record => record.appid === game.steam.appid) : undefined;
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
  if (!game) return `<div class="empty"><h2>Игра не найдена</h2><a class="btn btn-secondary" href="#library">К библиотеке</a></div>`;
  const url = '#game/' + encodeURIComponent(game.id);
  const summary = summaryFor(game);
  const achievementBox = `<section class="panel dash-panel game-achievements" id="steam-achievements" ${game.steam ? `data-appid="${game.steam.appid}"` : ''}>
    ${panelHeading('trophy','Достижения')}<p class="dash-empty">${game.steam ? 'Загружаем достижения…' : 'Для этой игры нет данных Steam.'}</p></section>`;
  const tracking = route.ngPlus && isEldenRing(game);
  const trophy = trophyFor(summary);
  const content = route.tab === 'notes'
    ? tracking ? bossTracker(game) : notesPanel(game) + (game.runs.length ?
      `<details class="panel saved-runs"><summary>Прохождения · ${game.runs.length}</summary>${runsPanel(game)}</details>` : '')
    : (isEldenRing(game) ? bossNote(game) : '') + achievementBox;
  const hero = isEldenRing(game) ? './assets/elden-ring-hero.jpg' : steamHero(game.steam?.appid);
  return `<div class="game-dashboard">
    <section class="game-banner${tracking ? ' game-banner-compact' : ' game-banner-showcase'}">
      ${hero ? `<img class="game-hero-art" src="${esc(hero)}" alt="" referrerpolicy="no-referrer" ${game.steam ? `data-steam-art="${game.steam.appid}" data-art-kind="hero"` : ''}>` : ''}
      <div class="game-identity">
        <a class="back-link" href="#library">${icon('back',22)} Библиотека</a>
        <h1>${isEldenRing(game) ? 'Elden Ring' : esc(displayName(game,true))}</h1>
        ${tracking ? '' : `
        <p class="game-platform">${game.steam ? icon('steam',18) + ' Steam' : esc(game.platform)}</p>
        <div class="game-totals"><span>${icon('clock',20)} ${numeric(Math.round(game.steam ? game.steam.minutes / 60 : game.hours))} ч${game.steam ? ' в Steam' : ''}</span>
          <span>${icon('trophy',20)} <span id="game-achievement-count">${summary?.total ? summary.unlocked + ' из ' + summary.total + ' достижений' : 'Достижения'}</span></span>
          <span id="game-trophy" ${trophy ? '' : 'hidden'}>${trophyBadge(trophy)}</span></div>
        <div class="detail-actions">
          ${statusMenu(game)}
          ${iconButton('favorite',game.favorite ? 'Убрать из избранного' : 'В избранное','bookmark', `aria-pressed="${game.favorite}"`)}
          ${gameMenu(game,true)}
        </div>`}
      </div>
    </section>
    ${route.tab === 'notes' || isEldenRing(game) ? `<nav class="game-tabs" aria-label="Разделы игры">
      <a href="${url}" ${route.tab !== 'notes' ? 'aria-current="page"' : ''}>Достижения</a>
      ${isEldenRing(game) ? `<a href="${url}/notes/ng-plus" ${tracking ? 'aria-current="page"' : ''}>NG+</a>` : ''}
      ${route.tab === 'notes' && !tracking ? `<a href="${url}/notes" aria-current="page">Заметки</a>` : ''}
    </nav>` : ''}
    <div class="game-tab-content${tracking ? ' tracker-content' : ''}">${content}</div>
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
    <div class="boss-portrait" aria-hidden="true">${icon('shield',23)}${portrait ? `<img src="${esc(portrait)}" alt="" loading="lazy" decoding="async">` : ''}</div>
    <button type="button" class="boss-win" data-action="boss-win" ${id} role="checkbox" aria-checked="${Boolean(won)}" aria-label="Побеждён: ${esc(boss.name)}">${won ? icon('check',23) : ''}</button>
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
      ${button('boss-map', 'На карте', 'pin', 'secondary', `${id} aria-controls="boss-visual" aria-pressed="${bossMap?.id === boss.id}"`)}
    </div></li>`;
}

function bossRegionPanel(game, region) {
  const stats = bossSummary(game, region.bosses);
  const filter = region.areas.find(area => area.name === bossArea);
  const remaining = [];
  const defeated = [];
  for (const boss of filter?.bosses ?? region.bosses) {
    (game.bossProgress[boss.id]?.won ? defeated : remaining).push(boss);
  }
  const areaButton = (name, label) => `<button type="button" data-action="boss-area" data-area="${esc(name)}" aria-pressed="${bossArea === name}">${label}</button>`;
  return `<section id="boss-region-bosses" class="boss-region panel" aria-label="Боссы выбранного региона">
    <header class="boss-region-head"><h3>${esc(region.name)}</h3><span>${stats.won}/${stats.total}</span></header>
    ${region.areas.length > 1 ? `<div class="boss-area-tabs" role="group" aria-label="Части региона">
      ${areaButton('', 'Все')}${region.areas.map(area =>
        areaButton(area.name,`<span>${esc(area.name)}</span> <small>${bossSummary(game, area.bosses).won}/${area.bosses.length}</small>`)).join('')}
    </div>` : ''}
    <ul class="boss-list">${[...remaining, ...defeated].map(boss => bossRow(game, boss)).join('')}</ul>
  </section>`;
}

function bossVisual(region) {
  if (!bossMap) {
    const art = regionArt[region.index];
    const scene = art ? `<img src="${esc(art.image)}" alt="Пейзаж: ${esc(region.name)}" decoding="async">` :
      `<div class="boss-art-empty">${icon('image',27)}<span>Пейзаж недоступен</span></div>`;
    return `<aside id="boss-visual" class="boss-visual"><figure class="boss-scenery">
      ${scene}
      ${art ? `<figcaption><a href="${esc(art.source)}" target="_blank" rel="noopener noreferrer">Источник пейзажа ${icon('upRight',12)}</a></figcaption>` : ''}
    </figure></aside>`;
  }
  const place = bossMap.maps[bossMapIndex];
  const path = './assets/elden-ring/maps/' + place.file;
  return `<aside id="boss-visual" class="boss-visual boss-map-panel" aria-label="Карта босса">
    <header><h2>${esc(bossMap.name)}</h2>${iconButton('boss-close-map', 'Вернуться к пейзажу', 'x')}</header>
    ${bossMap.maps.length > 1 ? `<div class="boss-area-tabs" role="group" aria-label="Места встречи">${bossMap.maps.map((item,i) =>
      `<button type="button" data-action="boss-map-place" data-place="${i}" aria-pressed="${bossMapIndex === i}">${esc(item.label)}</button>`).join('')}</div>` : ''}
    <a class="boss-map-image" href="${esc(path)}" target="_blank" rel="noopener" aria-label="Открыть карту в полном размере">
      <img src="${esc(path)}" alt="Метка на карте: ${esc(bossMap.name)}" decoding="async" width="1280" height="720"></a>
    <p class="boss-map-error" role="status" hidden>Карта недоступна. Если вы офлайн, откройте её после подключения к сети.</p>
    <footer><p>${esc(place.location || bossMap.location)}</p><a href="https://game-checklists.com/elden-ring/all-bosses/#${esc(place.source)}" target="_blank" rel="noopener noreferrer">Game Checklists ${icon('upRight',15)}</a></footer>
  </aside>`;
}

function bindBossVisual() {
  const image = app.querySelector('.boss-map-image img');
  if (!image) return;
  const unavailable = () => {
    if (!image.isConnected) return;
    image.closest('a').hidden = true;
    image.closest('aside').querySelector('.boss-map-error').hidden = false;
  };
  image.addEventListener('error', unavailable, { once: true });
  if (image.complete && !image.naturalWidth) unavailable();
}

function refreshBossVisual() {
  const visual = app.querySelector('#boss-visual');
  if (!visual) return;
  visual.outerHTML = bossVisual(bossRegions[bossRegion]);
  bindBossVisual();
  for (const button of app.querySelectorAll('[data-action="boss-map"]')) {
    button.setAttribute('aria-pressed', String(button.dataset.id === bossMap?.id));
  }
}

function closeBossMap() {
  if (!bossMap) return;
  const id = bossMap.id;
  const offset = bossMapScroll;
  bossMap = null;
  bossMapScroll = null;
  refreshBossVisual();
  if (offset !== null) window.scrollTo({ top: offset, behavior: 'instant' });
  app.querySelector(`[data-action="boss-map"][data-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
}

function bossRegionCard(game, region) {
  const stats = bossSummary(game, region.bosses);
  const art = regionArt[region.index];
  return `<button type="button" class="boss-region-card" data-action="boss-region" data-region="${region.index}"
    aria-pressed="${bossRegion === region.index}" aria-controls="boss-region-bosses">
    ${art ? `<img src="${esc(art.thumb ?? art.image)}" alt="" loading="lazy" decoding="async">` : ''}
    <span><strong>${esc(region.name)}</strong><small>${stats.won === stats.total ? icon('check',14) : ''}${stats.won}/${stats.total}</small></span>
  </button>`;
}

function bossTracker(game) {
  const stats = bossSummary(game);
  const active = bossRegions[bossRegion];
  return `<div id="boss-tracker">
    <div class="boss-tracker-bar">
      <a class="back-link" href="#game/${encodeURIComponent(game.id)}/notes">${icon('back',22)} К заметкам</a>
      <h2>NG+</h2>
      <div class="boss-tracker-progress"><strong>${stats.won} из ${stats.total} целей</strong>${progressBar(stats.percent)}<span>${numeric(stats.percent)}%</span></div>
      <div class="boss-death-total" aria-live="polite"><small>Смерти</small><span><strong>${numeric(stats.deaths)}</strong> на боссах</span></div>
    </div>
    <div class="boss-region-picker">
      ${iconButton('boss-scroll','Предыдущие регионы','left','data-direction="-1" aria-controls="boss-region-rail"')}
      <div id="boss-region-rail" class="boss-region-rail" role="group" aria-label="Регионы">${bossRegions.map(region => bossRegionCard(game, region)).join('')}</div>
      ${iconButton('boss-scroll','Следующие регионы','right','data-direction="1" aria-controls="boss-region-rail"')}
    </div>
    <div class="boss-workspace">${bossVisual(active)}${bossRegionPanel(game, active)}</div>
  </div>`;
}

function bindBossTracker(railOffset) {
  const rail = app.querySelector('.boss-region-rail');
  if (!rail) return;
  rail.scrollLeft = railOffset ?? rail.querySelector('[aria-pressed="true"]')?.offsetLeft ?? 0;
  const previous = app.querySelector('[data-action="boss-scroll"][data-direction="-1"]');
  const next = app.querySelector('[data-action="boss-scroll"][data-direction="1"]');
  const syncArrows = () => {
    previous.disabled = rail.scrollLeft <= 1;
    next.disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1;
  };
  rail.addEventListener('scroll', syncArrows, { passive: true });
  syncArrows();
  bindBossVisual();
}

function refreshBossTracker(control) {
  const game = findByRoute(games());
  const current = app.querySelector('#boss-tracker');
  if (!current || !isEldenRing(game)) return;
  const railOffset = current.querySelector('.boss-region-rail').scrollLeft;
  current.outerHTML = bossTracker(game);
  imageFallbacks(app.querySelector('#boss-tracker'));
  bindBossTracker(railOffset);
  if (!control) return;
  const selector = [...control.attributes].filter(attribute => attribute.name.startsWith('data-'))
    .map(attribute => `[${attribute.name}="${CSS.escape(attribute.value)}"]`).join('');
  const target = app.querySelector(`#boss-tracker ${selector}`);
  const focus = target?.disabled ? target.parentElement.querySelector('button:not(:disabled)') : target;
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
  if (updateGame(game, { bossProgress: { ...game.bossProgress, [id]: next } })) refreshBossTracker(control);
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

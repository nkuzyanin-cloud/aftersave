
import {
  STORAGE_KEY, STATUSES, PLATFORMS, load, save, emptyState,
  createGame, exportJSON, importJSON, exportCSV, searchCatalog, searchOnlineCatalog
} from './data.js';
import { icon } from './icons.js';
import { mergeSteam, fetchLibrary, connect, disconnect, connected, steamCover, steamHeader, steamHero, fetchSteamArtwork,
  fetchAchievements, cachedAchievements, achievementSummaries } from './steam.js';

const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const toast = document.querySelector('#toast');
const labels = { library: 'Библиотека', wishlist: 'Список желаний', collections: 'Коллекции',
  stats: 'Статистика', profile: 'Профиль', settings: 'Настройки', game: 'Игра' };
const navigation = [
  ['library', 'library'], ['collections', 'layers'], ['wishlist', 'bookmark'], ['stats', 'chart']
];
const personal = [['profile', 'user'], ['settings', 'settings']];
const filter = { query: '', status: '', platform: '', tag: '', collection: '', sort: 'recent', view: 'grid' };
const number = new Intl.NumberFormat('ru', { maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', year: 'numeric' });

let state;
let storageError = '';
try { state = load(); } catch (error) { state = emptyState(); storageError = error.message; }
let shelfMode = 'shelf';
let achievementQuery = '';
let achievementSort = 'rare';
let revealHidden = false;
let openFavorites = false;
const gameTabs = [['overview', 'Обзор', 'game'], ['achievements', 'Достижения', 'trophy'],
  ['sessions', 'Сессии', 'clock'], ['notes', 'Заметки', 'edit']];
let toastTimer;
let route = getRoute();
let catalogController;
let storagePending = false;
let legacySteam = false;
let syncingSteam = false;
let steamMessage = '';
let steamError = false;
let steamScope = '';
let displayLimit = 24;
let achievementFilter = '';
let achievementView = 0;
let summaries = [];
let summaryAccount = null;
let scanningAchievements = false;
let stopAchievementScan = false;
let scanMessage = '';
const gameHours = game => Math.max(game.hours, (game.steam?.minutes ?? 0) / 60);
const steamDate = value => value ? dateFormat.format(new Date(value * 1000)) : '—';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const numeric = value => number.format(value);
const percent = value => Math.min(100, Math.max(0, Number(value) || 0));
const games = () => state.games;
const collections = () => state.collections;
const profile = () => state.profile;
const coverUrl = value => {
  if (/^\.?\/?assets\/covers\/[a-z0-9-]+\.jpg$/i.test(value ?? '')) return './' + value.replace(/^\.?\//, '');
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch { return ''; }
};

function getRoute() {
  const [page, id, tab] = location.hash.slice(1).split('/');
  return { page: Object.hasOwn(labels, page) ? page : 'library', id,
    tab: ['achievements', 'sessions', 'notes'].includes(tab) ? tab : 'overview' };
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

function navLink([page, glyph]) {
  const active = route.page === page || (page === 'library' && route.page === 'game');
  return `<a class="nav-link ${active ? 'active' : ''}" href="#${page}" ${active ? 'aria-current="page"' : ''}>
    ${icon(glyph, 19)}<span>${labels[page]}</span>${active ? '<i></i>' : ''}
  </a>`;
}

function initials(value) {
  return (value || 'Игрок').trim().split(/\s+/).slice(0, 2).map(part => [...part][0]).join('').toUpperCase();
}

function shell(content) {
  const activeLabel = route.page === 'game' ? 'Игра' : labels[route.page];
  const activeProfile = profile();
  return `<aside class="sidebar">
    <a class="brand" href="#library" aria-label="AFTERSAVE, библиотека"><span class="brand-icon">${icon('brand', 23)}</span>
      <span class="wordmark">AFTERSAVE<span>.</span><small>ИГРОВОЙ ЖУРНАЛ</small></span></a>
    <div class="sidebar-group"><div class="nav-label">ПРОСТРАНСТВО</div>
      <nav aria-label="Игровая библиотека">${navigation.map(navLink).join('')}</nav></div>
    <div class="sidebar-group sidebar-personal"><div class="nav-label">ЛИЧНОЕ</div>
      <nav aria-label="Личные настройки">${personal.map(navLink).join('')}</nav></div>
    <div class="sidebar-footer">
      <div class="storage-card"><span class="storage-icon">${icon('shield', 17)}</span><div>
      <strong>Локальное хранилище</strong><small>Данные на этом устройстве</small></div></div>
      <div class="sidebar-version"><span>AFTERSAVE / V.05</span><span>◆</span></div>
    </div>
  </aside>
  <div class="workspace">
    <header class="topbar">
      <a class="mobile-brand brand" href="#library"><span class="brand-icon">${icon('brand', 21)}</span><span class="wordmark">AFTERSAVE<span>.</span></span></a>
      <div class="crumb"><span>Рабочее пространство</span>${icon('right', 13)}<strong>${activeLabel}</strong></div>
      <div class="top-actions">
        <label class="searchbox">${icon('search', 18)}<input id="global-search" type="search" placeholder="Найти в библиотеке" aria-label="Поиск по библиотеке" value="${esc(filter.query)}"><kbd>/</kbd></label>
        ${iconButton('mobile-search', 'Поиск по библиотеке', 'search', 'id="mobile-search"')}
        <a href="#profile" class="avatar-link" aria-label="Профиль"><span class="avatar">${esc(initials(activeProfile?.name))}</span></a>
      </div>
    </header>
    <main id="main" tabindex="-1" class="page">
      ${storageError ? `<div class="alert">${icon('shield', 19)}<span>${esc(storageError)}</span><a href="#settings">Восстановить данные</a></div>` : ''}
      ${content}
    </main>
  </div>
  <nav class="mobile-nav" aria-label="Основная навигация">${[...navigation, personal[1]].map(navLink).join('')}</nav>`;
}

function statusBadge(status) {
  return `<span class="status status-${esc(status)}"><i></i>${esc(STATUSES[status])}</span>`;
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



function metrics(source) {
  const hours = source.reduce((sum, game) => sum + gameHours(game), 0);
  const finished = source.filter(game => game.status === 'completed' || game.status === 'perfect').length;
  const playing = source.filter(game => game.status === 'playing').length;
  return `<div class="metrics">
    ${[['game', 'Игры в библиотеке', source.length, 'lime'], ['clock', 'Часы в играх', hours, 'violet'],
      ['trophy', 'Пройдено', finished, 'amber'], ['pulse', 'Сейчас играю', playing, 'aqua']]
      .map(([glyph, title, value, tone]) => `<div class="metric"><span class="metric-icon ${tone}">${icon(glyph, 21)}</span>
      <div><span class="metric-label">${title}</span><strong>${numeric(value)}</strong></div></div>`).join('')}
  </div>`;
}

function header(kicker, title, description, actions = '') {
  return `<div class="section-heading"><div><div class="eyebrow"><i></i>${kicker}</div><h1>${title}</h1>
    <p>${description}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ''}</div>`;
}

function filtered(source) {
  const query = filter.query.trim().toLocaleLowerCase('ru');
  const result = source.filter(game => {
    const haystack = [game.title, game.genre, game.platform, game.steam?.appid, ...game.tags].join(' ').toLocaleLowerCase('ru');
    return (!query || query.split(/\s+/).every(term => haystack.includes(term))) &&
      (!filter.status || (game.shelf && game.status === filter.status)) &&
      (!filter.platform || game.platform === filter.platform) &&
      (!filter.tag || game.tags.includes(filter.tag)) &&
      (!filter.collection || game.collectionIds.includes(filter.collection)) &&
      (steamScope !== 'steam' || game.steam) && (steamScope !== 'favorite' || game.favorite) &&
      (steamScope !== 'played' || game.steam?.lastPlayed);
  });
  const sorts = {
    title: (a, b) => a.title.localeCompare(b.title, 'ru'),
    hours: (a, b) => gameHours(b) - gameHours(a),
    lastPlayed: (a, b) => (b.steam?.lastPlayed ?? 0) - (a.steam?.lastPlayed ?? 0),
    rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1),
    progress: (a, b) => b.progress - a.progress
  };
  if (filter.sort === 'recent') return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) ||
    (b.steam?.lastPlayed ?? 0) - (a.steam?.lastPlayed ?? 0));
  return sorts[filter.sort] ? result.sort(sorts[filter.sort]) : result;
}

function gameCard(game, compact = false) {
  const total = summaryFor(game);
  const achieved = total?.total ? Math.round(total.unlocked / total.total * 100) : null;
  return `<article class="game-card ${compact ? 'compact-card' : ''}">
    <a href="#game/${encodeURIComponent(game.id)}" class="card-link" aria-label="Открыть ${esc(game.title)}">
      <div class="card-art">${cover(game)}${game.shelf ? statusBadge(game.status) : ''}</div>
      <div class="card-body"><h3>${esc(game.title)}</h3>
        <div class="card-meta"><span>${icon('clock', 14)} ${numeric(gameHours(game))} ч</span></div>
        <div class="card-progress"><span>${icon('trophy', 13)} ${total?.total ? total.unlocked + ' / ' + total.total : '—'}</span>
          ${achieved === null ? '' : `<strong>${achieved}%</strong>`}</div>
        ${achieved === null ? '<div class="progress-track"></div>' : progressBar(achieved)}
      </div>
    </a>
    ${compact ? '' : `<div class="card-tools">${iconButton('favorite', game.favorite ? 'Убрать из избранного' : 'В избранное', 'star',
      `data-id="${esc(game.id)}" aria-pressed="${game.favorite}"`)}${iconButton('hide-game', game.hidden ? 'Вернуть игру' : 'Скрыть игру',
      game.hidden ? 'eye' : 'eyeOff', `data-id="${esc(game.id)}"`)}</div>`}
  </article>`;
}

function gameList(source) {
  const result = filtered(source);
  if (!result.length) {
    const isFiltered = Boolean(filter.query || filter.status || filter.platform || filter.tag || filter.collection || steamScope);
    return `<div class="empty"><span class="empty-icon">${icon(isFiltered ? 'search' : 'game', 29)}</span>
      <h2>${isFiltered ? 'Игры не найдены' : 'Здесь пока пусто'}</h2>
      <p>${isFiltered ? 'Попробуйте другой запрос или сбросьте фильтры.' :
        route.page === 'library' && shelfMode === 'hidden' ? 'Скрытые игры можно вернуть в библиотеку в любой момент.' :
        route.page === 'library' && shelfMode === 'shelf' ? 'Добавьте игру или выставьте статус любой игре из полного списка.' :
        'Добавьте игру из каталога или заполните карточку вручную.'}</p>
      ${isFiltered ? button('clear-filters', 'Сбросить фильтры', 'x') :
        route.page === 'library' && shelfMode === 'hidden' ? button('shelf', 'Все игры', 'library', 'secondary', 'data-value="all"') :
        button('add', 'Добавить игру', 'plus', 'primary')}</div>`;
  }
  return `<div class="game-grid ${filter.view === 'list' ? 'list-view' : ''}">${result.slice(0, displayLimit).map(gameCard).join('')}</div>
    ${result.length > displayLimit ? `<div class="load-more">${button('more-games', 'Показать ещё игры', 'down')}</div>` : ''}`;
}

function option(value, title, selected) {
  return `<option value="${esc(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${esc(title)}</option>`;
}

function viewControls(source) {
  const platforms = [...new Set(source.map(game => game.platform))].sort();
  const tags = [...new Set(source.flatMap(game => game.tags))].sort((a, b) => a.localeCompare(b, 'ru'));
  return `<div class="library-controls">
    <div class="tabs" aria-label="Статус игры">${[['', 'Любой статус'], ...Object.entries(STATUSES)].map(([value, label]) =>
      `<button type="button" class="tab ${filter.status === value ? 'selected' : ''}" data-action="status" data-value="${value}" aria-pressed="${filter.status === value}">${label}</button>`).join('')}</div>
    <div class="filter-actions">
      ${iconButton('filters', 'Платформы, теги и коллекции', 'filter', `aria-controls="advanced-filters" aria-expanded="${Boolean(filter.advanced || filter.platform || filter.tag || filter.collection)}" aria-pressed="${Boolean(filter.platform || filter.tag || filter.collection)}"`)}
      <label class="sort-select">${icon('sort', 16)}<select id="sort" aria-label="Сортировка">${[
        ['recent', 'Недавние'], ['lastPlayed', 'Запуск Steam'], ['title', 'По названию'], ['hours', 'По часам'], ['rating', 'По оценке'], ['progress', 'По прогрессу']
      ].map(([value, title]) => option(value, title, filter.sort)).join('')}</select></label>
      <div class="view-switch" aria-label="Вид библиотеки">
        ${iconButton('grid', 'Карточки', 'library', `aria-pressed="${filter.view === 'grid'}"`)}
        ${iconButton('list', 'Список', 'list', `aria-pressed="${filter.view === 'list'}"`)}
      </div>
    </div>
  </div>
  <div id="advanced-filters" class="advanced-filters" ${filter.advanced || filter.platform || filter.tag || filter.collection ? '' : 'hidden'}>
    <label><span>Платформа</span><select id="platform-filter">${option('', 'Все платформы', filter.platform)}${platforms.map(value => option(value, value, filter.platform)).join('')}</select></label>
    <label><span>Тег</span><select id="tag-filter">${option('', 'Все теги', filter.tag)}${tags.map(value => option(value, value, filter.tag)).join('')}</select></label>
    <label><span>Коллекция</span><select id="collection-filter">${option('', 'Все коллекции', filter.collection)}${collections().map(value => option(value.id, value.name, filter.collection)).join('')}</select></label>
    <label><span>Подборка</span><select id="steam-filter">${[['','Все игры'],['steam','Библиотека Steam'],['played','Запускались в Steam'],['favorite','Избранное']].map(([value,label]) => option(value,label,steamScope)).join('')}</select></label>
    ${button('clear-filters', 'Сбросить', 'x')}
  </div>`;
}

function sourceForPage() {
  if (route.page === 'library') return games().filter(game => shelfMode === 'hidden' ? game.hidden :
    !game.hidden && (shelfMode === 'all' || game.shelf));
  if (route.page === 'wishlist') return games().filter(game => !game.hidden && game.wishlist);
  if (route.page === 'collections' && route.id) {
    const collection = findByRoute(collections());
    return collection ? games().filter(game => game.collectionIds.includes(collection.id)) : [];
  }
  return games();
}

function gameResults(source) {
  return `<div id="game-results"><div class="results-count" aria-live="polite"><span>${filtered(source).length}</span> из ${source.length} игр</div>${gameList(source)}</div>`;
}

function library() {
  const source = sourceForPage();
  const visible = games().filter(game => !game.hidden);
  const options = [['shelf','Моя полка',visible.filter(game => game.shelf).length],['all','Все игры',visible.length],
    ['hidden','Скрытые',games().length - visible.length]];
  return `<section class="library-section">
    ` + header('КОЛЛЕКЦИЯ', 'Библиотека', 'Личные записи и игры из Steam', button('add', 'Добавить игру', 'plus', 'primary')) + `
    ${dashboardMetrics(visible, visible.filter(game => game.shelf && game.status === 'playing'))}
    <div class="shelf-switch" aria-label="Раздел библиотеки">${options.map(([id,label,count]) =>
      `<button type="button" data-action="shelf" data-value="${id}" aria-pressed="${shelfMode === id}">${label} <small>${count}</small></button>`).join('')}</div>
    ${viewControls(source)}${gameResults(source)}
  </section>`;
}

function wishlistPage() {
  const source = sourceForPage();
  return `${header('ПЛАНЫ', labels.wishlist, 'Игры, к которым хочется вернуться позже.', button('add-wish', 'Добавить игру', 'plus', 'primary'))}
    ${viewControls(source)}${gameResults(source)}`;
}

function collectionsPage() {
  const collection = findByRoute(collections());
  if (collection) {
    const source = sourceForPage();
    const actions = button('edit-collection', 'Редактировать', 'edit', 'secondary', `data-id="${esc(collection.id)}"`);
    return `<a class="back-link" href="#collections">${icon('back', 17)} Все коллекции</a>
      ${header('ПОДБОРКА', esc(collection.name), 'Игры из этой коллекции.', actions)}
      ${viewControls(source)}${gameResults(source)}`;
  }
  const list = collections();
  return `${header('ПОДБОРКИ', labels.collections, 'Группируй игры по серии, настроению или любому другому принципу.', button('new-collection', 'Новая коллекция', 'plus', 'primary'))}
    ${list.length ? `<div class="collection-grid">${list.map(item => {
      const grouped = games().filter(game => game.collectionIds.includes(item.id));
      return `<a href="#collections/${encodeURIComponent(item.id)}" class="collection-card panel">
        <div class="collection-covers">${grouped.length ? grouped.slice(0, 3).map(game => cover(game)).join('') : icon('layers', 40)}</div>
        <div><h2>${esc(item.name)}</h2><p>${grouped.length} игр</p></div><span class="collection-arrow">${icon('upRight', 22)}</span></a>`;
    }).join('')}</div>` : `<div class="empty"><span class="empty-icon">${icon('layers', 28)}</span><h2>Собери первую подборку</h2>
      <p>Игры можно добавить в коллекцию при редактировании карточки.</p>${button('new-collection', 'Новая коллекция', 'plus', 'primary')}</div>`}`;
}


function dateLabel(value) {
  if (!value) return '—';
  const date = new Date(value + 'T12:00:00');
  return Number.isNaN(date.valueOf()) ? '—' : dateFormat.format(date);
}

function gamePage() { return gameDashboard(); }

function statsPage() {
  const source = games();
  const chartColors = ['#9c90d7', '#c9f178', '#6ed3a4', '#f696a7', '#f4bd73'];
  const counts = Object.entries(STATUSES).map(([status, label], index) => ({
    label, color: chartColors[index], count: source.filter(game => game.status === status).length
  }));
  let angle = 0;
  const segments = counts.filter(item => item.count > 0).map(item => {
    const start = angle;
    angle += item.count / source.length * 360;
    return `${item.color} ${start}deg ${angle}deg`;
  });
  const platformHours = new Map();
  source.forEach(game => platformHours.set(game.platform, (platformHours.get(game.platform) || 0) + gameHours(game)));
  const hours = [...platformHours.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const totalRated = source.filter(game => game.rating !== null);
  const average = totalRated.length ? totalRated.reduce((sum, game) => sum + game.rating, 0) / totalRated.length : 0;
  const best = [...totalRated].sort((a, b) => b.rating - a.rating).slice(0, 4);
  return `${header('ОБЗОР', labels.stats, 'Прогресс и привычки в цифрах.')}
    ${metrics(source)}${steamStats()}
    <div class="charts">
      <section class="panel chart-panel"><h2>По статусам</h2><p>Как распределены игры</p>
        <div class="donut-layout"><div class="donut" style="--segments:${segments.join(', ') || '#2b2e3b 0deg 360deg'}" aria-hidden="true"><strong>${source.length}<small>ИГР</small></strong></div>
          <ul class="chart-legend">${counts.map(item => `<li><i style="background:${item.color}"></i><span>${item.label}</span><strong>${item.count}</strong></li>`).join('')}</ul></div></section>
      <section class="panel chart-panel"><h2>Часы по платформам</h2><p>Где проведено больше времени</p>
        ${hours.length ? `<ul class="bar-chart">${hours.map(([platform, value]) => `<li>
          <div><span>${esc(platform)}</span><strong>${numeric(value)} ч</strong></div>
          <div class="bar-track"><span style="width:${hours[0][1] ? value / hours[0][1] * 100 : 0}%"></span></div></li>`).join('')}</ul>` : '<p class="chart-empty">Появится после добавления игр и часов.</p>'}</section>
      <section class="panel chart-panel rating-panel"><h2>Оценки</h2><p>${best.length ? `Средняя оценка <strong>${numeric(average)} / 10</strong> · Оценено игр ${totalRated.length}` : 'Добавь оценки к своим играм, чтобы увидеть средний балл.'}</p>
        ${best.length ? `<div class="top-games">${best.map(game => `<a href="#game/${encodeURIComponent(game.id)}">${cover(game)}<span>${esc(game.title)}</span><strong>${icon('star', 15)} ${numeric(game.rating)}</strong></a>`).join('')}</div>` : ''}</section>
    </div>`;
}

function profilePage() { return profileDashboard(); }

function settingsPage() {
  return `${header('ЛИЧНОЕ', labels.settings, 'Данные библиотеки, резервные копии и установка приложения.')}
    <div class="settings-grid">
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
        <p>Steam подключается через Worker. PlayStation Network и Xbox ведутся вручную.</p>${steamPanel()}</section>
    </div>`;
}

function render(focusMain = false) {
  const views = { library, wishlist: wishlistPage, collections: collectionsPage, stats: statsPage, profile: profilePage, settings: settingsPage, game: gamePage };
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
  catalogController?.abort();
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
let candidates = [];
let wishDefault = false;

function openCatalog(wishlist = false) {
  wishDefault = wishlist;
  showDialog('Добавить игру', 'НОВАЯ ЗАПИСЬ', `<div class="dialog-body catalog-body">
    <p>Выбери игру из встроенного каталога или создай карточку вручную.</p>
    <div class="catalog-search-form">
      <label class="searchbox">${icon('search', 18)}<input id="catalog-query" type="search" maxlength="120" placeholder="Например, Elden Ring" aria-label="Поиск в каталоге" autofocus></label>
      <button type="button" class="btn btn-secondary" id="online-search" data-action="online-catalog">${icon('globe', 16)} Поиск в Wikidata</button>
    </div>
    <div id="catalog-status" class="catalog-status" role="status"></div>
    <div id="catalog-results" class="catalog-results"></div>
    <div class="catalog-footer">${button('manual-game', 'Добавить вручную', 'edit', 'primary')}</div></div>`, 'catalog-dialog');
  renderCatalog(searchCatalog(''), 'ВСТРОЕННЫЙ КАТАЛОГ');
}

function renderCatalog(items, label, message = '') {
  const results = dialog.querySelector('#catalog-results');
  if (!results) return;
  candidates = items;
  dialog.querySelector('#catalog-status').textContent = message || label;
  results.innerHTML = items.map((game, index) => `<button type="button" class="catalog-item" data-action="choose-game" data-index="${index}">
      ${cover(game)}<span><strong>${esc(game.title)}</strong><small>${[game.genre || game.description, game.year, game.platform].filter(Boolean).map(esc).join(' · ')}</small></span>${icon('plus', 18)}</button>`).join('');
}

function openGameForm(game = {}, editing = false) {
  draft = { editing, game };
  const title = editing ? 'Редактировать игру' : 'Новая игра';
  const knownPlatform = game.platform || 'PC';
  const platforms = [...new Set([...PLATFORMS, knownPlatform])];
  showDialog(title, 'ИГРОВОЙ ЖУРНАЛ', `<form id="game-form"><div class="dialog-body form-grid">
    ${inputField('Название', 'title', game.title, 'required maxlength="160" autofocus')}
    <label class="field"><span>Платформа</span><select name="platform">${platforms.map(value => option(value, value, knownPlatform)).join('')}</select></label>
    <label class="field"><span>Статус</span><select name="status">
      ${editing && !game.shelf ? option('', 'Без статуса', '') : ''}
      ${Object.entries(STATUSES).map(([value, label]) => option(value, label, editing && !game.shelf ? '' : game.status || 'planned')).join('')}</select></label>
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

function openProfileForm() {
  showDialog('Редактировать профиль', 'ЛИЧНОЕ', `<form id="profile-form">
    <div class="dialog-body single-form">${inputField('Имя', 'name', state.profile.name, 'required maxlength="64" autofocus')}
      <label class="field"><span>О себе</span><textarea name="bio" maxlength="500" rows="4" placeholder="Во что любишь играть?">${esc(state.profile.bio)}</textarea></label>
      ${errorLine()}</div>${formFooter('Сохранить')}</form>`);
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
  steamScope = '';
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

function dateStamp() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}


const actions = {
  'more-games': () => { displayLimit += 24; renderResults(true); },
  'steam-sync': () => steamSync(),
  'steam-entry': steamEntry,
  'open-favorites': () => { openFavorites = true; go('library'); },
  'shelf': control => { shelfMode = control.dataset.value; displayLimit = 24; render(); },
  'hide-game': control => {
    const game = state.games.find(item => item.id === control.dataset.id) ?? findByRoute(state.games);
    if (game && updateGame(game, { hidden: !game.hidden }, game.hidden ? 'Игра возвращена' : 'Игра скрыта')) render();
  },
  'new-session': () => openJournal('sessions'),
  'edit-session': control => openJournal('sessions', control.dataset.id),
  'new-note': () => openJournal('journal'),
  'edit-note': control => openJournal('journal', control.dataset.id),
  'delete-journal': control => deleteJournal(control.dataset.kind, control.dataset.id),
  'steam-connect': openSteamLogin,
  'steam-disconnect': () => { disconnect(); legacySteam = false; stopAchievementScan = true; render(); },
  'steam-legacy': openSteamLegacy,
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
  'add': () => openCatalog(),
  'add-wish': () => openCatalog(true),
  'online-catalog': searchOnline,
  'manual-game': () => openGameForm({ title: dialog.querySelector('#catalog-query')?.value.trim(), wishlist: wishDefault }),
  'choose-game': control => {
    const item = candidates[Number(control.dataset.index)];
    if (item) openGameForm({ ...item, catalogId: item.id, id: undefined, wishlist: wishDefault });
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
  'wish': control => {
    const game = state.games.find(item => item.id === control.dataset.id);
    if (!game) return;
    const next = state.games.map(item => item.id === game.id ?
      { ...item, wishlist: !item.wishlist, updatedAt: new Date().toISOString() } : item);
    if (commit({ ...state, games: next }, game.wishlist ? 'Удалено из списка желаний' : 'Добавлено в список желаний')) render();
  },
  'status': control => {
    filter.status = control.dataset.value;
    app.querySelectorAll('.tab').forEach(item => {
      item.classList.toggle('selected', item === control);
      item.setAttribute('aria-pressed', String(item === control));
    });
    renderResults();
  },
  'filters': control => {
    const advanced = app.querySelector('.advanced-filters');
    filter.advanced = advanced.hidden;
    advanced.hidden = !filter.advanced;
    control.setAttribute('aria-expanded', String(filter.advanced));
  },
  'grid': () => { filter.view = 'grid'; render(); app.querySelector('[data-action="grid"]')?.focus(); },
  'list': () => { filter.view = 'list'; render(); app.querySelector('[data-action="list"]')?.focus(); },
  'clear-filters': () => { clearFilters(); render(); },
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
  'edit-profile': openProfileForm,
  'export-json': () => download(`aftersave-${dateStamp()}.json`, exportJSON(state), 'application/json;charset=utf-8'),
  'export-csv': () => download(`aftersave-${dateStamp()}.csv`, exportCSV(state), 'text/csv;charset=utf-8'),
  'import-json': () => app.querySelector('#backup-file')?.click(),
  'close-dialog': () => dialog.close(),
  'mobile-search': () => {
    const search = app.querySelector('.topbar .searchbox');
    const field = search.querySelector('input');
    if (search.classList.toggle('search-open')) field.focus();
    else field.blur();
  }
};

document.addEventListener('click', event => {
  const control = event.target.closest('[data-action]');
  const action = control?.dataset.action;
  if (Object.hasOwn(actions, action)) actions[action](control);
});

document.addEventListener('input', event => {
  if (event.target.id === 'global-search') {
    filter.query = event.target.value;
    if (!app.querySelector('#game-results')) {
      searchPending = true;
      go('library');
    } else renderResults();
  }
  if (event.target.id === 'achievement-query') {
    achievementQuery = event.target.value;
    updateAchievementRows();
  }
  if (event.target.id === 'catalog-query') {
    catalogController?.abort();
    catalogController = undefined;
    dialog.querySelector('#online-search').disabled = false;
    const matches = searchCatalog(event.target.value);
    renderCatalog(matches, 'ВСТРОЕННЫЙ КАТАЛОГ', matches.length ? '' : 'В каталоге ничего нет. Попробуй Wikidata или добавь игру вручную.');
  }
});

app.addEventListener('change', async event => {
  const field = event.target;
  if (field.id === 'steam-filter') {
    steamScope = field.value;
    renderResults();
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
  if (field.id === 'game-status') {
    const game = findByRoute(state.games);
    if (game && updateGame(game, { status: field.value, shelf: true }, 'Статус сохранён')) render();
    else if (game) field.value = game.shelf ? game.status : '';
  }
  const fields = { sort: 'sort', 'platform-filter': 'platform', 'tag-filter': 'tag', 'collection-filter': 'collection' };
  if (Object.hasOwn(fields, field.id)) {
    filter[fields[field.id]] = field.value;
    if (field.id !== 'sort') {
      const filtersButton = app.querySelector('[data-action="filters"]');
      filtersButton.setAttribute('aria-pressed', String(Boolean(filter.platform || filter.tag || filter.collection)));
    }
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
  if (form.id === 'game-form') saveGame(form);
  if (form.id === 'profile-form') {
    const fields = new FormData(form);
    const name = fields.get('name').trim();
    if (!name) return formError(form, 'Введите имя.');
    if (commit({ ...state, showDemo: false, profile: { name, bio: fields.get('bio') } }, 'Профиль сохранён')) {
      dialog.close();
      render();
    }
  }
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

async function searchOnline(searchButton) {
  const query = dialog.querySelector('#catalog-query').value.trim();
  const local = searchCatalog(query);
  if (query.length < 2) return renderCatalog(local, '', 'Введите хотя бы две буквы для поиска в Wikidata.');
  catalogController?.abort();
  const controller = new AbortController();
  catalogController = controller;
  searchButton.disabled = true;
  renderCatalog(local, '', 'Ищем игры в Wikidata…');
  try {
    const online = await searchOnlineCatalog(query, { signal: controller.signal });
    if (controller.signal.aborted) return;
    renderCatalog([...local, ...online], '', online.length ? 'РЕЗУЛЬТАТЫ ПОИСКА' :
      (local.length ? 'Встроенный каталог · в Wikidata дополнительных результатов нет' : 'В Wikidata ничего не найдено. Можно добавить игру вручную.'));
  } catch (error) {
    if (!controller.signal.aborted) renderCatalog(local, '', 'Wikidata сейчас недоступна. Можно добавить игру вручную.');
  } finally {
    if (!controller.signal.aborted) searchButton.disabled = false;
  }
}

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
  if (openFavorites && route.page === 'library') {
    openFavorites = false;
    clearFilters();
    shelfMode = 'all';
    steamScope = 'favorite';
    filter.advanced = true;
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
    const search = app.querySelector('.topbar .searchbox');
    search.classList.add('search-open');
    const field = search.querySelector('input');
    field.focus();
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
  catalogController?.abort();
  catalogController = undefined;
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
  const search = app.querySelector('.topbar .searchbox');
  search.classList.add('search-open');
  search.querySelector('input').focus();
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
      const alternatives = isCover && id ? [artwork?.cover, artwork?.header, ...coverAlternatives(), artwork?.hero] : [artwork?.hero];
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
  const active = connected() || legacySteam;
  const last = state.steam ? 'Последняя синхронизация · ' + new Date(state.steam.lastSync).toLocaleString('ru') :
    'Игры и время появятся после первого импорта.';
  return `<section class="panel steam-panel" aria-label="Синхронизация Steam">
    <div><div class="eyebrow"><i></i>STEAM ${legacySteam ? '· ПУБЛИЧНЫЙ WORKER' : ''}</div>
      <h2>Библиотека Steam</h2><p>${esc(last)}</p></div>
    <div class="settings-actions">${button('steam-sync', 'Синхронизировать Steam', 'download', 'primary', syncingSteam ? 'disabled' : '')}
      ${active ? button('steam-disconnect', 'Отключить сеанс', 'x', 'secondary', syncingSteam ? 'disabled' : '') :
        button('steam-legacy', 'Публичный Worker', 'settings', 'secondary')}</div>
    ${syncingSteam ? '<progress class="steam-progress" aria-label="Синхронизация Steam"></progress>' : ''}
    ${steamMessage ? `<p class="steam-message ${steamError ? 'form-error' : ''}" role="status">${esc(steamMessage)}</p>` : ''}
  </section>`;
}

function openSteamLogin() {
  showDialog('Подключить Steam', 'ЗАЩИЩЁННЫЙ WORKER', `<form id="steam-login-form"><div class="dialog-body single-form">
    <p>Введите пароль доступа, настроенный в Cloudflare. Сеанс действует до перезагрузки страницы или истечения срока.</p>
    ${inputField('Пароль доступа', 'password', '', 'required autofocus autocomplete="current-password" maxlength="256"', 'password')}
    ${errorLine()}</div>${formFooter('Войти и синхронизировать', 'download')}</form>`);
}

function openSteamLegacy() {
  confirmAction('Подключить публичный Worker?', 'Этот Worker отдаёт данные Steam по публичному адресу. Для доступа с паролем выберите защищённое подключение.', 'Синхронизировать', () => {
    legacySteam = true;
    disconnect();
    steamSync();
    return true;
  });
}

async function loginSteam(form) {
  const submit = form.querySelector('[type=submit]');
  submit.disabled = true;
  try {
    await connect(new FormData(form).get('password'), state.steam?.account);
    legacySteam = false;
    if (form.isConnected && dialog.open) {
      dialog.close();
      await steamSync();
    } else disconnect();
  } catch (error) { formError(form, error.message); }
  finally { submit.disabled = false; }
}

async function steamSync() {
  if (syncingSteam) return;
  if (!(legacySteam || connected())) return openSteamLogin();
  if (storageError) return notify('Сначала восстановите библиотеку из копии.', true);
  const originalAccount = state.steam?.account;
  syncingSteam = true;
  steamError = false;
  steamMessage = 'Подключаемся к Worker…';
  render();
  try {
    const response = await fetchLibrary(legacySteam, originalAccount, step => {
      steamMessage = step;
      const status = app.querySelector('.steam-message, .profile-sync-message');
      if (status) status.textContent = step;
    });
    if (storageError || state.steam?.account !== originalAccount) throw new Error('Библиотека изменилась во время синхронизации. Повторите попытку.');
    const result = mergeSteam(state, response);
    if (!commit(result.state)) throw new Error('Данные Steam не сохранены. Проверьте сообщение и повторите попытку.');
    steamMessage = response.entries.length ? `Получено ${response.entries.length} игр · добавлено ${result.added} · обновлено ${result.updated}.` :
      'Steam вернул пустую библиотеку. Личные записи сохранены.';
    refreshSteamSummaries();
  } catch (error) {
    steamError = true;
    steamMessage = error.message;
  } finally {
    syncingSteam = false;
    render();
  }
}

function steamStats() {
  const linked = state.games.filter(game => game.steam);
  if (!linked.length) return '';
  const ids = new Set(linked.map(game => game.steam.appid));
  const available = summaryAccount === state.steam?.account ? summaries.filter(item => ids.has(item.appid)) : [];
  const total = available.reduce((sum, item) => sum + item.total, 0);
  const unlocked = available.reduce((sum, item) => sum + item.unlocked, 0);
  const perfected = available.filter(item => item.total > 0 && item.unlocked === item.total).length;
  const recent = [...linked].filter(game => game.steam.lastPlayed).sort((a, b) => b.steam.lastPlayed - a.steam.lastPlayed).slice(0, 5);
  const top = [...linked].sort((a, b) => b.steam.minutes - a.steam.minutes).slice(0, 5);
  const favorites = state.games.filter(game => game.favorite).slice(0, 5);
  const rows = (list, metric) => list.length ? `<ul class="steam-rows">${list.map(game =>
    `<li><a href="#game/${encodeURIComponent(game.id)}">${esc(game.title)}</a><span>${metric(game)}</span></li>`).join('')}</ul>` : '<p>Пока нет данных.</p>';
  return `<section class="panel steam-section"><div class="eyebrow"><i></i>STEAM</div><h2>Достижения и активность</h2>
    <div class="steam-summary"><div><strong>${numeric(linked.reduce((sum, game) => sum + game.steam.minutes, 0) / 60)} ч</strong><span>Время Steam</span></div>
      <div><strong>${perfected}</strong><span>Игр со 100% достижений</span></div>
      <div><strong>${unlocked} / ${total}</strong><span>Получено · ${total ? Math.round(unlocked / total * 100) + '%' : '—'}</span></div></div>
    <p>Достижения загружены для ${available.length} из ${linked.length} игр. Общие часы по библиотеке учитывают большее из ручного времени и времени Steam для каждой игры.</p>
    <div class="settings-actions">${scanningAchievements ? button('achievement-stop', 'Остановить загрузку', 'x') :
      button('achievement-scan', 'Обновить сводку достижений', 'download')}</div>
    ${scanMessage ? `<p role="status" class="scan-status">${esc(scanMessage)}</p>` : ''}
    <div class="steam-columns"><div><h3>Недавние запуски</h3>${rows(recent, game => steamDate(game.steam.lastPlayed))}</div>
      <div><h3>Больше всего часов</h3>${rows(top, game => numeric(game.steam.minutes / 60) + ' ч')}</div>
      <div><h3>Избранное</h3>${rows(favorites, () => '★')}</div></div></section>`;
}

async function refreshSteamSummaries(repaint = true) {
  const account = state.steam?.account ?? null;
  const records = await achievementSummaries(account);
  if (account !== (state.steam?.account ?? null)) return;
  summaryAccount = account;
  summaries = records;
  if (repaint && !dialog.open && ['stats', 'profile'].includes(route.page)) render();
  if (repaint && !dialog.open && route.page === 'library' && records.length) renderResults(true);
}



async function scanAchievements() {
  if (scanningAchievements) return;
  if (!(connected() || legacySteam)) return openSteamLogin();
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
    if (stopAchievementScan || state.steam?.account !== account || !(connected() || legacySteam)) break;
    try { await fetchAchievements(account, game.steam.appid, legacySteam); }
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

function dashboardMetrics(source, playing) {
  const achievements = totalsFor(playing);
  const completed = source.filter(game => ['completed','perfect'].includes(game.status)).length;
  return `<div class="metrics dashboard-metrics">${[
    ['game','Игр в библиотеке', numeric(source.length), 'lime'],
    ['clock','Общее время в играх', numeric(source.reduce((sum, game) => sum + gameHours(game), 0)) + ' ч','lime'],
    ['check','Пройдено игр', numeric(completed),'lime'],
    ['trophy','Достижения · сейчас играю', achievements.total ? achievements.unlocked + ' / ' + achievements.total : '—','amber']
  ].map(([glyph,label,value,tone]) => `<div class="metric"><span class="metric-icon ${tone}">${icon(glyph,23)}</span>
    <div><strong>${value}</strong><span class="metric-label">${label}</span></div></div>`).join('')}</div>`;
}

function steamEntry() {
  if (connected() || legacySteam) return steamSync();
  showDialog('Подключить Steam', 'СИНХРОНИЗАЦИЯ', `<div class="dialog-body single-form">
    <p>Выберите, как подключиться к своему Worker.</p>
    ${button('steam-connect','Защищённое подключение','shield','primary')}
    ${button('steam-legacy','Публичный Worker','steam')}
  </div>`);
}

function panelHeading(glyph, title, action = '', subtitle = '') {
  return `<div class="dashboard-panel-head"><div><h2>${icon(glyph, 20)}<span>${title}</span></h2>
    ${subtitle ? `<p>${subtitle}</p>` : ''}</div>${action}</div>`;
}

function journalOrder(items) {
  return [...items].reverse().sort((a, b) => b.date.localeCompare(a.date));
}

function profileDashboard() {
  const player = profile();
  const visible = games().filter(game => !game.hidden);
  const playing = visible.filter(game => game.shelf && game.status === 'playing');
  const achievements = totalsFor(playing);
  const perfect = achievements.included.filter(({ record }) => record.total > 0 && record.total === record.unlocked).length;
  const sessions = visible.flatMap(game => game.sessions.map(session => ({ ...session, game })))
    .sort((a,b) => b.date.localeCompare(a.date));
  const start = new Date();
  start.setDate(start.getDate() - 13);
  const dayKey = date => [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
  const minutes = sessions.filter(item => item.date >= dayKey(start) && item.date <= dayKey(new Date()))
    .reduce((sum, item) => sum + item.minutes, 0);
  const top = [...visible].filter(game => gameHours(game) > 0).sort((a,b) => gameHours(b) - gameHours(a)).slice(0, 4);
  const favorites = visible.filter(game => game.favorite);
  const status = connected() || legacySteam ? 'Steam подключён' : state.steam ? 'Сеанс Steam завершён' : 'Steam не подключён';
  const lastSync = state.steam ? 'Последняя синхронизация · ' + new Date(state.steam.lastSync).toLocaleString('ru') : 'Ещё не синхронизировано';
  return `<div class="profile-dashboard">
    <section class="profile-banner">
      <div class="profile-avatar" aria-hidden="true"><span>${esc(initials(player.name))}</span></div>
      <div class="profile-identity"><div class="eyebrow"><i></i>ИГРОВОЙ ПРОФИЛЬ</div>
        <div class="profile-name"><h1>${esc(player.name)}</h1>
          ${iconButton('edit-profile','Редактировать профиль','edit')}
          ${iconButton('steam-entry','Синхронизировать Steam','steam', syncingSteam ? 'disabled' : '')}
        </div>
        <p class="profile-bio">${esc(player.bio || 'Игровой журнал и статистика')}</p>
        <div class="profile-connection"><span>${icon('steam',16)} ${status}</span><span>${esc(lastSync)}</span></div>
        ${steamMessage ? `<p class="profile-sync-message ${steamError ? 'form-error' : ''}" role="status">${esc(steamMessage)}</p>` : ''}
      </div>
    </section>
    ${dashboardMetrics(visible, playing)}
    <div class="dashboard-row dashboard-overview">
      <section class="panel dash-panel">${panelHeading('trophy','Достижения','','Считаются по видимым играм со статусом «Играю».')}
        <div class="profile-achievement-content">
          <div class="profile-ring" style="--ring:${achievements.percentage}%" aria-hidden="true"><strong>${achievements.total ? achievements.percentage + '%' : '—'}</strong></div>
          <div><strong class="profile-total">${achievements.total ? achievements.unlocked + ' / ' + achievements.total : 'Данных пока нет'}</strong>
            <p>${achievements.total ? 'Получено достижений · 100% у ' + perfect + ' игр' : 'Открой достижения игры, чтобы загрузить данные Steam.'}</p>
          </div>
          <div class="included-games"><span>В расчёте ${achievements.included.length} из ${playing.length} игр</span>
            ${achievements.included.map(({game,record}) => `<a href="#game/${encodeURIComponent(game.id)}/achievements">${esc(game.title)} <small>${record.unlocked} / ${record.total}</small></a>`).join('')}
          </div>
        </div>
      </section>
      <section class="panel dash-panel">${panelHeading('pulse','Текущая активность','','Последние 14 календарных дней · ручной журнал сессий')}
        <div class="profile-activity"><div>${icon('game',21)}<div><strong>${playing.length}</strong><span>Сейчас играю</span></div></div>
          <div>${icon('clock',21)}<div><strong>${numeric(minutes / 60)} ч</strong><span>В записанных сессиях</span></div></div></div>
      </section>
    </div>
    <div class="dashboard-row dashboard-activity">
      <section class="panel dash-panel">${panelHeading('clock','Последние сессии')}
        ${sessions.length ? `<div class="profile-rows">${sessions.slice(0,5).map(({game,date,minutes}) => `
          <a href="#game/${encodeURIComponent(game.id)}/sessions">${cover(game)}<span><strong>${esc(game.title)}</strong><small>${dateLabel(date)}</small></span><b>${duration(minutes)}</b></a>`).join('')}</div>` :
          '<p class="dash-empty">Ручных сессий пока нет.</p>'}
        <div class="profile-steam-activity"><h3>Автоучёт Steam</h3>${steamActivityRows(null, 4)}</div>
      </section>
      <section class="panel dash-panel">${panelHeading('game', 'Сейчас играю', `<span class="panel-count">${playing.length}</span>`)}
        ${playing.length ? `<div class="profile-playing">${playing.slice(0,3).map(game => gameCard(game,true)).join('')}</div>` :
          '<p class="dash-empty">Отметь текущие игры статусом «Играю».</p>'}
      </section>
    </div>
    <div class="dashboard-row dashboard-bottom">
      <section class="panel dash-panel">${panelHeading('chart','Больше всего часов','','По времени в Steam или вручную')}
        ${top.length ? `<div class="profile-rows profile-hours">${top.map((game,index) => `<a href="#game/${encodeURIComponent(game.id)}"><small>${index + 1}</small>${cover(game)}<span><strong>${esc(game.title)}</strong></span>
          <i>${progressBar(100 * gameHours(game) / gameHours(top[0]))}</i><b>${numeric(gameHours(game))} ч</b></a>`).join('')}</div>` :
          '<p class="dash-empty">Синхронизируй Steam или укажи время вручную.</p>'}
      </section>
      <section class="panel dash-panel">${panelHeading('star','Избранное',button('open-favorites','Все игры','right','quiet'))}
        ${favorites.length ? `<div class="profile-favorites">${favorites.slice(0,5).map(game => `<a href="#game/${encodeURIComponent(game.id)}" title="${esc(game.title)}">${cover(game)}<span>${esc(game.title)}</span></a>`).join('')}</div>` :
          '<p class="dash-empty">Нажми на звезду у игры, чтобы добавить её сюда.</p>'}
      </section>
    </div>
  </div>`;
}

function gameDashboard() {
  const game = findByRoute(games());
  if (!game) return `<div class="empty"><h2>Игра не найдена</h2><a class="btn btn-secondary" href="#library">К библиотеке</a></div>`;
  const url = '#game/' + encodeURIComponent(game.id);
  const summary = summaryFor(game);
  const journalMinutes = game.sessions.reduce((sum, item) => sum + item.minutes, 0);
  const achievementBox = `<section class="panel dash-panel game-achievements" id="steam-achievements" ${game.steam ? `data-appid="${game.steam.appid}"` : ''}>
    ${panelHeading('trophy','Достижения')}<p class="dash-empty">${game.steam ? 'Загружаем сохранённые данные…' : 'Достижения доступны для игр, связанных со Steam.'}</p></section>`;
  const sessions = journalPanel(game, 'sessions', route.tab === 'overview');
  const notes = journalPanel(game, 'journal', route.tab === 'overview');
  const content = {
    overview: `<div class="game-overview">${achievementBox}<div>${game.steam ? steamActivityPanel(game, true) : ''}${sessions}${notes}</div></div>`,
    achievements: achievementBox,
    sessions: (game.steam ? steamActivityPanel(game, false) : '') + sessions + (game.runs.length ? `<details class="panel saved-runs"><summary>Прохождения из журнала · ${game.runs.length}</summary>${runsPanel(game)}</details>` : ''),
    notes
  };
  const hero = steamHero(game.steam?.appid);
  return `<div class="game-dashboard"><a class="back-link" href="#library">${icon('back',16)} Библиотека</a>
    <section class="game-banner panel">
      ${hero ? `<img class="game-hero-art" src="${esc(hero)}" alt="" referrerpolicy="no-referrer" data-steam-art="${game.steam.appid}" data-art-kind="hero">` : ''}
      ${cover(game,'game-poster')}
      <div class="game-identity"><div class="eyebrow"><i></i>${game.steam ? 'БИБЛИОТЕКА STEAM' : esc(game.platform)}</div>
        <h1>${esc(game.title)}</h1>
        <p>${[game.steam ? 'Steam' : game.platform, game.genre, game.year].filter(Boolean).map(esc).join(' · ')}</p>
        <div class="detail-actions">
          ${game.steam ? `<a href="https://store.steampowered.com/app/${game.steam.appid}/" target="_blank" rel="noopener noreferrer" class="btn btn-primary">${icon('steam',17)} Открыть в Steam ${icon('upRight',15)}</a>` : ''}
          ${iconButton('edit-game','Редактировать игру','edit')}
          ${iconButton('favorite',game.favorite ? 'Убрать из избранного' : 'В избранное','star', `aria-pressed="${game.favorite}"`)}
          ${iconButton('hide-game',game.hidden ? 'Вернуть игру' : 'Скрыть игру',game.hidden ? 'eye' : 'eyeOff')}
        </div>
        <div class="game-quick-stats">
          <div>${icon('clock',22)}<span><strong>${game.steam ? numeric(game.steam.minutes / 60) : numeric(game.hours)} ч</strong><small>${game.steam ? 'Время в Steam' : 'Ручное время'}</small></span></div>
          <div>${icon('trophy',22)}<span><strong id="game-achievement-count">${summary?.total ? summary.unlocked + ' / ' + summary.total : '—'}</strong><small id="game-achievement-caption">Достижения Steam</small>
            <span id="game-achievement-progress">${summary?.total ? progressBar(summary.unlocked / summary.total * 100) : ''}</span></span></div>
          <label>${icon('check',21)}<select id="game-status" aria-label="Ручной статус игры">
            ${!game.shelf ? option('','Выбрать статус','') : ''}
            ${Object.entries(STATUSES).map(([value,label]) => option(value,label,game.shelf ? game.status : '')).join('')}
          </select></label>
        </div>
      </div>
    </section>
    <nav class="game-tabs" aria-label="Разделы игры">${gameTabs.map(([id,label,glyph]) => `<a href="${url}${id === 'overview' ? '' : '/' + id}" ${route.tab === id ? 'aria-current="page"' : ''}>${icon(glyph,18)} ${label}</a>`).join('')}</nav>
    ${route.tab === 'sessions' ? `<div class="journal-totals"><span>${icon('clock',18)} Записано вручную <strong>${duration(journalMinutes)}</strong></span>
      ${game.steam ? `<span>${icon('steam',18)} Всего в Steam <strong>${numeric(game.steam.minutes / 60)} ч</strong></span>` : ''}</div>` : ''}
    <div class="game-tab-content">${content[route.tab]}</div>
    ${route.tab === 'notes' && !game.steam ? `<div class="detail-delete">${button('delete-game','Удалить игру','trash','danger')}</div>` : ''}
  </div>`;
}

function duration(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? hours + ' ч' + (rest ? ' ' + rest + ' мин' : '') : rest + ' мин';
}

function steamActivityRows(game, limit) {
  const activity = state.steam?.activity;
  if (!activity) return '<p class="dash-empty">Автоучёт включается в Cloudflare. <a class="text-link" target="_blank" rel="noopener noreferrer" href="https://github.com/nkuzyanin-cloud/aftersave/tree/main/worker#автоучёт-времени-steam">Инструкция</a></p>';
  if (!activity.lastObserved) return '<p class="dash-empty">Автоучёт ожидает первого опроса Steam.</p>';
  const visible = new Map(games().filter(item => item.steam && !item.hidden).map(item => [item.steam.appid, item]));
  const records = activity.windows.filter(item => game ? item.appid === game.steam.appid : visible.has(item.appid)).slice(0, limit);
  const label = timestamp => new Date(timestamp).toLocaleString('ru', { dateStyle: 'short', timeStyle: 'short' });
  return records.length ? `<ul class="journal-list steam-interval-list">${records.map(item => {
    const title = game ? 'Steam добавил' : esc(visible.get(item.appid)?.title);
    return `<li><div><strong>${title}</strong><span>+${duration(item.minutes)}</span></div>
      <p>Между опросами ${label(item.observedFrom)} → ${label(item.observedTo)}</p></li>`;
  }).join('')}</ul>` : `<p class="dash-empty">С момента запуска автоучёта новый прирост ещё не обнаружен. Последний опрос ${label(activity.lastObserved)}.</p>`;
}

function steamActivityPanel(game, compact) {
  return `<section class="panel dash-panel steam-activity-panel">${panelHeading('steam','Автоучёт Steam',
    compact ? `<a class="btn btn-secondary" href="#game/${encodeURIComponent(game.id)}/sessions">К сессиям ${icon('right',14)}</a>` : '')}
    <p class="activity-source">${game.steam.lastPlayed ? 'Последний запуск по Steam · ' + new Date(game.steam.lastPlayed * 1000).toLocaleString('ru', { dateStyle:'medium', timeStyle:'short' }) + '. ' : ''}
    В списке показан прирост времени между опросами Steam.</p>${steamActivityRows(game, compact ? 2 : 120)}</section>`;
}

function journalPanel(game, key, compact) {
  const sessions = key === 'sessions';
  const title = sessions ? 'Игровые сессии' : 'Заметки';
  const rows = journalOrder(game[key]).slice(0, compact ? 3 : undefined);
  const tab = sessions ? 'sessions' : 'notes';
  return `<section class="panel dash-panel journal-panel">${panelHeading(sessions ? 'clock' : 'edit', title,
    compact ? `<a class="btn btn-secondary" href="#game/${encodeURIComponent(game.id)}/${tab}">Все записи ${icon('right',14)}</a>` :
      button(sessions ? 'new-session' : 'new-note', sessions ? 'Добавить сессию' : 'Добавить заметку','plus'))}
    ${rows.length ? `<ul class="journal-list">${rows.map(item => `<li>
      <div><strong>${item.date ? dateLabel(item.date) : 'Без даты'}</strong>${sessions ? `<span>${duration(item.minutes)}</span>` : ''}</div>
      ${item.text ? `<p class="notes ${compact ? 'note-preview' : ''}">${esc(item.text)}</p>` : ''}
      ${compact ? '' : iconButton(sessions ? 'edit-session' : 'edit-note', sessions ? 'Редактировать сессию' : 'Редактировать заметку','edit', `data-id="${esc(item.id)}"`)}
    </li>`).join('')}</ul>` : `<p class="dash-empty">${sessions ? 'Сессий пока нет. Запиши дату, длительность и комментарий.' : 'Заметок пока нет.'}</p>`}
  </section>`;
}

function openJournal(kind, id) {
  const game = findByRoute(state.games);
  if (!game) return;
  const item = game[kind].find(row => row.id === id);
  if (id && !item) return;
  const session = kind === 'sessions';
  showDialog(session ? (id ? 'Редактировать сессию' : 'Новая сессия') : (id ? 'Редактировать заметку' : 'Новая заметка'), 'ЛИЧНЫЙ ЖУРНАЛ',
    `<form id="journal-form" data-kind="${kind}" data-id="${esc(id)}"><div class="dialog-body single-form">
      ${session ? inputField('Дата','date',item?.date || dateStamp(),'required','date') +
        inputField('Длительность, минуты','minutes',item?.minutes,'min="1" max="1440" step="1" required','number') : ''}
      <label class="field"><span>${session ? 'Комментарий' : 'Текст заметки'}</span><textarea name="text" rows="5" maxlength="5000" ${session ? '' : 'required autofocus'}>${esc(item?.text)}</textarea></label>
      ${id ? button('delete-journal','Удалить запись','trash','danger',`data-kind="${kind}" data-id="${esc(id)}"`) : ''}
      ${errorLine()}</div>${formFooter('Сохранить')}</form>`);
}

function saveJournal(form) {
  const game = findByRoute(state.games);
  const { kind, id } = form.dataset;
  if (!game || !['sessions','journal'].includes(kind)) return;
  const fields = new FormData(form);
  const text = fields.get('text').trim();
  if (kind === 'journal' && !text) return formError(form,'Введите текст заметки.');
  const existing = game[kind].find(item => item.id === id);
  if (id && !existing) return formError(form,'Запись больше недоступна.');
  const item = { id: id || crypto.randomUUID(), date: existing?.date ?? dateStamp(), text };
  if (kind === 'sessions') Object.assign(item, { date: fields.get('date'), minutes: Number(fields.get('minutes')) });
  const entries = existing ? game[kind].map(row => row.id === id ? item : row) : [...game[kind], item];
  if (updateGame(game, { [kind]: entries }, 'Запись сохранена')) { dialog.close(); render(); }
}

function deleteJournal(kind, id) {
  const game = findByRoute(state.games);
  if (!game || !['sessions','journal'].includes(kind)) return;
  confirmAction('Удалить запись?', 'Запись будет удалена из журнала игры.', 'Удалить', () => {
    if (!updateGame(game, { [kind]: game[kind].filter(row => row.id !== id) }, 'Запись удалена')) return false;
    render();
    return true;
  }, true);
}

let displayedAchievements;
async function showAchievements(force = false) {
  const game = findByRoute(games());
  if (!game?.steam) return;
  const account = state.steam?.account;
  const id = game.steam.appid;
  const box = document.querySelector('#steam-achievements');
  const view = ++achievementView;
  const cached = await cachedAchievements(account, id);
  if (view !== achievementView || route.page !== 'game' || findByRoute(games())?.steam?.appid !== id) return;
  const active = connected() || legacySteam;
  const fresh = cached && Date.now() - cached.fetchedAt < 24 * 60 * 60 * 1000;
  drawAchievements(box, cached, !active && !cached ? 'Подключи Steam в профиле, чтобы загрузить достижения.' : '');
  if (force && !active) return steamEntry();
  if (!active || (!force && fresh) || !box) return;
  drawAchievements(box, cached, 'Загружаем достижения…');
  try {
    const record = await fetchAchievements(account,id,legacySteam,force);
    if (view === achievementView) drawAchievements(box, record);
    await refreshSteamSummaries(false);
  } catch (error) {
    if (view === achievementView) drawAchievements(box, cached, error.message);
  }
}

function drawAchievements(box, record, message = '') {
  const count = document.querySelector('#game-achievement-count');
  const caption = document.querySelector('#game-achievement-caption');
  if (count && record?.total) {
    count.textContent = record.unlocked + ' / ' + record.total;
    caption.textContent = 'Достижения Steam · ' + Math.round(record.unlocked / record.total * 100) + '%';
    document.querySelector('#game-achievement-progress').innerHTML = progressBar(record.unlocked / record.total * 100);
  }
  if (!box?.isConnected) return;
  displayedAchievements = record;
  const overview = route.tab === 'overview';
  const game = findByRoute(games());
  const action = overview ? `<a href="#game/${encodeURIComponent(game.id)}/achievements" class="btn btn-secondary">Смотреть все ${icon('right',14)}</a>` :
    button('achievement-reload', 'Обновить','download','secondary',message === 'Загружаем достижения…' ? 'disabled' : '');
  const hasRarity = record?.items.some(item => Number.isFinite(item.percent));
  box.innerHTML = panelHeading('trophy','Достижения',action) +
    (record?.total ? `<div class="achievement-overview"><strong>${record.unlocked} / ${record.total}</strong>
      <div><span>${Math.round(record.unlocked / record.total * 100)}%</span>${progressBar(record.unlocked / record.total * 100)}</div></div>` : '') +
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

function updateAchievementRows() {
  const target = document.querySelector('#achievement-rows');
  if (!target || !displayedAchievements) return;
  const overview = route.tab === 'overview';
  const query = achievementQuery.trim().toLocaleLowerCase('ru');
  let items = displayedAchievements.items;
  if (overview) items = [...items].sort((a,b) => Number(b.unlocked) - Number(a.unlocked) || b.time - a.time).slice(0,5);
  else {
    items = items.filter(item => (!achievementFilter || item.unlocked === (achievementFilter === 'yes')) &&
      (!query || (item.name + ' ' + (item.hidden && !item.unlocked && !revealHidden ? '' : item.description)).toLocaleLowerCase('ru').includes(query)));
    if (achievementSort === 'rare') items.sort((a,b) => (a.percent ?? Infinity) - (b.percent ?? Infinity));
  }
  target.innerHTML = items.length ? `<ul class="achievement-list redesign-achievements">${items.map(item => {
    const concealed = item.hidden && !item.unlocked && !revealHidden;
    return `<li class="${item.unlocked ? 'unlocked' : ''}">
    <span class="achievement-icon">${icon(item.unlocked ? 'trophy' : 'shield',22)}${item.icon && !concealed ? `<img src="${esc(item.icon)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</span>
    <div><strong>${esc(item.name)}</strong>${concealed ? '<p>Скрытое условие</p>' : item.description ? `<p>${esc(item.description)}</p>` : ''}</div>
    <small>${Number.isFinite(item.percent) ? `<b>${numeric(item.percent)}%</b>` : ''}${item.unlocked ? item.time ? steamDate(item.time) : 'Получено' : 'Не получено'}</small>
  </li>`;
  }).join('')}</ul>` : '<p class="dash-empty">Достижения по этим фильтрам не найдены.</p>';
  imageFallbacks(target);
}

render();
refreshSteamSummaries();
setInterval(() => {
  if (state.steam && Date.now() - Date.parse(state.steam.lastSync) >= 30 * 60 * 1000 &&
      (connected() || legacySteam) && !document.hidden && !dialog.open && navigator.onLine) steamSync();
}, 60 * 1000);
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(new URL('./sw.js', import.meta.url)).catch(error => console.warn('AFTERSAVE offline:', error));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const offline = app.querySelector('#offline-label');
    if (offline) offline.textContent = 'Офлайн-режим готов на этом устройстве.';
  });
}

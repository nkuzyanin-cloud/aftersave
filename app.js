
import {
  STORAGE_KEY, STATUSES, PLATFORMS, DEMO, DEMO_COLLECTIONS, DEMO_PROFILE, load, save, emptyState,
  createGame, exportJSON, importJSON, exportCSV, searchCatalog, searchOnlineCatalog
} from './data.js';
import { icon } from './icons.js';

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
let demo = !storageError && state.showDemo;
let toastTimer;
let route = getRoute();
let catalogController;
let storagePending = false;

const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const numeric = value => number.format(value);
const percent = value => Math.min(100, Math.max(0, Number(value) || 0));
const games = () => demo ? DEMO : state.games;
const collections = () => demo ? DEMO_COLLECTIONS : state.collections;
const profile = () => demo ? DEMO_PROFILE : state.profile;
const coverUrl = value => {
  if (/^\.?\/?assets\/covers\/[a-z0-9-]+\.jpg$/i.test(value ?? '')) return './' + value.replace(/^\.?\//, '');
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch { return ''; }
};

function getRoute() {
  const [page, id] = location.hash.slice(1).split('/');
  return { page: Object.hasOwn(labels, page) ? page : 'library', id };
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
      <div class="sidebar-version"><span>AFTERSAVE / V.01</span><span>◆</span></div>
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
  const url = coverUrl(game.cover);
  return `<div class="cover ${className}" style="--cover-accent:${/^#[\da-f]{6}$/i.test(game.accent ?? '') ? game.accent : '#7063a5'}">
    <span class="cover-fallback">${icon('game', 42)}</span>${url ? `<img src="${esc(url)}" alt="" decoding="async" referrerpolicy="no-referrer">` : ''}</div>`;
}

function progressBar(value) {
  return `<div class="progress-track" role="progressbar" aria-label="Прогресс" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent(value)}"><span style="width:${percent(value)}%"></span></div>`;
}

function hero() {
  const feature = games().find(game => game.status === 'playing') ?? (demo ? DEMO[0] : games()[0]);
  const image = feature?.catalogId === 'elden-ring' || feature?.title === 'Elden Ring' ? './assets/elden-ring-hero.jpg' : coverUrl(feature?.cover);
  return `<section class="hero ${image ? 'hero-image' : 'hero-abstract'}" aria-label="Главная игра">
    ${image ? `<img class="hero-backdrop" src="${esc(image)}" alt="" fetchpriority="high">` : '<div class="hero-pattern"></div>'}
    <div class="hero-shade"></div>
    <div class="hero-content">
      <div class="hero-kicker"><span></span>${feature?.status === 'playing' ? 'СЕЙЧАС В ИГРЕ' : 'ЛИЧНАЯ БИБЛИОТЕКА'}</div>
      <h1>${feature ? esc(feature.title) : 'Твоя игровая история'}</h1>
      <p>${feature ? [feature.genre, feature.year, feature.platform].filter(Boolean).map(esc).join('<i></i>') : 'Собирай игры, отмечай прогресс и возвращайся к любимым мирам.'}</p>
      ${feature ? `<div class="hero-progress"><div>${progressBar(feature.progress)}</div><strong>${numeric(feature.progress)}%</strong></div>` : ''}
      ${feature ? `<a class="btn btn-primary" href="#game/${encodeURIComponent(feature.id)}">Открыть игру ${icon('arrow', 17)}</a>` : button('add', 'Добавить первую игру', 'plus', 'primary')}
    </div>
    ${demo ? `<div class="hero-demo">${icon('sparkle', 13)} ДЕМО</div>` : ''}
    <span class="hero-index">01 <i></i> ИГРОВОЙ ЖУРНАЛ</span>
  </section>`;
}

function metrics(source) {
  const hours = source.reduce((sum, game) => sum + game.hours, 0);
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
    const haystack = [game.title, game.genre, game.platform, ...game.tags].join(' ').toLocaleLowerCase('ru');
    return (!query || query.split(/\s+/).every(term => haystack.includes(term))) &&
      (!filter.status || game.status === filter.status) &&
      (!filter.platform || game.platform === filter.platform) &&
      (!filter.tag || game.tags.includes(filter.tag)) &&
      (!filter.collection || game.collectionIds.includes(filter.collection));
  });
  const sorts = {
    title: (a, b) => a.title.localeCompare(b.title, 'ru'),
    hours: (a, b) => b.hours - a.hours,
    rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1),
    progress: (a, b) => b.progress - a.progress
  };
  if (filter.sort === 'recent' && !demo) return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return sorts[filter.sort] ? result.sort(sorts[filter.sort]) : result;
}

function gameCard(game) {
  const id = esc(game.id);
  return `<article class="game-card">
    <a href="#game/${encodeURIComponent(game.id)}" class="card-link" aria-label="Открыть ${esc(game.title)}">
      <div class="card-art">${cover(game)}${statusBadge(game.status)}<span class="card-open">${icon('upRight', 18)}</span></div>
      <div class="card-body"><h3>${esc(game.title)}</h3>
        <div class="card-meta"><span>${icon('monitor', 14)} ${esc(game.platform)}</span>
          ${game.rating !== null ? `<span class="rating">${icon('star', 14)} ${numeric(game.rating)}</span>` : ''}</div>
        <div class="card-progress"><span>Прогресс</span><strong>${numeric(game.progress)}%</strong></div>${progressBar(game.progress)}
      </div>
    </a>
    ${!demo ? iconButton('wish', game.wishlist ? 'Убрать из списка желаний' : 'В список желаний', 'bookmark',
      `data-id="${id}" aria-pressed="${game.wishlist}"`) : ''}
  </article>`;
}

function gameList(source) {
  const result = filtered(source);
  if (!result.length) {
    const isFiltered = Boolean(filter.query || filter.status || filter.platform || filter.tag || filter.collection);
    return `<div class="empty"><span class="empty-icon">${icon(isFiltered ? 'search' : 'game', 29)}</span>
      <h2>${isFiltered ? 'Игры не найдены' : 'Здесь пока пусто'}</h2>
      <p>${isFiltered ? 'Попробуйте другой запрос или сбросьте фильтры.' : 'Добавьте игру из каталога или заполните карточку вручную.'}</p>
      ${isFiltered ? button('clear-filters', 'Сбросить фильтры', 'x') : button('add', 'Добавить игру', 'plus', 'primary')}</div>`;
  }
  return `<div class="game-grid ${filter.view === 'list' ? 'list-view' : ''}">${result.map(gameCard).join('')}</div>`;
}

function option(value, title, selected) {
  return `<option value="${esc(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${esc(title)}</option>`;
}

function viewControls(source) {
  const platforms = [...new Set(source.map(game => game.platform))].sort();
  const tags = [...new Set(source.flatMap(game => game.tags))].sort((a, b) => a.localeCompare(b, 'ru'));
  return `<div class="library-controls">
    <div class="tabs" aria-label="Статус игры">${[['', 'Все игры'], ...Object.entries(STATUSES)].map(([value, label]) =>
      `<button type="button" class="tab ${filter.status === value ? 'selected' : ''}" data-action="status" data-value="${value}" aria-pressed="${filter.status === value}">${label}</button>`).join('')}</div>
    <div class="filter-actions">
      ${iconButton('filters', 'Платформы, теги и коллекции', 'filter', `aria-controls="advanced-filters" aria-expanded="${Boolean(filter.advanced || filter.platform || filter.tag || filter.collection)}" aria-pressed="${Boolean(filter.platform || filter.tag || filter.collection)}"`)}
      <label class="sort-select">${icon('sort', 16)}<select id="sort" aria-label="Сортировка">${[
        ['recent', 'Недавние'], ['title', 'По названию'], ['hours', 'По часам'], ['rating', 'По оценке'], ['progress', 'По прогрессу']
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
    ${button('clear-filters', 'Сбросить', 'x')}
  </div>`;
}

function sourceForPage() {
  if (route.page === 'wishlist') return games().filter(game => game.wishlist);
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
  return `${hero()}${metrics(games())}
    <section class="library-section" aria-labelledby="library-heading">
      <div class="section-heading"><div><div class="eyebrow"><i></i>ТВОЯ КОЛЛЕКЦИЯ</div>
      <h2 id="library-heading">Игровая библиотека</h2>
      <p>${demo ? 'Демо · примеры записей и прогресса' : 'Все игровые миры в одном месте'}</p></div>
      <div class="heading-actions">${button('toggle-demo', demo ? 'Мои игры' : 'Демо', demo ? 'arrow' : 'sparkle', 'secondary', 'id="switch-library"')}
      ${button('add', 'Добавить игру', 'plus', 'primary')}</div></div>
      ${viewControls(games())}${gameResults(games())}
    </section>`;
}

function wishlistPage() {
  const source = sourceForPage();
  return `${header('ПЛАНЫ', labels.wishlist, demo ? 'Демонстрационная подборка игр на будущее.' : 'Игры, к которым хочется вернуться позже.', button('add-wish', 'Добавить игру', 'plus', 'primary'))}
    ${viewControls(source)}${gameResults(source)}`;
}

function collectionsPage() {
  const collection = findByRoute(collections());
  if (collection) {
    const source = sourceForPage();
    const actions = demo ? '' : button('edit-collection', 'Редактировать', 'edit', 'secondary', `data-id="${esc(collection.id)}"`);
    return `<a class="back-link" href="#collections">${icon('back', 17)} Все коллекции</a>
      ${header('ПОДБОРКА', esc(collection.name), demo ? 'Демонстрационная коллекция.' : 'Игры из этой коллекции.', actions)}
      ${viewControls(source)}${gameResults(source)}`;
  }
  const list = collections();
  return `${header('ПОДБОРКИ', labels.collections, demo ? 'Демонстрационные подборки. Свои коллекции доступны в личной библиотеке.' : 'Группируй игры по серии, настроению или любому другому принципу.', button('new-collection', 'Новая коллекция', 'plus', 'primary'))}
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

function gamePage() {
  const game = findByRoute(games());
  if (!game) return `<a class="back-link" href="#library">${icon('back', 17)} Библиотека</a>
    <div class="empty"><span class="empty-icon">${icon('game', 29)}</span><h2>Игра не найдена</h2><p>Откройте карточку из текущей библиотеки.</p></div>`;
  const actions = demo ? button('copy-demo', 'Добавить к себе', 'plus', 'primary') :
    button('edit-game', 'Редактировать', 'edit', 'primary') + iconButton('wish', game.wishlist ? 'Убрать из списка желаний' : 'В список желаний', 'bookmark',
      `data-id="${esc(game.id)}" aria-pressed="${game.wishlist}"`);
  const tags = game.tags.map(tag => `<span class="pill"># ${esc(tag)}</span>`).join('');
  const groups = collections().filter(item => game.collectionIds.includes(item.id));
  return `<a class="back-link" href="#library">${icon('back', 17)} Библиотека</a>
    <section class="game-detail panel">${cover(game, 'detail-cover')}<div class="detail-info">
      <div class="eyebrow"><i></i>${demo ? 'ДЕМО · ПРИМЕР ЗАПИСИ' : 'ИГРОВОЙ ЖУРНАЛ'}</div>
      <h1>${esc(game.title)}</h1><p class="detail-meta">${[game.genre, game.year, game.platform].filter(Boolean).map(esc).join(' · ')}</p>
      ${statusBadge(game.status)}
      ${game.description ? `<p class="description">${esc(game.description)}</p>` : ''}
      <div class="detail-actions">${actions}</div>
    </div></section>
    <div class="detail-grid">
      <section class="panel detail-panel"><h2>Прогресс</h2><div class="progress-label"><strong>${numeric(game.progress)}%</strong><span>${numeric(game.hours)} ч</span></div>
        ${progressBar(game.progress)}<dl>
        <div><dt>Оценка</dt><dd>${game.rating === null ? '—' : numeric(game.rating) + ' / 10'}</dd></div>
        <div><dt>Начало</dt><dd>${dateLabel(game.startedAt)}</dd></div>
        <div><dt>Завершение</dt><dd>${dateLabel(game.finishedAt)}</dd></div>
        </dl></section>
      <section class="panel detail-panel"><h2>Заметки</h2><p class="notes">${game.notes ? esc(game.notes) : 'Здесь можно записать впечатления, планы и полезные находки.'}</p>
        ${tags ? `<div class="pills">${tags}</div>` : ''}
        ${groups.length ? `<div class="pills">${groups.map(item => `<a class="pill" href="#collections/${encodeURIComponent(item.id)}">${icon('layers', 15)} ${esc(item.name)}</a>`).join('')}</div>` : ''}</section>
    </div>
    ${demo ? '' : `<div class="detail-delete">${button('delete-game', 'Удалить игру', 'trash', 'danger')}</div>`}`;
}

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
  source.forEach(game => platformHours.set(game.platform, (platformHours.get(game.platform) || 0) + game.hours));
  const hours = [...platformHours.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const totalRated = source.filter(game => game.rating !== null);
  const average = totalRated.length ? totalRated.reduce((sum, game) => sum + game.rating, 0) / totalRated.length : 0;
  const best = [...totalRated].sort((a, b) => b.rating - a.rating).slice(0, 4);
  return `${header('ОБЗОР', labels.stats, demo ? 'Пример сводки по демонстрационным данным.' : 'Прогресс и привычки в цифрах.')}
    ${metrics(source)}
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

function profilePage() {
  const player = profile();
  return `${header('ИГРОК', labels.profile, demo ? 'Пример игрового профиля.' : 'Твой профиль и краткая сводка.')}
    <section class="panel profile-card"><div class="profile-avatar">${esc(initials(player.name))}</div>
      <div><div class="eyebrow"><i></i>${demo ? 'ДЕМО-ПРОФИЛЬ' : 'ЛОКАЛЬНЫЙ ПРОФИЛЬ'}</div>
        <h2>${esc(player.name)}</h2><p class="notes">${esc(player.bio || 'Добавь пару слов о себе.')}</p></div>
      ${button('edit-profile', demo ? 'Настроить свой профиль' : 'Редактировать', 'edit')}</section>
    ${metrics(games())}
    <div class="panel quick-links"><a href="#stats">${icon('chart', 20)} Полная статистика ${icon('right', 16)}</a>
      <a href="#settings">${icon('settings', 20)} Настройки и резервные копии ${icon('right', 16)}</a></div>`;
}

function settingsPage() {
  return `${header('ЛИЧНОЕ', labels.settings, 'Данные библиотеки, резервные копии и установка приложения.')}
    <div class="settings-grid">
      <section class="panel settings-panel"><span class="metric-icon lime">${icon('shield', 21)}</span><h2>Данные на устройстве</h2>
        <p>Библиотека сохраняется в этом браузере. Сделай копию перед очисткой данных, сменой браузера или переносом на другое устройство.</p>
        <div class="settings-actions">${button('export-json', 'Скачать JSON', 'download', 'primary', storageError ? 'disabled' : '')}
          ${button('import-json', 'Восстановить JSON', 'upload')}
          ${button('export-csv', 'Скачать CSV', 'download', 'secondary', storageError ? 'disabled' : '')}</div>
        <input id="backup-file" type="file" accept=".json,application/json" hidden></section>
      <section class="panel settings-panel"><span class="metric-icon violet">${icon('sparkle', 21)}</span><h2>Режим библиотеки</h2>
        <p>Демо открывает отдельный набор примеров. Личные записи и резервные копии хранятся отдельно.</p>
        <div class="settings-actions">${button('toggle-demo', demo ? 'Перейти в мои игры' : 'Открыть демо', demo ? 'arrow' : 'sparkle')}</div></section>
      <section class="panel settings-panel"><span class="metric-icon aqua">${icon('monitor', 21)}</span><h2>Приложение на экране «Домой»</h2>
        <p>На iPhone открой AFTERSAVE в Safari и выбери «Поделиться» → «На экран “Домой”». На компьютере используй пункт установки приложения в браузере, если он доступен.</p>
        <small id="offline-label">${'serviceWorker' in navigator && navigator.serviceWorker.controller ? 'Офлайн-режим готов на этом устройстве.' : 'Офлайн-режим доступен после первой загрузки по HTTPS.'}</small></section>
      <section class="panel settings-panel"><span class="metric-icon amber">${icon('globe', 21)}</span><h2>Игровые аккаунты</h2>
        <p>Синхронизация со Steam, PlayStation Network и Xbox недоступна. Записи ведутся вручную, а перенос библиотеки доступен через JSON.</p></section>
    </div>`;
}

function render(focusMain = false) {
  const views = { library, wishlist: wishlistPage, collections: collectionsPage, stats: statsPage, profile: profilePage, settings: settingsPage, game: gamePage };
  const demoNotice = demo && !['library', 'settings', 'game'].includes(route.page) ?
    `<div class="demo-notice">${icon('sparkle', 17)} <span>Демонстрационные данные</span> ${button('toggle-demo', 'Мои игры', 'arrow', 'quiet')}</div>` : '';
  app.innerHTML = shell(demoNotice + views[route.page]());
  app.querySelectorAll('img').forEach(image => {
    const fail = () => { image.hidden = true; };
    image.addEventListener('error', fail, { once: true });
    if (image.complete && !image.naturalWidth) fail();
  });
  document.title = route.page === 'library' ? 'AFTERSAVE — игровая библиотека' : `${labels[route.page]} · AFTERSAVE`;
  if (focusMain) app.querySelector('#main').focus({ preventScroll: true });
}

function renderResults() {
  const current = document.querySelector('#game-results');
  if (current) {
    current.outerHTML = gameResults(sourceForPage());
    document.querySelectorAll('#game-results img').forEach(image => {
      const fail = () => { image.hidden = true; };
      image.addEventListener('error', fail, { once: true });
      if (image.complete && !image.naturalWidth) fail();
    });
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
    <label class="field"><span>Статус</span><select name="status">${Object.entries(STATUSES).map(([value, label]) => option(value, label, game.status || 'planned')).join('')}</select></label>
    ${inputField('Прогресс, %', 'progress', game.progress ?? 0, 'min="0" max="100" step="any" required', 'number')}
    ${inputField('Время, ч', 'hours', game.hours ?? 0, 'min="0" max="100000" step="any" required', 'number')}
    ${inputField('Оценка / 10', 'rating', game.rating, 'min="0" max="10" step="any" placeholder="Без оценки"', 'number')}
    ${inputField('Дата начала', 'startedAt', game.startedAt, '', 'date')}
    ${inputField('Дата завершения', 'finishedAt', game.finishedAt, '', 'date')}
    ${inputField('Жанр', 'genre', game.genre, 'maxlength="80" placeholder="Например, RPG"')}
    ${inputField('Год выпуска', 'year', game.year, 'min="1900" max="2100" step="1" placeholder="Например, 2022"', 'number')}
    ${inputField('Теги через запятую', 'tags', (game.tags || []).join(', '), 'maxlength="819" placeholder="кооператив, уютные игры"')}
    <label class="field"><span>Обложка по HTTPS</span><input name="cover" value="${esc(coverUrl(game.cover).startsWith('https:') ? game.cover : '')}" type="url" placeholder="https://…" maxlength="2048"></label>
    <label class="field span-all"><span>Заметки</span><textarea name="notes" rows="3" maxlength="5000" placeholder="Впечатления, цели или напоминания">${esc(game.notes)}</textarea></label>
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
  if (!title) return formError(form, 'Введите название игры.');
  if (coverInput && !coverUrl(coverInput).startsWith('https:')) return formError(form, 'Адрес обложки должен начинаться с https://.');
  if (startedAt && finishedAt && finishedAt < startedAt) return formError(form, 'Дата завершения должна быть не раньше даты начала.');
  const value = {
    ...draft.game, title, platform: fields.get('platform'), status: fields.get('status'),
    progress: Number(fields.get('progress')), hours: Number(fields.get('hours')),
    rating: fields.get('rating') === '' ? null : Number(fields.get('rating')),
    startedAt, finishedAt, notes: fields.get('notes'), genre: fields.get('genre'), year: fields.get('year') ? Number(fields.get('year')) : null,
    tags: fields.get('tags').split(',').map(tag => tag.trim()).filter(Boolean), wishlist: fields.has('wishlist'),
    collectionIds: fields.getAll('collection'), cover: coverInput || (coverUrl(draft.game.cover).startsWith('./') ? draft.game.cover : ''),
    demo: false, updatedAt: new Date().toISOString()
  };
  try {
    const record = createGame(value);
    const allGames = draft.editing ? state.games.map(game => game.id === record.id ? record : game) : [...state.games, record];
    if (commit({ ...state, showDemo: false, games: allGames }, draft.editing ? 'Изменения сохранены' : 'Игра добавлена')) {
      if (demo) clearFilters();
      demo = false;
      dialog.close();
      go('game', record.id);
      render();
    }
  } catch (error) { formError(form, error.message || 'Проверьте поля и попробуйте ещё раз.'); }
}

function clearFilters() {
  Object.assign(filter, { query: '', status: '', platform: '', tag: '', collection: '' });
}

function toggleDemo() {
  if (commit({ ...state, showDemo: !demo })) {
    demo = !demo;
    clearFilters();
    if (route.page === 'game' || route.id) go('library');
    render();
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

function dateStamp() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}


const actions = {
  'add': () => openCatalog(),
  'add-wish': () => openCatalog(true),
  'online-catalog': searchOnline,
  'manual-game': () => openGameForm({ title: dialog.querySelector('#catalog-query')?.value.trim(), wishlist: wishDefault }),
  'choose-game': control => {
    const item = candidates[Number(control.dataset.index)];
    if (item) openGameForm({ ...item, catalogId: item.id, id: undefined, wishlist: wishDefault });
  },
  'copy-demo': () => {
    const game = findByRoute(DEMO);
    if (game) openGameForm({ title: game.title, platform: game.platform, cover: game.cover,
      description: game.description, genre: game.genre, accent: game.accent, year: game.year, catalogId: game.catalogId });
  },
  'edit-game': () => {
    const game = findByRoute(state.games);
    if (game && !demo) openGameForm(game, true);
  },
  'delete-game': () => {
    const game = findByRoute(state.games);
    if (!game || demo) return;
    confirmAction('Удалить игру?', `«${esc(game.title)}» и её прогресс будут удалены из библиотеки.`, 'Удалить игру', () => {
      if (!commit({ ...state, games: state.games.filter(item => item.id !== game.id) }, 'Игра удалена')) return false;
      go('library');
      return true;
    }, true);
  },
  'wish': control => {
    const game = state.games.find(item => item.id === control.dataset.id);
    if (!game || demo) return;
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
  'toggle-demo': toggleDemo,
  'new-collection': () => openCollectionForm(),
  'edit-collection': control => {
    const item = state.collections.find(item => item.id === control.dataset.id);
    if (item && !demo) openCollectionForm(item);
  },
  'delete-collection': control => {
    const item = state.collections.find(item => item.id === control.dataset.id);
    if (!item || demo) return;
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
      demo = state.showDemo;
      clearFilters();
      render();
      return true;
    });
  } catch (error) { notify(error.message || 'Не удалось прочитать файл копии.', true); }
});

dialog.addEventListener('change', event => {
  if (event.target.name === 'status' && ['completed', 'perfect'].includes(event.target.value)) {
    event.target.form.elements.progress.value = 100;
  }
});

dialog.addEventListener('submit', event => {
  const form = event.target;
  event.preventDefault();
  if (form.id === 'game-form') saveGame(form);
  if (form.id === 'profile-form') {
    const fields = new FormData(form);
    const name = fields.get('name').trim();
    if (!name) return formError(form, 'Введите имя.');
    if (commit({ ...state, showDemo: false, profile: { name, bio: fields.get('bio') } }, 'Профиль сохранён')) {
      if (demo) clearFilters();
      demo = false;
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
      if (demo) clearFilters();
      demo = false;
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
  route = next;
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
    demo = state.showDemo;
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

render();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(new URL('./sw.js', import.meta.url)).catch(error => console.warn('AFTERSAVE offline:', error));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const offline = app.querySelector('#offline-label');
    if (offline) offline.textContent = 'Офлайн-режим готов на этом устройстве.';
  });
}


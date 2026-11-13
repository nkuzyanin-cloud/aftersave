const VERSION = 8;
const FORMAT = 'game-library';
export const STORAGE_KEY = `game-library:${new URL('.', import.meta.url).pathname}`;
const EPOCH = '1970-01-01T00:00:00.000Z';

export const STATUSES = Object.freeze({
  playing: 'Играю',
  completed: 'Пройдено',
  dropped: 'Дроп'
});

export const PLATFORMS = Object.freeze([
  'PC', 'Steam Deck', 'PS5', 'PS4', 'PS3', 'Xbox Series X|S', 'Xbox One',
  'Xbox 360', 'Switch', 'Switch 2', 'iOS / iPadOS', 'Android', 'Другое'
]);

function catalogGame(id, title, genre, year, accent, description, aliases = []) {
  return { id, title, genre, year, platform: 'PC', cover: `./assets/covers/${id}.jpg`, accent, description, aliases };
}

export const CATALOG = Object.freeze([
  catalogGame('elden-ring', 'Elden Ring', 'Экшен-RPG', 2022, '#bb945f', 'Путешествие по Междуземью с тайными тропами, древними руинами и опасными противниками.', ['Элден Ринг', 'Эльден Ринг']),
  catalogGame('days-gone', 'Days Gone', 'Экшен', 2019, '#7a9c82', 'Поездки по заброшенным дорогам Орегона и встречи с ордами заражённых.', ['Жизнь после', 'Дейс Гон']),
  catalogGame('hollow-knight', 'Hollow Knight', 'Метроидвания', 2017, '#7a9ace', 'Подземное королевство Халлоунест с лабиринтом тоннелей и заброшенными городами.', ['Холлоу Найт', 'Полый рыцарь']),
  catalogGame('cyberpunk-2077', 'Cyberpunk 2077', 'Экшен-RPG', 2020, '#e9b750', 'Наёмник Ви ищет способ выжить в Найт-Сити, городе корпораций и киберимплантов.', ['Киберпанк 2077', 'Киберпанк']),
  catalogGame('deadpool', 'Deadpool', 'Экшен', 2013, '#be4257', 'Приключение болтливого наёмника Marvel, который любит нарушать правила своей игры.', ['Дэдпул', 'Дедпул']),
  catalogGame('ets2', 'Euro Truck Simulator 2', 'Симулятор', 2012, '#e1a86a', 'Грузовые рейсы по Европе, собственная транспортная компания и коллекция тягачей.', ['ETS2', 'ETS 2', 'Евро Трак Симулятор 2']),
  catalogGame('hades', 'Hades', 'Рогалик', 2020, '#da735d', 'Загрей раз за разом пробивается из подземного царства, пользуясь дарами олимпийцев.', ['Аид', 'Хейдес']),
  catalogGame('disco-elysium', 'Disco Elysium', 'RPG', 2019, '#b79582', 'Детективное расследование в Ревашоле, где каждый разговор способен изменить ход дела.', ['Диско Элизиум', 'Диско Элизиум Финал Кат']),
  catalogGame('red-dead-redemption-2', 'Red Dead Redemption 2', 'Экшен', 2018, '#e07961', 'Артур Морган и банда Ван дер Линде пытаются выжить на закате Дикого Запада.', ['RDR2', 'RDR 2', 'РДР 2']),
  catalogGame('control', 'Control', 'Экшен', 2019, '#b6688e', 'Джесси Фейден исследует Старейший дом, штаб секретного Бюро контроля.', ['Контрол', 'Контроль']),
  catalogGame('witcher-3', 'The Witcher 3: Wild Hunt', 'Экшен-RPG', 2015, '#8eab8f', 'Геральт ищет Цири среди лесов, городов и островов, по которым проходит Дикая Охота.', ['Ведьмак 3', 'The Witcher 3', 'Дикая Охота']),
  catalogGame('baldur-gate-3', "Baldur’s Gate 3", 'RPG', 2023, '#ba9571', 'Отряд героев исследует Забытые Королевства и ищет способ избавиться от паразитов.', ["Baldur's Gate 3", 'BG3', 'Балдурс Гейт 3', 'Балдурc Гейт 3'])
]);

function searchable(value) {
  return value.normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim();
}

export function searchCatalog(query = '') {
  const terms = searchable(query).split(' ').filter(Boolean);
  return CATALOG.filter(game => {
    const haystack = searchable([game.title, game.genre, game.year, ...game.aliases].join(' '));
    return terms.every(term => haystack.includes(term));
  });
}

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

async function wikidata(params, signal) {
  const query = new URLSearchParams({ ...params, origin: '*', format: 'json', formatversion: '2' });
  const response = await fetch(`${WIKIDATA_API}?${query}`, {
    signal, credentials: 'omit', referrerPolicy: 'no-referrer'
  });
  if (!response.ok) throw new Error('Не удалось связаться с Wikidata.');
  const result = await response.json();
  if (result.error) throw new Error('Wikidata не смогла обработать запрос.');
  return result;
}

function getClaims(entity, property) {
  return (entity.claims?.[property] ?? [])
    .filter(claim => claim.rank !== 'deprecated')
    .map(claim => claim.mainsnak?.datavalue?.value)
    .filter(Boolean);
}

export async function searchOnlineCatalog(query, { signal } = {}) {
  const text = query.trim().slice(0, 160);
  if (text.length < 2) return [];

  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, 8000);
  try {
    const language = /\p{Script=Cyrillic}/u.test(text) ? 'ru' : 'en';
    const { search = [] } = await wikidata({
      action: 'wbsearchentities', search: text, type: 'item', language, uselang: 'ru', limit: '15'
    }, controller.signal);
    const ids = search.map(item => item.id).filter(id => /^Q\d+$/.test(id));
    if (!ids.length) return [];

    const { entities = {} } = await wikidata({
      action: 'wbgetentities', ids: ids.join('|'), props: 'claims'
    }, controller.signal);
    const localMatches = new Set(searchCatalog(text).map(game => searchable(game.title)));
    return search.flatMap(item => {
      const entity = entities[item.id];
      if (!entity || !getClaims(entity, 'P31').some(value => value.id === 'Q7889')) return [];
      const title = item.label?.slice(0, 160).trim();
      if (!title || localMatches.has(searchable(title))) return [];
      const releaseYears = getClaims(entity, 'P577').map(value => {
        const match = /^\+(\d{4})-/.exec(value.time ?? '');
        return match && value.precision >= 9 ? Number(match[1]) : null;
      }).filter(year => year >= 1900 && year <= 2100);
      return [{
        id: `wikidata-${item.id}`,
        title,
        description: (item.description ?? '').slice(0, 1000),
        year: releaseYears.length ? Math.min(...releaseYears) : null,
        genre: '', platform: 'PC', cover: '', accent: '#62cfff'
      }];
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (controller.signal.aborted) throw new Error('Wikidata не ответила вовремя.');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} имеет неверный формат.`);
  }
  return value;
}

function text(value, label, maxLength, fallback = '') {
  if (value == null) return fallback;
  if (typeof value !== 'string') throw new Error(`${label} должно быть текстом.`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new Error(`${label} должно содержать до ${maxLength} символов.`);
  return trimmed;
}

function requiredText(value, label, maxLength) {
  const result = text(value, label, maxLength);
  if (!result) throw new Error(`${label} нужно заполнить.`);
  return result;
}

function number(value, label, min, max, fallback = null, whole = false) {
  if (value == null || value === '') return fallback;
  const numeric = typeof value === 'string' && /^[+-]?\d+(?:[.,]\d+)?$/.test(value.trim())
    ? Number(value.trim().replace(',', '.'))
    : value;
  if (typeof numeric !== 'number' || !Number.isFinite(numeric) || numeric < min || numeric > max
      || (whole && !Number.isInteger(numeric))) {
    throw new Error(`${label} должно быть ${whole ? 'целым ' : ''}числом от ${min} до ${max}.`);
  }
  return numeric;
}

function bool(value, label, fallback = false) {
  if (value == null) return fallback;
  if (typeof value !== 'boolean') throw new Error(`${label} имеет неверный формат.`);
  return value;
}

function list(value, label, maxLength) {
  if (!Array.isArray(value) || value.length > maxLength) {
    throw new Error(`${label} должны быть списком из не более чем ${maxLength} элементов.`);
  }
  return value;
}

function strings(value, label, maxItems, maxLength) {
  return [...new Set(list(value ?? [], label, maxItems)
    .map(item => text(item, label, maxLength))
    .filter(Boolean))];
}

function day(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value) return value;
  }
  throw new Error('Проверьте дату в карточке игры.');
}

function stamp(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  throw new Error('Время изменения записи имеет неверный формат.');
}

function identifier(value, label) {
  const result = requiredText(value, label, 96);
  if (!/^[\p{Letter}\p{Number}_.-]+$/u.test(result)) {
    throw new Error(`${label} содержит недопустимые символы.`);
  }
  return result;
}

function coverPath(value) {
  const result = text(value, 'Ссылка на обложку', 2048);
  if (!result || /^(?:\.\/|\/)?assets\/[a-z0-9_-]+(?:\/[a-z0-9_-]+)*\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(result)) {
    return result.startsWith('/assets/') ? `.${result}` : result;
  }
  try {
    const url = new URL(result);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch {
    // The form can report the same error for malformed and unsupported URLs.
  }
  throw new Error('Укажите HTTPS-ссылку на обложку.');
}

function accentColor(value) {
  const color = text(value, 'Цвет', 7, '#62cfff');
  if (!color) return '#62cfff';
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Цвет обложки имеет неверный формат.');
  return color;
}

export function isEldenRing(game) {
  return game?.steam ? Number(game.steam.appid) === 1245620 :
    game?.catalogId === 'elden-ring' || /^\s*(elden ring|эл[ь]?ден ринг)\s*$/i.test(game?.title ?? '');
}

function normalizeBossProgress(value) {
  const entries = Object.entries(value ?? {}).slice(0, 300);
  return Object.fromEntries(entries.flatMap(([id, item]) => {
    if (!/^[a-z0-9][a-z0-9-]{1,94}$/.test(id) || !item) return [];
    const deaths = Object.fromEntries(Object.entries(item.deaths ?? {}).slice(0, 100).filter(([device, count]) =>
      /^[a-f0-9-]{36}$/.test(device) && Number.isSafeInteger(count) && count > 0 && count <= 1000000
    ));
    return typeof item.won === 'boolean' || Object.keys(deaths).length ? [[id, { won: item.won === true, deaths }]] : [];
  }));
}

function normalizeGame(value, fallbackId, fallbackTimestamp) {
  const game = object(value, 'Запись игры');
  const status = game.status === 'perfect' ? 'completed' : game.status || 'planned';
  if (status !== 'planned' && !Object.hasOwn(STATUSES, status)) throw new Error('Выберите известный статус игры.');

  const startedAt = day(game.startedAt);
  const finishedAt = day(game.finishedAt);
  if (startedAt && finishedAt && finishedAt < startedAt) {
    throw new Error('Дата окончания должна быть не раньше даты начала.');
  }

  const createdAt = stamp(game.createdAt, fallbackTimestamp);
  const progress = number(game.progress, 'Прогресс', 0, 100, status === 'completed' ? 100 : 0);
  return {
    id: identifier(game.id ?? fallbackId, 'Идентификатор игры'),
    title: requiredText(game.title, 'Название игры', 160),
    status,
    rating: number(game.rating, 'Оценка', 0, 10),
    grade: typeof game.grade === 'string' && /^[SABCDEF]$/.test(game.grade) ? game.grade : '',
    gradeCleared: bool(game.gradeCleared, 'Оценка сброшена'),
    platform: text(game.platform, 'Платформа', 50, 'PC') || 'Другое',
    startedAt,
    finishedAt,
    hours: number(game.hours, 'Часы', 0, 100000, 0),
    playthroughCount: number(game.playthroughCount, 'Количество прохождений', 0, Number.MAX_SAFE_INTEGER, 0, true),
    notes: text(game.notes, 'Заметки', 5000),
    tags: strings(game.tags, 'Теги', 20, 40),
    collectionIds: strings(game.collectionIds, 'Коллекции игры', 500, 96)
      .map(id => identifier(id, 'Идентификатор коллекции')),
    wishlist: bool(game.wishlist, 'Отметка «Вишлист»'),
    progress: game.status === 'perfect' ? 100 : progress,
    genre: text(game.genre, 'Жанр', 80),
    year: number(game.year, 'Год выпуска', 1900, 2100, null, true),
    cover: coverPath(game.cover),
    accent: accentColor(game.accent),
    description: text(game.description, 'Описание', 1000),
    catalogId: text(game.catalogId, 'Идентификатор в каталоге', 96),
    createdAt,
    updatedAt: stamp(game.updatedAt, createdAt),
    demo: bool(game.demo, 'Метка демо'),
    favorite: bool(game.favorite, 'Избранное'),
    steam: game.steam == null ? null : normalizeSteamGame(game.steam),
    runs: normalizeRuns(game.runs ?? []),
    shelf: bool(game.shelf, 'Моя полка', !game.steam),
    hidden: bool(game.hidden, 'Скрытая игра'),
    sessions: normalizeJournal(game.sessions ?? [], true),
    journal: normalizeJournal(game.journal ?? [], false),
    bossProgress: isEldenRing(game) ? normalizeBossProgress(game.bossProgress) : {}
  };
}

function normalizeJournal(value, session) {
  const label = session ? 'Сессии' : 'Заметки';
  const items = list(value, label, 2000).map(value => {
    const item = object(value, 'Запись журнала');
    const result = {
      id: identifier(item.id, 'Идентификатор записи'),
      date: day(item.date),
      text: session ? text(item.text, 'Комментарий', 5000) : requiredText(item.text, 'Заметка', 5000)
    };
    if (session) {
      if (!result.date) throw new Error('Укажите дату сессии.');
      result.minutes = number(item.minutes, 'Длительность в минутах', 1, 1440, null, true);
      if (!result.minutes) throw new Error('Укажите длительность сессии.');
    }
    return result;
  });
  ensureUnique(items, label);
  return items;
}

function migrateGame(game) {
  const untouchedImport = game.steam && game.status === 'planned' && game.createdAt === game.updatedAt &&
    !game.catalogId && game.cover === `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.steam.appid}/library_600x900.jpg` &&
    game.rating == null && !game.notes && !game.hours && !game.progress && !game.favorite && !game.wishlist &&
    !game.startedAt && !game.finishedAt && !game.tags?.length && !game.collectionIds?.length && !game.runs?.length;
  return {
    ...game, shelf: game.shelf ?? !untouchedImport,
    journal: game.journal ?? (typeof game.notes === 'string' && game.notes.trim() ?
      [{ id: 'previous-note', date: '', text: game.notes }] : [])
  };
}

function normalizeSteamGame(value) {
  const game = object(value, 'Запись Steam');
  return {
    appid: number(game.appid, 'AppID', 1, 4294967295, null, true),
    minutes: number(game.minutes, 'Время Steam', 0, Number.MAX_SAFE_INTEGER, 0, true),
    lastPlayed: number(game.lastPlayed, 'Последний запуск', 0, 253402300799, 0, true)
  };
}

function normalizeRuns(value) {
  const runs = list(value, 'Прохождения', 500).map(value => {
    const run = object(value, 'Прохождение');
    const startedAt = day(run.startedAt);
    const finishedAt = day(run.finishedAt);
    if (startedAt && finishedAt && finishedAt < startedAt) throw new Error('Проверьте даты прохождения.');
    return {
      id: identifier(run.id, 'Идентификатор прохождения'),
      title: requiredText(run.title, 'Название прохождения', 120),
      cycle: text(run.cycle, 'Цикл', 40),
      startedAt, finishedAt,
      build: text(run.build, 'Билд', 150),
      difficulty: text(run.difficulty, 'Сложность', 80),
      notes: text(run.notes, 'Заметки прохождения', 5000),
      rating: number(run.rating, 'Оценка прохождения', 0, 10)
    };
  });
  ensureUnique(runs, 'Прохождения');
  return runs;
}

function normalizeSteam(value) {
  if (value == null) return null;
  const steam = object(value, 'Профиль Steam');
  if (typeof steam.account !== 'string' || !/^7656\d{13}$/.test(steam.account)) throw new Error('Неверный SteamID.');
  const localSessions = list(steam.localSessions ?? [], 'Локальные сессии Steam', 10000).map(value => {
    const session = object(value,'Локальная сессия Steam');
    const appid = number(session.appid,'AppID',1,4294967295,null,true);
    const startedAt = number(session.startedAt,'Начало сессии',1,253402300799999,null,true);
    const endedAt = number(session.endedAt,'Конец сессии',1,253402300799999,null,true);
    if (!appid || !startedAt || !endedAt || endedAt <= startedAt) throw new Error('Некорректная локальная сессия Steam.');
    return { appid, startedAt, endedAt };
  });
  return { account: steam.account, lastSync: stamp(steam.lastSync, EPOCH), activity: normalizeActivity(steam.activity),
    ...(localSessions.length ? {localSessions} : {}) };
}

function normalizeActivity(value) {
  if (value == null) return null;
  const activity = object(value, 'Автоучёт Steam');
  const time = value => number(value, 'Время опроса Steam', 0, 253402300799999, 0, true);
  const startedAt = time(activity.startedAt);
  const lastObserved = time(activity.lastObserved);
  const windows = list(activity.windows ?? [], 'Интервалы Steam', 3000).map(value => {
    const window = object(value, 'Интервал Steam');
    const observedFrom = time(window.observedFrom);
    const observedTo = time(window.observedTo);
    const appid = number(window.appid, 'AppID', 1, 4294967295, null, true);
    const minutes = number(window.minutes, 'Минуты Steam', 1, Number.MAX_SAFE_INTEGER, null, true);
    if (!appid || !minutes || !observedFrom || observedTo <= observedFrom || observedFrom < startedAt || observedTo > lastObserved) {
      throw new Error('Некорректный интервал автоучёта Steam.');
    }
    return { appid, observedFrom, observedTo, minutes };
  });
  if (lastObserved < startedAt) throw new Error('Некорректные даты автоучёта Steam.');
  return { startedAt, lastObserved, windows };
}

function newId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `game-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function createGame(partial = {}) {
  return normalizeGame(partial, partial.id ?? newId(), new Date().toISOString());
}

export function emptyState() {
  return {
    format: FORMAT, version: VERSION, revision: 0, games: [], collections: [],
    profile: { name: 'Игрок', bio: '' }, showDemo: true, steam: null
  };
}

function migrateV1(state) {
  const games = list(state.games, 'Игры', 10000);
  const statusMap = new Map(Object.entries(STATUSES).map(([key, value]) => [value, key]));
  return {
    ...state,
    format: FORMAT,
    version: VERSION,
    games: games.map((value, index) => {
      const game = object(value, 'Запись игры');
      return {
        ...game,
        id: game.id == null ? `legacy-${index + 1}` : String(game.id),
        title: game.title ?? game.name,
        status: statusMap.get(game.status) ?? game.status,
        hours: game.hours ?? game.playtime,
        startedAt: game.startedAt ?? game.started,
        finishedAt: game.finishedAt ?? game.completedAt,
        wishlist: game.wishlist ?? game.favorite,
        tags: typeof game.tags === 'string' ? game.tags.split(',') : game.tags,
        collectionIds: game.collectionIds ?? (game.collectionId ? [String(game.collectionId)] : [])
      };
    })
  };
}

function ensureUnique(entries, label) {
  if (new Set(entries.map(entry => entry.id)).size !== entries.length) {
    throw new Error(`В разделе «${label}» обнаружены повторяющиеся идентификаторы.`);
  }
}

function normalizeState(value) {
  let state = object(value, 'Файл библиотеки');
  if (!Number.isSafeInteger(state.version) || (state.format !== FORMAT && state.format != null)) {
    throw new Error('Выберите резервную копию игровой библиотеки в формате JSON.');
  }
  if (state.version === 1) state = migrateV1(state);
  if ([2, 3, 4, 5, 6, 7].includes(state.version)) state = { ...state, version: VERSION };
  if (state.version !== VERSION) {
    throw new Error('Эта версия формата библиотеки не поддерживается.');
  }

  const collections = list(state.collections ?? [], 'Коллекции', 500).map(value => {
    const collection = object(value, 'Коллекция');
    return {
      id: identifier(collection.id, 'Идентификатор коллекции'),
      name: requiredText(collection.name, 'Название коллекции', 64)
    };
  });
  ensureUnique(collections, 'Коллекции');
  const collectionIds = new Set(collections.map(collection => collection.id));
  const games = list(state.games, 'Игры', 10000)
    .map(value => normalizeGame(migrateGame(object(value, 'Запись игры')), undefined, EPOCH))
    .filter(game => !game.demo);
  ensureUnique(games, 'Игры');
  const steam = normalizeSteam(state.steam);
  const linked = new Set();
  for (const game of games) {
    if (game.collectionIds.some(id => !collectionIds.has(id))) {
      throw new Error(`Карточка «${game.title}» ссылается на неизвестную коллекцию.`);
    }
    if (game.steam) {
      if (!steam || !game.steam.appid || linked.has(game.steam.appid)) throw new Error('Некорректная связь с библиотекой Steam.');
      linked.add(game.steam.appid);
    }
  }

  const profile = object(state.profile ?? {}, 'Профиль');
  return {
    format: FORMAT,
    version: VERSION,
    revision: number(state.revision, 'Номер изменения', 0, Number.MAX_SAFE_INTEGER, 0, true),
    games,
    collections,
    profile: {
      name: text(profile.name, 'Имя профиля', 64) || 'Игрок',
      bio: text(profile.bio, 'Описание профиля', 500)
    },
    showDemo: bool(state.showDemo, 'Показ демо', true),
    steam
  };
}

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    throw new Error('Браузер не разрешает читать локальное хранилище.');
  }
}

function parseState(source) {
  let data;
  try {
    data = JSON.parse(source);
  } catch {
    throw new Error('Не удалось прочитать JSON.');
  }
  return normalizeState(data);
}

export function load() {
  const source = readStored();
  if (source === null) return emptyState();
  try {
    return parseState(source);
  } catch (error) {
    throw new Error(`Не удалось открыть сохранённую библиотеку. ${error.message}`);
  }
}

export function save(state, { replace = false } = {}) {
  const next = normalizeState(state);
  let revision = next.revision;
  if (replace) {
    const source = readStored();
    if (source !== null) {
      try {
        revision = Math.max(revision, parseState(source).revision);
      } catch {
        // The user explicitly chose to replace the data, including corrupt data.
      }
    }
  } else if (load().revision !== revision) {
    throw new Error('Библиотека изменилась в другой вкладке. Обновите страницу и повторите действие.');
  }

  if (revision === Number.MAX_SAFE_INTEGER) throw new Error('Невозможно увеличить номер версии записи.');
  next.revision = revision + 1;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    throw new Error('Не удалось сохранить изменения. Проверьте доступ к локальному хранилищу и наличие свободного места.');
  }
  return next;
}

export function importJSON(source) {
  if (typeof source !== 'string' || source.length > 8 * 1024 * 1024) {
    throw new Error('Выберите JSON-файл размером до 8 МБ.');
  }
  return { ...parseState(source.replace(/^\uFEFF/, '')), revision: 0 };
}

export function exportJSON(state) {
  const { revision, ...backup } = normalizeState(state);
  return JSON.stringify(backup, null, 2);
}

function csvCell(value) {
  const raw = String(value ?? '');
  // Prevent formulas when a title, tag or note is opened in a spreadsheet.
  const safe = /^(?:\s*[=+@-]|[\t\r\n])/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function exportCSV(state) {
  const { games, collections } = normalizeState(state);
  const names = new Map(collections.map(collection => [collection.id, collection.name]));
  const header = [
    'Название', 'Статус', 'Платформа', 'Жанр', 'Год', 'Оценка', 'Часы', 'Прогресс (%)',
    'Вишлист', 'Дата начала', 'Дата окончания', 'Теги', 'Коллекции', 'Заметки',
    'Описание', 'Обложка', 'Добавлено', 'Изменено'
  ];
  const rows = games.map(game => [
    game.title, STATUSES[game.status], game.platform, game.genre, game.year, game.rating,
    game.hours, game.progress, game.wishlist ? 'Да' : 'Нет', game.startedAt, game.finishedAt,
    game.tags.join(', '), game.collectionIds.map(id => names.get(id)).join(', '), game.journal.map(item => item.text).join('\n\n'),
    game.description, game.cover, game.createdAt, game.updatedAt
  ]);
  return '\uFEFF' + [header, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n') + '\r\n';
}

export const DEMO_PROFILE = Object.freeze({ name: 'Странник', bio: 'Собираю игровые миры и истории, к которым хочется вернуться.' });

export const DEMO_COLLECTIONS = Object.freeze([
  { id: 'demo-worlds', name: 'Большие миры' },
  { id: 'demo-indie', name: 'Инди-находки' },
  { id: 'demo-evening', name: 'На вечер' }
]);

function daysAgo(days) {
  const today = new Date();
  today.setUTCDate(today.getUTCDate() - days);
  return today.toISOString().slice(0, 10);
}

function demoGame(id, daysSinceAdded, details) {
  const entry = CATALOG.find(game => game.id === id);
  const dateAdded = `${daysAgo(daysSinceAdded)}T12:00:00.000Z`;
  return createGame({
    ...entry, ...details, id: `demo-${id}`, catalogId: id, demo: true,
    createdAt: dateAdded, updatedAt: dateAdded
  });
}

export const DEMO = Object.freeze([
  demoGame('elden-ring', 2, {
    status: 'playing', platform: 'PS5', progress: 64, hours: 48.5, rating: 9.5,
    startedAt: daysAgo(42), tags: ['Открытый мир', 'Soulslike'], collectionIds: ['demo-worlds'],
    notes: 'Вернуться в Лиурнию и посмотреть, куда ведёт тропа у озера.'
  }),
  demoGame('days-gone', 4, {
    status: 'planned', wishlist: true, tags: ['Открытый мир', 'Выживание'], collectionIds: ['demo-worlds'],
    notes: 'Оставить на длинные выходные.'
  }),
  demoGame('hollow-knight', 12, {
    status: 'perfect', platform: 'Switch', progress: 100, hours: 36, rating: 9,
    startedAt: daysAgo(68), finishedAt: daysAgo(12), tags: ['Инди', 'Исследование'], collectionIds: ['demo-indie']
  }),
  demoGame('cyberpunk-2077', 16, {
    status: 'playing', progress: 35, hours: 24, rating: 8.5, startedAt: daysAgo(15),
    tags: ['Открытый мир', 'Киберпанк'], collectionIds: ['demo-worlds'],
    notes: 'Продолжить задания Панам и заглянуть в Пёсий город.'
  }),
  demoGame('hades', 19, {
    status: 'completed', platform: 'Steam Deck', progress: 88, hours: 29, rating: 9,
    startedAt: daysAgo(75), finishedAt: daysAgo(19), tags: ['Инди', 'Рогалик'],
    collectionIds: ['demo-indie', 'demo-evening']
  }),
  demoGame('disco-elysium', 23, {
    status: 'dropped', progress: 12, hours: 4, startedAt: daysAgo(54),
    tags: ['Инди', 'Детектив'], collectionIds: ['demo-indie']
  }),
  demoGame('control', 28, {
    status: 'planned', platform: 'PS5', wishlist: true, tags: ['Мистика'], collectionIds: ['demo-evening']
  })
]);

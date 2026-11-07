
import { createGame } from './data.js';

const BASE = 'https://aftersave-steam.n-kuzyanin.workers.dev/';
const KNOWN = new Map(Object.entries({
  'elden-ring':1245620, 'days-gone':1259420, 'deadpool':224060, 'ets2':227300,
  'cyberpunk-2077':1091500, 'hollow-knight':367520, 'hades':1145360,
  'disco-elysium':632470, 'red-dead-redemption-2':1174180, 'control':870780,
  'witcher-3':292030, 'baldur-gate-3':1086940
}));
const appId = value => Number.isInteger(value) && value >= 1 && value <= 4294967295;
const steamId = value => typeof value === 'string' && /^7656\d{13}$/.test(value);
const titleKey = title => title.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const nonnegative = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const capsulePaths = {
  2828710: 'deef1b198941015428f5b3d3e29e819f7ef86abc',
  5266240: '612d69b23adfba309b22e13531525430bb6f302e'
};
export const steamCover = id => capsulePaths[id] ?
  `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${id}/${capsulePaths[id]}/library_capsule.jpg` :
  appId(id) ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_600x900.jpg` : '';
export const steamHeader = id => appId(id) ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg` : '';
export const steamHero = id => appId(id) ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_hero.jpg` : '';

const artworkRequests = new Map();
let artworkSupport;
export function fetchSteamArtwork(id) {
  if (!appId(id)) return Promise.resolve(null);
  if (artworkRequests.has(id)) return artworkRequests.get(id);
  const read = async path => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(new URL(path, BASE), { signal: controller.signal, credentials: 'omit' });
      return response.ok ? await response.json() : null;
    } catch { return null; } finally { clearTimeout(timeout); }
  };
  artworkSupport ??= read('health').then(data => data?.version >= 5);
  const task = artworkSupport.then(supported => supported && read('artwork?appid=' + id))
    .then(data => data && Object.fromEntries(['cover', 'hero', 'header'].map(key =>
      [key, typeof data[key] === 'string' && data[key].startsWith('https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/' + id + '/') ? data[key] : ''])));
  artworkRequests.set(id, task);
  return task;
}

let session;
const pending = new Map();

async function request(path, { legacy = false, password } = {}) {
  const headers = { Accept: 'application/json' };
  if (!legacy && password === undefined) {
    if (!session || session.expiresAt <= Date.now()) throw new Error('Войдите в Steam-интеграцию снова.');
    headers.Authorization = 'Bearer ' + session.token;
  }
  if (password !== undefined) headers['Content-Type'] = 'application/json';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);
  try {
    let response;
    try {
      response = await fetch(new URL(path, BASE), {
        headers, method: password === undefined ? 'GET' : 'POST',
        body: password === undefined ? undefined : JSON.stringify({ password }),
        cache: 'no-store', credentials: 'omit', redirect: 'error', signal: controller.signal
      });
    } catch {
      throw new Error('Worker недоступен. Проверьте подключение и настройки CORS.');
    }
    if (response.status === 429) throw new Error('Steam временно ограничил запросы. Повторите позже.');
    if (response.status === 401) {
      if (password === undefined && !legacy) session = undefined;
      throw new Error(password === undefined ? 'Требуется вход в Steam-интеграцию.' : 'Пароль Steam-интеграции отклонён.');
    }
    if (password !== undefined && [404, 405].includes(response.status)) throw new Error('Защищённый Worker ещё не развёрнут.');
    const data = await response.json().catch(() => null);
    if (response.status === 403 || data?.error === 'private') throw new Error('Steam ограничил доступ. Проверьте видимость игровых данных профиля.');
    if (!response.ok || !data) throw new Error('Worker или Steam вернул ошибку (' + response.status + ').');
    return data;
  } finally { clearTimeout(timeout); }
}

export function connected() { return Boolean(session && session.expiresAt > Date.now()); }
export function disconnect() { session = undefined; }

export async function connect(password, expectedAccount) {
  const result = await request('session', { password });
  if (!steamId(result.account) || typeof result.token !== 'string' || result.token.length > 2048 ||
      !Number.isFinite(result.expiresAt) || result.expiresAt <= Date.now()) throw new Error('Некорректный ответ авторизации.');
  if (expectedAccount && expectedAccount !== result.account) throw new Error('Этот Worker подключён к другому Steam-аккаунту.');
  session = result;
}

function checkAccount(actual, expected) {
  if (!steamId(actual)) throw new Error('Worker не подтвердил SteamID.');
  if (expected && actual !== expected) throw new Error('Этот Worker подключён к другому Steam-аккаунту. Импорт отменён.');
  return actual;
}

export async function fetchLibrary(legacy, expected, step = () => {}) {
  let account = expected;
  if (legacy) {
    step('Проверяем Steam-аккаунт…');
    const proof = await request('achievements?appid=1245620', { legacy: true });
    account = checkAccount(proof.playerstats?.steamID, expected);
  }
  step('Загружаем библиотеку Steam…');
  const response = await request('library', { legacy });
  if (!legacy) account = checkAccount(response.account, account);
  const library = response.response;
  if (!library || !Number.isInteger(library.game_count) || library.game_count < 0) {
    throw new Error('Steam не открыл библиотеку. Проверьте видимость игровых данных профиля.');
  }
  const entries = library.games ?? [];
  if (!Array.isArray(entries) || entries.length !== library.game_count || entries.length > 10000 ||
      entries.some(item => !item || !appId(item.appid) || typeof item.name !== 'string' || !item.name.trim())) {
    throw new Error('Steam вернул неполный или некорректный список. Библиотека сохранена.');
  }
  if (legacy) {
    const proof = await request('achievements?appid=1245620', { legacy: true });
    checkAccount(proof.playerstats?.steamID, account);
  }
  return { account, entries, activity: !legacy && !response.activity?.unavailable ? response.activity : undefined };
}

export function mergeSteam(state, { account, entries, activity }, lastSync = new Date().toISOString()) {
  checkAccount(account, state.steam?.account);
  const games = [...state.games];
  const linked = new Map(games.flatMap((game, index) => game.steam ? [[game.steam.appid, index]] : []));
  const known = new Map();
  const names = new Map();
  games.forEach((game, index) => {
    if (game.steam || !['PC', 'Steam Deck'].includes(game.platform)) return;
    const id = KNOWN.get(game.catalogId);
    if (id) known.set(id, [...(known.get(id) ?? []), index]);
    const key = titleKey(game.title);
    if (key) names.set(key, [...(names.get(key) ?? []), index]);
  });
  const unique = [...new Map(entries.map(item => [item.appid, item])).values()];
  const counts = new Map();
  unique.forEach(entry => {
    const key = titleKey(entry.name);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  let added = 0;
  let updated = 0;
  for (const entry of unique) {
    const key = titleKey(entry.name);
    const exact = known.get(entry.appid) ?? [];
    const byName = key && counts.get(key) === 1 ? (names.get(key) ?? []).filter(index =>
      !KNOWN.has(games[index].catalogId) || KNOWN.get(games[index].catalogId) === entry.appid) : [];
    const candidates = (exact.length ? exact : byName).filter(index => !games[index].steam);
    const index = linked.get(entry.appid) ?? (candidates.length === 1 ? candidates[0] : undefined);
    const steam = { appid: entry.appid, minutes: nonnegative(entry.playtime_forever),
      lastPlayed: Math.min(nonnegative(entry.rtime_last_played), 253402300799) };
    if (index !== undefined) {
      const game = games[index];
      games[index] = { ...game, steam };
      updated++;
    } else {
      games.push(createGame({
        title: entry.name.trim().slice(0, 160), status: 'planned', platform: 'PC', steam, shelf: false,
        cover: steamCover(entry.appid), createdAt: lastSync, updatedAt: lastSync
      }));
      added++;
    }
  }
  return { state: { ...state, games, showDemo: false,
    steam: { account, lastSync, activity: activity ?? state.steam?.activity } }, added, updated };
}

const TTL = 24 * 60 * 60 * 1000;
const memory = new Map();
let database;
function db() {
  if (!database) database = new Promise(resolve => {
    if (!globalThis.indexedDB) return resolve(null);
    const open = indexedDB.open('aftersave-steam:' + new URL('.', import.meta.url).pathname, 1);
    open.onupgradeneeded = () => {
      const store = open.result.createObjectStore('achievements', { keyPath: 'key' });
      store.createIndex('account', 'account');
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = open.onblocked = () => resolve(null);
  });
  return database;
}

async function cacheOperation(mode, run) {
  try {
    const database = await db();
    if (!database) return;
    return await new Promise((resolve, reject) => {
      const tx = database.transaction('achievements', mode);
      const request = run(tx.objectStore('achievements'));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = tx.onerror = () => reject(tx.error);
    });
  } catch { return undefined; }
}

export async function cachedAchievements(account, id) {
  const key = account + ':' + id;
  const record = memory.get(key) ?? await cacheOperation('readonly', store => store.get(key));
  return enrichWitcher(record);
}

let witcherMetadata;
async function enrichWitcher(record) {
  if (record?.appid !== 292030) return record;
  witcherMetadata ??= fetch(new URL('./assets/witcher-3-achievements.json', import.meta.url))
    .then(response => response.ok ? response.json() : [])
    .then(rows => new Map(rows.flatMap(item => item.name ? [[item.id, item], [item.name, item]] : [[item.id, item]])))
    .catch(() => new Map());
  const metadata = await witcherMetadata;
  return { ...record, items: record.items.map(item => {
    const extra = metadata.get(item.id) ?? metadata.get(item.name);
    if (!extra) return item;
    const file = item.unlocked ? extra.icon : extra.gray;
    return { ...item, description: item.description || extra.description || '', hidden: item.hidden || extra.hidden,
      percent: item.percent ?? extra.percent,
      icon: item.icon || (/^[a-f0-9]{40}\.(?:jpg|png)$/i.test(file) ?
        'https://shared.fastly.steamstatic.com/community_assets/images/apps/292030/' + file : '') };
  }) };
}

export async function achievementSummaries(account) {
  if (!account) return [];
  const records = await cacheOperation('readonly', store => store.index('account').getAll(account)) ?? [];
  const result = new Map(records.map(record => [record.key, record]));
  memory.forEach((record, key) => { if (record.account === account) result.set(key, record); });
  return [...result.values()].map(({ appid, total, unlocked, fetchedAt }) => ({ appid, total, unlocked, fetchedAt }));
}

export async function fetchAchievements(account, id, legacy, force = false) {
  if (!steamId(account) || !appId(id)) throw new Error('Игра не привязана к Steam.');
  const cached = await cachedAchievements(account, id);
  if (!force && cached && Date.now() - cached.fetchedAt < TTL) return cached;
  const key = account + ':' + id;
  if (pending.has(key)) return pending.get(key);
  const job = (async () => {
    const result = await request('achievements?appid=' + id, { legacy });
    checkAccount(legacy ? result.playerstats?.steamID : result.account, account);
    const stats = result.playerstats;
    if (!stats?.success || !Array.isArray(stats.achievements) || stats.achievements.length > 5000) {
      throw new Error('Steam не предоставил список достижений для этой игры.');
    }
    const items = [...new Map(stats.achievements.filter(item => typeof item?.apiname === 'string')
      .map(item => [item.apiname, {
        id: item.apiname,
        name: String(item.name || item.apiname).slice(0, 300),
        description: String(item.description || '').slice(0, 1000),
        hidden: item.hidden === true || item.hidden === 1,
        percent: Number.isFinite(item.percent) && item.percent >= 0 && item.percent <= 100 ? item.percent : null,
        unlocked: item.achieved === 1 || item.achieved === true,
        time: Math.min(nonnegative(item.unlocktime), 253402300799),
        icon: typeof item.icon === 'string' && /^https:\/\/[a-z0-9.-]+\//i.test(item.icon) ? item.icon : ''
      }])).values()];
    const record = { key, account, appid: id, fetchedAt: Date.now(), items,
      total: items.length, unlocked: items.filter(item => item.unlocked).length };
    memory.set(key, record);
    await cacheOperation('readwrite', store => store.put(record));
    return enrichWitcher(record);
  })();
  pending.set(key, job);
  try { return await job; } finally { pending.delete(key); }
}

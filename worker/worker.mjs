
import { readActivity, recordSnapshot } from './activity.mjs';

const ORIGIN = 'https://nkuzyanin-cloud.github.io';
const STEAM = 'https://api.steampowered.com/';
const TIMEOUT = 10000;
const encoder = new TextEncoder();
const paths = {
  library: 'IPlayerService/GetOwnedGames/v0001/',
  player: 'ISteamUserStats/GetPlayerAchievements/v0001/',
  schema: 'ISteamUserStats/GetSchemaForGame/v0002/',
  percentages: 'ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/'
};

class RequestError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function validAccount(value) {
  if (typeof value !== 'string' || !/^\d{17}$/.test(value)) return false;
  const individual = BigInt(value) - 76561197960265728n;
  return individual > 0n && individual <= 4294967295n;
}

function allowedOrigin(request) {
  return request.headers.get('Origin') === ORIGIN;
}

function headers(cors) {
  return {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', Vary: 'Origin',
    ...(cors ? { 'Access-Control-Allow-Origin': ORIGIN } : {})
  };
}

function reply(body, status, cors) {
  return new Response(JSON.stringify(body), { status, headers: headers(cors) });
}

function base64(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64(value) {
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0));
}

async function sessionKey(env) {
  return crypto.subtle.importKey('raw', encoder.encode('aftersave-session:' + env.AFTERSAVE_PASSWORD),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function startSession(request, env) {
  if (request.headers.get('content-length') > 1024 || !request.headers.get('content-type')?.startsWith('application/json')) {
    throw new RequestError(400, 'invalid_request');
  }
  // Bound streaming bodies as well as requests with Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError(400, 'invalid_request');
  const decoder = new TextDecoder();
  let bytes = 0;
  let input = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 1024) {
      await reader.cancel();
      throw new RequestError(400, 'invalid_request');
    }
    input += decoder.decode(value, { stream: true });
  }
  let candidate;
  try { candidate = JSON.parse(input + decoder.decode()).password; }
  catch { throw new RequestError(400, 'invalid_request'); }
  if (typeof candidate !== 'string' || candidate.length > 256) throw new RequestError(401, 'unauthorized');
  const [actual, expected] = await Promise.all([candidate, env.AFTERSAVE_PASSWORD]
    .map(value => crypto.subtle.digest('SHA-256', encoder.encode(value))));
  const other = new Uint8Array(expected);
  const difference = new Uint8Array(actual).reduce((result, byte, i) => result | (byte ^ other[i]), 0);
  if (difference !== 0) throw new RequestError(401, 'unauthorized');
  const account = env.STEAM_ID;
  const expiresAt = Date.now() + 60 * 60 * 1000;
  const body = base64(encoder.encode(JSON.stringify({ account, expiresAt, origin: ORIGIN })));
  const signature = await crypto.subtle.sign('HMAC', await sessionKey(env), encoder.encode(body));
  return { token: body + '.' + base64(new Uint8Array(signature)), account, expiresAt };
}

async function authorize(request, env) {
  const token = request.headers.get('Authorization')?.match(/^Bearer ([\w-]{1,512})\.([\w-]{43})$/);
  if (!token) throw new RequestError(401, 'unauthorized');
  try {
    if (!await crypto.subtle.verify('HMAC', await sessionKey(env), fromBase64(token[2]), encoder.encode(token[1]))) throw Error();
    const { account, expiresAt, origin } = JSON.parse(new TextDecoder().decode(fromBase64(token[1])));
    if (account !== env.STEAM_ID || origin !== ORIGIN || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw Error();
  } catch { throw new RequestError(401, 'unauthorized'); }
}

async function steamFetch(path, env, params) {
  const url = new URL(paths[path], STEAM);
  url.search = new URLSearchParams(path === 'percentages' ? params : { ...params, key: env.STEAM_API_KEY });
  let response;
  try {
    response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT) });
  } catch { throw new RequestError(502, 'upstream_unavailable'); }
  if (response.status === 429) throw new RequestError(429, 'upstream_limit');
  if (response.status === 403) throw new RequestError(403, 'private');
  if (!response.ok) throw new RequestError(path === 'player' && response.status === 400 ? 404 : 502, 'steam_unavailable');
  try { return await response.json(); }
  catch { throw new RequestError(502, 'upstream_invalid'); }
}

async function cached(requestURL, path, ttl, ctx, load) {
  const cache = caches.default;
  const key = new Request(new URL('/__aftersave_private_v1/' + path, requestURL).href);
  const hit = await cache.match(key).catch(() => null);
  if (hit) return hit.json();
  const data = await load();
  const response = new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=' + ttl }
  });
  ctx.waitUntil(cache.put(key, response).catch(() => {}));
  return data;
}

async function readLibrary(env) {
  const data = await steamFetch('library', env, { steamid: env.STEAM_ID, include_appinfo: '1', include_played_free_games: '1' });
  if (!Number.isInteger(data.response?.game_count)) throw new RequestError(403, 'private');
  return data.response;
}

function library(url, env, ctx) {
  return cached(url, env.STEAM_ID + '/library', 300, ctx, async () => {
    return { account: env.STEAM_ID, response: await readLibrary(env) };
  });
}

function safeIcon(value) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && /(^|\.)(steamstatic\.com|steamusercontent\.com|steampowered\.com|akamaihd\.net)$/.test(url.hostname)) return url.href;
  } catch { /* Optional icon. */ }
  return '';
}

function communityIcon(appid, filename) {
  if (typeof filename !== 'string' || !/^[a-f0-9]{40}\.(?:jpg|png|webp)$/i.test(filename)) return '';
  return 'https://shared.fastly.steamstatic.com/community_assets/images/apps/' + appid + '/' + filename;
}

async function communitySchema(appid) {
  const response = await fetch(`https://steamcommunity.com/achievements/${appid}?l=russian`, {
    headers: { Cookie: 'Steam_Language=russian' }, redirect: 'error', signal: AbortSignal.timeout(TIMEOUT)
  });
  if (!response.ok) throw new Error('Steam Community unavailable');
  const html = await response.text();
  const match = html.match(/<script[^>]+id="valve-ssr-data"[^>]*>([\s\S]*?)<\/script>/i);
  const ssr = JSON.parse(match?.[1] ?? '{}');
  const queries = JSON.parse(ssr.renderContext?.queryData ?? '{}').queries;
  const schema = queries?.find(({ queryKey }) => queryKey?.[0] === 'achievements' &&
    Number(queryKey[1]) === appid && queryKey[2] === 'schema_v2')?.state?.data;
  if (!Array.isArray(schema?.groups)) throw new Error('Steam Community schema unavailable');
  return schema.groups.flatMap(group => Array.isArray(group.achievements) ? group.achievements : [])
    .filter(item => typeof item.api_name === 'string' && !item.archived)
    .map(item => ({ name: item.api_name, displayName: item.name, description: item.description,
      hidden: Boolean(item.hidden), icon: communityIcon(appid, item.icon_achieved), icongray: communityIcon(appid, item.icon_unachieved) }));
}

async function artwork(appid) {
  const query = { ids: [{ appid }], context: { language: 'russian', country_code: 'US' },
    data_request: { include_assets: true } };
  const url = new URL('IStoreBrowseService/GetItems/v1/', STEAM);
  url.searchParams.set('input_json', JSON.stringify(query));
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT) });
  if (!response.ok) throw new RequestError(502, 'artwork_unavailable');
  const assets = (await response.json()).response?.store_items?.find(item => item.appid === appid)?.assets;
  const format = assets?.asset_url_format;
  const path = filename => typeof filename === 'string' && /^[\w.-]+(?:\/[\w.-]+)?$/.test(filename) &&
    typeof format === 'string' && /^steam\/apps\/\d+\/\$\{FILENAME\}(?:\?t=\d+)?$/.test(format) &&
    format.startsWith('steam/apps/' + appid + '/') ?
    'https://shared.fastly.steamstatic.com/store_item_assets/' + format.replace('${FILENAME}', filename) : '';
  return { cover: path(assets?.library_capsule ?? assets?.main_capsule), hero: path(assets?.library_hero), header: path(assets?.header) };
}

async function achievements(url, id, env, ctx) {
  const owned = await library(url, env, ctx);
  if (!owned.response.games?.some(item => item.appid === id)) throw new RequestError(404, 'not_owned');
  return cached(url, env.STEAM_ID + '/achievements-v3/' + id, 1200, ctx, async () => {
    const { playerstats } = await steamFetch('player', env, { steamid: env.STEAM_ID, appid: id, l: 'russian' });
    if (!playerstats?.success || playerstats.steamID !== env.STEAM_ID) throw new RequestError(404, 'unavailable');
    const list = Array.isArray(playerstats.achievements) ? playerstats.achievements : [];
    let metadata = new Map();
    let rarity = new Map();
    if (list.length) {
      const [schema, percentages, community] = await Promise.all([
        cached(url, 'schema/' + id, 86400, ctx, () =>
          steamFetch('schema', env, { appid: id, l: 'russian' })).catch(() => null),
        cached(url, 'percentages/' + id, 86400, ctx, () =>
          steamFetch('percentages', env, { gameid: id })).catch(() => null),
        cached(url, 'community-schema-ru/' + id, 86400, ctx, () => communitySchema(id)).catch(() => [])
      ]);
      metadata = new Map((schema?.game?.availableGameStats?.achievements ?? []).map(item => [item.name, item]));
      for (const item of community) {
        const official = metadata.get(item.name);
        metadata.set(item.name, {
          displayName: official?.displayName || item.displayName, description: official?.description || item.description,
          hidden: item.hidden || Boolean(Number(official?.hidden)), icon: safeIcon(official?.icon) || item.icon,
          icongray: safeIcon(official?.icongray) || item.icongray
        });
      }
      rarity = new Map((percentages?.achievementpercentages?.achievements ?? [])
        .map(item => [item.name, typeof item.percent === 'string' && item.percent.trim() ? Number(item.percent) : item.percent])
        .filter(([name, percent]) => typeof name === 'string' && Number.isFinite(percent) && percent >= 0 && percent <= 100));
    }
    return { account: env.STEAM_ID, playerstats: {
      success: true, achievements: list.map(item => {
        const meta = metadata.get(item.apiname);
        return {
          apiname: item.apiname, achieved: item.achieved, unlocktime: item.unlocktime,
          name: item.name || meta?.displayName, description: item.description || meta?.description,
          hidden: meta?.hidden === true || Number(meta?.hidden) === 1,
          percent: rarity.get(item.apiname),
          icon: safeIcon(item.achieved ? meta?.icon : meta?.icongray || meta?.icon)
        };
      })
    } };
  });
}

export default {
  async scheduled(event, env) {
    if (!env.STEAM_ACTIVITY || !env.STEAM_API_KEY || !validAccount(env.STEAM_ID)) return;
    await recordSnapshot(env.STEAM_ACTIVITY, env.STEAM_ID, event.scheduledTime, await readLibrary(env));
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = allowedOrigin(request);
    if (url.pathname === '/health' && request.method === 'GET') return reply({ ok: true, version: 5 }, 200, cors);
    const route = url.pathname;
    if (!['/session', '/library', '/achievements', '/artwork'].includes(route)) return reply({ error: 'not_found' }, 404, cors);
    if (!cors) return reply({ error: 'origin' }, 403, false);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: {
        ...headers(true), 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600'
      } });
    }
    if (request.method !== (route === '/session' ? 'POST' : 'GET')) return reply({ error: 'method' }, 405, true);
    try {
      if (route === '/artwork') {
        const raw = url.searchParams.get('appid');
        if ([...url.searchParams].length !== 1 || !/^[1-9]\d{0,9}$/.test(raw ?? '') || Number(raw) > 4294967295) {
          throw new RequestError(400, 'invalid_appid');
        }
        if (!env.API_LIMIT || !(await env.API_LIMIT.limit({ key: 'art:' + (request.headers.get('CF-Connecting-IP') || 'unknown') })).success) {
          throw new RequestError(429, 'rate_limit');
        }
        return reply(await cached(url, 'artwork/' + raw, 86400, ctx, () => artwork(Number(raw))), 200, true);
      }
      if (!env.STEAM_API_KEY || !validAccount(env.STEAM_ID) || env.AFTERSAVE_PASSWORD?.length < 24 ||
          !env.AFTERSAVE_PASSWORD || !env.LOGIN_LIMIT || !env.API_LIMIT) throw new RequestError(503, 'configuration');
      if (route === '/session') {
        if (url.search) throw new RequestError(400, 'invalid_request');
        const { success } = await env.LOGIN_LIMIT.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' });
        if (!success) throw new RequestError(429, 'rate_limit');
        return reply(await startSession(request, env), 200, true);
      }
      await authorize(request, env);
      const { success } = await env.API_LIMIT.limit({ key: env.STEAM_ID });
      if (!success) throw new RequestError(429, 'rate_limit');
      if (route === '/library') {
        if (url.search) throw new RequestError(400, 'invalid_request');
        const data = await library(url, env, ctx);
        if (!env.STEAM_ACTIVITY) return reply(data, 200, true);
        const activity = await readActivity(env.STEAM_ACTIVITY, env.STEAM_ID).catch(() => ({ unavailable: true }));
        return reply({ ...data, activity }, 200, true);
      }
      const query = [...url.searchParams];
      const raw = url.searchParams.get('appid');
      if (query.length !== 1 || !/^[1-9]\d{0,9}$/.test(raw ?? '') || Number(raw) > 4294967295) {
        throw new RequestError(400, 'invalid_appid');
      }
      return reply(await achievements(url, Number(raw), env, ctx), 200, true);
    } catch (error) {
      const status = error instanceof RequestError ? error.status : 500;
      return reply({ error: error instanceof RequestError ? error.code : 'internal' }, status, true);
    }
  }
};

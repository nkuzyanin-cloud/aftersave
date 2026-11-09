const DAY = 86400;
const BATCH = 30;
const MAX_ARTICLE_AGE = 30 * DAY;
const NEWS_FEED = 'steam_community_announcements';
const checkedDay = time => Math.floor(time / DAY) * DAY;
const appid = value => Number.isInteger(value) && value > 0 && value <= 4294967295;
const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';

async function steamJSON(method, params) {
  const url = new URL(method, 'https://api.steampowered.com/');
  url.search = new URLSearchParams(params);
  const response = await fetch(url, { redirect:'error', signal:AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Steam HTTP ${response.status}`);
  return response.json();
}

async function prepare(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS steam_feeds (
    account TEXT NOT NULL, kind TEXT NOT NULL, appid INTEGER NOT NULL,
    checked INTEGER NOT NULL, payload TEXT, PRIMARY KEY (account,kind,appid)
  )`).run();
}

async function readRows(db, account, kind) {
  const {results} = await db.prepare('SELECT appid,checked,payload FROM steam_feeds WHERE account=? AND kind=?')
    .bind(account,kind).all();
  return new Map(results.map(row => [row.appid,row]));
}

const rowData = row => row?.payload ? JSON.parse(row.payload) : null;
function saveRow(db, account, kind, id, checked, data) {
  return db.prepare(`INSERT INTO steam_feeds(account,kind,appid,checked,payload) VALUES(?,?,?,?,?)
    ON CONFLICT(account,kind,appid) DO UPDATE SET checked=excluded.checked,
    payload=COALESCE(excluded.payload,steam_feeds.payload) WHERE excluded.checked>=steam_feeds.checked`)
    .bind(account,kind,id,checked,data === null ? null : JSON.stringify(data));
}

async function wishRoster(account) {
  const {response} = await steamJSON('IWishlistService/GetWishlist/v1/', {steamid:account});
  // Steam can return the same empty response for a private or empty wishlist.
  if (!Array.isArray(response?.items)) return {unavailable:true};
  const sorted = response.items.filter(item => appid(item?.appid)).sort((a,b) =>
    (a.priority ?? 0) - (b.priority ?? 0) || (b.date_added ?? 0) - (a.date_added ?? 0));
  return {ids:[...new Set(sorted.map(item => item.appid))]};
}

async function wishDetails(ids) {
  const query = {ids:ids.map(id => ({appid:id})),context:{language:'russian',country_code:'US'},
    data_request:{include_release:true}};
  const {response} = await steamJSON('IStoreBrowseService/GetItems/v1/', {input_json:JSON.stringify(query)});
  if (!Array.isArray(response?.store_items)) throw new Error('Steam Store data unavailable');
  return new Map(response.store_items.filter(item => ids.includes(item.appid) && clean(item.name,180)).map(item => {
    const release = item.release;
    const date = release?.steam_release_date;
    const label = clean(release?.custom_release_date_message,80);
    // Coming-soon dates may be intentionally imprecise. Keep the public label.
    const datePublic = !release?.is_coming_soon || release.coming_soon_display === 'date_full';
    const releaseDate = /\d/.test(label) ? label :
      datePublic && Number.isInteger(date) && date > 0 && date <= 253402300799 ? new Date(date * 1000).toISOString().slice(0,10) : '';
    return [item.appid,{name:clean(item.name,180),releaseDate}];
  }));
}

function articleImage(body) {
  const clan = /\{STEAM_CLAN_IMAGE\}\/(\d+\/[a-f\d]{20,}\.(?:jpg|png|webp))/i.exec(body);
  return clan ? 'https://clan.fastly.steamstatic.com/images/' + clan[1] : '';
}

async function gameNews(id, now) {
  const {appnews} = await steamJSON('ISteamNews/GetNewsForApp/v2/', {appid:String(id),count:'12',feeds:NEWS_FEED});
  if (!Array.isArray(appnews?.newsitems)) throw new Error('Steam news unavailable');
  return appnews.newsitems.filter(item => item.feedname === NEWS_FEED && /^\d{1,24}$/.test(item.gid) &&
    Number.isInteger(item.date) && item.date >= now - MAX_ARTICLE_AGE && item.date <= now + 300 && clean(item.title,220))
    .map(item => {
      const body = clean(item.contents,30000);
      // Steam may substitute a clan image reference when cross-posting identical text.
      const text = body.replace(/\{STEAM_CLAN_IMAGE\}\/[^\s\[]+|https?:\/\/[^\s\[]+|\[[^\]]+\]/gi,' ')
        .toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().slice(0,1200);
      const title = clean(item.title,220);
      return {gid:item.gid,title,author:clean(item.author,100),date:item.date,text,image:articleImage(body),
        major:/\b(?:major|big|biggest|massive|large|large-scale|content) update\b|(?:крупн|масштабн|больш)\p{L}* обновлени/iu.test(title)};
    });
}

async function refresh(db, account, kind, checked, loadRoster, loadDetails) {
  const rows = await readRows(db,account,kind);
  let roster = rowData(rows.get(0));
  if ((rows.get(0)?.checked ?? 0) < checkedDay(checked)) {
    roster = await loadRoster();
    const active = new Set(roster.ids ?? []);
    const removed = [...rows.keys()].filter(id => id && !active.has(id));
    const prune = roster.unavailable || !removed.length ? [] : [db.prepare(
      'DELETE FROM steam_feeds WHERE account=? AND kind=? AND appid IN (SELECT value FROM json_each(?))'
    ).bind(account,kind,JSON.stringify(removed))];
    await db.batch([saveRow(db,account,kind,0,checked,roster),...prune]);
  }
  const pending = (roster?.ids ?? []).filter(id => (rows.get(id)?.checked ?? 0) < checkedDay(checked)).slice(0,BATCH);
  if (pending.length) await loadDetails(pending);
}

export async function refreshSteamFeeds(db, account, library, now) {
  const checked = Math.floor(now/1000);
  await prepare(db);
  // Keep the account's daily scan spread across the existing five-minute trigger.
  const results = await Promise.allSettled([
    refresh(db,account,'wishlist',checked,() => wishRoster(account),async ids => {
      const details = await wishDetails(ids);
      await db.batch(ids.map(id => saveRow(db,account,'wishlist',id,checked,details.get(id) ?? null)));
    }),
    library && refresh(db,account,'news',checked,() => {
      const games = [...(library?.games ?? [])].filter(game => appid(game.appid))
        .sort((a,b) => (b.rtime_last_played ?? 0) - (a.rtime_last_played ?? 0));
      return {ids:[...new Set(games.map(game => game.appid))],names:Object.fromEntries(games.map(game => [game.appid,clean(game.name,180)]))};
    },async ids => {
      for (let offset = 0; offset < ids.length; offset += 5) {
        const batch = await Promise.all(ids.slice(offset,offset+5).map(async id =>
          saveRow(db,account,'news',id,checked,await gameNews(id,checked).catch(() => null))));
        await db.batch(batch);
      }
    })
  ]);
  if (results.every(result => result.status === 'rejected')) throw results[0].reason;
}

function articleWords(text) {
  const words = text.split(' ');
  return new Set(words.slice(1).map((word,i) => words[i] + ' ' + word));
}

function sameArticle(a,b) {
  if (a.gid === b.gid) return true;
  if (!a.author || a.author !== b.author || Math.abs(a.date-b.date)>600 || Math.min(a.text.length,b.text.length)<80) return false;
  if (a.text === b.text) return true;
  const left = articleWords(a.text), right = articleWords(b.text);
  let shared = 0;
  for (const key of left) if (right.has(key)) shared++;
  return shared / (left.size + right.size - shared) >= 0.9;
}

export function groupNews(items) {
  const byTitle = new Map();
  const groups = [];
  for (const item of items.sort((a,b) => b.date-a.date)) {
    const title = item.title.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
    const candidates = byTitle.get(title) ?? [];
    const group = candidates.find(candidate => sameArticle(candidate,item));
    if (group) {
      if (!group.games.some(game => game.appid === item.game.appid)) group.games.push(item.game);
      group.major ||= item.major;
      group.image ||= item.image;
    } else {
      const {game,...article} = item;
      const entry = {...article,games:[game]};
      candidates.push(entry);
      byTitle.set(title,candidates);
      groups.push(entry);
    }
  }
  return groups.slice(0,100).map(({text,author,...item}) => item);
}

export async function readSteamFeed(db, account, kind, now = Date.now()) {
  await prepare(db);
  const rows = await readRows(db,account,kind);
  const roster = rowData(rows.get(0));
  if (!roster || roster.unavailable) return {status:roster ? 'unavailable' : 'pending',items:[]};
  const started = rows.get(0).checked;
  let checked = started;
  let complete = true;
  for (const id of roster.ids) {
    const time = rows.get(id)?.checked ?? 0;
    complete &&= time >= checkedDay(started);
    checked = Math.max(checked,time);
  }
  const items = kind === 'wishlist' ? roster.ids.map(id => ({appid:id,...rowData(rows.get(id))})) :
    groupNews(roster.ids.flatMap(id => (rowData(rows.get(id)) ?? []).filter(item => item.date >= now/1000-MAX_ARTICLE_AGE)
      .map(item => ({...item,game:{appid:id,name:roster.names[id]}}))));
  const missing = roster.ids.some(id => !rows.get(id)?.payload);
  return {status:!complete ? 'updating' : missing ? 'partial' : 'ready',checked,items};
}


import { STORAGE_KEY, createGame, exportJSON } from './data.js';
import { connected, readCloud, writeCloud } from './steam.js';

const defaults = {
  status:'planned',shelf:false,favorite:false,hidden:false,wishlist:false,
  rating:null,grade:'',gradeCleared:false,hours:0,playthroughCount:0,progress:0,startedAt:'',finishedAt:'',
  notes:'',tags:[],collectionIds:[],runs:[],sessions:[],journal:[],bossProgress:{},genre:'',year:null,
  description:'',catalogId:''
};
const fields = Object.keys(defaults);
const blank = { games:{}, collections:{} };
const dictionary = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (object,key) => object && Object.hasOwn(object,key) ? object[key] : undefined;
const indexed = value => Array.isArray(value) && value.every(item=>dictionary(item) && typeof item.id === 'string');
const keyOf = game => game.steam ? 'steam-' + game.steam.appid : 'local-' + game.id;

export function equal(a,b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item,i)=>equal(item,b[i]));
  if (dictionary(a) && dictionary(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(key=>Object.hasOwn(b,key)&&equal(a[key],b[key]));
  }
  return false;
}

export function personalSnapshot(state) {
  const records = [];
  for (const game of state.games) {
    const data = Object.fromEntries(fields.filter(field=>!equal(game[field],defaults[field])).map(field=>[field,game[field]]));
    if (game.steam && !Object.keys(data).length) continue;
    const record = { title:game.title,platform:game.platform,...data };
    if (!game.steam) Object.assign(record,{id:game.id,cover:game.cover,accent:game.accent,createdAt:game.createdAt});
    records.push([keyOf(game),record]);
  }
  return { games:Object.fromEntries(records),collections:Object.fromEntries(state.collections.map(item=>[item.id,item])) };
}

export function mergePersonal(base,local,remote,prefer) {
  let conflict = false;
  function merge(a,b,c) {
    if (equal(b,c) || equal(c,a)) return b;
    if (equal(b,a)) return c;
    if ((a === undefined || dictionary(a)) && dictionary(b) && dictionary(c)) {
      const keys = new Set([...Object.keys(a ?? {}),...Object.keys(b),...Object.keys(c)]);
      return Object.fromEntries([...keys].flatMap(key => {
        const value = merge(own(a,key),own(b,key),own(c,key));
        return value === undefined ? [] : [[key,value]];
      }));
    }
    if ((a === undefined || indexed(a)) && indexed(b) && indexed(c)) {
      const map = entries => Object.fromEntries((entries ?? []).map(item=>[item.id,item]));
      return Object.values(merge(map(a),map(b),map(c)));
    }
    conflict = true;
    return prefer === 'remote' ? c : b;
  }
  return { snapshot:merge(base ?? blank,local,remote ?? blank),conflict };
}

export function applyPersonal(state,snapshot) {
  const selected = new Map(Object.entries(snapshot.games));
  const collectionList = Object.values(snapshot.collections);
  const collectionIds = new Set(collectionList.map(item=>item.id));
  const apply = (game,record) => {
    const data = { ...defaults,...Object.fromEntries(fields.filter(field=>Object.hasOwn(record,field)).map(field=>[field,record[field]])) };
    data.collectionIds = data.collectionIds.filter(id=>collectionIds.has(id));
    return { ...game,...data,title:record.title || game.title,platform:record.platform || game.platform };
  };
  const previouslyPersonal = personalSnapshot(state).games;
  const games = state.games.flatMap(game => {
    const key = keyOf(game);
    const record = selected.get(key);
    selected.delete(key);
    if (record) return [apply(game,record)];
    if (!Object.hasOwn(previouslyPersonal,key)) return [game];
    return game.steam ? [apply(game,{})] : [];
  });
  const ids = new Set(games.map(game=>game.id));
  for (const [key,record] of selected) {
    const appid = /^steam-([1-9]\d{0,9})$/.exec(key)?.[1];
    if (!appid && !key.startsWith('local-')) throw new Error('Облако вернуло неизвестную запись.');
    const id = ids.has(record.id) ? undefined : record.id;
    const game = createGame({...record,id,steam:appid ? {appid:Number(appid),minutes:0,lastPlayed:0} : null,
      collectionIds:(record.collectionIds ?? []).filter(item=>collectionIds.has(item))});
    ids.add(game.id);
    games.push(game);
  }
  return {...state,games,collections:collectionList};
}

export function createCloudSync({ state, commit, status, blocked }) {
  let timer;
  let working = false;
  let conflict = false;
  const metadataKey = account => STORAGE_KEY + ':cloud:' + account;
  function read(account) {
    try { return JSON.parse(localStorage.getItem(metadataKey(account))) ?? {}; }
    catch { return {}; }
  }
  const write = (account,meta) => localStorage.setItem(metadataKey(account),JSON.stringify(meta));
  const enabled = () => Boolean(state().steam?.account && read(state().steam.account).enabled);

  function schedule(delay = 1000) {
    if (!enabled() || conflict) return;
    clearTimeout(timer);
    timer = setTimeout(()=>sync(),delay);
  }

  async function sync(prefer) {
    const account = state().steam?.account;
    if (!account || !enabled() || !connected() || !navigator.onLine || working || blocked() || (conflict && !prefer)) return;
    working = true;
    let retry = false;
    try {
      const meta = read(account);
      const remote = await readCloud();
      if (state().steam?.account !== account || !enabled() || blocked()) return;
      if (!Number.isSafeInteger(remote.revision) || (remote.revision && !dictionary(remote.snapshot))) throw new Error('Некорректный ответ облака.');
      const local = personalSnapshot(state());
      const result = mergePersonal(meta.base,local,remote.snapshot,prefer);
      if (result.conflict && !prefer) {
        conflict = true;
        status('Одни и те же записи изменились на двух устройствах.',true);
        return;
      }
      if (!equal(local,result.snapshot)) exportJSON(applyPersonal(state(),result.snapshot));
      const revision = equal(result.snapshot,remote.snapshot ?? blank) ? remote.revision :
        (await writeCloud(remote.revision,result.snapshot)).revision;
      if (revision === undefined) { retry = true; return; }
      if (state().steam?.account !== account || !enabled() || blocked()) return;
      const latest = personalSnapshot(state());
      const merged = mergePersonal(local,latest,result.snapshot,'local').snapshot;
      if (!equal(latest,merged) && !commit(applyPersonal(state(),merged))) throw new Error('Облачные данные не удалось сохранить на устройстве.');
      write(account,{enabled:true,base:result.snapshot});
      conflict = false;
      status('Облако синхронизировано',false);
      retry = !equal(personalSnapshot(state()),result.snapshot);
    } catch (error) {
      status(error.message,false);
    } finally {
      working = false;
      if (retry) schedule(500);
    }
  }

  function toggle() {
    const account = state().steam?.account;
    if (!account) return;
    const meta = read(account);
    write(account,{...meta,enabled:!meta.enabled});
    conflict = false;
    status(meta.enabled ? 'Облако выключено на этом устройстве.' : 'Подключаем облако…',false);
    if (!meta.enabled) sync();
  }
  return { schedule,sync,toggle,enabled };
}

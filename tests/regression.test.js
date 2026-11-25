import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionsWithLocalHistory } from '../activity-view.js';
import { countGameStatuses, gameProgressState } from '../game-model.js';
import { collectionEntries } from '../collection-model.js';
import { sessionDashboardData, sessionChartPoints } from '../session-model.js';
import { createGame, emptyState, importJSON, exportJSON } from '../data.js';

const base = Date.UTC(2020,0,1,12), at = n => base+n*60000;
const game = {steam:{appid:1},hours:0,status:'playing'};
const games = new Map([[1,game]]);
const observed = {appid:1,minutes:60,observedFrom:at(0),observedTo:at(60)};
const local = (start,end) => ({appid:1,startedAt:at(start),endedAt:at(end)});
const total = (windows, sessions) => sessionsWithLocalHistory(windows,sessions,games).reduce((sum,row)=>sum+row.minutes,0);

test('partial local overlap retains the Steam counter delta',()=>assert.equal(total([observed],[local(10,20)]),60));
test('overlapping local intervals are counted only once',()=>assert.equal(total([],[local(0,30),local(10,40)]),40));
test('fully covered observed activity is not double counted',()=>assert.equal(total([{...observed,minutes:10}],[local(10,20)]),10));
test('disjoint activity is added',()=>assert.equal(total([observed],[local(70,80)]),70));
test('achievement-only activity has consistent collection status',()=>assert.equal(countGameStatuses([game],()=>({total:10,unlocked:1})).active,1));
test('perfect completion takes priority',()=>assert.equal(gameProgressState(game,{total:10,unlocked:10}),'perfect'));
test('legacy boss progress is ignored while personal records survive',()=>{
  const state = emptyState();
  const record = createGame({title:'Elden Ring',status:'completed',collectionIds:[]});
  state.games = [{...record,bossProgress:{test:{won:true,deaths:{}}}}];
  const imported = importJSON(JSON.stringify(state));
  assert.equal(imported.games[0].title,'Elden Ring');
  assert.equal(imported.games[0].status,'completed');
  assert.equal('bossProgress' in imported.games[0],false);
  assert.equal(JSON.parse(exportJSON(imported)).games.length,1);
});

test('a game in two collections contributes once to each collection',()=>{
  const entry = {...game, collectionIds:['one','two'], steam:{appid:1,minutes:60}};
  const collections = [{id:'one',name:'A'},{id:'two',name:'B'}];
  const result = collectionEntries([entry],collections,'games',()=>({total:4,unlocked:2}));
  assert.deepEqual(result.map(row=>[row.games,row.minutes,row.unlocked]),[[1,60,2],[1,60,2]]);
});
test('session periods and chart grouping agree on minutes',()=>{
  const context={events:[{game,minutes:20,day:10},{game,minutes:30,day:11}],unlocks:new Map()};
  const data=sessionDashboardData(context,'7',11);
  assert.equal(data.metrics.minutes,50);
  assert.equal(sessionChartPoints(data,'days').reduce((n,p)=>n+p.minutes,0),50);
});

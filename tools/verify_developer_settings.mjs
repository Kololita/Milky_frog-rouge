import assert from 'node:assert/strict';
import {createDeveloperSettings} from '../src/developer-settings.js';
import {tuningFields,applyTuning} from '../src/tuning-registry.js';
import {PLAYER_STATS,ATTACK_STATS} from '../src/battle-values.js';
import {MOVEMENT} from '../src/control-tuning.js';
import {advanceMovement} from '../src/movement.js';
import {Battle} from '../src/battle.js';
class Node{
  constructor(){this.children=[];this.listeners={};this.hidden=false;this.value='';}
  append(...nodes){this.children.push(...nodes);}
  addEventListener(name,fn){this.listeners[name]=fn;}
}
const ids=['developer-controls','developer-enabled','developer-search','developer-message','developer-panel','developer-apply','developer-reset'];
const nodes=Object.fromEntries(ids.map(id=>[id,new Node()]));
const doc={getElementById:id=>nodes[id],createElement:()=>new Node()};
let stored=null,applies=0;
const win={localStorage:{getItem:()=>stored,setItem:(k,v)=>stored=v}};
createDeveloperSettings(doc,win,{onApply(){applies++;}});
assert(tuningFields().length>300);
const allRows=nodes['developer-controls'].children.flatMap(detail=>detail.children.slice(1));
const row=allRows.find(r=>r.children[0].title==='PLAYER_STATS.attackPower');
row.children[1].value='15';row.children[1].listeners.input();
assert.equal(PLAYER_STATS.attackPower,10,'Draft must not alter running combat');
nodes['developer-apply'].listeners.click();assert.equal(PLAYER_STATS.attackPower,15);
assert.equal(new Battle().player.attackPower,15);assert.equal(JSON.parse(stored)['PLAYER_STATS.attackPower'],15);
assert.equal(applies,2);
nodes['developer-search'].value='攻击力';nodes['developer-search'].listeners.input();assert(!row.hidden);assert(allRows.some(r=>r.hidden));
nodes['developer-enabled'].checked=true;nodes['developer-enabled'].listeners.change();assert.equal(nodes['developer-panel'].hidden,false);
createDeveloperSettings(doc,win);assert.equal(PLAYER_STATS.attackPower,15,'Saved settings survive menu recreation');
assert.throws(()=>applyTuning({'BACK_THROW.slamApex':2}));assert.equal(PLAYER_STATS.attackPower,15,'Invalid patch must be atomic');
assert.throws(()=>applyTuning({'ATTACK_STATS.Attack1.times.0':.8}));
applyTuning({'MOVEMENT.turnRate':1});
const turn=advanceMovement({heading:0,velocity:0,pivot:null,turnTarget:null},{direction:{x:1,z:0},move:1,sprint:false},.01);
assert(turn.heading<=.010001,'Turning must read live tuning, not an initial snapshot');
applyTuning({'ATTACK_STATS.Attack1.motionMultiplier':3});assert.equal(ATTACK_STATS.Attack1.motionMultiplier,3);
nodes['developer-reset'].listeners.click();assert.equal(PLAYER_STATS.attackPower,10);assert.equal(MOVEMENT.turnRate,Math.PI*6);
assert.equal(stored,'{}');
console.log('DEVELOPER_SETTINGS_VERIFIED: searchable sliders, draft/apply, persistence, reset, atomic validation, real runtime values');

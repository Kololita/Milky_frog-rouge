import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Battle} from '../src/battle.js';
import {MONSTER_STATS} from '../src/monster-catalog.js';
import {createEnemyView} from '../src/enemy-view.js';
import {moveActorMotion} from '../src/actor-collision.js';
import {RunProgress} from '../src/run-map.js';
import {ENCOUNTER_POOLS} from '../src/encounter-formations.js';
import {createBattleHUD} from '../src/battle-hud.js';
import {gameFixture} from './game_fixture.mjs';
const pose={x:0,z:0,heading:0,height:0,invulnerable:true};
assert(Object.values(MONSTER_STATS).every(s=>s.moves.length>=2));
assert.equal(MONSTER_STATS.shellbug.attackPower,7);assert.equal(MONSTER_STATS.shellbug.bodyHeight,.9);
for(const fps of [30,60,144]){
 // The bug chooses its radial attack nearby, charges from further out and cannot tunnel.
 for(const [distance,label] of [[1,'环身尖刺'],[2.7,'顶角冲锋']]){
  const b=new Battle();b.reset('shellbug');const e=b.enemy;e.z=distance;e.heading=Math.PI;
  let struck=false,seenArmor=false;
  for(let i=0;i<fps*4;i++){
   b.update(1/fps,pose);seenArmor ||= e.superArmor;
   const events=b.takeEvents();if(events.some(v=>v.type==='monsterSwing')){assert.equal(e.move.label,label);struck=true;break;}
   assert(Math.hypot(e.x,e.z)>=e.radius+.4-1e-6);
  }
  assert(struck);assert.equal(seenArmor,e.move.startupResilience>=3);
 }
 const b=new Battle();b.reset('lantern-shellbug');const [lantern,bug]=b.enemies;
 const views=b.enemies.map(()=>createEnemyView(new THREE.Scene())),camera=new THREE.PerspectiveCamera();
 let buffed=false,attacked=false;
 for(let i=0;i<fps*16;i++){
  b.update(1/fps,pose);const events=b.takeEvents();
  buffed ||= events.some(e=>e.type==='monsterEffectApplied');attacked ||= events.some(e=>e.type==='monsterSwing'&&e.label==='顶角冲锋');
  b.enemies.forEach((enemy,j)=>{views[j].update(b.viewOf(enemy),camera,1/fps);assert(views[j].monsterVisuals.entries[enemy.stats.visual].root.visible);assert(Number.isFinite(enemy.x+enemy.z+enemy.heading));});
 }
 assert(buffed&&attacked);assert.equal(lantern.effects.value('damageIncrease'),.2);assert.equal(bug.effects.value('damageIncrease'),.2);
 // Support spell has no damage; actual enemy damage receives the 20% bonus.
 b.player.health=100;b.player.invulnerableUntil=0;bug.x=0;bug.z=1;bug.heading=Math.PI;
 b.withEnemy(bug,()=>b.strikePlayer({...pose,invulnerable:false},bug.stats.moves[0]));
 assert.equal(b.player.health,79.84);assert.equal(b.player.pose,74);
 b.applyEffect({type:"damageIncrease",amount:.2,duration:30,group:"support-damage"});b.applyEffect({type:"damageIncrease",amount:.2,duration:30,group:"support-damage"});assert.equal(bug.effects.value('damageIncrease'),.2,'Buff stacks');
 b.focusEnemy(bug);b.withEnemy(lantern,()=>{});assert.equal(b.enemy,bug);assert.equal(b.enemyStats,bug.stats);
 b.clearBattleEffects();assert(b.enemies.every(e=>e.effects.entries.size===0));
}
// One authored hit damages every overlapping enemy exactly once.
{
 const b=new Battle();b.reset('lantern-shellbug');b.enemies.forEach((e,i)=>{e.x=i? .25:-.25;e.z=.8;});
 b.beginAttack('RunAttack');b.resolveAttack(.205,pose);assert.deepEqual(b.enemies.map(e=>e.health),[168,268]);
 b.resolveAttack(.4,pose);assert.deepEqual(b.enemies.map(e=>e.health),[168,268]);assert.equal(b.takeEvents().filter(e=>e.type==='enemyHit').length,2);
 b.enemy.health=0;assert(!b.allDefeated);b.enemies[1].health=0;assert(b.allDefeated);
}
// Piercing wave honors its one-second cooldown independently for each target.
{
 const b=new Battle();b.reset('lantern-shellbug');b.enemies.forEach((e,i)=>{e.x=0;e.z=1+i;});
 b.launchWave(pose);for(let i=0;i<40;i++){b.time+=.02;b.updateWaves(.02);}
 assert.deepEqual(b.enemies.map(e=>e.health),[150,250]);
}
// Rolling against a group retains tangential motion while checking every collider.
{
 const enemies=[{x:0,z:1,radius:.5,health:100},{x:1.6,z:2,radius:.4,health:100}];
 const end=moveActorMotion({x:-.5,z:0},{x:-.5,z:3},enemies);
 assert(end.z>1.5);for(const e of enemies)assert(Math.hypot(end.x-e.x,end.z-e.z)>=.4+e.radius-1e-6);
}
// Interrupting the chant gives no buff; granted buffs expire using enemy time.
{
 const b=new Battle();b.reset('lantern');b.update(.01,pose);assert.equal(b.enemy.move.kind,'buff');
 b.impactEnemy(1,pose);for(let i=0;i<15;i++)b.update(.02,pose);assert.equal(b.enemy.effects.value('damageIncrease'),0);
 b.applyEffect({type:"damageIncrease",amount:.2,duration:.1});b.enemy.z=50;for(let i=0;i<10;i++)b.update(.02,pose);assert.equal(b.enemy.effects.value('damageIncrease'),0);
}
// Independent on-screen damage numbers and cleanup between fights.
{
 class Node{constructor(){this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){}};this.children=[];}setAttribute(){}append(n){this.children.push(n);n.parentElement=this;}replaceChildren(){this.children=[];}remove(){this.removed=true;}}
 const nodes=new Map(),root=new Node(),doc={getElementById:id=>{if(!nodes.has(id)){const n=new Node();nodes.set(id,n);root.append(n);}return nodes.get(id);},createElement:()=>new Node()};
 const hud=createBattleHUD(doc),b=new Battle();b.reset('lantern-shellbug');
 hud.update(b,b.enemies.map((enemy,i)=>({type:'enemyHit',enemy,damage:10+i*10})));
 const extra=root.children.filter(n=>n.className==='combo-damage');assert.equal(extra.length,2);assert.deepEqual(extra.map(n=>n.textContent),['10','20']);
 hud.clearEffects();assert(extra[1].removed);
}
for(let seed=0;seed<30;seed++){const r=new RunProgress(seed);r.ordinaryBattles=2;assert(ENCOUNTER_POOLS.strong.includes(r.select('0-0').encounter));}
// Exercise the real main loop and map dialog: one kill must not finish the group.
{
 const g=await gameFixture(60,{home:true,equipment:true,run:true});
 g.hud.get('home-new-game').listeners.get('click')();
 g.read('runGame.run.map.rows[0][0].encounter="lantern-shellbug";runGame.run.select("0-0");runGame.run.begin();enterArena("lantern-shellbug",{run:true})');
 g.tick(.25);assert.equal(g.read('enemyViews.length'),2);assert(g.read('enemyViews.every(v=>v.group.visible)'));
 g.tap('KeyQ');assert(g.read('targetLock.target===battle.nearestEnemy(player.position)'));
 g.read('battle.enemies[0].health=0;battle.enemies[0].state="dead"');g.tickFrames(1);assert.equal(g.read('runGame.run.status'),'battle');
 g.read('battle.enemies[1].health=0;battle.enemies[1].state="dead"');g.tickFrames(1);assert.equal(g.read('runGame.run.status'),'reward');
 assert(!g.read('inPractice'));assert.equal(g.hud.get('loot-choices').children.length,2);assert(g.read('enemyViews.every(v=>!v.group.visible)'));
}
console.log('MONSTER_GROUPS_VERIFIED: 2+ moves each; dual AI/rendering, support buff, damage, interruption, expiry, multi-hit, wave, collision, independent HUD and full-clear victory');

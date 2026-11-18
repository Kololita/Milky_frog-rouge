import assert from 'node:assert/strict';
import {RunProgress,generateRunMap,NODE_LABELS,MAP_LAYOUT} from '../src/run-map.js';
import {ENCOUNTER_POOLS,chooseFormation} from '../src/encounter-formations.js';
import {gameFixture} from './game_fixture.mjs';
const rest=[4,9,13];
for(let seed=0;seed<150;seed++){
 const map=generateRunMap(seed);assert.equal(map.rows.length,15);assert.equal(map.rows.at(-1)[0].type,'boss');
 assert.deepEqual(map.rows.filter(row=>row[0].type==='rest').map(row=>row[0].layer),rest);
 for(const node of map.nodes){assert.equal(node.name,NODE_LABELS[node.type]);assert(node.y>0&&node.y<map.height);for(const id of node.next){const next=map.nodes.find(n=>n.id===id);assert(next);assert.equal(next.layer,node.layer+1);}}
 for(let r=1;r<15;r++)for(const n of map.rows[r])assert(map.rows[r-1].some(p=>p.next.includes(n.id)),'Unreachable node');
 const run=new RunProgress(seed);assert(!run.select('14-0'));let ordinary=0;
 for(let layer=0;layer<15;layer++){
  const available=run.available();assert(available.length);assert(available.every(n=>n.layer===layer));
  const node=available[seed%available.length];assert(run.select(node.id));
  if(node.type==='rest'){assert(run.beginRest());assert(run.finishRest());continue;}
  if(node.type==='monster'){
   assert(ENCOUNTER_POOLS[ordinary<2?'weak':'strong'].includes(node.encounter));
   const encounter=node.encounter;run.cancel();assert.equal(run.ordinaryBattles,ordinary);assert(run.select(node.id));assert.equal(node.encounter,encounter,'Cancel rerolls formation');ordinary++;
  }
  assert(run.begin());assert.equal(run.ordinaryBattles,ordinary);assert(run.finish(true));if(run.status==='reward')assert(run.claimReward(run.lootChoices[0]));if(layer<14)assert(run.advance());
 }
 assert.equal(run.status,'won');assert.equal(run.path.length,15);assert(ordinary>=5);
}
// Pool selection depends on entered ordinary fights, not the map's floor.
assert(ENCOUNTER_POOLS.weak.includes(chooseFormation({encounterRoll:987,layer:12},1)));
assert(ENCOUNTER_POOLS.strong.includes(chooseFormation({encounterRoll:987,layer:1},2)));
{
 const r=new RunProgress(42);r.map.rows[0][0].type='elite';r.map.rows[0][0].encounter='raiderElite';r.select('0-0');r.begin();assert.equal(r.ordinaryBattles,0);
 r.finish(true);r.claimReward(r.lootChoices[0]);r.advance();const n=r.available()[0];r.select(n.id);assert(ENCOUNTER_POOLS.weak.includes(n.encounter));
}
const g=await gameFixture(60,{home:true,equipment:true,run:true});g.freezeEnemy=true;
g.hud.get('home-new-game').listeners.get('click')();assert.equal(g.read('runGame.run.status'),'map');assert(!g.read('inPractice'));
assert(g.hud.get('run-floor').textContent.endsWith('/ 15'));assert.equal(g.hud.get('run-map-canvas').style.height,`${MAP_LAYOUT.height}px`);
for(const button of g.hud.get('run-map-canvas').children){assert(!/拳兵|虫|灵|蜥|侍|samurai/.test(button.innerHTML));assert(!/拳兵|虫|灵|蜥|侍|samurai/.test(button.attributes['aria-label']));}
let visited=0,expectedPotions=1;
while(g.read('runGame.run.status')==='map'){
 const button=g.hud.get('run-map-canvas').children.find(b=>b.disabled===false);assert(button);button.listeners.get('click')();
 if(g.read('runGame.run.status')==='rest'){
  assert(g.read('restSite.opened'));g.hud.get('rest-options').children[0].listeners.get('click')();expectedPotions=Math.min(6,expectedPotions+3);assert.equal(g.read('battle.player.potions'),expectedPotions);assert.equal(g.read('battle.player.health'),75);g.hud.get('rest-leave').listeners.get('click')();visited++;continue;
 }
 assert(g.read('equipmentMenu.opened'));assert.equal(g.read('runGame.run.status'),'preparing');assert(!g.read('inPractice'));
 if(visited===0){g.read('equipmentMenu.close()');assert.equal(g.read('runGame.run.status'),'map');assert.equal(g.read('runGame.run.ordinaryBattles'),0);g.hud.get('run-map-canvas').children.find(b=>b.disabled===false).listeners.get('click')();}
 g.hud.get('equipment-start').listeners.get('click')();assert(g.read('inPractice'));assert.equal(g.read('runGame.run.status'),'battle');assert.equal(g.read('battle.mode'),g.read('runGame.run.selected.encounter'));
 if(visited===0)g.read('battle.player.health=75;battle.player.energy=22;battle.player.potions=1');
 else{assert.equal(g.read('battle.player.health'),75);assert.equal(g.read('battle.player.energy'),0);assert.equal(g.read('battle.player.potions'),expectedPotions);}
 g.tap('KeyI');assert(!g.read('equipmentMenu.opened'));
 g.read('battle.player.longarmUntil=battle.time+30;battle.player.drainUntil=battle.time+30;battle.player.rageUntil=battle.time+9;battle.player.counterReady=true;battle.player.counterUntil=battle.time+5');
 g.read('for(const enemy of battle.enemies){enemy.health=0;enemy.state="dead"}');g.tickFrames(1);assert(!g.read('inPractice'));
 assert(g.read('battle.player.longarmUntil===0&&battle.player.drainUntil===0&&battle.player.rageUntil===0&&!battle.player.counterReady'));assert(g.hud.get('buff-status').hidden);assert.equal(g.hud.get('buff-status').children.length,0);assert(g.read('battle.waves.length===0&&battle.enemyProjectiles.length===0&&!guardEffect.glow.visible&&!absorptionView.rain.visible'));
 if(g.read('runGame.run.status')==='reward'){assert.equal(g.hud.get('loot-choices').children.length,2);g.hud.get('loot-choices').children[0].listeners.get('click')();g.hud.get('loot-confirm').listeners.get('click')();}
 assert.equal(g.read('runGame.run.status'),visited===14?'won':'victory');assert(g.hud.get('run-result').open);
 g.hud.get('run-result-next').listeners.get('click')();visited++;if(visited===15)break;
}
assert.equal(visited,15);assert(g.hud.get('home-screen').hidden===false);assert.equal(g.read('runGame.run'),null);
g.hud.get('home-new-game').listeners.get('click')();g.hud.get('run-map-canvas').children.find(b=>!b.disabled).listeners.get('click')();g.hud.get('equipment-start').listeners.get('click')();
g.read('battle.player.health=0');g.tickFrames(1);assert.equal(g.read('runGame.run.status'),'lost');g.hud.get('run-result-next').listeners.get('click')();assert.equal(g.read('runGame.run'),null);
console.log('RUN_MAP_VERIFIED: 150 seeded 15-floor graphs, no identity leak, actual ordinary-count pools, no cancel reroll, rest/elite isolation, full GLB run and cleanup');

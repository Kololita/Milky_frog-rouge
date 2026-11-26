import assert from 'node:assert/strict';
import {Battle} from '../src/battle.js';
import {PLAYER_STATS} from '../src/battle-values.js';
import {createEquipmentMenu} from '../src/equipment.js';
import {EQUIPMENT} from '../src/equipment-catalog.js';
import {resolveEquipment} from '../src/equipment-rolls.js';
import {rollLoot} from '../src/loot.js';
import {RunProgress} from '../src/run-map.js';
import {deriveSeed,seededRandom} from '../src/run-random.js';
import {chooseElite,ENCOUNTER_POOLS} from '../src/encounter-formations.js';
import {createRunStartUI,rollRunBoons,RUN_BOON_POOLS,runClasses} from '../src/run-start.js';
import {createRunUI} from '../src/run-ui.js';

const seed='001234567';
const elites=ENCOUNTER_POOLS.elite;
for(const previous of [null,...elites]){
 const eligible=elites.filter(id=>id!==previous),counts=new Map(eligible.map(id=>[id,0]));
 const trials=12000;
 for(let i=0;i<trials;i++){
  const chosen=chooseElite({encounterRoll:deriveSeed(i,'encounter:4-0')},previous);
  assert(counts.has(chosen));
  counts.set(chosen,counts.get(chosen)+1);
 }
 for(const count of counts.values())assert(Math.abs(count-trials/eligible.length)<trials*.02);
}
{
 const run=new RunProgress(seed);
 const first=run.available()[0];first.type='elite';
 assert(run.select(first.id)&&run.begin()&&run.finish(true));
 assert(run.claimReward(run.lootChoices[0])&&run.advance());
 const rest=run.available()[0];rest.type='rest';
 assert(run.select(rest.id)&&run.beginRest()&&run.finishRest());
 const next=run.available()[0];next.type='elite';next.encounterRoll=first.encounterRoll;
 assert(run.select(next.id));
 const chosen=next.encounter;
 assert.notEqual(chosen,first.encounter);
 run.cancel();
 assert.equal(run.select(next.id).encounter,chosen);
 const saved=JSON.parse(JSON.stringify(run.snapshot()));
 saved.map.rows[next.layer].find(room=>room.id===next.id).encounter=first.encounter;
 assert.equal(RunProgress.restore(saved).selected.encounter,chosen);
}
assert.deepEqual(runClasses().map(item=>item.id),['rage','fistwind']);
assert.equal(RUN_BOON_POOLS.length,3);
const boonSeeds=new Map();
for(let n=0;n<80;n++){
 const mapSeed=String(n).padStart(9,'0'),options=rollRunBoons(mapSeed);
 assert.equal(options.length,3);
 assert.deepEqual(rollRunBoons(mapSeed),options);
 for(const [index,boon] of options.entries()){
  assert(RUN_BOON_POOLS[index].includes(boon));
  boonSeeds.set(boon.id,mapSeed);
 }
}
assert.equal(boonSeeds.size,RUN_BOON_POOLS.flat().length);
assert.throws(()=>new RunProgress(seed,{ultimate:'longarm',boon:'funds'}));
assert.throws(()=>new RunProgress(seed,{ultimate:'rage',boon:'invalid'}));

for(const item of runClasses())for(const boon of RUN_BOON_POOLS.flat()){
 const mapSeed=boonSeeds.get(boon.id);
 const run=new RunProgress(mapSeed,{ultimate:item.id,boon:boon.id});
 assert.equal(run.map.seed,mapSeed);
 assert.deepEqual(run.inventory,[item.id]);
 assert.equal(run.gold,boon.gold??0);
 const restored=RunProgress.restore(JSON.parse(JSON.stringify(run.snapshot())));
 assert.equal(restored.startingUltimate,item.id);
 assert.equal(restored.startingBoon.id,boon.id);
 assert.equal(restored.gold,run.gold);
 if(boon.reward){
  assert.equal(restored.status,'startingReward');
  assert.equal(restored.available().length,0);
  assert.deepEqual(restored.lootChoices,run.lootChoices);
  assert.equal(restored.lootChoices.length,2);
  if(boon.reward.slot)assert(restored.lootChoices.every(id=>EQUIPMENT.find(i=>i.id===id).slot===boon.reward.slot));
  assert(restored.claimReward(restored.lootChoices[0]));
  assert.equal(restored.status,'map');
  assert.equal(restored.layer,0);
 }

 const battle=new Battle();
 const menu=createEquipmentMenu({getElementById:()=>null},{},{equip:loadout=>battle.applyEquipment(loadout)});
 menu.startRun(restored.startingAssembly,restored.inventory,{fixedUltimate:restored.startingUltimate});
 assert.equal(menu.assembly.boards[item.id].level,boon.boardLevel??0);
 assert.equal(menu.loadout.ultimate,item.id);
 const other=runClasses().find(option=>option.id!==item.id);
 menu.debugGrant(other.id);
 assert(!menu.selectUltimate(other.id));
 assert(!menu.upgrade(other.id));
 assert.equal(menu.upgradeChoices().length,1);
 assert(menu.upgrade(item.id));

 battle.reset('practice',{runHealthBonus:boon.health??0});
 assert.equal(battle.maxHealth,PLAYER_STATS.health+(boon.health??0));
 assert.equal(battle.player.health,battle.maxHealth);
 battle.player.energy=100;
 assert(battle.beginRage());
 assert(battle.takeEvents().some(event=>event.type===(item.id==='rage'?'rageStarted':'fistwindStarted')));
 battle.reset('raider');
 assert.equal(battle.maxHealth,PLAYER_STATS.health+(boon.health??0));
 battle.reset('practice',{runHealthBonus:0});
 assert.equal(battle.maxHealth,PLAYER_STATS.health);
 menu.sandbox();
 assert(menu.selectUltimate(other.id));
}

{
 const run=new RunProgress(boonSeeds.get('tempered'),{ultimate:'rage',boon:'tempered'});
 for(const type of ['monster','elite','monster','monster']){
  const node=run.available()[0];node.type=type;
  assert(run.select(node.id)&&run.begin()&&run.finish(true));
  const eligible=type==='monster'&&run.ordinaryBattles<=2;
  for(const id of run.lootChoices){
   const gold=EQUIPMENT.find(item=>item.id===id).rarity==='gold';
   assert.equal(run.lootUpgrades[id]?.level,eligible&&!gold?1:undefined);
  }
  const restored=RunProgress.restore(JSON.parse(JSON.stringify(run.snapshot())));
  assert.deepEqual(restored.lootUpgrades,run.lootUpgrades);
  const id=run.lootChoices[0],menu=createEquipmentMenu({getElementById:()=>null},{});
  menu.startRun(run.startingAssembly,run.inventory,{fixedUltimate:'rage'});
  assert(menu.grant(id,run.lootRolls[id],run.lootUpgrades[id]));
  assert.deepEqual(menu.assembly.upgrades[id],run.lootUpgrades[id]);
  assert(run.claimReward(id)&&run.advance());
 }
 const funded=new RunProgress(boonSeeds.get('funds'),{ultimate:'rage',boon:'funds'});
 assert(funded.select(funded.available()[0].id)&&funded.begin()&&funded.finish(true));
 assert(funded.lastGoldReward>=10&&funded.lastGoldReward<=20);
 assert.equal(funded.gold,70+funded.lastGoldReward);
}
for(const kind of ['monster','elite'])for(let n=0;n<100;n++){
 const options=rollLoot(kind,seededRandom(n),['rage']);
 assert.equal(options.length,2);
 for(const id of options)assert.notEqual(EQUIPMENT.find(item=>item.id===id).slot,'ultimate');
}
const legacy=new RunProgress(seed);
legacy.select(legacy.available()[0].id);legacy.begin();legacy.finish(true);
legacy.lootChoices=['fistwind',legacy.lootChoices[0]];
assert.equal(RunProgress.restore(legacy.snapshot()).lootChoices.length,1);
legacy.lootChoices=['fistwind'];
assert.equal(RunProgress.restore(legacy.snapshot()).status,'victory');

function element(){
 return {children:[],attributes:{},listeners:{},open:false,disabled:false,
  append(...children){this.children.push(...children);},
  replaceChildren(){this.children=[];},setAttribute(name,value){this.attributes[name]=value;},
  addEventListener(name,handler){this.listeners[name]=handler;},
  showModal(){this.open=true;},close(){this.open=false;},focus(){},
  click(){if(!this.disabled)this.listeners.click?.();},
 };
}
const ids=['class-screen','boon-screen','class-roster','class-scroll','class-next','class-back','boon-options','boon-back','boon-confirm'];
const elements=Object.fromEntries(ids.map(name=>[`run-${name}`,element()]));
const starts=[];let exits=0;
const ui=createRunStartUI({getElementById:id=>elements[id],createElement:element},{
 start:(...args)=>starts.push(args),back:()=>exits++,
});
const [classes,boonScreen,roster,slider,next,classBack,boonOptions,boonBack,confirm]=Object.values(elements);
Object.assign(roster,{scrollWidth:900,clientWidth:500});
for(const mapSeed of [undefined,seed]){
 ui.open(mapSeed);
 assert(!classes.hidden&&boonScreen.hidden&&next.disabled);
 assert.equal(slider.max,'400');assert(!slider.disabled);
 slider.value='240';slider.listeners.input();assert.equal(roster.scrollLeft,240);
 const portrait=roster.children[1].children[1];
 assert.equal(roster.children[1].children[0].textContent,'御风拳师');
 assert.match(roster.children[1].children[2].textContent,/^专属技能【拳风】：/);
 assert.equal(portrait.children[0].src,'/images/run-start/fistwind.png');
 portrait.click();next.click();
 assert(classes.hidden&&!boonScreen.hidden);
 assert.equal(boonOptions.children.length,3);
 assert(confirm.disabled);
 boonBack.click();assert(!classes.hidden&&boonScreen.hidden);
 assert.equal(portrait.attributes['aria-pressed'],'true');
 next.click();boonOptions.children[2].click();confirm.click();confirm.click();
 assert(classes.hidden&&boonScreen.hidden);
 const [actualSeed,setup]=starts.at(-1);
 assert.match(actualSeed,/^\d{9}$/);
 if(mapSeed)assert.equal(actualSeed,mapSeed);
 assert.deepEqual(setup,{ultimate:'fistwind',boon:rollRunBoons(actualSeed)[2].id});
}
ui.open(seed);classBack.click();assert(classes.hidden);assert.equal(exits,1);assert.equal(starts.length,2);

function roomElement(tag){
 const node=element(),classes=new Set();
 Object.assign(node,{tag,style:{},hidden:false,
  classList:{add:name=>classes.add(name),toggle:(name,on)=>on?classes.add(name):classes.delete(name)},
  append(...children){for(const child of children){child.detach();child.parentElement=this;this.children.push(child);}},
  prepend(child){child.detach();child.parentElement=this;this.children.unshift(child);},
  before(child){child.detach();const parent=this.parentElement;child.parentElement=parent;parent.children.splice(parent.children.indexOf(this),0,child);},
  after(child){child.detach();const parent=this.parentElement;child.parentElement=parent;parent.children.splice(parent.children.indexOf(this)+1,0,child);},
  detach(){if(this.parentElement){const siblings=this.parentElement.children;siblings.splice(siblings.indexOf(this),1);this.parentElement=null;}},
 });
 Object.defineProperty(node,'innerHTML',{set(){node.replaceChildren();}});
 return node;
}
const body=roomElement('body'),roomNodes=new Map();
const roomDoc={body,createElement:roomElement,getElementById(id){
 if(!roomNodes.has(id)){
  const node=roomElement(id);
  roomNodes.set(id,node);body.append(node);
 }
 return roomNodes.get(id);
}};
const room=id=>roomDoc.getElementById(id);
let launch,awarded;
const runUI=createRunUI(roomDoc,{prepare(node,start){launch=start;},
 enterRest(){room('rest-screen').hidden=false;},
 award(item){awarded=item.id;},eventState:()=>({health:100,maxHealth:100,potions:6,capacity:6})});
runUI.jump({type:'shop'});
const shopNode=runUI.run.selected;
const skillOffer=runUI.run.shopStock.find(({id})=>EQUIPMENT.find(item=>item.id===id).slot==='skill');
function findRoomElement(node,predicate){
 if(predicate(node))return node;
 for(const child of node.children){const match=findRoomElement(child,predicate);if(match)return match;}
}
const skillPreview=findRoomElement(body,node=>node.className==='shop-skill-effects');
assert(skillPreview?.open,'Shop skill effects should be visible before purchase');
const effectLines=skillPreview.children[1].children.map(line=>line.children.map(part=>part.textContent).join(''));
assert.equal(effectLines.join('，'),resolveEquipment(skillOffer.id,skillOffer.roll).description);
const nextNode=runUI.run.available()[0];nextNode.type='monster';
room('run-view-map').click();
const preview=body.children.find(node=>node.className==='run-map-preview');
assert(preview.open);
const shopNext=room('run-map-canvas').children[runUI.run.map.nodes.indexOf(nextNode)];
assert(!shopNext.disabled);shopNext.click();
assert(!preview.open);
assert.equal(runUI.run.selected,nextNode);
assert.equal(runUI.run.path.at(-1),shopNode.id);
assert.equal(room('run-map-canvas').children[runUI.run.map.nodes.indexOf(nextNode)].attributes['aria-current'],'location');
assert(launch);

function verifyMapRoundTrips(returnLabel){
 const toolbar=room('run-toolbar'),screen=room('run-screen'),button=room('run-view-map');
 const host=toolbar.parentElement,hidden=screen.hidden,selected=runUI.run.selected;
 for(const close of [
  ()=>button.click(),
  ()=>preview.listeners.cancel({preventDefault(){}}),
  ()=>{preview.close();preview.listeners.close();},
 ]){
  button.click();
  assert(preview.open&&screen.parentElement===preview&&toolbar.parentElement===screen);
  assert.equal(button.textContent,returnLabel);
  close();
  assert(!preview.open&&screen.parentElement===body&&screen.hidden===hidden);
  assert(!toolbar.hidden&&toolbar.parentElement===host&&!button.disabled);
  assert.equal(runUI.run.selected,selected);
 }
}
for(let i=0;i<4;i++){
 for(const type of ['shop','event','rest']){
  runUI.jump({type});
  verifyMapRoundTrips('返回房间');
  room('run-view-map').click();
  runUI.exit();
  assert(!preview.open&&room('run-toolbar').hidden&&room('run-toolbar').parentElement===body);
 }
}

runUI.start(boonSeeds.get('funds'),{ultimate:'rage',boon:'funds'});
room('run-map-canvas').children[0].click();
launch();
runUI.tick({player:{health:100},allDefeated:true,enemies:[{}]});
verifyMapRoundTrips('返回战利品');
room('loot-choices').children[0].click();room('loot-confirm').click();
assert.match(room('run-result-title').textContent,/\+1\d 金币|\+20 金币/);
assert.equal(runUI.run.gold,70+runUI.run.lastGoldReward);

runUI.start(boonSeeds.get('spoils'),{ultimate:'rage',boon:'spoils'});
assert(room('loot-dialog').open);
verifyMapRoundTrips('返回战利品');
const startingId=runUI.run.lootChoices[0];
room('loot-choices').children[0].click();room('loot-confirm').click();
assert.equal(awarded,startingId);
assert.equal(runUI.run.status,'map');
assert(!room('run-screen').hidden);
console.log('RUN_START_VERIFIED: seeded pools, upgraded loot, shop navigation, shop/map location and battle gold display');

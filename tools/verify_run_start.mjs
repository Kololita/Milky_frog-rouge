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
assert.deepEqual(runClasses().map(item=>item.profession),['金龙','木龙','水龙','火龙','土龙','风龙','雨龙','雷龙','电龙']);
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
 assert(battle.beginUltimate());
 const ultimateEvent=item.id==='rage'?'rageStarted':item.id==='fistwind'?'fistwindStarted':'elementalUltimateStarted';
 assert(battle.takeEvents().some(event=>event.type===ultimateEvent&&(ultimateEvent!=='elementalUltimateStarted'||event.id===item.id)));
 battle.reset('raider');
 assert.equal(battle.maxHealth,PLAYER_STATS.health+(boon.health??0));
 battle.reset('practice',{runHealthBonus:0});
 assert.equal(battle.maxHealth,PLAYER_STATS.health);
 menu.sandbox();
 assert(menu.selectUltimate(other.id));
}

{
 const pose={x:0,z:0,height:0,heading:0};
 const makeBattle=ultimate=>{
  const battle=new Battle();
  battle.applyEquipment({ultimate});
  battle.enemy.z=100;
  battle.enemy.act=()=>{};
  battle.player.energy=100;
  return battle;
 };
 const advance=(battle,seconds)=>{
  for(let frame=0;frame<seconds*60;frame++)battle.update(1/60,pose);
 };
 const metal=makeBattle('metal');
 metal.runGold=50;
 const near=metal.enemy,edge=metal.createEnemy(near.encounter,1),far=metal.createEnemy(near.encounter,2);
 for(const [enemy,x,z] of [[near,0,3],[edge,6,0],[far,6.01,0]]){
  Object.assign(enemy,{x,z,health:1000,act(){}});
 }
 metal.enemies.push(edge,far);
 assert(metal.beginUltimate());
 assert(!metal.beginUltimate());
 assert.deepEqual([near.health,edge.health,far.health],[950,950,1000]);
 assert.equal(near.dazeUntil,4.5);
 assert.equal(metal.runGold,50);
 advance(metal,4.4);assert.equal(near.state,'dazed');
 advance(metal,.1);assert.equal(near.state,'idle');
 const wood=makeBattle('wood');
 const target=wood.createEnemy(wood.enemy.encounter,1);
 Object.assign(wood.enemy,{x:0,z:3,health:1000});
 Object.assign(target,{x:2,z:3,health:1000,state:'windup',move:{dealsDamage:true},
  act(){this.x+=1;}});
 wood.enemies.push(target);
 wood.player.health=30;
 assert(wood.beginUltimate(pose,target));
 advance(wood,1);
 assert.equal(target.health,995);assert.equal(wood.enemy.health,1000);
 assert.equal(target.x,2);assert(Math.abs(target.elapsed-.7)<1e-8);
 advance(wood,9);
 assert.equal(target.health,950);assert.equal(wood.player.health,80);
 assert.equal(wood.activeElementalUltimate(),null);
 advance(wood,1/60);assert(Math.abs(target.x-3)<1e-8);
 const water=makeBattle('water');
 water.player.pose=1;
 const fire={fire:true,motionMultiplier:1,poseDamage:3,impactLevel:0,reach:1,halfAngle:Math.PI,heightMin:0,heightMax:1};
 const origin={x:0,z:.5,height:0,heading:Math.PI,attackPower:10};
 const burn={type:'burn',amount:3,duration:4,tickInterval:.5};
 water.applyPlayerStatus(burn);
 assert(water.beginUltimate());
 assert(!water.player.effects.has('burn'));assert.equal(water.player.shield,0);
 advance(water,3);
 assert.equal(water.player.shield,18);assert.equal(water.player.pose,19);
 water.strikePlayer(pose,fire,0,origin);assert.equal(water.player.shield,18);
 water.strikePlayer(pose,{...fire,fire:false},0,origin);assert.equal(water.player.shield,8);
 advance(water,17);assert.equal(water.player.shield,110);
 water.clearBattleEffects();
 assert.equal(water.activeElementalUltimate(),null);
 assert.equal(water.player.shield,0);
 const earth=makeBattle('earth');
 assert(earth.beginUltimate());
 earth.strikePlayer(pose,{...fire,fire:false},0,origin);
 assert.equal(earth.player.health,earth.maxHealth);assert.equal(earth.player.pose,earth.maxPose);
 const ball=earth.earthRoll,position={x:0,z:0};
 Object.assign(earth.enemy,{x:ball.stats.radius+earth.enemy.radius,z:0,health:1000});
 ball.stats.drag=0;ball.vx=3;ball.vz=1;
 earth.moveEarthRoll(position,null,.05);
 assert(Math.abs(ball.vx+6)<1e-7);
 assert(Math.abs(ball.vz-1)<1e-7);
 assert.equal(earth.enemy.health,980);
 assert(position.x<0&&position.z>0);
 earth.moveEarthRoll(position,null,.05);assert.equal(earth.enemy.health,980);
 advance(earth,19.9);
 assert(earth.earthRoll);assert(!earth.earthExit);
 advance(earth,.1);
 assert.equal(earth.earthRoll,null);
 assert(earth.earthExit);
 assert(earth.takeEvents().some(event=>event.type==='earthRollEnded'));
 earth.strikePlayer(pose,{...fire,fire:false},0,origin);
 assert.equal(earth.player.health,earth.maxHealth-10);

 const distanceBattle=makeBattle('earth'),path={x:0,z:0};
 assert(distanceBattle.beginUltimate(pose));
 const distanceRoll=distanceBattle.earthRoll;
 distanceRoll.stats.drag=0;distanceRoll.vx=2;
 const enemy=distanceBattle.enemy,clearance=distanceRoll.stats.radius+enemy.radius;
 Object.assign(enemy,{x:clearance+3,z:0,health:1000});
 const rollFrames=frames=>{
  for(let i=0;i<frames;i++)distanceBattle.moveEarthRoll(path,null,.05);
 };
 rollFrames(31);assert.equal(enemy.health,971,'The first hit includes the three metres since activation');
 enemy.x=1-clearance;
 rollFrames(8);assert.equal(enemy.health,945,'The second hit counts only the distance after the first bounce');
 distanceBattle.sceneryColliders.push({x:2+clearance,z:0,health:1,radius:enemy.radius});
 enemy.x=-clearance;
 rollFrames(10);assert.equal(enemy.health,919,'A scenery bounce resets the travelled distance');

 const slow=makeBattle('earth'),contact={x:0,z:0};
 Object.assign(slow.enemy,{x:clearance,z:0,health:1000});
 assert(slow.beginUltimate(pose));
 const slowRoll=slow.earthRoll;
 slowRoll.vx=.1;
 const towardEnemy={x:1,z:0};
 for(let i=0;i<15;i++)slow.moveEarthRoll(contact,towardEnemy,1/60);
 assert.equal(slow.enemy.health,980,'Holding into the same enemy after a slow bump must not instantly hit again');
 assert(contact.x<-.2,'Even a slow bump separates the ball from the enemy');

 const rain=makeBattle('rain');
 Object.assign(rain.enemy,{x:0,z:4,health:1000,act(_battle,dt){this.x+=dt;}});
 rain.applyPlayerStatus(burn);
 assert(rain.beginUltimate(pose));
 assert(!rain.player.effects.has('burn'));
 rain.enemy.activeAura={hit:{element:'fire'},innerRadius:1,outerRadius:2,cooldown:30};
 advance(rain,1);
 assert(!rain.enemy.activeAura);
 assert(Math.abs(rain.enemy.x-.7)<1e-8);
 assert.equal(rain.enemy.health,985);
 const impact={label:'test',origin:pose,impactLevel:0};
 assert.equal(rain.damageEnemy(rain.enemy,10,{...impact,element:'fire'}),7);
 assert.equal(rain.damageEnemy(rain.enemy,10,{...impact,element:'electric'}),12);
 assert.equal(rain.damageEnemy(rain.enemy,10,impact),10);
 Object.assign(rain.enemy,{x:0,z:1.5});
 const wave=rain.launchWave(pose);
 rain.updateWaves(.25);
 assert.equal(wave.element,'electric');
 assert(rain.takeEvents().some(event=>event.type==='enemyHit'&&event.label==='气功冲击波'&&event.element==='electric'&&event.damage===43.2));
 const health=rain.player.health;
 rain.strikePlayer(pose,{...fire,statusOnHit:burn},0,origin);
 assert.equal(rain.player.health,health-7);
 assert(!rain.player.effects.has('burn'));
 rain.player.invulnerableUntil=0;
 rain.strikePlayer(pose,{...fire,element:'electric'},0,origin);
 assert.equal(rain.player.health,health-19);
 const outside={...pose,x:10},outsideOrigin={...origin,x:10};
 rain.player.invulnerableUntil=0;
 rain.strikePlayer(outside,fire,0,outsideOrigin);
 assert.equal(rain.player.health,health-29);
 rain.enemy.x=10;assert.equal(rain.damageEnemy(rain.enemy,10,{...impact,element:'electric'}),10);

 const thunder=makeBattle('thunder'),marked=thunder.createEnemy(thunder.enemy.encounter,1);
 Object.assign(thunder.enemy,{x:0,z:2,health:1000});
 Object.assign(marked,{x:0,z:4,health:1000,state:'windup',move:{dealsDamage:true},act(){}});
 thunder.enemies.push(marked);
 assert(thunder.beginUltimate(pose,marked));
 advance(thunder,.9);assert.equal(marked.health,1000);
 advance(thunder,.1);assert.equal(marked.health,970);assert.equal(marked.state,'dazed');assert.equal(marked.move,null);
 assert(Math.abs(marked.dazeUntil-thunder.enemyTime-1)<1e-8);
 advance(thunder,2.9);assert.equal(marked.health,970);
 advance(thunder,.1);assert.equal(marked.health,930);
 advance(thunder,2.9);assert.equal(marked.health,930);
 advance(thunder,.1);assert.equal(marked.health,880);assert.equal(thunder.enemy.health,1000);
 assert.equal(thunder.takeEvents().filter(event=>event.type==='elementalLightning').length,3);

 const electric=makeBattle('electric');
 const chain=[electric.enemy,...[1,2,3].map(id=>electric.createEnemy(electric.enemy.encounter,id))];
 chain.forEach((enemy,i)=>Object.assign(enemy,{x:[4.7,8.8,13.8,19][i],z:0,health:1000,act(){}}));
 electric.enemies=chain;
 electric.player.energy=1;
 assert(electric.beginUltimate(pose));
 for(let i=0;i<6;i++)electric.update(1/60,{...pose,lockedTarget:chain[1]});
 assert.equal(electric.player.energy,1,'An out-of-range lock cannot silently retarget');
 advance(electric,.1);
 assert.equal(electric.player.energy,0);
 assert.deepEqual(chain.map(enemy=>enemy.health),[998.5,998.87,999.16,1000]);
 assert.equal(electric.takeEvents().filter(event=>event.type==='enemyHit'&&event.element==='electric').length,3);
 assert.equal(electric.electricChain,null);
 assert(!electric.beginUltimate(pose));
 electric.player.energy=4;
 assert(electric.beginUltimate(pose));
 advance(electric,.1);
 const linked=chain[2],x=linked.x;
 linked.act=(_battle,dt)=>{linked.x+=dt;};
 assert.equal(electric.enemyMovementRate(chain[0]),.4);
 assert.equal(electric.enemyMovementRate(chain[2]),.4);
 assert.equal(electric.enemyMovementRate(chain[3]),1);
 advance(electric,1/60);
 assert(Math.abs(linked.x-x-.4/60)<1e-8);
 assert(electric.beginUltimate(pose));assert.equal(electric.enemyMovementRate(linked),1);
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
  replaceChildren(){this.children=[];},setAttribute(name,value){this.attributes[name]=value;},removeAttribute(name){delete this.attributes[name];},
  addEventListener(name,handler){this.listeners[name]=handler;},
  showModal(){this.open=true;},close(){this.open=false;},focus(){},
  click(){if(!this.disabled)this.listeners.click?.();},
 };
}
const ids=['class-screen','boon-screen','class-roster','class-scroll','class-detail','class-back','boon-options','boon-back','boon-confirm','class-detail-title','class-ultimate-name','class-ultimate-description','class-element','class-detail-portrait','class-stat-list','class-detail-close','class-detail-confirm','class-ultimate-icon'];
const elements=Object.fromEntries(ids.map(name=>[`run-${name}`,element()]));
const starts=[];let exits=0;
const ui=createRunStartUI({getElementById:id=>elements[id],createElement:element},{
 start:(...args)=>starts.push(args),back:()=>exits++,
});
const [classes,boonScreen,roster,slider,detail,classBack,boonOptions,boonBack,confirm,title,,description,elementLabel,detailPortrait,statList,closeDetail,confirmClass,ultimateIcon]=Object.values(elements);
Object.assign(roster,{scrollWidth:900,clientWidth:500});
for(const mapSeed of [undefined,seed]){
 ui.open(mapSeed);
 assert(!classes.hidden&&boonScreen.hidden&&!detail.open);
 for(const card of roster.children){
  const summary=card.children[2].textContent.split('：')[1];
  assert(summary&&[...summary].length<=30&&!/\p{Number}/u.test(summary),card.children[0].textContent);
 }
 assert.equal(slider.max,'400');assert(!slider.disabled);
 slider.value='240';slider.listeners.input();assert.equal(roster.scrollLeft,240);
 roster.children[3].children[1].click();
 assert.equal(ultimateIcon.src,'/images/equipment/rage.png');
 assert.equal(elementLabel.textContent,'人物属性：火');
 closeDetail.click();
 const wind=roster.children[5],portrait=wind.children[1];
 assert.equal(wind.children[0].textContent,'风龙');
 assert.match(wind.children[2].textContent,/^专属技能【拳风】：/);
 assert.equal(portrait.children[0].src,'/images/run-start/fistwind.png');
 portrait.click();
 assert(detail.open&&!classes.hidden&&boonScreen.hidden);
 assert.equal(title.textContent,'风龙');
 assert.equal(ultimateIcon.src,'/images/equipment/illustrated/fistwind.png');
 assert.equal(detailPortrait.src,'/images/run-start/fistwind.png');
 assert.match(description.textContent,/30秒/);
 assert.equal(elementLabel.textContent,'人物属性：普通');
 assert.equal(statList.children.length,8);
 assert.equal(statList.children.at(-1).children[1].children[1].textContent,'20%');
 closeDetail.click();assert(!detail.open&&!classes.hidden&&boonScreen.hidden);
 portrait.click();confirmClass.click();
 assert(classes.hidden&&!boonScreen.hidden);
 assert.equal(boonOptions.children.length,3);
 assert(confirm.disabled);
 boonBack.click();assert(!classes.hidden&&boonScreen.hidden);
 assert(!detail.open);
 portrait.click();confirmClass.click();boonOptions.children[2].click();confirm.click();confirm.click();
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

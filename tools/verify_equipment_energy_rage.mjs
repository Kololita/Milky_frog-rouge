import assert from 'node:assert/strict';
import {Battle} from '../src/battle.js';
import {createEquipmentMenu,EQUIPMENT} from '../src/equipment.js';
import {ENERGY_STATS,GUARD_STATS} from '../src/battle-values.js';
import {DEFAULT_BINDINGS} from '../src/settings.js';
import {gameFixture} from './game_fixture.mjs';
const pose={x:0,z:0,heading:0,height:0,guarding:false};
for(const fps of [30,60,144]){
 const b=new Battle();b.player.counterReady=true;b.player.counterUntil=5;b.beginAbsorption();b.enemy.z=30;
 while(b.time<.63-1e-9)b.update(1/fps,pose);
 const expected=33*Math.min(1,Math.max(0,(b.time-ENERGY_STATS.raiseEnd)/(ENERGY_STATS.rainEnd-ENERGY_STATS.raiseEnd)));
 assert(Math.abs(b.player.energy-expected)<1e-8);assert(b.player.energy>0&&b.player.energy<33);
 b.cancelAbsorption();const partial=b.player.energy;b.update(.05,pose);assert.equal(b.player.energy,partial);assert(!b.player.counterReady);
 const g=await gameFixture(fps);g.freezeEnemy=true;
 g.read('battle.player.rageUntil=battle.time+9;battle.enemy.z=1;battle.enemy.heading=Math.PI');g.tap('KeyJ');
 g.read('battle.strikePlayer(battlePose())');g.tickFrames(1);
 assert(g.read('battle.player.health')<100);assert.equal(g.read('activeGesture?.name'),'Attack1','Rage hit interrupts player animation');
}
const b=new Battle();const normal=b.playerDamage(2);b.player.rageUntil=9;assert.equal(b.playerDamage(2),normal);
b.player.rageUntil=0;b.enemy.z=1;b.enemy.heading=Math.PI;b.strikePlayer({...pose,guarding:true,guardElapsed:0});assert.equal(b.player.counterUntil-b.time,5);assert.equal(GUARD_STATS.counterDuration,5);
b.applyEquipment({armor:'armor-light',gloves:'fist-steel',charm:'charm-recovery'});assert.equal(b.maxHealth,111);assert.equal(b.player.attackPower,13);assert.equal(b.player.poseRegenRate,25);
b.reset();assert.equal(b.maxHealth,111);assert.equal(b.player.health,111);assert.equal(b.player.attackPower,13);
b.applyEquipment({armor:'armor-heavy'});b.enemy.z=1;b.enemy.heading=Math.PI;b.strikePlayer(pose);assert.equal(b.player.health,94.48);
assert.equal(DEFAULT_BINDINGS.KeyI,'KeyI');assert.equal(EQUIPMENT.length,36);
class Element{
 constructor(){this.children=[];this.listeners={};this.dataset={};this.style={};this.hidden=false;}
 append(...elements){this.children.push(...elements);}replaceChildren(...elements){this.children=elements;}
 addEventListener(name,fn){this.listeners[name]=fn;}setAttribute(){}showModal(){this.open=true;}close(){this.open=false;}
}
const ids=['equipment-dialog','equipment-slots','equipment-picker','equipment-list','equipment-picker-title','equipment-close','equipment-picker-close'];
const nodes=Object.fromEntries(ids.map(id=>[id,new Element()])),doc={getElementById:id=>nodes[id],createElement:()=>new Element()};
let stored=null,loadout,opened=0,closed=0;const win={localStorage:{getItem:()=>stored,setItem:(key,value)=>stored=value}};
const menu=createEquipmentMenu(doc,win,{equip:value=>loadout={...value},onOpen(){opened++;},onClose(){closed++;}});
menu.open();assert(menu.opened&&opened===1);assert.equal(nodes['equipment-slots'].children.length,1);
menu.chooseEquipment();assert(!nodes['equipment-picker'].hidden);assert(nodes['equipment-list'].children.length>3);
assert(menu.place('armor-light',1,1).ok);assert(loadout.installed.includes('armor-light'));
menu.close();assert(!menu.opened&&closed===1);createEquipmentMenu(doc,win,{equip:value=>loadout=value});assert(loadout.installed.includes('armor-light'));
console.log('EQUIPMENT_ENERGY_RAGE_VERIFIED: progressive rewards persist on interrupt, rage armor/no damage bonus, 5s gold, gear stats, selection, icons and persistence');

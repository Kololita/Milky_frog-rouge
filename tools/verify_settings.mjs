import assert from 'node:assert/strict';
import {createSettings} from '../src/settings.js';
import {gameFixture} from './game_fixture.mjs';

class Element {
  constructor(){this.listeners=new Map();this.dataset={};this.children=[];this.textContent='';}
  addEventListener(name,fn){this.listeners.set(name,fn);}
  append(...children){this.children.push(...children);}
  querySelectorAll(){return [];}
  showModal(){this.visible=true;}
  close(){this.visible=false;}
}
const nodes=new Map(['settings-dialog','settings-form','key-bindings','binding-message','settings-open','settings-close','settings-reset','settings-fullscreen'].map(id=>[id,new Element()]));
let saved,opened=0,closed=0;
const win={...new Element(),addEventListener:Element.prototype.addEventListener,localStorage:{getItem:()=>saved,setItem:(key,value)=>saved=value}};
const doc={getElementById:id=>nodes.get(id),createElement:()=>new Element()};
const settings=createSettings(doc,win,{onOpen:()=>opened++,onClose:()=>closed++});
nodes.get('settings-open').listeners.get('click')();assert(settings.opened&&opened===1);
const rows=nodes.get('key-bindings').children;
rows[0].children[1].listeners.get('click')();
win.listeners.get('keydown')({code:'ArrowUp',preventDefault(){},stopImmediatePropagation(){}});
assert.equal(settings.resolve('ArrowUp'),'KeyW');assert.equal(settings.resolve('KeyW'),null);
assert.equal(JSON.parse(saved).bindings.KeyW,'ArrowUp');
nodes.get('settings-close').listeners.get('click')();assert(!settings.opened&&closed===1);
const restored=createSettings({getElementById:()=>null},win);assert.equal(restored.resolve('ArrowUp'),'KeyW');

const game=await gameFixture(120),{read,key,tick,reset}=game;game.freezeEnemy=true;
read('settings.values.bindings.KeyW="ArrowUp";battle.enemy.z=30');key('ArrowUp');tick(.3);key('ArrowUp',false);
assert(read('player.position.length()>.1'),'Remapped movement does not reach real controls');
reset();read('settings.values.bindings.Mouse2="KeyG"');key('KeyG');assert(read('battlePose().guarding'));key('KeyG',false);tick(.1);assert(read('battlePose().guarding'));tick(.1);assert(!read('battlePose().guarding'));
assert(!game.canvasListeners.has('wheel'),'Wheel camera zoom is still registered');
reset();read('settings.values.fps="30";battle.enemy.z=30');key('ArrowUp');tick(1);key('ArrowUp',false);
assert(read('player.position.length()>.9'),'Frame cap slowed simulation speed');
console.log('SETTINGS_VERIFIED: menu lifecycle, persistence, keyboard/mouse remap, wheel removal, capped simulation');

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {ZODIAC_ART,randomHomeArt} from '../src/home-art.js';
import {gameFixture} from './game_fixture.mjs';
assert.equal(ZODIAC_ART.length,12);const picks=new Set();
for(let i=0;i<12;i++)picks.add(randomHomeArt(null,()=>(i+.1)/12).id);
assert.equal(picks.size,12);
for(const art of ZODIAC_ART){
 for(const value of [0,.5,.99999])assert.notEqual(randomHomeArt(art.id,()=>value).id,art.id);
 const file=await fs.readFile(new URL(`../public${art.url}`,import.meta.url));
 assert.equal(file.toString('ascii',1,4),'PNG');assert.equal(file.readUInt32BE(16),360);assert.equal(file.readUInt32BE(20),360);
}
const g=await gameFixture(60,{home:true}),home=g.hud.get('home-screen');
assert(ZODIAC_ART.some(art=>art.id===home.dataset.zodiac));const first=home.dataset.zodiac;
const mixerTime=g.read('mixer.time');g.tick(.5);assert.equal(g.read('mixer.time'),mixerTime);
assert.equal(g.read('battle.time'),0);
g.hud.get('home-practice').listeners.get('click')();g.tick(.2);assert(g.read('mixer.time')>mixerTime);assert(g.read('battle.time>0'));
g.hud.get('return-home').listeners.get('click')();assert.notEqual(home.dataset.zodiac,first);
assert(home.style.values['--home-background'].includes('/images/zodiac/'));
const css=await fs.readFile(new URL('../src/style.css',import.meta.url),'utf8');assert(css.includes('.on-home>#scene {visibility:hidden;}'));
console.log('HOME_ART_VERIFIED: 12 intact PNG assets, random choices/no immediate repeats, static home, practice rendering resumes');

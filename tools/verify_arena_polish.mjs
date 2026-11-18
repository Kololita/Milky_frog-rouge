import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Battle} from '../src/battle.js';
import {SAMURAI_RECOVERY,beginBossSequence} from '../src/samurai.js';
import {WAVE_STATS} from '../src/battle-values.js';
import {bossAnimationPose} from '../src/boss-animation.js';
import {gameFixture} from './game_fixture.mjs';
assert.equal(WAVE_STATS.impactLevel,1);assert.equal(SAMURAI_RECOVERY.link,.6);
const origin={x:0,z:0,heading:0};
for(const [raw,state,stun] of [[1,'idle',0],[2,'hurt',.24],[3,'hurt',.72]]){
 const b=new Battle();b.reset('samurai');b.enemy.state='idle';b.enemy.superArmor=false;
 b.impactEnemy(raw,origin);assert.equal(b.enemy.state,state);assert.equal(b.enemy.stun,stun);
 assert.equal(b.enemy.dazeUntil,0,'Boss still receives level-three daze after resistance');
}
const poses=[];
for(const pattern of ['quick','delay','mixed','thrust','sweep']){
 const b=new Battle();b.reset('samurai');beginBossSequence(b,pattern);b.enemy.elapsed=b.enemy.telegraph;poses.push(bossAnimationPose(b.enemy));
}
for(let i=0;i<poses.length;i++)for(let j=0;j<i;j++)assert(Math.max(...Object.keys(poses[i]).map(key=>Math.abs(poses[i][key]-poses[j][key])))>.3,'Patterns have indistinguishable windup poses');
const g=await gameFixture(60,{home:true});g.hud.get('home-arena').listeners.get('click')();assert(g.hud.get('boss-arena-dialog').open);
g.hud.get('home-samurai').listeners.get('click')();assert(!g.hud.get('boss-arena-dialog').open);assert.equal(g.read('battle.mode'),'samurai');
const html=await fs.readFile(new URL('../index.html',import.meta.url),'utf8');
assert(!html.includes('THREE.JS DEMO')&&!html.includes('id="status"')&&!html.includes('调试者模式')&&!html.includes('settings-samurai'));
assert(html.includes('id="home-arena"')&&html.includes('aria-label="设置"'));
console.log('ARENA_POLISH_VERIFIED: compact UI/arena menu, impact resistance, wave impact, slower recovery and five distinct pose profiles');

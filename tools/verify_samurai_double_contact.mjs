import assert from 'node:assert/strict';
import {Battle} from '../src/battle.js';
import {beginBossSequence,samuraiStrikeActive,SAMURAI_MOVES,SAMURAI_EVADE} from '../src/samurai.js';
import {enemyAnimationSample} from '../src/enemy-models.js';
import {attackWarningPulse} from '../src/attack-warning.js';
const pose={x:0,z:0,height:0,heading:0,invulnerable:true,guarding:false};
for(const fps of [30,60,144])for(const phase of [1,2,3]){
 const b=new Battle();b.reset('samurai');const e=b.enemy;e.phase=phase;e.z=1.5;beginBossSequence(b,'double');
 const hitAt=e.hitAt,end=e.windup,events=[];let clock=0;
 const original=b.strikePlayer.bind(b);
 b.strikePlayer=(...args)=>{events.push({at:clock,index:e.moveIndex,clip:enemyAnimationSample('samurai',e,b.enemyTime).phase,lag:args[2]});return original(...args);};
 assert(Math.abs(hitAt-1*.35/.45)<1e-9);assert(hitAt<e.telegraph);
 e.elapsed=hitAt-.075;assert(attackWarningPulse(e)>.99);assert(samuraiStrikeActive(e));e.elapsed=0;
 while(clock<end+.02){clock+=1/fps;b.update(1/fps,pose);}
 const first=events.filter(x=>x.index===0);assert.equal(first.length,1,'First move has duplicate contacts');
 assert(Math.abs(first[0].at-hitAt)<=1/fps+1e-8,'Contact did not move to the first swing');
 assert(first[0].clip>=.35-1e-8&&first[0].clip<.38,'Contact samples the wrong visible swing');
 const late={...e,state:'windup',move:SAMURAI_MOVES.double[0],elapsed:1.15,hitAt,telegraph:1};
 assert(!samuraiStrikeActive(late),'The later swing still has an attack trail');
 for(let i=0;i<fps*2&&events.length<2;i++){clock+=1/fps;b.update(1/fps,pose);}
 assert.equal(events[1].index,1,'Second move lost its independent contact');
 // The evasive counter's authored pause must still be respected in every phase.
 const c=new Battle();c.reset('samurai');c.enemy.phase=phase;c.enemy.z=1.5;c.enemy.state='bait';c.enemy.baitAttackIntent=c.attackIntent;
 c.noteAttackInput();c.update(1/fps,pose);
 for(let i=0;i<fps&&c.enemy.state==='evade';i++)c.update(1/fps,pose);
 assert(Math.abs(c.enemy.hitAt-(SAMURAI_EVADE.counterPause+c.enemy.swingDuration))<1e-8);
}
console.log('SAMURAI_DOUBLE_CONTACT_VERIFIED: first visible swing hits once, later swing is cosmetic, second cut and counter timing preserved at 30/60/144FPS');

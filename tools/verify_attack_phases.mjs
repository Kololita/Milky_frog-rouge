import assert from 'node:assert/strict';
import {attackRate,advanceAttackTime,attackCanFinish} from '../src/combat.js';
import {gameFixture} from './game_fixture.mjs';
assert.equal(attackRate('Attack1',.1,2,.5),2.7);
for(const t of [.1,.28,.4,.52,.65]){assert.equal(attackRate('Attack3',t,.7,.5),attackRate('Attack3',t,.7,2));assert.equal(attackRate('Attack3',t,1.4,2),2*attackRate('Attack3',t,.7,2));}
assert.equal(attackRate('Attack3',.8,.7,2),attackRate('Attack3',.8,1.4,2));
assert.equal(attackRate('Attack3',.8,.7,1),2*attackRate('Attack3',.8,.7,2));
assert.equal(attackRate('Attack1',.5,2,.5),2.7);
assert.equal(attackRate('Attack1',.5,3,1),1.35,'Attack speed leaked into interval');
assert.equal(attackRate('Attack4',.1,3,1),1,'Attack speed accelerated charging');
assert.equal(advanceAttackTime('RunAttack',.5,.5,3,1),.75);
assert.equal(advanceAttackTime('RunAttack',.5,.4,1,.8),.75);
assert(!attackCanFinish('RunAttack',.6,true));
for(const fps of [30,60,144]){
 const g=await gameFixture(fps);g.freezeEnemy=true;
 g.read('battle.enemy.z=30;combo.enter(2);playAttack(2,"RunAttack")');
 assert(g.until('activeGesture?.action.time>=.5',1));
 const start=g.now;
 g.mouse(2);g.tap('Space');g.mouse(0);
 assert.equal(g.read('activeGesture.name'),'RunAttack');assert(!g.read('activeJump||blockHeldAt!==null'));
 assert(g.until('activeGesture?.name!=="RunAttack"',1));
 const duration=(g.now-start)/1000;
 assert(duration>=.7-1/fps-1e-8&&duration<=.7+1/fps+1e-8,`Run attack recovery ${duration}`);
}
console.log('ATTACK_PHASES_VERIFIED: separate multipliers, charging, mandatory run recovery and input lock');

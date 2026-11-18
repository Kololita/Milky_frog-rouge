import assert from 'node:assert/strict';
import {Monster,Mob} from '../src/monster.js';
import {StatusEffects} from '../src/status-effects.js';
import {Battle} from '../src/battle.js';
import {encounterFor} from '../src/encounters.js';
import {motionDamage} from '../src/combat-damage.js';
import {launchEnemyProjectiles} from '../src/enemy-projectiles.js';

const effect={type:'damageIncrease',amount:.2,duration:30,group:'support-damage'};
const b=new Battle();b.reset('lantern-shellbug');
b.enemies.push(b.createEnemy(encounterFor('raiderElite'),2),b.createEnemy(encounterFor('samurai'),3));
assert(b.enemies.every(e=>e instanceof Monster));assert(b.enemies.some(e=>!(e instanceof Mob)));
const states=b.enemies.map(e=>({state:e.state,heading:e.heading,moves:e.stats.moves?.map(m=>m.label),power:e.attackPower}));
assert.equal(b.applyEffect(effect),4);
b.enemies.forEach((enemy,index)=>{
 assert.equal(enemy.damageMultiplier,1.2);assert.equal(enemy.attackPower,states[index].power);
 assert.equal(enemy.state,states[index].state);assert.equal(enemy.heading,states[index].heading);assert.deepEqual(enemy.stats.moves?.map(m=>m.label),states[index].moves);
 assert.equal(motionDamage(enemy,2),Number((enemy.attackPower*2*1.2).toFixed(2)));
});
assert(!b.player.effects,'Monster-only effect reaches the player');
b.applyEffect(effect);assert(b.enemies.every(e=>e.damageMultiplier===1.2),'Repeated cast stacks a refresh effect');
const receiver=b.enemies[1];b.enemies[0].health=0;assert.equal(receiver.damageMultiplier,1.2,'Caster death removes receiver-owned effect');
b.clearBattleEffects();assert(b.enemies.every(e=>e.effects.entries.size===0));
assert.equal(b.applyEffect(effect,Mob),2,'Category target includes a boss or dead caster');assert.equal(b.enemies[3].damageMultiplier,1);

// No lantern needs to exist for the generic operation to work.
for(const id of ['raider','spitter','mirrorGuard','stonekeeper','samurai','practice']){
 const c=new Battle();c.reset(id);assert.equal(c.applyEffect(effect),1);assert.equal(c.enemy.damageMultiplier,1.2);
 c.enemy.effects.update(30);assert.equal(c.enemy.damageMultiplier,1);
}
{
 const effects=new StatusEffects();effects.apply(effect,0);effects.apply({...effect,amount:.3},1);effects.apply(effect,2);
 assert.equal(effects.value('damageIncrease'),.3);effects.update(31.9);assert(effects.has('damageIncrease'));effects.update(32);assert(!effects.has('damageIncrease'));
 effects.apply(effect,0);effects.apply({...effect,group:'another-source',amount:.1},0);assert(Math.abs(effects.value('damageIncrease')-.3)<1e-9);effects.clear();assert.equal(effects.value('damageIncrease'),0);
}
{
 const c=new Battle();c.enemy.x=0;c.enemy.z=1;c.enemy.heading=0;
 c.applyEffect({...effect,duration:.05});assert(c.beginBackThrow({x:0,z:0,height:0,heading:0}));
 c.update(.05,{x:0,z:0,height:0,heading:0});assert(c.backThrow);assert.equal(c.enemy.damageMultiplier,1,'Suspended throw animation freezes effect duration');
}
{
 const c=new Battle();c.reset('spitter');c.enemy.applyEffect(effect,0);launchEnemyProjectiles(c,c.enemy.stats.moves[0]);
 const power=c.enemyProjectiles[0].attackPower;assert(Math.abs(power-7.2)<1e-9);c.enemy.effects.clear();c.enemy.attackPower=99;assert.equal(c.enemyProjectiles[0].attackPower,power,'Projectile does not retain launch-time power');
}
console.log('MONSTER_EFFECTS_VERIFIED: class-targeted damage increase for distinct mobs/elites/bosses, no per-enemy caster checks, unchanged behavior, refresh/expiry/death/cleanup and projectile snapshot');

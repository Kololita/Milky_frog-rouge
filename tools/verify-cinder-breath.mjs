import assert from 'node:assert/strict';
import {Battle} from '../src/battle.js';
const melee=new Set(['炉钳横扫','炉钳下砸','炉盖头槌','炉钳突刺']);
const breath='炉膛喷涌';
for(const fps of [30,60,144]){
 for(const initialDistance of [1.6,3.6,6]){
  const battle=new Battle();
  battle.reset('cinderWarden');
  const enemy=battle.enemy;
  enemy.x=0;enemy.z=0;enemy.heading=0;
  const pose={x:0,z:initialDistance,heading:Math.PI,height:0,invulnerable:true};
  let meleeBeat=false,breaths=0,firstMeleeDistance=null,closeWhenLocked=false;
  for(let frame=0;frame<fps*115;frame++){
   const before=Math.hypot(enemy.x-pose.x,enemy.z-pose.z);
   battle.update(1/fps,pose);
   if(!meleeBeat&&before>1.8&&Math.hypot(enemy.x-pose.x,enemy.z-pose.z)<before-1e-6)closeWhenLocked=true;
   for(const event of battle.takeEvents()){
    if(event.type==='monsterSwing'&&melee.has(event.label))meleeBeat=true;
    if(event.type!=='monsterMove')continue;
    if(melee.has(event.label)&&firstMeleeDistance===null)firstMeleeDistance=Math.hypot(enemy.x-pose.x,enemy.z-pose.z);
    if(event.label===breath){
     assert(meleeBeat,'Breathed without first striking using a melee move');
     meleeBeat=false;
     breaths++;
    }
   }
  }
  assert(firstMeleeDistance!==null&&firstMeleeDistance<=1.65,`First melee attack started at ${firstMeleeDistance}m`);
  assert(breaths>1,JSON.stringify({fps,initialDistance,breaths,state:enemy.state,motion:enemy.move?.motion,health:battle.player.health,enemyTime:battle.enemyTime}));
  if(initialDistance>1.8)assert(closeWhenLocked);
  console.log({fps,initialDistance,firstMeleeDistance,breaths,closeWhenLocked});
 }
}


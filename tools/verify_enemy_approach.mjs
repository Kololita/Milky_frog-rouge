import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Battle} from '../src/battle.js';
import {ENEMY_STATS,PLAYER_STATS} from '../src/battle-values.js';
const report=[];
for(const fps of [30,60,144]) {
  let cases=0;
  for(const [x,z] of [[.1,1.7],[.1,10],[1,5],[20,-10],[-10,.1]])for(const angle of [0,.3,.7,2]) {
    const b=new Battle(),pose={x,z,heading:0,height:0};
    b.enemy.x=x+Math.sin(angle)*3.6;b.enemy.z=z+Math.cos(angle)*3.6;
    let started=false,firstHit=0;
    for(let i=0;i<4*fps;i++) {
      b.update(1/fps,pose);
      const correction=b.separation(pose);pose.x+=correction.x;pose.z+=correction.z;
      if(b.enemy.state==='windup')started=true;
      if(b.player.health<100){firstHit=b.time;break;}
    }
    assert(started&&firstHit>0,`Stuck chasing at ${fps}FPS (${x},${z},${angle})`);cases++;
  }
  for(const distance of [1.1200000000000003,1.35+1e-12,1.39]) {
    const b=new Battle(),pose={x:.1,z:1.7,heading:0,height:0};
    b.enemy.x=pose.x;b.enemy.z=pose.z+distance;
    b.update(1/fps,pose);assert.equal(b.enemy.state,'windup','Close contact must trigger windup immediately');
  }
  const b=new Battle(),pose={x:0,z:0,heading:0,height:0};
  b.enemy.z=ENEMY_STATS.reach+PLAYER_STATS.radius+.01;b.enemy.heading=Math.PI;
  b.strikePlayer(pose);assert.equal(b.player.health,100,'Expanded attack ignores its range');
  report.push({fps,approachCases:cases,previousFloatingPointStallFixed:true,stopDistance:ENEMY_STATS.stopDistance,engageDistance:ENEMY_STATS.stopDistance+ENEMY_STATS.approachTolerance,attackReach:ENEMY_STATS.reach,outsideReachStillMisses:true});
}
await fs.writeFile(new URL('../output/animations/enemy-approach-verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log('ENEMY_APPROACH_VERIFIED',JSON.stringify(report));

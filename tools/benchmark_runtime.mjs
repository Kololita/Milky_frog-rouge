// CPU-side main-loop comparison; DOM/WebGL output are stubbed, not a GPU FPS test.
import fs from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {gameFixture} from './game_fixture.mjs';
const g=await gameFixture(60),results={};g.freezeEnemy=true;
const scenarios={
 idle(){g.reset();g.read('battle.enemy.z=100');g.tickFrames(900);},
 jump(){g.reset();g.read('battle.enemy.z=100');for(let i=0;i<12;i++){g.tap('Space');g.tickFrames(90);}},
 slam(){g.reset();g.read('battle.enemy.z=100');for(let i=0;i<8;i++){g.tap('Space');g.tickFrames(20);g.mouse(0);g.tickFrames(180);}},
 absorption(){g.reset();for(let i=0;i<10;i++){g.read('battle.enemy.z=100;battle.player.energy=0;battle.player.counterReady=true;battle.player.counterUntil=battle.time+3');g.mouse(1);g.tickFrames(90);}},
};
for(const [name,run] of Object.entries(scenarios)) {
 run();const samples=[];
 for(let i=0;i<5;i++){const start=performance.now();run();samples.push(performance.now()-start);}
 samples.sort((a,b)=>a-b);results[name]={medianMs:samples[2],samples};
}
const output=process.argv[2]??'runtime-cpu-current';
await fs.writeFile(new URL(`../output/animations/${output}.json`,import.meta.url),JSON.stringify({scope:'CPU main loop with real GLB; no browser layout/GPU rendering',results},null,2));
console.log(JSON.stringify(results));

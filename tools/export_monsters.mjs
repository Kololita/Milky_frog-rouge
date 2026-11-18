import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {Battle} from '../src/battle.js';
import {createEnemyView} from '../src/enemy-view.js';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
const scene=new THREE.Scene(),specials=process.argv.includes('--specials'),reviewMoves=specials||process.argv.includes('--moves'),output=specials?'monster-specials':reviewMoves?'monster-moves':'monster-lineup';
const ids=specials?['spitter','spitter','mirrorGuard','mirrorGuard','lantern','mirrorGuard']:reviewMoves?['shellbug','shellbug','lantern','lantern','raider','raiderElite','raiderElite','stonekeeper','scythemoth']:['raider','shellbug','lantern','spitter','mirrorGuard','raiderElite','stonekeeper','scythemoth'];
for(const [index,id] of ids.entries()){
 const b=new Battle();b.reset(id);b.enemy.heading=0;
 if(reviewMoves){const e=b.enemy;e.move=b.enemyStats.moves[(specials?[0,2,1,2,2,3]:[0,1,1,0,1,1,2,2,2])[index]];e.state='windup';e.telegraph=e.move.prepare;e.swingDuration=e.move.swing;e.windup=e.telegraph+e.swingDuration;e.elapsed=e.move.kind==='parry'?.3:e.telegraph*.9;}
 const view=createEnemyView(new THREE.Scene());view.update(b,new THREE.PerspectiveCamera(),0);
 const root=(b.enemyStats.visual?view.monsterVisuals.entries[b.enemyStats.visual].root:view.body).clone(true);root.name=id;
 root.position.x=reviewMoves?(index%3-1)*2.8:(index-(ids.length-1)/2)*2.1;if(reviewMoves)root.position.z=-Math.floor(index/3)*3;scene.add(root);
}
const data=await new GLTFExporter().parseAsync(scene,{binary:true});await fs.writeFile(`output/${output}.glb`,Buffer.from(data));console.log('MONSTER_LINEUP_EXPORTED');

// Bake the real runtime pose and effects for native offline visual inspection.
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {gameFixture} from './game_fixture.mjs';
globalThis.FileReader=class {readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.()});}};
const g=await gameFixture(60);g.freezeEnemy=true;
for(const [name,grade,after] of [['gold-shield','perfect',0],['parry-elbow','perfect',.09],['gold-absorb','perfect',.09],['gold-hand','perfect',.3],['silver-shield','normal',0],['energy-raise','perfect',.48],['energy-glow','perfect',.78],['energy-recover','perfect',1.30]]) {
  if(process.argv.length>2&&!process.argv.slice(2).includes(name))continue;
  g.reset();g.mouse(2);if(grade!=='perfect')g.tick(.4);
  g.read('battle.enemy.x=player.position.x;battle.enemy.z=player.position.z+1.05;battle.enemy.heading=Math.PI;battle.enemy.state="windup";battle.enemy.elapsed=.7');
  g.freezeEnemy=false;g.tickFrames(1);g.freezeEnemy=true;
  if(name.startsWith('energy-'))g.mouse(1);
  g.tick(after);
  const objects=g.read('[player,guardEffect.group,guardEffect.glow,guardEffect.points,absorptionView.rain,absorptionView.light]'),scene=new THREE.Scene();
  const point=new THREE.Vector3();
  for(const root of objects) {
    root.updateWorldMatrix(true,true);
    root.traverseVisible(object=>{
      if(object.isMesh) {
        object.skeleton?.update();
        const geometry=object.geometry.clone(),positions=geometry.attributes.position;
        for(let i=0;i<positions.count;i++){object.getVertexPosition(i,point);point.applyMatrix4(object.matrixWorld);positions.setXYZ(i,point.x,point.y,point.z);}
        delete geometry.morphAttributes.position;delete geometry.morphAttributes.normal;
        geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');geometry.computeVertexNormals();
        const material=Array.isArray(object.material)?object.material.map(m=>m.clone()):object.material.clone();
        // The native renderer reuses these named materials from the source GLB,
        // keeping embedded textures without a browser canvas conversion.
        for(const m of (Array.isArray(material)?material:[material]))if(m.map){m.name=`SourceMaterial::${m.name}`;m.map=null;}
        scene.add(new THREE.Mesh(geometry,material));
      } else if(object.isLine) {
        const a=object.geometry.attributes.position,points=[];
        for(let i=0;i<a.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(object.matrixWorld));
        if(object.isLineLoop)points.push(points[0].clone());
        for(let i=0;i<points.length-1;i+=object.isLineSegments?2:1) {
          const start=points[i],end=points[i+1],direction=end.clone().sub(start);
          if(direction.lengthSq()<1e-12)continue;
          const tube=new THREE.Mesh(new THREE.CylinderGeometry(.0025,.0025,direction.length(),5),new THREE.MeshBasicMaterial({color:object.material.color,transparent:true,opacity:object.material.opacity}));
          tube.position.copy(start).lerp(end,.5);tube.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());scene.add(tube);
        }
      } else if(object.isPoints) {
        for(let i=0;i<object.geometry.attributes.position.count;i++) {
          if(object.userData.samplePosition)object.userData.samplePosition(i,point);else point.fromBufferAttribute(object.geometry.attributes.position,i);point.applyMatrix4(object.matrixWorld);
          const spark=new THREE.Mesh(new THREE.SphereGeometry(.018,6,4),new THREE.MeshBasicMaterial({color:object.material.color}));spark.position.copy(point);scene.add(spark);
        }
      } else if(object.isPointLight) {
        const light=object.clone();object.getWorldPosition(light.position);scene.add(light);
      }
    });
  }
  const data=await new GLTFExporter().parseAsync(scene,{binary:true});
  await fs.writeFile(new URL(`../output/animations/${name}-review.glb`,import.meta.url),Buffer.from(data));
}
console.log('GUARD_POWER_REVIEW_EXPORTED');

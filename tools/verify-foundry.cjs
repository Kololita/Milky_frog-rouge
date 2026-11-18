const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises');
app.whenReady().then(async()=>{
 const win=new BrowserWindow({width:1920,height:1080,show:false,webPreferences:{offscreen:true,backgroundThrottling:false}}),errors=[];
 win.webContents.on('console-message',(_e,level,message)=>{if(level>=3)errors.push(message);});
 try{
 await win.loadURL('http://127.0.0.1:5173/');
 for(let i=0;i<500;i++){if(await win.webContents.executeJavaScript(`document.getElementById('home-practice')?.disabled===false`))break;await new Promise(r=>setTimeout(r,100));}
 const startup=await win.webContents.executeJavaScript(`({ready:!document.getElementById('home-practice').disabled,warmup:document.querySelector('#scene').dataset.warmup})`);
 await win.webContents.executeJavaScript(`(async()=>{
 const {createFoundryPost}=await import('/src/foundry-post.js');const T=await import('/node_modules/three/build/three.module.js'),{createBoilerRoom}=await import('/src/boiler-room.js'),{Battle}=await import('/src/battle.js'),{damageCoolingValve}=await import('/src/cooling.js');
 const scene=new T.Scene();scene.background=new T.Color('#9eabb6');scene.add(new T.HemisphereLight('#e0e9f1','#41372c',1.4));
 const sun=new T.DirectionalLight('#ffe8c6',2.8);sun.position.set(0,16,0);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:.1,far:30});sun.shadow.normalBias=.025;scene.add(sun);
 const room=createBoilerRoom(scene);await room.ready;room.setMode(true);const battle=new Battle();battle.reset('cinderWarden');
 const camera=new T.PerspectiveCamera(54,innerWidth/innerHeight,.1,100);camera.position.set(7,4,-7);camera.lookAt(-2,2.5,2);
 const renderer=new T.WebGLRenderer({antialias:true});renderer.info.autoReset=false;renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 renderer.domElement.style.cssText='position:fixed;inset:0;z-index:99999';document.body.append(renderer.domElement);room.prepare(renderer);
 const post=createFoundryPost(renderer,scene,camera);const draw=(time)=>{renderer.info.reset();battle.enemyTime=time;room.update(battle,{x:0,z:0},{},camera);post.render(true);};draw(0);await renderer.compileAsync(scene,camera);draw(0);
 window.foundryQA={scene,room,battle,camera,renderer,draw,damageCoolingValve};
 })()`);
 await new Promise(r=>setTimeout(r,200));await fs.writeFile('output/foundry-intact.png',(await win.webContents.capturePage()).toPNG());
 await win.webContents.executeJavaScript(`{const q=window.foundryQA;for(const v of q.battle.coolingValves)q.damageCoolingValve(q.battle,v,20);for(let i=1;i<=180;i++)q.draw(i/60);}`);
 await new Promise(r=>setTimeout(r,200));await fs.writeFile('output/foundry-running-water.png',(await win.webContents.capturePage()).toPNG());
 await win.webContents.executeJavaScript(`{const q=window.foundryQA;q.room.setRefraction(false);q.draw(3);}`);
 await new Promise(r=>setTimeout(r,200));await fs.writeFile('output/foundry-running-water-performance.png',(await win.webContents.capturePage()).toPNG());
 await win.webContents.executeJavaScript(`{const q=window.foundryQA;q.room.setRefraction(true);q.draw(3);}`);
 await win.webContents.executeJavaScript(`{const q=window.foundryQA;q.camera.position.set(4,1.7,-3.5);q.camera.lookAt(2,.65,-6);q.draw(3.01);}`);
 await new Promise(r=>setTimeout(r,200));await fs.writeFile('output/foundry-valve-close.png',(await win.webContents.capturePage()).toPNG());
 const report=await win.webContents.executeJavaScript(`(()=>{
   const q=window.foundryQA,states=[];
   q.room.root.traverse(o=>{
     if(o.name==='ValveIntact'||o.name==='ValveBroken')states.push({name:o.name,visible:o.visible});
   });
   return {states,calls:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles};
 })()`);
 const combined=await win.webContents.executeJavaScript(`(async()=>{
   const q=window.foundryQA;
   const {Battle}=await import('/src/battle.js');
   const {createEnemyView}=await import('/src/enemy-view.js');
   const {loadEnemyModels}=await import('/src/enemy-models.js');
   const {createMirrorReflections}=await import('/src/mirror-reflections.js');
   await loadEnemyModels();
   q.camera.position.set(7,4,-7);
   q.camera.lookAt(-2,2.5,2);
   const enemyBattle=new Battle();
   enemyBattle.reset('mirrorGuard');
   const enemy=enemyBattle.enemy;
   enemy.x=3;enemy.z=-3;enemy.heading=Math.atan2(4,-4);
   const view=createEnemyView(q.scene);
   view.update(enemyBattle,q.camera,0,[]);
   const reflection=createMirrorReflections(q.renderer,q.scene);
   reflection.register();
   reflection.update(q.camera);
   const mirror=q.scene.getObjectByName('ShieldMirror');
   if(!mirror?.visible)throw Error('Mirror guard did not produce an in-view reflection');
   // Trigger one reflected scene regardless of the shield's idle angle.
   mirror.forceUpdate=true;
   q.draw(3.04);
   const active=q.renderer.info.render.calls;
   reflection.setFrozen(true);
   q.draw(3.04);
   const frozen=q.renderer.info.render.calls;
   if(active<=frozen)throw Error('Combined stress scene did not render a reflection pass');
   view.group.removeFromParent();
   reflection.update(q.camera);
   if(mirror.parent)throw Error('Combined stress scene leaked its shield reflector');
   return {active,frozen};
 })()`);
 const gpu=await win.webContents.executeJavaScript(`(async()=>{
   const T=await import('/node_modules/three/build/three.module.js');
   const {createGpuDrainMotion}=await import('/src/gpu-drain-motion.js');
   const {createWaterSurface}=await import('/src/water-surface.js');
   const renderer=window.foundryQA.renderer;
   const motion=createGpuDrainMotion(renderer,60,40);
   if(!motion)return {supported:false};
   const target=new T.WebGLRenderTarget(60,40,{type:T.FloatType,depthBuffer:false});
   renderer.initRenderTarget(target);
   const read=()=>{
     renderer.copyTextureToTexture(motion.positions,target.texture);
     const data=new Float32Array(60*40*4);
     renderer.readRenderTargetPixels(target,0,0,60,40,data);
     if(!data.every(Number.isFinite))throw Error('Non-finite GPU particle state');
     return data;
   };
   const emitters=new Float32Array([2,.71,2,-2,.71,2,2,.71,-2,-2,.71,-2]);
   motion.setEmitters(emitters,new Float32Array([0,.01,0,.01,0,.01,0,.01]));
   try{
     motion.refreshPressure();
     motion.step(1/90,1,0,1,null);
     const spawn=read();
     if(spawn[3]<23||Math.abs(spawn[1]-.71)>.001)throw Error('GPU emitter did not initialize particle');

     motion.step(1/90,2,1/90,1,null);
     const moved=read();
     if(moved[1]<=spawn[1]||moved[3]>=spawn[3])throw Error('GPU particle did not advance');
     for(let tick=3;tick<182;tick++){
       if(tick%2===1)motion.refreshPressure();
       motion.step(1/90,tick,(tick-1)/90,1,null);
     }
     const settled=read();
     if(!settled.some((value,i)=>i%4===3&&value>0&&settled[i-2]<.05))throw Error('No GPU particles landed');
     const surface=createWaterSurface(new T.Group());
     surface.prepare(renderer,true);
     const pixels=new Uint8Array(256*256*4);
     const densityTarget=new T.WebGLRenderTarget(256,256,{depthBuffer:false});
     const particleData=new Float32Array(60*40*4);
     const particleTexture=new T.DataTexture(particleData,60,40,T.RGBAFormat,T.FloatType);
     try{
       particleData.set([4,-.1,2,1],4);
       particleTexture.needsUpdate=true;
       surface.update([],[],0,particleTexture,1);
       renderer.initRenderTarget(densityTarget);
       renderer.copyTextureToTexture(surface.density,densityTarget.texture);
       renderer.readRenderTargetPixels(densityTarget,0,0,256,256,pixels);
       const expected=(Math.floor((.5-2/22.7)*256)*256+Math.floor((.5+4/22.7)*256))*4;
       if(!pixels[expected]||pixels[(128*256+128)*4])throw Error('GPU drain density is not projected at the particle position');
     }finally{particleTexture.dispose();densityTarget.dispose();}
     motion.reset();
     if(read().some(value=>value!==0))throw Error('GPU reset did not clear particle state');
     motion.refreshPressure();
     motion.step(1/90,183,2,1,null);
     if(read().some(value=>value!==0))throw Error('GPU emitter spawned after its window expired');
     return {supported:true,spawned:true,moved:true,landed:true,densityProjection:true,reset:true,emissionWindow:true};
   }finally{target.dispose();motion.dispose();}
 })()`);
 const gpuEffects=await win.webContents.executeJavaScript(`(async()=>{
   const T=await import('/node_modules/three/build/three.module.js');
   const {createSamuraiPhaseEffects}=await import('/src/samurai-phase-effects.js');
   const {createGuardEffect}=await import('/src/guard-effect.js');
   const {createMonsterEffects}=await import('/src/monster-effects.js');
   const {createMirrorReflections}=await import('/src/mirror-reflections.js');
   const {createGpuHealthBar}=await import('/src/gpu-health-bar.js');
   const {createEnemyView}=await import('/src/enemy-view.js');
   const {Battle}=await import('/src/battle.js');
   const {createHitboxView}=await import('/src/hitbox-view.js');
   const {useGpuBillboard}=await import('/src/gpu-billboard.js');
   const {createEnemyProjectileView}=await import('/src/enemy-projectile-view.js');
   const {createWaveView}=await import('/src/wave-view.js');
   const {createFistWindEffects}=await import('/src/fist-wind-effects.js');
   const {createEnergyAbsorption}=await import('/src/energy-absorption.js');
   const {createCameraOcclusion}=await import('/src/camera-occlusion.js');
   const {createFlames}=await import('/src/flame-view.js');
   const {createImpactRing}=await import('/src/impact-ring.js');
   const {createSkillEffects}=await import('/src/skill-effects.js');
   const {createBattleHUD}=await import('/src/battle-hud.js');
   const {createGpuFloorProbe,applyGpuFloorOffset}=await import('/src/gpu-floor-probe.js');
   const {createFloorProbe}=await import('/src/floor-probe.js');
   const {loadAnimatedModel}=await import('/src/assets.js');
   const {renderer}=window.foundryQA;
   const scene=new T.Scene(),model=new T.Group(),blade=new T.Object3D();
   blade.name='blade';model.add(blade);scene.add(model);
   const effects=createSamuraiPhaseEffects(model);
   const guard=createGuardEffect(scene);
   const hand=new T.Object3D();hand.position.set(.7,1,0);scene.add(hand);
   const camera=new T.PerspectiveCamera(45,1,.1,20);
   camera.position.set(0,1.5,4);camera.lookAt(0,1,0);
   const target=new T.WebGLRenderTarget(128,128);
   const previous=renderer.getRenderTarget();
   try{
     const ribbonPixels=[];
     for(const phase of [2,3]){
       effects.update({health:1,state:'windup',phase,elapsed:1,telegraph:.5},.4,model);
       guard.update(.016,[{type:'blocked',grade:'perfect'}],hand,0,true,.4);
       guard.update(.08,[],hand,0,true,.48);
       if(!guard.points.visible)throw Error('Perfect guard absorption particles did not activate');
       renderer.setRenderTarget(target);
       renderer.render(scene,camera);
       const pixels=new Uint8Array(128*128*4);
       renderer.readRenderTargetPixels(target,0,0,128,128,pixels);
       if(!pixels.some((value,i)=>i%4!==3&&value>0))throw Error('GPU effects produced no visible pixels');
       const orbit=model.getObjectByName(phase===2?'phase2_full_orbits':'phase3_full_orbits');
       const orbs=orbit.children.filter(child=>child.name.startsWith('flow_lights'));
       const slash=model.getObjectByName('samurai_swing_lightning');
       orbs.forEach(mesh=>{mesh.visible=false;});
       slash.visible=false;
       guard.clear();
       renderer.render(scene,camera);
       renderer.readRenderTargetPixels(target,0,0,128,128,pixels);
       let count=0;
       for(let i=0;i<pixels.length;i+=4)if(pixels[i]>0)count++;
       if(!count)throw Error('GPU blade ribbon produced no pixels in phase '+phase);
       ribbonPixels.push(count);
       orbs.forEach(mesh=>{mesh.visible=true;});
     }
     const bolt=model.getObjectByName('samurai_sky_lightning');
     if(bolt.children.length!==2)throw Error('GPU sky bolt did not batch its three branches');
     const transition={health:1,state:'idle',phase:1,lightningAt:1};
     camera.position.set(0,4,10);camera.lookAt(0,4,0);
     const brightness=time=>{
       effects.update(transition,time,model);
       model.getObjectByName('samurai_lightning_radius').visible=false;
       renderer.render(scene,camera);
       const pixels=new Uint8Array(128*128*4);
       renderer.readRenderTargetPixels(target,0,0,128,128,pixels);
       return pixels.reduce((sum,value,index)=>sum+(index%4===0?value:0),0);
     };
     const boltStart=brightness(1),boltFade=brightness(1.22),boltEnd=brightness(1.33);
     if(boltStart<50||boltFade<=0||boltFade>=boltStart||boltEnd!==0)throw Error('GPU sky bolt brightness: '+[boltStart,boltFade,boltEnd]);
     camera.position.set(0,8,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);
     const groundBrightness=(enemy,time)=>{
       effects.update(enemy,time,model);
       bolt.visible=false;
       renderer.render(scene,camera);
       const pixels=new Uint8Array(128*128*4);
       renderer.readRenderTargetPixels(target,0,0,128,128,pixels);
       return pixels.reduce((sum,value,index)=>sum+(index%4===1?value:0),0);
     };
     const preparing={...transition,state:'transition',lightningAt:undefined,transitionStrikeAt:2.2,elapsed:0};
     const groundEarly=groundBrightness(preparing,1);
     preparing.elapsed=2;
     const groundCharged=groundBrightness(preparing,1);
     const groundHit=groundBrightness(transition,1);
     const groundFade=groundBrightness(transition,1.4);
     const groundEnd=groundBrightness(transition,1.7);
     if(!groundEarly||groundCharged<=groundEarly||groundFade<=0||groundFade>=groundHit||groundEnd!==0)throw Error('GPU ground telegraph brightness: '+[groundEarly,groundCharged,groundHit,groundFade,groundEnd]);
     camera.up.set(0,1,0);
     camera.position.set(0,1.5,4);camera.lookAt(0,1,0);
     model.visible=false;
     guard.clear();
     camera.position.set(.7,1,3);camera.lookAt(.7,1,0);
     const shieldPixels=()=>{
       renderer.render(scene,camera);
       const pixels=new Uint8Array(128*128*4);
       renderer.readRenderTargetPixels(target,0,0,128,128,pixels);
       let width=0,light=0;
       for(let i=0;i<128*128;i++){
         const red=pixels[i*4];
         if(red>2)width=Math.max(width,Math.abs(i%128-63.5));
         light+=red;
       }
       return {width,light};
     };
     guard.update(0,[{type:'blocked',grade:'good'}],hand);
     const normalStart=shieldPixels();
     guard.update(.15,[],hand);
     const normalLate=shieldPixels();
     guard.update(0,[{type:'blocked',grade:'perfect'}],hand);
     const perfectStart=shieldPixels();
     guard.update(.06,[],hand);
     guard.points.visible=false;
     const perfectLate=shieldPixels();
     guard.clear();
     camera.position.set(0,1.5,4);camera.lookAt(0,1,0);
     if(normalStart.light<=0||normalLate.width<=normalStart.width||normalLate.light>=normalStart.light||
        perfectLate.light<=0||perfectLate.width>=perfectStart.width||perfectLate.light>=perfectStart.light)
       throw Error('GPU shield pixels: '+JSON.stringify({normalStart,normalLate,perfectStart,perfectLate}));
     const {setBladeWarningTiming}=await import('/src/attack-warning.js');
     const bladeMaterial=new T.MeshStandardMaterial({color:0,emissive:0x802010,emissiveIntensity:.5});
     const bladeProbe=new T.Mesh(new T.PlaneGeometry(1,1),bladeMaterial);
     bladeProbe.position.y=1;scene.add(bladeProbe);
     const bladeBrightness=remaining=>{
       setBladeWarningTiming(bladeMaterial,remaining);
       renderer.render(scene,camera);
       const pixel=new Uint8Array(4);
       renderer.readRenderTargetPixels(target,64,64,1,1,pixel);
       return pixel[0];
     };
     const bladeIdle=bladeBrightness(.2),bladePeak=bladeBrightness(.075),bladeAfter=bladeBrightness(0);
     bladeProbe.removeFromParent();bladeProbe.geometry.dispose();bladeMaterial.dispose();
     if(bladeIdle<=0||bladePeak<=bladeIdle||bladeAfter!==bladeIdle)throw Error('GPU blade pulse brightness: '+[bladeIdle,bladePeak,bladeAfter]);
     const trailEffects=createMonsterEffects('samurai');
     scene.add(trailEffects.root);
     const enemy={health:1,state:'windup',phase:1,elapsed:1,telegraph:.5};
     for(let i=0;i<14;i++){
       blade.rotation.z=-.5+i*.07;
       model.updateMatrixWorld(true);
       trailEffects.animate(enemy,i/60,0,0,0,model);
     }
     const trail=trailEffects.root.getObjectByName('samurai_blade_trail');
     if(!trail.visible)throw Error('GPU blade trail did not activate');
     renderer.render(scene,camera);
     const trailPixels=new Uint8Array(128*128*4);
     renderer.readRenderTargetPixels(target,0,0,128,128,trailPixels);
     if(!trailPixels.some((value,i)=>i%4!==3&&value>0))throw Error('GPU blade trail produced no pixels');
     trailEffects.root.visible=false;
     const geometry=new T.PlaneGeometry(.9,.9);
     const vertices=geometry.attributes.position.count;
     geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(new Uint16Array(vertices*4),4));
     const weights=new Float32Array(vertices*4);
     for(let i=0;i<vertices;i++)weights[i*4]=1;
     geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
     const source=new T.SkinnedMesh(geometry,new T.MeshBasicMaterial());
     source.name='MirrorFacet_test';
     const bone=new T.Bone();
     source.add(bone);scene.add(source);
     source.bind(new T.Skeleton([bone]));
     const reflections=createMirrorReflections(renderer,scene);
     reflections.register();
     const mirror=scene.getObjectByName('ShieldMirror');
     if(!mirror.material.uniforms.mirrorBones)throw Error('GPU mirror skinning did not activate');
     const original=mirror.geometry.attributes.position.array.slice();
     bone.position.set(.17,1,0);
     reflections.update();
     if(Math.abs(mirror.position.y-1.45)>.01)throw Error('Mirror plane did not follow the bone');
     if(original.some((value,i)=>value!==mirror.geometry.attributes.position.array[i]))throw Error('GPU mirror rewrote its CPU geometry');
     const mirrorCamera=new T.PerspectiveCamera(50,1,.1,20);
     mirrorCamera.position.set(0,1,4);
     mirrorCamera.lookAt(0,1,8);
     reflections.update(mirrorCamera);
     if(mirror.visible)throw Error('Offscreen shield reflection was not culled');
     mirrorCamera.lookAt(0,1,0);
     reflections.update(mirrorCamera);
     if(!mirror.visible)throw Error('Shield reflection did not return when visible');
     mirror.material.side=T.DoubleSide;
     mirror.forceUpdate=true;
     renderer.render(scene,camera);
     const probe=createGpuFloorProbe(renderer,source);
     let gpuFloor=null;
     let gpuFloorShift=null;
     if(probe){
       probe.compute(1);
       mirror.visible=false;
       const marker=new T.Mesh(new T.PlaneGeometry(.2,.2),new T.MeshBasicMaterial({color:0xffffff}));
       marker.position.y=1;
       const offset={floorHeightMap:{value:probe.target.texture},floorDesired:{value:0},floorEnabled:{value:false}};
       applyGpuFloorOffset(marker.material,offset);
       scene.add(marker);
       const heightOnScreen=()=>{
         renderer.render(scene,camera);
         const pixels=new Uint8Array(128*128*4);
         renderer.readRenderTargetPixels(target,0,0,128,128,pixels);
         let sum=0,count=0;
         for(let i=0;i<pixels.length;i+=4)if(pixels[i]>40){sum+=Math.floor(i/4/128);count++;}
         if(!count)throw Error('GPU floor marker did not render');
         return sum/count;
       };
       const originalHeight=heightOnScreen();
       offset.floorEnabled.value=true;
       gpuFloorShift=heightOnScreen()-originalHeight;
       marker.visible=false;
       if(gpuFloorShift<10)throw Error('GPU floor texture did not move the rendered marker');
       const data=new Float32Array(4);
       renderer.readRenderTargetPixels(probe.target,0,0,1,1,data);
       gpuFloor=data[0]+1;
       probe.dispose();
       if(data[3]!==1||Math.abs(gpuFloor-.55)>.0001)throw Error('GPU floor reduction returned '+gpuFloor);
     }
     source.removeFromParent();
     let released=0;
     for(const resource of [mirror.geometry,mirror.material,mirror.getRenderTarget()]){
       resource.addEventListener('dispose',()=>released++);
     }
     reflections.update(camera);
     if(mirror.parent||!source.material.visible||released!==3)throw Error('Detached shield reflection was not released');
     source.skeleton.dispose();
     const frog=await loadAnimatedModel('/models/characters/frog.glb?v=mouth-contour-1');
     const cpuProbe=createFloorProbe(frog.model,{fullBody:true});
     const frogGpu=createGpuFloorProbe(renderer,frog.model);
     let floorComparison=null;
     if(frogGpu){
       const values=new Float32Array(4);
       let maxError=0,cpuMs=0,gpuReadMs=0,gpuSubmitMs=0,samples=0;
       try{
         // Exclude the first shader compile and target allocation from pose timings.
         cpuProbe();
         frogGpu.compute(0);
         renderer.readRenderTargetPixels(frogGpu.target,0,0,1,1,values);
         const clips=new Set(Object.values(frog.actions).map(action=>action.getClip()));
         for(const clip of [...clips].filter(clip=>/jump|airattack|backthrow/i.test(clip.name)).slice(0,6)){
           frog.mixer.stopAllAction();
           const action=frog.mixer.clipAction(clip).reset().play();
           for(const phase of [.2,.5,.8]){
             action.time=clip.duration*phase;
             frog.mixer.update(0);
             let start=performance.now();
             const cpu=cpuProbe();
             cpuMs+=performance.now()-start;
             start=performance.now();
             frogGpu.compute(0);
             gpuSubmitMs+=performance.now()-start;
             renderer.readRenderTargetPixels(frogGpu.target,0,0,1,1,values);
             gpuReadMs+=performance.now()-start;
             if(values[3]!==1)throw Error('GPU frog probe did not render');
             maxError=Math.max(maxError,Math.abs(cpu-values[0]));
             samples++;
           }
         }
         if(!samples||maxError>.0002)throw Error('GPU frog floor deviation: '+maxError+' across '+samples+' poses');
         floorComparison={samples,maxError,cpuMs,gpuReadMs,gpuSubmitMs};
       }finally{frogGpu.dispose();}
     }
     mirror.visible=false;
     const bar=createGpuHealthBar({width:.9,height:.12,fillWidth:.84,fillHeight:.08,background:'#000000',color:'#ffffff'});
     bar.group.position.y=1;
     scene.add(bar.group);
     const countLit=(threshold=40)=>{
       renderer.render(scene,camera);
       const pixels=new Uint8Array(128*128*4);
       renderer.readRenderTargetPixels(target,0,0,128,128,pixels);
       let count=0;
       for(let i=0;i<pixels.length;i+=4)if(pixels[i]>threshold)count++;
       return count;
     };
     bar.setFraction(1);
     const full=countLit();
     bar.setFraction(.5);
     const half=countLit();
     if(full<10||half<full*.35||half>full*.65)throw Error('GPU health fill did not scale');
     bar.group.visible=false;
     const {createImpactParticles}=await import('/src/gpu-particles.js');
     const hitParticles=createImpactParticles(scene);
     camera.position.set(0,4,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);
     hitParticles.update(0,[{type:'enemyHit',x:0,z:0,strong:true}]);
     const impactStart=countLit(4);
     hitParticles.update(.15,[]);
     const impactSpread=countLit(4);
     hitParticles.update(.18,[]);
     if(impactStart<=0||impactSpread<=impactStart||countLit(4)!==0)
       throw Error('GPU hit particle pixels: '+[impactStart,impactSpread]);
     hitParticles.points.removeFromParent();
     const battle=new Battle();
     const enemyView=createEnemyView(scene);
     Object.assign(battle.enemy,{state:'dazed',x:0,z:0});
     enemyView.update(battle,camera,0);
     for(const child of enemyView.group.children)if(child!==enemyView.dazeStars)child.visible=false;
     if(!enemyView.dazeStars.visible||countLit()===0)throw Error('GPU daze stars did not render');
     camera.position.set(4,1.5,0);
     camera.lookAt(0,1,0);
     if(countLit()===0)throw Error('GPU daze stars did not face the turned camera');
     camera.position.set(0,5,0);
     camera.up.set(0,0,-1);
     camera.lookAt(0,0,0);
     battle.enemy.state='windup';
     battle.enemy.elapsed=.3;
     battle.enemy.telegraph=.6;
     battle.enemy.move={...battle.enemyStats,reach:.8,halfAngle:Math.PI/4};
     const sectorPixels=()=>{
       enemyView.update(battle,camera,0);
       for(const child of enemyView.group.children)if(child!==enemyView.warning)child.visible=false;
       if(!enemyView.warning.visible)throw Error('GPU attack sector did not activate');
       return countLit(4);
     };
     const shortSector=sectorPixels();
     battle.enemy.move.reach=1.6;
     const longSector=sectorPixels();
     if(shortSector<10||longSector<shortSector*2.5)throw Error('GPU attack sector pixels: '+shortSector+' -> '+longSector);
     const sectorBrightness=elapsed=>{
       battle.enemy.elapsed=elapsed;
       sectorPixels();
       const pixels=new Uint8Array(128*128*4);
       renderer.readRenderTargetPixels(target,0,0,128,128,pixels);
       let red=0;
       for(let i=0;i<pixels.length;i+=4)red+=pixels[i];
       return red;
     };
     const beforePulse=sectorBrightness(.44),peakPulse=sectorBrightness(.525),afterPulse=sectorBrightness(.6);
     if(peakPulse<=Math.max(beforePulse,afterPulse))throw Error('GPU warning pulse did not peak before contact');
     enemyView.group.visible=false;
     const hitboxes=createHitboxView(scene);
     const hit={type:'debugHitbox',owner:'enemy',x:0,z:0,heading:0,range:1,halfAngle:Math.PI/4,yMin:.1,yMax:.8};
     const wirePixels=[];
     for(const shape of [hit,{...hit,radial:true},{...hit,shape:'capsule',toX:.6,toZ:.7,radius:.25}]){
       hitboxes.clear();
       hitboxes.update({time:0},[shape],true);
       wirePixels.push(countLit(4));
     }
     hitboxes.update({time:.2},[],true);
     if(wirePixels.some(count=>count<10)||countLit(4)!==0)throw Error('GPU debug hitbox rendering or expiry failed: '+wirePixels);
     const marker=new T.Mesh(new T.PlaneGeometry(.25,.25),new T.MeshBasicMaterial({color:'#ffffff'}));
     const reach={reachOrigin:{value:new T.Vector3()},reachDirection:{value:new T.Vector3(1,0,0)},reachDistance:{value:.3}};
     useGpuBillboard(marker,reach);
     scene.add(marker);
     const centroid=()=>{
       renderer.render(scene,camera);
       const pixels=new Uint8Array(128*128*4);
       renderer.readRenderTargetPixels(target,0,0,128,128,pixels);
       let count=0,total=0;
       for(let i=0;i<pixels.length;i+=4)if(pixels[i]>40){count++;total+=(i/4)%128;}
       if(!count)throw Error('GPU reach billboard did not render');
       return total/count;
     };
     const near=centroid();
     reach.reachDistance.value=1.3;
     const far=centroid();
     if(far-near<15)throw Error('GPU reach billboard did not follow attack distance');
     marker.visible=false;
     const projectileView=createEnemyProjectileView(scene);
     const shot={x:-.6,z:0,height:.5,heading:0,radius:.15,color:'#ff0000'};
     const shots=Array.from({length:40},(_,i)=>i%2?{...shot,x:.6,color:'#00ff00'}:shot);
     projectileView.update({enemyProjectiles:shots,enemyTime:.4});
     if(projectileView.root.children.length!==2||projectileView.root.children.some(mesh=>mesh.count!==40))throw Error('GPU projectile batching did not grow');
     renderer.render(scene,camera);
     const shotPixels=new Uint8Array(128*128*4);
     renderer.readRenderTargetPixels(target,0,0,128,128,shotPixels);
     let red=0,green=0;
     for(let i=0;i<shotPixels.length;i+=4){
       if(shotPixels[i]>50&&shotPixels[i+1]<20)red++;
       if(shotPixels[i+1]>50&&shotPixels[i]<20)green++;
     }
     projectileView.update({enemyProjectiles:[],enemyTime:.5});
     if(red<10||green<10||countLit(4)!==0)throw Error('GPU projectile rendering or clearing failed');
     const waveView=createWaveView(scene);
     const flight={x:.55,z:0,yMin:.45,yMax:.75,range:3,travel:1};
     const chargeBattle={time:.6,counterCharge:true,counterChargeElapsed:1.04,player:{health:100},waves:[flight]};
     waveView.update(chargeBattle,hand,0);
     const chargedPixels=countLit(4);
     if(!chargeBattle.counterOrbOrigin||waveView.root.children[0].count!==6||chargedPixels<10)throw Error('GPU charge and wave did not render together');
     chargeBattle.counterCharge=null;
     waveView.update(chargeBattle,hand,0);
     const flightPixels=countLit(4);
     if(chargeBattle.counterOrbOrigin||waveView.root.children[0].count!==3||flightPixels<10)throw Error('GPU charge cancellation removed or obscured the flying wave');
     flight.travel=flight.range;
     waveView.update(chargeBattle,hand,0);
     if(countLit(4)!==0)throw Error('GPU wave did not fade at maximum range');
     const hands=new T.Group();
     for(const [name,x] of [['handL',-.35],['handR',.35]]){
       const hand=new T.Object3D();hand.name=name;hand.position.set(x,1,0);hands.add(hand);
     }
     const wind=createFistWindEffects(scene,hands);
     const windBattle={time:1,player:{health:100,fistwindUntil:2}};
     wind.update(windBattle,[],.016);
     const handMist=countLit(1);
     windBattle.time=3;
     wind.update(windBattle,[{type:'windShot',hand:0,heading:Math.PI/2,range:1,x:0,z:0}],.08);
     const shotMist=countLit(1);
     wind.update(windBattle,[],.12);
     if(handMist<5||shotMist<5||countLit(1)!==0)throw Error('GPU fist wind rendering or expiry failed: '+handMist+', '+shotMist);
     const actor=new T.Group(),rig=new T.Group();
     scene.add(actor);actor.add(rig);
     const upper=new T.Bone(),forearm=new T.Bone(),rightHand=new T.Bone();
     upper.name='upper_armR';forearm.name='forearmR';rightHand.name='handR';
     forearm.position.y=-.3;rightHand.position.y=-.3;
     rig.add(upper);upper.add(forearm);forearm.add(rightHand);
     const goldMaterial=new T.MeshStandardMaterial({color:'#000000',emissive:'#000000'});
     const goldPanel=new T.Mesh(new T.PlaneGeometry(.6,.6),goldMaterial);
     goldPanel.rotation.x=-Math.PI/2;rig.add(goldPanel);
     const absorption=createEnergyAbsorption(scene);
     absorption.bind(rig,actor);
     const beforeGlow=countLit(4);
     absorption.update(.8);
     absorption.light.visible=false;
     absorption.rain.visible=false;
     const duringGlow=countLit(4);
     absorption.clear();
     if(beforeGlow!==0||duringGlow<10||countLit(4)!==0||goldMaterial.emissive.getHex()!==0)throw Error('GPU energy absorption glow or reset failed');
     const fadeScene=new T.Scene();
     const fade=createCameraOcclusion(fadeScene);
     const fadeGeometry=new T.PlaneGeometry(.5,.5).rotateX(-Math.PI/2);
     const fadeMaterial=new T.MeshBasicMaterial({color:'#ffffff'});
     const regular=new T.Mesh(fadeGeometry,fadeMaterial);
     regular.position.x=-.7;
     const instances=new T.InstancedMesh(fadeGeometry,fadeMaterial,2);
     instances.setMatrixAt(0,new T.Matrix4());
     instances.setMatrixAt(1,new T.Matrix4().makeTranslation(.7,0,0));
     fadeScene.add(regular,instances);
     const fadePixels=()=>{
       renderer.render(fadeScene,camera);
       return [-.7,0,.7].map(x=>{
         const p=new T.Vector3(x,0,0).project(camera);
         const pixel=new Uint8Array(4);
         renderer.readRenderTargetPixels(target,Math.floor((p.x*.5+.5)*128),Math.floor((p.y*.5+.5)*128),1,1,pixel);
         return pixel[0];
       });
     };
     const visible=fadePixels();
     const anchor={x:10,y:0,z:10};
     fade.update(camera,anchor,.05,new Map([[regular,new Set([0])],[instances,new Set([0])]]));
     const hidden=fadePixels();
     fade.update(camera,anchor,.05);
     const fadeRanges=instances.geometry.attributes.cameraFade.updateRanges;
     if(fadeRanges.length!==1||fadeRanges[0].start!==0||fadeRanges[0].count!==3)
       throw Error('GPU scenery fade must upload only the changed instance');
     const recovering=fadePixels();
     fade.update(camera,anchor,.35);
     const restored=fadePixels();
     const holdFirst=new Map([[instances,new Set([0])]]);
     const holdSecond=new Map([[instances,new Set([1])]]);
     fade.update(camera,anchor,.05,holdFirst);
     const firstHidden=fadePixels();
     fade.update(camera,anchor,.05,holdSecond);
     const switched=fadePixels();
     fade.update(camera,anchor,.35,holdSecond);
     const firstRestored=fadePixels();
     if(firstHidden[1]>4||firstHidden[2]!==visible[2]||
       switched[1]<=4||switched[1]>=visible[1]||switched[2]>4||
       firstRestored[1]!==visible[1]||firstRestored[2]>4)
       throw Error('GPU scenery fade staggered instances: '+JSON.stringify({firstHidden,switched,firstRestored}));
     fade.clear();
     fade.update(camera,anchor,.05,holdFirst);
     const reused=fadePixels();
     if(reused[1]>4||reused[2]!==visible[2])
       throw Error('GPU scenery fade cache retained a cleared instance: '+reused);
     fade.clear();
     const shaderFadeMaterial=new T.ShaderMaterial({
       vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
       fragmentShader:\`void main(){
         gl_FragColor=vec4(1.);
         #include <tonemapping_fragment>
         #include <colorspace_fragment>
       }\`,
     });
     const shaderInstances=new T.InstancedMesh(fadeGeometry,shaderFadeMaterial,2);
     shaderInstances.setMatrixAt(0,new T.Matrix4());
     shaderInstances.setMatrixAt(1,new T.Matrix4().makeTranslation(.7,0,0));
     fadeScene.remove(instances);
     fadeScene.add(shaderInstances);
     const shaderFade=createCameraOcclusion(fadeScene);
     const shaderVisible=fadePixels();
     shaderFade.update(camera,anchor,.05,new Map([[shaderInstances,new Set([0])]]));
     const shaderHidden=fadePixels();
     shaderFade.update(camera,anchor,.05);
     const shaderRecovering=fadePixels();
     shaderFade.update(camera,anchor,.35);
     const shaderRestored=fadePixels();
     shaderFade.clear();
     shaderFadeMaterial.dispose();shaderInstances.dispose();
     if(shaderVisible[1]<100||shaderHidden[1]>4||
       shaderRecovering[1]<=shaderHidden[1]||shaderRecovering[1]>=shaderVisible[1]||
       shaderRestored.some((value,i)=>value!==shaderVisible[i])||
       shaderHidden[2]!==shaderVisible[2]||shaderRecovering[2]!==shaderVisible[2])
       throw Error('GPU shader scenery fade: '+JSON.stringify({shaderVisible,shaderHidden,shaderRecovering,shaderRestored}));
     fadeGeometry.dispose();fadeMaterial.dispose();instances.dispose();
     if(visible.some(v=>v<100)||hidden[0]>4||hidden[1]>4||hidden[2]!==visible[2]||
       recovering.slice(0,2).some((v,i)=>v<=hidden[i]||v>=visible[i])||
       restored.some((v,i)=>v!==visible[i]))throw Error('GPU scenery fade pixels: '+JSON.stringify({visible,hidden,recovering,restored}));
     camera.position.set(0,1.5,4);camera.up.set(0,1,0);camera.lookAt(0,.5,0);
     const flame=createFlames(scene,{count:12});
     const zone=[{x:0,z:0,until:2}];
     flame.update(true,1,1,zone);
     const wetFlame=countLit(4);
     flame.update(true,3,1,zone);
     const dryFlame=countLit(4);
     flame.update(false,3);
     if(wetFlame!==0||dryFlame<10||countLit(4)!==0)throw Error('GPU flame or water clipping failed: '+wetFlame+', '+dryFlame);
     actor.visible=false;
     const shellbug=createMonsterEffects('shellbug');
     scene.add(shellbug.root,new T.AmbientLight(0xffffff,4));
     camera.position.set(0,5,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);
     const spikeEnemy={state:'windup',move:{motion:'spikes',reach:1.6},telegraph:.6,swingDuration:.3,elapsed:0};
     shellbug.animate(spikeEnemy,0,0,0,0);
     const startingSpikes=countLit(4);
     spikeEnemy.state='recover';
     shellbug.animate(spikeEnemy,1,1,1,0);
     const extendedSpikes=countLit(4);
     spikeEnemy.state='idle';
     shellbug.animate(spikeEnemy,2,0,0,0);
     for(const [id,name,move] of [
       ['lantern','lantern_attack_pulse',{kind:'melee',reach:1.8}],
       ['stonekeeper','stonekeeper_quake_effect',{motion:'quake',reach:1.8}],
     ]){
       const fx=createMonsterEffects(id);
       scene.add(fx.root);
       const ring=fx.root.getObjectByName(name);
       const enemy={state:'windup',elapsed:0,windup:1,move};
       const sample=strike=>{
         fx.animate(enemy,0,1,strike,0);
         for(const child of fx.root.children)if(child!==ring)child.visible=false;
         return countLit(4);
       };
       const small=sample(0);
       enemy.elapsed=1;
       const large=sample(1);
       if(id==='stonekeeper'){
         enemy.state='recover';enemy.elapsed=0;
         const bright=sample(1);
         enemy.elapsed=.4;
         const fading=sample(1);
         if(fading<=0||fading>=bright)throw Error('GPU quake fade pixels: '+[bright,fading]);
       }
       enemy.state='idle';
       const cleared=sample(0);
       fx.root.removeFromParent();
       if(small<8||large<=small*2||cleared!==0)throw Error(id+' GPU ring pixels: '+[small,large,cleared]);
     }
     const lanternGlow=createMonsterEffects('lantern');
     scene.add(lanternGlow.root);
     const glow=lanternGlow.root.getObjectByName('lantern_charge_glow');
     const glowEnemy={state:'windup',elapsed:0,windup:1,move:{kind:'buff'}};
     const sampleGlow=(prep,recover)=>{
       lanternGlow.animate(glowEnemy,0,prep,0,recover);
       for(const child of lanternGlow.root.children)if(child!==glow)child.visible=false;
       return countLit(4);
     };
     const glowStart=sampleGlow(0,0),glowCharged=sampleGlow(1,0);
     glowEnemy.state='recover';
     const glowEnd=sampleGlow(1,1);
     lanternGlow.root.removeFromParent();
     if(glowStart<=0||glowCharged<=glowStart||glowEnd!==0)throw Error('GPU lantern glow pixels: '+[glowStart,glowCharged,glowEnd]);
     const spitter=createMonsterEffects('spitter');
     scene.add(spitter.root);
     camera.position.set(0,.9,4);camera.up.set(0,1,0);camera.lookAt(0,.9,.65);
     const spitterEnemy={state:'windup',elapsed:0,move:{motion:'shoot'}};
     const muzzlePixels=(prep,recover)=>{
       spitter.animate(spitterEnemy,0,prep,0,recover);
       return countLit(4);
     };
     const muzzleStart=muzzlePixels(0,0),muzzleCharged=muzzlePixels(1,0);
     spitterEnemy.state='recover';spitterEnemy.elapsed=.1;
     const muzzleFading=muzzlePixels(1,.75);
     spitterEnemy.elapsed=.15;
     const muzzleEnd=muzzlePixels(1,.75);
     spitter.root.removeFromParent();
     camera.position.set(0,5,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);
     if(muzzleStart<=0||muzzleCharged<=muzzleStart||muzzleFading<=0||muzzleFading>=muzzleCharged||muzzleEnd!==0)
       throw Error('GPU spitter muzzle pixels: '+[muzzleStart,muzzleCharged,muzzleFading,muzzleEnd]);
     const boilerEffects=createMonsterEffects('cinderWarden');
     scene.add(boilerEffects.root);
     const fireGround=boilerEffects.root.getObjectByName('boiler_fire_ring_ground');
     const boiler={state:'idle',health:1,activeAura:true,x:0,z:0,waterZones:[]};
     const fireGroundPixels=time=>{
       boilerEffects.animate(boiler,time,0,0,0);
       for(const child of boilerEffects.root.children)if(child!==fireGround)child.visible=false;
       return countLit(4);
     };
     const dryRing=fireGroundPixels(1);
     boiler.waterZones=[{x:6,z:0,until:2}];
     const outsideRing=fireGroundPixels(1);
     boiler.waterZones[0].x=5.9;
     const wetRing=fireGroundPixels(1);
     const expiredWaterRing=fireGroundPixels(2);
     const breath=boilerEffects.root.getObjectByName('boiler_breath_flow');
     boiler.state='windup';boiler.move={kind:'channel'};boiler.telegraph=2;
     camera.position.set(0,5,2);camera.lookAt(0,0,2);
     const breathPixels=()=>{
       boilerEffects.animate(boiler,1,0,0,0);
       for(const child of boilerEffects.root.children)if(child!==breath)child.visible=false;
       return countLit(4);
     };
     boiler.elapsed=1;boiler.waterZones=[];
     const breathReady=breathPixels();
     boiler.elapsed=2;
     let callsBeforeBreath,breathCalls;
     breath.onBeforeRender=()=>{callsBeforeBreath=renderer.info.render.calls;};
     breath.onAfterRender=()=>{breathCalls=renderer.info.render.calls-callsBeforeBreath;};
     const breathDry=breathPixels();
     boiler.waterZones=[{x:0,z:2,until:2}];
     const breathWet=breathPixels();
     boilerEffects.root.removeFromParent();
     camera.position.set(0,5,0);camera.lookAt(0,0,0);
     if(dryRing<=0||outsideRing!==dryRing||wetRing!==0||expiredWaterRing!==dryRing)
       throw Error('GPU ground fire water clip: '+[dryRing,outsideRing,wetRing,expiredWaterRing]);
     if(!breath.isInstancedMesh||breath.count!==3||breathCalls!==1||breathReady!==0||breathDry<=0||breathWet>=breathDry)
       throw Error('GPU breath batch: '+[breathCalls,breathReady,breathDry,breathWet]);
     for(const [id,name,move] of [
       ['lantern','lantern_embers',{kind:'buff'}],
       ['stonekeeper','stonekeeper_ground_debris',{motion:'quake',reach:1.2}],
     ]){
       const fx=createMonsterEffects(id);
       scene.add(fx.root);
       const motes=fx.root.getObjectByName(name);
       const enemy={state:'windup',elapsed:0,windup:1,move};
       const sample=()=>{
         fx.animate(enemy,0,1,.5,0);
         for(const child of fx.root.children)if(child!==motes)child.visible=false;
         countLit(0);
         const pixels=new Uint8Array(128*128*4);
         renderer.readRenderTargetPixels(target,0,0,128,128,pixels);
         let brightness=0,radius=0;
         for(let i=0;i<128*128;i++){
           const red=pixels[i*4];
           brightness+=red;
           if(red>4)radius=Math.max(radius,Math.hypot(i%128-63.5,Math.floor(i/128)-63.5));
         }
         return {brightness,radius};
       };
       const spread=sample();
       if(id==='stonekeeper')enemy.move.reach=.3;
       else enemy.move.kind='melee';
       const compact=sample();
       enemy.state='idle';
       const idle=sample();
       fx.root.removeFromParent();
       if(compact.brightness<=0||spread.radius<=compact.radius||idle.brightness!==0)
         throw Error(id+' GPU motes: '+JSON.stringify({spread,compact,idle}));
     }
     if(extendedSpikes<40||extendedSpikes<=startingSpikes*2||countLit(4)!==0)throw Error('GPU spike extension failed: '+startingSpikes+', '+extendedSpikes);
     const impact=createImpactRing();
     scene.add(impact.mesh);
     const measureImpact=age=>{
       impact.update(age);
       renderer.render(scene,camera);
       const pixels=new Uint8Array(128*128*4);
       renderer.readRenderTargetPixels(target,0,0,128,128,pixels);
       let radius=0,peak=0;
       for(let i=0;i<pixels.length;i+=4){
         peak=Math.max(peak,pixels[i]);
         if(pixels[i]>4)radius=Math.max(radius,Math.hypot((i/4)%128-63.5,Math.floor(i/512)-63.5));
       }
       return {radius,peak};
     };
     const early=measureImpact(.05),late=measureImpact(.3),expired=measureImpact(.46);
     if(early.peak<10||late.radius<early.radius*1.5||late.peak>=early.peak||expired.peak!==0)throw Error('GPU impact ring pixels: '+JSON.stringify({early,late,expired}));
     const skillPlayer=new T.Group(),skillModel=new T.Group();
     skillPlayer.add(skillModel);
     const skills=createSkillEffects(scene,skillModel,skillPlayer,document,{});
     const skillBattle={time:0,player:{health:1}};
     skills.update(skillBattle,camera,[{type:'skillStarted',id:'longarm'}],null,null,false);
     const skillIcon=scene.getObjectByName('技能激活图标');
     const texture=skillIcon.material.uniforms.iconMap.value;
     for(let i=0;i<100&&!texture.image;i++)await new Promise(resolve=>setTimeout(resolve,20));
     if(!texture.image)throw Error('GPU skill icon texture did not load');
     skillBattle.time=.4;
     skills.update(skillBattle,camera,[],null,null,false);
     const skillPixels=countLit(2);
     skills.clear();
     if(skillPixels<2||countLit(2)!==0)throw Error('GPU skill icon rendering or clearing failed: '+skillPixels);
     const damageBattle=new Battle();
     Object.assign(damageBattle.enemy,{x:0,z:0});
     const hud=createBattleHUD(document,scene);
     hud.update(damageBattle,[{type:'enemyHit',damage:12},{type:'enemyHit',damage:8}]);
     hud.updateTarget(damageBattle,camera);
     const damageLabel=scene.getObjectByName('战斗伤害数字');
     const digits=damageLabel.geometry.getAttribute('digit');
     const damagePixels=countLit(2);
     damageBattle.time=3.1;
     hud.updateTarget(damageBattle,camera);
     if(damageLabel.count!==2||digits.getX(0)!==2||digits.getX(1)!==0||damagePixels<2||countLit(2)!==0)throw Error('GPU damage label did not render and expire correctly');
     hud.clearEffects();
     return {samuraiPhases:[2,3],ribbonPixels,skyBolt:{boltStart,boltFade,boltEnd},groundTelegraph:{groundEarly,groundCharged,groundHit,groundFade,groundEnd},perfectGuard:true,bladeTrail:true,skinnedMirror:true,gpuFloor,gpuFloorShift,floorComparison,healthBar:{full,half},dazeStars:true,attackSector:{shortSector,longSector},wirePixels,reachBillboard:{near,far},projectiles:{instances:40,red,green},wave:{chargedPixels,flightPixels},fistWind:{handMist,shotMist},absorptionGlow:duringGlow,sceneryFade:{visible,hidden,recovering,restored},flame:{wetFlame,dryFlame},spikes:{startingSpikes,extendedSpikes},impactRing:{early,late,expired},skillPixels,damagePixels};
   }finally{
     renderer.setRenderTarget(previous);target.dispose();
     const resources=new Set();
     scene.traverse(o=>{
       if(o.geometry)resources.add(o.geometry);
       for(const material of Array.isArray(o.material)?o.material:[o.material])if(material)resources.add(material);
       o.dispose?.();
     });
     for(const resource of resources)resource.dispose?.();
   }
 })()`);
 await new Promise(r=>setTimeout(r,200));await fs.writeFile('output/foundry-visual-check.json',JSON.stringify({startup,errors,gpu,gpuEffects,combined,...report},null,2));
 app.exit(startup.ready&&errors.length===0?0:1);
 }catch(error){
   await fs.writeFile('output/foundry-visual-check.json',JSON.stringify({errors,error:error.stack},null,2));
   app.exit(1);
 }
});

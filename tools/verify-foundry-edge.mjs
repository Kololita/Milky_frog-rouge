import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {gzipSync} from 'node:zlib';

const wait = ms => new Promise(done => setTimeout(done,ms));
const edge = process.env.NAIWA_EDGE_PATH ??
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const url = process.env.NAIWA_EDGE_URL ?? 'http://127.0.0.1:5173/?profile';
const output = process.env.NAIWA_EDGE_REPORT ?? 'output/foundry-edge.json';
const startupOnly = process.argv.includes('--startup-only');
const traceStartup = startupOnly && process.argv.includes('--trace-startup');
const checkProgress = process.argv.includes('--check-progress');
const checkEffects = process.argv.includes('--check-effects');
const checkPooledEffects = process.argv.includes('--check-pooled-effects');
const checkScenes = process.argv.includes('--check-scenes');
const checkMovement = process.argv.includes('--check-movement');
const checkStonekeeper = process.argv.includes('--check-stonekeeper');
const checkBattleEscape = process.argv.includes('--check-battle-escape');
const bakeReflections = process.argv.includes('--bake-reflections');
const checkReflections = process.argv.includes('--check-reflections');
const missingReflection = process.argv.includes('--missing-reflection');
const checkHitAnimations = process.argv.includes('--check-hit-animations');
const checkPostPixels = process.argv.includes('--check-post-pixels');
const missingHitAnimations = process.argv.includes('--missing-hit-animations');
const noParallelCompile = process.argv.includes('--no-parallel-compile');
const logicalCores = Number(process.env.NAIWA_VERIFY_CORES) || 0;
const profileDir = resolve('output/edge-foundry-' + Date.now());
await mkdir(profileDir,{recursive:true});
const child = spawn(edge,['--headless=new','--remote-debugging-port=0','--no-first-run','--no-proxy-server',
  '--window-size=1280,800',`--user-data-dir=${profileDir}`,'about:blank'],
{windowsHide:true,stdio:'ignore'});
let launchError;
child.on('error',error=>{launchError=error;});
const errors = [];
let socket, readiness, traceStream;

async function until(check,timeout=60000) {
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    if(launchError)throw launchError;
    const result=await check();
    if(result)return result;
    await wait(200);
  }
  throw Error('Edge verification timed out');
}

try {
  const port=await until(async()=>{
    try{return Number((await readFile(resolve(profileDir,'DevToolsActivePort'),'utf8')).split('\n')[0]);}
    catch{return 0;}
  },15000);
  const pages=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
  await new Promise((accept,reject)=>{
    socket.addEventListener('open',accept,{once:true});
    socket.addEventListener('error',reject,{once:true});
  });
  const pending=new Map();
  let requestId=0;
  socket.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    const request=pending.get(message.id);
    if(request){
      pending.delete(message.id);
      clearTimeout(request.timer);
      if(message.error)request.reject(Error(message.error.message));
      else request.accept(message.result);
    }else if(message.method==='Tracing.tracingComplete'){
      traceStream=message.params.stream;
    }else if(message.method==='Runtime.exceptionThrown'){
      errors.push(message.params.exceptionDetails.exception?.description??message.params.exceptionDetails.text);
    }else if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error'){
      errors.push(message.params.args.map(arg=>arg.value??arg.description).join(' '));
    }
  });
  function send(method,params={}){
    return new Promise((accept,reject)=>{
      const id=++requestId;
      const timer=setTimeout(()=>{
        pending.delete(id);
        reject(Error(method+' timed out'));
      },65000);
      pending.set(id,{accept,reject,timer});
      socket.send(JSON.stringify({id,method,params}));
    });
  }
  async function evaluate(expression){
    const response=await send('Runtime.evaluate',{expression,returnByValue:true});
    if(response.exceptionDetails)throw Error(response.exceptionDetails.exception?.description);
    return response.result.value;
  }
  await send('Runtime.enable');
  await send('Performance.enable');
  if(startupOnly||missingReflection||missingHitAnimations||noParallelCompile||logicalCores)await send('Page.enable');
  if(logicalCores){
    await send('Page.addScriptToEvaluateOnNewDocument',{source:
      `Object.defineProperty(navigator,'hardwareConcurrency',{value:${logicalCores}})`});
  }
  if(noParallelCompile){
    await send('Page.addScriptToEvaluateOnNewDocument',{source:`{
      const proto=WebGL2RenderingContext.prototype;
      const getExtension=proto.getExtension;
      proto.getExtension=function(name){
        return name==='KHR_parallel_shader_compile'?null:getExtension.call(this,name);
      };
    }`});
  }
  if(missingReflection||missingHitAnimations){
    const missingAsset=missingReflection?'/foundry/probe-':'/animations/frog-hit-poses.json.gz';
    await send('Page.addScriptToEvaluateOnNewDocument',{source:`{
      const fetchAsset=window.fetch;
      window.fetch=(url,...args)=>typeof url==='string'&&url.includes(${JSON.stringify(missingAsset)})
        ? Promise.resolve(new Response(null,{status:404})) : fetchAsset(url,...args);
    }`});
  }
  if(startupOnly){
    await send('Page.addScriptToEvaluateOnNewDocument',{source:`{
      performance.mark('naiwa-navigation-script');
      const tasks=[];
      const observer=new PerformanceObserver(list=>tasks.push(...list.getEntries()));
      observer.observe({type:'longtask',buffered:true});
      window.measureStartup=()=>{
        tasks.push(...observer.takeRecords());
        observer.disconnect();
        const gl=document.getElementById('scene').getContext('webgl2');
        return {
          adapter:window.naiwaProfile.snapshot().renderer,
          foundryReflection:window.naiwaProfile.foundryReflection(),
          foundryCompileBatches:window.naiwaProfile.foundryCompileBatches(),
          foundryPreviewPasses:window.naiwaProfile.foundryPreviewPasses(),
          bakedHitClips:window.naiwaProfile.bakedHitClips,
          parallelShaderCompile:Boolean(gl.getExtension('KHR_parallel_shader_compile')),
          logicalCores:navigator.hardwareConcurrency,
          longTasks:tasks.map(({startTime,duration})=>({startTime,duration})),
        };
      };
    }`});
  }
  if(traceStartup){
    await send('Tracing.start',{transferMode:'ReturnAsStream',traceConfig:{
      includedCategories:['devtools.timeline','blink.user_timing','toplevel','v8','gpu'],
    }});
  }
  const navigation=await send('Page.navigate',{url});
  if(navigation.errorText)throw Error(navigation.errorText);
  await until(async()=>{
    readiness=await evaluate(`({url:location.href,title:document.title,state:document.readyState,
      status:document.getElementById('startup-status')?.textContent,
      ready:document.getElementById('home-practice')?.disabled===false})`);
    if(readiness?.status?.includes('失败'))throw Error(readiness.status);
    return readiness?.ready;
  },90000);
  const startupMs=await evaluate('performance.now()');
  const startupMetrics=Object.fromEntries((await send('Performance.getMetrics')).metrics
    .filter(({name})=>['TaskDuration','ScriptDuration','V8CompileDuration'].includes(name))
    .map(({name,value})=>[name,value]));
  const progress=checkProgress?await evaluate('window.naiwaProfile.startupProgress()'):undefined;
  const phases=checkProgress?await evaluate('window.naiwaProfile.startupPhases?.()'):undefined;
  if(checkProgress){
    assert.equal(progress[0],0);
    assert.equal(progress.at(-1),100);
    assert(progress.every((value,index)=>!index||value>=progress[index-1]));
    assert(new Set(progress).size>=10);
    assert.equal(await evaluate("document.getElementById('startup-loading')===null"),true);
  }
  if(traceStartup){
    await send('Tracing.end');
    const handle=await until(()=>traceStream,10000);
    const chunks=[];
    try{
      for(;;){
        const {data,base64Encoded,eof}=await send('IO.read',{handle});
        chunks.push(Buffer.from(data,base64Encoded?'base64':'utf8'));
        if(eof)break;
      }
    }finally{await send('IO.close',{handle});}
    await writeFile(output+'.trace.json.gz',gzipSync(Buffer.concat(chunks)));
  }
  if(bakeReflections){
    const results=[];
    for(const tier of ['low','medium','high']){
      const response=await send('Runtime.evaluate',{expression:`(async()=>{
        const half=await window.naiwaProfile.bakeFoundryReflection('${tier}');
        const bytes=new Uint8Array(half.buffer);
        let binary='';
        for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
        return btoa(binary);
      })()`,awaitPromise:true,returnByValue:true});
      if(response.exceptionDetails)throw Error(response.exceptionDetails.exception?.description);
      const data=Buffer.from(response.result.value,'base64');
      assert.equal(data.length,256*256*6*8);
      const faceLength=data.length/6;
      for(let offset=0;offset<data.length;offset+=faceLength){
        const face=data.subarray(offset,offset+faceLength);
        assert(new Set(new Uint16Array(face.buffer,face.byteOffset,face.byteLength/2)).size>32);
      }
      const compressed=gzipSync(data);
      const path=`output/foundry-probe-${tier}.bin.gz`;
      await writeFile(path,compressed);
      results.push({tier,path,bytes:compressed.length});
    }
    assert.deepEqual(errors,[]);
    await writeFile(output,JSON.stringify({startupMs,results,errors},null,2));
  }else if(checkPostPixels){
    const response=await send('Runtime.evaluate',{expression:`(async()=>{
      const T=await import('/node_modules/three/build/three.module.js');
      const {createFoundryPost}=await import('/src/foundry-post.js');
      const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});
      renderer.setSize(96,96,false);
      renderer.toneMapping=T.ACESFilmicToneMapping;
      const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,.1,4);
      camera.position.z=2;
      const light=new T.Mesh(new T.PlaneGeometry(.34,.34),new T.MeshBasicMaterial({color:new T.Color(8,4,3)}));
      scene.add(light);
      const post=createFoundryPost(renderer,scene,camera);
      if(!post.preparePost)throw Error('HDR is required for the postprocessing pixel check');
      const gl=renderer.getContext();
      function image(){
        post.render(true);
        const pixels=new Uint8Array(96*96*4);
        gl.readPixels(0,0,96,96,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        return pixels;
      }
      try{
        const cold=image();
        await post.preparePost();
        const warm=image();
        post.setBloomEnabled(false);
        const plain=image();
        let changed=0,bloomPixels=0;
        for(let i=0;i<warm.length;i++){
          if(warm[i]!==cold[i])changed++;
          if(i%4===0&&warm[i]>plain[i])bloomPixels++;
        }
        return {changed,bloomPixels,pixels:96*96};
      }finally{
        post.dispose();light.geometry.dispose();light.material.dispose();renderer.dispose();
      }
    })()`,awaitPromise:true,returnByValue:true});
    if(response.exceptionDetails)throw Error(response.exceptionDetails.exception?.description);
    const postPixels=response.result.value;
    assert.equal(postPixels.changed,0);
    assert(postPixels.bloomPixels>100);
    assert.deepEqual(errors,[]);
    await writeFile(output,JSON.stringify({startupMs,postPixels,errors},null,2));
  }else if(checkHitAnimations){
    const response=await send('Runtime.evaluate',{expression:`(async()=>{
      const {FROG_HIT_ANIMATION_URL,loadAnimatedModel}=await import('/src/assets.js');
      const url='/models/characters/frog.glb?v=welded-lip-2';
      const fresh=await loadAnimatedModel(url);
      const baked=await loadAnimatedModel(url,FROG_HIT_ANIMATION_URL);
      const clips=[];
      for(const name of ['HitRecoil','HitSit','HitLaunch']){
        const a=fresh.actions[name].getClip(),b=baked.actions[name].getClip();
        let maxDelta=0, samples=0;
        if(a.duration!==b.duration||a.tracks.length!==b.tracks.length)throw Error(name+' has different tracks or duration');
        for(let i=0;i<a.tracks.length;i++){
          const x=a.tracks[i],y=b.tracks[i];
          if(x.name!==y.name||x.getInterpolation()!==y.getInterpolation()||x.times.length!==y.times.length||x.values.length!==y.values.length)
            throw Error(name+' has a different track layout');
          for(let j=0;j<x.times.length;j++)if(x.times[j]!==y.times[j])throw Error(name+' changed a keyframe time');
          for(let j=0;j<x.values.length;j++)maxDelta=Math.max(maxDelta,Math.abs(x.values[j]-y.values[j]));
          samples+=x.values.length;
        }
        clips.push({name, tracks:a.tracks.length, samples, maxDelta});
      }
      return {fresh:fresh.bakedHitClips,baked:baked.bakedHitClips,clips};
    })()`,awaitPromise:true,returnByValue:true});
    if(response.exceptionDetails)throw Error(response.exceptionDetails.exception?.description);
    const hitAnimations=response.result.value;
    assert.equal(hitAnimations.fresh,false);
    assert.equal(hitAnimations.baked,true);
    assert(hitAnimations.clips.every(clip=>clip.maxDelta<1e-6));
    assert.deepEqual(errors,[]);
    await writeFile(output,JSON.stringify({startupMs,hitAnimations,errors},null,2));
  }else if(checkReflections){
    const response=await send('Runtime.evaluate',{expression:`(async()=>{
      const profile=window.naiwaProfile;
      const change=(key,value)=>{
        const control=document.querySelector('[data-setting='+key+']');
        control.value=value;
        control.dispatchEvent(new Event('change',{bubbles:true}));
      };
      const select=async(lighting,quality,size)=>{
        change('lightingQuality',lighting);
        change('reflectionQuality',quality);
        const deadline=performance.now()+15000;
        while(profile.foundryReflection().key!==lighting+':'+size){
          if(performance.now()>deadline)throw Error('Reflection setting did not take effect');
          await new Promise(requestAnimationFrame);
        }
        const info=profile.foundryReflection();
        const pixels=await profile.readFoundryReflection();
        const colors=new Set();
        for(let i=0;i<pixels.length;i+=64)colors.add(pixels[i]);
        return {...info,values:pixels.length,colors:colors.size,textures:profile.snapshot().summary.textures.p50};
      };
      const actual=await profile.readFoundryReflection();
      const raw=await fetch('/textures/foundry/probe-high.bin.gz');
      const buffer=raw.headers.get('Content-Encoding')?.includes('gzip')?await raw.arrayBuffer()
        :await new Response(raw.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      const expected=new Uint16Array(buffer);
      let differences=0,maxDifference=0;
      for(let i=0;i<expected.length;i++){
        const distance=Math.abs(actual[i]-expected[i]);
        if(distance>0)differences++;
        maxDifference=Math.max(maxDifference,distance);
      }
      profile.start('cinderWarden');
      const settings=[];
      for(const [lighting,quality,size] of [['low','low',64],['medium','medium',128],['high','high',256],
        ['low','high',256],['high','low',64],['high','high',256]]){
        profile.reset();
        settings.push(await select(lighting,quality,size));
      }
      return {settings,values:actual.length,differences,maxDifference};
    })()`,awaitPromise:true,returnByValue:true});
    if(response.exceptionDetails)throw Error(response.exceptionDetails.exception?.description);
    const reflections=response.result.value;
    assert.equal(reflections.values,256*256*6*4);
    assert(reflections.maxDifference<=1);
    assert(reflections.settings.every(report=>report.source==='baked'&&report.filtered&&report.colors>32));
    assert.deepEqual(errors,[]);
    await writeFile(output,JSON.stringify({startupMs,reflections,errors},null,2));
  }else if(startupOnly){
    const warmup=await evaluate("document.querySelector('#scene').dataset.warmup");
    const startup=await evaluate('window.measureStartup()');
    if(missingReflection)assert.equal(startup.foundryReflection.source,'capture');
    if(missingHitAnimations)assert.equal(startup.bakedHitClips,false);
    if(noParallelCompile)assert.equal(startup.parallelShaderCompile,false);
    assert.deepEqual(errors,[]);
    await writeFile(output,JSON.stringify({url,startupMs,startupMetrics,warmup,progress,phases,...startup,errors},null,2));
  }else if(checkMovement){
    const response=await send('Runtime.evaluate',{expression:`(async()=>{
      const profile=window.naiwaProfile;
      const key=(code,down)=>window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,bubbles:true,cancelable:true}));
      const after=async ms=>{
        const end=performance.now()+ms;
        do{await new Promise(requestAnimationFrame);}while(performance.now()<end);
        return profile.movementState();
      };
      profile.start('practice');
      key('KeyW',true);await after(235);
      key('ShiftLeft',true);
      const early=await after(40),late=await after(75),full=await after(125);
      key('ShiftLeft',false);
      const longRelease=profile.movementState();
      profile.start('practice');
      key('KeyW',true);await after(235);
      key('ShiftLeft',true);await after(95);key('ShiftLeft',false);
      const movingTap=profile.movementState();
      profile.start('practice');
      key('KeyW',true);key('ShiftRight',true);
      const startupRamp=await after(239);
      key('ShiftRight',false);
      const startupTap=profile.movementState();
      profile.start('practice');
      key('ShiftRight',true);const stationary=await after(90);key('ShiftRight',false);
      const stationaryTap=profile.movementState();
      profile.start('cinderWarden');
      const spawn=profile.movementState();
      await after(40);
      return {early,late,full,longRelease,movingTap,startupRamp,startupTap,stationary,stationaryTap,spawn};
    })()`,awaitPromise:true,returnByValue:true});
    if(response.exceptionDetails)throw Error(response.exceptionDetails.exception?.description);
    const result=response.result.value;
    assert(result.early.velocity>1.2&&result.early.velocity<result.late.velocity);
    assert(result.late.velocity<2.8);
    assert(Math.abs(result.full.velocity-2.8)<1e-6);
    assert.equal(result.full.action,'Run');
    assert(!result.longRelease.dodge);
    assert(result.movingTap.dodge&&result.startupTap.dodge&&result.stationaryTap.dodge);
    assert(result.startupRamp.velocity>1.2&&result.startupRamp.velocity<2.8);
    assert.equal(result.startupRamp.action,'Walk');
    assert.equal(result.stationary.velocity,0);
    assert.deepEqual(result.spawn.player,{x:7,z:-3});
    assert.equal(result.spawn.enemy.x,0);
    assert.equal(result.spawn.enemy.z,0);
    assert.equal(result.spawn.yaw,result.spawn.heading);
    assert(Math.abs(result.spawn.heading-Math.atan2(-7,3))<1e-9);
    assert(Math.abs(result.spawn.enemy.heading-Math.atan2(7,-3))<1e-9);
    assert.deepEqual(errors,[]);
    await writeFile(output,JSON.stringify({startupMs,movement:result,errors},null,2));
  }else if(checkBattleEscape){
    await send('Page.bringToFront');
    await evaluate("window.naiwaProfile.start('practice')");
    const state=()=>evaluate(`({locked:document.pointerLockElement===document.getElementById('scene'),
      menu:document.getElementById('settings-dialog').open,time:window.naiwaProfile.encounterState().time})`);
    const pressEscape=async()=>{
      const key={key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27};
      await send('Input.dispatchKeyEvent',{...key,type:'rawKeyDown'});
      await send('Input.dispatchKeyEvent',{...key,type:'keyUp'});
    };
    const lockMouse=async()=>{
      const click={x:210,y:360,button:'left',clickCount:1};
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:click.x,y:click.y});
      await send('Input.dispatchMouseEvent',{...click,type:'mousePressed',buttons:1});
      await send('Input.dispatchMouseEvent',{...click,type:'mouseReleased',buttons:0});
      await until(async()=>(await state()).locked,5000);
    };
    await lockMouse();
    await pressEscape();
    const first=await until(async()=>{const s=await state();return s.menu&&!s.locked&&s;},5000);
    await wait(350);
    assert.equal((await state()).time,first.time,'Battle still advanced while paused');
    await pressEscape();
    await until(async()=>!(await state()).menu,5000);
    await until(async()=>(await state()).time>first.time,5000);
    await wait(1200);
    await lockMouse();
    // Exercise the path where the browser swallows the Escape key event.
    await evaluate('document.exitPointerLock()');
    const nativeRelease=await until(async()=>{const s=await state();return s.menu&&!s.locked&&s;},5000);
    await evaluate("document.getElementById('settings-close').click()");
    await until(async()=>!(await state()).menu,5000);
    assert.deepEqual(errors,[]);
    await writeFile(output,JSON.stringify({first,nativeRelease,errors},null,2));
  }else if(checkStonekeeper){
    await evaluate(`(()=>{
      document.getElementById('home-settings').click();
      const select=document.getElementById('developer-jump-target');
      select.value=[...select.options].find(option=>option.textContent==='石槌守卫').value;
      document.getElementById('developer-jump-go').click();
      const start=document.getElementById('equipment-start');
      if(start.hidden||start.disabled)throw Error('Stonekeeper equipment confirmation unavailable');
      start.click();
    })()`);
    const status=()=>evaluate('window.naiwaProfile.encounterState()');
    const intro=await until(async()=>{const s=await status();return s.mode==='stonekeeper'&&s.rigged&&s;});
    assert(intro.stonePlatform&&!intro.foundry&&!intro.standard);
    const windup=await until(async()=>{const s=await status();return s.state==='windup'&&s.motion==='sweep'&&s.elapsed>.45&&s.elapsed<1.2&&s;});
    const shot=await send('Page.captureScreenshot',{format:'png',fromSurface:true});
    await writeFile('output/stonekeeper-arena.png',Buffer.from(shot.data,'base64'));
    const smash=await until(async()=>{const s=await status();return s.state==='windup'&&s.motion==='smash'&&s.elapsed>.65&&s.elapsed<1.2&&s;});
    const hammerShot=await send('Page.captureScreenshot',{format:'png',fromSurface:true});
    await writeFile('output/stonekeeper-smash.png',Buffer.from(hammerShot.data,'base64'));
    const stun=await until(async()=>{const s=await status();return s.motion==='smash'&&s.hitResolved&&s.playerAction==='HitRecoil'&&s;},5000);
    assert(Math.abs(stun.hitDuration-1)<1e-9);
    const quake=await until(async()=>{const s=await status();return s.motion==='quake'&&s.hitResolved&&s;});
    await evaluate("window.naiwaProfile.start('practice')");
    const practice=await status();
    assert.equal(practice.mode,'practice');
    assert(!practice.stonePlatform);
    assert.deepEqual(errors,[]);
    await writeFile(output,JSON.stringify({startupMs,intro,windup,smash,stun,quake,practice,errors},null,2));
  }else if(checkScenes){
    const response=await send('Runtime.evaluate',{expression:`(async()=>{
      const p=window.naiwaProfile,reports={};
      const frames=async count=>{for(let i=0;i<count;i++)await new Promise(requestAnimationFrame);};
      for(const mode of ['practice','mirrorGuard','samurai','cinderWarden']){
        p.start(mode);p.reset();await frames(90);
        reports[mode]=p.snapshot(true);
      }
      return reports;
    })()`,awaitPromise:true,returnByValue:true});
    if(response.exceptionDetails)throw Error(response.exceptionDetails.exception?.description);
    const scenes=response.result.value;
    assert(Object.values(scenes).every(report=>report.count>=60));
    assert.deepEqual(errors,[]);
    await writeFile(output,JSON.stringify({startupMs,startupMetrics,progress,phases,scenes,errors},null,2));
  }else if(checkPooledEffects){
    const response=await send('Runtime.evaluate',{expression:`(async()=>{
      const p=window.naiwaProfile;
      const frames=async count=>{for(let i=0;i<count;i++)await new Promise(requestAnimationFrame);};
      p.start('spitter');
      await frames(10);p.reset();await frames(4);
      const launched=p.launchProjectile();
      await frames(4);
      const projectileRendered=p.effectState().projectileVisible;
      await frames(30);
      const projectile=p.snapshot(true);
      p.start('practice');
      await frames(10);p.reset();await frames(4);
      const accepted=p.drinkPotion();
      await frames(4);
      const duringDrink=p.effectState();
      for(let i=0;i<600&&p.effectState().drinking;i++)await frames(1);
      await frames(2);
      return {launched,projectileRendered,projectile,accepted,duringDrink,
        afterDrink:p.effectState(),drink:p.snapshot(true)};
    })()`,awaitPromise:true,returnByValue:true});
    if(response.exceptionDetails)throw Error(response.exceptionDetails.exception?.description);
    const effects=response.result.value;
    assert(effects.launched&&effects.projectileRendered);
    assert(effects.accepted&&effects.duringDrink.potionVisible&&effects.duringDrink.drinking);
    assert(!effects.afterDrink.potionVisible&&!effects.afterDrink.drinking);
    assert(effects.afterDrink.health>effects.duringDrink.health);
    for(const sample of [effects.projectile,effects.drink]){
      const programs=sample.frames[0][sample.columns.indexOf('programs')];
      assert.equal(sample.summary.programs.max,programs,'Effect compiled a shader on first use');
    }
    assert.deepEqual(errors,[]);
    await writeFile(output,JSON.stringify({startupMs,startupMetrics,effects,errors},null,2));
  }else if(checkEffects){
    const effects={};
    for(const mode of ['practice','cinderWarden']){
      await evaluate(`window.naiwaProfile.start('${mode}');window.naiwaProfile.reset()`);
      await until(async()=> (await evaluate('window.naiwaProfile.snapshot()')).count>=90);
      const timings=await send('Runtime.evaluate',{expression:`(async()=>{
        const p=window.naiwaProfile;
        const frames=async count=>{for(let i=0;i<count;i++)await new Promise(requestAnimationFrame);};
        p.reset();await frames(4);
        p.grantCounter();await frames(90);
        const guard=p.snapshot(true);
        p.reset();await frames(4);
        p.absorbCounter();await frames(150);
        return {guard,absorption:p.snapshot(true)};
      })()`,awaitPromise:true,returnByValue:true});
      if(timings.exceptionDetails)throw Error(timings.exceptionDetails.exception?.description);
      effects[mode]=timings.result.value;
    }
    assert.deepEqual(errors,[]);
    await writeFile(output,JSON.stringify({startupMs,startupMetrics,effects,errors},null,2));
  }else{
  await evaluate(`(() => {
    const supported = PerformanceObserver.supportedEntryTypes.includes('longtask');
    window.foundryLongTasks = {supported,entries:[]};
    if(supported) new PerformanceObserver(list => {
      for(const {startTime,duration} of list.getEntries()){
        const entries=window.foundryLongTasks.entries;
        if(entries.length<256)entries.push({startTime,duration});
      }
    }).observe({type:'longtask'});
  })()`);
  await evaluate("window.naiwaProfile.start('cinderWarden');window.naiwaProfile.reset()");
  const dry=await until(async()=>{
    const report=await evaluate('window.naiwaProfile.snapshot()');
    return report.count>=120&&report;
  });
  await evaluate('window.naiwaProfile.breakValves(4);window.naiwaProfile.setValveDuration(20);window.naiwaProfile.reset()');
  const wet=await until(async()=>{
    const report=await evaluate('window.naiwaProfile.snapshot()');
    return report.count>=120&&report;
  });
  assert.equal(dry.summary.waterSteps.max,0);
  assert(wet.summary.waterSteps.max>0);
  if(process.argv.includes('--capture-flow')){
   const shot=await send('Page.captureScreenshot',{format:'png',fromSurface:true});
   await writeFile('output/foundry-flow.png',Buffer.from(shot.data,'base64'));
  }
  assert.deepEqual(errors,[]);
  const longTasks=await evaluate('window.foundryLongTasks');
  await writeFile(output,JSON.stringify({startupMs,startupMetrics,progress,dry,wet,longTasks,errors},null,2));
  }
}catch(error){
  await writeFile(output,JSON.stringify({error:error.stack,readiness,errors},null,2));
  process.exitCode=1;
}finally{
  socket?.close();
  if(child.exitCode===null)child.kill();
}

const { app, BrowserWindow } = require('electron');
const { writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const assert = require('node:assert/strict');

const simulateMissingExtensions = process.argv.includes('--fallback');
const preferIntegrated = process.argv.includes('--integrated');
const measureFirstUse = process.argv.includes('--first-use');
const measureStability = process.argv.includes('--stability');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const name = preferIntegrated ? 'integrated' : simulateMissingExtensions ? 'fallback'
  : measureFirstUse ? 'first-use' : measureStability ? 'stability' : 'scene-cycles';
app.setPath('userData', join(process.cwd(), 'output', 'profile-browser-' + name));
if(preferIntegrated) app.commandLine.appendSwitch('force_low_power_gpu');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280, height: 800, useContentSize: true, show: false,
    webPreferences: {
      offscreen: true, backgroundThrottling: false,
      ...(simulateMissingExtensions || preferIntegrated ? {
        preload: join(__dirname, 'foundry-compatibility-preload.cjs'),
        contextIsolation: false,
        additionalArguments: [simulateMissingExtensions ? '--naiwa-no-float-timers' : '--naiwa-low-power'],
      } : {}),
    },
  });
  const errors = [];
  win.webContents.on('console-message', (_event, details) => {
    if (details.level === 'error') errors.push(details.message);
  });
  const run = code => win.webContents.executeJavaScript(code);
  async function waitForFrames(count) {
    const deadline = Date.now() + 60000;
    let report;
    do {
      await wait(500);
      report = await run('window.naiwaProfile.snapshot()');
      if (report.count >= count) return report;
    } while (Date.now() < deadline);
    throw Error(`Expected ${count} rendered frames, observed ${report.count}`);
  }
  try {
    await win.loadURL('http://127.0.0.1:5173/?profile');
    let ready;
    for (let i = 0; i < 600 && !ready; i++) {
      ready = await run("document.getElementById('home-practice')?.disabled === false");
      if (!ready) await wait(100);
    }
    assert(ready, 'Game startup did not finish');

    let result;
    if (simulateMissingExtensions) {
      const reflection = await run('window.naiwaProfile.foundryReflection()');
      assert.equal(reflection.source,'baked');
      assert.equal(reflection.filtered,false);
      await run("window.naiwaProfile.start('cinderWarden'); window.naiwaProfile.reset()");
      await waitForFrames(30);
      await run('window.naiwaProfile.reset();window.naiwaProfile.breakValves(4);window.naiwaProfile.setValveDuration(15)');
      const report = await waitForFrames(120);
      assert.equal(report.gpuTimerAvailable, false);
      assert.equal(report.summary.gpuMs.samples, 0);
      assert(report.summary.waterSteps.max > 0 && report.summary.waterSteps.max <= 2);
      const drain = await run(`(async()=>{
        const T = await import('/node_modules/three/build/three.module.js');
        const {createDrainWater} = await import('/src/drain-water.js');
        const renderer = new T.WebGLRenderer();
        const water = createDrainWater(new T.Group());
        water.prepare(renderer);
        const valve = {x:-6,z:-2,brokenAt:0,until:5};
        for(let i=0;i<=180;i++)water.update(i/60,[valve]);
        const beforeReset = { count:water.count, channels:water.channelStats, visible:water.mesh.visible };
        water.update(0,[]);
        const afterReset = {count:water.count, visible:water.mesh.visible};
        renderer.dispose();
        renderer.forceContextLoss();
        return { beforeReset, afterReset };
      })()`);
      assert(drain.beforeReset.count > 0);
      assert(drain.beforeReset.channels.count > 0);
      assert.equal(drain.beforeReset.channels.escaped, 0);
      assert.equal(drain.beforeReset.visible, true);
      assert.deepEqual(drain.afterReset, {count:0, visible:false});
      result = {report, drain, reflection};
    } else if (measureStability) {
      await run("window.naiwaProfile.start('cinderWarden'); window.naiwaProfile.reset()");
      await waitForFrames(30);
      await run('window.naiwaProfile.breakValves(4);window.naiwaProfile.setValveDuration(630)');
      await waitForFrames(180);
      const measurements = [];
      for(let minute=1;minute<=10;minute++){
        await run('window.naiwaProfile.reset()');
        await wait(60000);
        const report=await run('window.naiwaProfile.snapshot()');
        assert(report.count >= 600 && report.summary.waterSteps.p50 > 0);
        measurements.push({minute,report});
        await writeFile('output/foundry-stability.json', JSON.stringify({measurements,errors},null,2));
      }
      result={measurements};
    } else if (measureFirstUse) {
      const dry = await run(`(async()=>{
        const p=window.naiwaProfile;
        p.start('cinderWarden');p.reset();
        for(let i=0;i<120;i++)await new Promise(requestAnimationFrame);
        return p.snapshot();
      })()`);
      const firstUse = await run(`(async()=>{
        const p=window.naiwaProfile;
        p.reset();
        for(let i=0;i<3;i++)await new Promise(requestAnimationFrame);
        p.breakValves(4);
        for(let i=0;i<120;i++)await new Promise(requestAnimationFrame);
        return p.snapshot(true);
      })()`);
      assert(dry.count >= 90 && firstUse.count >= 90);
      assert(firstUse.summary.waterSteps.max > 0);
      result = {dry,firstUse};
    } else if (preferIntegrated) {
      await run("document.getElementById('settings-reset').click()");
      await run("window.naiwaProfile.start('cinderWarden'); window.naiwaProfile.reset()");
      await waitForFrames(30);
      await run('window.naiwaProfile.reset();window.naiwaProfile.breakValves(4);window.naiwaProfile.setValveDuration(15)');
      const report = await waitForFrames(300);
      const gpu = await app.getGPUInfo('basic');
      const comparisons = [];
      if (/AMD|Radeon/i.test(report.renderer)) {
        for(const feature of ['refraction','shadow','fog','lava','bloom','low']){
          await run(`(() => {
            const p=window.naiwaProfile;
            if(${JSON.stringify(feature)}==='low'){
              for(const [key,value] of Object.entries({resolution:'960x540',lightingQuality:'low',
                reflectionQuality:'low',shadowQuality:'low',postQuality:'off',waterQuality:'low'})){
                const control=document.querySelector('[data-setting="'+key+'"]');
                control.value=value;control.dispatchEvent(new Event('change',{bubbles:true}));
              }
            }
            p.isolate(${JSON.stringify(feature)});p.setValveDuration(25);p.reset();
          })()`);
          await waitForFrames(35);
          await run('window.naiwaProfile.reset()');
          comparisons.push({feature,report:await waitForFrames(150)});
          await writeFile('output/foundry-integrated.json', JSON.stringify({report,gpu,comparisons,integratedSelected:true,errors},null,2));
        }
      }
      result = {report,gpu,comparisons,integratedSelected:/AMD|Radeon/i.test(report.renderer)};
    } else {
      const measurements = [];
      for(let cycle=0;cycle<20;cycle++) {
        for(const mode of ['practice','mirrorGuard','cinderWarden']) {
          const report = await run(`(async()=>{
            const p=window.naiwaProfile;
            p.start(${JSON.stringify(mode)});
            p.reset();
            if(${JSON.stringify(mode)}==='cinderWarden')p.breakValves(4);
            for(let i=0;i<16;i++)await new Promise(requestAnimationFrame);
            return p.snapshot();
          })()`);
          assert(report.count >= 8, 'Scene did not render');
          const counts = Object.fromEntries(['textures','geometries','programs']
            .map(metric => [metric, report.summary[metric].max]));
          measurements.push({cycle,mode,counts});
        }
      }
      const plateau = Object.fromEntries(['practice','mirrorGuard','cinderWarden'].map(mode => [
        mode, Object.fromEntries(['textures','geometries','programs'].map(metric => {
          const readings = measurements.filter(x=>x.mode===mode&&x.cycle>=15).map(x=>x.counts[metric]);
          return [metric, {min:Math.min(...readings),max:Math.max(...readings),trend:readings.at(-1)-readings[0]}];
        })),
      ]));
      result = {measurements,plateau};
    }
    assert.deepEqual(errors, []);
    await writeFile('output/foundry-' + name + '.json', JSON.stringify({...result,errors}, null, 2));
  } catch (error) {
    await writeFile('output/foundry-' + name + '.json', JSON.stringify({error:error.stack,errors}, null, 2));
    process.exitCode = 1;
  }
  win.destroy();
  app.exit(process.exitCode ?? 0);
});

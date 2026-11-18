const { app, BrowserWindow } = require('electron');
const { writeFile } = require('node:fs/promises');
const { join } = require('node:path');

const output = process.env.NAIWA_PROFILE_OUTPUT || 'output/foundry-profile.json';
const duration = Number(process.env.NAIWA_PROFILE_SECONDS || 120);
const valves = Number(process.env.NAIWA_PROFILE_VALVES || 4);
const matrix = process.env.NAIWA_PROFILE_MATRIX;
const refractionStages = [
  ['cinderWarden', 'all', 1], ['cinderWarden', 'refraction', 1],
  ['cinderWarden', 'refraction', 4], ['cinderWarden', 'all', 4],
  ['cinderWarden', 'all', 1], ['cinderWarden', 'refraction', 1],
];
const soakStages = [
  ['cinderWarden', 'all', 4], ['cinderWarden', 'refraction', 4],
  ['cinderWarden', 'refraction', 4], ['cinderWarden', 'all', 4],
];
const acceptanceStages = [
  ['cinderWarden', 'all', 0], ['cinderWarden', 'all', 1], ['mirrorGuard', 'all', 0],
  ['mirrorGuard', 'all', 0], ['cinderWarden', 'all', 1], ['cinderWarden', 'all', 0],
];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

app.setPath('userData', join(process.cwd(), 'output', 'profile-browser-data'));
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280, height: 800, useContentSize: true, show: false,
    webPreferences: { offscreen: true, backgroundThrottling: false },
  });
  const errors = [];
  win.webContents.on('console-message', (_event, details) => {
    if (details.level === 'error') errors.push(details.message);
  });
  const run = code => win.webContents.executeJavaScript(code);
  try {
    await win.loadURL('http://127.0.0.1:5173/?profile');
    let ready;
    for (let i = 0; i < 600 && !ready; i++) {
      ready = await run("document.getElementById('home-practice')?.disabled === false");
      if (!ready) await wait(100);
    }
    if (!ready) throw Error('Game startup did not finish');
    if(matrix) {
      const measurements = [];
      const stages = matrix === 'soak' ? soakStages : matrix === 'refraction' ? refractionStages
        : matrix === 'acceptance' ? acceptanceStages : [
        ['cinderWarden', 'all', 0], ['cinderWarden', 'shadow', 0],
        ['cinderWarden', 'fog', 0], ['cinderWarden', 'lava', 0],
        ['cinderWarden', 'bloom', 0], ['cinderWarden', 'all', 0],
        ['cinderWarden', 'all', 1], ['cinderWarden', 'all', 4],
        ['mirrorGuard', 'all', 0], ['mirrorGuard', 'mirror', 0],
      ];
      for (const [mode, feature, valveCount] of stages) {
        const count = await run(`(() => {
          const p=window.naiwaProfile;
          p.isolate('all'); p.start(${JSON.stringify(mode)});
          p.breakValves(${valveCount});
          return p.setValveDuration(${duration + 15});
        })()`);
        if(count !== valveCount) throw Error(`Expected ${valveCount} open valves, got ${count}`);
        await wait(2500);
        await run(`window.naiwaProfile.isolate(${JSON.stringify(feature)}); window.naiwaProfile.reset();`);
        await wait(1500);
        await run('window.naiwaProfile.reset()');
        await wait(duration * 1000);
        const report = await run('window.naiwaProfile.snapshot()');
        if(report.count < duration * 10) throw Error(`Insufficient frames for ${mode}/${feature}`);
        measurements.push({mode, feature, valveCount, report});
        await writeFile(output, JSON.stringify({duration, measurements, errors}, null, 2));
      }
      if (errors.length) process.exitCode = 1;
    } else {
    await run(`document.getElementById('home-settings').click();
      const select = document.getElementById('developer-jump-target');
      select.value = [...select.options].find(o => o.textContent.includes('司炉官')).value;
      document.getElementById('developer-jump-go').click();
      document.getElementById('equipment-start').click();`);
    await wait(1800);
    await run(`window.naiwaProfile.reset(); window.naiwaProfile.breakValves(${valves});
      window.naiwaProfile.setValveDuration(${duration + 10});`);
    await wait(2000);
    const startup = await run('window.naiwaProfile.snapshot()');
    await run('window.naiwaProfile.reset()');
    await wait(duration * 1000);
    const steady = await run('window.naiwaProfile.snapshot(true)');
    if (steady.count < duration) throw Error('Too few rendered frames');
    const gpu = await app.getGPUInfo('basic');
    await writeFile(output, JSON.stringify({ duration, valves, gpu, startup, steady, errors }));
    if (errors.length) process.exitCode = 1;
    }
  } catch (error) {
    await writeFile(output, JSON.stringify({ error: error.stack, errors }));
    process.exitCode = 1;
  }
  win.destroy();
  app.exit(process.exitCode ?? 0);
});

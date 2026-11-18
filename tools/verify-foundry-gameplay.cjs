const {app,BrowserWindow}=require('electron'),fs=require('node:fs/promises');
app.whenReady().then(async()=>{const win=new BrowserWindow({width:1600,height:1000,show:false,webPreferences:{offscreen:true,backgroundThrottling:false}}),errors=[];win.webContents.on('console-message',(_e,level,message)=>{if(level>=3)errors.push(message);});try{
 await win.loadURL('http://127.0.0.1:5173/');let ready=false;for(let i=0;i<600;i++){ready=await win.webContents.executeJavaScript(`document.getElementById('home-practice')?.disabled===false`);if(ready)break;await new Promise(r=>setTimeout(r,100));}if(!ready)throw Error('Game startup did not finish');
 const option=await win.webContents.executeJavaScript(`(()=>{document.getElementById('home-settings').click();const select=document.getElementById('developer-jump-target'),option=[...select.options].find(o=>o.textContent.includes('司炉官'));if(!option)throw Error('Foundry encounter absent');select.value=option.value;document.getElementById('developer-jump-go').click();return {value:option.value,text:option.textContent};})()`);
 await new Promise(r=>setTimeout(r,250));const preparation=await win.webContents.executeJavaScript(`({open:document.getElementById('equipment-dialog').open,startVisible:!document.getElementById('equipment-start').hidden})`);if(!preparation.open)throw Error('Battle equipment screen absent');await win.webContents.executeJavaScript(`document.getElementById('equipment-start').click()`);
 await new Promise(r=>setTimeout(r,1800));await fs.writeFile('output/foundry-gameplay.png',(await win.webContents.capturePage()).toPNG());
 const quality=await win.webContents.executeJavaScript(`(()=>{
  document.getElementById('settings-open').click();
  const expected={lightingQuality:'low',shadowQuality:'low',reflectionQuality:'low',postQuality:'off',waterQuality:'low'};
  for(const [field,value] of Object.entries(expected)){
   const control=document.querySelector('[data-setting="'+field+'"]');
   control.value=value;
   control.dispatchEvent(new Event('change',{bubbles:true}));
  }
  document.getElementById('settings-close').click();
  const stored=JSON.parse((window.naiwaSettings??window.localStorage).getItem('milk-heroes-settings'));
  return Object.entries(expected).every(([field,value])=>stored[field]===value);
 })()`);
 if(!quality)throw Error('Graphics settings were not saved');
 await win.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',bubbles:true}));`);
 await new Promise(r=>setTimeout(r,220));
 await fs.writeFile('output/foundry-gameplay-jump.png',(await win.webContents.capturePage()).toPNG());
 await win.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent('keyup',{code:'Space',key:' ',bubbles:true}));`);
 await win.webContents.executeJavaScript(`
   window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyJ',key:'j',bubbles:true}));
   window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyJ',key:'j',bubbles:true}));
 `);
 await new Promise(r=>setTimeout(r,360));
 await fs.writeFile('output/foundry-gameplay-air-slam.png',(await win.webContents.capturePage()).toPNG());
 await new Promise(r=>setTimeout(r,440));
 await fs.writeFile('output/foundry-gameplay-impact.png',(await win.webContents.capturePage()).toPNG());
 await new Promise(r=>setTimeout(r,960));
 await win.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',key:'w',bubbles:true}))`);await new Promise(r=>setTimeout(r,1100));await win.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',key:'w',bubbles:true}))`);await new Promise(r=>setTimeout(r,250));await fs.writeFile('output/foundry-gameplay-move.png',(await win.webContents.capturePage()).toPNG());
 const state=await win.webContents.executeJavaScript(`({title:document.getElementById('practice-title').textContent,homeHidden:document.getElementById('home-screen')?.hidden,equipmentClosed:!document.getElementById('equipment-dialog').open,warmup:document.querySelector('#scene').dataset.warmup})`);
 await win.webContents.executeJavaScript(`(()=>{
   document.getElementById('home-settings').click();
   const select=document.getElementById('developer-jump-target');
   const rest=[...select.options].find(option=>option.textContent==='休息处');
   if(!rest)throw Error('Rest site jump missing');
   select.value=rest.value;
   document.getElementById('developer-jump-go').click();
 })()`);
 await new Promise(r=>setTimeout(r,350));
 const rest=await win.webContents.executeJavaScript(`({
   open:!document.getElementById('rest-screen').hidden,
   options:document.getElementById('rest-options').children.length,
 })`);
 if(!rest.open||!rest.options)throw Error('Rest site did not open');
 await fs.writeFile('output/foundry-gameplay-rest.png',(await win.webContents.capturePage()).toPNG());
 await fs.writeFile('output/foundry-gameplay-check.json',JSON.stringify({errors,option,preparation,state,rest},null,2));
 }catch(e){await fs.writeFile('output/foundry-gameplay-check.json',JSON.stringify({errors,error:e.stack},null,2));}app.quit();});

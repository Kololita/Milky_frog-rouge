const assert=require('node:assert/strict');
async function verifyInteractions(win){
 const evalJS=s=>win.webContents.executeJavaScript(s),checks=[];
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 async function hit(selector,index=0){const result=await evalJS(`(()=>{const e=document.querySelectorAll(${JSON.stringify(selector)})[${index}];if(!e)return {error:'missing'};e.scrollIntoView({block:'center',inline:'center'});const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,top=document.elementFromPoint(x,y);return {ok:r.width>0&&r.height>0&&x>=0&&x<innerWidth&&y>=0&&y<innerHeight&&(top===e||e.contains(top)),disabled:e.disabled,rect:[r.x,r.y,r.width,r.height],cover:top?.outerHTML.slice(0,130)};})()`);assert(result.ok,`${selector} blocked: ${JSON.stringify(result)}`);return result;}
 async function click(selector,index=0){const r=await hit(selector,index);assert(!r.disabled,selector+' disabled');await evalJS(`document.querySelectorAll(${JSON.stringify(selector)})[${index}].click()`);await wait(30);}
 async function select(selector,value){await hit(selector);await evalJS(`(()=>{let e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
 async function textButton(root,label){const index=await evalJS(`Array.from(document.querySelectorAll(${JSON.stringify(root+' button')})).findIndex(b=>b.textContent===${JSON.stringify(label)})`);assert(index>=0,label+' missing');await click(root+' button',index);}
 for(const id of ['home-new-game','home-practice','home-tutorial','home-arena','home-settings'])await hit('#'+id);checks.push('home menu buttons unobstructed');
 await click('#home-settings');await hit('[data-setting="camera"]');await hit('#developer-equipment-get');await click('#developer-equipment-get');
 await hit('.developer-equipment-list section:last-child button');await hit('.developer-equipment-list section:first-child select');await click('#developer-equipment-dialog .settings-heading button');checks.push('developer inventory scroll, shape dropdown and return');
 await click('#return-home');await click('#home-arena');await click('#home-samurai');
 for(const [w,h]of [[1280,800],[1024,720],[800,600]]){
  win.setSize(w,h);await wait(120);await hit('#equipment-start');await click('#equipment-add');await hit('#equipment-list .equipment-choice:last-child');await click('#equipment-picker-close');
  await evalJS(`(()=>{const e=document.getElementById('equipment-effects');e.dataset.qaOriginal=e.innerHTML;for(let i=0;i<40;i++){const row=document.createElement('div');row.innerHTML='<dt>被动效果测试</dt><dd>等级 3/3</dd>';e.append(row);}})()`);await hit('#equipment-start');await hit('#equipment-add');await evalJS(`(()=>{const e=document.getElementById('equipment-effects');e.innerHTML=e.dataset.qaOriginal;})()`);
  checks.push(`prebattle ${w}x${h}: start, last inventory item and long effects panel`);
 }
 win.setSize(1280,800);await wait(100);await click('#equipment-start');await wait(100);await evalJS('document.exitPointerLock?.()');await wait(80);
 if(!await evalJS("document.getElementById('settings-dialog').open"))await click('#settings-open');
 await click('#return-home');
 await click('#home-settings');await click('#developer-jump summary');const restValue=await evalJS(`Array.from(document.querySelector('#developer-jump-target').options).find(o=>o.textContent==='休息处').value`);await select('#developer-jump-target',restValue);await click('#developer-jump-go');
 // Escape is the supported way to open settings while sitting in a rest site.
 win.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});await wait(80);assert(await evalJS(`document.getElementById('settings-dialog').open`));await click('#developer-equipment-get');
 const card='.developer-equipment-list [data-item-id="armor-light"]';const bar=await evalJS(`Array.from(document.querySelector('${card} select').options).find(o=>o.value.includes('bar')).value`);await select(card+' select',bar);await click(card+' button');await click('#developer-equipment-dialog .settings-heading button');await click('#settings-close');
 await textButton('#rest-options','改装');await textButton('#hinge-workshop','升级');await hit('.hinge-equipment-list button:last-child');await click('.hinge-equipment-list button:first-child');await hit('.retrofit-compare');await textButton('#hinge-workshop','返回');await textButton('#hinge-workshop','返回');await textButton('#hinge-workshop','升级');await click('.hinge-equipment-list button:first-child');await textButton('#hinge-workshop','确认');
 await textButton('#hinge-workshop','灵巧');await click('.hinge-equipment-list button:first-child');await click('.hinge-candidate');await textButton('#hinge-workshop','确认');await textButton('#hinge-workshop','精简');await click('.hinge-equipment-list button:first-child');await click('.hinge-candidate');await textButton('#hinge-workshop','确认');await textButton('#hinge-workshop','改装完成');await hit('#run-exit');await click('#run-exit');checks.push('rest retrofit: equipment selection, comparisons, candidate cells, back, confirm and finish');
 // Stress the existing reward layout with long real-style effects text.
 await evalJS(`(()=>{let choices=document.getElementById('loot-choices');choices.innerHTML=Array.from({length:2},(_,i)=>'<button class="loot-choice"><strong>奖励装备'+i+'</strong><p>'+('生命上限 +20<br>附加被动 集中+1<br>').repeat(9)+'</p></button>').join('');document.getElementById('loot-dialog').showModal();})()`);await hit('#loot-choices button',1);await hit('#loot-inventory');await hit('#loot-confirm');await evalJS(`document.getElementById('loot-dialog').close();document.getElementById('loot-choices').replaceChildren()`);checks.push('reward layout stress: both cards, backpack and confirmation reachable');
 return checks;
}
module.exports={verifyInteractions};

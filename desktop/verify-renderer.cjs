const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');

/** Hidden native-window smoke test, using the same packaged page and preload. */
async function verifyRenderer(win,version,errors){
 const evaluate=script=>win.webContents.executeJavaScript(script);
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const until=async(script,timeout=45000)=>{
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){if(await evaluate(script))return;await wait(100);}
  throw new Error(`Desktop check timed out: ${script}`);
 };
 await until('!document.getElementById("home-practice").disabled');
 const title=await evaluate('document.title');assert(title.includes(version));
 const interactions=await require('./verify-interactions.cjs').verifyInteractions(win);
 await evaluate('document.getElementById("home-practice").click()');
 await until('document.getElementById("home-screen").hidden');
 await wait(900);
 const frame=await win.webContents.capturePage(),pixels=frame.toBitmap(),colors=new Set();
 for(let i=0;i<pixels.length;i+=4096)colors.add(pixels.readUInt32LE(i));
 assert(colors.size>20,'Practice rendered a blank frame');
 const reportArg=process.argv.find(x=>x.startsWith('--report='));
 if(reportArg)await fs.writeFile(path.join(path.dirname(reportArg.slice(9)),`desktop-${version}-practice.png`),frame.toPNG());
 await evaluate('document.getElementById("settings-open").click();document.getElementById("return-home").click()');
 await until('!document.getElementById("home-screen").hidden');
 await evaluate('document.getElementById("home-arena").click();document.getElementById("home-samurai").click()');
 await until('document.getElementById("equipment-dialog").open');
 await evaluate('document.getElementById("equipment-start").click()');
 await until('document.getElementById("home-screen").hidden&&!document.getElementById("equipment-dialog").open');
 await wait(900);
 await until('!document.getElementById("boss-hud").hidden && document.getElementById("boss-name").textContent==="武士"');
 assert.equal(await evaluate('Boolean(document.querySelector(".title-card"))'),false);
 const bossFrame=await win.webContents.capturePage();
 if(reportArg)await fs.writeFile(path.join(path.dirname(reportArg.slice(9)),`desktop-${version}-samurai.png`),bossFrame.toPNG());
 assert.deepEqual(errors,[],'Renderer reported errors');
 return {version,title,interactions,modelsAndTexturesLoaded:true,practiceRendered:true,frameColors:colors.size,arenaEquipmentAndSamuraiLoaded:true,rendererErrors:errors};
}
module.exports={verifyRenderer};

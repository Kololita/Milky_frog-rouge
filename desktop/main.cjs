const {app,BrowserWindow,dialog,ipcMain}=require('electron');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const {contentSecurityPolicy}=require('./security.cjs');
const verifyingRenderer=process.argv.includes('--verify-renderer');
if(verifyingRenderer){
  const dataDir=process.argv.find(x=>x.startsWith('--verify-data-dir='));
  if(dataDir){const directory=path.resolve(dataDir.slice(18));require('node:fs').mkdirSync(directory,{recursive:true});app.setPath('userData',directory);}
}
let server;
const root=path.join(__dirname,'..','dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.gif':'image/gif'};
async function main(){
  const settingsFile=path.join(app.getPath('userData'),'settings.json');
  const storageFile=key=>key==='milk-heroes-assembly-v2'?path.join(app.getPath('userData'),'assembly-v2.json'):key==='milk-heroes-equipment-v1'?path.join(app.getPath('userData'),'equipment.json'):key==='milk-heroes-tuning-v1'?path.join(app.getPath('userData'),'developer-tuning.json'):key==='milk-heroes-settings'||key===undefined?settingsFile:null;
  ipcMain.on('settings-read',(event,key)=>{try{const file=storageFile(key);if(!file)throw new Error('Invalid key');event.returnValue=require('node:fs').readFileSync(file,'utf8');}catch{event.returnValue=null;}});
  ipcMain.on('settings-write',(event,value,key)=>{try{const file=storageFile(key);if(!file||typeof value!=='string'||value.length>131072)throw new Error('Invalid settings');JSON.parse(value);require('node:fs').mkdirSync(path.dirname(file),{recursive:true});require('node:fs').writeFileSync(file,value);event.returnValue=true;}catch{event.returnValue=false;}});
  if(process.argv.includes('--verify-package')){
    const report={version:app.getVersion(),html:(await fs.readFile(path.join(root,'index.html'),'utf8')).includes('home-screen'),modelBytes:(await fs.stat(path.join(root,'models','characters','frog.glb'))).size};
    const target=process.argv.find(x=>x.startsWith('--report='));
    if(target)await fs.writeFile(target.slice(9),JSON.stringify(report,null,2));
    app.quit();return;
  }
  server=http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      const relative=decodeURIComponent(url.pathname)==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const file=path.resolve(root,relative);
      if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
      const data=await fs.readFile(file);
      res.writeHead(200,{'Content-Type':types[path.extname(file)]??'application/octet-stream','X-Content-Type-Options':'nosniff','Content-Security-Policy':contentSecurityPolicy});res.end(data);
    }catch{res.writeHead(404);res.end('Not found');}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const origin=`http://127.0.0.1:${server.address().port}`;
  const win=new BrowserWindow({width:1280,height:800,minWidth:800,minHeight:600,title:`奶蛙 · ${app.getVersion()}`,backgroundColor:'#173a32',show:false,autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  // Only the packaged game's local page may capture the mouse.
  win.webContents.session.setPermissionRequestHandler((contents,permission,callback)=>{callback(contents===win.webContents&&permission==='pointerLock'&&contents.getURL().startsWith(origin+'/'));});
  win.webContents.session.setPermissionCheckHandler((contents,permission,requestingOrigin)=>contents===win.webContents&&permission==='pointerLock'&&requestingOrigin===origin);
  win.setMenu(null);win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(origin+'/'))event.preventDefault();});
  const rendererErrors=[];
  if(verifyingRenderer){
    win.webContents.setBackgroundThrottling(false);
    win.webContents.on('console-message',(_event,details)=>{if(details.level==='error')rendererErrors.push(details.message);});
  }else win.once('ready-to-show',()=>win.show());
  await win.loadURL(origin);
  if(verifyingRenderer){
    const report=await require('./verify-renderer.cjs').verifyRenderer(win,app.getVersion(),rendererErrors);
    const target=process.argv.find(x=>x.startsWith('--report='));
    if(target)await fs.writeFile(target.slice(9),JSON.stringify(report,null,2));
    app.quit();
  }
}
if(!app.requestSingleInstanceLock())app.quit();
else {app.on('second-instance',()=>{const win=BrowserWindow.getAllWindows()[0];if(win){if(win.isMinimized())win.restore();win.focus();}});app.whenReady().then(main).catch(async error=>{if(verifyingRenderer){const target=process.argv.find(x=>x.startsWith('--report='));if(target)await fs.writeFile(target.slice(9),JSON.stringify({error:error.stack},null,2));app.exit(1);}else{dialog.showErrorBox('启动失败',error.message);app.quit();}});}
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>server?.close());

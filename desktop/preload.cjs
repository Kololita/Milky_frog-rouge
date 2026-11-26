const {contextBridge,ipcRenderer}=require('electron');
const allowed=new Set(['milk-heroes-settings','milk-heroes-tuning-v1','milk-heroes-equipment-v1','milk-heroes-assembly-v2','milk-heroes-run-v1']);
contextBridge.exposeInMainWorld('naiwaSettings',{
  getItem:key=>allowed.has(key)?ipcRenderer.sendSync('settings-read',key):null,
  setItem:(key,value)=>allowed.has(key)&&ipcRenderer.sendSync('settings-write',value,key),
});
contextBridge.exposeInMainWorld('naiwaWindow',{
  toggleFullscreen:()=>ipcRenderer.invoke('desktop-toggle-fullscreen'),
});

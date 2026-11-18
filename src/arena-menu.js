export function createArenaMenu(doc,{select=()=>{}}={}){
 const dialog=doc.getElementById?.('boss-arena-dialog'),root=doc.getElementById?.('arena-encounters'),entries=[];let ready=false;
 if(!dialog)return {entries,setReady(){}};
 const choose=id=>{if(!ready)return;dialog.close();select(id);};
 const boss=doc.getElementById('home-samurai');if(boss){boss.addEventListener('click',()=>choose('samurai'));entries.push({id:'samurai',button:boss});}
 root?.replaceChildren();
 doc.getElementById('home-arena')?.addEventListener('click',()=>dialog.showModal());doc.getElementById('arena-close')?.addEventListener('click',()=>dialog.close());
 return {entries,setReady(value=true){ready=Boolean(value);for(const {button} of entries)button.disabled=!ready;}};
}

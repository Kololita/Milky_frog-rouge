import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{port:0,strictPort:false,open:false}});
try{
 await server.listen();
 // Vite may finish the initial scan before listen() resolves.
 await new Promise(resolve=>setTimeout(resolve,1000));
 const watched=Object.keys(server.watcher.getWatched()).map(p=>p.replaceAll('\\','/'));
 const root=process.cwd().replaceAll('\\','/');
 for(const dir of ['release','output','dist','tools','assets-source','docs','desktop','public'])assert(!watched.some(p=>p===`${root}/${dir}`||p.startsWith(`${root}/${dir}/`)),`Excluded tree is watched: ${dir}`);
 assert(watched.some(p=>p===`${root}/src`),'Source hot reload must stay enabled');
 for(let repeat=0;repeat<3;repeat++)for(const asset of ['/','/src/main.js','/src/developer-settings.js','/models/characters/frog.glb','/images/buffs/lifesteal.png','/images/buffs/attack.png']){
  const response=await fetch(`http://127.0.0.1:${server.httpServer.address().port}${asset}`);assert.equal(response.status,200,asset);await response.arrayBuffer();
 }
 console.log('WEB_WATCHER_VERIFIED: excluded build/runtime trees, source hot reload and repeated full resource loads');
}finally{await server.close();}

const KEY='milk-heroes-run-v1';
const VERSION=1;
const RESUMABLE=new Set(['map','preparing','event','rest','shop','reward','victory','startingReward']);

export function createRunSaveStore(storage){
 function write(value){
  try{return Boolean(storage)&&storage.setItem(KEY,JSON.stringify(value))!==false;}
  catch{return false;}
 }
 return {
  read(){
   try{
    const save=JSON.parse(storage?.getItem(KEY)??'null');
    if(save?.version!==VERSION||!RESUMABLE.has(save.run?.status)||
       !/^\d{9}$/.test(save.run.map?.seed??'')||!Array.isArray(save.run.map?.rows)||
       !Array.isArray(save.run.path)||
       !Array.isArray(save.run.inventory)||!save.assembly||
       !Number.isFinite(save.player?.health)||!Number.isFinite(save.player?.potions))return null;
    return save;
   }catch{return null;}
  },
  save(data){return write({version:VERSION,...data});},
  clear(){return write(null);},
 };
}

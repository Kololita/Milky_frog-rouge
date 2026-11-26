import {seededRandom} from './run-random.js';

// Difficulty belongs to a formation, never to an individual monster instance.
export const FORMATIONS={
 'lantern-shellbug':['lantern','shellbug'],
 'raider-lantern':['raider','lantern'],
 'spitter-shellbug':['spitter','shellbug'],
 'spitter-raider':['spitter','raider'],
 'spitter-lantern':['spitter','lantern'],
 'mirror-lantern':['mirrorGuard','lantern'],
 'mirror-spitter':['mirrorGuard','spitter'],
 'double-spitter':['spitter','spitter'],
};
export const ENCOUNTER_POOLS={
 weak:['raider','shellbug','lantern'],
 strong:['lantern-shellbug','raider-lantern','spitter-shellbug','spitter-raider','spitter-lantern','mirror-lantern','mirror-spitter','double-spitter','mirrorGuard'],
 elite:['cinderWarden','stonekeeper','scythemoth'],
};
export function chooseFormation(node,ordinaryBattles,lastEncounter=null){
 const pool=ENCOUNTER_POOLS[ordinaryBattles<2?'weak':'strong'];
 let index=node.encounterRoll%pool.length;
 if(pool[index]===lastEncounter)index=(index+1)%pool.length;
 return pool[index];
}
export function chooseElite(node,lastEncounter=null){
 const pool=ENCOUNTER_POOLS.elite.filter(id=>id!==lastEncounter);
 if(pool.length<=1)return pool[0]??ENCOUNTER_POOLS.elite[0];
 const random=seededRandom(node.encounterRoll);
 const range=2**32,bucket=Math.floor(range/pool.length),limit=bucket*pool.length;
 let roll;
 do{roll=random()*range;}while(roll>=limit);
 return pool[Math.floor(roll/bucket)];
}

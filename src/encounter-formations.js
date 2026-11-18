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

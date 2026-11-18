import {Monster,Mob} from './monster.js';
import {MONSTER_STATS} from './monster-catalog.js';
import {ENEMY_STATS} from './battle-values.js';
import {updateTrainingDummy} from './training-dummy.js';
import {SAMURAI_STATS,updateSamurai,updateSamuraiPhase} from './samurai.js';
import {FORMATIONS,ENCOUNTER_POOLS} from './encounter-formations.js';

// Boss identities and controllers are explicit entries; generic combat has no default boss.
export const ENCOUNTERS=new Map([
  ...Object.entries(MONSTER_STATS).map(([id,stats])=>[id,{id,kind:ENCOUNTER_POOLS.elite.includes(id)?'elite':'monster',stats}]),
  ['practice',{id:'practice',kind:'training',stats:ENEMY_STATS,update:updateTrainingDummy}],
  ...Object.entries(FORMATIONS).map(([id,members])=>[id,{id,kind:'monster',name:members.map(id=>MONSTER_STATS[id].name).join(' + '),members,stats:MONSTER_STATS[members[0]]}]),
  ['samurai',{id:'samurai',kind:'boss',stats:SAMURAI_STATS,update:updateSamurai,beforeUpdate:updateSamuraiPhase}],
]);
const actorTypes={monster:Mob,elite:Mob};
export const actorTypeFor=encounter=>encounter.Actor??actorTypes[encounter.kind]??Monster;
export function encounterFor(id){return ENCOUNTERS.get(id)??ENCOUNTERS.get('practice');}

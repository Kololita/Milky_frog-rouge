import {tunable} from './tuning-registry.js';
export const MONSTER_RULES=tunable('MONSTER_RULES',{knockDecay:9,floorBonusPerFloor:.02});
export const MOB_RULES=tunable('MOB_RULES',{hitProgress:.7,maxPrediction:1.6,maxPlayerSpeed:8,lockLead:.18,hurtRecovery:.45,approachTolerance:.05,freeMovementMin:.5,groupRangedRange:4,groupMeleeChaseRange:4});
export const MOB_AI_DEFAULTS=Object.freeze({startAnywhere:false,orbitDuration:0,rules:[]});

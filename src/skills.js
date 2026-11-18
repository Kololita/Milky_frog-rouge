import {tunable} from './tuning-registry.js';
export const SKILL_STATS=tunable('SKILL_STATS',{
 focus:{energyCost:35},
 shield:{energyCost:50,shield:50},
 longarm:{energyCost:30,duration:30,rangeBonus:.2},
 drain:{healthRatio:.3,duration:30,energyPerSecond:3,tick:.1},
});

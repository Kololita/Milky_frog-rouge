import {tunable} from './tuning-registry.js';

export const PROFESSIONS=tunable('PROFESSIONS',{
 metal:   {health:120,pose:60,orbElement:'normal',   resistances:{normal:20,water:5,fire:5,electric:0,melee:15,ranged:5}},
 wood:    {health:110,pose:55,orbElement:'normal',   resistances:{normal:5,water:15,fire:0,electric:10,melee:10,ranged:5}},
 water:   {health:100,pose:55,orbElement:'water',    resistances:{normal:5,water:30,fire:15,electric:0,melee:5,ranged:10}},
 rage:    {health:105,pose:45,orbElement:'fire',     resistances:{normal:10,water:0,fire:30,electric:10,melee:10,ranged:0}},
 earth:   {health:115,pose:70,orbElement:'normal',   resistances:{normal:15,water:0,fire:10,electric:15,melee:20,ranged:0}},
 fistwind:{health:95,pose:50,orbElement:'normal',    resistances:{normal:5,water:5,fire:10,electric:5,melee:0,ranged:20}},
 rain:    {health:100,pose:60,orbElement:'water',    resistances:{normal:5,water:25,fire:10,electric:0,melee:0,ranged:15}},
 thunder: {health:95,pose:45,orbElement:'electric',  resistances:{normal:5,water:10,fire:0,electric:30,melee:5,ranged:10}},
 electric:{health:90,pose:50,orbElement:'electric',  resistances:{normal:0,water:10,fire:5,electric:25,melee:0,ranged:15}},
});

export function professionFor(id){
 return Object.hasOwn(PROFESSIONS,id)?PROFESSIONS[id]:null;
}

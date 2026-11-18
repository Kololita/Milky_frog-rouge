import assert from 'node:assert/strict';
import {gameFixture} from './game_fixture.mjs';
import {PLAYER_STATS} from '../src/battle-values.js';
assert.equal(PLAYER_STATS.attackSpeed,1);
const g=await gameFixture();g.freezeEnemy=true;g.read('battle.enemy.z=30');g.tap('KeyJ');g.tick(.12);const slow=g.read('activeGesture.action.time');g.reset();g.read('PLAYER_STATS.attackSpeed=1;battle.enemy.z=30');g.tap('KeyJ');g.tick(.12);const normal=g.read('activeGesture.action.time');assert(Math.abs(slow/normal-1)<.02);PLAYER_STATS.attackSpeed=1;console.log('BASE_ATTACK_SPEED_VERIFIED',JSON.stringify({slow,normal,ratio:slow/normal}));

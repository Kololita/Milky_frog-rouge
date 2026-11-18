import {tunable} from './tuning-registry.js';
export const CharacterMode = Object.freeze({ FREE:'free', CHAIN:'chain' });
export const CHAIN_WINDOWS=tunable('CHAIN_WINDOWS',{ attack:.05, roll:.05, dodge:.05, block:.5 });

export function chainWindow(command) {
  if (command.startsWith('Attack') || command==='RunAttack'||command==='CounterWave') return CHAIN_WINDOWS.attack;
  if (command === 'DodgeRoll') return CHAIN_WINDOWS.roll;
  if (command.startsWith('Dodge')) return CHAIN_WINDOWS.dodge;
  return command === 'Block' ? CHAIN_WINDOWS.block : 0;
}

/** The control mode is authoritative even if an old animation handle remains. */
export function reconcileGesture(state,gesture,now) {
  state.update(now);
  return state.isFree ? undefined : gesture;
}

/** Commands lock locomotion; the link window starts when the command ends. */
export class CharacterState {
  constructor() { this.reset(); }
  reset() { this.mode=CharacterMode.FREE; this.command=null; this.until=-Infinity; this.freeAtDeadline=false; }
  get isFree() { return this.mode === CharacterMode.FREE; }
  begin(command) { this.mode=CharacterMode.CHAIN; this.command=command; this.until=Infinity; }
  finish(command, now) {
    if (this.command !== command) return false;
    this.command=null;
    const duration=chainWindow(command);
    this.until=now+duration;
    this.freeAtDeadline=command.startsWith('Dodge')||command.startsWith('Attack')||command==='RunAttack'||command==='CounterWave';
    this.mode=duration ? CharacterMode.CHAIN : CharacterMode.FREE;
    return true;
  }
  update(now) {
    const expired=this.freeAtDeadline?now>=this.until-1e-9:now>this.until;
    if (!this.isFree && !this.command && expired) { this.reset(); return true; }
    return false;
  }
}

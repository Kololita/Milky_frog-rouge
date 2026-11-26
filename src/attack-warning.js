export const attackWarningColor=attack=>attack?.unblockable?'#ff3030':'#ffffff';
export const ATTACK_PREVIEW_LEAD=1;
const FLASH_OFFSET=.2;
const FLASH_DURATION=.15;
export const attackWarningStart=impactAt=>Math.max(0,impactAt-ATTACK_PREVIEW_LEAD);
export function attackWarningActive(elapsed,impactAt){
 return Number.isFinite(impactAt)&&elapsed>=attackWarningStart(impactAt)-1e-9&&elapsed<impactAt-1e-9;
}
export const recoveryStrikeTime=strike=>Math.max(strike.at,ATTACK_PREVIEW_LEAD);

export function attackWarningRemaining(enemy){
 if(enemy.state!=='windup'||enemy.move?.skipWarning)return -1;
 const cue=enemy.hitAt??enemy.telegraph;
 return Number.isFinite(cue)?cue-enemy.elapsed:-1;
}

/** The warning brightens once, from 350 to 200 ms before impact. */
export function attackWarningPulse(enemy){
 const remaining=attackWarningRemaining(enemy)-FLASH_OFFSET;
 if(remaining<=0||remaining>=FLASH_DURATION)return 0;
 return Math.sin(Math.PI*(1-remaining/FLASH_DURATION));
}

export const warningPulseGLSL=`
float warningPulse(float remaining) {
 remaining-=${FLASH_OFFSET};
 return remaining>0. && remaining<${FLASH_DURATION} ? sin(3.14159265*(1.-remaining/${FLASH_DURATION})) : 0.;
}`;

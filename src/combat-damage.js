/** One damage formula for every actor; each actor owns its independent attack power. */
export function motionDamage(attacker,motionMultiplier,bonus=1){
  const power=Number.isFinite(attacker.attackPower)?Math.max(0,attacker.attackPower):0;
  const multiplier=attacker.damageMultiplier;
  const effects=Number.isFinite(multiplier)?Math.max(0,multiplier):1;
  return Math.round(power*Math.max(0,motionMultiplier)*Math.max(0,bonus)*effects*100)/100;
}

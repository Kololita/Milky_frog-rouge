import {createEnergyAbsorption} from './energy-absorption.js';
import {createFistWindEffects} from './fist-wind-effects.js';
import {createFlames} from './flame-view.js';
import {createGuardEffect} from './guard-effect.js';
import {createParryRecoil} from './parry-recoil.js';
import {createPotionAnimation} from './potion-animation.js';
import {createRageEyes} from './rage-eyes.js';
import {createSkillEffects} from './skill-effects.js';
import {createElementalAura} from './elemental-aura.js';
import {ELEMENTAL_ULTIMATES} from './elemental-ultimates.js';
import {createWeatherEffects} from './weather-effects.js';

// Effects own render resources; the combat controller supplies state and events.
export function createPlayerEffects(scene, player, document) {
  const guard = createGuardEffect(scene);
  const absorption = createEnergyAbsorption(scene);
  const burn = createFlames(player, {count:14, radius:.32, height:.9});
  const elemental = createElementalAura(scene,player);
  const weather = createWeatherEffects(scene);
  let hand, modelPivot, parry, potion, skills, wind, rage;

  function clear() {
    guard.clear();
    potion?.prepare();
    potion?.update({drinking:null});
    skills?.clear();
    absorption.clear();
    parry?.clear();
    wind?.clear();
    burn.update(false, 0);
    rage?.update(false);
    elemental.update(null,0);
    weather.clear();
    if(modelPivot)modelPivot.rotation.x=0;
  }

  return {
    bind({model, pivot, actions, clips, rightHand}) {
      hand = rightHand;
      modelPivot = pivot;
      rage = createRageEyes(model);
      absorption.bind(pivot, player);
      parry = createParryRecoil(model, player);
      skills = createSkillEffects(scene, model, player, document, actions);
      wind = createFistWindEffects(scene, model,player);
      potion = createPotionAnimation(model, clips);
    },
    async preload(renderer, budget) {
      await skills.preload(renderer, budget);
    },
    prime(heading) {
      guard.update(0, [{type:'blocked', grade:'perfect', counterReady:true}], hand, heading, true);
      absorption.update(.9, 1);
      potion.update({time:1, drinking:{start:0}});
      wind.update({time:1, player:{health:1, fistwindUntil:30}}, [], 0);
      burn.update(true, 1);
      rage.update(true);
      elemental.update({id:'water',start:0,until:2,stats:ELEMENTAL_ULTIMATES.water},1);
    },
    rollEarth:(dx,dz,radius)=>elemental.roll(dx,dz,radius),
    preparePose(prepareGrip) {
      potion?.prepare();
      skills?.prepare();
      absorption.prepare();
      prepareGrip?.();
      parry?.prepare();
    },
    applyPose(battle, dt, events, blocking) {
      absorption.update(battle.absorption ? battle.time-battle.absorption.start : null, battle.time);
      parry?.update(dt, events, blocking && !battle.backThrow);
      potion?.update(battle);
      burn.update(battle.player.health > 0 && battle.player.effects.has('burn'), battle.time);
      rage?.update(battle.isRaging());
      const effect=battle.activeElementalUltimate();
      if(effect?.id==='metal'){
        const phase=Math.min(1,(battle.time-effect.start)/effect.stats.recoilTime);
        modelPivot.rotation.x=-Math.sin(Math.PI*phase)*effect.stats.recoilAngle*(1-phase);
      }else modelPivot.rotation.x=0;
      elemental.update(effect,battle.time,battle.earthExit);
      weather.update(effect,battle.time,events,hand);
    },
    updateSkills(battle, camera, events, gesture, currentAction, allowLift, dt) {
      skills?.update(battle, camera, events, gesture, currentAction, allowLift);
      wind?.update(battle,events,dt,Math.max(0,modelPivot?.position.y??0));
    },
    updateGuard(battle, events, heading, dt) {
      guard.update(dt, events, hand, heading, battle.player.counterReady || Boolean(battle.absorption), battle.time);
    },
    resetStance() {
      parry?.clear();
      skills?.cancelPose();
      absorption.clear();
      guard.clear();
    },
    clear,
  };
}

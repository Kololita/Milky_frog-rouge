// A single registry keeps gameplay imports and the developer menu on the same objects.
const groups=new Map();
export function tunable(id,source){
  const clone=value=>Array.isArray(value)?value.map(clone):value&&typeof value==='object'?Object.defineProperties(Object.create(Object.getPrototypeOf(value)),Object.fromEntries(Object.entries(value).map(([k,v])=>[k,{value:clone(v),enumerable:true,writable:true,configurable:true}]))):value;
  const values=clone(source);groups.set(id,{id,values,defaults:clone(source)});return values;
}
export const tuningGroups=()=>[...groups.values()];
export function tuningFields(){
  const fields=[];
  const excluded=new Set(['PLAYER_STATS.guard','CAMERA.initialDistance','SAMURAI_STATS.windupTurnRate','SAMURAI_STATS.windup','SAMURAI_STATS.recovery','SAMURAI_STATS.reach','SAMURAI_STATS.halfAngle','SAMURAI_STATS.motionMultiplier','SAMURAI_STATS.startupResilience','SAMURAI_STATS.impactLevel']);
  function visit(group,value,path=[]){for(const [key,v] of Object.entries(value)){
    const next=[...path,key];
    const id=`${group.id}.${next.join('.')}`;
    if(next.includes('ai')&&(key==='move'||next.includes('cycle')))continue;
    if(typeof v==='number'&&Number.isFinite(v)&&!excluded.has(id)&&key!=='counterIndex')fields.push({id,group:group.id,path:next,value:v,default:next.reduce((o,k)=>o[k],group.defaults)});
    else if(v&&typeof v==='object')visit(group,v,next);
  }}
  for(const group of groups.values())visit(group,group.values);return fields;
}
export function tuningRange(field){
  const key=field.path.at(-1),v=field.default;
  const integer=/frames|Frame|Level|Resistance|Resilience|^health$|^pose$|^guard$|^max$|^maxStages$|^gain$|energyCost|^capacity$|^count$|^restGain$/.test(key);
  const positive=/^(health|pose|guard|max|duration|regenTick|energyCost|capacity|count|maxStages)$/.test(key);
  const min=v<0?v*3:v===0?0:integer?(positive?1:0):Math.min(.001,v/10);
  let max=Math.max(integer?10:.1,Math.abs(v)*3);
  if(/Opacity$|Ratio$|Fraction$|Chance$|^screenMargin$|^takeoff$|^contact$|^healthThreshold$|^damageReduction$/.test(key))max=1;
  if(field.path.includes('resistances'))return {min:0,max:100,step:1};
  if(key==='playerResistanceCap')return {min:0,max:99.99,step:.01};
  if(key==='specialistConversion')return {min:0,max:1,step:.01};
  if(key==='halfAngle'||key==='reverseAngle')max=Math.PI;
  if(key==='heightMin'||key==='heightMax')max=6;
  if(key==='contactPhase')max=.7;
  if(key==='impactLevel')max=3;
  return {min,max,step:integer?1:Math.max(.0001,10**(Math.floor(Math.log10(Math.abs(v)||1))-2))};
}
export function applyTuning(patch={}){
  for(const field of tuningFields()){
    const value=patch[field.id]??field.default,{min,max}=tuningRange(field);
    if(!Number.isFinite(value)||value<min||value>max)throw new Error(`参数超出范围：${field.id}`);
    if(['impactLevel','startupResilience'].includes(field.path.at(-1))&&!Number.isInteger(value))throw new Error('冲击力和出手韧性必须是非负整数');
  }
  const get=id=>patch[id]??tuningFields().find(f=>f.id===id)?.default;
  const ordered=ids=>{for(let i=1;i<ids.length;i++)if(get(ids[i])<=get(ids[i-1]))throw new Error('时间节点、格挡档位必须依次递增');};
  for(const field of tuningFields())if(field.path.at(-1)==='heightMin'){
    const top=field.id.replace(/heightMin$/,'heightMax');if(get(top)<=get(field.id))throw new Error('判定顶部高度必须大于底部高度');
  }
  ordered(['BACK_THROW.slamTakeoff','BACK_THROW.slamApex','BACK_THROW.impact','BACK_THROW.flipStart','BACK_THROW.duration']);
  ordered(['ENERGY_STATS.raiseEnd','ENERGY_STATS.rainEnd','ENERGY_STATS.glowEnd','ENERGY_STATS.duration']);
  ordered([0,1,2,3].map(i=>`GUARD_TIERS.${i}.maxFrames`));
  ordered(['DODGE_TUNING.forwardAngle','DODGE_TUNING.backwardAngle']);
  ordered(['GUARD_EFFECT.absorbStart','GUARD_EFFECT.absorbEnd']);
  if(get('SAMURAI_RECOVERY.extractMin')>get('SAMURAI_RECOVERY.extractMax'))throw new Error('Boss拔剑时间的最小值不能大于最大值');
  if(get('SAMURAI_TRANSITION.strikeAt')>=get('SAMURAI_TRANSITION.duration'))throw new Error('转阶段雷击必须发生在动作结束前');
  if(get('SAMURAI_PHASES.phase3.healthThreshold')>=get('SAMURAI_PHASES.phase2.healthThreshold'))throw new Error('三阶段生命阈值必须低于二阶段');
  for(const group of groups.values()){
    if(group.id==='MOBILITY_TIMING')for(const name of Object.keys(group.values))ordered([`${group.id}.${name}.takeoff`,`${group.id}.${name}.contact`]);
    if(group.id==='ATTACK_STATS')for(const [name,move] of Object.entries(group.values)){
      if(move.times.length>1)ordered(move.times.map((_,i)=>`${group.id}.${name}.times.${i}`));
      const end={Attack1:.66,Attack2:.87,Attack3:.97,Attack4:1.18,CounterWave:1.18,RunAttack:.75,AirAttack:1.75}[name];
      if(move.times.some((_,i)=>get(`${group.id}.${name}.times.${i}`)>end))throw new Error('命中时刻不能超出对应攻击动画');
    }
  }
  for(const field of tuningFields()){
    const group=groups.get(field.group),parent=field.path.slice(0,-1).reduce((o,k)=>o[k],group.values);
    parent[field.path.at(-1)]=patch[field.id]??field.default;
  }
}

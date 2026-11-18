import {defaultLifeDamage,isDamagingMove} from '../src/enemy-move.js';
const number=n=>Number(n.toFixed(3));
const seconds=n=>`${number(n)}秒`;
const columns={
 melee:['蓄势/准备','攻击时长','动作倍率','默认生命伤害','基础破绷','距离','半角','高度区间','刀后恢复','出手韧性','冲击力'],
 projectile:['蓄势/准备','攻击时长','动作倍率','默认生命伤害','基础破绷','射程','弹速','弹体数量','弹体半径','发射高度','散射间角','基础预判提前量','刀后恢复','出手韧性','冲击力'],
 parry:['蓄势/准备','架势时长','检测距离','半角','高度区间','弹反冲击上限','成功僵直','刀后恢复','出手韧性'],
 buff:['蓄势/准备','释放时长','攻击力增幅','增幅持续','作用对象','刀后恢复','出手韧性'],
 movement:['蓄势/准备','位移时长','位移距离','刀后恢复','出手韧性'],
};
const titles={melee:'近战攻击',projectile:'远程攻击',parry:'架势',buff:'增幅',movement:'位移'};
function values(move,power){return {
 '蓄势/准备':seconds(move.prepare),'攻击时长':seconds(move.swing),'架势时长':seconds(move.swing),'释放时长':seconds(move.swing),'位移时长':seconds(move.swing),
 '动作倍率':move.motionMultiplier,'默认生命伤害':defaultLifeDamage(move,power),'基础破绷':move.poseDamage,'距离':`${move.reach}米`,'检测距离':`${move.reach}米`,'半角':`${Math.round(move.halfAngle*180/Math.PI)}度`,
 '高度区间':`${move.heightMin}～${move.heightMax}米`,'刀后恢复':`${seconds(move.link??move.recovery)}${move.link?'（连段间）':''}`,'出手韧性':move.startupResilience,'冲击力':move.impactLevel,
 '射程':`${move.projectile?.range}米`,'弹速':`${move.projectile?.speed}米/秒`,'弹体数量':move.projectile?.count,'弹体半径':`${move.projectile?.radius}米`,'发射高度':`${move.projectile?.height}米`,
 '散射间角':`${move.projectile?.spread}弧度`,'基础预判提前量':seconds(move.projectile?.lead??0),
 '弹反冲击上限':move.maxParryImpact,'成功僵直':seconds(move.recoil??0),'攻击力增幅':`${number((move.effect?.amount??0)*100)}%`,'增幅持续':seconds(move.effect?.duration??0),'作用对象':'所有友方（含自己）','位移距离':`${move.retreat}米（后撤）`,
};}
export function renderMoveTables(stats){
 const lines=['## 招式',''];
 for(const [kind,originalHeader] of Object.entries(columns)){
  const header=['出手韧性',...originalHeader.filter(column=>column!=='出手韧性')];
  const moves=stats.moves.filter(move=>(move.kind??'melee')===kind);if(!moves.length)continue;
  lines.push(`### ${titles[kind]}`,'',`| 招式 | ${header.join(' | ')} |`,`| --- | ${header.map(()=>'---').join(' | ')} |`);
  for(const move of moves){const row=values(move,stats.attackPower);lines.push(`| ${move.label} | ${header.map(column=>row[column]).join(' | ')} |`);}
  lines.push('');
 }
 return lines.join('\n');
}
export function parseMoveTables(text){
 const result=new Map();let header=null;
 for(const line of text.split('\n')){
  const cells=line.split('|').slice(1,-1).map(s=>s.trim());
  if(line.startsWith('| 招式 |')){header=cells;continue;}
  if(!header||!line.startsWith('|')||/^\|\s*---/.test(line))continue;
  result.set(cells[0],Object.fromEntries(header.map((key,i)=>[key,cells[i]])));
 }
 return result;
}
export const moveDurationColumn=move=>isDamagingMove(move)?'攻击时长':({parry:'架势时长',buff:'释放时长',movement:'位移时长'}[move.kind]);

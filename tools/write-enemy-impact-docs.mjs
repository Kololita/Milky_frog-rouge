import {isDamagingMove} from '../src/enemy-move.js';
import {formatEnemyDesigns} from './format-enemy-designs.mjs';
import fs from 'node:fs/promises';
import {MONSTER_STATS} from '../src/monster-catalog.js';
import {SAMURAI_MOVES} from '../src/samurai.js';
import {ENEMY_STATS} from '../src/battle-values.js';
await formatEnemyDesigns();
const rows=[['训练人偶','出拳',ENEMY_STATS],...Object.values(MONSTER_STATS).flatMap(s=>s.moves.map(m=>[s.name,m.label,m])),...Object.entries(SAMURAI_MOVES).flatMap(([pattern,moves])=>moves.map(m=>['samurai',m.label,m]))];
const table=[];
for(const [kind,label] of Object.entries({melee:'近战攻击',projectile:'远程攻击',parry:'架势',buff:'增幅',movement:'位移'})){
 const items=rows.filter(([, ,move])=>(move.kind??'melee')===kind);if(!items.length)continue;
 const damage=isDamagingMove(items[0][2]);
 table.push('### '+label,'','| 敌人 | 招式 | 出手韧性 |'+(damage?' 冲击力 |':''),'| --- | --- | ---: |'+(damage?' ---: |':''),...items.map(([name,label,move])=>'| '+name+' | '+label+' | '+move.startupResilience+' |'+(damage?' '+move.impactLevel+' |':'')),'');
}
await fs.writeFile('docs/敌人冲击与出手韧性.md',[
 '# 敌人冲击与出手韧性','',
 '所有敌方招式具有出手韧性，攻击招式另有冲击力：`startupResilience`（出手韧性）和 `impactLevel`（冲击力）。它们不改变生命伤害或基础破绷。',
 '','## 出手韧性','',
 '出手韧性是该招准备及攻击期间的**总冲击耐受**，替代当前怪物的基础耐受，不与基础值相加。有效冲击等级=max(0，来袭冲击力−当前耐受)。出招结束、受击中断、倒地或收招时恢复基础耐受。',
 '','例如基础耐受1、招式韧性2：出招时受到三级冲击按一级处理，收招时按二级处理。韧性3可抵消目前最高三级普通冲击；它是可配置的有限值，不再另用旧招式霸体开关覆盖出手韧性。武士已取消完美弹反次数累计与固定晕眩，转阶段期间独立获得霸体。',
 '','## 敌方冲击力作用于玩家','',
 '| 冲击力 | 未格挡时的反应 |','| ---: | --- |',
 '| 0 | 扣生命与绷住，不产生普通受击动作、不取消正在攻击 |',
 '| 1 | 0.24秒受击硬直、0.12米击退 |',
 '| 2 | 0.72秒受击硬直、0.85米击退 |',
 '| 3 | 合计1.2秒强受击锁定、1.2米击退 |',
 '','成功格挡不受普通冲击反应；破防继续采用独立0.8秒硬直。怒气霸体仍承受伤害与破绷，但免疫上述普通受击。绷住归0强制大笑和死亡优先级保持原样。防守架势、增幅、纯位移动作不具有伤害、破绷、冲击力，统一查询结果为-1；镜盾侍弹反成功的短暂反馈与其后冲击力2的回斩分别处理。',
 '','远程弹体在发射时记录冲击力，之后修改配置不影响已经飞行的弹体。敌人被三级冲击击退后晕眩的原流程保持不变；玩家使用上表对应受击动画与锁定时长。',
 '','## 当前逐招配置','',...table,'',
 '开发者模式每招均提供“出手韧性”“冲击力”整数滑条；攻击招式冲击力范围0～3；非攻击招式不提供伤害与冲击力滑条，出手韧性可继续增加。配置在 `src/monster-catalog.js`、`src/samurai.js` 和训练人偶的 `src/battle-values.js`。同名怪在所有组合中共用配置。',
 '','表格可用 `node tools/write-enemy-impact-docs.mjs` 同步，脚本只更新这些列，不覆盖手写怪物设计正文。','',
].join('\n'));
const path='docs/monsters/武士.md',doc=await fs.readFile(path,'utf8');
const block=['<!-- enemy-impact-params:start -->','## 招式出手韧性与冲击力','',
 '出招期间使用该刀的出手韧性作为总耐受，收招与自由态恢复基础耐受1；不叠加。出手韧性3抵消当前最高三级普通冲击，快刀韧性1可被二级以上打断。武士不再累计完美弹反次数，转阶段5秒内保持霸体、不可背摔并减伤40%。','',
 '| 招式 | 出手韧性 | 冲击力 |','| --- | ---: | ---: |',...Object.values(SAMURAI_MOVES).flat().map(m=>`| ${m.label} | ${m.startupResilience} | ${m.impactLevel} |`),'','完整规则见 [敌人冲击与出手韧性](../敌人冲击与出手韧性.md)。','<!-- enemy-impact-params:end -->'].join('\n');
await fs.writeFile(path,doc.includes('<!-- enemy-impact-params:start -->')?doc.replace(/<!-- enemy-impact-params:start -->[\s\S]*?<!-- enemy-impact-params:end -->/,()=>block):doc.trimEnd()+'\n\n'+block+'\n');
console.log(`ENEMY_IMPACT_DOCS_WRITTEN: ${rows.length} moves, 8 monster tables and samurai`);

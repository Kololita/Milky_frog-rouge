import fs from 'node:fs/promises';
import {MONSTER_STATS} from '../src/monster-catalog.js';
import {FORMATIONS,ENCOUNTER_POOLS} from '../src/encounter-formations.js';
import {formatEnemyDesigns} from './format-enemy-designs.mjs';
await formatEnemyDesigns();
await fs.writeFile('docs/monsters/README.md',`# 怪物设计索引

[怪物与小怪通则、招式类别及建模规范](./怪物通则.md)

${Object.entries(MONSTER_STATS).map(([id,s])=>`- [${s.name}](./${s.name}.md)：${ENCOUNTER_POOLS.elite.includes(id)?'精英':'小怪'}，${s.moves.length}招。`).join('\n')}

- [武士](./武士.md)：首领外形、全部招式、数值与机制。
- [训练人偶](./训练人偶.md)：练习场建模提示词。

## 组合战斗

地图共15层，只显示战斗、精英、休息处和首领类型，不提前透露敌人。前两次实际进入的普通战斗从弱怪池选择，之后从强怪池选择；精英和休息不占次数，取消配装不计数、不重抽。弱／强只代表阵容池，没有给同名怪添加强弱属性或暗中增幅。

弱怪池为拳兵、刺壳虫、灯笼灵单独出场。强怪池为镜盾侍单独出场和以下八种双怪组合：

${Object.entries(FORMATIONS).map(([id,members])=>`- ${members.map(id=>MONSTER_STATS[id].name).join(' + ')}（\`${id}\`）`).join('\n')}

每个强怪阵容至少有一个远程施压者。灯笼灵带增幅、近身震波与远程灯火，弩尾蜥会独立后撤、晶矢三射和侧绕，镜盾侍会弹反轻拳与投镜；同伴提供贴身或冲锋压力。预判射击不会飞行中追踪，仍可通过闪避、格挡、贴身打断或绕后击破。

每只敌人独立行动、血量、受击、霸体、晕眩、背摔、碰撞。全灭后只进行一次装备二选一。近战和冲击波可同时打中范围内多只敌人，独立显示连击伤害数字。Q锁定最近存活目标，再按Q取消；目标死亡解除锁定，可再按Q锁定其他目标。

灯笼灵发现玩家后优先原地咏唱增幅，所有存活友方含自己攻击力增加20%，持续30秒；同类效果刷新时长、不叠乘。准备可打断；死亡不提前移除队友增幅。受益单位脚下有金色环，不改变基础破绷。刺壳虫远处冲锋、近处环刺，与灯笼辅助互补。

## 文档格式

统一为标识／类别、外形、基础数值、招式表、逐招行为与应对。伤害由攻击力×动作倍率计算，位移与命中范围分开说明。阵容及池位于\`src/encounter-formations.js\`，不再重复维护独立怪物池。

灯笼灵、刺壳虫与弩尾蜥保留手写设计；\`node tools/write-monster-docs.mjs\`更新其余五份文档与本索引。武士的完整设计统一维护在[武士](./武士.md)。
`);
console.log('MONSTER_DESIGNS_FORMATTED: individual prose preserved, moves grouped by category');
await import('./write-enemy-impact-docs.mjs');

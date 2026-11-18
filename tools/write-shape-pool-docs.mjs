import fs from 'node:fs/promises';
import {AUTHORED_SHAPE_POOLS} from '../src/equipment-shape-data.js';
const names={armor:'护甲',weapon:'武器',accessory:'护符',skill:'技能'};
let doc='# 占地形状池\n\n同类型同品质共享池，奖励生成时随机确定并固定。各候选等概率，权重为属性形状倍率。\n\n';
for(const [type,grades]of Object.entries(AUTHORED_SHAPE_POOLS)){doc+=`## ${names[type]}形状池\n\n`;for(const [rarity,entries]of Object.entries(grades)){doc+=`### ${rarity}\n\n`;for(const entry of entries)doc+=`#### ${entry.id}\n\n权重：${entry.weight.toFixed(2)}\n\n\`\`\`text\n${entry.shape.join('\n')}\n\`\`\`\n\n`;}}
await fs.writeFile('docs/equipment/占地形状池.md',doc);

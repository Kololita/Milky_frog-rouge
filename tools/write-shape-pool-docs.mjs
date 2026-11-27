import fs from 'node:fs/promises';
import {AUTHORED_SHAPE_POOLS,SHAPE_CATALOG} from '../src/equipment-shape-data.js';

const file=new URL('../docs/equipment/占地形状池.md',import.meta.url);
const previous=(await fs.readFile(file,'utf8')).replaceAll('\r\n','\n');
const intro=previous.split(/^## /m)[0].trimEnd();
const rules=previous.split(/^## /m).find(section=>section.startsWith('使用规则\n'))?.trimEnd();
const poolNames={armor:'护甲',weapon:'武器',accessory:'护符'};
const rarities=['white','green','blue','purple','gold'];
const fixed={
 长臂:'skill-fixed-longarm',汲能:'skill-fixed-drain',
 护盾:'skill-fixed-shield',聚能:'skill-fixed-focus',无相玉:'white-single',
};

let document=intro+'\n\n## 形状目录\n\n';
for(const rarity of rarities){
 document+=`### ${rarity}\n\n`;
 for(const [id,shape] of Object.entries(SHAPE_CATALOG[rarity])){
  document+=`#### ${id}\n\n\`\`\`text\n${shape.join('\n')}\n\`\`\`\n\n`;
 }
}
for(const [type,name] of Object.entries(poolNames)){
 document+=`## ${name}形状池\n\n`;
 for(const rarity of rarities){
  const tags=AUTHORED_SHAPE_POOLS[type][rarity].map(({id,weight})=>`- \`${id}\` ${weight.toFixed(2)}`).join('\n');
  document+=`### ${rarity}\n\n${tags}\n\n`;
 }
}
document+='## 固定形状\n\n';
for(const [item,id] of Object.entries(fixed))document+=`### ${item}\n\n\`${id}\`\n\n`;
if(rules)document+='## '+rules+'\n';
await fs.writeFile(file,document.trimEnd()+'\n');

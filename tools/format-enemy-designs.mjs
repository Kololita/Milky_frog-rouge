import fs from 'node:fs/promises';
import {MONSTER_STATS} from '../src/monster-catalog.js';
import {SAMURAI_STATS} from '../src/samurai.js';
import {ENEMY_STATS} from '../src/battle-values.js';
import {renderMoveTables} from './enemy-design-tables.mjs';

export async function formatEnemyDesigns(){
 for(const stats of Object.values(MONSTER_STATS)){
  const path=`docs/monsters/${stats.name}.md`;let text=await fs.readFile(path,'utf8');
  text=text.replace(/### 交付与绑定要求[^\n]*\n[\s\S]*?(?=\n## |$)/,'');
  text=text.replace(/## 招式\s*\n[\s\S]*?(?=\n## |$)/,renderMoveTables(stats)+'\n');
  // These are inherited contracts, not individual enemy mechanics.
  text=text.split('\n\n').filter(paragraph=>!paragraph.startsWith('自由移动限速转向，')&&!paragraph.startsWith('实现：')).join('\n\n');
  text=writeCapabilities(text,stats);
  if(!text.includes('[怪物与小怪通则]'))text=text.replace(/(- 类别：[^\n]*\n)/,'$1\n共有规则与建模交付规范见[怪物与小怪通则](./怪物通则.md)，本页仅列个体参数与特有机制。\n');
  text=text.replace(/\n{3,}/g,'\n\n');await fs.writeFile(path,text);
 }
 for(const [name,stats]of [['武士',SAMURAI_STATS],['训练人偶',ENEMY_STATS]]){const path=`docs/monsters/${name}.md`;try{await fs.access(path);}catch(error){if(error.code==='ENOENT')continue;throw error;}await fs.writeFile(path,writeCapabilities(await fs.readFile(path,'utf8'),stats));}
}

function writeCapabilities(text,stats){
 const throwable=stats.backThrowable!==false&&(stats.throwOverride===true||stats.bodyPlan!=='nonhumanoid');
 const rows=`| 基础韧性（冲击耐受） | ${stats.impactResistance??0} |\n| 能否背摔 | ${throwable?'是':'否'} |\n| 体型分类 | ${stats.bodyPlan==='nonhumanoid'?'非人形':'人形'} |\n`;
 text=text.replace(/^\| (?:基础韧性（冲击耐受）|冲击耐受|能否背摔|体型分类) \|[^\n]*\r?\n/gm,'');
 const block=text.match(/## (?:基础数值|战斗资格)[^\n]*\n[\s\S]*?(?=\n## |$)/);
 if(block){const section=block[0],separator=section.match(/^\|[ \t:|\-]+\|[ \t]*$/m);if(separator){const index=separator.index+separator[0].length;return text.replace(section,section.slice(0,index)+'\n'+rows.trimEnd()+section.slice(index));}}
 return text.replace(/(# [^\n]*\n)/,'$1\n## 战斗资格\n\n| 参数 | 当前值 |\n| --- | --- |\n'+rows+'\n');
}

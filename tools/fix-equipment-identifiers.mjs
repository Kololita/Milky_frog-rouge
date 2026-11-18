import fs from 'node:fs/promises';
import {EQUIPMENT_DATA as data} from '../src/equipment-data.js';
let n=0;for(const item of data)if(!item.id){const pair=[['玄铁甲','armor-blackiron'],['行医护甲','armor-healer']][n++];[item.name,item.id]=pair;}
await fs.writeFile('src/equipment-data.js','export const EQUIPMENT_DATA='+JSON.stringify(data,null,2)+';\n');let doc=await fs.readFile('docs/equipment/装甲.md','utf8');for(const [name,id]of [['玄铁甲','armor-blackiron'],['行医护甲','armor-healer']])doc=doc.replace('### 品质：蓝。','### '+name).replace('标识：`undefined`。',`标识：\`${id}\`。`);await fs.writeFile('docs/equipment/装甲.md',doc);

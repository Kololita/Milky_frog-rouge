import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const referenceFiles=['README.md','samurai_design.md','index.html'];
for(const dir of ['docs','src'])for(const entry of await fs.readdir(path.join(root,dir),{withFileTypes:true})){
 if(entry.isFile()&&/\.(md|js|css|html)$/i.test(entry.name))referenceFiles.push(`${dir}/${entry.name}`);
}
const text=(await Promise.all(referenceFiles.map(file=>fs.readFile(path.join(root,file),'utf8')))).join('\n').toLowerCase();
const sources=new Set(['奶蛙.png','奶娃三视图.webp','奶蛙大笑.gif']);
const keep=[],remove=[];
for(const name of await fs.readdir(path.join(root,'docs'))){
 if(!/\.(?:png|jpe?g|webp|gif)$/i.test(name))continue;
 const file=path.join(root,'docs',name),stat=await fs.stat(file);if(!stat.isFile())continue;
 const referenced=text.includes(name.toLowerCase())||text.includes(encodeURIComponent(name).toLowerCase());
 (referenced||sources.has(name)?keep:remove).push({name,path:file,bytes:stat.size,reason:referenced?'referenced':sources.has(name)?'source reference':'unreferenced debug image'});
}
const report={keep,remove,removedBytes:remove.reduce((sum,file)=>sum+file.bytes,0)};
await fs.writeFile(path.join(root,'output/docs-image-cleanup.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({keep:keep.length,remove:remove.length,removedBytes:report.removedBytes,kept:keep.map(file=>file.name)}));

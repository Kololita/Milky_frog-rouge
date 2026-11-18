import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const ids=process.argv.slice(2);
if(!ids.length)throw new Error('Specify validated model IDs');
for(const id of ids){
 if(!/^[a-zA-Z][a-zA-Z0-9]*$/.test(id))throw new Error('Invalid model ID');
 const source=path.join(root,'assets-source/blender',id+'.glb');
 const reference=path.join(root,'assets-source/blender/reference',id+'.glb');
 await fs.mkdir(path.dirname(reference),{recursive:true});
 try{await fs.copyFile(source,reference,fs.constants.COPYFILE_EXCL);}catch(e){if(e.code!=='EEXIST')throw e;}
 const output=await fs.readFile(path.join(root,'public/models/enemies',id+'.glb'));
 if(output.toString('ascii',0,4)!=='glTF')throw new Error('Invalid GLB');
 await fs.writeFile(source+'.tmp',output);await fs.rename(source+'.tmp',source);
 console.log('Published',id,output.length);
}

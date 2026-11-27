import {AUTHORED_SHAPE_POOLS,LEGACY_SHAPE_POOLS,SHAPE_CATALOG} from './equipment-shape-data.js';
/** Unit-square shapes shared by equipment type and rarity. Rotation never changes power. */
export function shapeCells(shape,rotation=0){
 let cells=shape.flatMap((row,y)=>[...row].flatMap((cell,x)=>(cell==='#'||cell==='*')?[[x,y]]:[]));
 for(let i=0;i<((rotation%4)+4)%4;i++)cells=cells.map(([x,y])=>[-y,x]);
 const minX=Math.min(...cells.map(c=>c[0])),minY=Math.min(...cells.map(c=>c[1]));
 return cells.map(([x,y])=>[x-minX,y-minY]);
}
export function shapeSize(cells){return {width:Math.max(...cells.map(c=>c[0]))+1,height:Math.max(...cells.map(c=>c[1]))+1};}
const layouts={
 white:{domino:['##'],bar:['###'],elbow:['#.','##']},
 green:{square:['##','##'],tee:['###','.#.'],zig:['.##','##.'],hook:['#..','###'],cross:['.#.','###','.#.']},
 blue:{block:['###','###'],fork:['####','#..#'],stair:['##.','.##','.##'],guard:['#.#','###','#.#'],hook:['#..','##.','###','..#']},
 purple:{bridge:['##.##','.###.','.#.#.'],claw:['###.','#.##','###.'],gate:['#..#','####','.##.'],step:['###','.##','###'],river:['##..','.###','..##','...#']},
 gold:{e:['###','#..','###','#..','###'],titan:['###.#','#.###','###..'],crown:['##.##','.###.','#####'],star:['..#..','.###.','#####','.###.','..#..']},
};
export const SHAPE_TYPE_LABELS={armor:'护甲',weapon:'武器',accessory:'护符',skill:'技能'};
export const equipmentShapeType=item=>({armor:'armor',gloves:'weapon',charm:'accessory',skill:'skill'})[item.slot];
export const SHAPE_REFERENCE_AREA={white:2,green:4,blue:6,purple:8,gold:11};
function rotations(shape){const unique=new Map();for(let r=0;r<4;r++){const c=shapeCells(shape,r).sort(([a,b],[x,y])=>b-y||a-x);unique.set(JSON.stringify(c),c);}return [...unique.values()];}
/** Empty-board placement density includes orientation freedom and 4/5/6-wide fit. */
export function analyzeShape(shape){
 const cells=shapeCells(shape),area=cells.length,{width,height}=shapeSize(cells),set=new Set(cells.map(String)),has=(x,y)=>set.has(`${x},${y}`);
 let perimeter=0,concave=0,corners=0;
 for(const [x,y]of cells)for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])if(!has(x+dx,y+dy))perimeter++;
 for(let y=0;y<=height;y++)for(let x=0;x<=width;x++){
  const a=has(x-1,y-1),b=has(x,y-1),c=has(x-1,y),d=has(x,y),n=Number(a)+Number(b)+Number(c)+Number(d);
  if(n===3)concave++;if(n===1||n===3)corners++;else if(n===2&&a===d)corners+=2;
 }
 const variants=rotations(shape);let density=0;
 for(const [n,weight]of [[4,.5],[5,.3],[6,.2]])density+=weight*variants.reduce((sum,c)=>{const s=shapeSize(c);return sum+Math.max(0,n-s.width+1)*Math.max(0,n-s.height+1);},0)/(4*n*n);
 const compactness=area/(width*height),edgeExcess=Math.max(0,perimeter-4*Math.sqrt(area))/(2*area);
 const difficulty=Math.min(1,.3*(1-compactness)+.25*Math.min(1,concave/4)+.15*Math.min(1,edgeExcess)+.3*(1-density));
 return {area,width,height,perimeter,corners,concave,compactness,fitDensity:density,difficulty};
}
const fallbackShapes=Object.fromEntries(Object.entries(layouts).flatMap(([rarity,entries])=>Object.entries(entries).map(([name,shape])=>{
 const metrics=analyzeShape(shape),id=`${rarity}-${name}`;
 // At most 0.75 extra cell-equivalents: more cells always grant more power within a rarity.
 return [id,{id,rarity,shape,metrics,multiplier:Number(((metrics.area+.75*metrics.difficulty)/SHAPE_REFERENCE_AREA[rarity]).toFixed(6))}];
})));
export const SHAPES={...fallbackShapes};
const ids=(rarity,names)=>names.map(name=>`${rarity}-${name}`);
const pool=choices=>Object.fromEntries(Object.entries(choices).map(([rarity,names])=>[rarity,ids(rarity,names)]));
export const SHAPE_POOLS={
 armor:pool({white:['domino','elbow','bar'],green:['square','tee','hook'],blue:['block','guard','hook'],purple:['bridge','step','claw'],gold:['e','crown','star']}),
 weapon:pool({white:['domino','bar','elbow'],green:['hook','zig','cross'],blue:['fork','hook','guard'],purple:['gate','river','claw'],gold:['titan','e','crown']}),
 accessory:pool({white:['domino','elbow','bar'],green:['tee','zig','cross'],blue:['stair','guard','hook'],purple:['river','bridge','step'],gold:['star','crown','e']}),
 skill:pool({white:['elbow','domino','bar'],green:['cross','tee','hook'],blue:['fork','stair','guard'],purple:['bridge','gate','river'],gold:['star','e','titan']}),
};
for(const [rarity,shapes] of Object.entries(SHAPE_CATALOG)){
 for(const [id,shape] of Object.entries(shapes)){
  SHAPES[id]={id,rarity,shape,metrics:analyzeShape(shape)};
 }
}
const fixedIds={longarm:'skill-fixed-longarm',drain:'skill-fixed-drain',shield:'skill-fixed-shield',focus:'skill-fixed-focus','charm-empty-forge':'white-single'};
export const FIXED_SKILL_SHAPES=Object.fromEntries(Object.entries(fixedIds).filter(([id])=>id!=='charm-empty-forge').map(([id,shapeId])=>[id,SHAPES[shapeId].shape]));
const fixedShapes=Object.fromEntries(Object.entries(fixedIds).map(([id,shapeId])=>[id,{...SHAPES[shapeId],multiplier:1}]));
const weightedPools={};
for(const [type,grades] of Object.entries(AUTHORED_SHAPE_POOLS)){
 weightedPools[type]={};
 for(const [rarity,list] of Object.entries(grades)){
  weightedPools[type][rarity]=list.map(({id,weight})=>({...SHAPES[id],multiplier:weight}));
  SHAPE_POOLS[type][rarity]=list.map(({id})=>id);
 }
}
const legacyPools=Object.fromEntries(Object.entries(LEGACY_SHAPE_POOLS).map(([type,list])=>
 [type,list.map(({id,rarity,shape,weight})=>({id,rarity,shape,metrics:analyzeShape(shape),multiplier:weight}))]));
export function shapePoolFor(item){
 const fixed=fixedShapes[item.id];
 if(fixed)return [fixed];
 const type=equipmentShapeType(item),rarity=item.rarity;
 return weightedPools[type]?.[rarity]??(SHAPE_POOLS[type]?.[rarity]??[]).map(id=>fallbackShapes[id]);
}
export const defaultShapeFor=item=>shapePoolFor(item)[0]?.shape;
export function shapeForRoll(item,id){
 if(!item||!id)return undefined;
 const active=shapePoolFor(item).find(shape=>shape.id===id);
 if(active)return active;
 if(item.id==='charm-empty-forge'&&id==='charm-empty-forge-fixed')return {...fixedShapes[item.id],id};
 if(fixedShapes[item.id])return undefined;
 const legacy=legacyPools[equipmentShapeType(item)]??[];
 const sameRarity=legacy.find(shape=>shape.id===id&&shape.rarity===item.rarity);
 if(sameRarity||!item.previousRarity)return sameRarity;
 // Existing copies retain the footprint from before this item changed rarity.
 const oldRarity=item.previousRarity;
 return shapePoolFor({...item,rarity:oldRarity}).find(shape=>shape.id===id)
  ??legacy.find(shape=>shape.id===id&&shape.rarity===oldRarity);
}

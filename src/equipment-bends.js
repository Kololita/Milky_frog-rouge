/** Cells retain identities and original hinge-side membership after every fold. */
export function createBendState(shape){
 const cells=[];shape.forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='#'||c==='*')cells.push({id:cells.length,x,y,pivot:c==='*'});}));
 const pivots=[];const state={cells,pivots};
 for(const c of cells.filter(c=>c.pivot)){c.pivot=false;const hinge=hingeAt(state,c.id);if(hinge){c.pivot=true;pivots.push(hinge);}}
 return {cells,pivots};
}
export function hingeAt(state,id){
 const c=state.cells.find(c=>c.id===id);if(!c||c.pivot)return null;
 const neighbors=p=>state.cells.filter(n=>n.id!==p.id&&Math.max(Math.abs(n.x-p.x),Math.abs(n.y-p.y))===1);
 const ns=neighbors(c);if(ns.length!==2)return null;
 const diagonal=n=>Math.abs(n.x-c.x)===1&&Math.abs(n.y-c.y)===1;
 if(!(ns.every(diagonal)||(ns.every(n=>!diagonal(n))&&ns[0].x+ns[1].x===2*c.x&&ns[0].y+ns[1].y===2*c.y)))return null;
 const side=start=>{const seen=new Set([id]),todo=[start],ids=[];while(todo.length){const n=todo.pop();if(seen.has(n.id))continue;seen.add(n.id);ids.push(n.id);todo.push(...neighbors(n));}return ids;};
 const a=side(ns[0]),b=side(ns[1]);if(a.some(id=>b.includes(id)))return null;
 const pivot={id,sides:[a,b],moving:a.length<=b.length?a:b};
 return turnBend({...state,pivots:[pivot]},0)?pivot:null;
}
export function addHinge(state,id){const pivot=hingeAt(state,id);if(!pivot)return null;return {cells:state.cells.map(c=>({...c,pivot:c.pivot||c.id===id})),pivots:[...state.pivots,pivot]};}
export function hingeCandidates(state){return state.cells.filter(c=>hingeAt(state,c.id)).map(c=>c.id);}
export function isEightConnected(cells){if(!cells.length)return false;const seen=new Set(),todo=[cells[0]];while(todo.length){const n=todo.pop();if(seen.has(n.id))continue;seen.add(n.id);todo.push(...cells.filter(c=>c.id!==n.id&&Math.max(Math.abs(c.x-n.x),Math.abs(c.y-n.y))===1));}return seen.size===cells.length;}
export function turnBend(state,index){
 const pivot=state.pivots[index];if(!pivot)return null;
 const center=state.cells.find(c=>c.id===pivot.id),moving=new Set(pivot.moving);
 for(let turns=1;turns<=3;turns++){
  const cells=state.cells.map(c=>{let x=c.x-center.x,y=c.y-center.y;if(moving.has(c.id))for(let k=0;k<turns;k++)[x,y]=[-y,x];return {...c,x:x+center.x,y:y+center.y};});
  if(new Set(cells.map(c=>`${c.x},${c.y}`)).size!==cells.length)continue;
  if(!isEightConnected(cells))continue;
  const before=new Set(state.cells.map(c=>`${c.x},${c.y}`));if(cells.every(c=>before.has(`${c.x},${c.y}`)))continue;
  const minX=Math.min(...cells.map(c=>c.x)),minY=Math.min(...cells.map(c=>c.y));for(const c of cells){c.x-=minX;c.y-=minY;}
  return {cells,pivots:state.pivots};
 }return null;
}
export function removableCells(state){
 if(state.cells.length<=1)return [];
 return state.cells.filter(c=>{if(c.pivot)return false;const cells=state.cells.filter(n=>n.id!==c.id),seen=new Set(),todo=[cells[0]];while(todo.length){const n=todo.pop();if(seen.has(n.id))continue;seen.add(n.id);todo.push(...cells.filter(p=>p.id!==n.id&&Math.max(Math.abs(p.x-n.x),Math.abs(p.y-n.y))===1));}return seen.size===cells.length;}).map(c=>c.id);
}
export function removeShapeCell(state,id){
 if(!removableCells(state).includes(id))return null;
 const cells=state.cells.filter(c=>c.id!==id).map(c=>({...c})),minX=Math.min(...cells.map(c=>c.x)),minY=Math.min(...cells.map(c=>c.y));for(const c of cells){c.x-=minX;c.y-=minY;}
 const pivots=state.pivots.map(p=>{const sides=p.sides.map(s=>s.filter(n=>n!==id));return {...p,sides,moving:sides[0].length<=sides[1].length?sides[0]:sides[1]};});return {cells,pivots};
}
export function rotatedStateCells(state,rotation){let cells=state.cells.map(c=>({...c}));for(let k=0;k<((rotation%4)+4)%4;k++)cells=cells.map(c=>({...c,x:-c.y,y:c.x}));const x=Math.min(...cells.map(c=>c.x)),y=Math.min(...cells.map(c=>c.y));return cells.map(c=>({...c,x:c.x-x,y:c.y-y}));}
export function mirrorBendState(state,axis='x'){const max=Math.max(...state.cells.map(c=>c[axis]));return {cells:state.cells.map(c=>({...c,[axis]:max-c[axis]})),pivots:state.pivots};}
export function replayBends(shape,history=[]){let state=createBendState(shape);if(!Array.isArray(history)||history.length>256)throw Error('无效拐点记录');for(const op of history){const next=Number.isInteger(op)?turnBend(state,op):Number.isInteger(op?.add)?addHinge(state,op.add):Number.isInteger(op?.remove)?removeShapeCell(state,op.remove):['x','y'].includes(op?.mirror)?mirrorBendState(state,op.mirror):null;if(!next)throw Error('无效拐点操作');state=next;}return state;}
export function bendRows(state){const width=Math.max(...state.cells.map(c=>c.x))+1,height=Math.max(...state.cells.map(c=>c.y))+1,rows=Array.from({length:height},()=>Array(width).fill('.'));for(const c of state.cells)rows[c.y][c.x]=c.pivot?'*':'#';return rows.map(r=>r.join(''));}
export function pivotCells(shape,rotation=0,ordered=null){let cells=[];shape.forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='#'||c==='*')cells.push({x,y,pivot:c==='*'});}));for(let k=0;k<((rotation%4)+4)%4;k++)cells=cells.map(c=>({...c,x:-c.y,y:c.x}));const minX=Math.min(...cells.map(c=>c.x)),minY=Math.min(...cells.map(c=>c.y));if(ordered){return ordered.map(([x,y])=>{for(let k=0;k<((rotation%4)+4)%4;k++)[x,y]=[-y,x];return [x-minX,y-minY];});}return cells.filter(c=>c.pivot).map(c=>[c.x-minX,c.y-minY]);}

/** Coordinates are measured from cell centers, so a fractional centroid is intentional. */
export function equipmentAnchor(shape,rotation=0,pivots=null,index=0){
 const hinges=pivotCells(shape,rotation,pivots);if(hinges.length)return hinges[((index%hinges.length)+hinges.length)%hinges.length];
 let cells=[];shape.forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='#'||c==='*')cells.push([x,y]);}));
 for(let k=0;k<((rotation%4)+4)%4;k++)cells=cells.map(([x,y])=>[-y,x]);
 const minX=Math.min(...cells.map(c=>c[0])),minY=Math.min(...cells.map(c=>c[1]));
 return [cells.reduce((sum,c)=>sum+c[0]-minX,0)/cells.length,cells.reduce((sum,c)=>sum+c[1]-minY,0)/cells.length];
}

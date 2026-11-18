const HEIGHT_VARIATION=46;

function signedArea(boundary){
 let twiceArea=0;
 for(let i=0;i<boundary.length;i++){
  const a=boundary[i],b=boundary[(i+1)%boundary.length];
  twiceArea+=a.x*b.y-b.x*a.y;
 }
 return twiceArea/2;
}

function findBoundedFaces(nodes,neighbors){
 const neighborOrder=new Map(nodes.map(node=>[node,neighbors.get(node).sort((a,b)=>
  Math.atan2(a.y-node.y,a.x-node.x)-Math.atan2(b.y-node.y,b.x-node.x))]));
 const visited=new Set(),faces=[];
 for(const start of nodes)for(const next of neighborOrder.get(start)){
  if(visited.has(`${start.id}:${next.id}`))continue;
  const boundary=[];
  let a=start,b=next;
  do{
   visited.add(`${a.id}:${b.id}`);
   boundary.push(a);
   const order=neighborOrder.get(b);
   const c=order[(order.indexOf(a)+order.length-1)%order.length];
   a=b;b=c;
  }while(a!==start||b!==next);
  if(signedArea(boundary)>0)faces.push(boundary);
 }
 return faces;
}

function orientation(a,b,c){
 return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
}

function intersects(a,b,c,d){
 if(a===c||a===d||b===c||b===d){
  const common=a===c||a===d?a:b;
  const p=common===a?b:a,q=common===c?d:c;
  return Math.abs(orientation(common,p,q))<1e-6&&
   (p.x-common.x)*(q.x-common.x)+(p.y-common.y)*(q.y-common.y)>0;
 }
 if(Math.max(a.x,b.x)<Math.min(c.x,d.x)||Math.max(c.x,d.x)<Math.min(a.x,b.x)||
    Math.max(a.y,b.y)<Math.min(c.y,d.y)||Math.max(c.y,d.y)<Math.min(a.y,b.y))return false;
 return orientation(a,b,c)*orientation(a,b,d)<=0&&orientation(c,d,a)*orientation(c,d,b)<=0;
}

export function arrangeRunMap(rows,{width,minNodeDistance},random){
 const minDistanceSquared=minNodeDistance**2;
 const nodes=rows.flat(),byId=new Map(nodes.map(node=>[node.id,node]));
 const edges=nodes.flatMap(a=>a.next.map(id=>[a,byId.get(id)]));
 const neighbors=new Map(nodes.map(node=>[node,[]]));
 for(const [a,b] of edges){neighbors.get(a).push(b);neighbors.get(b).push(a);}
 const boundaries=findBoundedFaces(nodes,neighbors);
 const units=boundaries.reduce((sum,boundary)=>sum+boundary.length-2,0);
 const areaUnit=units?boundaries.reduce((sum,boundary)=>sum+signedArea(boundary),0)/units:0;
 const facesByNode=new Map(nodes.map(node=>[node,[]]));
 for(const boundary of boundaries){
  const face={boundary,target:areaUnit*(boundary.length-2)};
  for(const node of new Set(boundary))facesByNode.get(node).push(face);
 }

 const offsets=rows.map(()=>random()<.5?-1:1);
 const guides=new Map(nodes.map(node=>{
  const rowWidth=rows[node.layer].length;
  const across=rowWidth>1?2*node.lane/(rowWidth-1)-1:0;
  const bend=Math.sin(node.layer*.85);
  return [node,{
   baseY:node.y,
   x:Math.min(width-45,Math.max(45,node.x+22*bend)),
   y:node.y+25*across*offsets[node.layer]+16*(random()-.5),
  }];
 }));
 const adjustable=nodes.slice(0,-1);
 function cost(node,guide){
  let value=((node.x-guide.x)/105)**2*.13+((node.y-guide.y)/HEIGHT_VARIATION)**2*.26;
  for(const {boundary,target} of facesByNode.get(node)){
   const area=signedArea(boundary);
   if(area<=0)return Infinity;
   value+=Math.log(area/target)**2;
  }
  return value;
 }
 function validPosition(node){
  for(const other of nodes){
   if(other!==node&&(node.x-other.x)**2+(node.y-other.y)**2<minDistanceSquared)return false;
  }
  for(const neighbor of neighbors.get(node))for(const [a,b] of edges){
   if((a===node&&b===neighbor)||(a===neighbor&&b===node))continue;
   if(intersects(node,neighbor,a,b))return false;
  }
  return true;
 }
 for(const step of [24,16,16,10,10,6,6,3,3]){
  // Alternating sweep direction lets adjacent rooms share the adjustment.
  adjustable.reverse();
  for(const node of adjustable){
   const guide=guides.get(node);
   for(const axis of ['x','y']){
    const start=node[axis];
    let best=start,bestCost=cost(node,guide);
    for(const direction of [-1,1]){
     const next=start+step*direction;
     if(axis==='x'&&(next<45||next>width-45))continue;
     if(axis==='y'&&Math.abs(next-guide.baseY)>HEIGHT_VARIATION)continue;
     node[axis]=next;
     const candidate=cost(node,guide);
     if(candidate<bestCost&&validPosition(node)){best=next;bestCost=candidate;}
    }
    node[axis]=best;
   }
  }
 }
}

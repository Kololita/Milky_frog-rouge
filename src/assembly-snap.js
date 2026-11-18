/** Find a legal nearby origin without changing the held shape or orientation. */
export function nearestAssemblySnap(model,active,point,radius=.5){
 const x=point.x-active.grab[0],y=point.y-active.grab[1];let best=null;
 for(let cy=Math.floor(y-radius);cy<=Math.ceil(y+radius);cy++)for(let cx=Math.floor(x-radius);cx<=Math.ceil(x+radius);cx++){
  const distance=Math.hypot(cx-x,cy-y);
  if(distance>radius+1e-9||best&&distance>=best.distance||!model.check(active.id,cx,cy,active.rotation).ok)continue;
  best={x:cx,y:cy,distance};
 }
 return best;
}

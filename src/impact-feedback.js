/** Short, deterministic landing feedback; it never changes orbit or controls. */
export class ImpactFeedback {
  constructor(){this.reset();this.count=0;}
  reset(){this.elapsed=Infinity;}
  trigger(){this.elapsed=0;this.count++;}
  update(dt){this.elapsed+=Math.max(0,dt);}
  sample(){
    const t=this.elapsed;
    if(t>=.45)return {x:0,y:0,z:0,ringScale:1,ringOpacity:0};
    const envelope=Math.max(0,1-t/.24)**2;
    return {x:.035*envelope*Math.sin(t*139),y:.045*envelope*Math.sin(t*111),z:.018*envelope*Math.sin(t*157),
      ringScale:.55+1.4*Math.min(1,t/.45),ringOpacity:.42*(1-t/.45)};
  }
}

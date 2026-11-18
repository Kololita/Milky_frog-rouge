const cellKey = (x,y,z) => (x*131072+y)*131072+z;

// Keep scratch storage with the water system so fixed substeps can reuse it.
export function createFluidDensitySolver(capacity) {
  const grid = new Map();
  const cells = new Int32Array(capacity*3);
  const next = new Int32Array(capacity);
  const density = new Float32Array(capacity);
  const near = new Float32Array(capacity);
  const dx = new Float32Array(capacity);
  const dy = new Float32Array(capacity);
  const dz = new Float32Array(capacity);
  const scratch = [density,near,dx,dy,dz];
  let pairIndices = new Uint32Array(capacity*2);
  let pairData = new Float64Array(capacity*4);

  return function relax(particles, {radius=.18,restDensity=2.5,stiffness=.035,nearStiffness=.08,iterations=3}={}) {
    const n = particles.length, inv = 1/radius;
    let maxDensity = 0;
    for(let pass=0;pass<iterations;pass++){
      grid.clear();
      for(const buffer of scratch) buffer.fill(0,0,n);
      // Insert in reverse so linked lists keep the original increasing order.
      for(let i=n-1;i>=0;i--){
        const p=particles[i];
        const x=Math.floor(p.x*inv),y=Math.floor(p.y*inv),z=Math.floor(p.z*inv);
        cells[i*3]=x;cells[i*3+1]=y;cells[i*3+2]=z;
        const key=cellKey(x,y,z);
        next[i]=grid.get(key)??-1;
        grid.set(key,i);
      }
      let pairs=0;
      for(let i=0;i<n;i++){
        const a=particles[i],cx=cells[i*3],cy=cells[i*3+1],cz=cells[i*3+2];
        for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
          for(let j=grid.get(cellKey(cx+x,cy+y,cz+z))??-1;j>=0;j=next[j]){
            if(j<=i)continue;
            const b=particles[j],vx=b.x-a.x,vy=b.y-a.y,vz=b.z-a.z;
            const distance=Math.hypot(vx,vy,vz);
            if(distance>=radius||distance<1e-7)continue;
            const q=1-distance*inv;
            density[i]+=q*q;density[j]+=q*q;
            near[i]+=q*q*q;near[j]+=q*q*q;
            if(pairs*2===pairIndices.length){
              const indices=new Uint32Array(Math.max(2,pairIndices.length*2));
              const data=new Float64Array(indices.length*2);
              indices.set(pairIndices);data.set(pairData);
              pairIndices=indices;pairData=data;
            }
            pairIndices[pairs*2]=i;pairIndices[pairs*2+1]=j;
            pairData[pairs*4]=vx/distance;
            pairData[pairs*4+1]=vy/distance;
            pairData[pairs*4+2]=vz/distance;
            pairData[pairs*4+3]=q;
            pairs++;
          }
        }
      }
      for(let k=0;k<pairs;k++){
        const i=pairIndices[k*2],j=pairIndices[k*2+1];
        const x=pairData[k*4],y=pairData[k*4+1],z=pairData[k*4+2],q=pairData[k*4+3];
        const pressure=stiffness*(density[i]+density[j]-2*restDensity);
        const nearPressure=nearStiffness*(near[i]+near[j]);
        const correction=Math.max(-radius*.02,Math.min(radius*.1,(pressure*q+nearPressure*q*q)*radius*.5));
        dx[i]-=x*correction;dy[i]-=y*correction;dz[i]-=z*correction;
        dx[j]+=x*correction;dy[j]+=y*correction;dz[j]+=z*correction;
      }
      let largest=0;
      maxDensity=0;
      for(let i=0;i<n;i++){
        largest=Math.max(largest,Math.hypot(dx[i],dy[i],dz[i]));
        maxDensity=Math.max(maxDensity,density[i]);
      }
      const scale=largest>radius*.08?radius*.08/largest:1;
      for(let i=0;i<n;i++){
        particles[i].x+=dx[i]*scale;
        particles[i].y+=dy[i]*scale;
        particles[i].z+=dz[i]*scale;
      }
    }
    return {count:n,maxDensity};
  };
}

export function newMapSeed(){
 const buffer=new Uint32Array(1),span=900_000_000;
 do{crypto.getRandomValues(buffer);}while(buffer[0]>=Math.floor(2**32/span)*span);
 return String(100_000_000+buffer[0]%span);
}
export function formatMapSeed(seed){
 const value=String(seed);
 if(!/^\d+$/.test(value))throw new TypeError('地图种子必须由数字组成');
 return value.slice(-9).padStart(9,'0');
}
export function deriveSeed(root,domain){
 let hash=2166136261;
 for(const char of `${root}:${domain}`)hash=Math.imul(hash^char.charCodeAt(0),16777619);
 return hash>>>0;
}
export function seededRandom(seed){
 let state=seed>>>0;
 return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
}

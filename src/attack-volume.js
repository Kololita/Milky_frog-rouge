export function attackHeight(origin,attack){
 const base=Number(origin.height??origin.y)||0;
 return {yMin:base+(attack.heightMin??.4),yMax:base+(attack.heightMax??1.4)};
}
export function overlapsHeight(volume,target,bodyHeight=1.55){
 const feet=Number(target.height??target.y)||0;
 const low=feet+.15,high=feet+(target.bodyHeight??bodyHeight);
 return volume.yMax>=low-1e-9&&volume.yMin<=high+1e-9;
}

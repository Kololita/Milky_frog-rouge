export const ZODIAC_ART=Object.freeze([
  ['01-rat','鼠'],['02-ox','牛'],['03-tiger','虎'],['04-rabbit','兔'],
  ['05-dragon','龙'],['06-snake','蛇'],['07-horse','马'],['08-goat','羊'],
  ['09-monkey','猴'],['10-rooster','鸡'],['11-dog','狗'],['12-pig','猪'],
].map(([id,name])=>Object.freeze({id,name,url:`/images/zodiac/${id}.png`})));
/** Pick once per visit; returning to the menu avoids the immediately previous image. */
export function randomHomeArt(previousId,random=Math.random){
  const choices=ZODIAC_ART.filter(art=>art.id!==previousId);
  return choices[Math.min(choices.length-1,Math.max(0,Math.floor(random()*choices.length)))];
}

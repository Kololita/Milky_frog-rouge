const emblems={
 monster:`
  <path class="crest-light" d="M32 49 16 27l-2-11 11 4 19 17Z"/>
  <path class="crest-light" d="m40 49 16-22 2-11-11 4-19 17Z"/>
  <path class="crest-detail" d="m18 20 21 22m15-22L33 42"/>
  <path class="crest-ink" d="m39 41 9-8 4 4-9 8 6 7-5 5-7-7-4-4Z"/>
  <path class="crest-ink" d="m33 41-9-8-4 4 9 8-6 7 5 5 7-7 4-4Z"/>
 `,
 elite:`
  <path class="crest-ink" d="M27 30 19 27l-5-7 2-7 5 7 10 3m14 7 8-3 5-7-2-7-5 7-10 3"/>
  <path class="crest-dark" d="m36 16 14 8 6 15-7 13-13 9-13-9-7-13 6-15Z"/>
  <path class="crest-light" d="m36 23 10 6 4 10-6 10-8 6-8-6-6-10 4-10Z"/>
  <path class="crest-ink" d="m26 36 8 2-3 5-5-2Zm20 0-8 2 3 5 5-2Z"/>
  <path class="crest-detail" d="m33 48 3-3 3 3"/>
 `,
 shop:`
  <path class="crest-light" d="M18 33h36v22H18Z"/>
  <path class="crest-ink" d="M37 55V42h11v13Z"/>
  <path class="crest-dark" d="M23 42h9v6h-9Z"/>
  <path class="crest-ink" d="M22 17h28l7 13H15Z"/>
  <path class="crest-light" d="M30 17h6v13h-10Zm12 0h5l5 13H43Z"/>
  <path class="crest-dark" d="M15 30h42v4q-3 7-9 2-6 5-12 0-6 5-12 0-6 5-9-2Z"/>
  <path class="crest-detail" d="M15 55h42"/>
 `,
 rest:`
  <path class="crest-light" d="M36 13q3 9 9 14 9 7 9 15a18 18 0 0 1-36 0q0-6 5-12 1 5 5 6 1-5-1-10 6-4 9-13Z"/>
  <path class="crest-ink" d="M37 30q0 7 6 12 3 2 3 6a10 10 0 0 1-20 0q0-5 4-8 0 5 4 6 4-6 3-16Z"/>
  <path class="crest-dark" d="m18 53 37 6-1 5-37-6Zm36-1 2 5-37 7-2-5Z"/>
  <path class="crest-detail" d="M15 24v5m-2-2.5h4m38-8v6m-3-3h6"/>
 `,
 event:`
  <path class="crest-dark" d="M23 16h29l-7 7v28q0 5-6 5H21l5-7V23Z"/>
  <path class="crest-light" d="M23 16h25q-5 4-5 9v23H21V25q2-5 2-9Z"/>
  <path class="crest-ink" d="M15 49h30q-1 8-8 8H19q-6 0-4-8Z"/>
  <path class="crest-detail crest-question" d="M27 28q0-4 5-4 5 0 5 4 0 3-3 4-2 1-2 4m0 5v.5"/>
  <path class="crest-light" d="m54 27 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/>
 `,
 boss:`
  <path class="crest-light" d="m16 25 10 8 10-13 10 13 10-8-5 23H21Z"/>
  <path class="crest-dark" d="M21 48h30v6H21Z"/>
  <path class="crest-ink" d="m36 33 4 5-4 5-4-5Z"/>
 `,
};

// Keys match the boss encounter IDs used by the map.
const bossEmblems=new Map([
 ['samurai',`
  <path class="crest-ink" d="M36 23 24 18l-9-10 2 14 10 8Zm0 0 12-5L57 8l-2 14-10 8Z"/>
  <path class="crest-dark" d="M18 33 22 23q14-10 28 0l4 10 5 16-10 7-5-14H28l-5 14-10-7Z"/>
  <path class="crest-light" d="m36 16 5 7-5 8-5-8Z"/>
  <path class="crest-ink" d="M20 33q16-7 32 0l-3 6q-13-5-26 0Z"/>
  <path class="crest-light" d="m24 38 12-3 12 3-3 16-9 9-9-9Z"/>
  <path class="crest-detail" d="m26 43 7 2m13-2-7 2m-8 9 5-3 5 3M17 44l7-4m31 4-7-4"/>
 `],
]);

export function runMapIcon({type,encounter}){
 const emblem=type==='boss'?bossEmblems.get(encounter)??emblems.boss:emblems[type];
 return `<svg viewBox="0 0 72 72" aria-hidden="true">
  <circle class="map-icon-rim" cx="36" cy="36" r="33"/>
  <circle class="map-icon-bezel" cx="36" cy="36" r="29.5"/>
  <g class="map-icon-crest">${emblem}</g>
 </svg>`;
}

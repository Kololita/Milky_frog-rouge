import {readFile,writeFile} from 'node:fs/promises';
import {basename} from 'node:path';

const inputs=process.argv.slice(2);
if(!inputs.length)throw Error('Provide one or more performance JSON reports');

function measurements(report){
  if(report.error)throw Error(report.error);
  if(report.measurements)return report.measurements.map(({mode,feature,valveCount,minute,report:sample})=>[
    [mode,feature,valveCount==null?null:`${valveCount} valves`,minute==null?null:`minute ${minute}`]
      .filter(part=>part!=null).join(' / '),sample,
  ]);
  if(report.comparisons)return [
    ['high',report.report],...report.comparisons.map(({feature,report:sample})=>[feature,sample]),
  ];
  return ['startup','steady','dry','wet','firstUse','report']
    .filter(key=>report[key]?.summary).map(key=>[key,report[key]]);
}

const rows=[['report','scenario','renderer','width','height','dpr','gpuTimerAvailable',
  'metric','samples','p50','p95','p99','max','over25','over33_3','over50']];
for(const file of inputs){
  const report=JSON.parse(await readFile(file,'utf8'));
  const samples=measurements(report);
  if(!samples.length)throw Error(`No frame measurements in ${file}`);
  for(const [scenario,{renderer,width,height,dpr,gpuTimerAvailable,summary}] of samples){
    for(const [metric,{samples,p50,p95,p99,max,over25,over33_3,over50}] of Object.entries(summary)){
      rows.push([basename(file),scenario,renderer,width,height,dpr,gpuTimerAvailable,
        metric,samples,p50,p95,p99,max,over25,over33_3,over50]);
    }
  }
}
const csv=rows.map(row=>row.map(value=>`"${String(value??'').replaceAll('"','""')}"`).join(',')).join('\r\n');
await writeFile('output/foundry-performance-summary.csv','\uFEFF'+csv+'\r\n');
console.log(`Exported ${rows.length-1} metric rows to output/foundry-performance-summary.csv`);

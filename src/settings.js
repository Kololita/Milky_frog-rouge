export const DEFAULT_BINDINGS=Object.freeze({KeyI:'KeyI',KeyE:'Digit2',Laugh:'KeyE',KeyH:'KeyR',KeyW:'KeyW',KeyS:'KeyS',KeyA:'KeyA',KeyD:'KeyD',ShiftLeft:'ShiftLeft',Space:'Space',KeyJ:'KeyJ',Mouse0:'Mouse0',Mouse2:'Mouse2',Mouse1:'Digit1',KeyQ:'KeyQ',KeyF:'Digit3',KeyB:'KeyB',KeyR:'KeyH',Home:'Home',KeyC:'KeyC',KeyX:'KeyX',KeyK:'KeyK'});
export const DEFAULT_SETTINGS=Object.freeze({bindingRevision:3,resolution:'native',camera:'medium',fps:'display',sensitivity:1,brightness:1.12,lightingQuality:'high',shadowQuality:'high',reflectionQuality:'high',postQuality:'high',waterQuality:'high',shake:true,ui:'simple',invert:false,hitboxes:false,bindings:DEFAULT_BINDINGS});
const labels={KeyW:'向前',KeyS:'向后',KeyA:'向左',KeyD:'向右',ShiftLeft:'跑步 / 点按闪避',Space:'跳跃',Mouse0:'攻击',KeyJ:'攻击备用键',Mouse2:'格挡',Mouse1:'金光技能',KeyQ:'锁定敌人',KeyF:'释放大招',KeyB:'眨眼',KeyR:'恢复站姿',Home:'重置练习场',KeyC:'蹲下',KeyX:'坐下',KeyK:'受击测试',KeyI:'装备面板',KeyE:'释放技能',Laugh:'主动大笑',KeyH:'使用血瓶'};
const keyLabel=code=>({Mouse0:'鼠标左键',Mouse1:'鼠标中键',Mouse2:'鼠标右键',Space:'空格',ShiftLeft:'Shift',ShiftRight:'右 Shift',Home:'Home'}[code]??code.replace(/^Key|^Digit/,''));
export function createSettings(doc,win,{apply=()=>{},onOpen=()=>{},onClose=()=>{}}={}) {
  let values={...DEFAULT_SETTINGS,bindings:{...DEFAULT_BINDINGS}},opened=false,capture=null;
  const storage=win.naiwaSettings??win.localStorage;
  try {const stored=JSON.parse(storage?.getItem('milk-heroes-settings')??'null');if(stored){values={...values,...stored,bindings:{...DEFAULT_BINDINGS,...stored.bindings}};
    if((stored.bindingRevision??1)<2&&(stored.bindings?.KeyH??'KeyH')==='KeyH'&&(stored.bindings?.KeyR??'KeyR')==='KeyR'){values.bindings.KeyH='KeyR';values.bindings.KeyR='KeyH';}
    if((stored.bindingRevision??1)<3){
      for(const [action,previous] of Object.entries({Mouse1:'Mouse1',KeyE:'KeyE',KeyF:'KeyF'})){
        const next=DEFAULT_BINDINGS[action];
        if(values.bindings[action]===previous&&!Object.entries(values.bindings).some(([id,key])=>id!==action&&key===next))values.bindings[action]=next;
      }
      if(Object.entries(values.bindings).some(([id,key])=>id!=='Laugh'&&key==='KeyE')){
        values.bindings.Laugh=['Digit4','Digit5','Digit6','Digit7','Digit8','Digit9'].find(key=>!Object.values(values.bindings).includes(key))??'KeyL';
      }
    }
    values.bindingRevision=3;
    if(stored.shadowQuality==null&&stored.shadows===false)values.shadowQuality='off';
  }}catch{}
  delete values.shadows;
  const qualityLevels=['low','medium','high'];
  for(const [key,levels] of Object.entries({
    lightingQuality:qualityLevels,shadowQuality:['off',...qualityLevels],
    reflectionQuality:qualityLevels,postQuality:['off','medium','high'],waterQuality:['low','high'],
  })){
    if(!levels.includes(values[key]))values[key]=DEFAULT_SETTINGS[key];
  }
  if(!['none','simple','detailed'].includes(values.ui))values.ui='simple';
  if(values.hud===false)values.ui='none';delete values.hud;delete values.fov;
  delete values.bindings.KeyL;
  const panel=doc.getElementById?.('settings-dialog');
  const save=()=>{try{storage?.setItem('milk-heroes-settings',JSON.stringify(values));}catch{}apply(values);};
  const resolve=code=>Object.keys(values.bindings).find(action=>values.bindings[action]===code)??null;
  const api={get values(){return values;},get opened(){return opened;},resolve,
    open(){if(!panel||opened)return;opened=true;onOpen();panel.showModal();},
    close(){if(!opened)return;opened=false;capture=null;panel.close();onClose();},
  };
  if(!panel){apply(values);return api;}
  const form=doc.getElementById('settings-form'),bindingList=doc.getElementById('key-bindings'),message=doc.getElementById('binding-message');
  const buttons=new Map();
  for(const [action,label] of Object.entries(labels)){
    const row=doc.createElement('div');row.className='binding-row';
    const title=doc.createElement('span');title.textContent=label;
    const button=doc.createElement('button');button.type='button';button.textContent=keyLabel(values.bindings[action]);
    button.addEventListener('click',()=>{capture=action;message.textContent=`为“${label}”按下键盘或鼠标按键，Esc取消`;button.textContent='等待输入…';});
    row.append(title,button);bindingList.append(row);buttons.set(action,button);
  }
  function sync(){for(const control of form.querySelectorAll('[data-setting]')){const v=values[control.dataset.setting];if(control.type==='checkbox')control.checked=v;else control.value=v;}for(const [action,button] of buttons)button.textContent=keyLabel(values.bindings[action]);}
  function rebind(code,event){
    if(!capture)return;event.preventDefault();event.stopImmediatePropagation();
    if(code==='Escape'){capture=null;sync();message.textContent='已取消';return;}
    if(['Escape','Tab','MetaLeft','MetaRight','ControlLeft','ControlRight','AltLeft','AltRight'].includes(code)){message.textContent='此按键保留给菜单或浏览器';return;}
    const duplicate=resolve(code);
    if(duplicate&&duplicate!==capture){message.textContent=`此键已用于“${labels[duplicate]}”，请换一个`;return;}
    values.bindings[capture]=code;capture=null;sync();save();message.textContent='键位已保存';
  }
  win.addEventListener('keydown',event=>{
    const modal=event.target?.closest?.('dialog[open]')??doc.querySelector?.('dialog[open]');
    if(modal?.open&&modal!==panel)return;
    if(capture)return rebind(event.code,event);
    if(event.code==='Escape'){
      event.preventDefault();event.stopImmediatePropagation();
      if(!event.repeat)opened?api.close():api.open();
    }
  },true);
  win.addEventListener('mousedown',event=>{if(capture)rebind(`Mouse${event.button}`,event);},true);
  panel.addEventListener('contextmenu',event=>event.preventDefault());
  panel.addEventListener('cancel',event=>{event.preventDefault();api.close();});
  doc.getElementById('settings-open').addEventListener('click',api.open);
  doc.getElementById('settings-close').addEventListener('click',api.close);
  form.addEventListener('change',event=>{const field=event.target.dataset.setting;if(!field)return;values[field]=event.target.type==='checkbox'?event.target.checked:event.target.type==='range'?Number(event.target.value):event.target.value;save();});
  doc.getElementById('settings-reset').addEventListener('click',()=>{values={...DEFAULT_SETTINGS,bindings:{...DEFAULT_BINDINGS}};capture=null;sync();save();message.textContent='已恢复默认设置';});
  doc.getElementById('settings-fullscreen').addEventListener('click',async()=>{
    try{
      if(win.naiwaWindow){
        if(!await win.naiwaWindow.toggleFullscreen())throw new Error('Desktop fullscreen unavailable');
      }else if(doc.fullscreenElement)await doc.exitFullscreen();
      else await doc.documentElement.requestFullscreen();
    }catch{message.textContent='无法切换全屏';}
  });
  sync();apply(values);return api;
}

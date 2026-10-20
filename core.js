export const DEFAULTS = Object.freeze({provider:'chrome',model:'gemini-nano',stepCount:'auto',theme:'system',autoAdd:false,attachPage:true});
export const initialState = () => ({settings:{...DEFAULTS},tasks:[],groups:[],draft:null,doneOpen:true});
export const id = () => crypto.randomUUID();
export const cleanText = (s,max=1000) => String(s ?? '').replace(/\u0000/g,'').trim().slice(0,max);
export function safeUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}}
export function sourceUrl(value){const s=safeUrl(value);if(!s)return '';const u=new URL(s);u.username='';u.password='';u.hash='';for(const k of [...u.searchParams.keys()])if(/token|key|auth|session|signature|password/i.test(k))u.searchParams.delete(k);if(/^\/courses\/\d+\/(assignments\/\d+|pages\/[^/]+)\/?$/.test(u.pathname))u.search='';return u.href;}
export function host(value){try{return new URL(value).hostname.replace(/^www\./,'');}catch{return 'Personal';}}
export function originPattern(value){const u=new URL(value);if(!safeUrl(value))throw new Error('Open a regular website first.');return `${u.protocol}//${u.hostname}/*`;}
export function normalizeStep(step,index){
  if(!step || typeof step.title!=='string' || !step.title.trim() || typeof step.firstAction!=='string' || !step.firstAction.trim() || (step.minutes!=null && !Number.isInteger(step.minutes)))throw new Error('The AI returned an incomplete step. Please try again.');
  if(index===0 && step.minutes!=null && (step.minutes<1 || step.minutes>=2))throw new Error('The first step was too long. Please try again for a one-minute start.');
  return {id:step.id || id(),title:cleanText(step.title,180),firstAction:cleanText(step.firstAction,700),minutes:null};
}
export function validatePlan(value,count){
  if(!value || !Array.isArray(value.steps) || (count==null || count==='auto' ? value.steps.length<3 || value.steps.length>12 : value.steps.length!==count))throw new Error('The AI did not finish the requested plan. Please try again.');
  return {steps:value.steps.map(normalizeStep),note:cleanText(value.note,700)};
}
export function addSteps(state,draft,indexes){
  const source=draft.source;
  let group=state.groups.find(g=>g.sourceUrl===source.url);
  if(!group){group={id:id(),title:source.title,sourceUrl:source.url,due:source.due||'',createdAt:Date.now()};state.groups.push(group);}
  let added=0;
  for(const i of indexes){
    const step=draft.steps[i];if(!step)continue;
    const existing=state.tasks.some(t=>t.stepId===step.id || (t.sourceUrl===source.url && t.title.toLowerCase()===step.title.toLowerCase()));
    if(existing)continue;
    state.tasks.push({id:id(),stepId:step.id,groupId:group.id,title:step.title,detail:step.firstAction,minutes:step.minutes,sourceUrl:source.url,due:source.due||'',done:false,createdAt:Date.now()});added++;
  }
  return added;
}
export function mutate(state,action){
  switch(action.type){
    case 'settings':state.settings={...DEFAULTS,...state.settings,...action.value};break;
    case 'draft':state.draft=action.value;break;
    case 'addSteps':addSteps(state,action.draft,action.indexes);break;
    case 'quickAdd':{
      const title=cleanText(action.title,180);if(!title)break;
      const src=action.source;
      let group=src?.url?state.groups.find(g=>g.sourceUrl===src.url):state.groups.find(g=>g.id==='personal');
      if(!group){group=src?.url?{id:id(),title:src.title,sourceUrl:src.url,due:src.due||'',createdAt:Date.now()}:{id:'personal',title:'Personal tasks',sourceUrl:'',due:'',createdAt:Date.now()};state.groups.push(group);}
      state.tasks.push({id:id(),groupId:group.id,title,detail:'',minutes:null,sourceUrl:group.sourceUrl,due:group.due,done:false,createdAt:Date.now()});break;
    }
    case 'toggleTask':{const t=state.tasks.find(t=>t.id===action.id);if(t)t.done=!t.done;break;}
    case 'editTask':{const t=state.tasks.find(t=>t.id===action.id);if(t){t.title=cleanText(action.title,180)||t.title;t.detail=cleanText(action.detail,700);}break;}
    case 'deleteTask':state.tasks=state.tasks.filter(t=>t.id!==action.id);break;
    case 'deleteGroup':state.tasks=state.tasks.filter(t=>t.groupId!==action.id);state.groups=state.groups.filter(g=>g.id!==action.id);break;
    case 'doneOpen':state.doneOpen=!!action.value;break;
    default:throw new Error('Unknown update.');
  }
  state.groups=state.groups.filter(g=>state.tasks.some(t=>t.groupId===g.id));
  return state;
}

// Extract only fully received objects from a streamed JSON steps array.
// Quotes, escaped backslashes, braces inside strings, and chunk boundaries are preserved.
export function completeSteps(text){
  const match=/"steps"\s*:\s*\[/.exec(text);if(!match)return [];
  const steps=[];let depth=0,start=-1,quoted=false,escaped=false;
  for(let i=match.index+match[0].length;i<text.length;i++){
    const c=text[i];
    if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
    if(c==='"'){quoted=true;continue;}
    if(c==='{'){if(depth===0)start=i;depth++;}
    if(c==='}'){depth--;if(depth===0 && start>=0){try{steps.push(JSON.parse(text.slice(start,i+1)));}catch{}start=-1;}}
    if(c===']' && depth===0)break;
  }
  return steps;
}

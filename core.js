import {BUILD} from './config.js';
export const DEFAULTS=Object.freeze({provider:BUILD.provider,model:BUILD.model,stepHelp:false,stepCount:'auto',detail:'auto',customCount:10,theme:'system',autoAdd:false,attachPage:true,onboardingDone:false});
export const id=()=>crypto.randomUUID();
export const cleanText=(s,max=1000)=>String(s??'').replace(/\u0000/g,'').trim().slice(0,max);
export function safeUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}}
export function sourceUrl(value){const s=safeUrl(value);if(!s)return '';const u=new URL(s);u.username='';u.password='';u.hash='';for(const k of [...u.searchParams.keys()])if(/token|key|auth|session|signature|password|verifier|access_code/i.test(k))u.searchParams.delete(k);if(/^\/courses\/[^/]+\/(assignments\/[^/]+|pages\/[^/]+)\/?$/.test(u.pathname))u.search='';u.pathname=u.pathname.replace(/\/$/,'')||'/';return u.href;}
export const assignmentKey=sourceUrl;
export function host(value){try{return new URL(value).hostname.replace(/^www\./,'');}catch{return 'Personal';}}
export function originPattern(value){if(!safeUrl(value))throw new Error('Open a regular website first.');const u=new URL(value);return `${u.protocol}//${u.hostname}/*`;}
export const titleKey=s=>cleanText(s,180).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export const initialState=()=>({settings:{...DEFAULTS},tasks:[],groups:[],draft:null,doneOpen:true,schemaVersion:2});
export function migrateState(saved){
  const state=saved && typeof saved==='object'?saved:initialState();
  state.settings={...DEFAULTS,...state.settings};state.tasks=Array.isArray(state.tasks)?state.tasks:[];state.groups=Array.isArray(state.groups)?state.groups:[];
  state.draft=state.draft||null;state.doneOpen=state.doneOpen!==false;state.schemaVersion=2;
  // Preserve every existing task, id, edit, completion and explanation. Historical
  // duplicates are not silently deleted, because users may have changed them.
  for(const g of state.groups)if(g.sourceUrl)g.sourceUrl=sourceUrl(g.sourceUrl);
  for(const t of state.tasks)if(t.sourceUrl)t.sourceUrl=sourceUrl(t.sourceUrl);
  return state;
}
export function planLimits(settings={}){return {min:3,max:settings.detail==='custom'?Math.min(30,Math.max(3,Number(settings.customCount)||10)):12};}
export function normalizeStep(step){
  if(!step || typeof step.title!=='string'||!step.title.trim()||typeof step.firstAction!=='string'||!step.firstAction.trim())throw new Error('The AI returned an incomplete step. Please try again.');
  return {id:step.id||id(),title:cleanText(step.title,180),firstAction:cleanText(step.firstAction,700),minutes:null};
}
export function validatePlan(value,countOrSettings){
  const numeric=typeof countOrSettings==='number';const limits=planLimits(typeof countOrSettings==='object'?countOrSettings:{});
  if(!value||!Array.isArray(value.steps)||(numeric?value.steps.length!==countOrSettings:value.steps.length<limits.min||value.steps.length>limits.max))throw new Error('The AI did not finish a valid plan. Please try again.');
  return {steps:value.steps.map(normalizeStep),note:cleanText(value.note,1400)};
}
export function assignmentTasks(state,url){const key=assignmentKey(url);return key?state.tasks.filter(t=>assignmentKey(t.sourceUrl)===key):[];}
export function existingPlan(state,url){return assignmentTasks(state,url).some(t=>t.stepId||t.generated);}
export function stepExists(state,url,step){return assignmentTasks(state,url).some(t=>t.stepId===step.id||[t.title,t.originalTitle].some(s=>s&&titleKey(s)===titleKey(step.title)));}
export function addSteps(state,draft,indexes,{reviewed=false}={}){
  if(!draft?.id||!draft?.source?.url||!Array.isArray(draft.steps))throw new Error('No complete plan is available.');
  const source=draft.source,key=assignmentKey(source.url),old=assignmentTasks(state,key).filter(t=>t.stepId||t.generated);
  const samePlan=old.every(t=>t.planId===draft.id||draft.steps.some(s=>s.id===t.stepId));
  if(old.length&&!samePlan&&!reviewed)throw new Error('This assignment already has a plan. Open it or review an update before adding suggestions.');
  if(draft.review&&!reviewed)throw new Error('Review and select the new suggestions before applying this update.');
  let group=state.groups.find(g=>assignmentKey(g.sourceUrl)===key);
  if(!group){group={id:id(),title:source.title,sourceUrl:key,due:source.due||'',createdAt:Date.now()};state.groups.push(group);}
  if(source.context)group.context=cleanText(source.context,60000);
  let added=0;
  for(const index of [...new Set(indexes)]){
    const raw=draft.steps[index];if(!raw||stepExists(state,key,raw))continue;
    const step=normalizeStep(raw);
    state.tasks.push({id:id(),stepId:step.id,planId:draft.id,generated:true,originalTitle:step.title,groupId:group.id,title:step.title,detail:step.firstAction,minutes:null,sourceUrl:key,due:source.due||'',done:false,createdAt:Date.now()});added++;
  }
  return added;
}
export function mutate(state,action){
  switch(action.type){
    case 'settings':state.settings={...DEFAULTS,...state.settings,...action.value};break;
    case 'draft':state.draft=action.value;break;
    case 'addSteps':addSteps(state,action.draft,action.indexes);break;
    case 'mergePlan':addSteps(state,action.draft,action.indexes,{reviewed:true});break;
    case 'quickAdd':{
      const title=cleanText(action.title,180);if(!title)break;const src=action.source;const key=assignmentKey(src?.url);
      let group=key?state.groups.find(g=>assignmentKey(g.sourceUrl)===key):state.groups.find(g=>g.id==='personal');
      if(!group){group=key?{id:id(),title:src.title,sourceUrl:key,due:src.due||'',createdAt:Date.now()}:{id:'personal',title:'Personal tasks',sourceUrl:'',due:'',createdAt:Date.now()};state.groups.push(group);}
      state.tasks.push({id:id(),groupId:group.id,title,detail:'',minutes:null,sourceUrl:group.sourceUrl,due:group.due||'',done:false,createdAt:Date.now()});break;
    }
    case 'toggleTask':{const t=state.tasks.find(t=>t.id===action.id);if(t)t.done=!t.done;break;}
    case 'editTask':{const t=state.tasks.find(t=>t.id===action.id);if(t){t.title=cleanText(action.title,180)||t.title;t.detail=cleanText(action.detail,700);delete t.help;}break;}
    case 'taskHelp':{const t=state.tasks.find(t=>t.id===action.id);if(t&&(!action.expected||(t.title===action.expected.title&&t.detail===action.expected.detail)))t.help=action.value;break;}
    case 'deleteTask':state.tasks=state.tasks.filter(t=>t.id!==action.id);break;
    case 'deleteGroup':state.tasks=state.tasks.filter(t=>t.groupId!==action.id);state.groups=state.groups.filter(g=>g.id!==action.id);break;
    case 'doneOpen':state.doneOpen=!!action.value;break;
    default:throw new Error('Unknown update.');
  }
  state.groups=state.groups.filter(g=>state.tasks.some(t=>t.groupId===g.id));return state;
}
export function completeSteps(text){
  const match=/"steps"\s*:\s*\[/.exec(text);if(!match)return [];const steps=[];let depth=0,start=-1,quoted=false,escaped=false;
  for(let i=match.index+match[0].length;i<text.length;i++){const c=text[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}if(c==='"'){quoted=true;continue;}if(c==='{'){if(depth===0)start=i;depth++;}if(c==='}'){depth--;if(depth===0&&start>=0){try{steps.push(JSON.parse(text.slice(start,i+1)));}catch{}start=-1;}}if(c===']'&&depth===0)break;}return steps;
}

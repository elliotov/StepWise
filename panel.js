import {BUILD} from './config.js';
import {DEFAULTS,id,safeUrl,sourceUrl,originPattern,normalizeStep,assignmentTasks,existingPlan,stepExists} from './core.js';
import {extractPage} from './extract.js';
import {composeSource} from './planning.js';
import {parsePdf,fetchPdf,MAX_PDF_BYTES} from './pdf-input.js';
import {renderStable} from './stable-dom.js';
import {loadingProgress} from './progress.js';
import {connectionStatus,plan} from './provider.js';
import {$,escape,icon,logo,sourceChip,dueChip,getState,update,applyTheme,watchTheme,notify,pageCard} from './ui.js';
let state,current=null,draft=null,view='plan',phase='empty',error=null,controller=null,editTarget=null,run=0,refreshId=0;
let connection={ready:false,message:'Checking connection…'},permission=false,loading={label:'Reading assignment…'},selected=new Set(),existingUrl='',renderFrame=0;
let inputKey='',inputState={extra:'',page:null,pdfs:[]},inputCache={},candidates=[],inputRun=0,pdfController=null,persistTimer;
let helpTarget=null,helpController=null,helpRun=0;
const busy=()=>phase==='streaming';
$('#home').innerHTML=logo();$('#settings').innerHTML=icon('gear');
$('#settings').onclick=()=>chrome.runtime.openOptionsPage();
$('#home').onclick=e=>{e.preventDefault();view='plan';render();};
$('#plan-tab').onclick=()=>{view='plan';render();};
$('#list-tab').onclick=()=>{view='list';render();};
function queueRender(){if(renderFrame)return;renderFrame=requestAnimationFrame(()=>{renderFrame=0;render();});}
function setupMarkup(){
  if(state.settings.onboardingDone)return '';
  return `<section class="setup-card" data-key="setup"><div class="eyebrow">First-time setup · ${BUILD.api?'API version':'Local AI version'}</div><h2>Make your first plan</h2><ol class="setup-list"><li>✓ Extension installed · v${BUILD.version}</li><li>${connection.ready?'✓':'○'} ${escape(connection.message)} <button class="text-button" data-action="settings">${BUILD.api?'API key settings':'Set up local AI'}</button></li><li>${permission?'✓ Site access available':'○ Allow this Canvas site when prompted'}${!permission&&safeUrl(current?.url)?' <button class="text-button" data-action="allow">Allow this site</button>':''}</li><li>${state.settings.hasGenerated?'✓ First plan created':'○ Read the page, add any missing instructions, then generate a plan'}</li></ol><p class="field-help">${BUILD.api?'Your API key belongs in Settings. Plans and help use your OpenAI API account.':'No API key needed. Complete the one-time local model download in Settings.'}</p><button class="ghost small" data-action="finish-setup">${state.settings.hasGenerated?'Finish setup':'Hide checklist for now'}</button></section>`;
}
function render(){
  if(!state)return;applyTheme(state.settings);
  const open=state.tasks.filter(t=>!t.done).length;$('#open-count').textContent=`${open} open`;$('#list-count').textContent=open||'';
  for(const [selector,on] of [['#plan-tab',view==='plan'],['#list-tab',view==='list']]){$(selector).classList.toggle('selected',on);$(selector).setAttribute('aria-current',on?'page':'false');}
  $('#main').setAttribute('aria-busy',String(busy()&&view==='plan'));
  $('#input-region').hidden=view!=='plan';$('#source-controls').disabled=busy();
  renderStable($('#setup-region'),setupMarkup());
  renderStable($('#main'),view==='plan'?renderPlan():renderList());
}
function renderPlan(){
  const source=draft?.source||current;
  const header=`${draft&&current?.url&&draft.source.url!==current.url?'<p class="inline-note">This plan belongs to its original assignment. Dismiss it to plan the current tab.</p>':''}<div data-key="source">${pageCard(source)}${source?.due?`<div class="chips">${dueChip(source.due)}</div>`:''}</div>`;
  if(phase==='existing'){
    const tasks=assignmentTasks(state,existingUrl);
    return header+`<section class="notice" data-key="existing"><h2>A plan already exists</h2><p>${tasks.length} saved tasks, including ${tasks.filter(t=>t.done).length} completed. Your edits and progress are safe.</p><div class="inline-actions"><button class="primary" data-action="open-existing">Open existing plan</button><button class="ghost" data-action="review-update">Review updated plan</button></div><p class="field-help">Updates are suggestions to review, not a second copy of the checklist.</p></section>`;
  }
  if(phase==='empty'&&!draft)return header+`<section class="empty" data-key="empty"><div class="eyebrow">One assignment, one clear plan</div><h1>Big assignment.<br>Small first step.</h1><p>Read the page above, add missing instructions or PDFs, and choose how much detail you want.</p><button class="primary full" data-action="generate">Break this into steps ${icon('arrow')}</button><p class="microcopy">No timers. Work at your own pace.</p></section>`;
  const saved=draft?.review?assignmentTasks(state,source.url):[];
  return header+`<div class="breakdown-heading" data-key="heading"><span class="status" role="status">${busy()?'Creating your plan…':phase==='ready'?`${draft.steps.length} steps, one clear path`:'Plan needs attention'}</span><button class="icon-button" data-action="dismiss" aria-label="Dismiss plan">${icon('close')}</button></div>
  ${busy()?`<div data-key="loading">${loadingProgress(loading)}</div>`:''}
  ${error?`<section class="error" role="alert" data-key="error"><h3>${escape(error.title)}</h3><p>${escape(error.message)}</p>${error.action?`<button class="primary small" data-action="${error.action}">${error.action==='settings'?'Open Settings':error.action==='allow'?'Allow on this site':'Try again'}</button>`:''}</section>`:''}
  ${saved.length?`<section class="notice" data-key="review"><h3>Review the update</h3><p>Your ${saved.length} existing tasks stay unchanged. Select only genuinely new suggestions to add.</p><details><summary>Review saved tasks and progress</summary><ul>${saved.map(t=>`<li>${t.done?'✓':'○'} ${escape(t.title)}</li>`).join('')}</ul></details></section>`:''}
  <section data-key="steps">${phase!=='error'?(draft?.steps||[]).map(stepCard).join(''):''}</section>
  ${phase==='ready'?`<section class="plan-actions" data-key="actions"><p class="plan-note">${escape(draft.note||'Check these suggestions against the assignment before adding them.')}</p>${draft.source.truncated?'<p class="inline-note">Some source text was shortened during extraction. Review the source previews and add any missing requirements.</p>':''}${draft.review?`<button class="primary full" data-action="apply-update" ${selected.size?'':'disabled'}>Add ${selected.size} selected new suggestion(s)</button><button class="ghost full" data-action="open-existing">Keep existing plan</button>`:`<button class="primary full" data-action="add-all">${draft.steps.every(s=>stepExists(state,draft.source.url,s))?'View my to-do list':'Add all steps to list'} ${icon('arrow')}</button>`}</section>`:''}`;
}
function stepCard(step,index){
  const added=stepExists(state,draft.source.url,step);
  return `<article class="step ${index===0?'first':''}" data-key="step-${index}"><div class="step-top"><span class="number">${index+1}</span>${index===0?'<span class="start-badge">Start here</span>':''}<span class="spacer"></span>${phase==='ready'?`${draft.review?`<label class="review-select"><input type="checkbox" data-action="select-update" data-index="${index}" aria-label="Select suggestion ${index+1}" ${selected.has(index)?'checked':''} ${added?'disabled':''}>${added?'Already saved':'Add this'}</label>`:`<button class="icon-button" data-action="edit-step" data-index="${index}" aria-label="Edit step ${index+1}">${icon('edit')}</button><button class="icon-button" data-action="add-step" data-index="${index}" aria-label="Add step ${index+1}" ${added?'disabled':''}>${icon('plus')}</button>`}`:''}</div><h3>${escape(step.title)}</h3><p>${escape(step.firstAction)}</p>${phase==='ready'&&BUILD.api&&state.settings.stepHelp?`<button class="ghost small" data-action="help-step" data-index="${index}">Help me complete this step</button>`:''}</article>`;
}
function taskRow(t){return `<article class="task-row ${t.done?'done':''}" data-key="task-${escape(t.id)}"><input type="checkbox" data-action="toggle-task" data-id="${escape(t.id)}" aria-label="Mark ${escape(t.title)} ${t.done?'incomplete':'complete'}" ${t.done?'checked':''}><div class="task-content"><button class="task-title" data-action="edit-task" data-id="${escape(t.id)}">${escape(t.title)}</button>${t.detail?`<p class="task-detail">${escape(t.detail)}</p>`:''}<div class="chips">${sourceChip(t.sourceUrl)}${dueChip(t.due)}</div>${BUILD.api?`<div class="task-tools">${state.settings.stepHelp?`<button class="text-button" data-action="help-task" data-id="${escape(t.id)}">${t.help?'View step help':'Help me complete this step'}</button>`:''}<button class="text-button" data-action="calendar-task" data-id="${escape(t.id)}">Export to calendar</button></div>`:''}</div><button class="icon-button" data-action="delete-task" data-id="${escape(t.id)}" aria-label="Delete ${escape(t.title)}">${icon('close')}</button></article>`;}
function renderList(){
  const tasks=state.tasks,done=tasks.filter(t=>t.done),open=tasks.filter(t=>!t.done);
  return `<div class="section-heading" data-key="list-heading"><div><div class="eyebrow">One thing at a time</div><h2>Your next steps</h2></div><span>${open.length} open</span></div><form id="quick-add" data-key="quick-add" class="quick-add"><div class="quick-input"><input id="quick-title" maxlength="180" placeholder="Add a task…" aria-label="New task" required autocomplete="off"><button class="icon-button" aria-label="Add task">${icon('plus')}</button></div><label class="attach"><input id="attach-page" type="checkbox" ${state.settings.attachPage?'checked':''}>Attach current page</label></form>
  ${state.groups.map(g=>{const all=tasks.filter(t=>t.groupId===g.id),pending=all.filter(t=>!t.done),count=all.filter(t=>t.done).length;if(!all.length)return '';return `<section class="task-group" data-key="group-${escape(g.id)}"><div class="group-heading"><strong>${escape(g.title)}</strong><span>${count} of ${all.length}</span><button class="icon-button" data-action="delete-group" data-id="${escape(g.id)}" aria-label="Delete assignment">${icon('trash')}</button></div><div class="progress-track" role="progressbar" aria-label="${escape(g.title)} completion" aria-valuemin="0" aria-valuemax="${all.length}" aria-valuenow="${count}"><span style="width:${Math.round(count/all.length*100)}%"></span></div>${pending.map(taskRow).join('')}${!pending.length?'<p class="inline-note">All steps completed.</p>':''}</section>`;}).join('')}
  ${done.length?`<section data-key="done"><button class="text-button" data-action="toggle-done" aria-expanded="${state.doneOpen}">${state.doneOpen?'Hide':'Show'} ${done.length} done</button>${state.doneOpen?done.map(taskRow).join(''):''}</section>`:''}
  ${!tasks.length?'<p class="list-empty" data-key="list-empty">A fresh start. Plan an assignment or add a task above.</p>':''}<button class="primary full" data-action="plan-current" data-key="plan-current">Plan current assignment</button>`;
}
function inputStatus(text){$('#input-status').textContent=text;}
async function stashInputs(){
  if(!inputKey)return;inputState.extra=$('#additional-instructions').value;inputCache[inputKey]=structuredClone(inputState);
  const entries=Object.entries(inputCache);inputCache=Object.fromEntries(entries.slice(-5));
  try{await chrome.storage.session.set({stepwiseInputs:inputCache});}catch{inputStatus('Extra inputs could not be kept for reopening. Keep the panel open until you generate the plan.');}
}
function scheduleStash(){clearTimeout(persistTimer);persistTimer=setTimeout(()=>{void stashInputs();},200);}
async function switchInputs(url){
  const key=sourceUrl(url);if(key===inputKey)return;
  clearTimeout(persistTimer);await stashInputs();++inputRun;pdfController?.abort();pdfController=null;
  inputKey=key;inputState=structuredClone(inputCache[key]||{extra:'',page:null,pdfs:[]});candidates=[];
  $('#additional-instructions').value=inputState.extra||'';$('#page-preview').value=inputState.page?.text||'';$('#pdf-file').value='';renderAttachments();renderLinks();inputStatus('Extra inputs stay with this page in this browser session.');
}
function renderAttachments(){
  renderStable($('#pdf-previews'),inputState.pdfs.map(p=>`<section class="pdf-card" data-key="pdf-${p.id}"><div class="inline-actions"><label><input type="checkbox" data-pdf-include="${p.id}" ${p.include!==false?'checked':''}> Include ${escape(p.name)}</label><button class="text-button" data-pdf-remove="${p.id}">Remove</button></div><p class="field-help">${p.pages||'?'} page(s). ${escape((p.warnings||[]).join(' '))}</p><details><summary>Preview / correct extracted text</summary><textarea rows="6" data-pdf-text="${p.id}" maxlength="40000" aria-label="Text from ${escape(p.name)}">${escape(p.text)}</textarea></details></section>`).join(''));
}
function renderLinks(){const select=$('#pdf-link');select.replaceChildren(new Option(candidates.length?'Choose an attached file…':'Read the page to find attached PDFs',''));for(let i=0;i<candidates.length;i++)select.add(new Option(candidates[i].label||'Canvas attachment',String(i)));$('#load-pdf').disabled=!candidates.length;}
function scanLinks(){return [...document.querySelectorAll('a[href]')].filter(a=>/\.pdf(?:[?#]|$)|\/files\/\d+(?:[/?#]|$)/i.test(a.href)||/\.pdf/i.test(a.textContent||'')).slice(0,40).map(a=>({url:a.href,label:(a.textContent||'Attachment').trim().slice(0,160)}));}
async function readPage(){
  if(!safeUrl(current?.url))throw new Error('Open a Canvas assignment or a regular website first.');
  const token=++inputRun,source={...current};inputStatus('Reading page instructions…');
  const result=await chrome.scripting.executeScript({target:{tabId:source.tabId},func:extractPage});
  if(token!==inputRun||source.url!==current?.url)throw new Error('The page changed while reading. Try again.');
  const page=result[0]?.result;inputState.page={...source,...(page?.error?{text:'',error:page.error}:page),url:source.url};
  inputState.page.links=(inputState.page.links||[]).map(l=>({label:l.label,url:sourceUrl(l.url)}));
  $('#page-preview').value=inputState.page.text||'';
  try{const links=await chrome.scripting.executeScript({target:{tabId:source.tabId},func:scanLinks});if(token!==inputRun)throw new Error('Page changed.');candidates=(links[0]?.result||[]).filter(l=>safeUrl(l.url));}catch{candidates=[];}
  renderLinks();permission=true;await stashInputs();
  if((inputState.page.text||'').length<120)inputStatus('The page has little readable detail. Add the actual requirements below or load an attached PDF. Review all inputs before generating.');
  else inputStatus('Page instructions loaded. Review them below; add any PDFs or missing requirements.');
  render();return inputState.page;
}
async function refreshCurrent(){
  const token=++refreshId;const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(token!==refreshId)return;
  const next=tab?{tabId:tab.id,title:tab.title||'Current page',url:sourceUrl(tab.url),due:''}:null;
  if(next?.url!==current?.url){await switchInputs(next?.url);if(phase==='existing')phase='empty';}if(token!==refreshId)return;current=next;
  try{permission=!!safeUrl(next?.url)&&await chrome.permissions.contains({origins:[originPattern(next.url)]});}catch{permission=false;}
  render();
}
function showError(title,message,action='generate'){error={title,message,action};phase='error';render();}
async function generate({review=false}={}){
  if(pdfController){notify('Wait for the PDF to finish loading before generating.');return;}
  if(busy())return;
  if(!safeUrl(current?.url)){showError('Open an assignment','Open a Canvas assignment or regular page first.','');return;}
  state=await getState();if(!review&&existingPlan(state,current.url)){existingUrl=current.url;phase='existing';view='plan';draft=null;render();return;}
  controller?.abort();controller=new AbortController();const ownController=controller,token=++run,captured={...current},extras=structuredClone(inputState);
  view='plan';phase='streaming';error=null;draft=null;selected.clear();loading={label:'Reading assignment…'};render();
  const timer=setTimeout(()=>ownController.abort('timeout'),600000);
  const ensure=()=>{ownController.signal.throwIfAborted();if(token!==run)throw new DOMException('Aborted','AbortError');};
  try{
    connection=await connectionStatus();ensure();if(!connection.ready&&BUILD.api){showError('Connect your AI',connection.message,'settings');return;}
    let page=extras.page;
    if(!page||(review&&!page.edited)){try{page=await readPage();}catch(e){ensure();if(!extras.extra.trim()&&!extras.pdfs.length){showError('Site access required','Allow this site to read its instructions, or paste instructions / upload a PDF above.','allow');return;}page={...captured,text:'',links:[]};}}
    ensure();if(captured.url!==current?.url)throw new Error('The current page changed. Return to the assignment and retry.');
    const source=composeSource({...page,...captured},$('#additional-instructions').value,inputState.pdfs);
    source.url=sourceUrl(source.url);draft={id:id(),review,source,steps:[],note:''};loading={label:'Creating your steps…'};render();
    if($('#detail-mode').value==='custom'&&(!Number.isInteger(Number($('#custom-count').value))||Number($('#custom-count').value)<3||Number($('#custom-count').value)>30))throw new Error('Choose a custom maximum of 3–30 steps.');
    const settings={...DEFAULTS,...state.settings,detail:$('#detail-mode').value,customCount:Number($('#custom-count').value)};
    const result=await plan(source,settings,{signal:ownController.signal,onStatus:label=>{if(token===run){loading={label};queueRender();}},onProgress:n=>{if(token===run){loading={label:'Downloading local AI…',download:n};queueRender();}},onSteps:steps=>{if(token!==run)return;try{draft.steps=steps.map(normalizeStep);loading={label:'Creating your steps…',steps:steps.length};queueRender();}catch{}}});
    ensure();const {text,links,...metadata}=source;
    draft={...draft,...result,source:{...metadata,context:text}};phase='ready';error=null;
    state=await update({type:'draft',value:draft});ensure();state=await update({type:'settings',value:{hasGenerated:true}});ensure();
    if(!review&&settings.autoAdd){state=await update({type:'addSteps',draft,indexes:[0]});ensure();}
    connection={ready:true,message:BUILD.api?'API connected':'Local AI ready'};await stashInputs();render();
  }catch(e){if(token!==run)return;if(e.name!=='AbortError'||ownController.signal.reason==='timeout')showError('Could not make this plan',ownController.signal.reason==='timeout'?'The request timed out. Try again.':e.message);}
  finally{clearTimeout(timer);if(token===run){controller=null;if(phase==='streaming')phase='empty';render();}}
}
async function dismiss(){++run;controller?.abort();controller=null;draft=null;error=null;phase='empty';state=await update({type:'draft',value:null});render();}
async function handleAction(event){
  const button=event.target.closest('[data-action]');if(!button)return;const action=button.dataset.action,index=Number(button.dataset.index),taskId=button.dataset.id;
  try{
    if(action==='generate'){await generate();return;}
    if(action==='review-update'){await generate({review:true});return;}
    if(action==='open-existing'){view='list';await dismiss();return;}
    if(action==='plan-current'){view='plan';phase='empty';draft=null;render();return;}
    if(action==='settings'){await chrome.runtime.openOptionsPage();return;}
    if(action==='finish-setup'){state=await update({type:'settings',value:{onboardingDone:true}});render();return;}
    if(action==='allow'){
      if(!safeUrl(current?.url))return;
      const request=chrome.permissions.request({origins:[originPattern(current.url)]});
      if(await request){permission=true;notify('Site access enabled. Read the assignment above, then generate.');}else notify('Access was not granted. You can paste instructions or upload a PDF instead.');render();return;
    }
    if(action==='dismiss'){await dismiss();return;}
    if(action==='select-update')return;
    if(action==='apply-update'||action==='add-step'||action==='add-all'){
      if(phase!=='ready'||!draft)return;button.disabled=true;
      state=await update({type:action==='apply-update'?'mergePlan':'addSteps',draft,indexes:action==='apply-update'?[...selected]:action==='add-all'?draft.steps.map((_,i)=>i):[index]});
      if(action!=='add-step'){view='list';await dismiss();}else render();return;
    }
    if(action==='toggle-task')state=await update({type:'toggleTask',id:taskId});
    if(action==='delete-task')state=await update({type:'deleteTask',id:taskId});
    if(action==='delete-group'){if(!confirm('Delete this assignment and its tasks?'))return;state=await update({type:'deleteGroup',id:taskId});}
    if(action==='toggle-done')state=await update({type:'doneOpen',value:!state.doneOpen});
    if(action==='edit-step'||action==='edit-task'){
      const item=action==='edit-step'?draft.steps[index]:state.tasks.find(t=>t.id===taskId);if(!item)return;editTarget={type:action,index,id:taskId};$('#edit-title').value=item.title;$('#edit-detail').value=item.firstAction||item.detail||'';$('#edit-dialog').showModal();return;
    }
    if(action==='help-step'||action==='help-task'){await openHelp(action,index,taskId);return;}
    if(action==='calendar-task'){
      const task=state.tasks.find(t=>t.id===taskId);if(!task)return;
      const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const date=prompt('Calendar date (YYYY-MM-DD). Download an all-day event to import.',today);if(date){const {downloadCalendar}=await import('./calendar.js');downloadCalendar(task,date.trim());}return;
    }
    render();
  }catch(e){notify(e.message);button.disabled=false;}
}
$('#main').addEventListener('click',handleAction);$('#setup-region').addEventListener('click',handleAction);
$('#main').addEventListener('change',async e=>{
  if(e.target.dataset.action==='select-update'){const i=Number(e.target.dataset.index);if(e.target.checked)selected.add(i);else selected.delete(i);render();}
  if(e.target.id==='attach-page')try{state=await update({type:'settings',value:{attachPage:e.target.checked}});}catch(e){notify(e.message);}
});
$('#main').addEventListener('submit',async e=>{
  if(e.target.id!=='quick-add')return;e.preventDefault();const title=$('#quick-title').value.trim();if(!title)return;
  try{state=await update({type:'quickAdd',title,source:$('#attach-page').checked?current:null});$('#quick-title').value='';render();}catch(e){notify(e.message);}
});
$('#cancel-edit').onclick=()=>$('#edit-dialog').close();
$('#edit-form').onsubmit=async e=>{
  e.preventDefault();const title=$('#edit-title').value.trim(),detail=$('#edit-detail').value.trim();if(!title||!detail){notify('Enter a title and a first action.');return;}
  try{if(editTarget.type==='edit-step'){
    const step=draft.steps[editTarget.index],originalTitle=step.title;step.title=title;step.firstAction=detail;state=await update({type:'draft',value:draft});
    const task=state.tasks.find(t=>t.stepId===step.id);if(task)state=await update({type:'editTask',id:task.id,title,detail});
  }else state=await update({type:'editTask',id:editTarget.id,title,detail});$('#edit-dialog').close();render();}catch(e){notify(e.message);}
};
$('#read-page').onclick=async()=>{if(pdfController){inputStatus('Wait for PDF reading to finish.');return;}try{await readPage();}catch(e){inputStatus('Could not read this page. Use Allow this site in setup, or paste instructions / upload a PDF.');}};
$('#additional-instructions').addEventListener('input',()=>{inputState.extra=$('#additional-instructions').value;scheduleStash();});
$('#page-preview').addEventListener('input',()=>{inputState.page={...inputState.page,...current,text:$('#page-preview').value,edited:true};scheduleStash();});
$('#clear-inputs').onclick=async()=>{++inputRun;pdfController?.abort();inputState={extra:'',page:null,pdfs:[]};$('#additional-instructions').value='';$('#page-preview').value='';renderAttachments();await stashInputs();inputStatus('Extra inputs cleared for this page. Saved tasks are unchanged.');};
function syncDetail(){const custom=$('#detail-mode').value==='custom';$('#custom-count-field').hidden=!custom;}
$('#detail-mode').onchange=async()=>{syncDetail();try{state=await update({type:'settings',value:{detail:$('#detail-mode').value,customCount:Number($('#custom-count').value)}});}catch(e){notify(e.message);}};
$('#custom-count').onchange=$('#detail-mode').onchange;
async function importPDF(bytes,name,token,request){
  const pdf=await parsePdf(bytes,{name,signal:request.signal,onProgress:({page,total})=>{if(token===inputRun)inputStatus(`Reading PDF page ${page} of ${total}…`);}});
  if(token!==inputRun)return;inputState.pdfs.push(pdf);renderAttachments();await stashInputs();inputStatus('PDF text is ready. Review its preview and correct any missing or misread requirements before generating.');
}
async function loadPDF(getBytes,name){
  if(pdfController){inputStatus('A PDF is already loading.');return;}if(inputState.pdfs.length>=3){inputStatus('Up to 3 PDFs per assignment. Remove one first.');return;}
  const token=++inputRun,request=new AbortController();pdfController=request;const timer=setTimeout(()=>request.abort('timeout'),60000);inputStatus('Loading PDF…');$('#pdf-busy').hidden=false;
  try{await importPDF(await getBytes(request.signal),name,token,request);}catch(e){if(token===inputRun)inputStatus(request.signal.reason==='timeout'?'PDF reading timed out. Use a smaller file or paste the instructions.':e.message);}
  finally{clearTimeout(timer);if(pdfController===request)pdfController=null;$('#pdf-busy').hidden=true;$('#pdf-file').value='';}
}
$('#pdf-file').onchange=async()=>{const file=$('#pdf-file').files[0];if(!file)return;if(file.size>MAX_PDF_BYTES){inputStatus('Choose a PDF of 12 MB or less.');return;}await loadPDF(()=>file.arrayBuffer(),file.name);};
$('#load-pdf').onclick=async()=>{
  const entry=candidates[Number($('#pdf-link').value)];if($('#pdf-link').value===''||!entry)return;
  // Permission request begins directly inside the click gesture.
  const grant=chrome.permissions.request({origins:[originPattern(entry.url)]});
  if(!await grant){inputStatus('PDF access was not granted. Download the file in Canvas and upload it instead.');return;}
  await loadPDF(signal=>fetchPdf(entry.url,current.url,{signal}),entry.label||'Canvas PDF');
};
$('#cancel-pdf').onclick=()=>{pdfController?.abort();inputStatus('PDF reading stopped.');};
$('#pdf-previews').addEventListener('change',e=>{const p=inputState.pdfs.find(p=>p.id===e.target.dataset.pdfInclude);if(p){p.include=e.target.checked;scheduleStash();}});
$('#pdf-previews').addEventListener('input',e=>{const p=inputState.pdfs.find(p=>p.id===e.target.dataset.pdfText);if(p){p.text=e.target.value;scheduleStash();}});
$('#pdf-previews').addEventListener('click',e=>{const key=e.target.dataset.pdfRemove;if(!key)return;e.preventDefault();inputState.pdfs=inputState.pdfs.filter(p=>p.id!==key);renderAttachments();scheduleStash();});
function helpMarkup(help){return `<section class="step-help"><p>${escape(help.overview)}</p><ol>${help.steps.map(s=>`<li>${escape(s)}</li>`).join('')}</ol>${help.answer?`<h3>Answer / result</h3><p>${escape(help.answer)}</p>`:''}<h3>Check your work</h3><p>${escape(help.check)}</p></section>`;}
function stopHelp(){++helpRun;helpController?.abort();helpController=null;$('#ask-help').disabled=false;$('#stop-help').hidden=true;}
async function openHelp(action,index,taskId){
  if(!BUILD.api||!state.settings.stepHelp){notify('Enable step-by-step help in Settings.');return;}
  stopHelp();const item=action==='help-step'?draft.steps[index]:state.tasks.find(t=>t.id===taskId);if(!item)return;
  const context=action==='help-step'?draft.source.context:state.groups.find(g=>g.id===item.groupId)?.context;
  helpTarget={item:{...item},context:context||'',taskId:action==='help-task'?taskId:null};$('#help-title').textContent=item.title;$('#help-question').value='';$('#help-result').innerHTML=item.help?helpMarkup(item.help):'<p>Paste the exact problem or any missing data, then request an explanation.</p>';$('#help-dialog').showModal();
}
$('#close-help').onclick=()=>{stopHelp();$('#help-dialog').close();};$('#help-dialog').addEventListener('cancel',stopHelp);$('#stop-help').onclick=()=>{stopHelp();$('#help-result').textContent='Stopped.';};
$('#help-form').onsubmit=async e=>{
  e.preventDefault();if(!BUILD.api||!helpTarget||helpController)return;const token=++helpRun,target=helpTarget,request=new AbortController();helpController=request;
  $('#ask-help').disabled=true;$('#stop-help').hidden=false;$('#help-result').innerHTML=loadingProgress({label:'Preparing your explanation…'});const timer=setTimeout(()=>request.abort('timeout'),180000);
  try{const [{generateHelp},{getKey}]=await Promise.all([import('./ai.js'),import('./keys.js')]);const result=await generateHelp(target.item,target.context,$('#help-question').value,state.settings,await getKey(),{signal:request.signal});
    if(token!==helpRun)return;if(!state.settings.stepHelp)throw new Error('Step help was disabled.');
    if(target.taskId){state=await update({type:'taskHelp',id:target.taskId,value:result,expected:{title:target.item.title,detail:target.item.detail}});if(token!==helpRun)return;}
    target.item.help=result;$('#help-result').innerHTML=helpMarkup(result);render();
  }catch(e){if(token===helpRun)$('#help-result').textContent=request.signal.reason==='timeout'?'The explanation timed out.':e.message;}
  finally{clearTimeout(timer);if(token===helpRun){helpController=null;$('#ask-help').disabled=false;$('#stop-help').hidden=true;}}
};
chrome.tabs.onActivated.addListener(()=>refreshCurrent().catch(()=>{}));
chrome.tabs.onUpdated.addListener((tabId,change)=>{if(tabId===current?.tabId&&(change.status==='complete'||change.url))refreshCurrent().catch(()=>{});});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.stepwise?.newValue){state=changes.stepwise.newValue;queueRender();}});
window.addEventListener('pagehide',()=>{++run;++inputRun;controller?.abort();pdfController?.abort();stopHelp();clearTimeout(persistTimer);void stashInputs();});
try{
  state=await getState();inputCache=(await chrome.storage.session.get('stepwiseInputs')).stepwiseInputs||{};
  if(state.draft){draft=state.draft;phase='ready';}else if(state.tasks.length)view='list';
  $('#detail-mode').value=state.settings.detail||'auto';$('#custom-count').value=state.settings.customCount||10;syncDetail();watchTheme();await refreshCurrent();render();
  connectionStatus().then(value=>{connection=value;render();}).catch(e=>{connection={ready:false,message:e.message};render();});
}catch(e){$('#main').textContent=e.message;}

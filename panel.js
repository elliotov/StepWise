import {DEFAULTS,id,host,safeUrl,sourceUrl,originPattern,normalizeStep} from './core.js';
import {extractPage} from './extract.js';
import {generatePlan} from './ai.js';
import {$,escape,icon,logo,sourceChip,minuteChip,dueChip,getState,update,applyTheme,watchTheme,notify,pageCard} from './ui.js';
let state,current=null,draft=null,view='plan',phase='empty',error=null,controller=null,editTarget=null,run=0,refreshId=0;
$('#home').innerHTML=logo();$('#settings').innerHTML=icon('gear');
$('#settings').onclick=()=>chrome.runtime.openOptionsPage();
$('#home').onclick=e=>{e.preventDefault();view='plan';render();};
$('#plan-tab').onclick=()=>{view='plan';render();};
$('#list-tab').onclick=()=>{view='list';render();};
function isAdded(step){return state.tasks.some(t=>t.stepId===step.id || (t.sourceUrl===draft?.source.url && t.title.toLowerCase()===step.title.toLowerCase()));}
function render(){
  if(!state)return;
  applyTheme(state.settings);
  const open=state.tasks.filter(t=>!t.done).length;
  $('#open-count').textContent=`${open} open`;$('#list-count').textContent=open||'';
  $('#plan-tab').classList.toggle('selected',view==='plan');$('#list-tab').classList.toggle('selected',view==='list');
  $('#plan-tab').setAttribute('aria-current',view==='plan'?'page':'false');$('#list-tab').setAttribute('aria-current',view==='list'?'page':'false');
  $('#main').setAttribute('aria-busy',String(phase==='streaming' && view==='plan'));
  $('#main').innerHTML=view==='plan'?renderPlan():renderList();
}
function renderPlan(){
  if(phase==='empty' && !draft)return `<section class="empty"><div class="empty-art">${icon('bolt')}<span class="mini-tick">${icon('check')}</span></div><div class="eyebrow">A little structure. A lighter start.</div><h1>Big assignment.<br>Small first step.</h1><p>Turn the page you’re on into a clear plan. Start with one tiny action, then take it step by step.</p><button class="primary full" data-action="generate">Break this into steps ${icon('arrow')}</button><p class="microcopy">Start small and work at your own pace.</p><button class="text-button" data-action="settings">Set up your AI connection</button></section>`;
  const source=draft?.source || current;
  const switched=draft && current?.url && source?.url!==current.url;
  return `${pageCard(source)}${source?.due?`<div class="chips">${dueChip(source.due)}</div>`:''}${switched?'<p class="inline-note">This plan stays linked to its original page. Dismiss it to plan your current tab.</p>':''}
    <div class="breakdown-heading"><span class="status" role="status">${phase==='streaming'?'<span class="pulse"></span>Thinking wisely…':phase==='ready'?icon('check')+` ${draft.steps.length} steps, one clear path`:icon('alert')+'Let’s get connected'}</span><button class="icon-button" data-action="dismiss" aria-label="Dismiss plan" title="Dismiss plan">${icon('close')}</button></div>
    ${error?renderError():''}
    ${phase!=='error'?(draft?.steps||[]).map((s,i)=>stepCard(s,i)).join(''):''}
    ${phase==='streaming'?'<div class="skeleton" aria-label="Waiting for the next step"><span></span><span></span><span></span></div><p class="plan-note">Reading the requirements and finding a small place to start.</p>':''}
    ${phase==='ready'?`<p class="plan-note">${escape(draft.note || 'Your plan is a starting point. Check it against the assignment and edit any step. Time estimates are approximate.')}</p>${draft.source.truncated?'<p class="inline-note">This page was long. Only its first 40,000 characters were included.</p>':''}${draft.source.hasEmbedded?'<p class="inline-note">Embedded documents were not read. Check those instructions separately.</p>':''}<div class="plan-actions"><button class="primary full" data-action="add-all">${draft.steps.every(isAdded)?'View my to-do list':`Add all ${draft.steps.filter(s=>!isAdded(s)).length} steps to list`} ${icon('arrow')}</button></div>`:''}`;
}
function renderError(){return `<div class="error" role="alert"><h3>${icon('alert')}${escape(error.title||'Could not make this plan')}</h3><p>${escape(error.message)}</p>${error.action==='allow'?'<button class="primary small" data-action="allow">Allow on this site</button>':error.action==='settings'?'<button class="primary small" data-action="settings">Open Settings</button>':error.action==='retry'?'<button class="primary small" data-action="generate">Try again</button>':''}</div>`;}
function stepCard(step,index){const added=isAdded(step);return `<article class="step ${index===0?'first':''}"><div class="step-top"><span class="number">${index+1}</span>${index===0?'<span class="start-badge">Start here</span>':''}<span class="spacer"></span>${phase==='ready'?`<button class="icon-button" data-action="edit-step" data-index="${index}" aria-label="Edit step ${index+1}">${icon('edit')}</button><button class="icon-button add-step" data-action="add-step" data-index="${index}" aria-label="${added?'Already added':'Add step '+(index+1)}" ${added?'disabled':''}>${icon(added?'check':'plus')}</button>`:''}</div><h3>${escape(step.title)}</h3><p>${escape(step.firstAction)}</p></article>`;}
function renderList(){
  const done=state.tasks.filter(t=>t.done),open=state.tasks.filter(t=>!t.done);
  return `<div class="section-heading"><div><div class="eyebrow">One thing at a time</div><h2>Your next steps</h2></div>${open.length?`<span class="muted tiny">${open.length} to go</span>`:''}</div>
    <form id="quick-add" class="quick-add"><div class="quick-input"><input id="quick-title" aria-label="New task" placeholder="Add a task…" maxlength="180" required autocomplete="off"><button class="icon-button" aria-label="Add task" type="submit">${icon('plus')}</button></div><label class="attach"><input type="checkbox" id="attach-page" ${state.settings.attachPage?'checked':''}>${icon('link')}Attach current page</label></form>
    ${!open.length?`<section class="list-empty">${icon('leaf')}<h3>${done.length?'A little more breathing room.':'A fresh start.'}</h3><p>${done.length?'All your saved steps are done.':'Break down an assignment or add your first task above.'}</p></section>`:''}
    ${state.groups.filter(g=>open.some(t=>t.groupId===g.id)).map(g=>{const all=state.tasks.filter(t=>t.groupId===g.id),completed=all.filter(t=>t.done).length;return `<section class="task-group"><div class="group-heading">${icon('globe')}<strong title="${escape(g.title)}">${escape(g.title)}</strong><span class="progress-count">${completed} of ${all.length}</span><button class="icon-button" data-action="delete-group" data-id="${g.id}" aria-label="Delete assignment group">${icon('trash')}</button></div><div class="progress-track" role="progressbar" aria-label="${escape(g.title)} progress" aria-valuenow="${completed}" aria-valuemin="0" aria-valuemax="${all.length}"><span style="width:${Math.round(completed/all.length*100)}%"></span></div>${open.filter(t=>t.groupId===g.id).map(taskRow).join('')}</section>`;}).join('')}
    ${done.length?`<button class="text-button done-toggle" data-action="toggle-done" aria-expanded="${state.doneOpen}">${icon('chevron')}${state.doneOpen?'Hide':'Show'} ${done.length} done</button>${state.doneOpen?done.map(taskRow).join(''):''}`:''}
    <section class="list-page-region"><div class="eyebrow">Keep your momentum</div>${pageCard(current,{action:true})}</section>`;
}
function taskRow(t){return `<article class="task-row ${t.done?'done':''}"><input type="checkbox" data-action="toggle-task" data-id="${t.id}" aria-label="Mark ${escape(t.title)} ${t.done?'incomplete':'complete'}" ${t.done?'checked':''}><div class="task-content"><button class="task-title" data-action="edit-task" data-id="${t.id}" title="Edit task">${escape(t.title)}</button>${t.detail?`<p class="task-detail">${escape(t.detail)}</p>`:''}<div class="chips">${sourceChip(t.sourceUrl)}${dueChip(t.due)}</div></div><button class="icon-button" data-action="delete-task" data-id="${t.id}" aria-label="Delete ${escape(t.title)}">${icon('close')}</button></article>`;}
async function refreshCurrent(){
  const n=++refreshId;const tabs=await chrome.tabs.query({active:true,currentWindow:true});const tab=tabs[0];
  if(n!==refreshId)return;
  current=tab?{tabId:tab.id,title:tab.title||'Current page',url:sourceUrl(tab.url),due:''}:null;
  if(view==='plan' || !$('#quick-title')?.value)render();
}
function showError(title,message,action){phase='error';error={title,message,action};render();}
async function generate(){
  controller?.abort();const token=++run;view='plan';error=null;draft=null;phase='streaming';render();
  const ensure=()=>{if(token!==run)throw new DOMException('Aborted','AbortError');};
  try{
    // Clearing the previous draft is explicit and avoids restoring a stale plan.
    state=await update({type:'draft',value:null});ensure();
    await refreshCurrent();ensure();
    const captured={...current};
    if(!captured.tabId || !safeUrl(captured.url)){showError('Open an assignment first','Stepwise can read regular websites. Open a Canvas assignment in a browser tab, then click the Stepwise toolbar icon.');return;}
    let extraction;
    try{const result=await chrome.scripting.executeScript({target:{tabId:captured.tabId},func:extractPage});extraction=result[0]?.result;}
    catch{ensure();draft={source:captured,steps:[]};showError('Site access required',`Allow Stepwise to read the assignment you open on ${host(captured.url)}. It processes the instructions locally when you request a plan.`,'allow');return;}
    ensure();
    if(extraction?.error){showError('Instructions not found',extraction.error,'retry');return;}
    if(!extraction?.text)throw new Error('The page could not be read. Reload the assignment and try again.');
    extraction.url=sourceUrl(extraction.url);extraction.tabId=captured.tabId;
    extraction.links=extraction.links.map(l=>({...l,url:sourceUrl(l.url)}));
    draft={id:id(),source:extraction,steps:[],note:''};render();
    const requestController=new AbortController();controller=requestController;
    const timer=setTimeout(()=>requestController.abort('timeout'),600000);
    let result;
    try{result=await generatePlan(extraction,{...DEFAULTS,...state.settings},null,{signal:requestController.signal,onProgress:percent=>{if(token===run){const note=document.querySelector('.plan-note');if(note)note.textContent=`Downloading local AI: ${percent}%. Keep this panel open.`;}},onSteps:steps=>{if(token!==run)return;try{draft.steps=steps.map(normalizeStep);render();}catch{/* Wait for final validation. */}}});}
    finally{clearTimeout(timer);}
    ensure();
    const {text:rawText,links:rawLinks,...savedSource}=extraction;
    draft={...draft,...result,source:savedSource};
    phase='ready';error=null;
    state=await update({type:'draft',value:draft});ensure();
    if(state.settings.autoAdd){state=await update({type:'addSteps',draft,indexes:[0]});ensure();notify('Your first step is in your list.');}
    render();
  }catch(e){if(token!==run)return;if(controller?.signal.reason==='timeout')showError('This is taking longer than expected','The request timed out. Try again. If the model is downloading, finish setup in Settings.','retry');else if(e.name!=='AbortError')showError('Could not make this plan',e instanceof TypeError?'Chrome local AI could not start. Open Settings to check availability.':e.message,'retry');}
  finally{if(token===run)controller=null;}
}
$('#main').addEventListener('click',async e=>{
  const button=e.target.closest('[data-action]');if(!button)return;
  const action=button.dataset.action,index=Number(button.dataset.index),taskId=button.dataset.id;
  try{
    if(action==='generate'){await generate();return;}
    if(action==='settings'){await chrome.runtime.openOptionsPage();return;}
    if(action==='allow'){
      const target=draft?.source?.url||current?.url;if(!safeUrl(target))return;
      // Called directly from a click, before any await, to preserve user activation.
      const grant=chrome.permissions.request({origins:[originPattern(target)]});
      if(await grant)await generate();else notify('Site access was not granted. You can try again anytime.');return;
    }
    if(action==='dismiss'){++run;controller?.abort();controller=null;draft=null;error=null;phase='empty';state=await update({type:'draft',value:null});render();return;}
    if(action==='add-step' || action==='add-all'){
      button.disabled=true;state=await update({type:'addSteps',draft,indexes:action==='add-all'?draft.steps.map((_,i)=>i):[index]});
      if(action==='add-all'){view='list';state=await update({type:'draft',value:null});draft=null;phase='empty';}else notify('Step added to your list.');render();return;
    }
    if(action==='toggle-task')state=await update({type:'toggleTask',id:taskId});
    if(action==='delete-task')state=await update({type:'deleteTask',id:taskId});
    if(action==='delete-group'){
      const group=state.groups.find(g=>g.id===taskId);
      if(!confirm(`Delete “${group?.title}” and its saved tasks?`))return;
      state=await update({type:'deleteGroup',id:taskId});
    }
    if(action==='toggle-done')state=await update({type:'doneOpen',value:!state.doneOpen});
    if(action==='edit-step' || action==='edit-task'){
      const item=action==='edit-step'?draft.steps[index]:state.tasks.find(t=>t.id===taskId);
      editTarget={type:action,index,id:taskId};$('#edit-title').value=item.title;$('#edit-detail').value=item.firstAction||item.detail||'';$('#edit-dialog').showModal();return;
    }
    render();
  }catch(err){notify(err.message);button.disabled=false;}
});
$('#main').addEventListener('submit',async e=>{
  if(e.target.id!=='quick-add')return;e.preventDefault();
  const title=$('#quick-title').value.trim();if(!title)return;
  const attach=$('#attach-page').checked;
  if(attach && !current?.url){notify('Open a web page to attach it, or uncheck Attach current page.');return;}
  try{state=await update({type:'quickAdd',title,source:attach?current:null});render();$('#quick-title')?.focus();}catch(err){notify(err.message);}
});
$('#main').addEventListener('change',async e=>{if(e.target.id==='attach-page')try{state=await update({type:'settings',value:{attachPage:e.target.checked}});}catch(err){notify(err.message);}});
$('#cancel-edit').onclick=()=>$('#edit-dialog').close();
$('#edit-form').onsubmit=async e=>{
  e.preventDefault();const title=$('#edit-title').value.trim(),detail=$('#edit-detail').value.trim();if(!title)return;
  try{
    if(editTarget.type==='edit-step'){
      const step=draft.steps[editTarget.index];step.title=title;step.firstAction=detail;state=await update({type:'draft',value:draft});
      // Editing an already-added step also updates its saved task.
      const task=state.tasks.find(t=>t.stepId===step.id);if(task)state=await update({type:'editTask',id:task.id,title,detail});
    }else state=await update({type:'editTask',id:editTarget.id,title,detail});
    $('#edit-dialog').close();render();
  }catch(err){notify(err.message);}
};
chrome.tabs.onActivated.addListener(()=>refreshCurrent().catch(()=>{}));
chrome.tabs.onUpdated.addListener((tabId,change)=>{if(tabId===current?.tabId && (change.status==='complete' || change.url))refreshCurrent().catch(()=>{});});
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area!=='local' || !changes.stepwise?.newValue)return;
  state=changes.stepwise.newValue;applyTheme(state.settings);
  // Preserve in-progress typing in quick-add and editing forms.
  if(!$('#quick-title')?.value && !$('#edit-dialog').open)render();
});
window.addEventListener('pagehide',()=>{++run;controller?.abort();});
try{state=await getState();if(state.draft){draft=state.draft;phase='ready';}else if(state.tasks.length)view='list';watchTheme();await refreshCurrent();render();}
catch(err){$('#main').textContent=err.message;}

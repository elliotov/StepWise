import {aiAvailability,enableLocalAI} from './ai.js';
import {DEFAULTS,originPattern,safeUrl} from './core.js';
import {$,escape,icon,logo,getState,update,applyTheme,watchTheme,notify} from './ui.js';
$('#brand').innerHTML=logo();$('#connection-heading').innerHTML=icon('bolt')+'AI connection';
let state,dirty=false,currentWindowId;
async function checkAI(){
  try{const status=await aiAvailability();$('#ai-status').textContent=({available:'Local AI is ready. Open an assignment to make a plan.',downloadable:'Compatible. Click Enable local AI to download the model.',downloading:'Chrome is downloading the model. Click Enable local AI to follow progress.',unavailable:'Local AI is unavailable. Update Chrome, check the requirements above, and check browser policies if this is a managed profile.'})[status]||status;return status;}catch(err){$('#ai-status').textContent=err.message;}
}
$('#check-ai').onclick=checkAI;
$('#enable-ai').onclick=async()=>{
  const button=$('#enable-ai');button.disabled=true;$('#ai-status').textContent='Starting local AI. Keep this tab open…';
  let session;try{session=await enableLocalAI({onProgress:n=>{$('#ai-status').textContent=`Downloading local AI: ${n}%`;} });$('#ai-status').textContent='Local AI is ready. Open an assignment to make a plan.';}catch(err){$('#ai-status').textContent=err.message;}finally{session?.destroy();button.disabled=false;}
};
async function sites(){const permissions=await chrome.permissions.getAll();const origins=(permissions.origins||[]).filter(x=>x!=='https://api.openai.com/*');$('#sites').innerHTML=origins.length?origins.map(o=>`<div class="site-row"><span>${escape(o.replace(/\/\*$/,''))}</span><button type="button" class="icon-button" data-origin="${escape(o)}" aria-label="Remove access to ${escape(o)}">${icon('close')}</button></div>`).join(''):'<p class="field-help">No permanently allowed sites yet. You can also grant access from the side panel.</p>';}
$('#sites').onclick=async e=>{const b=e.target.closest('[data-origin]');if(!b)return;try{await chrome.permissions.remove({origins:[b.dataset.origin]});await sites();$('#site-status').textContent='Site access removed. Temporary toolbar access may last until you navigate away.';}catch{notify('Could not remove this site permission.');}};
$('#add-site').onclick=async()=>{
  try{let url=$('#site-input').value.trim();if(!url)return;if(!/^https?:\/\//i.test(url))url='https://'+url;if(!safeUrl(url))throw new Error('Enter a valid website address.');const u=new URL(url);if(u.username||u.password||!u.hostname.includes('.'))throw new Error('Enter a full domain, such as canvas.yourschool.edu.');
    const request=chrome.permissions.request({origins:[originPattern(url)]});
    if(await request){$('#site-input').value='';$('#site-status').textContent='Site allowed.';await sites();}else $('#site-status').textContent='Site access was not granted.';
  }catch(err){$('#site-status').textContent=err.message;}
};
$('#theme').onchange=()=>applyTheme({theme:$('#theme').value});
$('#settings-form').addEventListener('input',()=>{dirty=true;$('#save-status').textContent='Unsaved changes';});
$('#settings-form').onsubmit=async e=>{
  e.preventDefault();const save=e.submitter;save.disabled=true;
  try{
    state=await update({type:'settings',value:{provider:'chrome',model:'gemini-nano',stepCount:'auto',theme:$('#theme').value,autoAdd:$('#auto-add').checked,attachPage:$('#attach-default').checked}});
    dirty=false;applyTheme(state.settings);$('#save-status').textContent='Settings saved.';notify('You’re set. Open an assignment to make a plan.');
  }catch(err){$('#save-status').textContent=err.message;}finally{save.disabled=false;}
};
$('#back').onclick=async()=>{try{await chrome.sidePanel.open({windowId:currentWindowId});}catch{notify('Click the Stepwise icon in your browser toolbar to open the panel.');}};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
try{currentWindowId=(await chrome.windows.getCurrent()).id;state=await getState();const s={...DEFAULTS,...state.settings};applyTheme(s);watchTheme();$('#theme').value=s.theme;$('#auto-add').checked=s.autoAdd;$('#attach-default').checked=s.attachPage;await checkAI();await sites();}catch(err){$('#save-status').textContent=err.message;}

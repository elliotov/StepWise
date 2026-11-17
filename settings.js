import {BUILD} from './config.js';
import {DEFAULTS,originPattern,safeUrl} from './core.js';
import {connectionStatus} from './provider.js';
import {$,escape,icon,logo,getState,update,applyTheme,watchTheme,notify} from './ui.js';
$('#brand').innerHTML=logo();$('#version-label').textContent=`v${BUILD.version} · ${BUILD.api?'OpenAI API':'Chrome local AI'}`;
let state,dirty=false,currentWindowId;
$('#api-fields').hidden=!BUILD.api;$('#local-fields').hidden=BUILD.api;$('#help-setting').hidden=!BUILD.api;
$('#privacy').textContent=BUILD.api?'PDFs are parsed on your computer. When you generate a plan, the page text, included PDF text and added instructions are sent to OpenAI using your key. Step help sends selected task context and your question. Tasks, context and explanations remain in this Chrome profile; extra inputs are kept for up to five pages in browser session storage. API requests disable response storage; OpenAI API policies still apply. Calendar export downloads an import file and does not sync accounts.':'PDFs are parsed on your computer. Selected PDF links are downloaded only when you ask; planning uses Chrome’s local AI. Tasks and assignment context stay in this profile; extra inputs are kept for up to five pages in browser session storage. No assignment text is sent to an AI service. Scanned PDFs need OCR, which is not included.';
async function checkConnection(){try{const value=await connectionStatus();$('#connection-status').textContent=value.message;return value;}catch(e){$('#connection-status').textContent=e.message;}}
$('#check-connection').onclick=checkConnection;
$('#enable-ai').onclick=async()=>{const button=$('#enable-ai');button.disabled=true;try{const {setupConnection}=await import('./provider.js');await setupConnection({onProgress:n=>{$('#connection-status').textContent=`Downloading local AI: ${n}%`;}});await checkConnection();}catch(e){$('#connection-status').textContent=e.message;}finally{button.disabled=false;}};
async function keyStatus(){if(!BUILD.api)return;const {getKey}=await import('./keys.js');const key=await getKey(),local=await chrome.storage.local.get('apiKey');$('#key-status').textContent=key?(local.apiKey?'Key remembered on this device.':'Key available until Chrome restarts.'):'No key saved.';$('#remember-key').checked=!!local.apiKey;}
$('#remove-key').onclick=async()=>{const {removeKey}=await import('./keys.js');await removeKey();$('#api-key').value='';await keyStatus();await checkConnection();};
async function sites(){const perms=await chrome.permissions.getAll();const origins=(perms.origins||[]).filter(o=>o!=='https://api.openai.com/*');$('#sites').innerHTML=origins.length?origins.map(o=>`<div class="site-row"><span>${escape(o)}</span><button type="button" class="text-button" data-origin="${escape(o)}">Remove</button></div>`).join(''):'<p class="field-help">No permanently allowed sites yet. Allow a Canvas site from the setup checklist or below.</p>';}
$('#sites').onclick=async e=>{const b=e.target.closest('[data-origin]');if(!b)return;try{await chrome.permissions.remove({origins:[b.dataset.origin]});await sites();}catch(e){notify(e.message);}};
$('#add-site').onclick=async()=>{try{let url=$('#site-input').value.trim();if(!/^https?:\/\//i.test(url))url='https://'+url;if(!safeUrl(url))throw new Error('Enter a valid website.');const request=chrome.permissions.request({origins:[originPattern(url)]});$('#site-status').textContent=await request?'Site allowed.':'Permission was not granted.';await sites();}catch(e){$('#site-status').textContent=e.message;}};
function detail(){ $('#custom-field').hidden=$('#detail').value!=='custom'; }
$('#detail').onchange=detail;$('#theme').onchange=()=>applyTheme({theme:$('#theme').value});
$('#settings-form').addEventListener('input',()=>{dirty=true;$('#save-status').textContent='Unsaved changes';});
$('#settings-form').onsubmit=async e=>{
  e.preventDefault();const save=e.submitter;save.disabled=true;
  try{
    const count=Number($('#custom-count').value);if(!Number.isInteger(count)||count<3||count>30)throw new Error('Choose a custom maximum of 3–30 steps.');
    let model=BUILD.model;
    if(BUILD.api){model=$('#model').value.trim();if(!/^[a-zA-Z0-9_.:/-]{1,100}$/.test(model))throw new Error('Enter a valid model ID.');const {getKey,saveKey}=await import('./keys.js');await saveKey($('#api-key').value.trim()||await getKey(),$('#remember-key').checked);$('#api-key').value='';await keyStatus();}
    state=await update({type:'settings',value:{provider:BUILD.provider,model,stepHelp:BUILD.api&&$('#step-help').checked,detail:$('#detail').value,customCount:count,theme:$('#theme').value,autoAdd:$('#auto-add').checked,attachPage:$('#attach-default').checked}});
    dirty=false;applyTheme(state.settings);$('#save-status').textContent='Settings saved.';await checkConnection();
  }catch(e){$('#save-status').textContent=e.message;}finally{save.disabled=false;}
};
$('#show-setup').onclick=async()=>{state=await update({type:'settings',value:{onboardingDone:false}});notify('Setup checklist restored. Reopen Stepwise.');};
$('#back').onclick=async()=>{try{await chrome.sidePanel.open({windowId:currentWindowId});}catch{notify('Click the Stepwise toolbar icon to open the panel.');}};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
try{currentWindowId=(await chrome.windows.getCurrent()).id;state=await getState();const s={...DEFAULTS,...state.settings};applyTheme(s);watchTheme();$('#theme').value=s.theme;$('#detail').value=s.detail;$('#custom-count').value=s.customCount;detail();$('#auto-add').checked=s.autoAdd;$('#attach-default').checked=s.attachPage;$('#step-help').checked=s.stepHelp;$('#model').value=s.provider===BUILD.provider?s.model:BUILD.model;await keyStatus();await checkConnection();await sites();}catch(e){$('#save-status').textContent=e.message;}

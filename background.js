import {initialState,mutate} from './core.js';
async function configure(){
  await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  await chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  await chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true});
}
configure().catch(()=>{});
chrome.runtime.onInstalled.addListener(()=>configure());
chrome.runtime.onStartup.addListener(()=>configure());
let queue=Promise.resolve();
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(sender.id!==chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL('')))return;
  if(message.type!=='state' && message.type!=='mutate')return;
  queue=queue.then(async()=>{
    const saved=await chrome.storage.local.get('stepwise');
    let state=saved.stepwise || initialState();
    if(message.type==='mutate'){
      state=mutate(state,message.action);
      await chrome.storage.local.set({stepwise:state});
    }
    reply({ok:true,state});
  }).catch(()=>reply({ok:false,error:'Could not save your changes. Check available browser storage and try again.'}));
  return true;
});

chrome.runtime.onInstalled.addListener(async()=>{await chrome.storage.local.remove('apiKey');await chrome.storage.session.remove('apiKey');});

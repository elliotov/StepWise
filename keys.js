export async function getKey(){return (await chrome.storage.session.get('apiKey')).apiKey || (await chrome.storage.local.get('apiKey')).apiKey || '';}
export async function saveKey(key,remember){if(/\s/.test(key))throw new Error('Remove spaces or line breaks from the key.');await chrome.storage.session.set({apiKey:key});if(remember)await chrome.storage.local.set({apiKey:key});else await chrome.storage.local.remove('apiKey');}
export async function removeKey(){await chrome.storage.session.remove('apiKey');await chrome.storage.local.remove('apiKey');}

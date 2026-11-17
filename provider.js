import {getKey} from './keys.js';
import {generatePlan} from './ai.js';
export async function connectionStatus(){const key=await getKey();return {ready:!!key,status:key?'available':'missing-key',message:key?'API key saved (not yet verified by a request)':'Add your API key in Settings'};}
export async function plan(source,settings,options){return generatePlan(source,settings,await getKey(),options);}

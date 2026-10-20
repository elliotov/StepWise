import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,mutate} from '../core.js';
let state=initialState();const local={},session={},elements=new Map();
function el(k){if(!elements.has(k))elements.set(k,{innerHTML:'',textContent:'',value:'',type:'password',checked:false,disabled:false,placeholder:'',dataset:{},options:['gpt-5-mini','gpt-4.1-mini','gpt-4o-mini','custom'].map(value=>({value})),handlers:{},classList:{add(){},remove(){},toggle(){}},addEventListener(n,fn){this.handlers[n]=fn;}});return elements.get(k);}
globalThis.document={querySelector:el,documentElement:{dataset:{}}};globalThis.window={addEventListener(){}};globalThis.matchMedia=()=>({matches:false,addEventListener(){}});
const storage=memory=>({async get(k){return {[k]:memory[k]};},async set(v){Object.assign(memory,v);},async remove(k){delete memory[k];}});
globalThis.chrome={runtime:{async sendMessage(m){if(m.type==='mutate')state=mutate(state,m.action);return {ok:true,state:structuredClone(state)};}},storage:{local:storage(local),session:storage(session)},permissions:{async getAll(){return {origins:['https://api.openai.com/*']};}},windows:{async getCurrent(){return {id:3};}},sidePanel:{async open(){}}};
globalThis.LanguageModel={async availability(){return 'downloadable';},async create(opts){opts.monitor({addEventListener(type,cb){cb({loaded:1});}});return {destroy(){}};}};
await import('../settings.js');
const save=()=>el('#settings-form').onsubmit({preventDefault(){},submitter:{disabled:false}});
test('settings initialize a green theme with local AI setup',()=>{assert.equal(document.documentElement.dataset.theme,'light');assert.match(el('#ai-status').textContent,/Compatible/);});
test('local AI enable button reports readiness',async()=>{await el('#enable-ai').onclick();assert.match(el('#ai-status').textContent,/ready/);assert.equal(el('#enable-ai').disabled,false);});
test('saving uses Chrome AI with no key',async()=>{await save();assert.equal(state.settings.provider,'chrome');assert.equal(state.settings.model,'gemini-nano');assert.equal(state.settings.stepCount,'auto');assert.equal(local.apiKey,undefined);assert.equal(session.apiKey,undefined);});
test('dark-green preference is saved and applied',async()=>{el('#theme').value='dark';await save();assert.equal(state.settings.theme,'dark');assert.equal(document.documentElement.dataset.theme,'dark');});

import test from 'node:test';import assert from 'node:assert/strict';import {initialState,mutate} from '../core.js';import {BUILD} from '../config.js';
let state=initialState();const local={},session={},elements=new Map();
function el(k){if(!elements.has(k))elements.set(k,{innerHTML:'',textContent:'',value:'',checked:false,disabled:false,hidden:false,handlers:{},classList:{add(){},remove(){},toggle(){}},addEventListener(n,fn){this.handlers[n]=fn;}});return elements.get(k);}
globalThis.document={querySelector:el,documentElement:{dataset:{}}};globalThis.window={addEventListener(){}};globalThis.matchMedia=()=>({matches:false,addEventListener(){}});
const storage=m=>({async get(k){return {[k]:m[k]};},async set(v){Object.assign(m,v);},async remove(k){delete m[k];}});
globalThis.chrome={runtime:{async sendMessage(m){if(m.type==='mutate')state=mutate(state,m.action);return {ok:true,state:structuredClone(state)};}},storage:{local:storage(local),session:storage(session)},permissions:{async getAll(){return {origins:[]};}},windows:{async getCurrent(){return {id:1};}},sidePanel:{async open(){}}};
globalThis.LanguageModel={async availability(){return 'available';},async create(){return {destroy(){}};}};
await import('../settings.js');const save=()=>el('#settings-form').onsubmit({preventDefault(){},submitter:{disabled:false}});
test('setup matches the actual build and restores default automatic detail',()=>{assert.equal(el('#detail').value,'auto');assert.equal(el('#api-fields').hidden,!BUILD.api);assert.equal(el('#local-fields').hidden,BUILD.api);});
test('custom detail can be saved without requiring a fixed step count',async()=>{el('#detail').value='custom';el('#custom-count').value='20';if(BUILD.api)el('#api-key').value='fake-private-key';await save();assert.equal(state.settings.detail,'custom');assert.equal(state.settings.customCount,20);assert.ok(!JSON.stringify(state).includes('fake-private-key'));});
test('custom range errors do not overwrite the last good setting',async()=>{el('#custom-count').value='99';await save();assert.equal(state.settings.customCount,20);assert.match(el('#save-status').textContent,/3–30/);el('#custom-count').value='20';});
test('setup checklist can be restored for existing users',async()=>{state.settings.onboardingDone=true;await el('#show-setup').onclick();assert.equal(state.settings.onboardingDone,false);});

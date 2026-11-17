// Small DOM doubles exercise the reconciler's node identity/scroll behavior.
// This is not a browser rendering or performance benchmark.
import test from 'node:test';import assert from 'node:assert/strict';import {renderStable} from '../stable-dom.js';
class Node {
  constructor(tag='',attrs={},children=[],value=''){this.nodeType=tag?1:3;this.tagName=tag.toUpperCase();this.map={...attrs};this.childNodes=[];this.nodeValue=value;this.scrollTop=0;for(const c of children)this.insertBefore(c,null);}
  get attributes(){return Object.entries(this.map).map(([name,value])=>({name,value}));}get id(){return this.map.id||'';}get firstChild(){return this.childNodes[0]||null;}get nextSibling(){if(!this.parentNode)return null;return this.parentNode.childNodes[this.parentNode.childNodes.indexOf(this)+1]||null;}
  getAttribute(n){return this.map[n]??null;}hasAttribute(n){return n in this.map;}setAttribute(n,v){this.map[n]=v;}removeAttribute(n){delete this.map[n];}
  insertBefore(n,b){if(n.parentNode){const a=n.parentNode.childNodes;a.splice(a.indexOf(n),1);}const i=b?this.childNodes.indexOf(b):this.childNodes.length;this.childNodes.splice(i,0,n);n.parentNode=this;}
  remove(){if(this.parentNode){const a=this.parentNode.childNodes;a.splice(a.indexOf(this),1);this.parentNode=null;}}
  cloneNode(){return new Node(this.tagName,this.map,this.childNodes.map(c=>c.cloneNode()),this.nodeValue);}
}
class Input extends Node{}class Textarea extends Node{}globalThis.HTMLInputElement=Input;globalThis.HTMLTextAreaElement=Textarea;
const text=s=>new Node('',{},[],s),step=(id,label)=>new Node('article',{'data-key':id},[text(label)]);
let next;
globalThis.document={scrollingElement:{scrollTop:400,scrollLeft:0},activeElement:null,createElement(){return {set innerHTML(v){this.content=next;}};}};
test('new steps append without replacing existing nodes or resetting scroll',()=>{const old=step('a','Step 1'),target=new Node('main',{},[old]);target.scrollTop=37;next=new Node('section',{},[step('a','Step 1'),step('b','Step 2')]);renderStable(target,'two steps');assert.equal(target.childNodes[0],old);assert.equal(target.childNodes.length,2);assert.equal(document.scrollingElement.scrollTop,400);assert.equal(target.scrollTop,37);});
test('unchanged rendering leaves every node untouched',()=>{const old=step('a','Step 1'),target=new Node('main',{},[old]);next=new Node('section',{},[step('a','Step 1')]);renderStable(target,'same');const child=target.firstChild;next=new Node('section',{},[step('a','Should not be used')]);renderStable(target,'same');assert.equal(target.firstChild,child);assert.equal(child.firstChild.nodeValue,'Step 1');});
test('keyed reordering retains existing task nodes and edits text in place',()=>{const a=step('a','Old'),b=step('b','Second'),target=new Node('main',{},[a,b]);next=new Node('section',{},[step('b','Second'),step('a','Edited')]);renderStable(target,'reordered');assert.equal(target.childNodes[0],b);assert.equal(target.childNodes[1],a);assert.equal(a.firstChild.nodeValue,'Edited');});
test('opened preview sections remain open during unrelated updates',()=>{const details=new Node('details',{'data-key':'preview',open:''},[text('Preview')]),target=new Node('main',{},[details]);next=new Node('section',{},[new Node('details',{'data-key':'preview'},[text('Updated preview')])]);renderStable(target,'details update');assert.equal(details.hasAttribute('open'),true);});

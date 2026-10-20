import test from 'node:test';
import assert from 'node:assert/strict';
import {extractPage} from '../extract.js';
function fixture({visible=false,loads=true}={}){
  let top=700;
  const scroll={isConnected:true,scrollLeft:0,style:{scrollBehavior:'smooth'},get scrollTop(){return top;},set scrollTop(v){top=v;}};
  const text='Create a labeled graph and discuss the results. Submit a two-page PDF report with an uncertainty discussion.';
  const content={cloneNode(){return {textContent:text,querySelectorAll(){return [];}};},querySelectorAll(){return [];},querySelector(){return null;},contains(){return false;}};
  globalThis.location={href:'https://canvas.example.edu/courses/10/assignments/30',hostname:'canvas.example.edu',pathname:'/courses/10/assignments/30'};
  globalThis.document={title:'Lab assignment',querySelector(s){if(s.startsWith('#application'))return {};if(s==='#assignment_show .description')return visible || (loads && top===0)?content:null;return null;},querySelectorAll(){return [scroll];}};
  return scroll;
}
test('reading available instructions does not move a scrolled page',async()=>{const scroll=fixture({visible:true});const result=await extractPage();assert.match(result.text,/two-page PDF/);assert.equal(scroll.scrollTop,700);assert.equal(scroll.style.scrollBehavior,'smooth');});
test('offscreen Canvas instructions recover and restore scroll position',async()=>{const scroll=fixture();const result=await extractPage();assert.match(result.text,/two-page PDF/);assert.equal(scroll.scrollTop,700);assert.equal(scroll.style.scrollBehavior,'smooth');});
test('failed recovery also restores the original view',async()=>{const scroll=fixture({loads:false});const result=await extractPage();assert.ok(result.error);assert.equal(scroll.scrollTop,700);assert.equal(scroll.style.scrollBehavior,'smooth');});

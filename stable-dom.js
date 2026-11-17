// Keyed DOM reconciliation. Existing task/step nodes, focused fields, and scroll
// containers survive updates. No scroll listener triggers a render.
function key(node){return node.nodeType===1?(node.getAttribute('data-key')||node.id||''):'';}
function compatible(a,b){return a.nodeType===b.nodeType&&(a.nodeType!==1||(a.tagName===b.tagName&&key(a)===key(b)));}
function patch(oldNode,newNode){
  if(oldNode.nodeType!==1){if(oldNode.nodeValue!==newNode.nodeValue)oldNode.nodeValue=newNode.nodeValue;return;}
  const active=oldNode===document.activeElement;
  for(const a of [...oldNode.attributes])if(!newNode.hasAttribute(a.name)&&!(oldNode.tagName==='DETAILS'&&a.name==='open'))oldNode.removeAttribute(a.name);
  for(const a of [...newNode.attributes])if(oldNode.getAttribute(a.name)!==a.value)oldNode.setAttribute(a.name,a.value);
  if(oldNode instanceof HTMLInputElement){if(!active&&oldNode.type!=='file')oldNode.value=newNode.value;oldNode.checked=newNode.checked;}
  if(oldNode instanceof HTMLTextAreaElement){if(!active)oldNode.value=newNode.value;return;}
  reconcile(oldNode,newNode);
}
function reconcile(parent,next){
  const keyed=new Map([...parent.childNodes].filter(n=>key(n)).map(n=>[key(n),n]));let cursor=parent.firstChild;
  for(const incoming of [...next.childNodes]){
    let current=key(incoming)?keyed.get(key(incoming)):cursor;
    if(current&&!compatible(current,incoming))current=null;
    if(current){if(current!==cursor)parent.insertBefore(current,cursor);patch(current,incoming);cursor=current.nextSibling;}
    else{const node=incoming.cloneNode(true);parent.insertBefore(node,cursor);cursor=node.nextSibling;}
  }
  while(cursor){const nextNode=cursor.nextSibling;cursor.remove();cursor=nextNode;}
}
export function renderStable(target,html){
  if(target.__lastMarkup===html)return;
  const template=document.createElement('template');template.innerHTML=html;
  const scroller=document.scrollingElement;const top=scroller?.scrollTop||0,left=scroller?.scrollLeft||0,inside=target.scrollTop;
  reconcile(target,template.content);target.__lastMarkup=html;
  target.scrollTop=inside;if(scroller){scroller.scrollTop=top;scroller.scrollLeft=left;}
}

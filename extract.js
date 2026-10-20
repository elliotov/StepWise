// Serialized by chrome.scripting.executeScript. Keep this function self-contained.
export async function extractPage(){
  function readPage(){
  const textOf=el=>{
    if(!el)return '';
    const copy=el.cloneNode(true);
    copy.querySelectorAll('script,style,noscript,nav,header,footer,form,input,textarea,select,button,[hidden],[aria-hidden="true"],.comments,.comment_list,#comments,#submission_comments,.submission_comments,[contenteditable],#submission_details,.submission-details,[data-testid="submission-comments"],[data-testid="submission-details"],#left-side,#right-side,#breadcrumbs,.assignment-student-header,#rubric_holder .grading_value').forEach(n=>n.remove());
    copy.querySelectorAll('br').forEach(n=>n.replaceWith('\n'));
    copy.querySelectorAll('p,div,li,h1,h2,h3,h4,section,tr,dt,dd').forEach(n=>n.append('\n'));
    return (copy.textContent||'').replace(/[ \t]+/g,' ').replace(/\n\s*\n\s*\n/g,'\n\n').trim();
  };
  const isCanvas=!!document.querySelector('#application.ic-app,#assignment_show,#assignment_show_content,.ic-app-main-content') || /(^|\.)instructure\.com$/.test(location.hostname);
  const selectors=['#assignment_show .description','#assignment_show_content .description','[data-testid="assignment-description"]','.assignment-description','#assignment_show .user_content','#assignment_show_content .user_content','.show-content.user_content','#wiki_page_show .user_content','#quiz_description','[data-testid="assignment-description-content"]','[data-testid="assignment-instructions"]','.student-assignment-overview .user_content','#assignment-student-view .user_content','#content .user_content','main .user_content','[role="main"] .user_content'];
  let content=selectors.map(s=>document.querySelector(s)).find(el=>el && textOf(el).length>25);
  // Canvas enhanced assignments do not always use the legacy description wrapper.
  // Fall back only on individual assignment/wiki routes, never course lists or quizzes.
  if(isCanvas && !content && /^\/courses\/[^/]+\/(assignments\/[^/]+|pages\/[^/]+)\/?$/.test(location.pathname)){
    const root=document.querySelector('#content') || document.querySelector('main') || document.querySelector('[role="main"]');
    if(root && textOf(root).length>100)content=root;
  }
  if(isCanvas && !content)return {error:'Open an individual Canvas assignment or course page with written instructions, then try again. Embedded documents and quiz questions are not read.'};
  if(!content)content=document.querySelector('article') || document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
  const title=(document.querySelector('h1.title,#assignment_show h1,.assignment-title,[data-testid="assignment-title"],h1')?.innerText || document.title || 'Untitled page').trim().slice(0,180);
  let text=textOf(content);
  const rubric=document.querySelector('#rubric_holder .rubric_table,.rubric_table');
  if(rubric && !content.contains(rubric))text+='\n\nRubric:\n'+textOf(rubric);
  let due='';
  // Canvas can list several differentiated dates: preserve the visible labels.
  const dates=document.querySelector('.assignment_dates');
  if(dates){
    const rows=[...dates.querySelectorAll('tbody tr')];
    const headings=[...dates.querySelectorAll('thead th')].map(x=>x.textContent.trim().toLowerCase());
    const dueIndex=headings.findIndex(x=>/^due/.test(x));
    const forIndex=headings.findIndex(x=>/^for$/.test(x));
    if(dueIndex>=0)due=rows.map(row=>{const c=[...row.querySelectorAll('td')];return [c[dueIndex]?.innerText,c[forIndex]?.innerText].filter(Boolean).join(' · ');}).filter(Boolean).join('; ');
  }
  if(!due){
    const dueElement=document.querySelector('.assignment_due_date,.due_date_display,[data-testid="assignment-due-date"],.student-assignment-overview .due-date');
    if(dueElement)due=dueElement.innerText.trim();
  }
  if(!due){
    const overview=document.querySelector('.student-assignment-overview,.assignment-overview,#assignment_show,#assignment-student-view,#content');
    const lines=(overview?.innerText||'').split('\n').map(x=>x.trim()).filter(Boolean);
    const i=lines.findIndex(x=>/^due(?:\s|:|$)/i.test(x));
    if(i>=0)due=lines[i].replace(/^due\s*:?\s*/i,'') || lines[i+1] || '';
  }
  const links=[...content.querySelectorAll('a[href]')].map(a=>({label:(a.innerText||a.textContent||'').trim().slice(0,160),url:a.href})).filter(a=>/^https?:/.test(a.url)).slice(0,30);
  const truncated=text.length>40000;
  text=text.slice(0,40000);
  if(text.length<40)return {error:'There are not enough readable instructions here. Open the assignment itself, or a page with selectable text.'};
  return {title,url:location.href,text,due:due.slice(0,400),links,isCanvas,truncated,hasEmbedded:!!content.querySelector('iframe,embed,object'),capturedAt:Date.now()};
  }
  const first=readPage();
  if(!first.error)return first;
  // Enhanced Canvas can unmount assignment text outside the scroll viewport.
  // Only recover on an individual assignment/wiki page, and always restore view.
  if(!/^\/courses\/[^/]+\/(assignments\/[^/]+|pages\/[^/]+)\/?$/.test(location.pathname))return first;
  const originalUrl=location.href;
  const positions=[...document.querySelectorAll('*')].filter(el=>el.scrollTop>0 || el.scrollLeft>0).map(el=>({el,top:el.scrollTop,left:el.scrollLeft,behavior:el.style.scrollBehavior}));
  if(!positions.length)return first;
  try{
    for(const {el} of positions){el.style.scrollBehavior='auto';el.scrollTop=0;el.scrollLeft=0;}
    for(const wait of [200,500,1000]){
      await new Promise(resolve=>setTimeout(resolve,wait));
      if(location.href!==originalUrl)return {error:'The page changed while reading. Try again on the assignment you want to plan.'};
      const result=readPage();if(!result.error)return result;
    }
    return first;
  }finally{
    if(location.href===originalUrl)for(const {el,top,left,behavior} of positions){if(el.isConnected){el.scrollTop=top;el.scrollLeft=left;el.style.scrollBehavior=behavior;}}
  }
}

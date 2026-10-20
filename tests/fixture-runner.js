import {extractPage} from '../extract.js';
const results=[];
function check(name,condition){results.push({name,passed:!!condition});}
try{
  const first=await extractPage();
  check('Canvas title',first.title==='Lab 3: Beam deflection');
  check('Assignment instructions',first.text.includes('two-page PDF'));
  check('Rubric appended',first.text.includes('Rubric:') && first.text.includes('5 points'));
  check('Due label preserved',first.due==='Oct 30 at 11:59pm');
  check('No submitted draft, comments, or hidden text',!first.text.includes('SHOULD_NOT_APPEAR'));
  check('Resource names captured',first.links.some(l=>l.label==='Lab measurements.csv'));
  const dates=document.createElement('table');dates.className='assignment_dates';dates.innerHTML='<thead><tr><th>Due</th><th>For</th><th>Available from</th></tr></thead><tbody><tr><td>Oct 30 at 11:59pm</td><td>Everyone</td><td>Oct 1</td></tr><tr><td>Nov 1 at 11:59pm</td><td>Section B</td><td>Oct 1</td></tr></tbody>';document.body.append(dates);
  const differentiated=await extractPage();check('Multiple due dates preserve student groups',differentiated.due.includes('Everyone') && differentiated.due.includes('Section B') && !differentiated.due.includes('Oct 1'));
  document.querySelector('.description').remove();
  document.querySelector('#rubric_holder')?.remove();
  const modern=document.createElement('main');modern.id='content';
  modern.innerHTML='<h1>Lab 6: PCB review</h1><div class="user_content"><h2>Overview</h2><p>Continue the schematic and board layout. Submit an updated design plan and manufacturing review with all required deliverables.</p></div>';
  document.body.append(modern);
  check('Enhanced Canvas user content is readable',(await extractPage()).text.includes('updated design plan'));
  modern.querySelector('.user_content').className='enhanced-instructions';
  history.replaceState(null,'','/courses/10/assignments/30');
  check('Individual assignment fallback is readable',(await extractPage()).text.includes('manufacturing review'));
  history.replaceState(null,'','/courses/10/assignments');
  check('Course listing does not trigger broad fallback',!!(await extractPage()).error);
  modern.remove();check('No assignment body gives a helpful error',!!(await extractPage()).error);
}catch(error){results.push({name:error.message,passed:false});}
window.parent.postMessage({type:'stepwise-extraction-test',results},location.origin);

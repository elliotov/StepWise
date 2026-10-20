const output=document.querySelector('#results');
window.addEventListener('message',e=>{if(e.source!==document.querySelector('#fixture').contentWindow || e.data?.type!=='stepwise-extraction-test')return;output.textContent='';for(const item of e.data.results){const p=document.createElement('p');p.textContent=`${item.passed?'PASS':'FAIL'} · ${item.name}`;output.append(p);}});
document.querySelector('#fixture').src='canvas-fixture.html';

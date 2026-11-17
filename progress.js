export function loadingProgress({label='Reading assignment…',download=null,steps=0}={}){
  const safe=String(label).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const value=Number.isFinite(download)?Math.max(0,Math.min(100,download)):null;
  return `<section class="loading-progress" aria-live="polite"><div class="loading-caption"><span>${safe}</span>${value!==null?`<span>${value}%</span>`:steps?`<span>${steps} steps drafted</span>`:''}</div><progress class="loading-bar" aria-label="${safe}" max="100" ${value!==null?`value="${value}"`:''}></progress></section>`;
}

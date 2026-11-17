const escapeICS=value=>String(value||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
export function calendarFile(task,date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Enter a date as YYYY-MM-DD.');
  const start=new Date(date+'T00:00:00Z');if(!Number.isFinite(+start)||start.toISOString().slice(0,10)!==date)throw new Error('Enter a valid calendar date.');
  const end=new Date(+start+86400000),stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const guide=task.help?[task.help.overview,...task.help.steps.map((s,i)=>`${i+1}. ${s}`),task.help.answer,task.help.check].filter(Boolean).join('\n'):'';
  const description=[task.detail,guide,task.sourceUrl].filter(Boolean).join('\n\n');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Stepwise//Task Export//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${escapeICS(task.id)}@stepwise`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${date.replace(/-/g,'')}`,`DTEND;VALUE=DATE:${end.toISOString().slice(0,10).replace(/-/g,'')}`,`SUMMARY:${escapeICS(task.title)}`,`DESCRIPTION:${escapeICS(description)}`,'END:VEVENT','END:VCALENDAR'];
  return lines.map(line=>{const rows=[];let row='',size=0;for(const char of line){const bytes=new TextEncoder().encode(char).length;if(size+bytes>75){rows.push(row);row=' ';size=1;}row+=char;size+=bytes;}rows.push(row);return rows.join('\r\n');}).join('\r\n')+'\r\n';
}
export function downloadCalendar(task,date){const url=URL.createObjectURL(new Blob([calendarFile(task,date)],{type:'text/calendar;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='stepwise-task.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}

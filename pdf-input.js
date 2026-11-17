export const MAX_PDF_BYTES=12*1024*1024,MAX_PDF_PAGES=80,MAX_PDF_TEXT=40000;
let pdfLibrary;
export async function parsePdf(bytes,{name='Attachment.pdf',onProgress=()=>{},signal}={}){
  const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  if(data.byteLength>MAX_PDF_BYTES)throw new Error('This PDF exceeds 12 MB. Upload a smaller file or paste the relevant instructions.');
  if(!new TextDecoder('latin1').decode(data.slice(0,1024)).includes('%PDF-'))throw new Error('This is not a readable PDF. A Canvas sign-in page may have been returned. Download the PDF in Canvas and upload it here.');
  signal?.throwIfAborted();
  const pdf=pdfLibrary||=await import('./vendor/pdfjs/pdf.mjs');
  pdf.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.mjs',import.meta.url).href;
  const task=pdf.getDocument({data,isEvalSupported:false,useWasm:false,disableFontFace:true,useSystemFonts:true,cMapUrl:new URL('./vendor/pdfjs/cmaps/',import.meta.url).href,standardFontDataUrl:new URL('./vendor/pdfjs/standard_fonts/',import.meta.url).href,verbosity:0});
  const abort=()=>{void task.destroy();};signal?.addEventListener('abort',abort,{once:true});
  task.onPassword=()=>{void task.destroy();};
  try{
    const doc=await task.promise;signal?.throwIfAborted();
    if(doc.numPages>MAX_PDF_PAGES)throw new Error('This PDF has more than 80 pages. Upload the assignment pages only, or paste the relevant text.');
    const pages=[];let size=0,blank=0,truncated=false;
    for(let i=1;i<=doc.numPages;i++){
      signal?.throwIfAborted();const page=await doc.getPage(i);const content=await page.getTextContent();
      const text=content.items.filter(x=>'str' in x).map(x=>x.str+(x.hasEOL?'\n':' ')).join('').trim();
      if(text.length<10)blank++;pages.push(`Page ${i}:\n${text}`);size+=text.length;onProgress({page:i,total:doc.numPages});page.cleanup();
      if(size>MAX_PDF_TEXT){truncated=true;break;}
    }
    const text=pages.join('\n\n').slice(0,MAX_PDF_TEXT);
    if(size<30)throw new Error('No usable text was found. This may be a scanned PDF. OCR is not included; paste the instructions or upload a text-based PDF.');
    const warnings=['PDF text only: diagrams, handwriting, tables and math layout may be incomplete. Review the preview.'];
    if(blank)warnings.push(`${blank} page(s) had little or no readable text. Copy any missing requirements into Additional instructions.`);
    if(truncated)warnings.push('Only the first 40,000 text characters were extracted.');
    return {id:crypto.randomUUID(),name,text,include:true,pages:doc.numPages,truncated,warnings};
  }catch(e){signal?.throwIfAborted();if(/password|destroyed/i.test(e.message))throw new Error('This PDF is password protected or could not be opened. Upload an unlocked copy.');throw e;}
  finally{signal?.removeEventListener('abort',abort);await task.destroy();}
}
export async function readPdfResponse(response,{signal}={}){
  if(!response.ok)throw new Error(`PDF download failed (${response.status}). Download it from Canvas and upload the file instead.`);
  const length=Number(response.headers.get('content-length'));if(length>MAX_PDF_BYTES)throw new Error('This PDF exceeds 12 MB.');
  if(!response.body)throw new Error('The PDF download was empty.');
  const reader=response.body.getReader(),parts=[];let total=0;
  try{while(true){signal?.throwIfAborted();const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>MAX_PDF_BYTES)throw new Error('This PDF exceeds 12 MB.');parts.push(value);}}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  const bytes=new Uint8Array(total);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}return bytes;
}
export async function fetchPdf(url,pageUrl,{signal,fetcher=fetch}={}){
  const target=new URL(url);if(!['https:','http:'].includes(target.protocol)||target.username||target.password)throw new Error('Choose a regular HTTP or HTTPS PDF link.');
  // The API key is never used here. Canvas cookies are included only for the
  // original Canvas origin, never for an unrelated linked host.
  const sameOrigin=new URL(pageUrl).origin===target.origin;
  const response=await fetcher(target.href,{signal,credentials:sameOrigin?'include':'omit',redirect:'follow'});
  return readPdfResponse(response,{signal});
}

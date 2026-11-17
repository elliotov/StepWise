import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {parsePdf,fetchPdf,readPdfResponse,MAX_PDF_BYTES} from '../pdf-input.js';
// PDF text extraction does not use canvas. This supplies the DOMMatrix class
// referenced by PDF.js at module initialization in non-browser Node tests.
globalThis.DOMMatrix??=class DOMMatrix{};
const bytes=async name=>new Uint8Array(await readFile(new URL('./fixtures/'+name,import.meta.url)));
test('bundled PDF.js extracts real two-page fixture and warns about blank image page',async()=>{const progress=[];const pdf=await parsePdf(await bytes('assignment.pdf'),{name:'Lab.pdf',onProgress:p=>progress.push(p.page)});assert.equal(pdf.pages,2);assert.match(pdf.text,/two-page report/);assert.match(pdf.text,/uncertainty analysis/);assert.ok(pdf.warnings.some(s=>s.includes('little or no readable')));assert.deepEqual(progress,[1,2]);});
test('scanned-only PDF is rejected with a clear OCR limitation',async()=>{await assert.rejects(parsePdf(await bytes('scanned.pdf')),/scanned PDF/);});
test('password protected PDF returns an actionable error',async()=>{await assert.rejects(parsePdf(await bytes('locked.pdf')),/password protected/);});
test('PDF page limit is enforced on a real 81-page document',async()=>{await assert.rejects(parsePdf(await bytes('long.pdf')),/80 pages/);});
test('HTML returned from Canvas login is rejected as a non-PDF',async()=>{await assert.rejects(parsePdf(new TextEncoder().encode('<html>Sign in</html>')),/sign-in page/);});
test('file size is limited before parsing',async()=>{await assert.rejects(parsePdf(new Uint8Array(MAX_PDF_BYTES+1)),/12 MB/);});
test('download size limit is enforced even without content-length',async()=>{const response=new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(MAX_PDF_BYTES));c.enqueue(Uint8Array.of(1));c.close();}}));await assert.rejects(readPdfResponse(response),/12 MB/);});
test('cross-origin PDF request omits credentials and never uses API authorization',async()=>{await fetchPdf('https://files.example.edu/x.pdf','https://canvas.example.edu/assignments/1',{fetcher:async(url,options)=>{assert.equal(options.credentials,'omit');assert.equal(options.headers,undefined);return new Response('%PDF-test');}});});
test('same-origin Canvas PDF can use the logged-in browser session',async()=>{await fetchPdf('https://canvas.example.edu/files/1/download','https://canvas.example.edu/assignments/1',{fetcher:async(url,options)=>{assert.equal(options.credentials,'include');return new Response('%PDF-test');}});});
test('unsafe PDF URL cannot trigger a request',async()=>{await assert.rejects(fetchPdf('javascript:alert(1)','https://canvas.example.edu'),/HTTP or HTTPS/);});
test('PDF reading respects cancellation',async()=>{const c=new AbortController();c.abort();await assert.rejects(parsePdf(await bytes('assignment.pdf'),{signal:c.signal}),e=>e.name==='AbortError');});

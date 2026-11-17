STEPWISE API 1.4.1 — SIX FEEDBACK IMPROVEMENTS

UPDATE AND KEEP YOUR TASKS
Make a backup copy of your existing extension folder. Copy this folder's
contents into that SAME existing folder, then click Reload on its card at
chrome://extensions. Do not remove/reinstall or change the install folder
when updating: Chrome associates the unpacked extension with that path.
Existing tasks, edits, completion state, settings and saved API explanations
are preserved. Historical duplicates are not silently deleted; remove any
unwanted old copies manually. The local/API variants retain separate storage.

FIRST INSTALL
1. Extract the ZIP into a permanent location.
2. At chrome://extensions enable Developer mode.
3. Click Load unpacked and select stepwise-api-extension (contains manifest.json).
4. Open Stepwise from Chrome's Extensions menu and follow its setup checklist.
5. Open Settings and enter your own OpenAI API key, then Save settings.
6. Open a Canvas assignment. Grant site access when prompted, or use pasted
   instructions / an uploaded PDF instead. Open the panel's Plan a page tab.

THE SIX CHANGES
1. One checklist per assignment: reopening an assignment offers Open existing
   plan or Review updated plan. Generating again does not automatically append
   another checklist. Assignment identity ignores Canvas module query strings.
   A reviewed update re-reads current page instructions (unless you edited the
   page preview), shows saved tasks, and adds ONLY suggestions you select.
   Existing edited/completed/manual tasks are never replaced by that update.
2. Stable list rendering: keeps task/step DOM elements and scroll position;
   throttles streaming refreshes and removes repeated step-entry animations.
3. PDF instructions: upload a PDF, or Read page & find attachments > select a
   link > Load selected PDF. Grant access to that link if requested. Text is
   parsed locally with bundled PDF.js 5.6.205, then displayed in a preview.
   Review/correct the extracted text; uncheck Include to leave a file out.
   If Canvas returns a login page or blocks downloads, download the PDF using
   Canvas itself, then upload it in Stepwise.
4. Additional instructions: paste missing requirements, rubrics or context.
   Review/correct the page preview too. Sparse pages prompt for more content.
5. Optional detail: Automatic (default), Brief, Standard, Detailed, or Custom
   maximum of 3–30 steps. Short assignments can use fewer steps rather than
   adding filler. No per-step time limits or time estimates.
6. First-time setup checklist: installation, AI connection, site access and first
   plan. Hide it when ready; restore it from Settings at any time.

PDF AND INPUT LIMITS
Up to 3 PDFs for a page; each at most 12 MB, 80 pages and 40,000 extracted text
characters. Combined instructions must fit within 60,000 characters: shorten
previews or exclude files if the limit is exceeded. Long extracted sources
show warnings. Scanned/image-only PDFs need OCR, which is NOT included.
Password-protected PDFs need an unlocked copy. Diagrams, handwriting, tables
and mathematical layout may be missing or misread. Always review the text.
No PDF scripts, embedded attachments, external links or actions are executed.

INPUT STORAGE
Extra instructions and extracted PDF TEXT (not PDF file bytes) are retained for
up to five page URLs in Chrome session storage, so closing/reopening the panel
does not lose them. They normally clear after a browser restart. Clear extra
inputs removes them for the current page. Generated context is kept with saved
assignments for reference / help. Deleting an assignment removes its tasks and
saved context. Check source previews after a page changes.

API CONNECTION, HELP AND CALENDAR
Use your own OpenAI API key and a model your account supports (default:
gpt-4.1-mini; Responses and Structured Outputs). Usage may incur charges.
The key is session-only unless Remember on this device is selected. Remembered
keys are stored without encryption in this Chrome profile. No key is included.
Plans send the selected page/PDF/pasted text to OpenAI. Optional step help sends
the selected task, saved context and your question. Requests set store:false;
OpenAI API data policies still apply. Step help is OFF by default: enable it in
Settings, then click Help me complete this step and request an explanation.
Math help includes a worked calculation, answer and verification. Check it.
Saved-task help is kept with that task. Help requested only from a plan step
is shown in the dialog; request it from a saved task to keep it for export.
Export to calendar downloads an all-day .ics file for a date you choose.
Import that file into your calendar. There is no automatic account sync.
The export includes saved task help when available.

TESTING
npm test (Node.js 24+) runs unit/controller checks and actual PDF extraction
fixtures. It makes no live or billable AI calls. Renderer/controller checks use
DOM and Chrome doubles. See BROWSER-CHECKLIST.txt for on-device tests.
Chromium could not launch in the build environment due to OS socket restrictions;
browser appearance, scrolling, actual Canvas downloads and live AI requests are
not claimed as verified here. No Chrome Web Store publication is claimed.

THIRD PARTY
PDF.js 5.6.205 legacy build, Mozilla contributors, Apache-2.0.
License and packaged assets: vendor/pdfjs/. No OCR library is included.

1.4.1: API errors now show safe reason codes and request IDs. Confirmed output
limit failures retry once with more room; this may incur another API request.
No automatic retry for quota, authentication, refusals or unknown errors.

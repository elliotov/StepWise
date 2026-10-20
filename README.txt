STEPWISE 1.2.2 — CHROME BUILT-IN AI

INSTALL / UPDATE
1. Extract this ZIP and keep the stepwise-extension folder somewhere permanent.
2. Open chrome://extensions and turn on Developer mode.
3. For a first install, click Load unpacked and select stepwise-extension.
   For an existing install, replace its files in its ORIGINAL folder, then click
   Reload on the existing Stepwise card. Keeping that folder preserves tasks.
4. Open Stepwise Settings and click Enable local AI. Keep the tab open until ready.
5. Open a Canvas assignment, click Stepwise, then Break this into steps.
   Grant access to the site if asked. Add the resulting steps to your to-do list.

No API key, paid subscription, or Google/OpenAI login is required.
Chrome downloads Gemini Nano once, then runs planning locally. Internet is
required for that initial download and for loading Canvas pages.

REQUIREMENTS
Chrome 138+ on a supported desktop OS (Windows 10/11, macOS 13+, Linux,
or Chromebook Plus). At least 22 GB free on the Chrome profile drive.
Either strictly more than 4 GB GPU VRAM, OR 16 GB RAM and at least 4 CPU cores.
If free space falls below 10 GB Chrome may remove the model.
Managed school/work browser policies may disable local AI.
Use Settings > Check compatibility to inspect actual availability.

PRIVACY AND LIMITATIONS
Assignment text is processed on your computer; no assignment text is sent to
Google or OpenAI for planning. Tasks/settings remain in your Chrome profile.
Previously stored OpenAI keys are removed on extension install/update.
Stepwise reads visible assignment text only when requested. It cannot read
linked PDFs or embedded documents. Review plans against the assignment and
rubric: local AI can omit requirements or make mistakes. Stepwise does not complete or submit assignments.
The first generated step is a small starting action. You can edit
steps, add them individually or together, complete tasks, and revisit sources.

TROUBLESHOOTING
Unavailable: update Chrome, check storage/RAM/CPU/GPU and browser policies.
Download stuck: use an unmetered connection and keep Settings open.
Bad/incomplete plan: retry on a more focused assignment page and check assignment instructions.
Do not use Chrome Incognito for model setup.

Developer checks: npm test (mocked Chrome/AI APIs). Actual model download and
inference must be verified in desktop Chrome on a compatible device.
Official reference: https://developer.chrome.com/docs/ai/prompt-api

1.1.1: Adds enhanced Canvas assignment selectors and an individual-assignment
content fallback for layouts without the legacy description wrapper.

1.1.2: Constrains local AI output to the required JSON fields, normalizes
quoted integer estimates, and retries malformed plans once automatically.

1.1.3: On native AI errors or invalid output, retries in a fresh session
without constrained decoding. Both modes validate the full plan before saving.

1.2.0: Plan length is automatic. The AI chooses 3–12 steps from assignment
scope and deliverables; existing fixed-count preferences are ignored.

1.2.1: New plans show actions without time estimates or time limits.

1.2.2: If a scrolled Canvas assignment cannot be read, briefly scrolls to the
top and retries after rendering, then restores the original scroll position.

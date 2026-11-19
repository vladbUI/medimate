# MediMate MVP

A private, offline-first MedTech study companion. React + Vite + Tailwind CSS, Dexie IndexedDB, local PDF.js extraction, and an optional **disabled** server interface for paid AI. No account or paid service is required for local study.

## Run on your laptop

Install **Node.js 24 LTS** and open a terminal in this folder:

```sh
npm ci
npm run dev
```

Open the local address printed by Vite (normally http://127.0.0.1:5173).

For the production build with offline caching:

```sh
npm run build
npm run preview -- --port 4173 --strictPort
```

Open http://127.0.0.1:4173 and wait for **Offline ready** before disconnecting. The PWA caches the application, fonts, PDF worker, and PDF support files. Development mode does not install the offline worker. Keep the same browser, address, and port: each origin has its own separate local database. Export before changing origins. Service worker updates wait until existing tabs close; close all MediMate tabs and reopen to activate a newly installed version.

### Phone use

The interface adapts to phone screens. To use it on a phone, serve `dist/` from an HTTPS static host you control (or an HTTPS local network server). Install via the browser’s Add to Home Screen / Install menu where supported. A plain LAN HTTP address does **not** provide the secure context needed by the PWA and hashing. This project has not been deployed publicly. Hosting the static app does not upload your IndexedDB library. Phone and laptop libraries transfer through JSON backups; there is no cloud sync.

## Local workflow — ₱0 per month

1. Edit the placeholder name, encouragement, daily goal, and optional exam date in Settings.
2. Choose or add a subject in Transes; import a PDF under 50 MB / 3,000 pages.
3. Extraction processes pages sequentially with a worker. Each attempted page is immediately saved. Pause after the current page, navigate away, or close the tab; reopen the document and Resume to process remaining pages. Retry flagged pages explicitly.
4. Inspect coverage: **attempted**, **with text**, **flagged**, and **pending** are separate counts. No-text pages are flagged as possibly blank/image-only; the app does not pretend to distinguish them without OCR. Failed pages retain an error. Marking a page visually reviewed does not change its extraction status.
5. View the original PDF to check diagrams, tables, symbols, and reading order. Extraction success only means text was found, not that all visual content was captured.
6. Choose **Create source-recall drafts**. The local parser joins wrapped bullet lines, recognizes solid/hollow/hyphen bullets and explicit headings, and asks what the trans states under a source label. It does not turn every keyword into a definition. Generic labels without usable context are saved as flagged **Context needed** drafts with a placeholder topic (never a guessed one); a final bullet that appears to continue on the next page is flagged **Check page break**. Flagged drafts cannot be bulk-approved or practiced until corrected individually. A draft whose only topic is a procedure heading such as "Specimen Collection & Transport" or "Culture Media" is also flagged unless it names its organism, because the same heading can appear for several organisms in one lecture. Dangling lists and scrambled mathematical text are skipped. Image tables are not interpreted. This is literal source recall, not a medical language model or clinical fact checker.
7. Every card/question needs a source document, page, and verbatim supporting excerpt. Review/edit, compare against the original, then Verify & save. You can also use **Approve all drafts** in Review after checking the sources: one confirmation approves saved drafts across all subjects, skips invalid items, and preserves already verified items. Save or close an open editor first. Drafts cannot enter study sessions. Saving edits as a draft clears verification.
8. Choose Flashcards, Quizzes, or Moving exam. Convert a flashcard to a quiz question in Review if desired. Questions may be short-answer or multiple-choice (one choice per line, with the exact answer included).
9. Export regular backups. Backup includes original PDFs, pages, subjects, cards, schedules, personalization, and completed results. Import validates schema and references before a transaction. Merge preserves local ID conflicts; changed source pages require explicit full replacement. Replace asks for confirmation and clears incomplete quiz sessions.

Flashcards use a deliberately simple schedule: missed cards return in ten minutes; remembered cards use 1, 2, 4… days, capped at 365. Quiz typed answers must match the answer or one of the item's **accepted answers**, ignoring case, spacing, typographic quotes, and closing punctuation; nothing else is accepted. Edit accepted answers in Review (one per line), or choose **Accept my answer from now on** on a quiz result. Multiple-choice questions are graded against their choices only. Moving exams use absolute deadlines, advance automatically, and catch up elapsed stations after backgrounding/reload. There is no timer pause. Partial quiz/moving sessions are stored in this tab's session storage; closing the tab may discard them. Completed sessions are in IndexedDB. No specimen image station editor or OCR is included in this MVP.

Browser storage is private to the browser profile, not encrypted or protected by an app login. Anyone with access to the profile can read it. Browser data removal, private browsing, or storage eviction can remove the library. Request persistent storage in Settings and keep backups. Backups are unencrypted. Import only your own trusted backups: verification records represent the originating user's review, not independent validation.

## Optional paid AI architecture — at most ₱500/month reserved

Local mode never calls an AI provider. Settings can check a separately started gateway; no generation UI or provider adapter is activated in this MVP. This clean separation prevents accidental charges or upload of lecture text.

The included Node server provides:

- `GET /api/ai/status`: enabled flag and monthly reserved/remaining pesos.
- `POST /api/ai/generate`: bounded page text, explicit consent, unique request ID; returns only unverified, source-checked drafts.
- A server-only adapter boundary. Provider keys stay in environment variables; never in `VITE_*`, frontend files, backups, or browser settings.
- Loopback binding, Host/Origin checks, constant-time private token comparison, request limits, no CORS, and no-store responses.
- A persistent SQLite ledger (`server/data/budget.sqlite`) with atomic reservations. The maximum monthly limit is clamped by validation to ₱500; it can be lowered. The month follows Asia/Manila.
- Conservative pre-charge: the full upper-bound cost is retained on success, error, timeout, crash, or an uncertain provider outcome. Duplicate request IDs never initiate another paid call. No automatic paid retries or refunds.

To run the **disabled** gateway, copy `server/.env.example` to `server/.env`, set a random access token of at least 32 characters, and run:

```sh
node --env-file=server/.env server/index.js
```

Vite's development server proxies `/api` to localhost:8787. Enter only that private access token in Settings; it is kept in React memory until leaving Settings/reloading. It is **not** a provider API key. The production static preview does not provide an API proxy; configure a same-origin private HTTPS reverse proxy before connecting a production app to the gateway.

Before enabling paid generation, implement a reviewed local server module exporting:

```js
export default {
  async maxCostPhp(input) { /* return a strict all-in upper bound */ },
  async generate(input, { signal }) { /* return source-linked draft array */ }
};
```

Set `AI_ENABLED=true` and `MEDIMATE_ADAPTER=./private-provider-adapter.js` only after implementing and testing it. The adapter must enforce input/output token ceilings, fixed server-selected models, no internal retries, cancellation, and a conservative current PHP conversion including taxes/fees. **The budget guard bounds its ledger; an inaccurate adapter cost bound, other applications using the same provider key, or deleting the ledger can still cause external billing above the allowance.** Set a separate provider-side limit and dedicate a provider key/project where supported. No model prices or exchange rates are hardcoded.

Request contract:

```json
{
  "requestId": "a fresh UUID",
  "consent": true,
  "pages": [{"documentId":"local-id","page":1,"text":"Selected source text"}]
}
```

At most five pages / 12,000 characters per page; generated items must have `prompt`, `answer`, `documentId`, `page`, and exact `quote`. Citation mismatch or invalid output is rejected; reservations are retained. A future frontend should preview the exact outgoing pages and request consent before upload, then save returned items as drafts and require human verification. Do not expose this loopback server directly to the internet; deploy real authentication, TLS, rate limiting, and durable shared accounting first if remote multi-user use is later needed.

## Checks

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The browser test imports a synthetic two-page PDF, confirms the blank-page flag, creates and verifies a definition, practices a flashcard and quiz, tests timed auto-advance across reload, exports/imports a backup, and reloads offline. It captures desktop and 390px phone screenshots. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` optionally selects an already installed Chromium executable. Unit tests exercise source integrity, import atomicity/conflicts, scheduling, initialization, budget exhaustion/idempotency, and Manila month boundaries.

## Project map

- `src/App.jsx`: screens and study flows
- `src/db.js`: IndexedDB and transactional backup/import
- `src/model.js`: validation, coverage, drafting, review scheduling
- `src/pdf.js`: incremental PDF extraction and original file retention
- `server/`: private AI contract and durable allowance guard
- `tests/`: data, budget, and browser workflow tests
- `public/`: self-hosted PDF assets and app icon

Architecture references: [Dexie transactions](https://dexie.org/docs/Dexie/Dexie.transaction()), [PDF.js examples](https://mozilla.github.io/pdf.js/examples/), and [Vite guide](https://vite.dev/guide/).

### Rebuilding older keyword drafts
Older automatically generated items are excluded from practice even if previously approved. In Review, choose **Rebuild older drafts**. Complete source units are rewritten as unverified source-recall drafts. Ambiguous items are marked **Context needed** and must be individually edited to name their topic/organism; bulk approval skips them. Original questions and answers are retained under **Previous generated wording** and in backups. No facts are inferred from image tables. A new **Update MediMate** notice helps apply future offline-app updates after saving edits.


## Library and Review controls
Use Transes to rename subjects, remove empty subjects, rename or move PDFs, and remove a PDF with its related study items after confirmation. Past session results remain. Export a backup before removing content you may need later.

“Create drafts from all pages” processes saved page text and preserves existing items, including your edits. Pages without usable text still require manual questions. Previous/Next and Jump to page make longer lectures easier to navigate.

Review supports question/answer/PDF search plus subject and item-type filters. “Approve all drafts” applies to those filters; unresolved context/source issues are skipped. “Copy to quiz bank” creates one quiz copy per flashcard and preserves its review status. Unsaved study-item edits are protected when switching sections or leaving the page. On phones, use the section picker below the navigation to reach any page.

### Starting practice
Quizzes and Moving exam need one eligible verified item. If your bank contains verified flashcards, enable “Use verified flashcards too” to practice them directly. A quiz copy of the same flashcard takes precedence to avoid repetition. Empty setup screens show the relevant next step, including reviewing drafts or adding source material. The session preview shows the actual number of available questions/stations.

### Faster source review
Open Review / edit to compare the rendered original PDF page and extracted text beside your question. On smaller screens these stack. Verify & next advances after verification; Save draft & next saves without approval; Skip leaves the item unchanged and asks before discarding edits. The sequence follows the current filtered list.

Needs context only isolates ambiguous items. Repair incomplete drafts restores complete uniquely matching source bullets in unverified generated items, preserves previous wording, and never approves or deletes. Placeholder topics must be replaced before verification. Manually saved edits are excluded from subsequent repair.

### Accuracy update — 16 November 2026
- Parser: a sentence fragment at the top of a page is no longer used as a topic; nested bullets under a generic parent (e.g. "Morphology:") keep their named section or are flagged; bare page numbers are kept out of answers; possible page-break truncation is flagged with a note.
- Review: the excerpt is highlighted in the extracted text with a found/not-found status, the editor shows its position in the filtered list and takes focus when opened, and verified items whose excerpt no longer matches the source are listed as **Source changed** under Needs review.
- Data: `acceptedAnswers` and `reviewNote` are optional card fields. The IndexedDB schema version and backup format are unchanged; older backups import as before. Nothing is auto-approved or deleted.

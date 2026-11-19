# Verification — 7 November 2026

- Production build: passed; includes a service worker and offline assets.
- Unit/integration tests: **14 passed** across data/source integrity, transactional imports, review scheduling, initialization, budget caps, duplicate request IDs, Manila monthly rollover, authentication, origin rejection, and disabled AI behavior.
- Browser workflow: **passed** in Chromium, with desktop and 390px phone layout checks. Synthetic two-page PDF import, coverage/blank-page flagging, draft verification, flashcard practice, quiz grading, timed exam auto-completion after reload, personalization, JSON export/merge, and offline reload were exercised. No uncaught browser errors were recorded.
- Dependency audit: **0 known vulnerabilities** at the time of packaging. Build-only dependency overrides pin `deepmerge` to 4.1.1 and update `glob`/`minimatch` to avoid advisories in the upstream Workbox dependency tree. Reassess these overrides during dependency upgrades.
- Visual review: desktop and phone screenshots inspected; mobile callout layout and text spacing corrected.

Limits: no physical phone/device installation test, no large real-world medical PDF benchmark, no OCR, no specimen-image station editor, and no live paid provider integration. Medical correctness is not asserted. Node reports its built-in SQLite API as experimental; the budget tests pass on Node 24.12.0. Vite reports a large application bundle because PDF parsing is bundled; the production cache is approximately 5.5 MB plus original user PDFs. Production offline behavior was verified; development mode is not offline-cached.

## Approve all update
Bulk approval regression test passed (11 data tests total). Browser workflow now also verifies cancelling and confirming Approve all, its result count, and disabled empty state. Production rebuild passed.

## Keyword-transes correction
20 data/parser tests passed. Two browser workflows passed, including the actual seven-page user-provided PDF: complete wrapped morphology text, contextual prompt, and rejection of contextless demographic definition questions. Original PDF was processed only locally, not packaged. Legacy rewrites preserve prior wording and return to review; ambiguous legacy cards cannot be bulk-approved. Build passed.


## Experience update — 8 November 2026
- Added subject rename/removal (empty subjects only), PDF rename/move/removal, all-page draft generation, and previous/next/jump page controls.
- Added searchable, subject/type-filtered Review, scoped bulk approval, quiz-bank copying, empty results guidance, unsaved edit protection, and a phone section picker.
- Production build passed. 26 data/parser/management tests passed. Two Chromium workflows passed, including the actual seven-page lecture and synthetic PDF → review → flashcards → quiz → timed exam → backup → offline.
- New browser checks cover all-page generation without duplicates, PDF rename, page navigation, search reset, unsaved navigation cancellation, quiz copying, and mobile overflow. Desktop/phone library screenshots inspected.
- Refreshed the existing app and confirmed new review controls and revised contextual questions. Existing ambiguous cards remain in review.

## Practice setup UX — 8 November 2026
Quiz and moving-exam setup now explains empty banks and provides direct Review/Transes actions. The optional “Use verified flashcards too” setting practices eligible flashcards directly without copies; cards already represented by their quiz copy are excluded. Review shows readiness counts and practice shortcuts. Dashboard guidance recognizes existing drafts. Session size, timer validation, and phone input sizing are clearer.

Production build passed. Both Chromium workflows passed before final wording adjustment (including the actual lecture); final synthetic workflow passed after it. Added browser checks for empty-state navigation, direct verified flashcard quiz use, moving-exam availability, invalid seconds, and 390px overflow. Desktop/mobile setup screenshots inspected. Existing user library remained unapproved.

## UI refinement — 8 November 2026
Preserved the warm-paper/plum identity. Increased supporting text sizes and touch targets, grouped Review filters, emphasized edit actions, separated Delete, and made draft guidance collapsible. Mobile uses one sticky section selector instead of duplicate navigation. Phone filters use a two-column layout below the search. Production build and synthetic browser workflow passed, including phone/tablet overflow and mobile section switching. Inspected desktop/mobile Review and quiz screenshots in two bounded passes. Optional real-PDF test was not rerun for this styling-only change.

## Source review and draft repair — 8 November 2026
Added side-by-side source comparison with a PDF.js-rendered original page and extracted text, Verify & next, Save draft & next, Skip, and Needs context filtering. Repair incomplete drafts restores complete matching source bullets, preserves previous wording, and keeps ambiguous topics blocked from verification. Verified/manual/user-edited items are excluded from repair. Applied repair to existing user library: 16 restored; 15 still need context; no approval or deletion.

Build and 29 data/parser/repair tests passed. Chromium workflows cover the actual lecture, sequential review, source-preview rendering, desktop/mobile layout, and full practice/backup/offline flow. No OCR or inferred organism assignment was added. Some lecture headings are absent from extractable text, so those items still require source review.

## Accuracy and accepted answers — 16 November 2026
Production build passed. 52 unit tests passed (19 new: context flagging, page-break detection, stable draft IDs, grading with accepted answers, practice-bank gating, stale-source labelling, backup compatibility). The synthetic Chromium workflow passed with new checks for excerpt highlighting, accepted answers, rejection of an unrelated answer, and "Accept my answer from now on"; it ran against an already installed Chromium via `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. Desktop and 390px Review editor and quiz result screenshots inspected.

Not run: the optional real-lecture workflow (`MEDIMATE_SAMPLE_PDF` not set), so the parser changes were checked only against synthetic text. No physical phone test. The existing browser library was not opened or modified.

## Real-lecture card audit — 19 November 2026
Ran the app's extraction and draft generator over `BACTE LECTURE MIDTERMS.pdf` (7 pages, read locally only) and checked every card against the page text. Fixed: headings glued onto the previous answer ("ONPG-negative. Differentiating Moraxella catarrhalis", "…fold Morphology", "…grow. Biotyping Haemophilus…"); a wrapped label ("Gram Stain (Urethral Discharge from / Symptomatic Males):") losing its sub-bullets; lowercase continuation lines ("with:", "on a simple…panel:") becoming topics; sub-bullets under an unreadable parent (". vs. .") or vague table labels ("Prep", "Collect", "If delayed", "Time is tissue") shown without a topic; lecture questions with no answer (clinical vignette, "Satellite Phenomenon… Why?") turned into cards; Morphology/Temperature/Duration sections dropped; extraction gaps before punctuation in answers. Result: 103 cards, 50 flagged for context, 0 excerpt mismatches. Follow-up the same day, to hold for new PDFs rather than this lecture: a card whose only topic is a procedure heading (made only of words like specimen, collection, transport, culture, media, characteristics, detection, morphology, temperature, duration) is flagged unless the card names its organism (binomial or abbreviated, e.g. "Neisseria lactamica", "H. ducreyi"); the flagged question shows the heading so the reviewer only adds the organism. All 53 unflagged cards were read against the page text. "Repair incomplete drafts" now also refreshes untouched unverified drafts whose regenerated wording differs (previous wording kept); verified and edited items are never changed. 59 unit tests and both Chromium workflows (including the real-lecture one) passed; build passed.

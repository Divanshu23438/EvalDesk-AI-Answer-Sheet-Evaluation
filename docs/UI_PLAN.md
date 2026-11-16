# EvalDesk UI/UX Plan: One Screen, No Page Scroll

Keep this file in the repository as `docs/UI_PLAN.md`. It is an addendum to `docs/PLAN.md`. It is written for **any coding LLM or engineer**: read section 0 first, then follow the phases in order.

---

## 0. How to use this document

**Owner (teacher):** give this file and `docs/PLAN.md` to your coding agent. Tell it: "Follow docs/UI_PLAN.md. Start with Phase U0. Keep docs/STATUS.md up to date."

**Any LLM or engineer taking over:**

1. Read `docs/STATUS.md`, then this file, then section 3 (design rules) of `docs/PLAN.md`.
2. Run `python scripts/check_all.py` and `npm run check:ui` before and after every task.
3. A task is done only with proof in `docs/proof/ui/` (screenshot at 1366x768, API trace, or command output).
4. Commit per task: `U3.2: sidebar collapses to 56px`. Update `docs/STATUS.md` at the end of every session.

**Hand-over prompt:**

```
You are continuing the EvalDesk UI work. Read docs/PLAN.md, docs/UI_PLAN.md and docs/STATUS.md completely.
Work on the first unfinished UI task. Data comes only from the server: no sample text, no hard-coded IDs, no silent fallbacks.
The page must never scroll: only inner panels may. Test at 1366x768 and 1920x1080.
Run scripts/check_all.py and npm run check:ui before and after. Save proof in docs/proof/ui/. Update STATUS.md before you stop.
```

**UI debug prompt:**

```
Project: EvalDesk UI (React, Vite, FastAPI). Read docs/UI_PLAN.md section 11.
Screen: <upload | processing | evaluate | report>. Viewport: <WxH>.
Expected: <...>  Actual: <...>
Browser console and network errors (full text): <paste>
Output of: npm run check:ui  <paste>
Find the root cause and fix it. Prove the fix with a screenshot or command. Do not add sample data.
```

---

## 1. Goals and constraints

**Goal:** a teacher uploads sheets, watches real processing, reviews each answer with everything visible at once, marks the sheet as evaluated, and lands on the report.

**Flow:** `Upload -> Processing -> Evaluate -> Report`

**Hard constraints**

1. **No page scroll.** Everything for the current task fits one screen. Target 1366x768 minimum, works at 1920x1080.
2. **One question at a time** in the evaluation screen. This is what removes scrolling.
3. **Server is the source of truth.** No hard-coded questions, names, IDs or text. Initial state is empty.
4. **Real status only.** The processing animation follows real server stages, never a fake timer.
5. **Errors are visible.** Every failure shows the server message and a Retry. An animation never keeps spinning on failure.
6. **Teacher stays in control.** The AI suggests marks with reasons. The teacher approves.
7. Desktop and laptop only. No phone layout.

---

## 2. The app shell (locked to the viewport)

```css
html, body, #root { height: 100dvh; margin: 0; overflow: hidden; }
.app   { display: grid; grid-template-rows: 48px 1fr 56px; height: 100dvh; }
.panel { min-height: 0; overflow: auto; }   /* only inner panels may scroll */
```

- **Top bar (48px):** logo, paper title, stepper (`Upload > Processing > Evaluate > Report`), provider and quota chip.
- **Main area (1fr):** the current screen. Children use `min-height: 0` so grid items can shrink.
- **Bottom action bar (56px):** the primary action of the current step, always in the same place.
- **Error banner:** slides in under the top bar. It shows the server message and Retry, and never pushes the layout (overlay, not flow).
- **Routing:** one store value `step` (`upload | processing | evaluate | report`) plus `sheetId`, mirrored in the URL hash (`#/evaluate/<sheetId>`). Back and forward work. Reloading restores the screen from the server.

---

## 3. Screen 1: Upload

```
+------------------------------------------------------------+
| Top bar + stepper                                          |
+--------------------------+---------------------------------+
|  DROP ZONE (large)       |  QUEUE (this batch)             |
|  "Drop student sheets    |  sheet_01.pdf  ● Ready          |
|   or click to browse"    |  sheet_02.pdf  ◌ Reading name   |
|  PDF / JPG / multi-page  |  sheet_03.pdf  ⚠ Name needed    |
|                          |   └ [Name____][Roll___] [Save]  |
+--------------------------+---------------------------------+
| Paper: Locked ✓ 19 questions · 50 marks      [Start ▶]     |
+------------------------------------------------------------+
```

- **Drop zone:** drag-over turns the dashed border solid and scales the zone to 1.02. Click opens the file picker. Accepts PDF, JPG, PNG, several pages per sheet.
- **Grouping:** files dropped together become one sheet unless the teacher splits them ("Treat each file as a separate sheet" toggle).
- **Queue rows:** thumbnail, filename, page count, a real upload progress bar, then the server status chip.
- **`needs_identity`** appears **inline in the row** (name and roll fields, Save). It is not a modal. Saving calls `POST /api/sheets/{id}/identity`, which auto-queues evaluation.
- **Paper strip (bottom bar):** shows the locked paper title, question count and total marks from the server. If no paper is locked, the strip says so and links to paper setup.
- **Start:** enabled when at least one sheet is uploaded. Sheets that are confident start by themselves; Start only moves to the processing screen.
- **Errors:** a red row with the server message and Retry. Unsupported or oversized files are rejected with a clear reason before upload.
- **Empty state:** only the drop zone, with one line explaining accepted files.

---

## 4. Screen 2: Processing

Driven by real `GET /api/sheets/{id}` polling every 1 second. **No poll limit.** Stop polling only on `needs_review`, `evaluated`, `failed` or when leaving the screen.

```
+---------------------------------------------------------+
|  [current page thumbnail with scan-line sweep]          |
|                                                         |
|  ✔ Reading name → ● Reading pages (3/5) → ○ Matching    |
|  ○ Marking (0/19) → ○ Flagging                          |
|                                                         |
|  "Reading page 3 of 5…"                                 |
|  [Open first reviewed question]  (appears at 'marking') |
+---------------------------------------------------------+
```

- **Stages** come from the state machine: `reading_identity -> reading -> matching -> marking -> flagging`.
- **Counters** come from the server: `pages_read`, `pages_total`, `questions_marked`, `questions_total`.
- **Scan-line:** a CSS gradient sweep (1.6 s loop) over the thumbnail of the page currently being read. Reduced-motion users get a static highlight.
- **Multiple sheets:** a slim list on the left shows every sheet in the batch with its stage chip. Clicking one switches the main view. Sheets finishing one by one show a green tick.
- **`failed`:** animation stops, the failed stage turns red, `error_message` is shown with Retry (`POST /api/sheets/{id}/retry`).
- **`needs_identity`:** the screen shows the name and roll fields in place of the animation.
- **Quota wait:** "Quota reached, continuing at 14:30" with a live countdown, from the server's `retry_at` value.
- **Auto-advance** to Evaluate on `needs_review` or `evaluated`. If several sheets are processing, advance only for the sheet in view.

---

## 5. Screen 3: Evaluation workspace (the main screen)

```
+----------------------------------------------------------------------+
| Top bar: Rahul S. · Roll 44 · 38.5/50 · 3 flagged                    |
+--------+-----------------------------+-------------------------------+
| ◀      |  SHEET VIEWER (fixed)       |  Q 4 (A)(ii)  · 5 marks   ⚑   |
| PAPER  |  +-----------------------+  |  ----------------------------|
| SIDE-  |  | page image            |  |  1 OCR DETECTED               |
| BAR    |  |  +-------------+      |  |  "Process is a program in…"   |
|        |  |  | highlighted |      |  |  legibility 0.82 [Edit]       |
| Q1 ✓   |  |  | answer box  |      |  |  ----------------------------|
| Q2 ✓   |  |  +-------------+      |  |  2 REFERENCE  [Teacher key|AI]|
| Q3 ⚑   |  +-----------------------+  |  Model answer + key points    |
| Q4 ●   |  ‹ Page 2/5 ›   + - fit      |  ----------------------------|
| Q5     |                             |  3 MARKS  [-] 3.5 [+] /5      |
| …      |                             |  ✔ point 1 · ✔ point 2 · ✘ 3  |
|        |                             |  Flags: ⚠ low legibility      |
|        |                             |  [Recheck]  [Approve ✓]       |
+--------+-----------------------------+-------------------------------+
| ‹ Prev   Q 4/19  ━━━━━━━○───── 12 checked · 3 flagged   Next ›      |
|                            [ Evaluated → Report ]                    |
+----------------------------------------------------------------------+
```

### 5.1 Layout

```css
.evaluate { display: grid; grid-template-columns: var(--side, 280px) 1fr 420px; min-height: 0; transition: grid-template-columns 200ms; }
.evaluate.collapsed { --side: 56px; }
```

At widths below 1500 px the right column is 380 px. The viewer takes the rest.

### 5.2 Left: collapsible question paper sidebar

- Toggle button and the `[` key collapse it to 56 px. Collapsed it shows only question number pills with status colour and icon.
- Expanded: one row per question with number, one-line text (ellipsis), marks and a status icon (`✓` approved, `⚑` flagged, `●` current, `○` pending, `✕` failed).
- Filter chips at the top: `All | Flagged | Pending | Failed`.
- The current question is always scrolled into view inside the sidebar.
- Clicking a question loads it in the other two panels and jumps the viewer to the answer's page and box.
- Hover (or focus) shows the full question text, Hindi and English together, with the options for MCQ.
- Collapse state is remembered per browser (UI preference only, not data).

### 5.3 Centre: fixed sheet viewer

- The background never moves. Pan and zoom happen only inside the viewer.
- On question change it jumps to the page and draws the highlight rectangle from `bbox` (normalised x0,y0,x1,y1, scaled to the rendered image).
- Controls: previous and next page, zoom in and out, fit-to-width (default), fit-to-height. Mouse wheel with Ctrl zooms; drag pans.
- Bottom strip of page thumbnails. The current page is outlined.
- If an answer continues onto another page, a chip says "continues on p.3" and jumps there.
- If the answer was not found (`not_attempted` or no box), the viewer stays on the best-guess page and shows "No answer found for this question" over the page, not a fake box.
- Image load failure shows the error and a Reload button.

### 5.4 Right: three cards for the current question

Height share about 35 / 30 / 35 %. Each card scrolls internally if its text is long.

**Card 1: OCR detected**

- The text exactly as read, editable (`E` key or Edit button). Saving an edit calls the review endpoint and offers Recheck.
- Legibility badge (green above 0.8, amber 0.5 to 0.8, red below 0.5).
- When two readers disagree, show both reads side by side with the differing words highlighted and a "Use this" button on each.
- Evidence quotes from the key-point verdicts are highlighted inside this text.

**Card 2: Reference**

- A badge: `Teacher key` or `AI reference (not a teacher key)`.
- When the source is `ai_draft`, a yellow note: "Generated by AI, verify before relying on it".
- Shows the model answer and key points with their marks. For MCQ it shows the options with the correct one marked.
- Strictness and basis for this question (paper-wide or override) shown as a small chip.
- Teachers can open "Edit reference" (a side sheet, not a new page) to fix it. Editing marks the evaluation as stale and shows "Recheck needed".

**Card 3: Marks and evidence**

- Marks stepper in 0.5 steps, capped between 0 and the question's maximum. Shows `AI suggested 3.5` next to the teacher's value once changed.
- Key-point list with verdict icons (full, partial, none) and the matching quote.
- Flags in plain words: readers disagree, low legibility, answer not found, judges disagree, quote not found, missing reference, call failed.
- Buttons: `Recheck` (real AI call, shows a skeleton while running), `Approve`.
- A `failed` question shows the real error, no marks, and Retry. Approve is disabled until it is retried or the teacher types marks manually (then it is labelled "manual").

### 5.5 Bottom bar

- Prev and Next, a progress bar (segmented by status colour), counters `checked / flagged / failed`.
- **`Evaluated -> Report` button**
  - Disabled while any question is `failed` or flagged and not approved. The label reads "3 flagged left"; clicking it jumps to the next one.
  - Enabled when every question is approved. It calls `POST /api/papers/{id}/reports/generate` for this sheet, then moves to the Report screen.
  - **"Approve all unflagged"** is a secondary button with a confirm popover that shows the count.

### 5.6 Keyboard shortcuts

| Key | Action |
| --- | --- |
| `→` / `←` | Next / previous question |
| `A` | Approve current question |
| `F` | Jump to next flagged question |
| `+` / `-` | Marks +0.5 / -0.5 |
| `R` | Recheck |
| `E` | Edit OCR text |
| `[` | Toggle sidebar |
| `?` | Show the shortcut list |

Shortcuts are disabled while a text field is focused. A small hint row in the bottom bar shows the three most useful keys.

---

## 6. Screen 4: Report

```
+------------------------------------------------------------+
| Tabs: [ Student report card ] [ Paper report ]             |
+--------------------------+---------------------------------+
| Score 38.5/50 · Grade B+ | Marks per question (bar chart)  |
| Strengths / Improve (T7) | Class distribution · avg per Q  |
+--------------------------+---------------------------------+
| ‹ Back to review   [Next sheet ▶]   [PDF] [Excel]          |
+------------------------------------------------------------+
```

- Two-column grid. Long tables sit in an internal scroll area. The page does not scroll.
- **Student tab:** total, grade, per-question marks, strengths and areas to improve (T7), flagged count, how many marks the teacher changed.
- **Paper tab:** score distribution, average per question, most-missed key points, flag rate, teacher change rate, paper improvement suggestions. Shows "Based on N sheets".
- **Downloads:** PDF (report card or paper report) and Excel (paper report). Files come from the server; numbers must equal the database.
- **Next sheet:** returns to the queue and opens the next sheet that is not yet evaluated.
- **Back to review:** keeps all edits. If the teacher changes marks after generating, the report is marked stale and offers Regenerate.
- **Empty state:** with only one sheet, the Paper tab says "Add more sheets to see class statistics".

---

## 7. Visual and motion system

- **Palette:** neutral grey surfaces and one accent (indigo). Status: green approved, amber flagged, red failed, grey pending. Never colour alone: every status has an icon and a label for screen readers.
- **Tokens:** define colours, spacing (4 px scale), radius and shadows as CSS variables on `:root`, with a dark theme under `prefers-color-scheme: dark`.
- **Type:** 14 px base, 13 px in dense lists. Noto Sans and Noto Sans Devanagari so Hindi renders correctly.
- **Motion (150 to 250 ms):** sidebar collapse, question cross-fade, processing scan-line, check-mark pop on approve. Respect `prefers-reduced-motion`.
- **Loading:** skeletons in the three right cards and the viewer. No full-screen spinners.
- **Empty and error states** designed for every panel: no questions detected, OCR empty, failed call, quota reached, image failed to load, no sheets yet.
- **Accessibility:** visible focus rings, all controls reachable by keyboard, `aria-live` for status changes, contrast of at least 4.5:1.

---

## 8. Front-end structure

```
src/
  app/Shell.tsx                  # locked grid, stepper, error banner, hash routing
  screens/UploadScreen.tsx
  screens/ProcessingScreen.tsx
  screens/EvaluateScreen.tsx
  screens/ReportScreen.tsx
  components/QuestionSidebar.tsx
  components/SheetViewer.tsx     # image, bbox overlay, zoom and pan
  components/OcrCard.tsx
  components/ReferenceCard.tsx
  components/MarksCard.tsx
  components/ActionBar.tsx
  components/ErrorBanner.tsx
  components/StatusChip.tsx
  components/QueueRow.tsx
  state/useSheetStore.ts         # server IDs only, no hard-coded data
  api/client.ts                  # typed fetch; throws on non-2xx, never swallows errors
  hooks/usePolling.ts            # 1 s polling, no cutoff, stops on terminal states
  hooks/useHotkeys.ts
```

Rules: no `catch {}` without surfacing the error; no default state with names, IDs or questions; legacy screens stay in `legacy/` until deleted.

---

## 9. Backend contract needed by the UI

The recovery plan's API covers most of this. These are the **additions** the UI needs. Add them in Phase U0 before building screens.

| Endpoint | Returns or does |
| --- | --- |
| `GET /api/papers/{id}/sheets` | List of sheets: `id`, `filename`, `student_name`, `roll`, `status`, `stage`, `page_count`, `flags_open`, `updated_at`. Feeds the upload queue and "Next sheet" |
| `GET /api/sheets/{id}` | Add `pages_read`, `pages_total`, `questions_marked`, `questions_total`, `failed_stage`, `error_message`, `retry_at` (quota), `history[{stage, at}]` |
| `GET /api/sheets/{id}/pages/{n}/image` | Page image (JPEG, max 2000 px) with correct content type and cache headers |
| `GET /api/sheets/{id}/review` | Per question: `key`, `q_no`, `text`, `options`, `max_marks`, `status`, `ocr_text`, `reader_texts[]`, `legibility`, `page_numbers[]`, `bbox`, `continues`, `reference{source, model_answer, key_points[], correct_option}`, `ai_marks`, `final_marks`, `key_point_verdicts[{text, verdict, quote, reason}]`, `flags[{code, message}]`, `error_message` |
| `POST /api/evaluations/{id}/review` | Save OCR edit, marks override, approve. Returns the updated evaluation and sheet totals |
| `POST /api/sheets/{id}/approve-unflagged` | Approves every unflagged question, returns the count |
| `POST /api/evaluations/{id}/recheck` | Real AI call, returns the new evaluation or a typed error |
| `POST /api/sheets/{id}/finish` | Validates no failed or unapproved flagged question remain, sets status `evaluated`, returns report links |
| `GET /api/sheets/{id}/report` | Student report data (marks, grade, T7 text) |
| `GET /api/papers/{id}/reports` | Paper report data and file links |

All errors return `{code, message, retry_at?}` with a proper HTTP status so the error banner can show them.

---

## 10. Phases (do in order; each has proof)

### Phase U0: Foundation

1. Add the shell grid, tokens, fonts, stepper, hash routing and the `ErrorBanner`. Remove any page-level scroll.
2. Add `api/client.ts` and `usePolling`. Add the backend additions from section 9 (stubs are not allowed: they must read the database).
3. Add `npm run check:ui`: runs `tsc`, a Playwright script that opens each screen at 1366x768 and 1920x1080 and asserts `scrollHeight <= innerHeight`, and the banned-text scan from `check_all.py`.

**Done when:** the empty shell renders with no scroll at both sizes and `check:ui` passes. Proof: command output and two screenshots.

### Phase U1: Upload screen

1. Drop zone with drag states, multi-file, validation and real upload progress.
2. Queue from `GET /api/papers/{id}/sheets` with live status chips and inline `needs_identity` form.
3. Paper strip and Start button from server data. Error rows with Retry.

**Done when:** one sheet with a readable name proceeds on its own, one without a name shows the inline form and proceeds after Save, and a bad file shows a clear error. Proof: screenshots and the network trace with timestamps.

### Phase U2: Processing screen

1. Stage tracker, counters and scan-line from real polling.
2. Multi-sheet list, `failed` state with Retry, quota countdown, auto-advance.

**Done when:** a real run shows every stage in order from the server; with the network stopped the screen shows a red failed stage and the message, not marks. Proof: screen recording or screenshots per stage and the `history` array.

### Phase U3: Evaluation workspace

1. Layout with collapsible sidebar and fixed viewer.
2. Viewer: page images, bbox highlight, zoom and pan, thumbnails, continues chip.
3. The three cards with real data, skeletons and all empty and error states.
4. Marks stepper, approve, recheck, edit OCR, edit reference, flags in plain words.
5. Bottom bar, progress, `Approve all unflagged`, `Evaluated -> Report` gating.
6. Keyboard shortcuts and the help overlay.

**Done when:** for any question, OCR text, reference (with its badge) and marks are visible together without page scroll at 1366x768; selecting a question jumps to the right page and box; edits persist after reload. Proof: screenshots at both sizes, API traces for save and recheck.

### Phase U4: Report screen

1. Student and paper tabs from the server, charts, downloads.
2. Next sheet, back to review, stale report handling.

**Done when:** every number on screen and in the PDF and Excel files equals the database. Proof: a small script comparing the file values with the database rows.

### Phase U5: Polish and hardening

1. Motion pass, reduced-motion, focus order, contrast check.
2. Hindi text rendering check (Devanagari in the sidebar, tooltip, OCR card and PDF).
3. Slow network and large file behaviour (skeletons, timeouts, retry).
4. Remove `legacy/` screens that the new flow replaces.
5. Rehearse the demo on the real paper and 2 to 3 sheets.

**Done when:** the acceptance checklist in section 12 passes twice, with two different papers. Proof: checklist with a proof link for each line.

---

## 11. Debugging playbook (UI)

| Symptom | Likely cause | Confirm | Fix |
| --- | --- | --- | --- |
| Page scrolls | A child lacks `min-height: 0`, or content uses `100vh` | `check:ui` height assertion; find the element with `scrollHeight > clientHeight` | Add `min-height: 0` to grid children, use `100dvh`, move scroll into the panel |
| Sidebar collapse makes the viewer jump | Viewer re-fits on every resize | Watch resize events | Keep zoom and pan in state; re-fit only on question change or the Fit button |
| Highlight box is in the wrong place | `bbox` scaled to the wrong size, or the image was resized | Log image natural size against rendered size | Scale normalised box by rendered size; compute after the image loads and on resize |
| Hindi text shows boxes | Devanagari font missing | Inspect computed font | Load Noto Sans Devanagari and add it to the font stack |
| Processing screen stops updating | Polling cutoff or an unhandled exception | Network tab shows no more requests | Poll until a terminal state; surface errors in the banner |
| Old data appears | Hard-coded IDs or stale store | Search for UUID literals; clear storage | Store only server IDs; reset store on new paper |
| `Evaluated` stays disabled | A failed or flagged question is unresolved | Check `/review` flags and statuses | Resolve them, or Approve all unflagged and handle the rest |
| Recheck spins forever | No timeout, or error swallowed | Network tab | 90 s timeout, show the typed error and Retry |
| Keys fire while typing | Hotkeys not disabled in inputs | Type in the OCR field | Ignore hotkeys when focus is in input, textarea or contenteditable |
| Image blurry or slow | Full-resolution image sent | Response size | Serve JPEG up to 2000 px; thumbnails at 200 px |

If the cause is not in this table: reproduce with the smallest case, capture the console and network text, write the root cause in `docs/DECISIONS.md`, then change code.

---

## 12. Acceptance checklist

Run with two different papers.

1. At 1366x768 and 1920x1080, `document.scrollingElement.scrollHeight <= innerHeight` on all four screens.
2. The app starts empty. No sample text anywhere (`check_all.py` banned list passes).
3. Upload accepts multi-page files; a bad file shows a clear error.
4. A sheet with a readable name starts by itself; a sheet without a name shows the inline form and starts after Save.
5. The processing screen shows real stages and counters; a failure turns red with the real message and Retry.
6. The sidebar collapses and expands without a layout jump, and the viewer keeps its position.
7. OCR text, reference (with the Teacher key or AI badge) and marks are visible together for any question.
8. Selecting a question jumps to the correct page and highlights the box.
9. Edits, approvals and overrides persist after reload.
10. A failed question never shows marks; Recheck makes a real call.
11. `Evaluated -> Report` is blocked while flagged or failed questions remain, and the whole review works with the keyboard only.
12. Report numbers equal the database; PDF and Excel download.
13. Hindi text renders correctly in every panel.
14. Reload at any step restores the same screen from the server.

---

## 13. Demo additions

Extend the demo order in `docs/PLAN.md` section 11:

1. Show the empty upload screen, drop two sheets, and point at the live queue.
2. Let the processing animation run on a real sheet and show a real stage counter.
3. Open the evaluation workspace: collapse the sidebar, click a flagged question, show OCR, reference and marks together.
4. Change marks with the keyboard, approve, press `F` to jump to the next flagged one.
5. Press `Evaluated`, show the report card and the paper report downloads.

Do not claim an accuracy percentage. Say: the AI suggests, the teacher decides.

---

## 14. STATUS.md additions

```
UI phase and task:
Screens done (upload | processing | evaluate | report):
Last check:ui result and viewport sizes tested:
Proof files in docs/proof/ui/:
Open UI issues (exact error text):
```

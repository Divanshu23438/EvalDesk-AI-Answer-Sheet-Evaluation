# EvalDesk: Upgrade Plan 2 (upload UX, live OCR progress, evaluation workspace, 1-5 strictness)

Save as `docs/PLAN_UPGRADE.md`. It **extends** `docs/PLAN.md` (same rules, same proof discipline). Everything below was traced from the real `main.py` and `MarksCard.tsx`; line numbers refer to the `main.py` you shared.
Source of truth for strictness behaviour: `docs/STRICTNESS_SPEC.md` (the uploaded `grading_strictness_scale_subject_calibration_specification.md`). Copy it into `docs/`.

---

## 0. How to use this document

**Owner:** give this file to your coding agent. Say: "Follow docs/PLAN_UPGRADE.md. Start with P9.0. Keep docs/STATUS.md current."

**Any agent taking over:**
1. Read `docs/STATUS.md`, then sections 1 (findings) and 2 (decisions) here.
2. Run `python scripts/check_all.py` before and after every task. Paste its output.
3. No task is done without proof in `docs/proof/P9.x/` (command output, API JSON, screenshot).
4. Commit per task: `P9.3: recheck uses shared grader`. Update STATUS.md before stopping.
5. Rules from PLAN.md section 3 still apply: no sample data, no silent fallbacks, marks decided by code, student text is data.

**Hand-over prompt:**
```
Continue EvalDesk. Read docs/PLAN.md, docs/PLAN_UPGRADE.md, docs/STRICTNESS_SPEC.md and docs/STATUS.md fully first.
Work on the first unfinished task in STATUS.md. Real data paths only. Run scripts/check_all.py before and after.
Save proof in docs/proof/. If a command fails, report the exact error text. Update STATUS.md before you stop.
```

**Already delivered (apply first, see P9.0):** `UploadScreen.diff` and `components/{PaperDetailsForm,StrictnessPicker,IdentityForm,PageFlipStrip}.tsx`. They are written against the contracts in section 4. The backend does not satisfy those contracts yet; that is what P9.1 to P9.4 fix.

---

## 1. Audit of the current code (evidence)

| # | Finding | Evidence | Impact |
|---|---|---|---|
| A1 | **Strictness is stored but never used in grading.** The text values `lenient/...` are saved on papers and questions only. The pipeline never reads `paper["strictness"]` or `q["strictness_override"]`. | fields at 206, 213, 257, 263; grading 2515-2775 | The 1-5 scale would do nothing unless the engine is built |
| A2 | `strictness_override` is `Optional[str]`, the UI sends an integer. | 206, 257 | HTTP 422 on `PUT /questions` |
| A3 | No light paper update. `PUT /api/papers/{id}` needs `title` **and** the full `questions` list. | 2045-2074, `PaperSetupUpdate` 260 | Cannot save one field (subject, code, strictness) |
| A4 | No `subject_code` / `exam_name` anywhere; the extractor returns only `paper_title`. | `ExtractPaperResponse` 183, prompt 514 | Header fields can never be "detected" |
| A5 | **Per-page OCR progress does not exist.** Pages are read with `asyncio.gather`; nothing is saved per page. | 2408-2477 | The flip animation has nothing real to show |
| A6 | **Progress numbers are faked.** `pages_read = pages_total // 2` while "reading"; list endpoint says `1`. The pipeline sets `status='evaluating'` (2339), never `'reading'`, so these branches never match and `pages_read` stays 0 during reading. | 2917-2924, 3808, 2339 | Status screen cannot be trusted |
| A7 | **Rubric verdicts in the review payload are invented**: `"met" if ai_marks > 0 else "unmet"` for every point, the same quote copied to every point. Real per-point verdicts are computed (2629-2668) but **never stored** (insert 2828-2845). | 3180-3189 | Violates "no invented marks/evidence"; teacher sees false reasons |
| A8 | MarksCard expects `{point, verdict: full/partial/none, quote}`; backend sends `{text, verdict: met/unmet}`. Card status only gets `approved/flagged/pending`, never `failed`. | MarksCard props; 3189, 3205 | Verdict badges render wrongly |
| A9 | **Recheck is a different, weaker grader**: prompt has no rubric or key points, no quote verification, `float(data.get("awarded_marks", 0.0))` defaults to 0, sets `resolved=1` and **clears all flags**, overwrites `final_marks` (teacher override lost). No strictness input. | 3388-3472 | The "Recheck" button can silently approve a bad mark |
| A10 | **Totals change after any review.** Pipeline uses `calculate_section_choice_totals` (attempt-any-N rules); review and recheck use plain `SUM(final_marks)`. Grade thresholds are duplicated. | 2794 vs 3341, 3448, 3348 | Total jumps after the first edit on papers with choice sections |
| A11 | Flags are free strings; the review turns each into `code:"flag"`. No stable codes, so the UI cannot style, filter or explain them. | 2538-2541, 2714, 3200 | Weak "why flagged" |
| A12 | Silent defaults hide missing data: `legibility` default `0.95`, `or 1.0` fallbacks. | 2492, 2406, 2528 | Unreadable answers look clean |
| A13 | Fallback matching on printed `q_no` is silent. | 2481-2485 | Wrong-question risk, unflagged |
| A14 | Retry/re-run **deletes all evaluations** (incl. teacher edits). | 2806-2807, 3042 | Retry destroys review work |
| A15 | Identity route needs name **and** roll; upload auto-queues only if both present and confidence >= 0.70. | 2260, 2199 | UI must require both (patched) |
| A16 | No global concurrency cap: every upload and every resumed job starts its own pipeline. | 78-95, 2226, 2280 | Free-tier 429 storms |

Already good (reuse, do not rebuild): `GET /api/sheets/{id}/review` already returns `crop_url`, `bbox`, `page_numbers`, `reader_texts`, `sheet_pages[].url`, `paper_pages`, `reference`; `GET /api/sheets/{id}/pages/{n}/image`; typed `AIError`; quote verification (`verify_evidence_quote`); MCQ exact match; `failed_stage/error_message` on sheets.

---

## 2. Decisions (locked unless the owner changes them)

1. **Scale:** integer 1-5, default 3. Effective level for a question = `question override` if set, else `paper level`. Saved as `evaluations.strictness_used`.
2. **API names:** paper `strictness_level` (int), question `strictness_override` (int or null), `subject_domain` (`general|cs_it|math_quant|science_bio_chem|humanities_law|languages`). The old text `strictness` is accepted for compatibility and mapped (`lenient`=1, `balanced`/`standard`=3, `strict`=5); never written again.
3. **DB:** new columns (section 3). The old text columns stay untouched until P9.8 cleanup. Question override column is `strictness_level_override INTEGER`; the API field stays `strictness_override`.
4. **Teacher key is per question**, from `reference.source == 'teacher_key'`, not the paper flag (a key may cover only some questions).
5. **Metadata and strictness stay editable after lock** (only questions/references freeze). Existing evaluations keep their `strictness_used`.
6. **Recheck replaces the AI result and the final mark** (explicit teacher action), recomputes flags honestly, returns `previous_final_marks` so the UI can offer Undo.
7. **Owner decision, default given:** partial-credit factor per level (proposed, spec gives no numbers): `{1:0.75, 2:0.65, 3:0.50, 4:0.40, 5:0.25}` of a key point's marks. Keep as one config dict `PARTIAL_FACTOR` so it can be changed in one place.

---

## 3. Data model (idempotent migration run at startup, one helper `add_column_if_missing`)

```sql
-- papers
ALTER TABLE papers ADD COLUMN subject_code TEXT NOT NULL DEFAULT '';
ALTER TABLE papers ADD COLUMN exam_name TEXT NOT NULL DEFAULT '';
ALTER TABLE papers ADD COLUMN strictness_level INTEGER NOT NULL DEFAULT 3;   -- CHECK 1..5 in code
ALTER TABLE papers ADD COLUMN subject_domain TEXT NOT NULL DEFAULT 'general';
-- questions
ALTER TABLE questions ADD COLUMN strictness_level_override INTEGER;          -- NULL = inherit paper
-- sheets
ALTER TABLE sheets ADD COLUMN stage_key TEXT;      -- reading_identity|reading|matching|marking|flagging
-- sheet_pages (real per-page OCR progress)
ALTER TABLE sheet_pages ADD COLUMN ocr_status TEXT NOT NULL DEFAULT 'pending'; -- pending|reading|done|failed
ALTER TABLE sheet_pages ADD COLUMN ocr_error TEXT;
ALTER TABLE sheet_pages ADD COLUMN ocr_legibility REAL;
-- evaluations
ALTER TABLE evaluations ADD COLUMN strictness_used INTEGER;
ALTER TABLE evaluations ADD COLUMN verdicts_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE evaluations ADD COLUMN confidence REAL;
ALTER TABLE evaluations ADD COLUMN status TEXT NOT NULL DEFAULT 'ok';          -- ok|failed|not_attempted
```
One-time backfill: papers `strictness_level` from old text; questions `strictness_level_override` from old text override (`NULL`/empty stays NULL). Enable WAL, short transactions (per PLAN.md section 8).

---

## 4. Contracts (what UI and backend must agree on)

**Paper**
- `PATCH /api/papers/{id}` body: any of `title, subject, subject_code, exam_name, strictness_level (1-5), subject_domain`. Validates ranges and domain list. Allowed when locked. Returns the updated paper.
- `GET /api/papers/{id}` and the list return the new fields.
- `POST /api/papers`, `/extract`, `/upload` accept the new fields; extractor T1 additionally returns `subject`, `subject_code`, `exam_name` from the printed header (empty string if not printed). The UI shows empty ones as "not detected".
- `PUT /api/papers/{id}/questions` accepts `strictness_override: int | null` (validated 1-5).

**Sheet list and status** (`GET /api/papers/{id}/sheets`, `GET /api/sheets/{id}`)
```json
{ "id":"...", "status":"evaluating", "stage_key":"reading", "stage":"Reading pages",
  "pages_total":5, "pages_read":2,
  "pages":[{"n":1,"status":"done","image_url":"/api/sheets/{id}/pages/1/image","legibility":0.91},
           {"n":2,"status":"reading"}, {"n":3,"status":"pending"}] }
```
`pages_read` = count of `ocr_status='done'`. Remove the `// 2` and `1` guesses.

**Review** (`GET /api/sheets/{id}/review`), per evaluation add:
`strictness_used`, `strictness_effective`, `strictness_source ("question"|"paper")`, `confidence`, `status ("ok"|"failed"|"not_attempted")`, `reference.source`, and **real** `verdicts`:
```json
"verdicts":[{"index":1,"text":"<key point>","marks_available":1.0,"marks_awarded":0.5,
             "verdict":"partial","quote":"<verified substring or empty>","reason":"<short>"}]
```
Top level: `paper.strictness_level`, `paper.subject_domain`. Delete the fabricated `key_point_verdicts` block.
`flags` become `[{"code","message","severity"}]`. Stable codes: `low_legibility, suspicious_text, not_attempted, missing_reference, quote_not_found, judge_disagreement, call_failed, call_timeout, quota_exceeded, low_confidence, no_teacher_key_keyword, command_syntax, matched_by_q_no`. Old string flags are converted on read for existing rows.

**Recheck** `POST /api/evaluations/{id}/recheck` body `{edited_text?, strictness?: 1-5|null, persist_override?: bool}`. Response = the full evaluation in review shape (so the UI replaces the row in place) plus `previous_final_marks`, `new_total`, `percentage`, `grade`.

---

## 5. Phases

### P9.0 Preflight and corrections to the delivered UI
1. Run `check_all.py`; record the baseline in STATUS.md.
2. Apply `UploadScreen.diff` (`patch UploadScreen.tsx < UploadScreen.diff`) and copy the four components into `src/components/`.
3. Check `apiClient` has `patch`; add it beside `put` if missing.
4. Check the Vite proxy forwards both `/api` **and `/storage`** to port 8000 (review images use `/storage/...`).
5. If `QueueRow` already renders its own identity input for `needs_identity`, remove the duplicate.
6. Add to the banned list in `check_all.py`: `General Assessment`, `pages_total // 2`, `"met" if`, `get("legibility", 0.95)`.

**Done when:** project compiles (`tsc`), the upload screen loads, new components render with empty state. Proof: `tsc` output + screenshot.

### P9.1 Schema and paper metadata
1. Add the migration (section 3) and tests that it runs twice without error and backfills text values.
2. Implement `PATCH /api/papers/{id}` with validation; update `get_paper`, `list_papers`, create/extract/upload to carry the new fields (A3, A4).
3. Extend T1 prompt and `ExtractPaperResponse` with `subject`, `subject_code`, `exam_name`.
4. Change `QuestionInput.strictness_override` to `Optional[int]` (1-5) and persist to `strictness_level_override` in both INSERT sites (1103, 1217) and the update path (2068) (A2).

**Done when:** `curl -X PATCH` updates one field on a **locked** paper; `PUT /questions` with an integer override returns 200; upload of a paper with a printed header fills subject/code/exam, and a blank header leaves them empty. Proof: curl outputs.

### P9.2 Strictness engine (pure Python, fully unit-tested)
New `backend/strictness.py`:
- `resolve_level(question_override, paper_level) -> (level, source)`.
- `TAU_FLAG = {1:0.45, 2:0.55, 3:0.70, 4:0.80, 5:0.88}` and `PARTIAL_FACTOR` (decision 7).
- `build_strictness_instructions(level, subject_domain, has_teacher_key) -> str`: deterministic text built from spec sections 2, 3 and 4 (keyword matching, partial credit, OCR/spelling tolerance, domain rules, bilingual equivalence rule). No example answers or example marks in the text.
- `extract_question_anchors(question_text)`: action verb, explicit counts ("any 4", "give 2 examples", English and Hindi forms), named terms. A count N makes each item worth `max_marks / N` and caps credit at N items.
- `confidence_gate(level, confidence) -> Flag|None` using `TAU_FLAG`.
- `ai_draft_guardrail(level, source, verdict)`: when `source == 'ai_draft'` and level >= 4, a point that is conceptually present but missing the reference keyword gets `PARTIAL_FACTOR[level]` credit and flag `no_teacher_key_keyword` with the exact spec message ("No Teacher Answer Key uploaded: verify whether student's phrasing satisfies Level {N} terminology requirements."). Never a silent 0.
- Extend the T6 output schema with per-point `concept_present` and `keyword_present`, plus a question-level `confidence` (0-1). Final confidence = `min(model_confidence, avg_legibility)`.

Stretch (after core works): the numeric domain rules (maths arithmetic slip capped at 10-15% at levels 1-2; languages 75/25 content/grammar at level 3) need extra verdict fields; implement as a separate task once core is proven.

**Done when:** table-driven tests cover every level x (key / no key), the guardrail, anchors ("any 4" with 6 key points), and the confidence gate. Proof: pytest output.

### P9.3 One grader for pipeline and recheck (fixes A7-A14)
1. Extract the subjective-grading block (2592-2730) into `async def grade_answer(question, ref, student_text, level, domain, has_teacher_key, legibility) -> GradeResult` in `marking_engine.py`. The pipeline **and** recheck both call it. Marks are computed by code from verdicts; quote verification stays; second judge stays for long answers.
2. Persist `verdicts_json`, `strictness_used`, `confidence`, `status` on every evaluation. A failed AI call sets `status='failed'` (marks 0, flag `call_failed`/`quota_exceeded`/`call_timeout`), never a default mark.
3. Replace string flags with the coded flags (section 4). Treat missing legibility as `None` and flag it (A12). Matching on `q_no` adds flag `matched_by_q_no` (A13).
4. Rewrite recheck (3388-3472) as: load question, reference, answer; resolve level (`payload.strictness` else effective level; if `persist_override`, save to the question); call `grade_answer`; update ai fields, set `final_marks = ai_marks`, `resolved = (no flags)`; return `previous_final_marks`.
5. One function `recalculate_sheet_totals(sheet_id)` using `calculate_section_choice_totals` and one `grade_for(percentage)`; used by pipeline, review and recheck (A10).
6. Retry must keep teacher-reviewed rows: only re-grade evaluations with `resolved=0` or `status='failed'` unless the teacher chooses "Re-evaluate all" (A14).
7. Review endpoint: return real `verdicts`, the new fields, `status:'failed'` when applicable; remove the fabricated block (A7, A8).

**Done when:** a sheet graded at level 2 and rechecked at level 5 shows different `strictness_used`, honest flags and different verdicts; totals are identical before/after a no-op review on a paper with choice rules; a forced AI failure gives `status='failed'`, never marks. Proof: before/after API JSON, pytest output.

### P9.4 Real per-page OCR progress and the flip animation
Backend:
1. In `read_page` (2410): set `ocr_status='reading'` at start, `'done'` (+`ocr_legibility`) at the end, `'failed'` (+`ocr_error`) on exception. Each update is its own short transaction. On the reuse path mark all pages `done`. On retry reset to `pending`.
2. Set `sheets.stage_key` at every stage change alongside `current_stage` (`reading`, `matching`, `marking`, `flagging`).
3. Return `pages[]`, real `pages_read`, `stage_key` from both sheet endpoints (section 4). Remove the fake counters (A6).

Frontend (components already delivered):
4. Poll while `status` is `queued|evaluating|...` (the patch includes `evaluating`); use 1 s while a sheet is in `stage_key=reading`.
5. `PageFlipStrip` shows each page: scan line while `reading`, 3D flip to a check when `done`, red state on `failed`; respects `prefers-reduced-motion`.
6. Show the real stage label and counters from the server; failed state shows the real `error_message` with Retry.

**Done when:** a 4-page sheet shows pages flipping one after another in the order the server finishes them; killing the network marks the in-flight page `failed` with a readable message. Proof: screen recording or 3 screenshots + `/api/sheets/{id}` responses at 3 moments.

### P9.5 Upload screen completion
1. Paper details: title, subject, subject code, exam, domain, 1-5 strictness (delivered). Empty extracted values are highlighted "not detected".
2. Identity: manual name **and** roll (both required) when `needs_identity`; saving starts evaluation (delivered, roll now required).
3. Per-question strictness in the question drawer (delivered).
4. Amber tip when level >= 4 and the paper has no teacher key (delivered, text from spec).

**Done when:** a sheet with an unreadable header waits, shows the form, and evaluation starts right after Save; a paper with an empty subject shows the amber hint and saves via PATCH. Proof: screenshots + timestamps.

### P9.6 Evaluation workspace (the main redesign)
Find the current evaluate screen (`grep -rn "setStep('evaluate'" src`). Keep `MarksCard`; rebuild the layout.

```
┌ Header: paper · student (roll) · total/max · grade · prev/next sheet · Approve all unflagged · Finish ┐
├──────────────────────────────────────────────────────────┬──────────────────────────┤
│ LEFT (flex-1, scrolls): the selected question             │ RIGHT: Question panel  ‹ │
│  Q header: Q.1(A)(i) · section · 2M · [Strictness 3/5]    │ filter: All | Flagged | OK│
│  1 Question text (+ options for MCQ)                      │ ▢ Q1  1.5/2  ● flagged    │
│  2 Answer sheet: crop (default) / full page + box,        │ ▢ Q2  2/2    ✓            │
│    page chips for multi-page, zoom, rotate                │ ▢ Q3  –      failed       │
│  3 OCR text (editable) + legibility bar + reader diff     │  ...                      │
│  4 Marks and why (MarksCard): marks, per-point verdicts   │ Collapsed = 44 px rail    │
│    with quotes, flags with coded reasons                  │ with numbered status dots │
│  5 Reference (collapsed): model answer, key points, source│                           │
└──────────────────────────────────────────────────────────┴──────────────────────────┘
```
Components: `EvaluationWorkspace`, `QuestionDetailPane`, `SheetImageViewer` (crop/full toggle, bbox overlay using normalized `[ymin,xmin,ymax,xmax]`, page chips), `OcrTextCard`, `ReferenceCard`, `QuestionPanel` (collapsible), `StrictnessChip`, `RecheckPopover`.

Rules:
- **Data:** only `GET /review`; after Recheck/Approve replace that one evaluation from the response, no full reload. No hard-coded questions or IDs.
- **Question panel:** rows from `evaluations`; status dot = failed / flagged / approved; shows awarded/max and a small strictness badge (`3`) when a question has an override. Filters All / Flagged / Checked with counts. Collapsed state (44 px rail) is remembered (`localStorage`, try/catch). On narrow screens it becomes a bottom sheet.
- **Selection:** first flagged question is selected on open; `J`/`K` next/previous, `A` approve, `R` recheck, `[` toggles the panel (MarksCard already advertises A/R/+/-).
- **OCR card:** editable text; saving edits uses `ocr_text` in `POST /review` or `edited_text` in recheck; show `reader_texts` side by side when readers disagree; legibility as a bar with the number.
- **MarksCard changes:** (a) map `verdicts` to its props (`point = text`, show `marks_awarded/marks_available`); (b) pass `status:'failed'` when the evaluation is failed; (c) add a header chip `Strictness {used}/5 · {name}` and, if `strictness_source=='question'`, "question override"; (d) the Recheck button opens a small popover: level 1-5 pills (`StrictnessPicker compact`, default = effective level), checkbox "Save as this question's strictness", then Recheck; (e) after recheck, if marks changed, show "was {previous_final_marks}" with Undo (calls review with the old mark).
- **Honesty:** low confidence, failed calls and `no_teacher_key_keyword` flags must be visible in the detail pane, not hidden in a tooltip.

**Done when:** open a real evaluated sheet; click each question; image, OCR text, marks, per-point reasons and flags are all real and change with the selection; collapse the panel and reload (state kept); recheck at another level changes `strictness_used`. Proof: 4 screenshots + review JSON.

### P9.7 Tests and end-to-end proof
- Backend (pytest, fixtures allowed only here): migration twice; PATCH on locked paper; override int round trip; every level x key/no-key; guardrail; anchors; failed call -> `status='failed'`; recheck keeps rubric and flags; totals equal across pipeline/review/recheck; identity needs both fields; page status progression with a fake gateway.
- Frontend: `tsc` clean; component tests for `StrictnessPicker`, `PaperDetailsForm` (blur saves, failed save reverts), `IdentityForm` (both required), `PageFlipStrip` (status change flips).
- Playwright script `scripts/e2e_ui.py` (real backend, real sample paper and sheets): upload -> metadata -> flip animation -> identity form -> evaluation workspace -> recheck at level 5 -> screenshots to `docs/proof/P9.7/`.
- Run with **two different papers** to prove nothing is hard-coded.

### P9.8 Hardening and cleanup
- Single evaluation worker queue with configurable concurrency; resumed jobs and new uploads go through it (A16).
- After one release with no use of the old text `strictness` columns, remove them and the compatibility mapping.
- Add `strictness_used` and level distribution to the paper report; show per-question level in the report card when it differs from the paper level.
- Update README and `.env.example` if config keys were added.

---

## 6. Acceptance checklist

1. Teacher can type paper title, subject, code, exam and they persist (also after lock).
2. Teacher can type student name and roll when not detected; evaluation starts right after.
3. During OCR, pages flip one by one as the **server** finishes them; failures show on the page.
4. Evaluation screen: question, answer image, OCR text, marks, per-point reasons, flags all real; right panel collapses and remembers state.
5. Strictness 1-5 exists for the paper and per question; it changes the grading prompt, partial-credit factor, flag threshold and is stored as `strictness_used`.
6. Level 4-5 without a teacher key never gives a silent zero for a conceptually right answer; it flags with the spec message.
7. Recheck uses the same rubric grader, never defaults a mark, never hides flags, and is undoable.
8. Totals are identical across pipeline, review and recheck.
9. No fabricated verdicts, no fake progress counters, no default legibility.
10. `scripts/check_all.py` passes; two-paper run passes.

## 7. Do not

- Do not reuse the old recheck prompt. Do not add example answers or example marks to any prompt.
- Do not show page progress that the server did not report.
- Do not store strictness only in the UI.
- Do not change grading numbers (partial factors, thresholds) without updating the table in section 2 and the tests.

# STATUS (update at the end of every session)
Date / author (agent or model name): 2026-11-17 / Antigravity (Gemini 3.8 Flash)
Current phase and task: Phase P9.3 complete; starting Phase P9.4 (Real Per-Page OCR Progress & Flip Animation).
Done (task id, commit, proof file):
- Task P9.3: One Grader for Pipeline and Recheck (`backend/marking_engine.py`, `backend/main.py`, `backend/tests/test_p9_3.py`, `scripts/verify_p9_3.py`, `docs/proof/P9.3/`):
  1. Extracted subjective and objective grading into `async def grade_answer(question, ref, student_text, level, domain, has_teacher_key, legibility) -> GradeResult` in `backend/marking_engine.py`. Unified grading across both pipeline and recheck.
  2. Implemented `recalculate_sheet_totals` using `calculate_section_choice_totals` and unified `grade_for(percentage)` function across pipeline, teacher review, and recheck. Verified 100% choice totals parity before and after teacher review.
  3. Rewrote `POST /api/evaluations/{eval_id}/recheck` to use `grade_answer`, honor strictness input (1-5), optionally persist question override, recompute coded flags honestly, clear cached crops, and return `previous_final_marks` and full evaluation review payload.
  4. Updated `GET /api/sheets/{sheet_id}/review`: removed fabricated `"met"` / `"unmet"` block (`key_point_verdicts`); returned real stored `verdicts`, `strictness_used`, `strictness_effective`, `strictness_source`, `confidence`, `status`, and coded flags (`[{"code", "message", "severity"}]`).
  5. Implemented retry retention (A14): preserves teacher-reviewed evaluations and evaluations with `resolved == 1` and `status == 'ok'`.
  6. Replaced banned strings: eliminated `"met" if`, `get("legibility", 0.95)`, and `General Assessment`. Missing legibility is treated honestly as `None` and flagged with `low_legibility`; fallback matches on printed `q_no` add `matched_by_q_no` flag.
  7. Verified 6/6 tests passing in `test_p9_3.py`, all 61 tests passing across full pytest suite, and `npx tsc --noEmit` clean. Proof saved to `docs/proof/P9.3/api_proof.json` and `docs/proof/P9.3/pytest_p9_3.txt`. | docs/proof/P9.3/
- Task P9.2: Strictness Engine & Unit Tests (`backend/strictness.py`, `backend/tests/test_strictness.py`, `docs/proof/P9.2/`):
  1. Implemented `resolve_level` (question override -> paper level -> default 3) with source tracking ("question" | "paper").
  2. Implemented `TAU_FLAG = {1:0.45, 2:0.55, 3:0.70, 4:0.80, 5:0.88}` and `PARTIAL_FACTOR = {1:0.75, 2:0.65, 3:0.50, 4:0.40, 5:0.25}` matching specification.
  3. Implemented `build_strictness_instructions` with deterministic prompts across levels 1..5, 6 academic subject domains, and AI draft safeguards without hardcoded sample strings.
  4. Implemented `extract_question_anchors` detecting action verbs (English + Hindi), explicit counts ("any 4", "give 2 examples", "तीन अंतर"), and mandatory technical terms.
  5. Implemented `confidence_gate` using tier tau thresholds and `ai_draft_guardrail` enforcing non-zero partial credit with exact spec message when `reference_source == 'ai_draft'` and `level >= 4`.
  6. Implemented `calculate_overall_confidence = min(model_confidence, avg_legibility)`.
  7. Verified 17/17 tests passing in `test_strictness.py` and saved proof to `docs/proof/P9.2/pytest_strictness.txt`. | docs/proof/P9.2/
- Task P9.1: Schema and Paper Metadata (`backend/db.py`, `backend/main.py`, `backend/tests/test_migration.py`, `backend/tests/test_p9_1.py`, `scripts/verify_p9_1.py`, `docs/proof/P9.1/`):
  1. Implemented idempotent migration in `backend/db.py` adding all 13 columns across `papers`, `questions`, `sheets`, `sheet_pages`, and `evaluations`. Added WAL mode. Backfilled `strictness_level` and `strictness_level_override` from legacy text. Verified migration runs twice without error via `test_migration.py`.
  2. Implemented `PATCH /api/papers/{paper_id}` with strict validation (ranges 1..5 for `strictness_level`, valid subject domain check, non-empty title). Verified updates persist and are permitted even when paper is locked.
  3. Extended `_extract_questions_from_file_bytes`, T1 prompt, and `ExtractPaperResponse` with `subject`, `subject_code`, `exam_name`.
  4. Updated `QuestionInput.strictness_override` to accept integer values 1-5, persisted to `strictness_level_override` across all INSERT sites and UPDATE paths.
  5. Verified all 38 pytest tests pass (100%) and saved curl/API proof to `docs/proof/P9.1/curl_outputs.txt`. | docs/proof/P9.1/
- Task P9.0: Preflight and UI Patching (`src/api/client.ts`, `src/screens/UploadScreen.tsx`, `src/components/QueueRow.tsx`, `src/components/{PaperDetailsForm,StrictnessPicker,IdentityForm,PageFlipStrip}.tsx`, `scripts/check_all.py`, `docs/proof/P9.0/`):
  1. Ran preflight `check_all.py` baseline (ALL PASS: banned strings, git secrets, 34 pytest passing, tsc clean, live provider health).
  2. Applied `UploadScreen.diff` cleanly to `src/screens/UploadScreen.tsx`; incorporated `PaperDetailsForm`, `StrictnessPicker`, `IdentityForm`, and `PageFlipStrip`.
  3. Added `apiClient.patch` method beside `put` in `src/api/client.ts`.
  4. Verified Vite config proxies `/api` and `/storage` to backend port 8000.
  5. Removed duplicate inline identity form from `src/components/QueueRow.tsx`.
  6. Added banned strings (`General Assessment`, `pages_total // 2`, `"met" if`, `get("legibility", 0.95)`) to `scripts/check_all.py`.
  7. Verified clean compilation with `npx tsc --noEmit` and captured upload UI screenshot with empty/detected paper details at 1366x768. Proof saved to `docs/proof/P9.0/tsc_output.txt` and `docs/proof/P9.0/upload_screen.png`. | docs/proof/P9.0/
- EvalDesk Fix Plan: Slow Paper Load, Wrong Crops, Missing Continuation Pages & Scoring Bugs (`backend/pdf_tools.py`, `backend/ai_gateway.py`, `backend/storage.py`, `backend/main.py`, `backend/reports_generator.py`, `scripts/verify_fix_plan.py`):
  1. Paper Load & Extraction Acceleration (Step 1):
     - Eliminated separate remote AI orientation call (`pdf_tools.py:116`). Replaced with local `ImageOps.exif_transpose` (sub-millisecond) and integrated rotation detection directly into the T1 extraction prompt (`"rotation_degrees_clockwise": 0 | 90 | 180 | 270`), rotating locally via `apply_rotation_degrees`.
     - Multi-Page Scanned PDFs: Renders and passes up to 10 pages in `images_bytes` in a single multi-image Gemini call rather than dropping pages after page 0.
     - Media Optimization: Image normalizer standardizes to max 1600px at JPEG quality 80.
     - SHA-256 Content-Based Cache: Added deterministic cache for paper extractions (`data/cache/paper_extractions/{sha256}.json`), achieving 0.03s instant re-upload.
     - Removed slow per-page orientation calls during student sheet ingestion.
  2. Answer Crops & Robust Bounding Box Parser (Step 2):
     - Deleted arbitrary 35% page slice fallback in `storage.py`. Unattempted questions now cleanly yield `None` (no more false question headers).
     - Robust multi-level box unwrapping: handles nested lists (e.g. `[[[ymin, xmin, ymax, xmax]]]`), multi-box lists per page (bounding union), and scales across normalized 0..1, 0..1000, and pixel coordinates.
     - Enforced clamping, positive bounding area, and minimum 15px dimensions.
     - Deterministic crop caching keyed by `eval_id` and SHA-256 hash of `(page_numbers, bbox_raw)`. Added `clear_answer_crops` on review overrides.
  3. Multi-Segment Continuation Pages (Step 3):
     - Multi-Page Stacked Crops: When student answers span multiple pages (e.g. Part II Q.2, Q.5, Part III Q.3), `get_or_create_answer_crop_path` extracts the box from each page and stitches them into a unified vertical submission image with clear "Page N" / "Page N (Continuation)" banners.
     - Fixed 1-based page index off-by-one bug in `/crop/{eval_id}` endpoint.
     - Scaled image bounds in PDF report card increased from 130px to 240px to preserve legibility for extended answers.
  4. Scoring Parity & Duplicate Review Deduplication (Step 4):
     - Deduplicated `reviews` join in report queries using `ROW_NUMBER() OVER (PARTITION BY evaluation_id ORDER BY reviewed_at DESC, id DESC) as rn WHERE rn = 1`.
     - Added defensive question deduplication in `reports_generator.py` and `submit_teacher_review` upsert/delete logic, resolving the 4x duplicate rows on Part III Q.3.
     - Choice Rule Clarity: Questions excluded under "Attempt any N" choice rules now clearly display their awarded score (e.g. `Awarded: 1.5 / 6 (Excluded)`) alongside `[Optional — Not Counted in Total]`, ensuring transparency.
     - Section Max Marks: Section headers take max marks from section config, and header total (28.0) strictly matches the sum of section counted subtotals (8.5 + 12.0 + 7.5 = 28.0).
  5. Verified via `python scripts/verify_fix_plan.py` (ALL PASS), `python -m pytest -q` (33 passed), and `npx tsc --noEmit` (0 errors).
- Teacher Answer Key Intake & AI Reference Generation Remediation (`backend/main.py`, `backend/ai_gateway.py`, `src/screens/UploadScreen.tsx`, `scripts/test_answer_key_and_step1a.py`, `scripts/test_student_sheet_e2e.py`):
  1. Teacher Answer Key Upload on `#/upload` Step 1A: Restored dedicated "Upload or Drop Teacher Answer Key (PDF / Image / DOCX — Optional)" next to Question Paper upload in responsive 2-column grid. Added `.docx` text extraction without external pip dependencies using standard library `zipfile` and `xml.etree.ElementTree`.
  2. Answer Key & AI Reference Parity: Answer key parsing stores references with `source = 'teacher_key'`. Reference generation (`POST /api/papers/{paper_id}/reference/generate`) automatically detects and skips AI drafting for any question with `source == 'teacher_key'`, preserving teacher references 1:1.
  3. AI Reference Drafting Resilience & Throttling:
     - Increased LLM timeout to 120s in `backend/ai_gateway.py`.
     - Grouped questions by section, processing section-by-section with `asyncio.Semaphore(2)` and backoff retry.
     - Added automatic fallback to Groq (`ai_gateway.call_groq`) whenever Gemini returns 503/429 or times out.
     - Added fallback rubric generation with `needs_retry: True` so that paper locking is never permanently blocked by upstream provider outages.
  4. OCR Reading & Grading Fallback: Added automatic Groq Vision fallback to `read_sheet_answers` and `evaluate_answer_sheet` when Gemini returns 429 quota exhaustion.
  5. Question Drawer Display: Shows Reference Source badge (`Teacher Key` vs `AI Reference`), model answers, and key points with marks.
  6. Verified via `scripts/test_answer_key_and_step1a.py`, `scripts/test_student_sheet_e2e.py`, `npm run check:ui` (ALL PASS across 1366x768 and 1920x1080), and `python scripts/check_all.py --base http://127.0.0.1:8000` (ALL PASS).
- Step 1A Question Paper Remediation & Global Exception Handler (`backend/main.py`, `src/api/client.ts`, `src/screens/UploadScreen.tsx`, `scripts/verify_step1a.py`):
  1. Global FastAPI Exception Handlers: Added module-level `logger = logging.getLogger("evaldesk")`, `@app.exception_handler(Exception)` and `@app.exception_handler(HTTPException)` returning structured JSON `{code, message, detail, path}` and logging complete stack traces to eliminate opaque "Internal Server Error" (500) messages.
  2. PaperCreateRequest & POST /api/papers Schema Fix: Changed required `questions: List[QuestionInput]` and `title: str` to optional fields with `default_factory=list` and safe default assessment titles. When `draft_id` is supplied, extracts questions, sections, and marks from `paper_drafts.extracted_data_json` and persists them into SQLite `questions` and `sections` tables.
  3. Question Paper Upload Endpoint (`POST /api/papers/{paper_id}/upload`): Added atomic question paper upload endpoint accepting both `file` and `paper_file` formData keys, extracting questions with T1 prompt, saving document to paper storage, inserting questions and sections into SQLite, and updating paper marks.
  4. Paper Lock & Unlock Parity: Verified `lock_paper` persists `is_locked = 1` and computes total marks without deleting or zeroing questions. Added automatic rubric generation fallback in `UploadScreen.tsx` when locking.
  5. Frontend Error Parsing & Card A UX: Enhanced `src/api/client.ts` to parse `message`, `detail`, or `error.message`. Added empty title validation with user feedback in `UploadScreen.tsx`, auto-creation of draft paper if none selected before uploading question paper, immediate active paper state selection, and Card A drag-and-drop.
  6. Verified via `scripts/verify_step1a.py`, `python -m pytest -q` (33 passed), `npx tsc --noEmit` (0 errors), `npm run check:ui` (ALL PASS across 1366x768 and 1920x1080), and `python scripts/check_all.py --base http://127.0.0.1:8000` (ALL PASS).
- Remediation R1-R5: EvalDesk UI/UX Overhaul & Functional Bug Remediation (`src/app/Shell.tsx`, `src/screens/UploadScreen.tsx`, `src/components/QueueRow.tsx`, `src/state/useSheetStore.ts`, `src/index.css`, `backend/main.py`):
  1. Strictly 3 Screens (`1. Upload > 2. Evaluate > 3. Report`): Removed standalone `#/setup` and `#/processing` screens; all legacy and redirected URLs cleanly map to `#/upload` (or `#/evaluate/:id` if evaluated); workflow stepper strictly consists of 3 steps.
  2. Question Paper Upload on `#/upload` Strictly Isolated from Answer Sheets:
     - Left Column: Vertically split into Card A (`Step 1A · Question Paper`, managing paper creation, upload, AI question extraction, inline rubric drawer, and locking; collapses into a compact status bar when locked) and Card B (`Step 1B · Student Answer Sheets`, dedicated dropzone, multi-page toggle, and feature badges).
     - Right Column: Uploaded Batch Queue fed by `GET /api/papers/{id}/sheets` with live inline 5-stage progress tracking (`Name -> Pages -> Match -> Mark -> Flags`), scan-line sweep thumbnail, inline identity form, and one-click navigation into `#/evaluate/{sheetId}`.
  3. Fixed Paper Lock Dropping Questions ("No questions" bug): Corrected details extraction (`details.paper || details`), enforced questions > 0 before locking, ensuring Card A and the bottom bar consistently display `Locked ✓ · N questions · M marks`.
  4. Google Stitch Light Design System: Light Slate/Indigo palette (`#F8FAFC` canvas, `#FFFFFF` cards, `#E2E8F0` borders, `#4F46E5` accent, emerald/amber/rose status badges), Noto Sans + Noto Sans Devanagari typography, locked `100dvh` viewport (`scrollHeight <= innerHeight` at 1366x768 & 1920x1080); static audit verified 0 banned sample strings in `src/`.
  Proof saved to `docs/proof/ui/remediation_proof.txt`.
- Task U5: Polish, Bilingual Devanagari font check & Section 12 Acceptance Checklist verification twice across two distinct papers (Paper 1: Bilingual Linux Architecture Exam, Kanak Patel SGSU250489; Paper 2: Computer Networks & Systems Exam, Vikram Rao BCA-2026-55); 14/14 checks passed at 1366x768 and 1920x1080; zero page scroll; 100% database parity with PDF Report Card and Excel; legacy screen cleanup in legacy/; accessibility ARIA landmarks added; proof saved to docs/proof/ui/u4_u5_acceptance.txt) | docs/proof/ui/u4_u5_acceptance.txt
- Task U4: One-Screen Report Workspace (`src/screens/ReportScreen.tsx`, `src/app/Shell.tsx`, `backend/main.py`: `GET /api/sheets/{sheet_id}/report`, `POST /api/sheets/{sheet_id}/report/regenerate`, `GET /api/papers/{paper_id}/reports`, `backend/reports_generator.py`; two-column zero-scroll layout with internal `.panel` scrolling; Student report card tab with score/percentage/grade KPI card, T7 strengths & improvements, per-question marks breakdown with optional badges; Paper report tab with score distribution cohorts, flag rate, teacher override rate, question accuracy table, most-missed rubric points, and paper suggestions; real downloads for Student Report Card PDF, Paper Summary PDF, and Results Excel; stale report detection with one-click regenerate; 100% parity across SQLite DB, JSON API, ReportLab PDF, and Excel workbook) | commit 598d25e | docs/proof/ui/u4_proof.txt
- Task U3: One-Screen Evaluation Workspace (`src/screens/EvaluateScreen.tsx`, `src/components/QuestionSidebar.tsx`, `src/components/SheetViewer.tsx`, `src/components/OcrCard.tsx`, `src/components/ReferenceCard.tsx`, `src/components/MarksCard.tsx`, `src/hooks/useHotkeys.ts`, `src/app/Shell.tsx`, `backend/main.py`: `PUT /api/papers/{paper_id}/questions/{key}/reference` endpoint; 3-pane zero-scroll layout `280px / 1fr / 380-420px`; collapsible sidebar with localStorage persistence; fixed viewer with pan/zoom/normalized bbox highlight overlay and continuation jump chip; OCR transcript with dual reader diff and legibility score; Reference card with AI warning banner and slide-over reference edit drawer; Marks card with 0.5M stepper, AI delta display, key-point verdicts, plain-English flags, live AI recheck skeleton, and approval toggle; bottom ActionBar with question counter, segmented progress, shortcut hints, approve all unflagged modal, and gated finish button; keyboard hotkeys `→`/`←`/`A`/`F`/`+`/`-`/`R`/`E`/`[`/`?`) | commit b83b7bc | docs/proof/ui/u3_proof.txt
- Task U2: Live Processing Screen (`src/screens/ProcessingScreen.tsx`: driven strictly by `GET /api/sheets/{id}` polling every 1s, slim batch sheets selector list on left with live status ticks, current page thumbnail with 1.6s CSS gradient scan-line sweep, live stage pipeline `Reading name -> Reading pages -> Matching -> Marking -> Flagging`, live counters `pages_read/pages_total` and `questions_marked/questions_total`, quota countdown from `retry_at`, failure state turning failed stage red with `error_message` + Retry, inline Name/Roll fallback for `needs_identity`, `[Open first reviewed question]` shortcut upon marking start, auto-advance to `#/evaluate/{sheetId}` on completion) | commit d8b8b5b | docs/proof/ui/u1_u2_proof.txt
- Task U1: Upload Screen & Live Batch Queue (`src/screens/UploadScreen.tsx`, `src/components/QueueRow.tsx`: two-column zero-scroll layout with drag-and-drop zone scaling to 1.02 on dragover, browse click, `.pdf/.jpg/.png` intake, `"Treat each file as a separate sheet"` toggle, pre-upload file validation min 500B / max 50MB, real XHR upload progress bar, live queue fed by `GET /api/papers/{id}/sheets`, inline `[Name][Roll][Save]` prompt for `needs_identity` calling `POST /api/sheets/{id}/identity`, locked paper strip, and Start processing navigation) | commit 99a7ae7 | docs/proof/ui/u1_upload_proof.txt
- Task U0.3: Automated Viewport & Banned-String Gate (`npm run check:ui` in `package.json`, Playwright script `scripts/check_ui.py` testing 1366x768 and 1920x1080 across all 5 routes, verifying `scrollHeight <= innerHeight` and 0 console errors, screenshot captures, and `check_all.py` integration) | commit 9bee767 | docs/proof/ui/u0_proof.txt
- Task U0.2: Section 9 Backend Contract Additions (`backend/main.py` updated and verified with `scripts/verify_u0_2.py`: `GET /api/papers/{id}/sheets`, `GET /api/sheets/{id}`, `GET /api/sheets/{id}/pages/{n}/image`, `GET /api/sheets/{id}/review`, `POST /api/evaluations/{id}/review`, `POST /api/sheets/{id}/approve-unflagged`, `POST /api/evaluations/{id}/recheck`, `POST /api/sheets/{id}/finish`, `GET /api/sheets/{id}/report`) | commit 867aad6 | docs/proof/ui/u0_2_proof.txt
- Task U0.1: Locked Viewport App Shell & Design System (`100dvh` grid shell `grid-template-rows: 48px 1fr 56px`, `:root` tokens, Noto Sans + Noto Sans Devanagari fonts, 48px TopBar, sliding overlay `ErrorBanner`, 56px `ActionBar`, hash routing `#/upload`, `#/processing/<sheetId>`, `#/evaluate/<sheetId>`, `#/report/<sheetId>`, `#/setup`, typed fetch client `src/api/client.ts`, polling hook `src/hooks/usePolling.ts`, central store `src/state/useSheetStore.ts`) | commit 25f64b5 | docs/proof/ui/u0_1_proof.txt
In progress / failing (exact error): None.
UI phase and task: System Stable & Verified.
Recent Fixes & Hardening:
- Fix 1: Section ID uniqueness on `POST /api/papers/{paper_id}/upload` (`backend/main.py`). Avoids reusing cached section IDs from AI extractions; generates fresh UUIDs (`s["id"] = sec_id`) and maps `q["section_id"] = sec_id`. Resolves `sqlite3.IntegrityError: UNIQUE constraint failed: sections.id`.
- Fix 2: Root `conftest.py` with autouse `_isolated_storage` fixture. Redirects `DB_PATH`, `CACHE_DIR`, and `STORAGE_DIR` during pytest runs to a temporary folder (`tmp_path`), permanently preventing tests from polluting `data/app.db` with dummy test papers.
- Fix 3: Pipeline Acceleration & Event Loop Unblocking. Parallelized Stage 2 OCR with `asyncio.Semaphore(3)` (reduced 9-page read time from ~160s to 43s), removed duplicate Groq OCR calls, eliminated upload orientation overhead, and wrapped line segmentation with `asyncio.to_thread`.
- Fix 4: SheetViewer clipping fix (`src/components/SheetViewer.tsx`). Replaced `transform: scale()` inside flexbox with layout-driven percentage width (`width: ${zoom * 100}%`) and native scrollable container (`overflow-auto`).
- Fix 5: Answer highlight bbox mapping (`src/screens/EvaluateScreen.tsx`). Correctly mapped active page box from backend bbox list `pgs.indexOf(activePage)` and converted coordinate order `[ymin, xmin, ymax, xmax]` -> `[x0, y0, x1, y1]`.
- Fix 6: Objective question reference resolving (`backend/main.py`). Resolves option indices (e.g. `'1'`) and letter codes (e.g. `'B'`) to option text, scoring `"Operating System"` correctly as 1.0 / 1.0 M for Q.1 (A)(i). Added `correct_option` display and editing in `ReferenceCard.tsx`.
- One-time Cleanup: Live database backed up to `data/app.db.before_clean`, `data/cache` test artifacts cleared, and clean schema reinitialized. Verified 34 tests passing with 0 database leaks.
Screens done (upload | evaluate | report): upload | evaluate | report
Last check:ui result and viewport sizes tested: ALL PASS (1366x768 and 1920x1080 across all screens; 0 scroll overflow; 0 console errors)
Proof files in docs/proof/ui/: remediation_proof.txt, u0_proof.txt, u0_2_proof.txt, u1_upload_proof.txt, u1_u2_proof.txt, u3_proof.txt, u4_proof.txt, u4_u5_acceptance.txt
Open UI issues (exact error text): None
Next three actions:
1. User demo walkthrough of the streamlined 3-screen SaaS workflow.
2. End-to-end user feedback intake.
3. Production staging deployment.
Known issues and decisions (link to docs/DECISIONS.md):
- Strictly 3 screens: `#/upload` -> `#/evaluate/:id` -> `#/report/:id`. Stepper has strictly 3 steps. Legacy URLs (`#/setup`, `#/processing`) cleanly redirect to `#/upload`.
- Question Paper (Card A) and Student Answer Sheet (Card B) are isolated in the Left Column of `#/upload` with separate file dropzones and inputs.
- Locking a paper requires questions > 0 and preserves question count across all views without wiping metadata.
- All file paths in SQLite are stored as relative POSIX paths (`data/storage/...`) to ensure portability across Windows and Linux.
- Review and Reports states persist across page reloads via SQLite, hash routing, and `GET /api/sheets/{id}/review`.
How to run: backend command, frontend command, check_all command
- Unified Dev: `.\start_dev.ps1` or `start_dev.bat`
- Backend: `python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000`
- Frontend: `npm run dev`
- check:ui: `npm run check:ui`
- check_all: `python scripts/check_all.py --base http://127.0.0.1:8000`
- Remediation verification: `python scripts/verify_remediation.py`
Provider status (from /api/health/providers):
- Gemini text: online (gemini-3.5-flash-lite, latency ~0ms)
- Gemini image: online (gemini-3.5-flash-lite, latency ~1ms)
- Groq image: online (qwen/qwen3.8-27b, accepts_images: true, latency ~3ms)

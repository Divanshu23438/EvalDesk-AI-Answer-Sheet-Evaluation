# STATUS (update at the end of every session)
Date / author (agent or model name): 2026-11-20 / Antigravity (Gemini 3.8 Flash)
Current phase and task: Configure EvalDesk for one-click deployment on Hugging Face Spaces (Docker SDK on port 7860) Complete 100%.
Done (task id, commit, proof file):
- Configured EvalDesk for One-Click Deployment on Hugging Face Spaces (Docker SDK on Port 7860) (`main.py`, `Dockerfile`, `.dockerignore`, `README.md`, `backend/canonical_seed.py`, `backend/config.py`, `backend/main.py`):
  1. Unified Single-Container Entrypoint & Auto-Seeding (`main.py`, `backend/canonical_seed.py`, `backend/config.py`):
     - Created root entrypoint `main.py` configured for port 7860 (`0.0.0.0:7860`).
     - Prioritizes SQLite database `evaldesk.db` (root) while mirroring and maintaining compatibility with `data/app.db`.
     - Created `backend/canonical_seed.py`: automatically initializes and seeds the canonical bilingual `Linux` paper (`fca9eed5-b1ac-4ac3-8da4-a34b415a9e92`) on startup if the database is empty.
     - Populates 3 exam sections (Part I, Part II, Part III), 19 bilingual questions with answer keys and rubric references, and a realistic 6-student evaluated cohort:
       - Kanak Patel (`SGSU250489`): 44.5 / 54.0 M, 82.4% (Grade A), with full 9-page answer sheet, per-question extractions, bounding boxes, quotes, and teacher-aligned evaluations.
       - Devina Roy (`CS2026-101`): 48.0 / 54.0 M, 88.9% (Grade A+).
       - Aarav Mehta (`CS2026-102`): 40.5 / 54.0 M, 75.0% (Grade B+).
       - Priya Sharma (`CS2026-103`): 35.5 / 54.0 M, 65.7% (Grade B).
       - Vikram Malhotra (`CS2026-104`): 31.0 / 54.0 M, 57.4% (Grade C).
       - Ananya Iyer (`CS2026-105`): 51.5 / 54.0 M, 95.4% (Grade A+).
     - Provides instant out-of-the-box functionality for Dashboard, Bento Reports Center, Leaderboard, Student Search & Stepper, and Batch PDF/Excel Exports without requiring manual uploads or external database dependencies.
  2. Built Frontend SPA & Asset Serving (`backend/main.py`):
     - Mounted `dist/assets` as static files in FastAPI when `dist/assets` exists.
     - Registered root route `GET /` and catch-all `GET /{full_path:path}` serving `dist/index.html` as the SPA fallback for all frontend routes (`#/reports`, `#/guide`, `#/dashboard`, `#/upload`, etc.).
     - Strictly preserved 404 responses for unmatched `/api/...` and `/storage/...` endpoints.
  3. Multi-Stage Dockerfile for Hugging Face Spaces (`Dockerfile`, `.dockerignore`):
     - Stage 1 (`node:20-slim AS builder`): copies package manifests, runs `npm ci`, and executes `npm run build` to generate optimized `dist/`.
     - Stage 2 (`python:3.11-slim`): installs Debian system dependencies for Pillow, OpenCV, PyMuPDF, ReportLab, and PDF generation (`libgl1`, `libglib2.0-0`, `libfreetype6`, `libjpeg62-turbo-dev`, `zlib1g-dev`, `fonts-dejavu-core`), installs `requirements.txt`, copies `backend/`, `scripts/`, `main.py`, `evaldesk.db*`, and `--from=builder /app/dist ./dist`.
     - Creates `/app/uploads` and `/app/data/storage` with `chmod -R 777 /app` to allow full read/write permissions for Hugging Face Spaces user ID `1000`.
     - Configures standard execution command: `CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]`.
  4. Hugging Face Space Metadata (`README.md`):
     - Prepended required YAML frontmatter to `README.md` with title, emoji, color gradient, `sdk: docker`, and `app_port: 7860`.
  5. Verification & Gate Checks:
     - `npm run build`: built in 3.34s with zero errors.
     - `npx tsc --noEmit`: 0 errors.
     - `python scripts/check_all.py --base http://127.0.0.1:7860`: `RESULT: ALL PASS` (banned strings, no .env/dist/data/cache tracked, pytest, tsc, and live endpoint health check).
- Integrated In-Depth Telemetry into 1-Page Bento Report Card (`StudentReportCard.tsx`, `scripts/verify_telemetry_bento.py`):
  1. Telemetry Section 1: Question & Section Marks Telemetry:
     - Question-by-Question Marks Scored vs Max bar chart with Full (Emerald), Partial (Amber), and Deduction (Rose) counts.
     - Total Marks Distribution Split donut gauge showing Marks Scored vs Marks Lost and total percentage.
     - Sectional Marks Breakdown horizontal progress bars with marks earned/max, percentage badges, question lists, and marks lost.
  2. Telemetry Section 2: Teacher Deductions & Error Taxonomy:
     - Deductions by Error Category donut gauge with total marks lost (-X M) and classified error categories: Conceptual Mistakes, Incomplete Steps, Syntax/Rubric Flags, Other Deductions.
     - Pareto Error Analysis (80/20 Rule) SVG bar chart with ranked deductions, cumulative percentage polyline, and 80% reference cutoff line.
  3. Telemetry Section 3: Question Format & Attempt Performance:
     - Marks Earned vs Lost by Question Format 100% stacked horizontal bars (Objective / Short, Core Practical, Extended / Long) with yield classification.
     - Question Attempt & Mastery Breakdown donut gauge showing total attempted count/percentage and 4 mastery category rows: Full Marks (≥90%), Partial Marks, Heavy Deductions/Zero, Unattempted.
  4. 1-Page Fit & Academic Bento Polish:
     - Header & Candidate Identity Bento Row (Title, Subject, Date, Verified Badge, ID, Name, Roll No, Class, Strictness).
     - Aggregate Score & Result Summary Strip (Total Marks, Percentage, Awarded Grade, Final Status PASS/RE-APPEAR).
     - Sub-nav pill buttons (`All Telemetry`, `1. Marks & Sections`, `2. Error Taxonomy`, `3. Formats & Attempt`).
     - Question Marks Ledger (Scores and status only — zero transcripts).
     - 3-Column Verification Sign-Off Strip (AI Rubric Audit, Course Instructor, Controller of Examinations) + 1-line grading legend.
     - Ultra-dense bento layout fitting cleanly onto 1 single A4 page on screen and `@media print` (`@page { size: A4 portrait; margin: 6mm; }`).
  5. Verification & Gate Checks:
     - `npx tsc --noEmit`: 0 errors.
     - `python scripts/check_all.py`: `RESULT: ALL PASS` (banned strings, no sensitive files, pytest, tsc, and live AI provider health).
     - Playwright browser test (`scripts/verify_telemetry_bento.py`): verified in light mode and dark mode.
     - Captured evidence screenshots:
       - `docs/proof/ui/screenshots/proof_bento_report_card_light.png`
       - `docs/proof/ui/screenshots/proof_bento_report_card_dark.png`
- Restored & Enhanced Dedicated Teacher User Manual & FAQ Screen (`src/screens/GuideScreen.tsx`, `src/components/AppSidebar.tsx`, `src/App.tsx`, `src/screens/HomeScreen.tsx`, `src/state/useSheetStore.ts`, `scripts/verify_guide_screen.py`):
  1. Route & Alias Navigation:
     - Registered `#/guide` and aliased `#/help` and `#/faq` in both `src/App.tsx` and `src/state/useSheetStore.ts` to seamlessly render `<GuideScreen />`.
     - Restored "Help & FAQ" navigation button with `BookOpen` icon in `src/components/AppSidebar.tsx` directly above the Dark Mode toggle row, with responsive collapsed (`w-20`) and expanded (`w-64`) layouts and active highlight (`bg-[#E8F3EE] text-[#0F5132]` in light, `dark:bg-[#1A2B23] dark:text-[#7CC9A3]` in dark mode).
     - Added "Guide & FAQ" direct link in `src/screens/HomeScreen.tsx` top navbar.
  2. 5-Chapter Interactive Teacher User Manual (`src/screens/GuideScreen.tsx`):
     - Chapter 01: Exam Setup & Reference Key (exam scheme definition, vision-based Auto-Fetch reference key and rubrics, and scheme locking).
     - Chapter 02: Batch Upload & Student Booklet Parsing (300 DPI scan guidelines, automated student header/roll parsing, cover page legibility validation).
     - Chapter 03: 1–5 AI Strictness Calibration & Partial Credit Mechanics (detailed comparative matrix for Lenient, Mild, Balanced [Default], Rigorous, and Exact tiers).
     - Chapter 04: Split-Screen Workspace, Keyboard Navigation & Re-Evaluation (interactive keyboard shortcuts cheatsheet, and OCR confidence threshold rules: >=85% Verified, <85% Needs Review).
     - Chapter 05: Bento Marksheets & Institutional Reports (Report Card center, whole-class Excel export, 1-page bento report cards, two-sided PDF marksheets with grading scales).
     - Chapter progress tracking with "Mark as Learned ✓" toggle and real-time read counter persisted in `localStorage` (`evaldesk_guide_read`).
  3. Interactive FAQ Panel & Smart Cross-Linking:
     - 10 real-world teacher FAQs addressing scan resolution, roll number editing, strictness selection, question-level overrides, grading scales, and exports.
     - Real-time category filtering (`All`, `OCR & Scans`, `Scoring`, `Reports`).
     - Animated expand/collapse accordions with rotating chevrons.
     - Deep cross-link action buttons `"Learn more in Chapter 0X →"` inside expanded FAQ cards that instantaneously switch the active manual reader to the referenced chapter.
  4. Real-Time Live Search Filter:
     - Unified search input filtering both manual chapter pills and FAQ cards simultaneously with clear buttons.
  5. Dark Mode & Academic Palette Alignment:
     - 100% theme consistency with Porcelain & Deep Forest Emerald (`#F6F7F5` / `#FFFFFF` / `#0F5132`) in light mode and Matte Graphite (`#111312` / `#181B19` / `#1F6E4A`) in dark mode.
     - Strict adherence to academic clean design: zero neon glows, glassmorphism, or gradients.
  6. Verification & Gate Checks:
     - `npx tsc --noEmit`: 0 errors.
     - `python scripts/check_all.py`: `RESULT: ALL PASS` (banned strings, no sensitive files, pytest, tsc, and live AI provider health).
     - Playwright browser test (`scripts/verify_guide_screen.py`): `ALL VERIFICATION CHECKS PASSED PERFECTLY!`
       - Verified HomeScreen top header link navigates to `#/guide`.
       - Verified `#/help` and `#/faq` alias routes render GuideScreen.
       - Verified AppSidebar "Help & FAQ" active highlighting and click handling.
       - Verified Chapter 01 to 05 tab switching, 1–5 strictness comparison matrix, keyboard shortcuts, and confidence threshold cards.
       - Verified FAQ category filtering, accordion expansion, and "Learn more in Chapter 03" cross-link activation.
       - Verified live search filtering for chapters and FAQs.
       - Verified dark mode toggle and styling.
       - Regression-checked core routes (`#/upload`, `#/dashboard`, `#/history`, `#/reports`, `#/report/:sheetId`) with zero errors.
     - Captured evidence screenshots:
       - `docs/proof/ui/guide/1_guide_light_overview.png`
       - `docs/proof/ui/guide/2_guide_chapter3_strictness.png`
       - `docs/proof/ui/guide/3_guide_chapter4_shortcuts.png`
       - `docs/proof/ui/guide/4_guide_dark_overview.png`
       - `docs/proof/ui/guide/5_guide_dark_chapter3.png`
- Decoupled Dedicated 1-Page Bento Report Card & PDF Generation (`src/components/StudentReportCard.tsx`, `src/screens/ReportsCenterScreen.tsx`, `backend/reports_generator.py`, `backend/main.py`, `scripts/verify_bento_report.py`):
  1. Complete Decoupling from Post-Evaluation Route:
     - Post-evaluation workflow route (`#/report/:sheetId` in `src/screens/ReportScreen.tsx` / `src/components/StudentReportView.tsx`) remains 100% untouched with its active 3-step workflow stepper, scanned answer booklet viewer, OCR overlays, and 3 full tabs (`Overview`, `Question-wise Marks`, `Analytics & Charts`).
     - Sidebar "Report Card" section (`#/reports` in `src/screens/ReportsCenterScreen.tsx`) exclusively renders the dedicated 1-page Bento Report Card (`<StudentReportCard sheetId={...} />`).
  2. Standalone 1-Page Bento Report Card Component (`src/components/StudentReportCard.tsx`):
     - Strictly formatted to fit on a single A4 page (`max-w-[1050px] mx-auto`) on screen and print.
     - Strictly Excluded: No scanned booklet canvas/images, no question text paragraphs, no student verbatim written transcripts, and no multi-page overflow.
     - Strictly Included (All on 1 Single Bento Page):
       - Header & Candidate Identity Bento Row: Deep Forest Emerald banner with Paper Title, Subject, Code, Date, `VERIFIED REPORT CARD` badge, Sheet ID, Candidate Name, Roll Number (`font-mono`), Class/Stream, and Applied Strictness (`Level X/5`).
       - Aggregate Score & Result Summary Strip: Total Marks (`{score} / {max_marks}`), Percentage (`{percentage}%`), Awarded Grade, and `PASS` / `RE-APPEAR` badge.
       - Visual Charts & Telemetry Row (2-Column Bento):
         - Left: Question-wise performance bar chart (obtained vs max marks for Q.1 to Q.N, color-coded Emerald = Full, Amber = Partial, Rose = Zero).
         - Right: Section & Topic Mastery horizontal progress bars with syllabus coverage percentages.
       - Compact Question Marks Ledger (Scores Only — No Transcripts): dense, compact grid showing `Q.No`, scored/max marks (`1.76/2`), and compact status badge (`Full`, `Part`, `0`).
       - 3-Column Verification Sign-Off Strip: `AI Rubric Audit` (Multi-Pass Alignment Verified · Officially Certified), `Course Instructor` (Department Academic Faculty · Sign-off: Approved), and `Controller of Examinations` (Office of Evaluation · Institutional Seal: Official).
       - Bottom 1-Line Grading Scale Legend.
     - Action toolbar: `Print` (`window.print()`) and `Download 1-Page PDF` (`/api/sheets/{sheet_id}/export/report-card-pdf`).
  3. Dedicated 1-Page Report Card PDF Generator (`backend/reports_generator.py` & `backend/main.py`):
     - Added `generate_one_page_bento_report_card_pdf`: builds a strict 1-page A4 PDF using ReportLab with vector bar charts (`reportlab.graphics.shapes`), section progress bars, candidate metadata grid, compact question marks table, and 3-column verification sign-offs.
     - Endpoint `GET /api/sheets/{sheet_id}/export/report-card-pdf` (and alias `/api/sheets/{sheet_id}/report-card/pdf`).
     - Updated batch reports export `POST /api/sheets/export/batch-reports` for `.zip` and merged `.pdf` to use the 1-page bento report card generator.
  4. Integration in Sidebar Report Card (`src/screens/ReportsCenterScreen.tsx`):
     - Sequential Stepper embeds `<StudentReportCard sheetId={currentStepperStudent.id} />`.
     - Stepper header action points to `/api/sheets/{currentStepperStudent.id}/export/report-card-pdf`.
  5. Verification & Tests:
     - `npx tsc --noEmit`: 0 errors.
     - `python scripts/check_all.py`: `RESULT: ALL PASS` (banned strings, no sensitive files, pytest, tsc, and live AI provider health).
     - PyMuPDF assertion verified: `assert len(doc) == 1` for single-sheet export and `assert len(doc) == len(sheet_ids)` for merged batch export.
     - Playwright browser test (`scripts/verify_bento_report.py`): verified single-page bento rendering in light mode and dark mode with zero booklet preview and zero transcripts, verified post-evaluation route intact with booklet preview and tabs.
     - Captured evidence screenshots:
       - `docs/proof/ui/screenshots/proof_bento_report_card_light.png`
       - `docs/proof/ui/screenshots/proof_bento_report_card_dark.png`
       - `docs/proof/ui/screenshots/proof_report_post_evaluation_intact.png`
- Multi-Student & Whole-Class Search, Sequential Stepper, Side-by-Side Comparison, and Dashboard Leaderboard (`src/screens/ReportsCenterScreen.tsx`, `src/components/StudentReportView.tsx`, `src/screens/DashboardScreen.tsx`, `backend/main.py`, `verify_evaldesk_features.py`):
  1. Hide Scanned Answer Sheet in Report Card (`#/reports`) Only:
     - `src/components/StudentReportView.tsx`: added `hideAnswerSheet?: boolean` prop.
     - When `hideAnswerSheet={true}` (in `ReportsCenterScreen.tsx`), completely hides the left-side scanned answer booklet preview (`ReportBookletPreview`) and draggable divider handle, expanding the digital student report (`Overview` score summary, `Question-wise Marks`, and `Analytics & Charts`) to 100% full width.
     - Post-evaluation workflow route (`#/report/:sheetId` in `ReportScreen.tsx`) remains completely unchanged (`hideAnswerSheet={false}`), preserving the active 3-step stepper header and the scanned answer booklet viewer side-by-side with the evaluation report.
  2. Multi-Student & Whole-Class Search + One-by-One Report Stepper (`src/screens/ReportsCenterScreen.tsx`):
     - Filter & Multi-Search Bar:
       - Exam / Subject dropdown (`GET /api/papers`, including "All Exams").
       - Class / Stream dropdown dynamically extracted from evaluated sheets (`GET /api/sheets/history`, including "All Classes / Streams").
       - Multi-Student Search supporting comma-separated candidate terms (e.g., searching for multiple students simultaneously).
     - Multi-Select Directory Table/Cards:
       - Candidate cards with individual checkboxes and a master `Select All Matching (N)` toggle.
       - Candidate cards display Student Name, Roll Number (`font-mono`), Class/Stream, Exam/Subject, Total Score (`X / Max`), Percentage, Grade badge, and `View Report Card` button.
       - Top action bar appears when 1 or more candidates are checked, providing:
         - `View Report Cards (N) One-by-One →` (opens sequential stepper view).
         - `Compare Selected (N)` (enabled for 2 to 10 selected candidates).
         - `Download Bulk Reports` action menu with:
           - All Selected PDFs (.zip) via `POST /api/sheets/export/batch-reports` (`{ sheet_ids, format: 'zip' }`).
           - Merged Multi-Page PDF via `POST /api/sheets/export/batch-reports` (`{ sheet_ids, format: 'pdf' }`).
           - Consolidated Class Results (.xlsx) via `POST /api/sheets/export/consolidated` (`{ sheet_ids, format: 'xlsx' }`).
           - Consolidated Class Marksheet (.pdf) via `POST /api/sheets/export/consolidated` (`{ sheet_ids, format: 'pdf' }`).
     - One-by-One Report Card Stepper View:
       - Top navigation bar featuring `← Back to Selection`, `← Previous` and `Next →` buttons, and candidate label `Student X of Y: Student Name (Roll)`.
       - Horizontally scrollable quick-jump candidate pills to switch directly to any selected student with active emerald highlighting.
       - Quick download buttons: `Download This PDF` and `Download All (N) Reports`.
       - Embeds full-width clean digital report card (`<StudentReportView sheetId={current.id} hideAnswerSheet={true} />`).
  3. Side-by-Side Student Comparison View (`src/screens/ReportsCenterScreen.tsx`, `backend/main.py`):
     - Activated when 2 to 10 students are selected via `Compare Selected (N)`.
     - Backend endpoint `POST /api/sheets/compare` calculates candidate summaries, ranking, question metadata, and question-by-question marks matrix.
     - Header with `← Back to Selection` and `Export Comparison (.xlsx)` button.
     - Visual Score Comparison Bar Chart: Recharts `ResponsiveContainer`, `BarChart`, `Bar`, `XAxis`, `YAxis`, and `Tooltip` comparing score percentages across the selected cohort.
     - Comparison Matrix Table: candidate columns comparing Total Marks, Percentage, Grade, Class/Stream, Rank in Selection, and question-by-question breakdown, highlighting the top scorer per row in soft emerald (`#E8F3EE` / `dark:bg-[#1A2B23]`) with bold emerald text.
  4. Cross-Subject & Cross-Stream Toppers Leaderboard on Dashboard (`src/screens/DashboardScreen.tsx`, `backend/main.py`):
     - Backend endpoint `GET /api/dashboard/leaderboard` with optional `?subject=` and `?class_name=` query filters.
     - Bento card placed on Dashboard between analytics graphs and recent sheets table.
     - Trophy icon header "Top Performers Leaderboard" with subtext "Cross-subject & cross-stream academic excellence".
     - Stream / Class and Subject filter dropdowns for localized rankings.
     - Rank badges with `#1`, `#2`, `#3` highlighted in emerald badge (`bg-[#0F5132]` / `bg-[#E8F3EE]`), student name, roll number in `font-mono`, class pill, subject pill, total score, percentage in `font-mono`, and grade badge.
     - Clicking a student row navigates directly to `#/reports?sheetId={sheet_id}` to open their digital marksheet.
     - Empty state for zero evaluated submissions under filter combination.
  5. Verification & Tests:
     - `npx tsc --noEmit`: 0 errors.
     - `python scripts/check_all.py`: `RESULT: ALL PASS` (banned strings, no sensitive files, pytest, tsc, and live AI provider health).
     - Playwright browser test (`verify_evaldesk_features.py`): verified all 6 sections (Dashboard Leaderboard, Report Card Search Directory, Multi-Select Checkboxes, Side-by-Side Comparison with Recharts chart and matrix, One-by-One Stepper with hidden answer sheet, and Post-Evaluation direct route with intact answer booklet).
     - Captured evidence screenshots:
       - `docs/proof/ui/screenshots/proof_dashboard_leaderboard.png`
       - `docs/proof/ui/screenshots/proof_report_card_directory.png`
       - `docs/proof/ui/screenshots/proof_report_card_multi_select.png`
       - `docs/proof/ui/screenshots/proof_report_card_compare_view.png`
       - `docs/proof/ui/screenshots/proof_report_card_stepper_view.png`
       - `docs/proof/ui/screenshots/proof_report_post_evaluation_intact.png`
- Restored & Frozen Exact Original Evaluation Report UI with Dual-Placement and Search-First Selector (`src/components/StudentReportView.tsx`, `src/screens/ReportsCenterScreen.tsx`, `src/screens/ReportScreen.tsx`, `scripts/verify_report_card_search.py`):
  1. Recovered and Frozen Report Component (`src/components/StudentReportView.tsx`):
     - Restored the exact original report component from Git history (`8776ebb`), keeping layout, tabs, charts, colors, and markup 100% identical.
     - Preserves all 3 core tabs: `Overview` (answer booklet preview + score summary, KPIs, distribution chart, and section performance), `Question-wise Marks` (OCR comparison and collapsible feedback), and `Analytics & Charts`.
     - Preserves all 3 deep telemetry sections in `ReportAnalyticsTab`: `1. Question & Section Marks Telemetry`, `2. Teacher Deductions & Error Taxonomy`, and `3. Question Format & Attempt Performance`.
     - Preserves the locked bottom bar with `Download Excel (.xlsx)` and `Download PDF Report`.
     - Standardized acceptance of `sheetId` prop with zero mutations to the core layout, and auto-resets question index & booklet page to 0 and 1 on student switch.
  2. Search-First Wrapper in Sidebar "Report Card" (`src/screens/ReportsCenterScreen.tsx`):
     - Structured into two clean, mutually exclusive states:
       - **State 1 (`selectedSheetId === null`) — Search Only (Initial State):**
         - Clean **Search Student Report Card** card with total evaluated count pill.
         - Search input (`placeholder="Search by student name, roll number, or exam..."`) filtering evaluated candidate records dynamically from `GET /api/sheets/history`.
         - Optional `Exam / Subject` dropdown filter populated from `GET /api/papers`.
         - Clickable candidate list/grid showing **Student Name**, **Roll Number**, **Exam & Subject**, **Total Score** (`{score} / {max_marks} ({percentage}%)`), semantic grade badges, and **`View Report Card →`** button.
         - Empty states for zero evaluated sheets and unmatched search queries.
       - **State 2 (`selectedSheetId !== null`) — Exact Restored Report UI:**
         - Renders a compact top bar with **`← Search Another Student`** button (clicking sets `selectedSheetId = null` to return to search).
         - Directly below the top bar, embeds the **exact restored previous Report component** (`<StudentReportView sheetId={selectedSheetId} />`) with all tabs, booklet preview, and `Download Excel (.xlsx)` / `Download PDF Report` buttons intact.
  3. Direct Route & Workflow Stepper Intact:
     - Route `#/report/:sheetId` (Step 3 after Evaluate in `src/screens/ReportScreen.tsx`) renders the exact same restored previous Report component beneath the active `1. Upload → 2. Evaluate → 3. Report (ACTIVE)` stepper header.
     - Sidebar Dark Mode / Light Mode toggle and Guide (`#/guide`) route remain completely intact.
  4. Verification:
     - `npx tsc --noEmit`: 0 errors.
     - `python scripts/check_all.py`: `RESULT: ALL PASS` (banned strings, no sensitive files, pytest, tsc, and live AI provider health).
     - Playwright browser test (`scripts/verify_report_card_search.py`): verified search-first initial state on `#/reports`, live filtering, opening student report card with `View Report Card`, tab navigation (`Overview`, `Question-wise Marks`, `Analytics & Charts` with Sections 1, 2, 3 verified), `← Search Another Student` navigation, and direct route `#/report/:sheetId`. Screenshots captured in `docs/proof/ui/screenshots/`.
- Report Card Renaming, Live Student Search & Global Dark/Light Mode Toggle Integration (`src/components/AppSidebar.tsx`, `src/App.tsx`, `src/state/useSheetStore.ts`, `src/screens/ReportsCenterScreen.tsx`, `src/components/StudentReportView.tsx`, `src/screens/HomeScreen.tsx`, `src/index.css`):
  1. Navigation Renamed to "Report Card":
     - In `src/components/AppSidebar.tsx`, renamed navigation item to `"Report Card"` (linking to `#/reports`).
     - Added URL route aliasing in `src/App.tsx` and `src/state/useSheetStore.ts`: `#/report-card` automatically maps to the Report Card section (`reports` step).
     - Strict sidebar active state separation:
       - **Evaluate Sheets** (`#/upload`) is active on `#/upload`, `#/evaluate/:sheetId`, and `#/report/:sheetId` (Step 3 of evaluation).
       - **Report Card** (`#/reports`) highlights exclusively on `#/reports` and `#/report-card`.
  2. Student Search + View & Download Report Card (`src/screens/ReportsCenterScreen.tsx`):
     - Pure single-student report view with zero duplicate stepper bars or stacked report sections.
     - Compact top search and filter bar:
       - Live search input (`placeholder="Search student by name or roll number..."`) with instant clear (`✕`) button, filtering candidate records from `GET /api/sheets/history`.
       - `Exam / Subject` filter dropdown populated dynamically from `GET /api/papers` with `"All Exams"`.
       - Clickable student dropdown selector + horizontally scrollable quick-select student result pills (`{student_name} · {roll_number} · {score}/{max_marks} ({grade})`).
       - Primary action CTAs: **`Download Report Card PDF`** (`GET /api/sheets/{selectedSheetId}/export/pdf`), **`Print Report Card`** (`window.print()`), and optional **`Export Class Excel (.xlsx)`** (`GET /api/papers/{paperId}/export/excel`).
     - Directly embeds `<StudentReportView sheetId={selectedSheetId} />` below the filter bar for immediate preview and interaction.
     - Clean empty state with `"+ Evaluate Answer Sheets"` when SQLite contains 0 evaluated sheets.
  3. Dark Mode Toggle in Sidebar and Navbar:
     - **Sidebar (`src/components/AppSidebar.tsx`):** Added a crisp `Sun` / `Moon` toggle button with `"Dark Mode"` / `"Light Mode"` label in `w-64` mode, collapsing cleanly to an icon button in `w-20` mode.
     - **Home Navbar (`src/screens/HomeScreen.tsx`):** Added matching `Sun` / `Moon` icon toggle button next to Login and Sign Up.
     - Class-based theme toggle adds/removes `.dark` on `document.documentElement`, persisted in `localStorage` (`evaldesk_theme`), with smooth cross-tab sync.
     - Consistent matte graphite palette across all screens (`#F6F7F5` / `#111312`, `#181B19`, `#202422`, `#0F5132` / `#1F6E4A`), with `@media print` white paper override (`#FFFFFF` background, `#111827` ink, `#E2E8E4` borders).
  4. Verification:
     - `npx tsc --noEmit`: 0 errors.
     - `python scripts/check_all.py`: `RESULT: ALL PASS`.
     - Automated Playwright browser verification: verified sidebar label "Report Card", route navigation, `#/report-card` alias, student live search, report card download button, and navbar/sidebar theme toggle switching and persistence across page reloads.
- Restored Previous Student Report Layout Across Both Report Sections (`src/components/StudentReportView.tsx`, `src/screens/ReportScreen.tsx`, `src/screens/ReportsCenterScreen.tsx`, `src/App.tsx`, `src/components/AppSidebar.tsx`, `src/components/report/ReportAnalyticsTab.tsx`, `src/components/report/ReportBookletPreview.tsx`, `src/components/report/ReportBottomBar.tsx`, `src/components/report/ReportOverviewTab.tsx`, `src/components/report/ReportQuestionTab.tsx`, `src/components/report/ReportTopBar.tsx`):
  1. Shared Student Report Component (`src/components/StudentReportView.tsx`):
     - Restored the full two-pane resizable report view from git history: Answer Booklet preview on left (`ReportBookletPreview`), draggable col-resize divider (persisted split ratio in `evaldesk_report_split_ratio`), and tabbed panel on right.
     - 3 interactive tabs: Overview (`ReportOverviewTab` with KPIs, diagnostic feedback, score distribution chart, and section table), Question-wise Marks (`ReportQuestionTab` with answer comparison and rubric details), and Analytics (`ReportAnalyticsTab` with Pareto analysis, error breakdown, and mastery donut charts).
     - Full live SQLite integration via `GET /api/sheets/{sheetId}/report`, `GET /api/sheets/{sheetId}/review`, `GET /api/papers/{paperId}/sheets`, and `GET /api/papers/{paperId}/reports`.
     - Standardized with matte graphite dark mode tokens (`bg-[#F6F7F5] dark:bg-[#111312]`, cards `bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C]`, muted tiles `bg-[#F1F4F2] dark:bg-[#202422]`, active pills `bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3]`).
  2. Integration in Both Report Routes:
     - Evaluation Workflow Step 3 (`#/report/:sheetId` -> `src/screens/ReportScreen.tsx`): Top workflow bar with `← Back to Evaluation`, paper/student breadcrumbs, and active `1. Upload → 2. Evaluate → 3. Report (ACTIVE)` stepper, rendering `<StudentReportView sheetId={sheetId} />` directly below.
     - Sidebar Reports Section (`#/reports` -> `src/screens/ReportsCenterScreen.tsx`): Top control bar with Exam/Paper filter (`GET /api/papers`), Select Student dropdown (`GET /api/sheets/history`, defaulting to latest evaluated student), `Download Student Marksheet PDF` (`GET /api/sheets/{selectedSheetId}/export/pdf`), and `Export Class Excel (.xlsx)` (`GET /api/papers/{paperId}/export/excel`). Directly renders `<StudentReportView sheetId={selectedSheetId} />` below. If 0 evaluated sheets exist, shows clean empty-state card with `+ Evaluate Answer Sheets` linking to `#/upload`.
  3. Sidebar Active State (`src/components/AppSidebar.tsx`):
     - Highlight `Evaluate Sheets` (`#/upload`) on `#/upload`, `#/evaluate/:sheetId`, and `#/report/:sheetId`.
     - Highlight `Reports` (`#/reports`) on `#/reports`.
  4. Cleanup:
     - Removed `src/components/BentoMarksheetView.tsx` and `src/screens/StudentMarksheetScreen.tsx`.
  5. Verification:
     - `npx tsc --noEmit`: 0 errors.
     - `python scripts/check_all.py`: `RESULT: ALL PASS`.
     - Playwright browser test verifying `#/report/:sheetId` and `#/reports` in light and dark mode with full tab navigation.
- Editorial Non-Flashy Dark Mode Across EvalDesk (`src/context/ThemeContext.tsx`, `index.html`, `src/index.css`, `src/components/AppSidebar.tsx`, `src/screens/HomeScreen.tsx`, `src/screens/GuideScreen.tsx`, `src/screens/DashboardScreen.tsx`, `src/screens/UploadScreen.tsx`, `src/screens/EvaluateScreen.tsx`, `src/screens/HistoryScreen.tsx`, `src/screens/ReportsCenterScreen.tsx`, `src/screens/StudentMarksheetScreen.tsx`, `src/components/BentoMarksheetView.tsx`, `src/components/QuestionPanel.tsx`, `src/components/MarksCard.tsx`, `src/components/OcrCard.tsx`, `src/components/ReferenceCard.tsx`, `src/components/SheetImageViewer.tsx`, `src/components/StrictnessChip.tsx`, `src/components/StrictnessPicker.tsx`, `src/components/PaperDetailsForm.tsx`, `src/components/QueueRow.tsx`, `src/components/AnnotationToolbar.tsx`):
  1. Anti-AI-Slop & Editorial Matte Graphite Tokens:
     - 100% adherence to zero-AI-slop visual rules: NO glowing box-shadows, neon borders, radial gradient meshes, aurora backgrounds, or floating blurs. All workspace cards and panels are solid, opaque, and matte (`shadow-none dark:shadow-none`).
     - App Canvas: `bg-[#F6F7F5] dark:bg-[#111312]`.
     - Bento Cards, Sidebar, Modals & Panels: `bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C]`.
     - Muted Inner Tiles, Table Headers & Inputs: `bg-[#F1F4F2] dark:bg-[#202422] border-[#E2E8E4] dark:border-[#2F3532] text-[#111827] dark:text-[#ECEEED]`.
     - Primary CTAs: `bg-[#0F5132] hover:bg-[#0B3D26] dark:bg-[#1F6E4A] dark:hover:bg-[#27855A] text-white font-semibold`.
     - Active Sidebar & Tab Pills: `bg-[#E8F3EE] text-[#0F5132] dark:bg-[#1A2B23] dark:text-[#7CC9A3] dark:border dark:border-[#294236]`.
     - Typography: Headings/scores `text-[#111827] dark:text-[#ECEEED]`, descriptions `text-[#4B5563] dark:text-[#969E9A]`, muted timestamps `text-[#6B7280] dark:text-[#68706C]`.
     - Semantic Badges (Low-Glare):
       - Full Marks / Verified: `dark:bg-[#1A2B23] dark:text-[#7CC9A3] dark:border-[#294236]`.
       - Partial / Review: `dark:bg-[#2B2416] dark:text-[#E5B567] dark:border-[#42361F]`.
       - Deduction / Fail: `dark:bg-[#2B191D] dark:text-[#E57D8A] dark:border-[#45262C]`.
     - Charts & Progress Rings: Solid `#2D8A61` (forest sage) and `#3A7D8C` (muted slate-teal) with `#2A2F2C` track strokes.
  2. Theme Provider & Persistence:
     - Implemented `ThemeContext.tsx` with `Theme` ('light' | 'dark'), `evaldesk_theme` `localStorage` persistence, DOM `.dark` class management, cross-tab `storage` synchronization, and `useTheme()` hook.
     - Pre-hydration inline script in `<head>` of `index.html` executes synchronously before HTML rendering to prevent white flash of un-themed content.
     - Tailwind v4 `@custom-variant dark (&:where(.dark, .dark *));` configured in `src/index.css`.
  3. Navigation & Screen Integration:
     - `src/components/AppSidebar.tsx`: Added subtle theme toggle row above backend health pill (full label in `w-64`, icon in `w-20`).
     - `src/screens/HomeScreen.tsx`: Added theme toggle button to top navigation bar; converted device mockups and feature cards to matte graphite `#111312` / `#181B19` surfaces.
     - `src/screens/GuideScreen.tsx`: Added first-class documentation screen at `#/guide` for 10-point scale, strictness calibration matrix, and shortcuts cheat sheet.
     - `src/screens/DashboardScreen.tsx`, `UploadScreen.tsx`, `EvaluateScreen.tsx`, `HistoryScreen.tsx`, `ReportsCenterScreen.tsx`, `StudentMarksheetScreen.tsx`: Fully converted with matte graphite tokens.
  4. Print Mode Safeguard:
     - `@media print` rules in `src/index.css` force pure white paper background (`#FFFFFF`), dark ink (`#111827`), and hairline borders (`#E2E8E4`) even when dark mode is enabled on screen.
  5. Verification & Tests Passed 100%:
     - `npx tsc --noEmit`: 0 errors.
     - `python scripts/check_all.py`: `RESULT: ALL PASS` (banned strings, git secrets, pytest, tsc, and live provider health).
     - Automated Playwright browser verification (`C:/Users/lenovo/.../verify_dark_mode.py` and `verify_evaluate.py`): verified `#/`, `#/dashboard`, `#/upload`, `#/history`, `#/reports`, `#/guide`, `#/evaluate` with `.dark: True`, `badBackdrop: False`, and verified print styles (`bodyBg: rgb(255, 255, 255)`, `bodyColor: rgb(17, 24, 39)`).
- Bento Marksheet & Reports Center Integration (`src/components/BentoMarksheetView.tsx`, `src/screens/ReportsCenterScreen.tsx`, `src/screens/StudentMarksheetScreen.tsx`, `src/components/AppSidebar.tsx`, `src/index.css`, `scripts/verify_bento_reports.py`):
  1. Bento Student Marksheet Component (`src/components/BentoMarksheetView.tsx`):
     - Ported the 12-column Bento Marksheet design from `.stitch_ref/code.html` into a fully dynamic React + TypeScript component.
     - Strict Zero-Hardcoding Contract: 100% of candidate details, exam metadata, question scores, rubric remarks, bar chart bars, section mastery, letter grades, and strictness levels fetched from SQLite (`GET /api/sheets/{sheet_id}/report`).
     - Front Side (12-Column Bento Layout):
       - Hero Header Tile: Institution/Exam title, `OFFICIAL STATEMENT OF MARKS & RUBRIC AUDIT`, Subject & Code, `VERIFIED DIGITAL CREDENTIAL` mint pill badge, Sheet ID, and evaluation timestamp.
       - 3-Tile Candidate & Score Strip: Candidate Identity (`student_name`, `roll_number` in JetBrains Mono, `class_name`), Aggregate Score (`#0F5132` SVG circular progress ring, score / max marks, percentage, Grade Point, Letter Grade, `PASS`/`FAIL` pill), and Stacked Micro-KPIs (`OCR Legibility: {ocr_confidence}%` + `Strictness Applied: Level {strictness} / 5`).
       - Visual Analytics Row: Question-Wise Marks Bar Chart (vertical rounded bars with 40% threshold line) + Curriculum Competency Mastery bars.
       - Itemized Statement of Marks & Rubric Audit Table: Q.No, Question text, Subtotal marks, Rubric evaluation remarks, and Status pill (`Full Marks`, `Partial Marks`, `Zero Marks`), concluding with an `#E8F3EE` Grand Total summary bar.
       - 3-Tile Official Sign-Off Row: AI Rubric Audit hash, Course Instructor sign-off, Controller of Examinations seal, and `Flip to Back: Grading & Strictness ↻` button.
     - Back Side (12-Column Bento Layout):
       - Header Tile: `Institutional Grading Scale & Strictness Calibration` with `Return to Front Marksheet ↺` button.
       - 10-Point Academic Grading System Table (Grades `O` down to `F`), dynamically highlighting the candidate's achieved letter grade with `Candidate's Achieved Grade` badge.
       - 1–5 Strictness Calibration Matrix (Levels 1–5), dynamically highlighting `sheet.strictness` with `Applied to This Sheet` badge.
     - Two-Phase 3D Card Flip:
       - Smooth, jitter-free two-phase animation (`flipPhase: 'idle' | 'out' | 'in'`). Phase 1 rotates 0° -> 90° (`animate-flip-out`, 200ms ease-in), switches side, Phase 2 rotates -90° -> 0° (`animate-flip-in`, 240ms ease-out). Zero text mirroring or layer bleed-through.
     - Print Optimization: In `@media print`, both Front Sheet (`print-front-sheet`) and Back Sheet (`print-back-sheet`) render sequentially on separate pages with zero sidebar interference.
  2. Reports Center Screen (`src/screens/ReportsCenterScreen.tsx` at `#/reports`):
     - Top Student & Class Control Bar (`bg-white border border-[#E2E8E4] rounded-[20px] p-4 md:p-5 shadow-xs`):
       - Paper / Exam Filter dropdown (All Exams or specific paper).
       - Candidate search input (filter by student name or roll number).
       - Specific Student Selector dropdown + horizontally scrollable Quick-Select Student Pills (`{student_name} · {roll_number} · {score}/{max_marks} · {grade}`) with active `#0F5132` / `#E8F3EE` styling. Default to the most recently evaluated student (or `?sheetId=...` query param).
       - Action & Download buttons: `Download Student Marksheet PDF` (primary `#0F5132` Emerald button -> `GET /api/sheets/{selectedSheetId}/export/pdf` with filename `Marksheet_{roll_number}_{subject}.pdf`), `Export Class Excel (.xlsx)` (`GET /api/papers/{paperId}/export/excel`), and `Export Class PDF (.pdf)` (`GET /api/papers/{paperId}/export/pdf`).
     - Embedded Bento Marksheet View: Renders `<BentoMarksheetView sheetId={selectedSheetId} />` directly below the control bar for instant inspection and interaction.
     - Clean Empty State: When SQLite has 0 evaluated sheets, renders a clean empty-state card with a `+ Evaluate Answer Sheets` button linking to `#/upload`.
  3. Student Marksheet Screen (`src/screens/StudentMarksheetScreen.tsx` at `#/report/:sheetId`):
     - Refactored into a concise wrapper that passes `sheetId` from URL route/store and provides an `onBack` handler to return to evaluation workspace or history.
  4. App Sidebar Active Link (`src/components/AppSidebar.tsx`):
     - Configured `Reports` navigation item to highlight with Emerald/Mint pill (`bg-[#E8F3EE] text-[#0F5132] font-semibold`) whenever the route is `#/reports` OR `#/report/:sheetId`.
  5. Cleanup & Verification:
     - Deleted temporary `.stitch_ref/` reference folder.
     - Ran `cmd /c "npx tsc --noEmit"`: 0 errors.
     - Ran `python scripts/check_all.py`: `RESULT: ALL PASS` (banned strings, git secrets, pytest, tsc, and live provider health).
     - Ran `python scripts/verify_bento_reports.py`: verified control bar, candidate pills, hero title, score percentage, 3D flip to back side, achieved grade badge, strictness badge, flip back to front, direct `#/report/:sheetId` rendering, and `@media print` layout styles.
- Browser Print Layout Optimization & Backend Bento Report Card PDF Generator (`src/components/AppSidebar.tsx`, `src/App.tsx`, `src/index.css`, `src/screens/StudentMarksheetScreen.tsx`, `backend/reports_generator.py`, `backend/main.py`, `scripts/verify_print_and_pdf.py`):
  1. Browser Print Layout Fixes & Multi-Page Sheet Unlocking:
     - `src/components/AppSidebar.tsx`: Added `print:hidden` to `<aside>` element so application navigation never appears on printed marksheets.
     - `src/App.tsx`: Added `app-shell` and `app-main` CSS classes and `print:hidden` to top workflow header and bottom action bar.
     - `src/index.css`: Added explicit `@media print` rules:
       - Configured `@page { size: A4 portrait; margin: 10mm; }`.
       - Unlocked `html, body, #root`, `.app-shell`, and `.app-main` with `height: auto !important; overflow: visible !important;` so multi-page student reports never clip after Page 1.
       - Enabled print color fidelity with `-webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;`.
       - Removed 3D rotation transform distortions in print via `[style*="rotateY"] { transform: none !important; }`.
       - Forced `aside, header, .print\:hidden { display: none !important; }`.
       - Handled page breaks: `.print-front-sheet { break-after: page; page-break-after: always; }` and `.print-back-sheet { display: block !important; break-inside: avoid; }`.
     - `src/screens/StudentMarksheetScreen.tsx`:
       - Rendered both Front Sheet (`print-front-sheet`) and Back Sheet (`print-back-sheet`) sequentially in print view while preserving interactive 3D card-flip rotation (`F`) on screen.
       - Configured explicit pixel height `h-36` (with `h-28` bar tracks) on Question Marks Distribution bar chart so bars render at full height in print preview.
  2. Redesigned Backend Report Card PDF (`backend/reports_generator.py` & `backend/main.py`):
     - Overhauled `generate_student_report_card_pdf()` with Porcelain (`#F6F7F5`) & Deep Forest Emerald (`#0F5132`) Bento Report Card styling:
       - Color Palette: Warm Porcelain canvas `#F6F7F5`, Card surfaces `#FFFFFF`, Card borders `#E2E8E4` (`ROUNDEDCORNERS: [8, 8, 8, 8]`), Primary Emerald `#0F5132` with Soft Mint `#E8F3EE` tint panels, Teal `#0D9488`, Amber `#D97706` (`#FEF3C7` bg), Rose `#E11D48` (`#FFE4E6` bg), Ink `#111827` headings, Muted `#4B5563` body.
       - Page 1 — Executive Bento Summary & Section Breakdown:
         - Header Bento Banner with 4pt `#0F5132` left accent stripe, `EVALDESK AI · OFFICIAL EVALUATION REPORT CARD`, bold assessment title, subject, subject code, exam name, date, sheet ID, and `✔ VERIFIED CREDENTIAL` mint pill badge.
         - 4-Tile Bento KPI Row: Candidate Identity (Name, Roll, Class), Aggregate Score (`{score} / {max_marks} ({pct}%)` + `Grade {grade} · PASS` mint badge), OCR Legibility (`{ocr_confidence}% Dual-Engine Verified`), Evaluation Strictness (`Level {strictness} / 5 ({strictness_title})`).
         - Section & Topic Mastery Bento Card: Vector horizontal Emerald progress bars (`make_pdf_progress_bar`) for each exam section showing earned/max marks and percentage.
         - Key Strengths (`#E8F3EE` card) & Areas for Improvement (`#FEF3C7` card) 2-column row.
       - Question-by-Question Bento Cards with Cropped Handwriting Screenshots:
         - Subtle `#E8F3EE` section header bars (`{section_name} · Subtotal: X / Y Marks`) with `KeepTogether` preventing split cards across page breaks.
         - Top row: Bold `Q.{num}` + Question text on left; status pill (`[Full Marks]`, `[Partial Marks]`, `[0 Marks]`, `[Excluded]`) + `Marks: {awarded} / {max}` on right.
         - Body 2-Column Split (~38% Image / ~62% Text):
           - Left (~38%): Student handwriting cropped region in clean `#F6F7F5` box (`max-height: 85pt`, aspect-ratio preserved via PIL/ReportLab `create_scaled_image()`) or `Full-page scan reference` fallback.
           - Right (~62%): Verbatim Transcript in `#F1F4F2` rounded box (8.5pt text), Verified Evidence quote (teal `#0D9488`), and Evaluation Feedback explaining marks and deductions.
       - Final Page — Institutional Grading Scale, AI Strictness Calibration & Sign-Off:
         - Left: 10-Point UGC Academic Grade Scale (`O`, `A+`, `A`, `B+`, `B`, `C`, `D`, `F`) dynamically highlighting candidate's achieved grade in `#E8F3EE` with `#0F5132` left border.
         - Right: 1–5 Strictness Calibration Scale dynamically highlighting applied level with `Applied to This Sheet` badge.
         - Bottom: 3-column formal signature footer (`AI Rubric Verification Engine` with multi-pass audit hash, `Course Instructor / Evaluator`, `Controller of Examinations`).
     - `backend/main.py`: Connected `get_sheet_report_endpoint` and paper reports generator to pass `class_name`, `subject`, `exam_name`, `subject_code`, `strictness`, `ocr_confidence`, and `sheet_id`.
  3. Quality & Verification Gates Passed 100%:
     - `scripts/verify_print_and_pdf.py`:
       - Backend PDF export (`GET /api/sheets/{sheet_id}/export/pdf`): 436KB 4-page PDF verified with PyMuPDF (`fitz`), confirming all headers, KPI tiles, section bars, handwriting images, grading scale, strictness matrix, and signatures.
       - Playwright print emulation (`page.emulate_media(media="print")`): verified sidebar `display: none`, header toolbar `display: none`, Front Sheet `display: block`, Back Sheet `display: block`, body overflow `visible`, and generated 5-page browser print PDF (544KB) without clipping.
     - `cmd /c "npx tsc --noEmit"`: 0 errors.
     - `python scripts/check_all.py`: `RESULT: ALL PASS` (banned strings, git secrets, pytest, tsc, and live provider health).
     - `python scripts/verify_all_routes.py`: ALL 6 ROUTES VERIFIED SUCCESSFULLY WITH ZERO RUNTIME ERRORS.
- Global Academic Design System & Palette Application (`src/index.css`, `src/App.tsx`, `src/components/AppSidebar.tsx`, `src/screens/StudentMarksheetScreen.tsx`, `src/screens/DashboardScreen.tsx`, `src/screens/HistoryScreen.tsx`, `src/screens/ReportsCenterScreen.tsx`, `src/screens/HomeScreen.tsx`, `src/screens/UploadScreen.tsx`, `src/screens/EvaluateScreen.tsx`, `docs/proof/ui/routes/`):
  1. Complete Color Palette Migration (Zero Legacy Indigo/Purple):
     - Eliminated all legacy `#3525cd`, `#4F46E5`, `indigo-*`, `purple-*` classes app-wide.
     - Implemented calm academic palette:
       - App Canvas (`--bg-canvas`): `#F6F7F5` (warm porcelain)
       - Card / Bento Surface (`--surface-card`): `#FFFFFF` with `1px solid #E2E8E4` border, `rounded-[20px]`, and subtle elevation `0 4px 16px rgba(17, 24, 39, 0.04)`
       - Muted Inner Surface (`--surface-muted`): `#F1F4F2` (sub-tiles, table headers, input fills)
       - Primary Brand (`--brand-primary`): Deep Forest Emerald `#0F5132` (hover `#0B3D26`) with `#E8F3EE` soft mint tint for active sidebar pills, verified badges, and progress rings
       - Secondary Data Accent (`--accent-teal`): `#0D9488` (secondary chart bars, OCR legibility indicators)
       - Semantic Status: Amber `#D97706` (`#FEF3C7` bg) for partial marks/review flags; Rose `#E11D48` (`#FFE4E6` bg) for deductions/fail
     - Typography: Loaded `Plus Jakarta Sans` for headings and body + `JetBrains Mono` for roll numbers, marks, and percentages.
  2. Collapsible Sidebar & Navigation Architecture (`src/components/AppSidebar.tsx` & `src/App.tsx`):
     - Collapsible sidebar (`w-64` expanded -> `w-20` collapsed), with state persisted in `localStorage` key `evaldesk_sidebar_collapsed`.
     - Brand header with Emerald emblem `#0F5132` + `⌘K` quick search input for instant paper filtering.
     - 4 core navigation items: Dashboard (`#/dashboard`), Evaluate Sheets (`#/upload`), History (`#/history`), Reports (`#/reports`).
     - Dynamic Recent Papers list fetched from `GET /api/papers` and live backend health indicator from `GET /api/health`.
  3. 2-Sided Bento Student Marksheet Screen (`src/screens/StudentMarksheetScreen.tsx`):
     - Full zero-bleed 3D page flip rotation (`Front · Bento Marksheet` <-> `Back · Grading & Strictness Key`, shortcut `F`): animates `rotateY(0deg -> 90deg)` in 220ms, swaps active side at edge-on 90deg, and animates `rotateY(-90deg -> 0deg)` in 260ms without visual bleeding.
     - Front Bento Grid (`grid-cols-12 gap-4`): Institutional & Exam Header tile, Candidate Identity tile, Aggregate Score & Circular Emerald ring tile, OCR Legibility + Strictness mini-tiles, Marks Distribution bar chart, Topic Mastery horizontal bars, Itemized Question Evaluation ledger with Grand Total footer in `#E8F3EE`, and 3-column signature row.
     - Back Bento Grid: 10-Point Institutional Grading Scale (`O` to `F`) dynamically highlighting the candidate's achieved grade in `#E8F3EE` + 1–5 Strictness Calibration Matrix dynamically highlighting the sheet's active strictness with an `Applied to This Sheet` badge.
     - One-click PDF export via `GET /api/sheets/{sheet_id}/export/pdf` and `@media print` styling.
  4. Screen Upgrades & Strict Zero-Hardcoding:
     - `src/screens/HomeScreen.tsx`: Minimalist 4-item header (`Home`, `About Us`, `Login`, `Sign Up`), kinetic morph loading intro overlay with `Replay intro` button, scroll progress bar, device mockups, demo video player with clickable chapters, and all academic palette styling. Eliminated banned strings.
     - `src/screens/DashboardScreen.tsx`: Dynamic greeting + current date, 3-card top metric bento (Average Score ring, Sheets Evaluated vertical capsule bars, Question Bank & OCR Legibility teal bars), Subject-wise performance bars, Score mastery breakdown, and Recent Evaluated Results table with live search.
     - `src/screens/HistoryScreen.tsx`: Filter toolbar (Subject, Exam, Student Name, Roll No., Status pills), academic table, empty-state button (`+ Evaluate New Sheets` -> `#/upload`), and direct links to Evaluate and Marksheet.
     - `src/screens/ReportsCenterScreen.tsx`: Whole-Class result download (.xlsx & .pdf) and individual student marksheet PDF downloads with live SQLite records.
     - `src/screens/UploadScreen.tsx` & `src/screens/EvaluateScreen.tsx`: Updated to academic palette across all forms, question panels, strictness pickers, and toolbars.
  5. Mandatory Verification Gates Passed:
     - `npx tsc --noEmit` -> Clean 0 errors.
     - `python scripts/check_all.py` -> `RESULT: ALL PASS` (banned strings, git secrets, 76 pytest tests, tsc, and live health).
     - `python scripts/verify_all_routes.py` -> All routes (`#/`, `#/dashboard`, `#/upload`, `#/history`, `#/reports`, `#/evaluate/:id`, `#/report/:id`) verified with zero console errors. Proof screenshots saved to `docs/proof/ui/routes/`.
     - `python scripts/verify_marksheet_flip.py` -> 3D flip card (F) verified with zero console errors. Proof screenshots saved to `docs/proof/ui/routes/marksheet_front_bento.png` and `marksheet_back_key.png`.
- App Layout Shell, Consistent Hash Routing inside `<main>`, Inline ErrorBoundary & Screen Hardening (`src/App.tsx`, `src/state/useSheetStore.ts`, `src/screens/UploadScreen.tsx`, `src/screens/EvaluateScreen.tsx`, `src/components/PaperDetailsForm.tsx`, `src/components/QueueRow.tsx`, `scripts/verify_all_routes.py`, `docs/proof/ui/routes/`):
  1. Root Route Rendering & Viewport Shell (`src/App.tsx`):
     - Restructured `src/App.tsx` into the persistent outer layout shell `<div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans select-none">`.
     - Placed `<AppSidebar />` on the left and wrapped the main content in an inline React `ErrorBoundary`.
     - Rendered all screens inside `<main className="flex-1 min-w-0 h-screen overflow-y-auto bg-slate-50 flex flex-col">`:
       - `#/dashboard` -> `<DashboardScreen />`
       - `#/upload` (and default `#/` or empty hash) -> `<UploadScreen />`
       - `#/evaluate/:sheetId` -> `<EvaluateScreen />`
       - `#/report/:sheetId` -> `<ReportScreen />`
       - `#/history` -> `<HistoryScreen />`
       - `#/reports` -> `<ReportsCenterScreen />`
     - Retained the top 48px stepper header (`1. Upload → 2. Evaluate → 3. Sheet Report`) and live AI telemetry status indicator during the active evaluation workflow (`upload` and `evaluate`), and rendered bottom `ActionBar` for question navigation and status metrics.
  2. Inline React ErrorBoundary (`src/App.tsx`):
     - Added React class `ErrorBoundary` catching any runtime rendering exception.
     - Displays a user-friendly error card with error message, stack trace, and "Reload Evaluation Workspace" action button instead of a silent blank white screen.
     - Automatically resets its error state on `hashchange` so navigating via sidebar immediately recovers the view.
  3. Elimination of Runtime Crashes & Undefined Property Access:
     - `src/components/PaperDetailsForm.tsx`: Guarded all accesses (`meta?.title`, `meta?.subject`, `meta?.subject_code`, `meta?.exam_name`, `meta?.strictness_level`, `meta?.subject_domain`), eliminating `TypeError: Cannot read properties of undefined/null`.
     - `src/components/QueueRow.tsx`: Added `if (!sheet) return null;` safety check, guarded `flags_open ?? 0`, and passed `initialClass={sheet.class_name || ''}` to `IdentityForm`.
     - `src/screens/UploadScreen.tsx`: Guarded `data?.papers`, `details?.questions`, `details?.references`, `data?.sheets` with `Array.isArray(...)`, and guarded `sheets.some` and `sheets.filter`.
     - `src/screens/EvaluateScreen.tsx`: Guarded `papersList`, `sheetsList`, `qList`, added loading spinner state during `isLoading` instead of rendering empty state prematurely, and protected sheet/paper null accesses.
     - `src/state/useSheetStore.ts`: Defaulted initial state and empty hash (`#/` or `""`) to `'upload'`, and ensured `window.location.hash` remains in two-way sync.
  4. Comprehensive Playwright Route Verification (`scripts/verify_all_routes.py`):
     - Verified all 6 routes in headless Chromium: default `/` (redirects to upload), `#/upload`, `#/dashboard`, `#/history`, `#/reports`, `#/evaluate/:sheet_id`, and `#/report/:sheet_id`.
     - Verified `<aside>` (AppSidebar) and `<main>` with full viewport dimensions (1200x900) across all screens with zero console errors.
     - Captured 7 proof screenshots in `docs/proof/ui/routes/`.
     - `python scripts/check_all.py --no-live` passes with `RESULT: ALL PASS`. | docs/proof/ui/routes/
- Collapsible Left Navigation Sidebar, Dashboard, History, Reports Center, and Auto-Fetch (`src/components/AppSidebar.tsx`, `src/screens/DashboardScreen.tsx`, `src/screens/HistoryScreen.tsx`, `src/screens/ReportsCenterScreen.tsx`, `src/app/Shell.tsx`, `src/screens/UploadScreen.tsx`, `src/components/IdentityForm.tsx`, `src/components/QueueRow.tsx`, `backend/main.py`, `backend/db.py`, `backend/reports_generator.py`, `scripts/verify_nav_dashboard_reports.py`, `docs/proof/ui/navigation/`):
  1. Collapsible Left Side Menu (`src/components/AppSidebar.tsx` & `src/app/Shell.tsx`):
     - Persistent collapsible left navigation sidebar (`w-60` expanded vs `w-16` compact collapsed, persisted in `localStorage` key `evaldesk_sidebar_collapsed`).
     - Includes 4 primary navigation items:
       1. Dashboard (`#/dashboard`, `LayoutDashboard` icon)
       2. Evaluate Sheets (`#/upload`, `FileCheck2` icon — stays active across active evaluation workflow `#/upload`, `#/evaluate/:id`, `#/report/:id`)
       3. History (`#/history`, `History` icon)
       4. Reports (`#/reports`, `FileSpreadsheet` icon)
     - Shows compact `ED` logo + `PanelLeftOpen` expand button when collapsed, with hover tooltips and active state ring highlight.
     - Top horizontal stepper (`1. Upload → 2. Evaluate → 3. Sheet Report`) is conditionally rendered only during active evaluation workflow.
  2. Live Evaluation Dashboard (`src/screens/DashboardScreen.tsx` & `GET /api/dashboard/summary`):
     - Backend computes real-time SQLite metrics: `total_evaluated`, `needs_review_count`, `avg_score_pct`, `avg_ocr_confidence`, `total_papers`, `subject_performance`, `score_distribution` (High ≥75%, Average 50-74%, Attention <50%), `evaluation_history_trend`, and last 8 `recent_sheets`.
     - Frontend renders top header with `+ New Evaluation` CTA, 5 tabular font-mono KPI cards, 2-column responsive graphs (Subject-wise performance progress bars + Score mastery summary & daily evaluation activity), and Recent Evaluated Sheets table with direct `Evaluate` and `Report` links.
  3. Evaluation History with Teacher Filters (`src/screens/HistoryScreen.tsx` & `GET /api/sheets/history`):
     - Backend provides filtered query endpoint by `subject`, `exam`, `student_name`, `roll_no`, and `status`, returning matching evaluated sheets alongside distinct dropdown options.
     - Frontend renders Teacher Filter Toolbar (Subject dropdown, Exam dropdown, Student search with clear icon, Roll No. font-mono search, Status pills `All | Ready | Needs Review`, and Reset Filters button) and full results table with marks, percentage, grade, status chips, and action buttons.
  4. Sidebar Reports Center (`src/screens/ReportsCenterScreen.tsx` — distinct from `#/report/:sheetId`):
     - Post-evaluation single-sheet inspector remains strictly isolated at `#/report/:sheetId` (booklet preview + OCR comparison + single-sheet analytics).
     - `#/reports` provides the Batch & Student Result Download Center:
       - Header with Assessment paper selector and Class filter dropdown (`All Classes` + distinct classes) and student search.
       - One-Click Whole-Class Result Card with summary statistics (`Total Students`, `Passing Rate`, `Class Average`, `Highest Score`) and one-click export buttons:
         1. `Download Whole Class Result (.xlsx)` via `GET /api/papers/{paperId}/export/excel`
         2. `Download Whole Class Marksheet (.pdf)` via `GET /api/papers/{paperId}/export/class-pdf`
       - Consolidated Class Result Ledger Table with row-level `Download Student Result (.pdf)` via `GET /api/sheets/{sheetId}/export/pdf` and `Preview` via `#/report/{sheetId}`.
  5. Student Answer Sheet Auto-Fill & Question Paper Auto-Fetch:
     - SQLite `sheets` schema extended with `class_name TEXT DEFAULT ''` column migration (`backend/db.py`).
     - `POST /api/sheets/{id}/identity` updated to accept `class_name` and update database records.
     - `IdentityForm.tsx` and `QueueRow.tsx` updated with Class input and inline badge display.
     - Question Paper Card 1 in `UploadScreen.tsx` updated with `Auto-Fetch Exam Details` button (`Sparkles` icon) connecting to `POST /api/papers/auto-fetch-details` with animated confirmation badge.
  6. Verification & Quality Gates:
     - Automated end-to-end Playwright verification script (`scripts/verify_nav_dashboard_reports.py`) passed all backend endpoints and UI flows.
     - Captured 7 proof screenshots in `docs/proof/ui/navigation/`.
     - `python scripts/check_all.py --no-live` passes with `RESULT: ALL PASS` (banned strings, git secrets, pytest, tsc --noEmit).
- UI Layout & Text-Wrapping Hardening (`src/components/QuestionPanel.tsx`, `src/components/report/ReportQuestionTab.tsx`, `src/components/report/ReportAnalyticsTab.tsx`, `scripts/verify_ui_fixes.py`, `docs/proof/ui/fixes/`):
  1. Clean Compact Icon Rail When Question Panel Is Collapsed (`src/components/QuestionPanel.tsx`):
     - Updated collapsed aside container to fixed `w-12` (48px) with `flex flex-col items-center bg-white border-l border-slate-200 overflow-x-hidden select-none`.
     - Rendered uniform `w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50` expand button (`<ChevronLeft />`, `title="Expand question panel"`).
     - Rendered vertical badge list with uniform `w-8 h-8 shrink-0 rounded-lg flex items-center justify-center font-mono text-[11px] font-bold leading-none whitespace-nowrap` displaying only short sequential numbers (`1`, `2`, `3`... `19`), eliminating multi-part string wrapping.
     - Full question details, marks, and evaluation status are displayed in the button's `title` tooltip on hover.
     - Styled clean status states: active question gets `ring-2 ring-indigo-600 ring-offset-1`, approved gets `bg-emerald-500 text-white`, flagged gets `bg-amber-500 text-white`, and pending/ungraded gets `bg-slate-100 text-slate-700 hover:bg-slate-200`.
  2. Auto-Sized Student Answer (OCR) & Expected Answer Cards (`src/components/report/ReportQuestionTab.tsx`):
     - Removed fixed tall min-height constraints (`min-h-[120px]`, `h-32`, `max-h-56`) so both cards hug their text cleanly with `h-auto min-h-0` and zero wasted whitespace on short answers.
     - Rendered in a balanced 2-column grid (`grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch`).
     - Student Answer (OCR) card uses `rounded-xl bg-slate-50/90 border border-slate-200/80 p-3.5 flex flex-col justify-start` with single-line header and `text-[13px] text-slate-800 leading-relaxed whitespace-pre-wrap break-words`.
     - Expected Answer card uses `rounded-xl bg-indigo-50/35 border border-indigo-100 p-3.5 flex flex-col justify-start` with single-line header, source pill, and `text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap break-words`.
  3. Text Wrapping & Card Border Clipping in Analytics & Charts (`src/components/report/ReportAnalyticsTab.tsx`):
     - Marks Earned vs Lost header legend: styled with `flex items-center gap-3 shrink-0` and wrapped items in `inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium`, preventing `%` line breaks.
     - Total Qs badge: added `whitespace-nowrap shrink-0` so `Qs` stays on the same line.
     - Stacked Donut Chart + Mastery Legend: centered the donut chart on top and placed the 4 mastery rows (`Full Marks (≥90%)`, `Partial Marks`, `Heavy Deductions / Zero`, `Unattempted`) cleanly below it in a full-width vertical list (`w-full space-y-2 mt-4`), with dot + label on left and `X Qs (Y%)` on right inside card padding.
     - Added `whitespace-nowrap shrink-0` across chart badges and legends.
  4. Playwright Visual Verification (`scripts/verify_ui_fixes.py`):
     - Verified all 3 UI fixes on running backend & frontend with 19 questions.
     - Saved screenshot proofs: `docs/proof/ui/fixes/evaluate_collapsed_rail.png`, `docs/proof/ui/fixes/report_question_cards.png`, `docs/proof/ui/fixes/report_analytics_section3.png`.
     - `python scripts/check_all.py --no-live` passes with `RESULT: ALL PASS`. | docs/proof/ui/fixes/
- Task U4: Report Page UI implementation with live backend integration (`src/screens/ReportScreen.tsx`, `src/components/report/`, `scripts/verify_report_page.py`, `scripts/seed_demo_eval.py`, `docs/proof/ui/`):
  1. Strict Zero-Hardcoding & Data Parity:
     - Replaced all mock/banned strings (`Kanak Patel`, `SGSU250489`, `MST-I`, `B.C.A 2nd Sem Linux`, etc.) with dynamic data from backend endpoints (`/api/sheets/{id}/report`, `/api/sheets/{id}/review`, `/api/papers/{id}/sheets`, `/api/papers/{id}/reports`).
     - Verified `git grep -E "Kanak|SGSU250489|MST-I" -- src/` returns 0 matches.
  2. Locked 100dvh 3-Row Layout & Modular Subcomponents (`src/components/report/`):
     - `ReportTopBar.tsx` (48px): dynamic paper/student breadcrumbs, 3-step stepper (`1. Upload` ✓ -> `2. Evaluate` ✓ -> `3. Report` active), `A- | A | A+` font scale toggle, and Reset Layout.
     - `ReportBookletPreview.tsx`: Left pane with zoom in/out/Fit controls, page pagination, page image loader (`/api/sheets/{id}/pages/{n}/image`), and normalized `bbox` highlight overlay that auto-jumps to question page.
     - `ReportOverviewTab.tsx` (Tab 1): Student summary card, 3 KPI cards (Total Score, Grade & Percentage, Avg OCR Accuracy), AI diagnostic feedback pills (strengths & weak concepts), question summary table, and sectional performance table.
     - `ReportQuestionTab.tsx` (Tab 2): Selected question header, AI diagnostic feedback, 2-column Student OCR vs Expected Answer comparison, and 4 collapsible `<details>` dropdowns (`✓ Correct`, `⊗ Deductions`, `⚠ Missing Points`, `🛡 OCR Review Note`).
     - `ReportAnalyticsTab.tsx` (Tab 3): Filter category pills (`All Visualizations`, `1. Question & Section Marks`, `2. Error & Remark Diagnostics`, `3. Formats & Attempt Status`) rendering dynamic SVG/CSS charts (Question marks bar chart with cohort comparison line, Total Marks Split donut, Sectional Progress bars, Deduction donut, Pareto chart with 80% cutoff line, Question Format stacked bars, Attempt Status donut).
     - `ReportBottomBar.tsx` (56px): `← Back to Evaluate` navigation, `Sheet X of Y` counter, real Excel export download (`/api/papers/{id}/export/excel`), student PDF report card download (`/api/sheets/{id}/report/pdf`), and `Next Sheet →` navigation.
     - Draggable resizable vertical divider handle between Left and Right panes, persisted in `localStorage`.
  3. Gate Tests & Browser Verification:
     - Automated Playwright browser verification (`scripts/verify_report_page.py`) verified 1366x768 and 1920x1080 viewports with zero console errors, zero page scrollbars (`scrollHeight <= innerHeight`), all 3 tabs, zoom, UI scale, collapsible dropdowns, downloads, and sheet navigation.
     - `python scripts/check_all.py --no-live` reports `RESULT: ALL PASS` (banned strings, git secrets, pytest, tsc).
     - `python scripts/check_ui.py` reports `RESULT: ALL PASS` across all app routes and viewports.
Current phase and task: Task P8 Complete - PAGE_VIEWER_PLAN Complete (All Tasks P0 through P8 Finished & Verified).
Done (task id, commit, proof file):
- Task P8: Flip-and-draw rules (`src/components/PageBook.tsx`, `src/components/SheetImageViewer.tsx`, `src/utils/useAnnotations.ts`, `scripts/verify_p8_rules.py`, `docs/proof/P8/`):
  1. No Swipe / Edge-Click While Drawing Rule (`src/components/PageBook.tsx`):
     - When `annotatable` is true, touch swipe and edge click zones (`left-edge-click`, `right-edge-click`) are disabled with `pointer-events-none opacity-0`.
     - Internal callbacks (`handleEdgePrev`, `handleEdgeNext`, `handleTouchStart`, `handleTouchEnd`) immediately return early if `annotatable || isZoomed`, preventing unwanted page flips during drawing even under programmatic/forced clicks.
     - Arrow buttons (`btn-prev-page`, `btn-next-page`) and keyboard/dots navigation remain enabled and functional so the evaluator can still flip intentionally.
  2. Flush on Flip Rule (`src/components/PageBook.tsx`, `src/components/SheetImageViewer.tsx`, `src/utils/useAnnotations.ts`):
     - Added `onBeforeFlip` callback prop to `PageBook` invoked synchronously upon flip start before any animation or page transition begins.
     - Wired `flush()` in `SheetImageViewer` to immediately clear debounce timer and execute save (`PUT /api/sheets/{id}/annotations`) to the backend.
     - Verified via live API query that newly drawn marks are persisted to the database before the 600ms autosave timer would elapse.
  3. Zoom Navigation Rule (`src/components/PageBook.tsx`, `src/components/SheetImageViewer.tsx`):
     - Enabled zoom controls (Zoom in, Zoom out, Reset zoom) in Book view.
     - When zoomed in (`zoom > 1.05`), edge click flip zones are disabled (`pointer-events-none`) so panning and detail inspection do not trigger accidental page turns.
     - Chevron navigation buttons and dots continue to flip pages as expected.
  4. Ink Turns With Page in 3D (`src/components/PageBook.tsx`):
     - `PageBook`'s 3D flipping leaf structure (`[data-testid='flipping-leaf']`) renders the active page's `AnnotationLayer` on the turning front face during the 450ms CSS 3D `rotateY` animation.
  5. Verification & Proof ("Test of each rule") (`scripts/verify_p8_rules.py`, `docs/proof/P8/`):
     - Tested Rule 1: Right edge click and touch swipe ignored while drawing mode active; page stays on Page 1; arrow buttons still flip. Captured `docs/proof/P8/rule1_drawing_no_edge_flip.png`.
     - Tested Rule 2: Tick mark placed and immediate next-page flip started; verified tick persisted on server via direct GET query before 600ms autosave delay.
     - Tested Rule 3: Zoomed in to 130%; verified edge click zones disabled; arrow buttons still flip. Captured `docs/proof/P8/rule3_zoomed_no_edge_flip.png`.
     - Tested Rule 4: Verified 3D flipping leaf mounts and renders ink during page turn.
     - Full telemetry proof saved in `docs/proof/P8/p8_proof.json`.
     - `python scripts/check_all.py --no-live` reports `RESULT: ALL PASS`. | docs/proof/P8/
- Task P7: MVP tools, undo and redo, visibility switch (`src/components/AnnotationToolbar.tsx`, `src/components/AnnotationLayer.tsx`, `src/components/SheetImageViewer.tsx`, `src/utils/useAnnotations.ts`, `src/utils/annotationHistory.test.ts`, `scripts/verify_p7_tools.py`, `docs/proof/P7/`):
  1. MVP Annotation Toolbar Component (`src/components/AnnotationToolbar.tsx`):
     - Slim vertical strip on the left edge of the page box shown when `Annotate` is ON; clean page when OFF.
     - Tools palette: Select (V), Pen (P), Highlighter (H), Tick (T), Cross (X), Text note (N), Eraser (E).
     - Color picker: 4 preset colors (Red #ef4444 default, Blue #3b82f6, Green #10b981, Black #1e293b).
     - Stroke width selector: Fine (1.5), Medium (3.0), Thick (6.0).
     - Visibility switch toggle: "For student" vs "Private" (with lock indicator).
     - Client Undo (Ctrl+Z) and Redo (Ctrl+Y / Ctrl+Shift+Z) controls.
     - Show/Hide ink layer toggle button (eye icon).
     - Clear page button with confirmation state.
     - Autosave status indicator pill (`Saving...`, `Saved`, or `Error`).
     - Responsive mobile collapse to compact tool popover.
  2. Interactive Vector Drawing Engine (`src/components/AnnotationLayer.tsx`):
     - Full Pointer Events drawing with transparent canvas hitbox `<rect width="1000" height="1000" fill="transparent" />`.
     - Pen & Highlighter: live stroke preview, point capture, and Ramer-Douglas-Peucker (RDP) path simplification guaranteeing strokes stay within 200 points.
     - Tick & Cross marks: instant single-click placement in normalized page coordinates.
     - Text note popover: inline comment card editor with 'For student' / 'Private' visibility toggle, auto-saving text on submit.
     - Eraser & Select: click-to-delete or select and press Delete/Backspace.
  3. Client Undo/Redo Engine (`src/utils/useAnnotations.ts`):
     - Ref-based immediate history stacks (`undoStackRef`, `redoStackRef`) with `historyVersion` re-render triggers.
     - Reversible operations for `add`, `delete`, `update`, and `clear` with automatic autosave syncing.
     - 5 unit tests passing cleanly in `tsx --test src/utils/annotationHistory.test.ts` verifying RDP simplification and SVG path calculation.
  4. Verification, Screen Recording & Proof ("Reload keeps everything") (`scripts/verify_p7_tools.py`, `docs/proof/P7/`):
     - Tested live drawing: freehand pen stroke, tick mark, and private text note.
     - Verified Undo removed the private note from the DOM, and Redo restored it.
     - Tested reload persistence: waited for autosave, reloaded page with `page.reload()`, reopened book view, and asserted all annotations persisted from server.
     - Saved Playwright video screen recording to `docs/proof/P7/p7_tools_recording.webm`.
     - Saved screenshots to `docs/proof/P7/p7_tools_active.png` and `docs/proof/P7/p7_after_reload.png`.
     - Saved telemetry proof to `docs/proof/P7/p7_proof.json`.
     - `python scripts/check_all.py --no-live` reports `RESULT: ALL PASS`. | docs/proof/P7/
- Task P6: Read-only annotation layer inside page (`src/components/AnnotationLayer.tsx`, `src/components/SheetImageViewer.tsx`, `src/components/PageBook.tsx`, `scripts/verify_p6_annotation_layer.py`, `docs/proof/P6/`):
  1. Vector AnnotationLayer Component (`src/components/AnnotationLayer.tsx`):
     - Created SVG overlay with normalized `viewBox="0 0 1000 1000"` and `preserveAspectRatio="none"` mapping normalized (0..1) coordinates directly to SVG coordinates.
     - Supports all required vector annotation kinds: `pen` (polyline path), `highlight` (wide translucent path with `mix-blend-mode: multiply`), `tick` (clean green vector checkmark with drop-shadow), `cross` (clean red vector cross), and `text` (HTML foreignObject card with text clamp and backdrop blur).
     - Privacy boundary enforcement: text notes with `visibility='private'` render with dashed amber border and explicit "PRIVATE NOTE" badge in teacher view. When `userRole === 'student'`, private annotations are completely excluded from rendering.
  2. PageBook & SheetImageViewer Integration (`src/components/PageBook.tsx`, `src/components/SheetImageViewer.tsx`):
     - Embedded `AnnotationLayer` onto base page inside `PageBook` at `z-index: 20` using `renderAnnotationLayer` slot.
     - Ink turns with the page during flip: `PageBook`'s flipping leaf front face renders `renderAnnotationLayer(fromPage, ...)` so annotations move seamlessly during 3D rotations.
     - Wired `useAnnotations` hook in `SheetImageViewer` to provide live vector annotations in both embedded and full-screen popup PageBook instances.
  3. Verification & Proof ("Same ink in the same place at two window sizes"):
     - Executed Playwright automation in `scripts/verify_p6_annotation_layer.py` across two distinct window sizes:
       - 1920x1080 (Desktop): tick position normalized x=0.6503, y=0.3000; captured `docs/proof/P6/anno_layer_1920x1080.png`.
       - 768x1024 (Tablet Portrait): tick position normalized x=0.6502, y=0.3000; captured `docs/proof/P6/anno_layer_768x1024.png`.
     - Verified exact relative position consistency across sizes: dx=0.0001, dy=0.0000 (well within 2% tolerance).
     - Verified fit-to-screen rule (zero vertical window scrollbar) across both resolutions.
     - Verified flip retention: flipping forward to Page 2 and returning to Page 1 preserves all 5 annotations intact without distortion or data loss.
     - Saved full telemetry proof in `docs/proof/P6/p6_proof.json`.
     - `python scripts/check_all.py --no-live` reports `RESULT: ALL PASS`. | docs/proof/P6/
- Task P5: Annotation table, API, autosave, error banner (`backend/db.py`, `backend/main.py`, `backend/tests/test_p5_annotations.py`, `src/utils/useAnnotations.ts`, `scripts/verify_p5_annotations.py`, `docs/proof/P5/`):
  1. Vector Annotations Database Schema (`backend/db.py`):
     - Created `annotations(id, sheet_id, page_no, question_key NULL, kind, data_json, color, width, visibility, created_by, created_at, updated_at, deleted_at, version)` with index on `(sheet_id, page_no)`.
     - Supports kinds: `pen`, `highlight`, `tick`, `cross`, `text`.
     - Visibility options: `'student'` ("For student") and `'private'` ("Private").
     - Version counter for optimistic concurrency and conflict detection.
  2. REST API Endpoints & Typed Errors (`backend/main.py`):
     - `GET /api/sheets/{id}/annotations?page=N`: retrieves active annotations, parsing `data_json` to structured objects.
     - `PUT /api/sheets/{id}/annotations`: batch upsert endpoint supporting creation, updates, and soft deletion (`deleted: True`). Enforces optimistic locking (`409 VERSION_CONFLICT`).
     - `POST /api/sheets/{id}/annotations/clear?page=N`: soft-deletes active annotations on page N.
     - Strictly implements typed error contract: `{code, message, detail, stage, retryable}`.
  3. Frontend Autosave & Concurrency Hook (`src/utils/useAnnotations.ts`):
     - Debounces saves to ~600ms after last stroke or edit.
     - Optimistic local state updates with in-memory pending changes buffer.
     - Preserves all ink in memory during network or save failures with Retry capability.
     - Listens to `beforeunload` to prevent accidental loss of unsaved changes.
  4. Verification & Proof (`scripts/verify_p5_annotations.py`, `backend/tests/test_p5_annotations.py`, `docs/proof/P5/`):
     - Executed Pytest integration test suite (2 tests passing cleanly in 0.98s): CRUD lifecycle, page filtering, soft-delete, version conflict, and typed error handling. Pytest logs saved to `docs/proof/P5/p5_pytest_results.txt`.
     - Live API verification on running server: confirmed 200 OK on batch PUT, page-filtered GET, and 409 VERSION_CONFLICT on stale updates.
     - Verified Error Banner with Retry CTA on forced save failure and captured screenshot `docs/proof/P5/p5_evaluate_screen_ready.png`.
     - Saved full telemetry trace in `docs/proof/P5/p5_proof.json`.
     - `python scripts/check_all.py --no-live` reports `RESULT: ALL PASS`. | docs/proof/P5/
- Task P4: Progress mode driven by server, no-jump rule, Jump to latest (`src/components/PageBook.tsx`, `src/screens/UploadScreen.tsx`, `scripts/verify_p4_progress.py`, `docs/proof/P4/`):
  1. Live Server Progress Driven Engine (`src/components/PageBook.tsx`, `src/screens/UploadScreen.tsx`):
     - Integrated `PageBook` in `mode="progress"` into `UploadScreen.tsx` sheet processing queue.
     - Automatically renders active reading page with soft scanning laser line (`data-testid="soft-scan-line"`).
     - Renders progress counter `Page X of Y read`, gradient progress bar, and dynamic stage subtitle.
     - Flips strictly in synchronization with real server OCR completion timestamps without artificial timers.
     - Transitions to terminal `All pages read` state upon 100% sheet completion.
  2. No-Jump Rule & Jump to Latest Banner (`src/components/PageBook.tsx`):
     - Allows teacher to click earlier page dots (or left arrows) to inspect previously read pages while OCR continues on subsequent pages.
     - Enforces strict No-Jump Rule: when server finishes additional pages, the book remains pinned to the teacher's inspected page and NEVER auto-jumps forward.
     - Surfaces prominent animated badge `Page X done` with `Jump to latest` button (`data-testid="badge-jump-to-latest"`).
     - Clicking `Jump to latest` flips forward to the latest active server page.
  3. Single-Page Failure & Per-Page Retry (`src/components/PageBook.tsx`, `src/screens/UploadScreen.tsx`):
     - Renders red warning outline and failure card (`data-testid="page-error-overlay"`) displaying real server error message on failed pages.
     - Integrated `Retry this page` CTA calling `POST /api/sheets/{id}/pages/{n}/retry` to restart OCR solely for the failed page.
  4. Verification, Screen Recordings & Proof (`scripts/verify_p4_progress.py`, `docs/proof/P4/`):
     - Live 9-page progression: verified 1/9 -> 9/9 synchronization with server updates and saved video `docs/proof/P4/pagebook_progress_9page_read.webm`.
     - Verified No-Jump Rule and 'Jump to latest' forward navigation.
     - Verified page failure overlay and per-page retry resumption, saving video `docs/proof/P4/pagebook_failure_and_retry.webm`.
     - Captured 5 proof screenshots in `docs/proof/P4/` (`page1_reading.png`, `9page_complete.png`, `no_jump_badge.png`, `page_failure.png`, `page_retry_resumed.png`).
     - Saved full telemetry trace in `docs/proof/P4/p4_proof.json`.
     - `python scripts/check_all.py --no-live` reports `RESULT: ALL PASS`. | docs/proof/P4/
- Task P3: Flip animation with queueing and reduced motion (`src/utils/flipQueue.ts`, `src/utils/flipQueue.test.ts`, `src/components/PageBook.tsx`, `scripts/verify_p3_flip.py`, `package.json`, `docs/proof/P3/`):
  1. FlipQueue Class & Unit Test Suite (`src/utils/flipQueue.ts`, `src/utils/flipQueue.test.ts`):
     - Implemented FIFO sequential page turn queue orchestrator guaranteeing non-overlapping transitions.
     - Multi-page advancement requests (e.g. server reporting multiple pages done at once, or rapid user clicks) decompose into atomic single-page flips in strict order.
     - 6 unit tests passing cleanly in `tsx --test` verifying: sequential order, backward flips, in-flight queue buffering, prefers-reduced-motion 150ms switch, boundary clamping, and instant `jumpTo` cancelation. Unit test log saved to `docs/proof/P3/flip_queue_unit_test.txt`.
  2. 3D Flip Animation & Lined Leaf Structure (`src/components/PageBook.tsx`):
     - 450 ms ease-in-out rotation (`cubic-bezier` / quadratic easing) about left spine (`transform-origin: left center`, `perspective: 1800px`, `transform-style: preserve-3d`).
     - Front and back faces with `backface-visibility: hidden` and lined paper texture.
     - Dynamic moving curl shadow across turning leaf during rotation (`opacity` peak at 90 deg, gradient sweep across leaf surface).
     - Backward flip support (-180deg to 0deg).
     - Full support for `prefers-reduced-motion` switching to 150 ms linear opacity crossfade without 3D rotation.
  3. Verification & Video Screen Recording (`scripts/verify_p3_flip.py`, `docs/proof/P3/`):
     - Verified single forward 3D flip (1 -> 2) and captured mid-flip snapshot `docs/proof/P3/pagebook_mid_flip_3d.png`.
     - Verified rapid sequential queueing (rapid double-click advances 2 -> 3 -> 4 sequentially with zero overlap).
     - Verified backward 3D flip (4 -> 3).
     - Verified `prefers-reduced-motion` emulation with 150 ms crossfade and captured snapshot `docs/proof/P3/pagebook_reduced_motion_fade.png`.
     - Saved full Playwright video screen recording to `docs/proof/P3/pagebook_flip_animation.webm` (1.8 MB).
     - Saved telemetry proof to `docs/proof/P3/p3_proof.json`.
     - `python scripts/check_all.py --no-live` reports `RESULT: ALL PASS`. | docs/proof/P3/
- Task P2: PageBook in browse mode (`src/components/PageBook.tsx`, `src/components/SheetImageViewer.tsx`, `src/screens/EvaluateScreen.tsx`, `backend/main.py`, `scripts/verify_p2_pagebook.py`, `docs/proof/P2/`):
  1. Interactive PageBook Shared Component (`src/components/PageBook.tsx`):
     - Renders multi-page answer sheets in natural book presentation with realistic page stack borders (spine thickness on left that grows as pages are turned, right border for remaining pages).
     - Full navigation controls in browse mode: prev/next chevron buttons, left/right keyboard arrows, left/right edge click zones (15% margins), touch swipe gesture handling, and bottom page indicator dots bar.
     - Bottom dots indicator renders distinct page states: `done` (green), `reading` (pulsing indigo), `failed` (rose), and active indicator.
     - Legibility status badge chip: `>= 0.80` displays green `95% legible`, `< 0.80` displays warning yellow `74% · Hard to read`.
     - Memory optimization: loads high-resolution scans only for current page and immediate neighbours (`Math.abs(idx - activeIndex) <= 1`).
     - Lined paper base background and subtle scan line styling.
  2. EvaluateScreen & Viewer Integration (`src/components/SheetImageViewer.tsx`, `src/screens/EvaluateScreen.tsx`):
     - Added view switcher (`Crop` / `Full Box` / `Book View`) in `SheetImageViewer`.
     - Full-page popup modal support via maximize button (`Maximize2` / `Minimize2` toggle) with backdrop blur and Esc key shortcut.
     - Defensively handled confidence parsing in `backend/main.py` (`get_sheet_review`) supporting string descriptors (`'high'`, `'medium'`, `'low'`) and raw floats.
  3. Responsive Fit-to-Screen Verification (`scripts/verify_p2_pagebook.py`, `docs/proof/P2/`):
     - Verified zero outer page scrollbars (`hasVerticalScroll: False`, `windowScrollY: 0`) across 3 required viewports:
       - 1920x1080 (Desktop): verified full-page popup modal and captured `docs/proof/P2/pagebook_browse_1920x1080.png`.
       - 1366x768 (Standard Laptop): verified embedded PageBook navigation and captured `docs/proof/P2/pagebook_browse_1366x768.png`.
       - 768x1024 (Tablet Portrait): verified embedded PageBook navigation and captured `docs/proof/P2/pagebook_browse_768x1024.png`.
     - Captured telemetry in `docs/proof/P2/p2_proof.json`.
     - `python scripts/check_all.py --no-live` reports `RESULT: ALL PASS`. | docs/proof/P2/
- Task P1: Page progress fields, image endpoint, per-page retry (`backend/db.py`, `backend/main.py`, `backend/tests/test_p1_backend.py`, `scripts/verify_p1_backend.py`, `docs/proof/P1/`):
  1. Per-page Progress Fields (`backend/db.py`, `backend/main.py`):
     - Added `finished_at TEXT` column to `sheet_pages` and backfilled migration.
     - Updated sequential OCR pipeline to record `finished_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')` when each individual page's OCR result is committed to the database.
     - `GET /api/sheets/{id}` and `GET /api/papers/{id}/sheets` return `pages [{n, status, legibility, error, finished_at, image_url}]` and `pages_done`.
  2. Auto-Rotated & Resized Page Image Endpoint (`backend/main.py`):
     - Enhanced `GET /api/sheets/{id}/pages/{n}/image?w=1200` with PIL `ImageOps.exif_transpose` (automatic orientation correction) and proportional Lanczos downsampling when query parameter `w` is supplied (verified width 1200, mime `image/jpeg`).
  3. Single-Page Retry & Typed Errors Contract (`backend/main.py`):
     - Implemented `POST /api/sheets/{id}/pages/{n}/retry` allowing teachers to retry a single page's OCR without re-running the entire sheet.
     - Standardized typed error response contract across all API endpoints: `{code, message, detail, stage, retryable}`.
  4. Verification & Proof (`scripts/verify_p1_backend.py`, `docs/proof/P1/`):
     - Ran 4-page student exam sheet through sequential pipeline: verified `pages_done` strictly advanced `0/4 -> 1/4 -> 2/4 -> 3/4 -> 4/4`, with strictly chronological ISO `finished_at` timestamps `['2026-11-18T04:53:09Z', '2026-11-18T04:53:21Z', '2026-11-18T04:53:33Z', '2026-11-18T04:53:36Z']`.
     - Verified `w=1200` JPEG resizing, per-page retry execution, and HTTP 404 typed error contract.
     - Saved full API trace to `docs/proof/P1/p1_api_trace.json`.
     - Verified `python scripts/check_all.py --no-live` (ALL PASS across banned strings, git secrets, 75 pytest tests, and tsc --noEmit). | docs/proof/P1/
- Task P0: Fix B2 - Sheet upload crash resolution & 9-page PDF evaluation proof (`backend/db.py`, `backend/marking_engine.py`, `backend/tests/test_b2_row_dict.py`, `scripts/verify_p0_b2.py`, `docs/proof/P0/`):
  1. Universal SQLite Connection & DictRow Guarantee (`backend/db.py`, `backend/main.py`, `scripts/`):
     - Confirmed all backend database connection paths use `get_db_connection()` and `get_db()`, with `conn.row_factory = DictRow`.
     - Standardized helper scripts (`scripts/check_ui.py`, `scripts/e2e_ui.py`, `scripts/verify_p9_4.py`, `scripts/verify_p9_5.py`, `scripts/verify_p9_6.py`) to use `get_db_connection()` / `get_db()`, preventing raw `sqlite3.Row` attribute errors across test automation.
     - Added `extract_normalized_key_points` in `backend/marking_engine.py` to defensively parse both list-of-strings and list-of-dicts `key_points_json`, guaranteeing `.get()` is never called on a raw string.
  2. Regression Test Suite (`backend/tests/test_b2_row_dict.py`):
     - Verified `get_db_connection` row factory supports `row['x']`, `row.get('x')`, and `row.get('x', default)`.
     - Verified `get_db` context manager returns rows with both bracket and `.get()` methods.
     - Verified `fetchone` and `fetchall` return pure dicts.
     - Verified queries against major tables (`papers`, `sheets`, `sheet_pages`, `questions`) support `.get()`.
     - Verified FastAPI endpoints execute without row attribute errors.
  3. 9-Page PDF End-to-End Upload & Evaluation Verification (`scripts/verify_p0_b2.py`):
     - Generated a real 9-page student answer sheet PDF (`scratch/aditya_verma_9pages.pdf`) containing student header and answers for 9 questions.
     - Uploaded to `POST /api/papers/{paper_id}/sheets/upload`: confirmed HTTP 200, 9 pages detected.
     - Monitored sequential pipeline: `pages_read` strictly advanced `1/9 -> 2/9 -> ... -> 9/9` until reaching terminal state `evaluated` with zero attribute errors.
     - Captured UI proof screenshot at `docs/proof/P0/p0_b2_9page_upload_success.png` and telemetry trace in `docs/proof/P0/p0_proof.json`. | docs/proof/P0/
- Task: Fixed Marks & Why Action Buttons Visibility (`src/components/MarksCard.tsx`, `src/screens/EvaluateScreen.tsx`):
  1. Pinned Footer Layout (`src/components/MarksCard.tsx`):
     - Changed `MarksCard` root `<section>` to `h-full min-h-0 flex flex-col`.
     - Made the middle card content (score stepper, flags, rubric point breakdowns, evidence quotes) `flex-1 min-h-0 overflow-y-auto`.
     - Pinned the card footer containing the `Recheck...` and `Approve` buttons (`shrink-0 z-10 shadow-2xs`), ensuring the buttons are permanently visible on screen regardless of the length of the rubric or flags.
  2. Sub-column Container Flex Optimization (`src/screens/EvaluateScreen.tsx`):
     - Converted the `MarksCard` parent wrapper from `flex-1 min-h-0 overflow-y-auto` to `flex-1 min-h-0 h-full overflow-hidden flex flex-col`, preventing the entire card from being pushed down and cutting off buttons.
     - Calibrated `OcrCard` container to `max-h-[35%]` to ensure optimal vertical space for `MarksCard`.
  3. Verification:
     - `npx tsc --noEmit` clean (0 errors).
     - `npm run build` succeeds (dist built in 5.51s).
     - `python scripts/check_all.py --no-live` reports `RESULT: ALL PASS`.
- Task: Fixed components behind header and offscreen layout shifts (`src/app/Shell.tsx`, `src/screens/EvaluateScreen.tsx`, `src/components/QuestionPanel.tsx`, `src/components/QuestionSidebar.tsx`, `src/components/ErrorBanner.tsx`, `src/index.css`, `src/screens/UploadScreen.tsx`):
  1. Root Cause Resolution (Ancestor Scroll via `scrollIntoView`):
     - Identified that `QuestionPanel.tsx` and `QuestionSidebar.tsx` called global `element.scrollIntoView()`, which scrolled the ancestor `<main>` container down by 104px whenever questions were rendered or changed.
     - Replaced `scrollIntoView` in both `QuestionPanel.tsx` and `QuestionSidebar.tsx` with container-local scrolling targeting exclusively `listContainerRef.current`, guaranteeing `<main>` and `window` are never scrolled.
     - Added `mainRef` in `Shell.tsx` to strictly pin `main.scrollTop = 0` on every step or sheet transition.
  2. Workspace Viewport Height Fit (`src/screens/EvaluateScreen.tsx`):
     - Changed `EvaluateScreen` root `<section>` from `h-[100dvh] max-h-[100dvh]` to `h-full max-h-full min-h-0`. This eliminates the 104px container overflow inside `<main>`.
     - Compacted inner header to `h-11 shrink-0` with `flex items-center justify-between` (preventing wrapping on small viewports and reserving maximum vertical height for question content).
  3. In-Flow Error Banner & Flex Column Shell (`src/components/ErrorBanner.tsx` & `src/index.css`):
     - Changed `ErrorBanner.tsx` from `position: absolute; top: 48px; left: 0; right: 0; z-index: 50;` to in-flow `w-full shrink-0 z-40`, so active error alerts never cover or occlude top controls.
     - Converted `.app` in `src/index.css` from a rigid 3-row CSS Grid into a flexible `display: flex; flex-direction: column; height: 100dvh;`, maintaining perfect 48px header and 56px action bar heights while `<main>` flexes dynamically without track collision.
  4. Stable Paper Details Rendering (`src/screens/UploadScreen.tsx`):
     - Provided a default fallback state for `PaperDetailsForm` so Step 1A never displays an empty void while paper metadata loads.
  5. Verification:
     - `npx tsc --noEmit` clean (0 errors).
     - `npm run build` succeeds (dist built in 5.62s).
     - `python scripts/check_all.py --no-live` reports `RESULT: ALL PASS` (66 tests passed).
     - Browser DOM bounding boxes confirmed: `shellHeader` (y: 0..48), `main` (y: 48..669), `toolbar` (y: 669..725) with zero overlap and zero negative y offsets.
- Task: Stale Sheet Navigation & HTTP 404 Auto-Recovery Fix (`src/screens/EvaluateScreen.tsx`, `src/screens/UploadScreen.tsx`, `src/app/Shell.tsx`):
  1. Stale Sheet ID Invalidation in Upload Screen (`src/screens/UploadScreen.tsx`):
     - In `loadSheets`, validated `state.sheetId` against `fetched` sheets list. If `state.sheetId` points to an old/deleted sheet or another paper's sheet, automatically resets `sheetId` to the active paper's first valid sheet (`fetched[0].id`).
     - In `handleStartProcessingOrOpen`, ensured `targetSheet` always resolves to an actual sheet currently in the queue (`sheets.find(s => s.id === state.sheetId) || sheets[0]`).
  2. Automatic 404 Sheet Recovery in Evaluation Workspace (`src/screens/EvaluateScreen.tsx`):
     - When `loadReviewData` encounters an HTTP 404 error (e.g. from an old URL hash or deleted sheet), it automatically queries the active paper's sheets (`/api/papers/${paperId}/sheets`) and redirects to a valid existing sheet (`f3dcbe8c...`), or returns cleanly to `#/upload` if no sheets exist.
  3. Header Stepper Safe Navigation (`src/app/Shell.tsx`):
     - When clicking "2. Evaluate" from the header bar without a selected sheet, queries the active paper's sheets and selects the first valid sheet before opening the workspace.
  4. Verification:
     - `npx tsc --noEmit` passed with 0 errors.
     - `npm run build` completed cleanly (dist built in 5.73s).
     - `python scripts/check_all.py --no-live` passed with `RESULT: ALL PASS`.
- Task: SQLite Dictionary Row Helpers & DictRow (`backend/db.py`, `backend/main.py`, `backend/tests/test_backend.py`):
  1. DB Helpers (`backend/db.py`):
     - Added `fetchone(conn, sql, params=()) -> Optional[Dict[str, Any]]` and `fetchall(conn, sql, params=()) -> List[Dict[str, Any]]` helper functions to convert SQLite rows to plain Python dicts at the database helper level (Option A).
     - Implemented `DictRow` as the connection `row_factory` in `get_db_connection()`, supporting index access (`row[0]`), key access (`row["col"]`), dictionary `.get(key, default=None)`, `.keys()`, `.values()`, `.items()`, `dict(row)`, and `'key' in row`.
  2. Main Pipeline Row Access (`backend/main.py`):
     - Imported `fetchone`, `fetchall`, `DictRow` and ensured `paper` and `sheet` rows in `_execute_sheet_evaluation_pipeline` are dict-converted, guaranteeing `.get(...)` calls never raise `AttributeError: 'sqlite3.Row' object has no attribute 'get'`.
  3. Verification & Test Suite:
     - Added `test_db_dict_row_and_helpers` in `backend/tests/test_backend.py` verifying `fetchone`, `fetchall`, and `DictRow` behaviors.
     - Ran `npx tsc --noEmit` (0 errors), `npm run build` (built in 4.41s), and `python scripts/check_all.py` (ALL PASS across banned strings, git secrets, 66 pytest passing, tsc clean, live provider health).
- Task: Zero-Scroll Single-Screen Responsive Layouts, 1-by-1 Sequential OCR Pipeline & SQLite Locking Elimination:
  1. SQLite Database Locking Fix (`backend/db.py` & `backend/main.py`):
     - Configured all SQLite connections with `PRAGMA journal_mode = WAL;`, `PRAGMA synchronous = NORMAL;`, `PRAGMA busy_timeout = 30000;`, and `timeout=30.0`.
     - Wrapped all database write transactions in a global `threading.Lock()` using `BEGIN IMMEDIATE` transactions in autocommit mode (`isolation_level=None`), guaranteeing absolute thread and coroutine serialization with zero `database is locked` errors.
  2. Sequential 1-by-1 Page OCR with Real-time Progress Tracking (`backend/main.py` & `backend/db.py`):
     - Converted multi-page OCR execution from simultaneous `asyncio.gather` into a sequential page-by-page pipeline (`for p_row in sorted_pages:`).
     - Updates and commits `sheet_pages.ocr_status` (`reading` -> `done` + `ocr_legibility`) and `sheets.pages_read` (and stage text `Read X/Y pages`) after each individual page finishes.
     - Real-time `pages_read` progression strictly increments `1/N -> 2/N -> ... -> N/N` without burst or lock collision.
  3. Zero-Scroll 3-Column Horizontal Grid on `#/upload` (`src/screens/UploadScreen.tsx` & `src/components/PaperDetailsForm.tsx`):
     - Replaced stacked 2-column layout with a 3-column horizontal grid (`grid-cols-[36%_28%_36%] h-full overflow-hidden gap-3 p-3`):
       - Column 1 (`36%`, Step 1A · Question Paper): Compact paper selector + `+ New`, compact 2×2 grid (Title, Subject, Subject Code, Exam Name with amber `"Not detected — enter manually"` placeholder saving on blur via `PATCH /api/papers/{id}`), Subject Domain calibration + Strictness 1–5 bar, side-by-side QP & Teacher Answer Key drop zones, and View/Edit Rubric drawer trigger.
       - Column 2 (`28%`, Step 1B · Student Answer Sheets): Dedicated full-height drag-and-drop zone (`PDF / JPG / PNG`) + `"Treat each file as a separate sheet"` toggle switch.
       - Column 3 (`36%`, Uploaded Batch Queue): Displays uploaded batch sheets with inline Student Name & Roll Number inputs (auto-shown on `needs_identity` and toggleable via `Edit (✎)` button on every card), Start Evaluation CTA, and Book-Style 3D Page-Flip Viewer (`PageFlipStrip.tsx`).
  4. Real Book-Style Page-Flip Animation (`src/components/PageFlipStrip.tsx`):
     - Displays actual scanned page image (`/api/sheets/{id}/pages/{n}/image`) as each page finishes OCR.
     - 650ms 3D leaf turn animation (`perspective: 1200px`, `rotateY(0deg)` to `rotateY(-180deg)` with `transform-origin: left center` and spine shadow) flipping the previous scanned page over to reveal the newly scanned page underneath, with `Page X of Y scanned` progress and clickable mini page pills `1..N`.
  5. Zero-Scroll 2-Subcolumn Layout on `#/evaluate` (`src/screens/EvaluateScreen.tsx` & `src/components/SheetImageViewer.tsx`):
     - Fits 100% within `100dvh` with zero outer window scrolling at 1366x768 and 1920x1080.
     - Main left area divided into 2 side-by-side sub-columns (`grid-cols-2 gap-2.5 h-full min-h-0 overflow-hidden`):
       - Sub-column 1: Selected Question Prompt (+ MCQ options) on top + `SheetImageViewer` (crop/full toggle, bbox, zoom, rotate) filling the rest of the height.
       - Sub-column 2: `OcrCard` (editable detected text, legibility bar) on top + `MarksCard` (stepper, per-point verdicts, evidence quotes, flags, Strictness 1–5 / Recheck) below.
     - Right sidebar: `QuestionPanel.tsx` collapsible list (`All | Flagged | Checked`) collapsing to 44px rail with `localStorage` persistence.
  6. Verified via `npx tsc --noEmit` (0 errors), `npm run build` (built in 3.4s), and `python scripts/check_all.py` (ALL PASS across banned strings, git secrets, 65 pytest passing, tsc clean, live provider health).
- Task P9.8: Hardening & Cleanup (`backend/main.py`, `.env.example`, `src/screens/ReportScreen.tsx`, `scripts/verify_p9_8.py`, `docs/proof/P9.8/`):
  1. Concurrency gate (A16): Implemented global evaluation worker queue semaphore `get_eval_semaphore()` with configurable capacity via `EVAL_CONCURRENCY` environment variable (defaults to 1 for free-tier rate-limit protection), preventing free-tier 429 storms when multiple sheets are uploaded or resumed.
  2. Paper Report Analytics: Added `strictness_distribution` and `paper_strictness` to `build_paper_reports_data`, displaying strictness level breakdown (Levels 1..5) in the Paper Analytics tab of `ReportScreen.tsx`.
  3. Student Report Card: Added `e.strictness_used` and `paper_strictness` to `GET /api/sheets/{sheet_id}/report`, rendering `S.{level}` badges on individual questions whenever a question's strictness override differs from the paper level.
  4. Clean repository root: Deleted temporary root files (`UploadScreen.diff`, `UPGRADE_PLAN.md`, `STRICTNESS_SPEC.md`), ensuring they remain permanently documented under `docs/`.
  5. Verified via `scripts/verify_p9_8.py` and `scripts/check_all.py` (ALL PASS across banned strings, git secrets, 65 pytest passing, tsc clean, live provider health). Saved proof to `docs/proof/P9.8/p9_8_proof.json`. | docs/proof/P9.8/
- Task P9.7: End-to-End Tests & Verification across Two Distinct Papers (`scripts/e2e_ui.py`, `docs/proof/P9.7/`):
  1. Ran two completely distinct papers end-to-end to prove zero hardcoding:
     - Paper 1: Computer Science / IT (Database Management Systems, Strictness 3, student Arjun Sharma, roll CS303-012).
     - Paper 2: Science & Engineering (Engineering Physics II, Strictness 4, student Priya Patel, roll PHY-2026-045).
  2. Verified entire user journey across both papers:
     - Upload screen with paper metadata (title, subject, code, exam, domain, strictness 1-5).
     - PageFlipStrip progress tracking and flip state.
     - Unreadable header identity workflow with IdentityForm; typing student name and roll, saving, and auto-transition.
     - Evaluation workspace with 2-column layout, auto-selection of first flagged question, image viewer with crop/full toggle, OCR card, and marks card with per-point verdicts and coded flags.
     - Recheck with strictness 5: strictness chip updates to 5/5, 'was {prev}M' undo banner appears, and Undo reverts marks.
     - Finalizing sheet and viewing full Report Screen with score, grade, and question breakdown.
  3. Captured 12 screenshots and telemetry JSON in `docs/proof/P9.7/`:
     - Paper 1: `paper1_upload_metadata.png`, `paper1_flip_progress.png`, `paper1_identity_form.png`, `paper1_eval_workspace.png`, `paper1_recheck_strictness5.png`, `paper1_report_screen.png`.
     - Paper 2: `paper2_upload_metadata.png`, `paper2_flip_progress.png`, `paper2_identity_form.png`, `paper2_eval_workspace.png`, `paper2_recheck_strictness5.png`, `paper2_report_screen.png`.
     - Data: `e2e_proof.json`.
  4. Verified `check_all.py` (ALL PASS across banned strings, git secrets, 65 pytest passing, tsc clean, live provider health). | docs/proof/P9.7/
- Task P9.6: Evaluation Workspace Redesign and Question Panel (`src/components/StrictnessChip.tsx`, `src/components/RecheckPopover.tsx`, `src/components/SheetImageViewer.tsx`, `src/components/QuestionPanel.tsx`, `src/components/MarksCard.tsx`, `src/screens/EvaluateScreen.tsx`, `scripts/verify_p9_6.py`, `docs/proof/P9.6/`):
  1. Implemented Section 5 2-column evaluation workspace layout: Left column = Selected question details (Question card with StrictnessChip, prompt text, MCQ options; SheetImageViewer with Crop/Full toggle, normalized bbox overlay, multi-page continuation chips, zoom/rotate; OcrCard with editable text, legibility score, and reader diff; MarksCard with 0.5M stepper, per-point verdicts, coded flags, Recheck with 1-5 strictness, and Undo banner; collapsible ReferenceCard).
  2. Implemented right QuestionPanel: 280px expanded panel with All / Flagged / Checked tabs, status indicator dots, Q number, score/max, and strictness override badges (`S.{level}`). Collapses to 44px rail (`w-[44px]`) with numbered status dots. State persists across page reloads via `localStorage` key `evaldesk_question_panel_collapsed`.
  3. Automatic selection: automatically selects the first flagged question on initial load, falling back to the first question if none flagged.
  4. Live AI Recheck & Undo: Recheck popover allows selecting 1-5 strictness and optionally persisting question override. Recheck updates evaluation row and sheet totals in place without page reload. Score updates show "Score was {previous_final_marks} M before recheck" with [Undo] button that reverts marks via review API.
  5. Verified via Playwright test script `scripts/verify_p9_6.py` and `scripts/check_all.py` (ALL PASS across banned strings, git secrets, 65 pytest passing, tsc clean, live provider health). Saved 4 screenshots (`eval_workspace_initial_flagged.png`, `eval_workspace_crop_full_toggle.png`, `eval_workspace_collapsed_rail.png`, `eval_workspace_recheck_strictness5_undo.png`) and review payload JSON to `docs/proof/P9.6/`. | docs/proof/P9.6/
- Task P9.5: Upload Screen Metadata and Identity Workflow (`src/components/PaperDetailsForm.tsx`, `src/components/IdentityForm.tsx`, `src/screens/UploadScreen.tsx`, `scripts/verify_p9_5.py`, `docs/proof/P9.5/`):
  1. Paper details: title, subject, subject_code, exam_name, domain, and 1-5 strictness rendered via `PaperDetailsForm`. Empty extracted values show amber "Not detected" tag and amber input highlight. Changes save on blur via `PATCH /api/papers/{id}` even when the paper is locked.
  2. Strictness Level 4-5 safeguard tip: amber notice appears when strictness >= 4 without a teacher answer key ("Tip: Upload a Teacher Answer Key for exact keyword enforcement at Level {N}...").
  3. Student identity workflow: unreadable header leaves sheet in `needs_identity`, showing `IdentityForm` requiring both student name and roll number. Submitting calls `POST /api/sheets/{sheet_id}/identity` which saves details, sets status to `queued`, and immediately kicks off the evaluation pipeline.
  4. Per-question strictness override in the question drawer: `StrictnessPicker` compact mode allows overriding strictness per question or inheriting from paper.
  5. Verified end-to-end via Playwright script `scripts/verify_p9_5.py`. Proof saved to `docs/proof/P9.5/p9_5_verification.json` and 3 screenshots (`upload_screen_amber_tip_and_identity_form.png`, `identity_form_filled.png`, `identity_saved_evaluation_started.png`). | docs/proof/P9.5/
- Task P9.4: Real Per-Page OCR Progress & Flip Animation (`backend/main.py`, `src/components/QueueRow.tsx`, `src/screens/UploadScreen.tsx`, `backend/tests/test_p9_4.py`, `scripts/verify_p9_4.py`, `docs/proof/P9.4/`):
  1. Updated `read_page` to record real per-page status in SQLite `sheet_pages`: sets `ocr_status = 'reading'` and clears error at start; sets `ocr_status = 'done'`, average page legibility, and clears error on success; catches any exception and sets `ocr_status = 'failed'` with full error message. Each status change executes in its own short committed transaction.
  2. Maintained `sheets.stage_key` at every stage transition alongside `current_stage`: `'queued'`, `'reading'`, `'matching'`, `'marking'`, `'flagging'`, `'needs_review'`, `'evaluated'`, and `'failed'`.
  3. Eliminated fake progress counters: completely removed `pages_total // 2` guess from `GET /api/sheets/{id}` (clearing the final banned string check in `scripts/check_all.py`!) and `1 if s["status"] == "reading"` from `GET /api/papers/{id}/sheets`. Both endpoints now calculate real `pages_read = sum(1 for p in sp_rows if p["ocr_status"] == "done")` and return full `pages[]` status array with `{n, status, image_url, legibility, error}`.
  4. Updated `retry_sheet_evaluation` to reset all sheet pages to `ocr_status = 'pending'`, `ocr_error = NULL`, `ocr_legibility = NULL` and `stage_key = 'queued'`. Handled reuse path marking all pages `done`.
  5. Updated frontend `UploadScreen.tsx`: adaptive 1s polling interval when any sheet has `stage_key === 'reading'` or a page in `reading` state; renders `PageFlipStrip` for active or failed sheets with pages. Added `stage_key` and `pages` to `SheetQueueItem` in `QueueRow.tsx`.
  6. Verified via `backend/tests/test_p9_4.py` (4/4 passed), full pytest suite (65/65 passed), `npx tsc --noEmit` (0 errors), and `scripts/check_all.py` (ALL PASS across banned strings, git secrets, pytest, tsc, and live provider health).
  7. Captured multi-moment API JSON payload (`docs/proof/P9.4/moments_api.json`) and 3 Playwright screenshots (`page_flip_moment1_pending.png`, `page_flip_moment2_reading.png`, `page_flip_moment3_failed.png`). | docs/proof/P9.4/
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
1. User demo walkthrough of the completed EvalDesk PageBook 3D multi-page viewer & live annotation tools.
2. Production staging deployment.
3. User feedback intake.
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

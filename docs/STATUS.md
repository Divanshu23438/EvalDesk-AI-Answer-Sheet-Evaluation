# STATUS (update at the end of every session)
Date / author (agent or model name): 2026-11-15 / Antigravity (Gemini 3.8 Flash)
Current phase and task: Phase 7 Completed (Live Production Hardening & Full E2E Live Verification Verified)
Done (task id, commit, proof file):
- Task P0.1: Rotate-keys note, ignore secrets/dist/caches/data | commit 8e0f32e | docs/proof/rotate_keys_note.md
- Task P0.2: Back up database & clean database initialization | commit 30e66b6 | data/app.db.bak
- Task P0.3: Remove banned strings & empty React initial state | commit 30e66b6 | docs/proof/p0_check_all.txt
- Task P0.4: Move legacy screens, server.ts, and Node services to legacy/ | commit f1d416f | legacy/
- Task P0.5: scripts/check_all.py gate validation | commit 8e0f32e | scripts/check_all.py
- Task P0.6: Error banner with Retry component in frontend | commit 30e66b6 | src/components/teacher/TeacherPrototypeWorkspace.tsx
- Task P1.1: Rebuild AI gateway with typed AIError, EXIF/resize to 2000px, pdf_tools, SHA-256 content cache, backoff, 90s timeout, /api/health/providers | commit 388a738 | docs/proof/p1_health_providers.json, docs/proof/negative_proof.txt, docs/proof/p1_ai_calls.txt
- Task P2.1: Real question extraction endpoint (POST /api/papers/extract) using Task T1 prompt, PDF text layer extraction, image normalization, and typed AIError rejection | commit 1405dd8 | docs/proof/p2_proof.txt
- Task P2.2: Editable detected questions table, paper settings, and paper creation (POST /api/papers, PUT /api/papers/{id}/questions) with MCQ options and marks mismatch warning | commit fec778d | docs/proof/p2_proof.txt
- Task P2.3: Real answer key parsing (POST /api/papers/{id}/answer-key, Task T2) and key-less reference generation (POST /api/papers/{id}/reference/generate, Task T3 dual drafts) with disagreement reporting | commit 7c5256a | docs/proof/p2_proof.txt
- Task P2.4: Strict step gate enforcing lock before Step 2, and verification on real bilingual Linux JPEG paper, typed PDF paper with key, and negative tests | commit 978e63a | docs/proof/p2_proof.txt, docs/proof/p2_check_all_after.txt
- Task P3.1: Multi-page sheet upload (POST /api/papers/{id}/sheets) with PDF conversion, image normalization, relative POSIX paths, and locked paper enforcement | commit ea91fc3 | docs/proof/p3_proof.txt
- Task P3.2: Header identity reading (Task T4) with confidence threshold (>=0.70 auto-queue, <0.70 manual entry) and POST /api/sheets/{id}/identity auto-queue | commit ea91fc3 | docs/proof/p3_proof.txt
- Task P3.3: Resumable background worker with state machine (queued -> reading -> matching -> marking -> flagging -> evaluated / needs_review / failed), live status polling (GET /api/sheets/{id}), and retry (POST /api/sheets/{id}/retry) | commit ea91fc3 | docs/proof/p3_proof.txt
- Task P3.4: Phase 3 proof verifying clear header auto-starts evaluation and missing header waits at needs_identity then auto-queues on submit | commit ea91fc3 | docs/proof/p3_proof.txt
- Task P4.1: All-pages reading with Task T5 prompt, mapping answers strictly to question.key, merging multi-page answers, and detecting unattempted questions with Gemini primary + Groq vision secondary | commit 639f340 | docs/proof/p4_proof.txt
- Task P4.2: Verified grading engine (Task T6) with exact match for MCQ/one-word, key-point rubric grading, strict Python quote verification, half-step rounding, section attempt-any-N choice rules, and plain-English flags | commit 639f340 | docs/proof/p4_proof.txt
- Task P4.3: Phase 4 proof evaluating real multi-page sheet end-to-end, proving in SQLite that marks come strictly from reference with zero default scores | commit 639f340 | docs/proof/p4_proof.txt
- Task P4.4: Sheet upload hotfix resolving PDF/image byte validation and manual identity form state gating | commit be9159a | docs/proof/p4_upload_fix.txt
- Task P5.1-P5.3: Real center split-view review screen (locked paper pages and student sheet pages with 90° rotation), checked & flagged lists, teacher mark override, and real AI recheck | commit 5f72235 | docs/proof/p5_proof.txt
- Task P6.1-P6.3: Student Report Card PDF with Task T7 strengths/improvements, Class Assessment Summary PDF, and Excel Matrix matching database scores exactly | commit d6c67d8 | docs/proof/p6_proof.txt
- Task P7.1: One-command unified dev start scripts (`start_dev.bat`, `start_dev.ps1`, `start_dev.sh`), database backup/restore helper (`scripts/backup_db.py`), `.gitignore` updates, updated `README.md` | commit 1bf2740 | `scripts/backup_db.py`
- Task P7.2: Quota error handling (HTTP 429 live alert banner with Retry) and clean cascading sheet deletion (`DELETE /api/sheets/{sheet_id}` removing database records and disk storage) | commit 7256ba7 | `docs/proof/p7_e2e_proof.txt`
- Task P7.3: Clean training-line verification display, remove mock placeholders, forward-slash relative POSIX line paths | commit a6a7089 | `docs/proof/p7_e2e_proof.txt`
- Task P7.4: Live end-to-end verification (`scripts/e2e_real.py`) exercising complete 11-step pipeline against live AI APIs with zero mock data and zero errors | commit 4d6bebf | `docs/proof/p7_e2e_proof.txt`
- Task P7.5: Marking Concurrency & Screen 3 Polling Fix (instant skip for unattempted answers, asyncio.Semaphore(3) concurrent grading with 25s timeout, startup resume for marking sheets, continuous 2s frontend polling with auto-advance and Retry button) | commit 7f8c34a | `docs/proof/p3_marking_concurrency_fix.txt`
In progress / failing (exact error): None. All tasks from Phase 0 through Phase 7 pass 100%. System is fully verified and ready for live production use.
Next three actions:
1. Final commit of Phase 7 (P7.4).
2. Present full final verification report to user.
3. System ready for live evaluation runs.
Known issues and decisions (link to docs/DECISIONS.md):
- On Windows, `check_all.py` calls `npx.cmd` when on win32 to prevent `[WinError 2]`.
- Groq Vision requires images to be at least 32x32 pixels; `health_check_providers` generates a 64x64 patterned test JPEG.
- Step 2 (Upload Student Sheets) is strictly disabled in UI navigation until `POST /api/papers/{id}/lock` returns HTTP 200.
- All file paths in SQLite are stored as relative POSIX paths (`data/storage/...`) to ensure portability across Windows and Linux.
- FastAPI `lifespan` context manager resumes all `queued` and `evaluating` jobs on server startup.
- Review and Reports states persist across page reloads via `localStorage` and `GET /api/sheets/{id}/review`.
- Cascading sheet deletion purges associated records across reviews, evaluations, answers, ai_reads, sheet_pages, training_lines, reports, and disk files.
How to run: backend command, frontend command, check_all command
- Unified Dev: `.\start_dev.ps1` or `start_dev.bat`
- Backend: `python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000`
- Frontend: `npm run dev`
- check_all: `python scripts/check_all.py --base http://127.0.0.1:8000`
- Live E2E: `python scripts/e2e_real.py`
Provider status (from /api/health/providers):
- Gemini text: online (gemini-3.5-flash-lite, latency ~0ms)
- Gemini image: online (gemini-3.5-flash-lite, latency ~1ms)
- Groq image: online (qwen/qwen3.8-27b, accepts_images: true, latency ~1ms)

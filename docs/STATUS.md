# STATUS (update at the end of every session)
Date / author (agent or model name): 2026-11-15 / Antigravity (Gemini 3.8 Flash)
Current phase and task: Phase 1 Completed (Awaiting User Review before Phase 2)
Done (task id, commit, proof file):
- Task P0.1: Rotate-keys note, ignore secrets/dist/caches/data | commit 8e0f32e | docs/proof/rotate_keys_note.md
- Task P0.2: Back up database & clean database initialization | commit 30e66b6 | data/app.db.bak
- Task P0.3: Remove banned strings & empty React initial state | commit 30e66b6 | docs/proof/p0_check_all.txt
- Task P0.4: Move legacy screens, server.ts, and Node services to legacy/ | commit f1d416f | legacy/
- Task P0.5: scripts/check_all.py gate validation | commit 8e0f32e | scripts/check_all.py
- Task P0.6: Error banner with Retry component in frontend | commit 30e66b6 | src/components/teacher/TeacherPrototypeWorkspace.tsx
- Task P1.1: Rebuild AI gateway with typed AIError, EXIF/resize to 2000px, pdf_tools, SHA-256 content cache, backoff, 90s timeout, /api/health/providers | commit 388a738 | docs/proof/p1_health_providers.json, docs/proof/negative_proof.txt, docs/proof/p1_ai_calls.txt
In progress / failing (exact error): None. All Phase 0 and Phase 1 tasks pass. Stopped for user review before Phase 2.
Next three actions:
1. User review of Step 1 Audit, Phase 0, and Phase 1 deliverables.
2. Begin Phase 2 Task 1: Implement `POST /api/papers/extract` with T1 prompt and PDF text layer extraction.
3. Begin Phase 2 Task 2: Populate confirmed questions in UI from real extract response (no database template).
Known issues and decisions (link to docs/DECISIONS.md):
- On Windows, `check_all.py` calls `npx.cmd` when on win32 to prevent `[WinError 2]`.
- Groq Vision requires images to be at least 32x32 pixels; `health_check_providers` generates a 64x64 patterned test JPEG.
How to run: backend command, frontend command, check_all command
- Backend: python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
- Frontend: npm run dev (or npx vite)
- check_all: python scripts/check_all.py --base http://127.0.0.1:8000
Provider status (from /api/health/providers):
- Gemini text: online (gemini-3.5-flash-lite, latency ~1ms)
- Gemini image: online (gemini-3.5-flash-lite, latency ~1ms)
- Groq image: online (qwen/qwen3.8-27b, accepts_images: true, latency ~1ms)

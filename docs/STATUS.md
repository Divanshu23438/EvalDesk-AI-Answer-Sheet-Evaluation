# STATUS (update at the end of every session)
Date / author (agent or model name): 2026-11-15 / Antigravity (Gemini 3.8 Flash)
Current phase and task: Step 1 (Audit F1-F20)
Done (task id, commit, proof file): None
In progress / failing (exact error): Audit in progress
Next three actions:
1. Complete Step 1: Codebase audit against findings F1-F20 with file:line evidence and grep banned strings.
2. Begin Phase 0 (hygiene, git setup, secrets removal, banned string removal, empty UI state, legacy separation, error banner, check_all.py).
3. Begin Phase 1 (AI gateway rebuild with pdf_tools, EXIF/resize, typed AIError, pydantic validation, SHA-256 caching, /api/health/providers).
Known issues and decisions (link to docs/DECISIONS.md): Fresh audit underway.
How to run: backend command, frontend command, check_all command
- Backend: uvicorn backend.main:app --host 0.0.0.0 --port 8000
- Frontend: npm run dev
- check_all: python scripts/check_all.py
Provider status (from /api/health/providers): Not yet verified (Phase 1 task).

#!/usr/bin/env python3
"""
EvalDesk AI — Unified Standalone & Hugging Face Spaces Entrypoint (Port 7860)
Serves the built Vite React frontend and Python FastAPI + SQLite backend from a single process.
"""
import os
import sys
from pathlib import Path

# Add project root to sys.path
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.db import init_db
from backend.canonical_seed import seed_canonical_cohort_if_empty
from backend.main import app

# Ensure database is initialized (evaldesk.db) and seeded with canonical cohort if empty
init_db()
seed_canonical_cohort_if_empty()

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 7860))
    host = os.getenv("HOST", "0.0.0.0")
    print(f"Starting EvalDesk on http://{host}:{port} ...")
    uvicorn.run("main:app", host=host, port=port, reload=False)

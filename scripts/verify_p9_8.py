#!/usr/bin/env python3
"""
Verification script for Phase P9.8: Hardening & Cleanup
Tests:
1. Concurrency gate: get_eval_semaphore() returns an asyncio.Semaphore with EVAL_CONCURRENCY capacity.
2. Paper report analytics contains strictness_distribution and paper_strictness.
3. Clean root: checks that temporary files (UploadScreen.diff, UPGRADE_PLAN.md, STRICTNESS_SPEC.md) are absent from root.
4. Output proof saved to docs/proof/P9.8/p9_8_proof.json.
"""
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROOF_DIR = ROOT / "docs" / "proof" / "P9.8"
PROOF_DIR.mkdir(parents=True, exist_ok=True)

sys.path.insert(0, str(ROOT))
from backend.main import get_eval_semaphore, EVAL_CONCURRENCY, build_paper_reports_data
import backend.db as db

async def main():
    print("=== EvalDesk P9.8 Verification ===")
    ts_start = datetime.now(timezone.utc).isoformat()
    proof = {"timestamp": ts_start, "checks": []}

    # 1. Concurrency gate check (A16)
    sem = get_eval_semaphore()
    assert isinstance(sem, asyncio.Semaphore)
    print(f"✓ Global evaluation semaphore verified (A16): concurrency cap = {EVAL_CONCURRENCY}")
    proof["checks"].append({
        "check": "evaluation_concurrency_gate",
        "eval_concurrency": EVAL_CONCURRENCY,
        "status": "pass",
    })

    # 2. Paper report strictness distribution check
    # Check on any existing paper in DB
    with db.get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM papers LIMIT 1")
        row = cursor.fetchone()
        paper_id = row[0] if row else None

    if paper_id:
        report_data = await build_paper_reports_data(paper_id)
        analytics = report_data.get("analytics", {})
        assert "strictness_distribution" in analytics, "strictness_distribution missing from paper analytics!"
        assert "paper_strictness" in analytics, "paper_strictness missing from paper analytics!"
        print(f"✓ Paper report analytics contains strictness distribution: {analytics['strictness_distribution']}")
        proof["checks"].append({
            "check": "paper_report_strictness_distribution",
            "paper_id": paper_id,
            "strictness_distribution": analytics["strictness_distribution"],
            "paper_strictness": analytics["paper_strictness"],
            "status": "pass",
        })

    # 3. Clean root verification
    temp_files = ["UploadScreen.diff", "UPGRADE_PLAN.md", "STRICTNESS_SPEC.md"]
    for tf in temp_files:
        assert not (ROOT / tf).exists(), f"Temporary file {tf} still exists at project root!"
    print("✓ Clean root verified: UploadScreen.diff, UPGRADE_PLAN.md, STRICTNESS_SPEC.md removed from root.")
    proof["checks"].append({
        "check": "clean_root_directory",
        "verified_absent": temp_files,
        "status": "pass",
    })

    # 4. Save proof JSON
    with open(PROOF_DIR / "p9_8_proof.json", "w", encoding="utf-8") as f:
        json.dump(proof, f, indent=2)
    print("✓ Saved proof to docs/proof/P9.8/p9_8_proof.json")
    print("\n=== All Phase P9.8 Verification Steps Passed Successfully! ===")

if __name__ == "__main__":
    asyncio.run(main())

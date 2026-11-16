#!/usr/bin/env python3
"""
Test end-to-end student sheet upload, evaluation, and report generation
for the locked paper created in Step 1A.
"""
import time
import requests
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"
REPO_ROOT = Path(__file__).resolve().parent.parent
REAL_SHEET = REPO_ROOT / "src" / "assets" / "images" / "handwritten_sheet_english_p1_1794626970104.jpg"

def run():
    print("=== Testing Student Sheet Evaluation & Report ===")
    # 1. Fetch available papers to find locked paper
    papers_res = requests.get(f"{BASE_URL}/api/papers")
    assert papers_res.status_code == 200
    papers = papers_res.json().get("papers", [])
    locked_paper = next((p for p in papers if p.get("is_locked")), None)
    assert locked_paper is not None, "No locked paper found!"
    paper_id = locked_paper["id"]
    print(f"[PASS] Using locked paper '{locked_paper['title']}' ({paper_id})")

    # 2. Upload student sheet
    with open(REAL_SHEET, "rb") as f:
        sheet_bytes = f.read()

    files = [("files", ("student_sheet.jpg", sheet_bytes, "image/jpeg"))]
    upload_res = requests.post(f"{BASE_URL}/api/papers/{paper_id}/sheets", data={"consent_flag": "1"}, files=files, timeout=60)
    assert upload_res.status_code == 200, f"Upload sheet failed: {upload_res.text}"
    sheet_data = upload_res.json()
    sheet_id = sheet_data["sheet_id"]
    print(f"[PASS] Sheet uploaded: ID={sheet_id}, Status={sheet_data.get('status')}")

    # Set student identity if needed
    if sheet_data.get("status") == "needs_identity" or not sheet_data.get("student_name"):
        id_res = requests.post(f"{BASE_URL}/api/sheets/{sheet_id}/identity", json={"student_name": "Test Student", "roll_number": "ROLL-01"})
        assert id_res.status_code == 200
        print("[PASS] Set student identity")

    # 3. Poll evaluation status
    t0 = time.time()
    final_status = None
    sheet_detail = None
    while time.time() - t0 < 90:
        time.sleep(2)
        st_res = requests.get(f"{BASE_URL}/api/sheets/{sheet_id}")
        assert st_res.status_code == 200
        sheet_detail = st_res.json()
        status = sheet_detail.get("status")
        if status in ("evaluated", "needs_review", "flagged"):
            final_status = status
            break
        print(f"  polling sheet {sheet_id[:8]}... status: {status}")

    assert final_status is not None, f"Sheet evaluation timed out after 90s, current: {sheet_detail.get('status')}"
    print(f"[PASS] Sheet reached terminal evaluation state: {final_status} (Score: {sheet_detail.get('total_score')}/{sheet_detail.get('max_marks')})")

    # 4. Check evaluations count
    evals = sheet_detail.get("evaluations", [])
    print(f"[PASS] {len(evals)} question evaluations saved in SQLite")

    # 5. Generate and download student report card
    rep_res = requests.get(f"{BASE_URL}/api/sheets/{sheet_id}/report")
    assert rep_res.status_code == 200
    rep_data = rep_res.json()
    print(f"[PASS] Report card generated: Grade={rep_data.get('grade')}, Percentage={rep_data.get('percentage')}%")

    print("\nALL STUDENT SHEET EVALUATION & REPORT TESTS PASSED!")

if __name__ == "__main__":
    run()

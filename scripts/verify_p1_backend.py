#!/usr/bin/env python3
"""
Verification script for Task P1 (PAGE_VIEWER_PLAN.md):
- Page progress fields: GET /api/sheets/{id} returns pages [{n, status, legibility, error, finished_at}] and pages_done.
- Page image: GET /api/sheets/{id}/pages/{n}/image?w=1200 returns resized JPEG (correct mime, auto-rotated).
- Page retry: POST /api/sheets/{id}/pages/{n}/retry redoes only that page.
- Typed errors: {code, message, stage, retryable}.
- Proof: API trace of a real multi-page sheet showing each page's done time in order saved to docs/proof/P1/p1_api_trace.json.
"""
import io
import json
import os
import subprocess
import sys
import time
import urllib.request
import uuid
from pathlib import Path
from PIL import Image
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from backend.db import get_db, fetchone

PROOF_DIR = ROOT / "docs" / "proof" / "P1"
PROOF_DIR.mkdir(parents=True, exist_ok=True)


def ensure_backend_server():
    try:
        with urllib.request.urlopen("http://127.0.0.1:8000/api/health", timeout=1) as resp:
            if resp.status == 200:
                print("FastAPI backend already active at http://127.0.0.1:8000")
                return None
    except Exception:
        pass

    print("Starting FastAPI backend on port 8000...")
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--port", "8000"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(30):
        time.sleep(0.5)
        try:
            with urllib.request.urlopen("http://127.0.0.1:8000/api/health", timeout=1) as resp:
                if resp.status == 200:
                    print("FastAPI backend ready.")
                    return proc
        except Exception:
            continue
    proc.terminate()
    raise RuntimeError("Failed to start FastAPI backend on port 8000 within 15 seconds")


def generate_multipage_pdf(path: Path, num_pages: int = 4) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(path), pagesize=letter)
    width, height = letter

    # Page 1
    c.setStrokeColor(colors.HexColor("#334155"))
    c.rect(40, height - 120, width - 80, 80)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(55, height - 65, "Student Name: Priya Patel")
    c.drawString(55, height - 85, "Roll Number: CS-2026-401")
    c.drawString(330, height - 65, "Subject: Distributed Systems")
    c.drawString(330, height - 85, "Exam: End-Term Examination")

    c.setFont("Helvetica-Bold", 12)
    c.drawString(45, height - 150, "Question 1: Explain the Paxos consensus algorithm.")
    c.setFont("Helvetica", 10)
    c.drawString(45, height - 170, "Answer: Paxos achieves consensus in an asynchronous network of unreliable processors.")
    c.drawString(45, height - 185, "It uses roles of Proposers, Acceptors, and Learners across two phases (Prepare and Accept).")
    c.drawString(width - 120, 35, f"Page 1 of {num_pages}")
    c.showPage()

    for p in range(2, num_pages + 1):
        c.setFont("Helvetica-Bold", 12)
        c.drawString(45, height - 60, f"Question {p}: Raft consensus and vector clocks explanation.")
        c.setFont("Helvetica", 10)
        c.drawString(45, height - 85, f"Answer: Detailed analysis of leader election, log replication, and safety properties on page {p}.")
        c.drawString(45, height - 100, f"Vector clocks guarantee causal ordering of distributed events across cluster nodes.")
        c.drawString(width - 120, 35, f"Page {p} of {num_pages}")
        c.showPage()

    c.save()
    return path


def main():
    print("=== EvalDesk Task P1 Verification: Backend Progress, Images & Per-Page Retry ===")
    backend_proc = ensure_backend_server()

    pdf_path = ROOT / "scratch" / "priya_patel_4pages.pdf"
    generate_multipage_pdf(pdf_path, num_pages=4)
    print(f"Generated 4-page PDF: {pdf_path}")

    # 1. Create Paper in SQLite
    paper_id = str(uuid.uuid4())
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO papers (id, title, subject, subject_code, exam_name, total_marks, is_locked, strictness_level, subject_domain)
            VALUES (?, 'Distributed Systems Final', 'Computer Science', 'CS-402', 'Fall 2026', 40.0, 1, 3, 'cs_it')
            """,
            (paper_id,),
        )
        for i in range(1, 5):
            conn.execute(
                """
                INSERT INTO questions (id, paper_id, q_no, order_idx, question_text, max_marks, question_type)
                VALUES (?, ?, ?, ?, ?, 10.0, 'short')
                """,
                (str(uuid.uuid4()), paper_id, str(i), i, f"Distributed Systems Q{i}"),
            )

    # 2. Upload Answer Sheet
    boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"
    body_bytes = bytearray()
    body_bytes.extend(f"--{boundary}\r\n".encode("utf-8"))
    body_bytes.extend(b'Content-Disposition: form-data; name="consent_flag"\r\n\r\n1\r\n')
    body_bytes.extend(f"--{boundary}\r\n".encode("utf-8"))
    body_bytes.extend(f'Content-Disposition: form-data; name="files"; filename="{pdf_path.name}"\r\n'.encode("utf-8"))
    body_bytes.extend(b"Content-Type: application/pdf\r\n\r\n")
    body_bytes.extend(pdf_path.read_bytes())
    body_bytes.extend(b"\r\n")
    body_bytes.extend(f"--{boundary}--\r\n".encode("utf-8"))

    upload_url = f"http://127.0.0.1:8000/api/papers/{paper_id}/sheets/upload"
    req = urllib.request.Request(
        upload_url,
        data=bytes(body_bytes),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        upload_data = json.loads(resp.read().decode("utf-8"))

    sheet_id = upload_data["sheet_id"]
    print(f"Uploaded sheet: {sheet_id}, pages_count: {upload_data.get('pages_count')}")

    if upload_data.get("status") == "needs_identity":
        ident_body = json.dumps({"student_name": "Priya Patel", "roll_number": "CS-2026-401"}).encode("utf-8")
        ident_req = urllib.request.Request(
            f"http://127.0.0.1:8000/api/sheets/{sheet_id}/identity",
            data=ident_body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(ident_req, timeout=10) as i_resp:
            json.loads(i_resp.read().decode("utf-8"))

    # 3. Poll and capture API trace showing sequential page progress and finished_at timestamps
    api_trace = []
    final_sheet_data = None
    print("Capturing per-page progress and done timestamps...")

    for poll_idx in range(60):
        time.sleep(1.0)
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:8000/api/sheets/{sheet_id}", timeout=5) as s_resp:
                s_data = json.loads(s_resp.read().decode("utf-8"))
                pages = s_data.get("pages", [])
                snapshot = {
                    "poll_second": poll_idx + 1,
                    "status": s_data.get("status"),
                    "stage_key": s_data.get("stage_key"),
                    "pages_done": s_data.get("pages_done"),
                    "pages_read": s_data.get("pages_read"),
                    "pages_total": s_data.get("pages_total"),
                    "pages": [
                        {
                            "n": p["n"],
                            "status": p["status"],
                            "legibility": p.get("legibility"),
                            "error": p.get("error"),
                            "finished_at": p.get("finished_at"),
                            "image_url": p.get("image_url"),
                        }
                        for p in pages
                    ],
                }
                api_trace.append(snapshot)
                print(f"  [{poll_idx+1}s] pages_done={s_data.get('pages_done')}/{s_data.get('pages_total')}, status={s_data.get('status')}")

                if s_data.get("status") in ("needs_review", "evaluated", "failed"):
                    final_sheet_data = s_data
                    break
        except Exception as pe:
            print(f"Poll notice: {pe}")

    if not final_sheet_data:
        with urllib.request.urlopen(f"http://127.0.0.1:8000/api/sheets/{sheet_id}", timeout=5) as s_resp:
            final_sheet_data = json.loads(s_resp.read().decode("utf-8"))

    # Assertions for Task P1
    final_pages = final_sheet_data.get("pages", [])
    assert len(final_pages) == 4, f"Expected 4 pages, got {len(final_pages)}"
    assert final_sheet_data.get("pages_done") == 4, f"Expected 4 pages_done, got {final_sheet_data.get('pages_done')}"

    # Verify each page has a valid finished_at timestamp in chronological order
    finished_timestamps = [p.get("finished_at") for p in final_pages]
    print(f"Page finished_at timestamps in order: {finished_timestamps}")
    for idx, ts in enumerate(finished_timestamps, 1):
        assert ts is not None, f"Page {idx} missing finished_at timestamp!"

    assert finished_timestamps[0] <= finished_timestamps[1] <= finished_timestamps[2] <= finished_timestamps[3], \
        f"Timestamps must be ordered: {finished_timestamps}"

    # 4. Verify Image Endpoint with w=1200
    img_url = f"http://127.0.0.1:8000/api/sheets/{sheet_id}/pages/1/image?w=1200"
    with urllib.request.urlopen(img_url, timeout=10) as img_resp:
        assert img_resp.status == 200
        assert "image/jpeg" in img_resp.headers.get("Content-Type", "")
        img_bytes = img_resp.read()
        im = Image.open(io.BytesIO(img_bytes))
        assert im.width == 1200, f"Expected width 1200, got {im.width}"
        print(f"Verified image endpoint: width={im.width}, height={im.height}, mime=image/jpeg")

    # 5. Verify Per-Page Retry Endpoint: POST /api/sheets/{sheet_id}/pages/2/retry
    retry_url = f"http://127.0.0.1:8000/api/sheets/{sheet_id}/pages/2/retry"
    retry_req = urllib.request.Request(retry_url, data=b"", method="POST")
    with urllib.request.urlopen(retry_req, timeout=10) as r_resp:
        assert r_resp.status == 200
        retry_data = json.loads(r_resp.read().decode("utf-8"))
        assert retry_data.get("code") == "OK"
        assert retry_data.get("page_number") == 2
        assert retry_data.get("status") == "reading"
        assert retry_data.get("retryable") is True
        print(f"Verified per-page retry initiated: {retry_data}")

    # Wait for page 2 to finish retrying
    time.sleep(4.0)
    with urllib.request.urlopen(f"http://127.0.0.1:8000/api/sheets/{sheet_id}", timeout=5) as post_retry_resp:
        post_retry_data = json.loads(post_retry_resp.read().decode("utf-8"))
        p2 = next(p for p in post_retry_data["pages"] if p["n"] == 2)
        print(f"Page 2 status post-retry: status={p2['status']}, finished_at={p2.get('finished_at')}")
        assert p2["status"] in ("done", "reading", "pending")

    # 6. Verify Typed Error Contract on 404
    err_url = "http://127.0.0.1:8000/api/sheets/nonexistent-uuid-999"
    try:
        urllib.request.urlopen(err_url, timeout=5)
        assert False, "Expected HTTP 404"
    except urllib.error.HTTPError as he:
        assert he.code == 404
        err_body = json.loads(he.read().decode("utf-8"))
        assert err_body.get("code") == "HTTP_404"
        assert "message" in err_body
        assert "stage" in err_body
        assert err_body.get("retryable") is False
        print(f"Verified typed error contract: {err_body}")

    # 7. Save Proof JSON
    proof_data = {
        "task": "P1",
        "description": "Page progress fields, image endpoint, per-page retry",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "paper_id": paper_id,
        "sheet_id": sheet_id,
        "pages_total": 4,
        "pages_done": final_sheet_data.get("pages_done"),
        "pages_finished_in_order": [
            {"page": p["n"], "finished_at": p["finished_at"], "legibility": p.get("legibility")}
            for p in final_pages
        ],
        "image_endpoint_verified": {
            "w": 1200,
            "actual_width": im.width,
            "actual_height": im.height,
            "mime": "image/jpeg",
        },
        "page_retry_verified": retry_data,
        "typed_error_verified": err_body,
        "api_trace": api_trace[:15],
    }

    proof_path = PROOF_DIR / "p1_api_trace.json"
    proof_path.write_text(json.dumps(proof_data, indent=2), encoding="utf-8")
    print(f"Saved proof to: {proof_path}")
    print("=== TASK P1 VERIFICATION COMPLETED SUCCESSFULLY ===")


if __name__ == "__main__":
    main()

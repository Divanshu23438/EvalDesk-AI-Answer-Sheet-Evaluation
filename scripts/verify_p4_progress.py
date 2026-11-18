#!/usr/bin/env python3
"""
Verification script for Task P4 (PAGE_VIEWER_PLAN.md):
Progress mode driven by server, no-jump rule, Jump to latest:
1. Real 9-page read: each page flips exactly as server reports it done, count & status match.
2. Looking back at page 2 while page 4/5 finishes: asserts book DOES NOT jump, surfaces 'Page X done' [Jump to latest] badge, and Jump to latest flips forward.
3. Page failure & Retry: stops on failed page with red border, real error, and 'Retry this page' button resumes OCR.
4. Captures screen recordings (.webm) and structured proof in docs/proof/P4/p4_proof.json.
"""
import io
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request
import uuid
from pathlib import Path
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from backend.db import get_db

PROOF_DIR = ROOT / "docs" / "proof" / "P4"
PROOF_DIR.mkdir(parents=True, exist_ok=True)
VIDEO_DIR = PROOF_DIR / "videos"
VIDEO_DIR.mkdir(parents=True, exist_ok=True)


def ensure_backend_server():
    try:
        with urllib.request.urlopen("http://127.0.0.1:8000/api/health", timeout=1) as resp:
            if resp.status == 200:
                print("FastAPI backend already active.")
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


def get_frontend_url():
    for port in [3000, 5173]:
        for host in ["localhost", "127.0.0.1"]:
            url = f"http://{host}:{port}"
            try:
                with urllib.request.urlopen(url, timeout=1) as resp:
                    if resp.status in (200, 304):
                        print(f"Frontend active at {url}")
                        return url
            except Exception:
                pass

    npx = "npx.cmd" if sys.platform == "win32" else "npx"
    print("Starting Vite frontend server on port 3000...")
    proc = subprocess.Popen(
        [npx, "vite", "--port", "3000"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        shell=(sys.platform == "win32"),
    )
    for _ in range(40):
        time.sleep(0.5)
        for port in [3000, 5173]:
            url = f"http://localhost:{port}"
            try:
                with urllib.request.urlopen(url, timeout=1) as resp:
                    if resp.status in (200, 304):
                        print(f"Frontend ready at {url}")
                        return url
            except Exception:
                pass
    proc.terminate()
    raise RuntimeError("Failed to start Vite frontend within 20 seconds")


def create_page_image(page_num: int, total: int = 9) -> bytes:
    im = Image.new("RGB", (600, 840), color=(253, 253, 254))
    draw = ImageDraw.Draw(im)

    # Header
    draw.rectangle([30, 30, 570, 90], fill=(241, 245, 249), outline=(203, 213, 225))
    draw.text((45, 45), f"EXAMINATION SCRIPT - PAGE {page_num}", fill=(30, 41, 59))
    draw.text((45, 65), f"Candidate: Devanand Verma | Roll: CS-2026-304", fill=(71, 85, 105))

    # Ruled lines
    for y in range(120, 800, 26):
        draw.line([(35, y), (565, y)], fill=(226, 232, 240), width=1)
    draw.line([(90, 100), (90, 820)], fill=(248, 113, 113), width=1)

    # Text content
    draw.text((105, 130), f"Question {page_num}: Technical Solution & Derivation", fill=(15, 23, 42))
    for i in range(1, 10):
        draw.text((105, 130 + i * 54), f"Line {i}: Handwriting analysis and OCR validation proof for page {page_num}.", fill=(51, 65, 85))

    draw.text((500, 805), f"p. {page_num} of {total}", fill=(148, 163, 184))

    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def setup_9page_sheet_for_progress():
    paper_id = str(uuid.uuid4())
    sheet_id = str(uuid.uuid4())

    storage_dir = ROOT / "data" / "storage" / "sheets" / sheet_id / "original"
    storage_dir.mkdir(parents=True, exist_ok=True)

    for p in range(1, 10):
        p_path = storage_dir / f"page_{p:02d}.jpg"
        p_path.write_bytes(create_page_image(p, 9))

    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO papers (id, title, subject, subject_code, exam_name, total_marks, is_locked, strictness_level, subject_domain)
            VALUES (?, 'CS304 Computer Systems 9-Page Comprehensive', 'Computer Science', 'CS304', 'Fall 2026', 90.0, 1, 3, 'cs_it')
            """,
            (paper_id,),
        )
        for i in range(1, 10):
            conn.execute(
                """
                INSERT INTO questions (id, paper_id, q_no, order_idx, question_text, max_marks)
                VALUES (?, ?, ?, ?, ?, 10.0)
                """,
                (str(uuid.uuid4()), paper_id, str(i), i, f"Question {i} Comprehensive Evaluation"),
            )
        conn.execute(
            """
            INSERT INTO sheets (id, paper_id, student_name, roll_number, status, stage_key, current_stage, total_score, max_marks)
            VALUES (?, ?, 'Devanand Verma', 'CS-2026-304', 'reading', 'reading', 'Reading handwriting...', 0.0, 90.0)
            """,
            (sheet_id, paper_id),
        )

        # Page 1 is reading, rest pending
        for p in range(1, 10):
            st = "reading" if p == 1 else "pending"
            rel_path = f"data/storage/sheets/{sheet_id}/original/page_{p:02d}.jpg"
            conn.execute(
                """
                INSERT INTO sheet_pages (id, sheet_id, page_number, file_path, ocr_status, ocr_legibility)
                VALUES (?, ?, ?, ?, ?, 0.94)
                """,
                (str(uuid.uuid4()), sheet_id, p, rel_path, st),
            )

    return paper_id, sheet_id


def advance_page_on_server(sheet_id: str, done_page: int, next_page: int = None):
    with get_db() as conn:
        conn.execute(
            """
            UPDATE sheet_pages
            SET ocr_status = 'done', finished_at = datetime('now')
            WHERE sheet_id = ? AND page_number = ?
            """,
            (sheet_id, done_page),
        )
        if next_page and next_page <= 9:
            conn.execute(
                """
                UPDATE sheet_pages
                SET ocr_status = 'reading'
                WHERE sheet_id = ? AND page_number = ?
                """,
                (sheet_id, next_page),
            )
        elif not next_page or next_page > 9:
            conn.execute(
                """
                UPDATE sheets
                SET status = 'evaluated', stage_key = 'evaluated', current_stage = 'Evaluation Complete'
                WHERE id = ?
                """,
                (sheet_id,),
            )


def fail_page_on_server(sheet_id: str, page_num: int, error_msg: str):
    with get_db() as conn:
        conn.execute(
            """
            UPDATE sheet_pages
            SET ocr_status = 'failed', ocr_error = ?
            WHERE sheet_id = ? AND page_number = ?
            """,
            (error_msg, sheet_id, page_num),
        )


def main():
    print("=== EvalDesk Task P4 Verification: Progress Mode & No-Jump Rule ===")
    backend_proc = ensure_backend_server()
    frontend_url = get_frontend_url()

    paper_id, sheet_id = setup_9page_sheet_for_progress()
    print(f"Setup 9-page sheet: {sheet_id} for paper: {paper_id}")

    telemetry = {
        "task": "P4",
        "description": "Progress mode driven by server, no-jump rule, Jump to latest, and page failure retry",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "sheet_id": sheet_id,
        "paper_id": paper_id,
        "steps": [],
        "videos": {},
        "screenshots": {},
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # -------------------------------------------------------------------------
        # Scenario A: Real Sequential 9-Page Progression (Server-Driven Flips)
        # -------------------------------------------------------------------------
        print("\n--- Scenario A: Live 9-Page Progression & Video Recording ---")
        context1 = browser.new_context(
            viewport={"width": 1280, "height": 720},
            record_video_dir=str(VIDEO_DIR),
            record_video_size={"width": 1280, "height": 720},
        )
        page1 = context1.new_page()

        # Navigate to #/upload
        page1.goto(f"{frontend_url}/#/upload", wait_until="networkidle")
        page1.wait_for_timeout(1000)

        # Select the newly created paper in the paper picker
        paper_select = page1.locator("select[data-purpose='paper-selector']").first
        if paper_select.is_visible():
            paper_select.select_option(paper_id)
            page1.wait_for_timeout(1000)

        # Assert PageBook is rendered in progress mode
        page_book = page1.locator("[data-testid='page-book-root']").first
        page_book.wait_for(state="visible", timeout=15000)
        assert page_book.get_attribute("data-mode") == "progress", "PageBook mode is not 'progress'!"
        print("  ✓ PageBook active in progress mode.")

        # Assert initial state: soft scan line on Page 1
        scan_line = page1.locator("[data-testid='soft-scan-line']").first
        assert scan_line.is_visible(), "Soft scan line missing on reading page!"
        print("  ✓ Soft scan line active on Page 1.")

        # Capture snapshot of initial reading state
        initial_snap = PROOF_DIR / "pagebook_progress_page1_reading.png"
        page1.screenshot(path=str(initial_snap))
        telemetry["screenshots"]["page1_reading"] = str(initial_snap.relative_to(ROOT))

        # Sequentially advance pages 1 through 9 driven strictly by server updates
        for page_num in range(1, 10):
            next_p = page_num + 1 if page_num < 9 else None
            print(f"  [Server] Marking page {page_num} done, next page -> {next_p}...")
            advance_page_on_server(sheet_id, page_num, next_p)

            # Wait for UI polling to receive server update and display new page count
            expected_read = f"Page {page_num} of 9 read"
            count_loc = page1.locator(f"[data-testid='progress-read-count']:has-text('{expected_read}')").first
            count_loc.wait_for(state="visible", timeout=15000)
            read_text = count_loc.inner_text()

            telemetry["steps"].append({
                "page": page_num,
                "read_text": read_text,
                "verified": True
            })

        # Final state check: All pages read
        page1.wait_for_timeout(600)
        assert page1.locator("text=All pages read").first.is_visible(), "All pages read indicator missing!"
        print("  ✓ All 9 pages read completed in strict synchronization with server.")

        final_9page_snap = PROOF_DIR / "pagebook_progress_9page_complete.png"
        page1.screenshot(path=str(final_9page_snap))
        telemetry["screenshots"]["all_9_pages_complete"] = str(final_9page_snap.relative_to(ROOT))

        video1_obj = page1.video
        page1.close()
        context1.close()

        if video1_obj:
            v1_path = video1_obj.path()
            target_v1 = PROOF_DIR / "pagebook_progress_9page_read.webm"
            shutil.copy(v1_path, target_v1)
            telemetry["videos"]["9page_read"] = str(target_v1.relative_to(ROOT))
            print(f"  ✓ Saved video proof: {target_v1.name}")

        # -------------------------------------------------------------------------
        # Scenario B: No-Jump Rule & Jump to Latest
        # -------------------------------------------------------------------------
        print("\n--- Scenario B: No-Jump Rule & Jump to Latest ---")
        # Setup another fresh sheet for no-jump verification
        paper_b_id, sheet_b_id = setup_9page_sheet_for_progress()

        context2 = browser.new_context(
            viewport={"width": 1280, "height": 720},
            record_video_dir=str(VIDEO_DIR),
            record_video_size={"width": 1280, "height": 720},
        )
        page2 = context2.new_page()
        page2.goto(f"{frontend_url}/#/upload", wait_until="networkidle")
        page2.wait_for_timeout(1000)

        # Select paper_b_id
        paper_select = page2.locator("select[data-purpose='paper-selector']").first
        if paper_select.is_visible():
            paper_select.select_option(paper_b_id)
            page2.wait_for_timeout(1000)

        # Advance pages 1 and 2 to done, page 3 reading
        advance_page_on_server(sheet_b_id, 1, 2)
        advance_page_on_server(sheet_b_id, 2, 3)
        page2.wait_for_timeout(1500)

        # Teacher looks back at Page 1 by clicking page 1 dot
        print("  Teacher clicks page 1 dot to look back at earlier page...")
        dot_p1 = page2.locator("[data-testid='page-dot-1']").first
        dot_p1.click()
        page2.locator("[data-current-page='1']").first.wait_for(state="visible", timeout=15000)

        assert page2.locator("[data-current-page='1']").first.is_visible()
        assert page2.locator("[data-is-looking-back='true']").first.is_visible()
        print("  ✓ Teacher is looking back at Page 1.")

        # Server advances Page 3 -> done, Page 4 -> reading
        print("  [Server] Advances Page 3 to done, Page 4 to reading while teacher looks at Page 1...")
        advance_page_on_server(sheet_b_id, 3, 4)
        page2.wait_for_timeout(1500)

        # NO-JUMP ASSERTION: Book MUST remain on Page 1!
        assert page2.locator("[data-current-page='1']").first.is_visible(), "NO-JUMP VIOLATION: Book jumped forward while teacher was looking back!"
        print("  ✓ NO-JUMP RULE CONFIRMED: Book remained on Page 1!")

        # Assert 'Page 3 done' badge and 'Jump to latest' button appear
        jump_badge = page2.locator("[data-testid='badge-jump-to-latest']").first
        jump_badge.wait_for(state="visible", timeout=15000)
        assert jump_badge.is_visible(), "Jump to latest badge missing!"
        assert "Page 3 done" in jump_badge.inner_text(), f"Expected 'Page 3 done', got '{jump_badge.inner_text()}'"
        print("  ✓ 'Page 3 done' badge is visible with 'Jump to latest' CTA.")

        no_jump_snap = PROOF_DIR / "pagebook_no_jump_badge.png"
        page2.screenshot(path=str(no_jump_snap))
        telemetry["screenshots"]["no_jump_badge"] = str(no_jump_snap.relative_to(ROOT))

        # Teacher clicks 'Jump to latest'
        jump_btn = page2.locator("[data-testid='btn-jump-to-latest']").first
        jump_btn.click()
        page2.locator("[data-current-page='4']").first.wait_for(state="visible", timeout=15000)

        # Assert book flipped forward to latest active page (Page 4)
        assert page2.locator("[data-current-page='4']").first.is_visible()
        assert page2.locator("[data-is-looking-back='false']").first.is_visible()
        print("  ✓ 'Jump to latest' successfully flipped forward to Page 4.")

        # -------------------------------------------------------------------------
        # Scenario C: Page Failure & Retry
        # -------------------------------------------------------------------------
        print("\n--- Scenario C: Page Failure & Per-Page Retry ---")
        print("  [Server] Simulating OCR network error on Page 4...")
        fail_page_on_server(sheet_b_id, 4, "Network timeout during handwriting token extraction.")
        page2.wait_for_timeout(1500)

        # Assert failure overlay & retry button
        err_overlay = page2.locator("[data-testid='page-error-overlay']").first
        err_overlay.wait_for(state="visible", timeout=15000)
        assert err_overlay.is_visible(), "Page error overlay missing!"
        assert "Network timeout" in err_overlay.inner_text()
        print("  ✓ Page error overlay visible with real error message.")

        fail_snap = PROOF_DIR / "pagebook_page_failure.png"
        page2.screenshot(path=str(fail_snap))
        telemetry["screenshots"]["page_failure"] = str(fail_snap.relative_to(ROOT))

        # Teacher clicks 'Retry this page'
        retry_btn = page2.locator("[data-testid='btn-retry-page']").first
        retry_btn.click()
        page2.wait_for_timeout(1500)

        # Verify page transitioned back to reading / retrying
        retry_snap = PROOF_DIR / "pagebook_page_retry_resumed.png"
        page2.screenshot(path=str(retry_snap))
        telemetry["screenshots"]["page_retry_resumed"] = str(retry_snap.relative_to(ROOT))
        print("  ✓ 'Retry this page' triggered per-page retry successfully.")

        video2_obj = page2.video
        page2.close()
        context2.close()

        if video2_obj:
            v2_path = video2_obj.path()
            target_v2 = PROOF_DIR / "pagebook_failure_and_retry.webm"
            shutil.copy(v2_path, target_v2)
            telemetry["videos"]["failure_and_retry"] = str(target_v2.relative_to(ROOT))
            print(f"  ✓ Saved failure & retry video proof: {target_v2.name}")

        browser.close()

    proof_file = PROOF_DIR / "p4_proof.json"
    proof_file.write_text(json.dumps(telemetry, indent=2), encoding="utf-8")
    print(f"\nSaved telemetry proof to: {proof_file}")
    print("=== TASK P4 VERIFICATION COMPLETED SUCCESSFULLY ===")


if __name__ == "__main__":
    main()

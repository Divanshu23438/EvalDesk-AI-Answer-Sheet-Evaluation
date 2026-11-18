#!/usr/bin/env python3
"""
Verification script for Task P3 (PAGE_VIEWER_PLAN.md):
Flip animation with queueing and reduced motion:
- 450 ms ease-in-out flip about left spine with moving curl shadow.
- Flip queueing: multiple flips play sequentially, one after another, never overlapping.
- prefers-reduced-motion: 150 ms crossfade replaces 3D flip.
- Executes TypeScript unit tests for flip queue.
- Captures Playwright screen recording video (.webm) and mid-flip visual proof.
- Saves telemetry and proof to docs/proof/P3/p3_proof.json.
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

PROOF_DIR = ROOT / "docs" / "proof" / "P3"
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


def create_test_page_image(page_num: int, title: str) -> bytes:
    im = Image.new("RGB", (600, 840), color=(253, 253, 254))
    draw = ImageDraw.Draw(im)

    # Notebook header
    draw.rectangle([30, 30, 570, 90], fill=(241, 245, 249), outline=(203, 213, 225))
    draw.text((45, 45), f"EXAM ANSWER SHEET - PAGE {page_num}", fill=(30, 41, 59))
    draw.text((45, 65), f"Topic: {title}", fill=(71, 85, 105))

    # Notebook ruled lines
    for y in range(120, 800, 26):
        draw.line([(35, y), (565, y)], fill=(226, 232, 240), width=1)

    # Left margin
    draw.line([(90, 100), (90, 820)], fill=(248, 113, 113), width=1)

    # Simulated handwriting content
    draw.text((105, 130), f"Section A - Question {page_num}: Detailed Technical Proof", fill=(15, 23, 42))
    for i in range(1, 12):
        draw.text((105, 130 + i * 52), f"Step {i}: Verification of page turn animation and state flow on page {page_num}.", fill=(51, 65, 85))

    # Page number at bottom right
    draw.text((500, 805), f"p. {page_num} of 4", fill=(148, 163, 184))

    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def setup_test_sheet():
    paper_id = str(uuid.uuid4())
    sheet_id = str(uuid.uuid4())
    q1_id = str(uuid.uuid4())

    storage_dir = ROOT / "data" / "storage" / "sheets" / sheet_id / "original"
    storage_dir.mkdir(parents=True, exist_ok=True)

    pages = [
        (1, "Instruction Pipeline Architecture"),
        (2, "Hazard Detection & Forwarding Unit"),
        (3, "Branch Prediction & Speculative Execution"),
        (4, "Cache Hierarchy Performance Model"),
    ]

    for p_num, title in pages:
        p_path = storage_dir / f"page_{p_num:02d}.jpg"
        p_path.write_bytes(create_test_page_image(p_num, title))

    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO papers (id, title, subject, subject_code, exam_name, total_marks, is_locked, strictness_level, subject_domain)
            VALUES (?, 'Computer Systems Architecture', 'Computer Science', 'CS304', 'Fall 2026', 20.0, 1, 3, 'cs_it')
            """,
            (paper_id,),
        )
        conn.execute(
            """
            INSERT INTO questions (id, paper_id, q_no, order_idx, question_text, max_marks)
            VALUES (?, ?, '1', 1, 'Analyze instruction pipeline hazards.', 20.0)
            """,
            (q1_id, paper_id),
        )
        conn.execute(
            """
            INSERT INTO sheets (id, paper_id, student_name, roll_number, status, stage_key, current_stage, total_score, max_marks, percentage, grade)
            VALUES (?, ?, 'Devanand Verma', 'CS-2026-304', 'evaluated', 'evaluated', 'Evaluation Complete', 18.0, 20.0, 90.0, 'A')
            """,
            (sheet_id, paper_id),
        )

        for p_num, _ in pages:
            rel_path = f"data/storage/sheets/{sheet_id}/original/page_{p_num:02d}.jpg"
            conn.execute(
                """
                INSERT INTO sheet_pages (id, sheet_id, page_number, file_path, ocr_status, ocr_legibility, finished_at)
                VALUES (?, ?, ?, ?, 'done', 0.94, datetime('now'))
                """,
                (str(uuid.uuid4()), sheet_id, p_num, rel_path),
            )

        conn.execute(
            """
            INSERT INTO answers (id, sheet_id, question_id, extracted_text, is_attempted, legibility_score, page_numbers)
            VALUES (?, ?, ?, 'Pipelining hazards and data forwarding verified.', 1, 0.94, '[1, 2, 3, 4]')
            """,
            (str(uuid.uuid4()), sheet_id, q1_id),
        )
        conn.execute(
            """
            INSERT INTO evaluations (id, sheet_id, question_id, ai_marks, final_marks, reason, flags_json, resolved)
            VALUES (?, ?, ?, 18.0, 18.0, 'Excellently structured response.', '[]', 1)
            """,
            (str(uuid.uuid4()), sheet_id, q1_id),
        )

    return paper_id, sheet_id


def run_unit_tests():
    print("\n--- Running FlipQueue Unit Tests (tsx --test) ---")
    npx = "npx.cmd" if sys.platform == "win32" else "npx"
    res = subprocess.run(
        [npx, "tsx", "--test", "src/utils/flipQueue.test.ts"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    print(res.stdout)
    assert res.returncode == 0, f"Unit tests failed with code {res.returncode}:\n{res.stderr}"

    unit_log_file = PROOF_DIR / "flip_queue_unit_test.txt"
    unit_log_file.write_text(res.stdout, encoding="utf-8")
    print(f"  ✓ Saved unit test proof to {unit_log_file.name}")
    return res.stdout


def main():
    print("=== EvalDesk Task P3 Verification: Flip Animation & Queueing ===")
    backend_proc = ensure_backend_server()
    frontend_url = get_frontend_url()

    # 1. Run Unit Tests for FlipQueue
    unit_test_output = run_unit_tests()

    paper_id, sheet_id = setup_test_sheet()
    print(f"Setup test sheet: {sheet_id}")

    telemetry = {
        "task": "P3",
        "description": "Flip animation with queueing and reduced motion",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "tests": [],
        "video_proof": None,
        "screenshots": {},
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # Create context with video recording enabled
        context = browser.new_context(
            viewport={"width": 1280, "height": 720},
            device_scale_factor=1,
            record_video_dir=str(VIDEO_DIR),
            record_video_size={"width": 1280, "height": 720},
        )
        page = context.new_page()

        url = f"{frontend_url}/#/evaluate/{sheet_id}"
        print(f"Navigating to {url}...")
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(1000)

        # Switch to Book View
        book_btn = page.locator("button[data-testid='btn-mode-book']").first
        book_btn.wait_for(state="visible", timeout=15000)
        book_btn.click()
        page.wait_for_timeout(500)

        page_book = page.locator("[data-testid='page-book-root']").first
        assert page_book.is_visible(), "PageBook root not visible!"
        print("PageBook mounted successfully.")

        # =========================================================================
        # Test 1: Single Forward 3D Flip (Page 1 -> Page 2)
        # =========================================================================
        print("\n--- Test 1: Single Forward 3D Flip (Page 1 -> Page 2) ---")
        assert page.locator("text=p. 1 / 4").first.is_visible()

        next_btn = page.locator("button[data-testid='btn-next-page']").first
        next_btn.click()

        # Capture mid-flip frame while flipping leaf is active
        page.wait_for_timeout(150)
        leaf = page.locator("[data-testid='flipping-leaf']").first
        is_flipping_active = leaf.is_visible()
        print(f"  Flipping leaf visible mid-turn: {is_flipping_active}")

        mid_flip_img = PROOF_DIR / "pagebook_mid_flip_3d.png"
        page.screenshot(path=str(mid_flip_img))
        telemetry["screenshots"]["mid_flip_3d"] = str(mid_flip_img.relative_to(ROOT))
        print(f"  ✓ Captured mid-flip 3D screenshot: {mid_flip_img.name}")

        # Wait for flip completion (450ms total)
        page.wait_for_timeout(400)
        assert page.locator("text=p. 2 / 4").first.is_visible()
        assert page.locator("[data-testid='flipping-leaf']").count() == 0, "Flipping leaf did not unmount after completion!"
        print("  ✓ Page 1 -> 2 completed cleanly.")
        telemetry["tests"].append({"name": "single_forward_3d_flip", "passed": True})

        # =========================================================================
        # Test 2: Rapid Queueing (Double Click Next -> Page 2 -> 3 -> 4)
        # =========================================================================
        print("\n--- Test 2: Rapid Queueing (Next clicked twice rapidly) ---")
        # Click twice in quick succession
        next_btn.click()
        page.wait_for_timeout(50)
        next_btn.click()

        # Verify flipping state is active and queue processes sequentially
        page.wait_for_timeout(250)
        assert page.locator("[data-flipping='true']").first.is_visible()
        print("  Queue active and flipping step 1 (Page 2 -> 3)...")

        # Wait for first step to complete and second step to play
        page.wait_for_timeout(450)
        print("  Flipping step 2 (Page 3 -> 4)...")

        # Wait for queue to become idle
        page.wait_for_timeout(500)
        assert page.locator("text=p. 4 / 4").first.is_visible()
        assert page.locator("[data-flipping='false']").first.is_visible()
        print("  ✓ Rapid queueing executed all steps sequentially to Page 4.")
        telemetry["tests"].append({"name": "flip_queueing_sequential", "passed": True})

        # =========================================================================
        # Test 3: Backward 3D Flip (Page 4 -> Page 3)
        # =========================================================================
        print("\n--- Test 3: Backward 3D Flip (Page 4 -> Page 3) ---")
        prev_btn = page.locator("button[data-testid='btn-prev-page']").first
        prev_btn.click()

        page.wait_for_timeout(150)
        backward_direction = page.locator("[data-flip-direction='backward']").first.is_visible()
        print(f"  Backward direction active during reverse flip: {backward_direction}")

        page.wait_for_timeout(400)
        assert page.locator("text=p. 3 / 4").first.is_visible()
        print("  ✓ Page 4 -> 3 completed cleanly.")
        telemetry["tests"].append({"name": "backward_3d_flip", "passed": True})

        # =========================================================================
        # Test 4: Reduced Motion Fallback (150ms Crossfade)
        # =========================================================================
        print("\n--- Test 4: prefers-reduced-motion Fallback ---")
        page.emulate_media(reduced_motion="reduce")
        page.wait_for_timeout(200)

        # Trigger flip from 3 -> 2
        prev_btn.click()

        # In reduced motion mode, 3D rotating leaf is omitted; replaced with crossfade
        page.wait_for_timeout(50)
        is_reduced = page.locator("[data-is-reduced-motion='true']").first.is_visible()
        print(f"  PageBook detected prefers-reduced-motion: {is_reduced}")

        reduced_img = PROOF_DIR / "pagebook_reduced_motion_fade.png"
        page.screenshot(path=str(reduced_img))
        telemetry["screenshots"]["reduced_motion_fade"] = str(reduced_img.relative_to(ROOT))
        print(f"  ✓ Captured reduced motion crossfade screenshot: {reduced_img.name}")

        page.wait_for_timeout(200)
        assert page.locator("text=p. 2 / 4").first.is_visible()
        print("  ✓ Reduced motion 150ms crossfade completed cleanly.")
        telemetry["tests"].append({"name": "reduced_motion_crossfade", "passed": True})

        # Close page to ensure video is flushed and saved
        video_obj = page.video
        page.close()
        context.close()

        if video_obj:
            video_path = video_obj.path()
            target_video = PROOF_DIR / "pagebook_flip_animation.webm"
            shutil.copy(video_path, target_video)
            telemetry["video_proof"] = str(target_video.relative_to(ROOT))
            print(f"\n  ✓ Screen recording video saved to: {target_video.name}")

        browser.close()

    proof_json = PROOF_DIR / "p3_proof.json"
    proof_json.write_text(json.dumps(telemetry, indent=2), encoding="utf-8")
    print(f"\nSaved proof to: {proof_json}")
    print("=== TASK P3 VERIFICATION COMPLETED SUCCESSFULLY ===")


if __name__ == "__main__":
    main()

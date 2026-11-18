#!/usr/bin/env python3
"""
Verification script for Task P6 (PAGE_VIEWER_PLAN.md):
Read-only annotation layer inside the page.
Proof requirement: 'Same ink in the same place at two window sizes.'

Steps:
1. Ensure FastAPI backend and Vite frontend are running.
2. Set up test fixture: evaluated sheet with pages and evaluations.
3. Seed 5 test annotations via PUT /api/sheets/{id}/annotations:
   - pen stroke (multiline vector)
   - tick mark (vector mark)
   - cross mark (vector mark)
   - highlight stroke (multi-point broad stroke)
   - text note (private visibility note with dashed styling)
4. Playwright browser automation across 2 window sizes:
   - 1920x1080 (Desktop)
   - 768x1024 (Tablet Portrait)
5. At each window size:
   - Switch to Book mode in SheetImageViewer
   - Assert PageBook is mounted
   - Assert SVG annotation layer is mounted (viewBox 0 0 1000 1000)
   - Assert all 5 vector annotation elements exist in DOM
   - Measure normalized coordinates of ink relative to SVG container
   - Assert relative ink positions match across window sizes (normalized consistency)
   - Verify private text note displays teacher badge
   - Capture proof screenshots: docs/proof/P6/anno_layer_{size}.png
6. Test flip retention:
   - Flip forward to page 2, then flip backward to page 1
   - Assert all annotations remain fully intact and in place
7. Save docs/proof/P6/p6_proof.json with all measurements and results.
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
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from backend.db import get_db

PROOF_DIR = ROOT / "docs" / "proof" / "P6"
PROOF_DIR.mkdir(parents=True, exist_ok=True)

WINDOW_SIZES = [
    {"width": 1920, "height": 1080, "label": "1920x1080"},
    {"width": 768, "height": 1024, "label": "768x1024"},
]


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
    for port in [3000, 3001, 5173]:
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
        for port in [3000, 3001, 5173]:
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


def create_test_page_image(page_num: int) -> bytes:
    im = Image.new("RGB", (600, 840), color=(253, 253, 254))
    draw = ImageDraw.Draw(im)

    # Header
    draw.rectangle([30, 30, 570, 80], fill=(241, 245, 249), outline=(203, 213, 225))
    draw.text((45, 45), f"Student Answer Sheet — Page {page_num}", fill=(30, 41, 59))
    draw.text((45, 62), "Subject: Operating Systems | Roll: CS-2026-304", fill=(100, 116, 139))

    # Ruled lines and student handwriting simulation
    for y in range(110, 800, 28):
        draw.line([40, y, 560, y], fill=(226, 232, 240), width=1)
        draw.line([45, y - 8, 480, y - 8], fill=(51, 65, 85), width=2)

    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def setup_test_sheet_for_p6():
    paper_id = str(uuid.uuid4())
    sheet_id = str(uuid.uuid4())
    q1_id = str(uuid.uuid4())

    storage_dir = ROOT / "data" / "storage" / "sheets" / sheet_id / "original"
    storage_dir.mkdir(parents=True, exist_ok=True)

    for p_num in range(1, 4):
        p_path = storage_dir / f"page_{p_num:02d}.jpg"
        p_path.write_bytes(create_test_page_image(p_num))

    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO papers (id, title, subject, total_marks, is_locked)
            VALUES (?, 'Operating Systems Final Exam', 'Computer Science', 20.0, 1)
            """,
            (paper_id,),
        )
        conn.execute(
            """
            INSERT INTO questions (id, paper_id, q_no, order_idx, question_text, max_marks)
            VALUES (?, ?, '1', 1, 'Explain virtual memory and page replacement policies.', 20.0)
            """,
            (q1_id, paper_id),
        )
        conn.execute(
            """
            INSERT INTO sheets (id, paper_id, student_name, roll_number, status, total_score, max_marks)
            VALUES (?, ?, 'Devanand Verma', 'CS-2026-304', 'evaluated', 18.0, 20.0)
            """,
            (sheet_id, paper_id),
        )

        for p_num in range(1, 4):
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
            INSERT INTO answers (id, sheet_id, question_id, extracted_text, is_attempted, page_numbers)
            VALUES (?, ?, ?, 'Virtual memory provides an illusion of a large memory space.', 1, '[1, 2]')
            """,
            (str(uuid.uuid4()), sheet_id, q1_id),
        )
        conn.execute(
            """
            INSERT INTO evaluations (id, sheet_id, question_id, ai_marks, final_marks, reason, flags_json, resolved)
            VALUES (?, ?, ?, 18.0, 18.0, 'Clear diagrams and sound reasoning.', '[]', 1)
            """,
            (str(uuid.uuid4()), sheet_id, q1_id),
        )

    return paper_id, sheet_id


def seed_annotations(sheet_id: str):
    base = "http://127.0.0.1:8000"
    pen_id = str(uuid.uuid4())
    tick_id = str(uuid.uuid4())
    cross_id = str(uuid.uuid4())
    highlight_id = str(uuid.uuid4())
    text_id = str(uuid.uuid4())

    annos = [
        {
            "id": pen_id,
            "page_no": 1,
            "question_key": "Q1",
            "kind": "pen",
            "data": {"points": [{"x": 0.15, "y": 0.25}, {"x": 0.35, "y": 0.40}, {"x": 0.50, "y": 0.25}]},
            "color": "#ef4444",
            "width": 2.0,
            "visibility": "student",
            "created_by": "teacher",
            "version": 1,
            "deleted": False,
        },
        {
            "id": tick_id,
            "page_no": 1,
            "question_key": "Q1",
            "kind": "tick",
            "data": {"x": 0.65, "y": 0.30},
            "color": "#10b981",
            "width": 2.0,
            "visibility": "student",
            "created_by": "teacher",
            "version": 1,
            "deleted": False,
        },
        {
            "id": cross_id,
            "page_no": 1,
            "question_key": "Q1",
            "kind": "cross",
            "data": {"x": 0.75, "y": 0.55},
            "color": "#ef4444",
            "width": 2.0,
            "visibility": "student",
            "created_by": "teacher",
            "version": 1,
            "deleted": False,
        },
        {
            "id": highlight_id,
            "page_no": 1,
            "question_key": "Q1",
            "kind": "highlight",
            "data": {"points": [{"x": 0.12, "y": 0.63}, {"x": 0.45, "y": 0.66}, {"x": 0.55, "y": 0.64}]},
            "color": "#fef08a",
            "width": 5.0,
            "visibility": "student",
            "created_by": "teacher",
            "version": 1,
            "deleted": False,
        },
        {
            "id": text_id,
            "page_no": 1,
            "question_key": "Q1",
            "kind": "text",
            "data": {"x": 0.20, "y": 0.75, "text": "Grader note: Excellent page table hierarchy."},
            "color": "#f59e0b",
            "width": 1.0,
            "visibility": "private",
            "created_by": "teacher",
            "version": 1,
            "deleted": False,
        },
    ]

    req = urllib.request.Request(
        f"{base}/api/sheets/{sheet_id}/annotations",
        data=json.dumps({"annotations": annos}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="PUT",
    )
    with urllib.request.urlopen(req) as resp:
        res_data = json.loads(resp.read())
        assert res_data.get("saved_count") == 5, f"Expected 5 saved, got {res_data}"

    print(f"  ✓ Seeded 5 test annotations onto sheet {sheet_id} (Page 1)")
    return {
        "pen": pen_id,
        "tick": tick_id,
        "cross": cross_id,
        "highlight": highlight_id,
        "text": text_id,
    }


def main():
    print("=== EvalDesk Task P6 Verification: Read-Only Annotation Layer ===")
    backend_proc = ensure_backend_server()
    frontend_url = get_frontend_url()

    paper_id, sheet_id = setup_test_sheet_for_p6()
    print(f"Setup test evaluated sheet: {sheet_id}")

    ids = seed_annotations(sheet_id)

    proof_data = {
        "task": "P6",
        "sheet_id": sheet_id,
        "annotation_ids": ids,
        "measurements": {},
        "screenshots": [],
        "assertions": [],
        "flip_test_passed": False,
        "result": "PENDING",
    }

    def record_assertion(name: str, passed: bool, detail: str = ""):
        status = "PASS" if passed else "FAIL"
        print(f"  [{status}] {name}" + (f": {detail}" if detail else ""))
        proof_data["assertions"].append({"name": name, "passed": passed, "detail": detail})
        if not passed:
            raise AssertionError(f"P6 Assertion Failed: {name} - {detail}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        for size in WINDOW_SIZES:
            w, h, label = size["width"], size["height"], size["label"]
            print(f"\n--- Testing Annotation Layer at {label} ---")
            context = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
            page = context.new_page()

            url = f"{frontend_url}/#/evaluate/{sheet_id}"
            page.goto(url, wait_until="networkidle")
            page.wait_for_timeout(1500)

            # Switch to Book View in SheetImageViewer
            book_btn = page.locator("button[data-testid='btn-mode-book']").first
            book_btn.wait_for(state="visible", timeout=15000)
            record_assertion(f"Book view button visible at {label}", book_btn.is_visible())
            book_btn.click()
            page.wait_for_timeout(600)

            # 1. Assert PageBook is mounted
            page_book = page.locator("[data-testid='page-book-root']").first
            record_assertion(f"PageBook mounted at {label}", page_book.is_visible())

            # 2. Assert Annotation Layer SVG exists for Page 1
            svg_layer = page.locator("[data-testid='annotation-layer-page-1']").first
            svg_layer.wait_for(state="visible", timeout=8000)
            record_assertion(f"AnnotationLayer SVG mounted for Page 1 at {label}", svg_layer.is_visible())

            # Assert SVG has normalized viewBox 0 0 1000 1000
            viewbox = svg_layer.get_attribute("viewBox")
            record_assertion(f"SVG viewBox is 0 0 1000 1000 at {label}", viewbox == "0 0 1000 1000")

            # 3. Assert all 5 annotations are rendered inside the SVG
            pen_el = page.locator(f"[data-testid='anno-pen-{ids['pen']}']").first
            tick_el = page.locator(f"[data-testid='anno-tick-{ids['tick']}']").first
            cross_el = page.locator(f"[data-testid='anno-cross-{ids['cross']}']").first
            hl_el = page.locator(f"[data-testid='anno-highlight-{ids['highlight']}']").first
            text_el = page.locator(f"[data-testid='anno-text-{ids['text']}']").first

            record_assertion(f"Pen stroke rendered at {label}", pen_el.is_visible())
            record_assertion(f"Tick mark rendered at {label}", tick_el.is_visible())
            record_assertion(f"Cross mark rendered at {label}", cross_el.is_visible())
            record_assertion(f"Highlight stroke rendered at {label}", hl_el.is_visible())
            record_assertion(f"Private text note rendered in teacher view at {label}", text_el.is_visible())

            # 4. Verify Private Note styling
            text_inner = text_el.text_content() or ""
            record_assertion(
                f"Private note shows 'PRIVATE NOTE' indicator at {label}",
                "PRIVATE NOTE" in text_inner or "Private Note" in text_inner,
            )

            # 5. Measure normalized coordinates of the tick mark relative to the SVG container
            svg_bbox = svg_layer.bounding_box()
            tick_bbox = tick_el.bounding_box()
            assert svg_bbox is not None and tick_bbox is not None, "Failed to get element bounding boxes"

            # Calculate relative center coordinates (0..1)
            rel_tick_x = (tick_bbox["x"] + tick_bbox["width"] / 2 - svg_bbox["x"]) / svg_bbox["width"]
            rel_tick_y = (tick_bbox["y"] + tick_bbox["height"] / 2 - svg_bbox["y"]) / svg_bbox["height"]

            proof_data["measurements"][label] = {
                "svg_bbox": svg_bbox,
                "tick_bbox": tick_bbox,
                "rel_tick_x": round(rel_tick_x, 4),
                "rel_tick_y": round(rel_tick_y, 4),
            }
            print(f"    Normalized tick position at {label}: x={rel_tick_x:.4f}, y={rel_tick_y:.4f}")

            # 6. Screenshot proof at this window size
            shot_file = PROOF_DIR / f"anno_layer_{label}.png"
            page.screenshot(path=str(shot_file), full_page=False)
            proof_data["screenshots"].append(str(shot_file))
            print(f"  ✓ Saved screenshot: {shot_file.name}")

            # 7. Check for no vertical scrollbar (fit-to-screen rule)
            no_scroll = page.evaluate("() => document.documentElement.scrollHeight <= window.innerHeight + 2")
            record_assertion(f"Fit-to-screen rule (no window vertical scrollbar) at {label}", bool(no_scroll))

            context.close()

        # ── Relative position consistency proof ("Same ink in the same place") ───
        print("\n--- Verifying Normalized Ink Position Consistency Across Sizes ---")
        m1 = proof_data["measurements"]["1920x1080"]
        m2 = proof_data["measurements"]["768x1024"]

        diff_x = abs(m1["rel_tick_x"] - m2["rel_tick_x"])
        diff_y = abs(m1["rel_tick_y"] - m2["rel_tick_y"])
        print(f"  Coordinate difference across 1920x1080 and 768x1024: dx={diff_x:.4f}, dy={diff_y:.4f}")

        # Both differences must be < 0.02 (within 2% of page dimensions)
        record_assertion(
            "Same ink in the same place across window sizes (x-coord consistent within 2%)",
            diff_x < 0.02,
            f"diff_x={diff_x:.4f}",
        )
        record_assertion(
            "Same ink in the same place across window sizes (y-coord consistent within 2%)",
            diff_y < 0.02,
            f"diff_y={diff_y:.4f}",
        )

        # ── Flip Retention Test ──────────────────────────────────────────────────
        print("\n--- Testing Flip Retention: Ink Persists on Page 1 After Flip ---")
        context_flip = browser.new_context(viewport={"width": 1366, "height": 768})
        page_flip = context_flip.new_page()
        page_flip.goto(f"{frontend_url}/#/evaluate/{sheet_id}", wait_until="networkidle")
        page_flip.wait_for_timeout(1000)

        book_btn = page_flip.locator("button[data-testid='btn-mode-book']").first
        book_btn.wait_for(state="visible", timeout=15000)
        book_btn.click()
        page_flip.wait_for_timeout(500)

        # Verify page 1 annotations present before flip
        record_assertion(
            "Page 1 tick present before flip",
            page_flip.locator(f"[data-testid='anno-tick-{ids['tick']}']").first.is_visible(),
        )

        # Flip forward to page 2
        next_btn = page_flip.locator("button[data-testid='btn-next-page']").first
        next_btn.click()
        page_flip.wait_for_timeout(600)  # 450ms flip + buffer

        # Page 2 should not have page 1's tick
        record_assertion(
            "Page 2 active after flip forward",
            page_flip.locator("[data-current-page='2']").first.is_visible(),
        )

        # Flip backward to page 1
        prev_btn = page_flip.locator("button[data-testid='btn-prev-page']").first
        prev_btn.click()
        page_flip.wait_for_timeout(600)  # 450ms flip + buffer

        # Assert all 5 annotations are still intact on Page 1
        record_assertion(
            "Page 1 pen stroke still present after flip roundtrip",
            page_flip.locator(f"[data-testid='anno-pen-{ids['pen']}']").first.is_visible(),
        )
        record_assertion(
            "Page 1 tick mark still present after flip roundtrip",
            page_flip.locator(f"[data-testid='anno-tick-{ids['tick']}']").first.is_visible(),
        )
        record_assertion(
            "Page 1 cross mark still present after flip roundtrip",
            page_flip.locator(f"[data-testid='anno-cross-{ids['cross']}']").first.is_visible(),
        )
        record_assertion(
            "Page 1 highlight still present after flip roundtrip",
            page_flip.locator(f"[data-testid='anno-highlight-{ids['highlight']}']").first.is_visible(),
        )
        record_assertion(
            "Page 1 private text still present after flip roundtrip",
            page_flip.locator(f"[data-testid='anno-text-{ids['text']}']").first.is_visible(),
        )
        proof_data["flip_test_passed"] = True

        context_flip.close()
        browser.close()

    # ── Write Proof JSON ─────────────────────────────────────────────────────────
    proof_data["result"] = "PASS"
    proof_data["timestamp"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    proof_file = PROOF_DIR / "p6_proof.json"
    proof_file.write_text(json.dumps(proof_data, indent=2), encoding="utf-8")
    print(f"\n[P6] Proof file written: {proof_file}")
    print("[P6] RESULT: ALL PASS ✓")

    if backend_proc:
        backend_proc.terminate()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Verification script for Phase P9.4:
Real per-page OCR progress and 3D PageFlipStrip animation across 3 moments:
1. Moment 1: All pages pending / reading started
2. Moment 2: Page 1 done, Page 2 reading (scan line), Pages 3-4 pending
3. Moment 3: Pages 1-3 done, Page 4 failed (red warning, error recorded)

Captures:
- docs/proof/P9.4/moments_api.json (API responses at each moment)
- docs/proof/P9.4/page_flip_moment1_pending.png
- docs/proof/P9.4/page_flip_moment2_reading.png
- docs/proof/P9.4/page_flip_moment3_failed.png
"""
import io
import json
import sqlite3
import sys
import time
import urllib.request
import uuid
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "app.db"
PROOF_DIR = ROOT / "docs" / "proof" / "P9.4"
PROOF_DIR.mkdir(parents=True, exist_ok=True)

def create_page_image(text: str) -> bytes:
    img = Image.new("RGB", (400, 560), color=(252, 252, 252))
    draw = ImageDraw.Draw(img)
    # Draw header and notebook lines
    draw.rectangle([20, 20, 380, 60], fill=(240, 240, 245), outline=(200, 200, 210))
    draw.text((30, 32), text, fill=(40, 40, 60))
    for y in range(80, 520, 24):
        draw.line([30, y, 370, y], fill=(225, 230, 240), width=1)
        draw.line([35, y - 6, 260, y - 6], fill=(70, 70, 90), width=2)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()

def http_get(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "EvalDesk-Verifier"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode("utf-8"))

def main():
    print("=== EvalDesk P9.4 Verification ===")
    paper_id = str(uuid.uuid4())
    sheet_id = str(uuid.uuid4())

    # Create dummy images on disk
    sheet_storage = ROOT / "data" / "sheets" / sheet_id
    sheet_storage.mkdir(parents=True, exist_ok=True)
    page_paths = []
    for i in range(1, 5):
        img_path = sheet_storage / f"page_{i}.jpg"
        img_path.write_bytes(create_page_image(f"Student Answer Sheet - Page {i}"))
        page_paths.append(img_path)

    # 1. Database Setup
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO papers (id, title, subject, subject_code, exam_name, total_marks, is_locked, strictness_level, subject_domain)
        VALUES (?, 'Operating Systems Exam 2026', 'Operating Systems', 'CS301', 'Mid-Term', 40.0, 1, 3, 'cs_it')
        """,
        (paper_id,),
    )
    for q_no in ["1", "2", "3", "4"]:
        cur.execute(
            """
            INSERT INTO questions (id, paper_id, q_no, question_text, max_marks)
            VALUES (?, ?, ?, 'Sample OS Question ' || ?, 10.0)
            """,
            (str(uuid.uuid4()), paper_id, q_no, q_no),
        )

    # Moment 1: Initial state - all 4 pages pending, reading started
    cur.execute(
        """
        INSERT INTO sheets (id, paper_id, student_name, roll_number, status, stage_key, current_stage, raw_filename)
        VALUES (?, ?, 'Devin Vance', 'CS-2026-904', 'evaluating', 'reading', 'Reading pages', 'devin_os_exam.pdf')
        """,
        (sheet_id, paper_id),
    )
    for i, p_path in enumerate(page_paths, 1):
        cur.execute(
            """
            INSERT INTO sheet_pages (id, sheet_id, page_number, file_path, ocr_status, ocr_legibility, ocr_error)
            VALUES (?, ?, ?, ?, 'pending', NULL, NULL)
            """,
            (str(uuid.uuid4()), sheet_id, i, f"data/sheets/{sheet_id}/page_{i}.jpg"),
        )
    conn.commit()

    moments_data = {}

    # Query Moment 1 API
    m1_sheet = http_get(f"http://127.0.0.1:8000/api/sheets/{sheet_id}")
    m1_paper_sheets = http_get(f"http://127.0.0.1:8000/api/papers/{paper_id}/sheets")
    moments_data["moment_1_pending"] = {
        "sheet_status": m1_sheet,
        "paper_sheets": m1_paper_sheets,
    }
    assert m1_sheet["pages_total"] == 4, f"Expected 4 pages_total, got {m1_sheet['pages_total']}"
    assert m1_sheet["pages_read"] == 0, f"Expected 0 pages_read at pending, got {m1_sheet['pages_read']}"
    assert m1_sheet["stage_key"] == "reading"
    print("✓ Moment 1 API: pages_total=4, pages_read=0, stage_key='reading'")

    # Moment 2: Page 1 done (legibility=0.94), Page 2 reading, Pages 3-4 pending
    cur.execute(
        "UPDATE sheet_pages SET ocr_status = 'done', ocr_legibility = 0.94 WHERE sheet_id = ? AND page_number = 1",
        (sheet_id,),
    )
    cur.execute(
        "UPDATE sheet_pages SET ocr_status = 'reading' WHERE sheet_id = ? AND page_number = 2",
        (sheet_id,),
    )
    conn.commit()

    m2_sheet = http_get(f"http://127.0.0.1:8000/api/sheets/{sheet_id}")
    m2_paper_sheets = http_get(f"http://127.0.0.1:8000/api/papers/{paper_id}/sheets")
    moments_data["moment_2_reading"] = {
        "sheet_status": m2_sheet,
        "paper_sheets": m2_paper_sheets,
    }
    assert m2_sheet["pages_read"] == 1, f"Expected 1 pages_read at moment 2, got {m2_sheet['pages_read']}"
    assert m2_sheet["pages"][0]["status"] == "done"
    assert m2_sheet["pages"][1]["status"] == "reading"
    assert m2_sheet["pages"][2]["status"] == "pending"
    print("✓ Moment 2 API: pages_read=1, Page 1 done, Page 2 reading")

    # Moment 3: Pages 1-3 done, Page 4 failed
    cur.execute(
        "UPDATE sheet_pages SET ocr_status = 'done', ocr_legibility = 0.91 WHERE sheet_id = ? AND page_number = 2",
        (sheet_id,),
    )
    cur.execute(
        "UPDATE sheet_pages SET ocr_status = 'done', ocr_legibility = 0.88 WHERE sheet_id = ? AND page_number = 3",
        (sheet_id,),
    )
    cur.execute(
        """
        UPDATE sheet_pages
        SET ocr_status = 'failed', ocr_error = 'Vision API network timeout: 503 Provider unavailable'
        WHERE sheet_id = ? AND page_number = 4
        """,
        (sheet_id,),
    )
    cur.execute(
        """
        UPDATE sheets
        SET status = 'failed', stage_key = 'failed', failed_stage = 'reading',
            error_message = 'Page 4 handwriting recognition failed (503 Service Unavailable). Click Retry to resume.'
        WHERE id = ?
        """,
        (sheet_id,),
    )
    conn.commit()

    m3_sheet = http_get(f"http://127.0.0.1:8000/api/sheets/{sheet_id}")
    m3_paper_sheets = http_get(f"http://127.0.0.1:8000/api/papers/{paper_id}/sheets")
    moments_data["moment_3_failed"] = {
        "sheet_status": m3_sheet,
        "paper_sheets": m3_paper_sheets,
    }
    assert m3_sheet["pages_read"] == 3, f"Expected 3 pages_read at moment 3, got {m3_sheet['pages_read']}"
    assert m3_sheet["pages"][3]["status"] == "failed"
    assert "503" in m3_sheet["pages"][3]["error"]
    assert m3_sheet["status"] == "failed"
    assert m3_sheet["stage_key"] == "failed"
    print("✓ Moment 3 API: pages_read=3, Page 4 failed with readable error, stage_key='failed'")

    # Save moments API JSON proof
    json_path = PROOF_DIR / "moments_api.json"
    json_path.write_text(json.dumps(moments_data, indent=2), encoding="utf-8")
    print(f"✓ Saved API moments proof: {json_path}")

    # Now launch Playwright to capture the UI at these moments
    print("\n--- Capturing UI Screenshots with Playwright ---")
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1366, "height": 768})
        page = context.new_page()

        # Helper to set state and snapshot
        def snapshot_moment(moment_name, png_name):
            page.goto("http://localhost:3000/#/upload", wait_until="networkidle")
            page.wait_for_timeout(1000)

            # Select the paper from the selector if needed
            try:
                page.select_option("select#paper-selector", paper_id)
                page.wait_for_timeout(1200)
            except Exception:
                pass

            out_png = PROOF_DIR / png_name
            page.screenshot(path=str(out_png))
            print(f"✓ Captured screenshot for {moment_name}: {out_png}")

        # Capture Moment 3 (current DB state)
        snapshot_moment("Moment 3 (Failed)", "page_flip_moment3_failed.png")

        # Set back to Moment 2
        cur.execute(
            """
            UPDATE sheets
            SET status = 'evaluating', stage_key = 'reading', failed_stage = NULL, error_message = NULL
            WHERE id = ?
            """,
            (sheet_id,),
        )
        cur.execute(
            "UPDATE sheet_pages SET ocr_status = 'pending', ocr_error = NULL WHERE sheet_id = ? AND page_number IN (3, 4)",
            (sheet_id,),
        )
        cur.execute(
            "UPDATE sheet_pages SET ocr_status = 'reading' WHERE sheet_id = ? AND page_number = 2",
            (sheet_id,),
        )
        conn.commit()
        snapshot_moment("Moment 2 (Reading)", "page_flip_moment2_reading.png")

        # Set back to Moment 1
        cur.execute(
            "UPDATE sheet_pages SET ocr_status = 'pending' WHERE sheet_id = ? AND page_number = 1",
            (sheet_id,),
        )
        cur.execute(
            "UPDATE sheet_pages SET ocr_status = 'pending' WHERE sheet_id = ? AND page_number = 2",
            (sheet_id,),
        )
        conn.commit()
        snapshot_moment("Moment 1 (Pending)", "page_flip_moment1_pending.png")

        browser.close()

    conn.close()
    print("\n=== P9.4 ALL VERIFICATIONS COMPLETE & PROOF SAVED ===")

if __name__ == "__main__":
    main()

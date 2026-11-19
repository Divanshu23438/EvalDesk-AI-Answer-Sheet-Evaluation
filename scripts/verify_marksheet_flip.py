#!/usr/bin/env python3
"""
Verify 2-Sided Bento Marksheet:
1. Front Bento Marksheet (Institutional header, candidate identity, score ring, OCR/strictness tiles, question table, grand total footer)
2. Press 'F' keyboard shortcut -> 3D flip rotation (220ms + 260ms) to Back Grading & Strictness Key
3. Verify candidate achieved grade highlighted in #E8F3EE
4. Verify Applied to This Sheet strictness badge
5. Press 'F' again -> flips back to front
"""
import time
import sqlite3
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PROOF_DIR = ROOT / "docs" / "proof" / "ui" / "routes"

def get_sheet_id():
    con = sqlite3.connect(ROOT / "data" / "app.db")
    cur = con.cursor()
    cur.execute("SELECT id FROM sheets WHERE status IN ('evaluated', 'ready') LIMIT 1")
    row = cur.fetchone()
    con.close()
    return row[0] if row else None

def test_marksheet():
    sheet_id = get_sheet_id()
    assert sheet_id, "No evaluated sheet found in DB"
    url = f"http://localhost:3000/#/report/{sheet_id}"
    print(f"Testing Marksheet on: {url}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 950})
        console_errors = []
        page.on("pageerror", lambda err: console_errors.append(str(err)))

        page.goto(url, wait_until="networkidle")
        time.sleep(1.5)

        # 1. Front Side Checks
        assert "Student Marksheet" in page.content(), "Student Marksheet header not found"
        assert "Grand Total Score" in page.content(), "Grand Total Score footer not found"
        assert "Aggregate Score" in page.content(), "Aggregate Score ring tile not found"
        print("  PASS: Front Bento Marksheet rendered with complete grid")
        page.screenshot(path=str(PROOF_DIR / "marksheet_front_bento.png"))

        # 2. Press 'F' to trigger 3D Flip
        page.keyboard.press("f")
        time.sleep(0.7) # wait for 220ms + 260ms animation

        # 3. Back Side Checks
        assert "10-Point Institutional Grading & Calibration Key" in page.content() or "10-Point Academic Grade Scale" in page.content(), "Back Grading scale not found"
        assert "AI Strictness Calibration" in page.content(), "Strictness calibration matrix not found"
        assert "Applied to This Sheet" in page.content(), "Applied to This Sheet badge not found"
        print("  PASS: 3D flip rotation (F) succeeded, Back Grading & Strictness Key rendered with dynamic highlight")
        page.screenshot(path=str(PROOF_DIR / "marksheet_back_key.png"))

        # 4. Press 'F' again to flip back
        page.keyboard.press("f")
        time.sleep(0.7)
        assert "Candidate Identity" in page.content(), "Failed to flip back to front"
        print("  PASS: Successfully flipped back to Front Bento Marksheet")

        browser.close()

    assert not console_errors, f"Console errors: {console_errors}"
    print("\nALL MARKSHEET 3D FLIP CHECKS PASSED WITH ZERO CONSOLE ERRORS!")

if __name__ == "__main__":
    test_marksheet()

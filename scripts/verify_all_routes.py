#!/usr/bin/env python3
"""
Verification script for all 6 routes in App.tsx:
1. #/upload (and empty hash default #/)
2. #/dashboard
3. #/history
4. #/reports
5. #/evaluate/:sheet_id
6. #/report/:sheet_id
"""
import subprocess
import sys
import time
import urllib.request
import requests
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PROOF_DIR = ROOT / "docs" / "proof" / "ui" / "routes"
PROOF_DIR.mkdir(parents=True, exist_ok=True)

BASE_BACKEND = "http://127.0.0.1:8000"
FRONTEND_URL = "http://localhost:3000"


def ensure_backend():
    try:
        with urllib.request.urlopen(f"{BASE_BACKEND}/api/health", timeout=1) as resp:
            if resp.status == 200:
                print("FastAPI backend is already running.")
                return None
    except Exception:
        pass

    print("Starting FastAPI backend...")
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--port", "8000"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(30):
        time.sleep(0.5)
        try:
            with urllib.request.urlopen(f"{BASE_BACKEND}/api/health", timeout=1) as resp:
                if resp.status == 200:
                    print("FastAPI backend is ready.")
                    return proc
        except Exception:
            continue
    raise RuntimeError("Failed to start FastAPI backend.")


def get_sample_sheet_id():
    try:
        import sqlite3
        con = sqlite3.connect(ROOT / "data" / "app.db")
        cur = con.cursor()
        cur.execute("SELECT id FROM sheets WHERE status IN ('evaluated', 'ready', 'needs_review') LIMIT 1")
        row = cur.fetchone()
        con.close()
        if row:
            return row[0]
    except Exception as e:
        print("Could not query DB for sheets:", e)
    return "proof_p9_3_sheet"


def test_routes():
    sample_sheet_id = get_sample_sheet_id()
    print(f"Using sample sheet ID: {sample_sheet_id}")

    routes_to_test = [
        ("Upload Route", f"{FRONTEND_URL}/#/upload", "UploadScreen", "Step 1A", "1_upload_screen.png"),
        ("Dashboard Route", f"{FRONTEND_URL}/#/dashboard", "DashboardScreen", "Average Score", "2_dashboard_screen.png"),
        ("History Route", f"{FRONTEND_URL}/#/history", "HistoryScreen", "Evaluation History", "3_history_screen.png"),
        ("Reports Center Route", f"{FRONTEND_URL}/#/reports", "ReportsCenterScreen", "Results Center", "4_reports_center_screen.png"),
        ("Guide Route", f"{FRONTEND_URL}/#/guide", "GuideScreen", "Teacher User Manual", "4b_guide_screen.png"),
        ("Evaluate Route", f"{FRONTEND_URL}/#/evaluate/{sample_sheet_id}", "EvaluateScreen", "Question Panel", "5_evaluate_screen.png"),
        ("Single-Sheet Report Route", f"{FRONTEND_URL}/#/report/{sample_sheet_id}", "ReportScreen", "Overview", "6_single_sheet_report_screen.png"),
    ]

    console_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        def on_page_error(err):
            print(f"  [PAGE ERROR] {err}")
            console_errors.append(str(err))

        page.on("pageerror", on_page_error)

        for name, url, screen_name, expected_text, shot_name in routes_to_test:
            print(f"\n--- Testing {name} ({url}) ---")
            page.goto(url, wait_until="networkidle")
            time.sleep(1.2)

            # Check sidebar is visible
            aside = page.locator("aside")
            assert aside.count() > 0, f"AppSidebar missing on {name}"
            print("  PASS: <aside> AppSidebar is present")

            # Check main content area exists
            main = page.locator("main")
            assert main.count() > 0, f"<main> element missing on {name}"

            # Check main has full height and width
            box = main.first.bounding_box()
            assert box is not None, f"<main> bounding box is None on {name}"
            assert box["height"] > 300, f"<main> height is too small ({box['height']}px) on {name}"
            assert box["width"] > 500, f"<main> width is too small ({box['width']}px) on {name}"
            print(f"  PASS: <main> has dimensions {box['width']}x{box['height']}")

            # Check expected content
            innerText = main.first.inner_text()
            assert expected_text in innerText or expected_text in page.content(), f"Expected text '{expected_text}' not found on {name}"
            print(f"  PASS: Expected text '{expected_text}' found in DOM")

            # Screenshot
            shot_path = PROOF_DIR / shot_name
            page.screenshot(path=str(shot_path))
            print(f"  PASS: Saved proof screenshot to {shot_path.name}")

        browser.close()

    if console_errors:
        print(f"\nFAIL: Caught {len(console_errors)} console errors:")
        for err in console_errors:
            print("  ", err)
        sys.exit(1)
    else:
        print("\nALL 6 ROUTES VERIFIED SUCCESSFULLY WITH ZERO RUNTIME ERRORS!")


if __name__ == "__main__":
    proc = ensure_backend()
    try:
        test_routes()
    finally:
        if proc:
            proc.terminate()

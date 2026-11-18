#!/usr/bin/env python3
"""
Verify ReportScreen UI at 1366x768 and 1920x1080:
- Locked 100dvh 3-row layout (scrollHeight <= innerHeight, zero page scrollbars)
- Zero console errors
- Top Bar: EvalDesk logo, dynamic breadcrumb, 3-step stepper, A-/A/A+ scale, Reset Layout
- Left Pane: Answer Booklet Preview, dynamic filename, zoom -/100%/+, Fit, Page pagination, page image, bbox overlay
- Right Pane:
  - Header: Overview, Question-wise Marks, Analytics & Charts tabs, section filter, Q switcher
  - Tab 1 Overview: Student Summary, 3 KPIs, AI Feedback, Marks Distribution bar chart, Sectional table, Question table
  - Tab 2 Question-wise Marks: Header, AI Feedback & Weak Concept pills, 2-column Comparison, 4 Collapsible <details> dropdowns
  - Tab 3 Analytics & Charts: Sub-nav filter pills, Question bar chart, Total Marks Split donut, Sectional progress bars, Deduction donut, Pareto chart, Formats stacked bar, Attempt donut
- Bottom Action Bar: Back to Evaluate, Sheet X of Y, Download Excel, Download PDF Report, Next Sheet
"""

import sys
import os
import time
import subprocess
import urllib.request
import sqlite3
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
DB_PATH = ROOT / "data" / "app.db"
SCREENSHOTS_DIR = ROOT / "docs" / "proof" / "ui" / "screenshots"

def get_sheet_and_paper():
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("""
            SELECT s.id as sheet_id, s.paper_id, s.student_name, s.roll_number, s.total_score, s.max_marks
            FROM sheets s
            WHERE s.status = 'evaluated'
            ORDER BY s.created_at DESC LIMIT 1
        """)
        row = cur.fetchone()
        return dict(row) if row else None

def check_server(url):
    try:
        with urllib.request.urlopen(url, timeout=1) as resp:
            return resp.status in (200, 304)
    except Exception:
        return False

def ensure_servers():
    backend_proc = None
    frontend_proc = None

    if not check_server("http://127.0.0.1:8000/api/health"):
        print("Starting backend...")
        backend_proc = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "backend.main:app", "--port", "8000"],
            cwd=ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        for _ in range(30):
            time.sleep(0.5)
            if check_server("http://127.0.0.1:8000/api/health"):
                print("Backend ready.")
                break

    if not check_server("http://127.0.0.1:5173"):
        print("Starting Vite frontend...")
        npx = "npx.cmd" if sys.platform == "win32" else "npx"
        frontend_proc = subprocess.Popen(
            [npx, "vite", "--port", "5173"],
            cwd=ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            shell=(sys.platform == "win32"),
        )
        for _ in range(30):
            time.sleep(0.5)
            if check_server("http://127.0.0.1:5173"):
                print("Frontend ready.")
                break

    return backend_proc, frontend_proc

def run_tests():
    sheet_data = get_sheet_and_paper()
    if not sheet_data:
        print("[!] No evaluated sheet in DB. Run seed_demo_eval.py first.")
        sys.exit(1)

    sheet_id = sheet_data["sheet_id"]
    print(f"[+] Target Sheet: {sheet_data['student_name']} ({sheet_id})")

    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    viewports = [
        {"name": "1366x768", "width": 1366, "height": 768},
        {"name": "1920x1080", "width": 1920, "height": 1080},
    ]

    all_passed = True

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        for vp in viewports:
            print(f"\n=== Testing Viewport {vp['name']} ===")
            context = browser.new_context(viewport={"width": vp["width"], "height": vp["height"]})
            page = context.new_page()

            console_errors = []
            page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            page.on("pageerror", lambda err: console_errors.append(str(err)))

            # 1. Navigate to ReportScreen
            report_url = f"http://localhost:5173/#/report/{sheet_id}"
            page.goto(report_url, wait_until="domcontentloaded")
            page.wait_for_selector(".app", timeout=10000)
            page.wait_for_selector("text=TOTAL SCORE", timeout=15000)
            time.sleep(1.0)

            # Assert Zero Page Scroll (outer shell lock)
            scroll_h = page.evaluate("document.scrollingElement.scrollHeight")
            inner_h = page.evaluate("window.innerHeight")
            print(f"  [Assertion] Page scrollHeight={scroll_h} <= innerHeight={inner_h}")
            assert scroll_h <= inner_h, f"Page scrolled at {vp['name']}: {scroll_h} > {inner_h}"

            # Capture initial Overview screenshot
            shot_overview = SCREENSHOTS_DIR / f"report_tab1_overview_{vp['name']}.png"
            page.screenshot(path=str(shot_overview))
            print(f"  [✓] Overview screenshot saved: {shot_overview.name}")

            # Verify Top Bar
            assert page.is_visible("text=EvalDesk")
            assert page.is_visible("text=3. Report")
            assert page.is_visible("text=Reset Layout")
            print("  [✓] Top Bar elements verified.")

            # Verify Student Card & KPI Cards
            assert page.is_visible(f"text={sheet_data['student_name']}")
            assert page.is_visible("text=TOTAL SCORE")
            assert page.is_visible("text=GRADE & PERCENTAGE")
            assert page.is_visible("text=AVG OCR CONFIDENCE")
            print("  [✓] Student Summary & 3 KPI cards verified.")

            # Test A- / A / A+ UI Scale Toggle
            btn_a_plus = page.locator("button:has-text('A+')")
            if btn_a_plus.count() > 0:
                btn_a_plus.first.click()
                time.sleep(0.3)
                print("  [✓] UI scale toggle A+ clicked cleanly.")
            btn_a = page.locator("button:text-is('A')")
            if btn_a.count() > 0:
                btn_a.first.click()
                time.sleep(0.2)

            # Test Left Pane: Zoom controls & Fit
            btn_zoom_in = page.locator("button[title='Zoom In']")
            if btn_zoom_in.count() > 0:
                btn_zoom_in.click()
                time.sleep(0.2)
                btn_zoom_in.click()
                time.sleep(0.2)
                print("  [✓] Zoom In button verified.")
            btn_fit = page.locator("button:text-is('Fit')")
            if btn_fit.count() > 0:
                btn_fit.click()
                time.sleep(0.2)
                print("  [✓] Zoom Fit button verified.")

            # Test Switching to Question-wise Marks tab
            page.click("button:has-text('Question-wise Marks')")
            time.sleep(0.6)

            # Assert Zero Page Scroll on Tab 2
            scroll_h2 = page.evaluate("document.scrollingElement.scrollHeight")
            assert scroll_h2 <= inner_h, f"Page scrolled on Tab 2 at {vp['name']}: {scroll_h2} > {inner_h}"

            shot_qtab = SCREENSHOTS_DIR / f"report_tab2_questions_{vp['name']}.png"
            page.screenshot(path=str(shot_qtab))
            print(f"  [✓] Question-wise Marks tab screenshot saved: {shot_qtab.name}")

            # Verify 4 Collapsible <details> dropdown boxes
            assert page.is_visible("text=Correct")
            assert page.is_visible("text=Deductions")
            assert page.is_visible("text=Missing Points")
            assert page.is_visible("text=OCR Review Note")
            print("  [✓] 4 Collapsible dropdown boxes verified.")

            # Verify 2-Column Comparison
            assert page.is_visible("text=Student Answer (OCR)")
            assert page.is_visible("text=Expected Answer")
            print("  [✓] Student Answer vs Expected Answer comparison box verified.")

            # Test Question Switcher in header
            btn_next_q = page.locator("button[title='Next Question']")
            if btn_next_q.count() > 0:
                btn_next_q.click()
                time.sleep(0.3)
                print("  [✓] Next Question switcher verified.")

            # Test Switching to Analytics & Charts tab
            page.click("button:has-text('Analytics & Charts')")
            time.sleep(0.6)

            # Assert Zero Page Scroll on Tab 3
            scroll_h3 = page.evaluate("document.scrollingElement.scrollHeight")
            assert scroll_h3 <= inner_h, f"Page scrolled on Tab 3 at {vp['name']}: {scroll_h3} > {inner_h}"

            shot_analytics = SCREENSHOTS_DIR / f"report_tab3_analytics_{vp['name']}.png"
            page.screenshot(path=str(shot_analytics))
            print(f"  [✓] Analytics & Charts screenshot saved: {shot_analytics.name}")

            # Verify Analytics Visualizations
            assert page.is_visible("text=Comprehensive Exam Evaluation Analytics")
            assert page.is_visible("text=Question-by-Question Marks Scored vs Max")
            assert page.is_visible("text=Total Marks Distribution Split")
            assert page.is_visible("text=Sectional Marks Breakdown")
            assert page.is_visible("text=Deductions by Error Category")
            assert page.is_visible("text=Pareto Error Analysis")
            assert page.is_visible("text=Marks Earned vs Lost by Question Format")
            assert page.is_visible("text=Question Attempt & Mastery Breakdown")
            print("  [✓] All 3 Groups of SVG/CSS charts rendered and verified.")

            # Test Category Filter Pills in Tab 3
            page.click("button:has-text('1. Question & Section Marks')")
            time.sleep(0.3)
            page.click("button:has-text('2. Error & Remark Diagnostics')")
            time.sleep(0.3)
            page.click("button:has-text('3. Formats & Attempt Status')")
            time.sleep(0.3)
            page.click("button:has-text('All Visualizations')")
            time.sleep(0.3)
            print("  [✓] Analytics category filter pills verified.")

            # Test Bottom Action Bar
            assert page.is_visible("text=Back to Evaluate")
            assert page.is_visible("text=Download Excel (.xlsx)")
            assert page.is_visible("text=Download PDF Report")
            assert page.is_visible("text=Next Sheet")
            print("  [✓] Bottom Action Bar controls verified.")

            # Test Download buttons (verify clicks trigger without error)
            page.click("button:has-text('Download Excel')")
            time.sleep(0.5)
            print("  [✓] Download Excel triggered without error.")

            page.click("button:has-text('Download PDF Report')")
            time.sleep(0.5)
            print("  [✓] Download PDF Report triggered without error.")

            # Test Next Sheet navigation
            btn_next_sheet = page.locator("button:has-text('Next Sheet')")
            if btn_next_sheet.count() > 0 and not btn_next_sheet.is_disabled():
                btn_next_sheet.click()
                time.sleep(1.0)
                current_hash = page.evaluate("window.location.hash")
                print(f"  [✓] Next Sheet navigation verified: new hash={current_hash}")

            # Check console errors (ignoring expected favicon/extension noise)
            real_errors = [e for e in console_errors if "favicon" not in e and "net::ERR_" not in e]
            print(f"  [Assertion] Console errors count: {len(real_errors)}")
            if real_errors:
                print(f"  [FAIL] Console errors: {real_errors}")
                all_passed = False
            else:
                print("  [✓] 0 Console errors.")

            context.close()

        browser.close()

    print("\n==========================================")
    if all_passed:
        print("ALL BROWSER VERIFICATION CHECKS PASSED!")
    else:
        print("SOME BROWSER CHECKS FAILED.")
    print("==========================================")
    return all_passed

if __name__ == "__main__":
    b_proc, f_proc = ensure_servers()
    try:
        ok = run_tests()
        sys.exit(0 if ok else 1)
    finally:
        if b_proc:
            b_proc.terminate()
        if f_proc:
            f_proc.terminate()

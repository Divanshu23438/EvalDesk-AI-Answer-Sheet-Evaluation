#!/usr/bin/env python3
"""
Verification script for Search-First Report Card & Restored Report UI.
Tests:
1. Navigation to #/reports: Search-First UI shown, no report card initially.
2. Filtering by student name / roll number.
3. Clicking 'Open Report Card →': Opens exact restored Report UI with 3 tabs and bottom download buttons.
4. Switching tabs (Overview, Question-wise Marks, Analytics & Charts).
5. Verification of Section 1, 2, and 3 in Analytics tab.
6. Clicking '← Search Another Student' returns to Search view.
7. Direct route #/report/:sheetId renders restored Report UI.
"""

import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PROOF_DIR = ROOT / "docs" / "proof" / "ui" / "screenshots"
PROOF_DIR.mkdir(parents=True, exist_ok=True)

PORT = 3000

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print(f"\n--- 1. Testing http://localhost:{PORT}/#/reports Search-First Initial State ---")
        page.goto(f"http://localhost:{PORT}/#/reports", wait_until="networkidle")
        page.wait_for_timeout(1000)

        # 1. Verify Search Student Report Card box is present
        title_el = page.locator("h1:has-text('Search Student Report Card')")
        assert title_el.is_visible(), "Search Student Report Card title not visible!"
        print("  [✓] 'Search Student Report Card' header is visible.")

        # 2. Verify search input with correct placeholder
        search_input = page.locator("input[placeholder='Search by student name, roll number, or exam...']")
        assert search_input.is_visible(), "Search input with specified placeholder not found!"
        print("  [✓] Search input with expected placeholder is visible.")

        # 3. Verify Exam dropdown exists
        exam_dropdown = page.locator("select:has-text('All Exams / Subjects')")
        assert exam_dropdown.is_visible(), "Exam/Subject filter dropdown not found!"
        print("  [✓] Exam / Subject dropdown is visible.")

        # 4. Verify candidate cards list/grid exists with View Report Card buttons
        open_buttons = page.locator("button:has-text('View Report Card')")
        btn_count = open_buttons.count()
        assert btn_count > 0, f"Expected evaluated student cards with View Report Card buttons, found {btn_count}"
        print(f"  [✓] Found {btn_count} evaluated students in search grid.")

        # Save screenshot of initial search-first view
        shot_search = PROOF_DIR / "proof_report_card_search_view.png"
        page.screenshot(path=str(shot_search))
        print(f"  [✓] Saved Search-First view screenshot: {shot_search.name}")

        print("\n--- 2. Testing Live Filter / Search ---")
        first_student_name = page.locator("h3").first.inner_text().strip()
        print(f"  Filtering by first student name: {first_student_name}")
        search_input.fill(first_student_name[:4])
        page.wait_for_timeout(500)
        filtered_count = page.locator("button:has-text('View Report Card')").count()
        assert filtered_count > 0, "Filter yielded 0 results for valid substring!"
        print(f"  [✓] Filter narrowed results to {filtered_count} students.")

        print("\n--- 3. Testing Opening Report Card & Restored Previous Report UI ---")
        open_buttons.first.click()
        page.wait_for_timeout(1200)

        # Verify compact top bar with "← Search Another Student"
        back_search_btn = page.locator("button:has-text('← Search Another Student')")
        assert back_search_btn.is_visible(), "'← Search Another Student' button not visible!"
        print("  [✓] '← Search Another Student' compact top bar is visible.")

        # Verify 3 tabs of the restored Report component
        tab_overview = page.locator("button:has-text('Overview')")
        tab_questions = page.locator("button:has-text('Question-wise Marks')")
        tab_analytics = page.locator("button:has-text('Analytics & Charts')")

        assert tab_overview.is_visible(), "'Overview' tab button not found!"
        assert tab_questions.is_visible(), "'Question-wise Marks' tab button not found!"
        assert tab_analytics.is_visible(), "'Analytics & Charts' tab button not found!"
        print("  [✓] Restored Report UI has all 3 required tabs: Overview, Question-wise Marks, Analytics & Charts.")

        # Verify Bottom Bar download buttons
        excel_btn = page.locator("button:has-text('Download Excel (.xlsx)')")
        pdf_btn = page.locator("button:has-text('Download PDF Report')")
        assert excel_btn.is_visible(), "'Download Excel (.xlsx)' button not found!"
        assert pdf_btn.is_visible(), "'Download PDF Report' button not found!"
        print("  [✓] Bottom Bar has 'Download Excel (.xlsx)' and 'Download PDF Report' buttons.")

        # Screenshot of Overview Tab
        shot_overview = PROOF_DIR / "proof_report_card_student_overview.png"
        page.screenshot(path=str(shot_overview))
        print(f"  [✓] Saved Overview tab screenshot: {shot_overview.name}")

        print("\n--- 4. Testing Question-wise Marks Tab ---")
        tab_questions.click()
        page.wait_for_timeout(800)
        shot_qtab = PROOF_DIR / "proof_report_card_student_question_marks.png"
        page.screenshot(path=str(shot_qtab))
        print(f"  [✓] Saved Question-wise Marks tab screenshot: {shot_qtab.name}")

        print("\n--- 5. Testing Analytics & Charts Tab (Sections 1, 2, 3) ---")
        tab_analytics.click()
        page.wait_for_timeout(1000)

        # Verify Section 1
        s1 = page.locator("h3:has-text('1. Question')")
        s1.scroll_into_view_if_needed()
        assert s1.is_visible(), "'1. Question & Section Marks Telemetry' header missing in Analytics tab!"
        print(f"  [✓] Verified Section 1: '{s1.inner_text().strip()}'.")

        # Verify Section 2
        s2 = page.locator("h3:has-text('2. Teacher Deductions')")
        s2.scroll_into_view_if_needed()
        assert s2.is_visible(), "'2. Teacher Deductions & Error Taxonomy' header missing in Analytics tab!"
        print(f"  [✓] Verified Section 2: '{s2.inner_text().strip()}'.")

        # Verify Section 3
        s3 = page.locator("h3:has-text('3. Question Format')")
        s3.scroll_into_view_if_needed()
        assert s3.is_visible(), "'3. Question Format & Attempt Performance' header missing in Analytics tab!"
        print(f"  [✓] Verified Section 3: '{s3.inner_text().strip()}'.")

        shot_analytics = PROOF_DIR / "proof_report_card_student_analytics.png"
        page.screenshot(path=str(shot_analytics))
        print(f"  [✓] Saved Analytics tab screenshot: {shot_analytics.name}")

        print("\n--- 6. Testing Back to Search ---")
        back_search_btn.click()
        page.wait_for_timeout(600)
        assert page.locator("h1:has-text('Search Student Report Card')").is_visible(), "Back to search did not restore search view!"
        print("  [✓] Successfully returned to Search Student Report Card view.")

        print("\n--- 7. Testing Direct Route #/report/:sheetId ---")
        # Navigate to direct route #/report/56c42045-59e2-488f-87bd-6ca5739cd602
        page.goto(f"http://localhost:{PORT}/#/report/56c42045-59e2-488f-87bd-6ca5739cd602", wait_until="networkidle")
        page.wait_for_timeout(1000)

        # Verify the Stepper has 3. Report (ACTIVE)
        active_stepper = page.locator("nav[aria-label='Workflow Stepper'] span:has-text('3. Report (ACTIVE)')")
        assert active_stepper.is_visible(), "Workflow stepper 3. Report (ACTIVE) not visible on direct route!"
        print("  [✓] Stepper '3. Report (ACTIVE)' is active on #/report/:sheetId.")

        # Verify the tabs are also present on direct route
        assert page.locator("button:has-text('Overview')").is_visible(), "Overview tab missing on direct report route!"
        assert page.locator("button:has-text('Question-wise Marks')").is_visible(), "Question tab missing on direct report route!"
        assert page.locator("button:has-text('Analytics & Charts')").is_visible(), "Analytics tab missing on direct report route!"
        print("  [✓] Direct route #/report/:sheetId renders exact same restored Report component.")

        shot_direct = PROOF_DIR / "proof_report_screen_direct_route.png"
        page.screenshot(path=str(shot_direct))
        print(f"  [✓] Saved Direct Report Route screenshot: {shot_direct.name}")

        # Check console errors
        print("\n--- Console Error Audit ---")
        relevant_errors = [e for e in console_errors if "favicon" not in e.lower()]
        if relevant_errors:
            print(f"  [!] Note: {len(relevant_errors)} console errors observed: {relevant_errors[:2]}")
        else:
            print("  [✓] Zero console errors during interaction.")

        browser.close()
        print("\n==========================================")
        print("ALL VERIFICATIONS PASSED SUCCESSFULLY!")
        print("==========================================")

if __name__ == "__main__":
    run_verification()

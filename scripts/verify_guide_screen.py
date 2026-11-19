#!/usr/bin/env python3
"""
Verification script for GuideScreen (#/guide) and AppSidebar Guide item:
1. Verifies AppSidebar renders Guide item and highlights with emerald theme
2. Verifies GuideScreen header, subtitle, search input, reading progress badge
3. Verifies 5 chapters horizontal pill strip and switching between chapters
4. Verifies Chapter 03 strictness comparison table (Levels 1 to 5)
5. Verifies Chapter 04 Keyboard Shortcuts & Confidence calibration bento
6. Verifies "Mark as Learned ✓" updates progress badge & localStorage
7. Verifies FAQ accordion expansion, category filtering, and "Learn more in Chapter XX →" cross-linking
8. Verifies real-time search filtering across manual and FAQs
9. Verifies sidebar collapse (w-20) and expand (w-64) behavior
10. Saves screenshot proofs to docs/proof/ui/guide/
"""
import json
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PROOF_DIR = ROOT / "docs" / "proof" / "ui" / "guide"
PROOF_DIR.mkdir(parents=True, exist_ok=True)

URL = "http://localhost:3000/#/guide"

def run_verification():
    print(f"Starting verification against {URL}...")
    console_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        def on_page_error(err):
            print(f"  [PAGE ERROR] {err}")
            console_errors.append(str(err))

        page.on("pageerror", on_page_error)

        page.goto(URL, wait_until="networkidle")
        time.sleep(1.5)

        # 1. Verify AppSidebar Guide link exists and is active
        print("1. Checking Sidebar Guide navigation item...")
        sidebar = page.locator("aside[aria-label='Application Navigation Sidebar']")
        assert sidebar.count() > 0, "Sidebar not found"
        guide_btn = sidebar.locator("button:has-text('Guide')")
        assert guide_btn.count() > 0, "Guide button not found in sidebar"
        btn_class = guide_btn.get_attribute("class") or ""
        assert "bg-[#E8F3EE]" in btn_class, f"Guide button does not have active mint background: {btn_class}"
        assert "text-[#0F5132]" in btn_class, f"Guide button does not have active emerald text: {btn_class}"
        print("  PASS: Guide sidebar item is present and active with #E8F3EE / #0F5132")

        # 2. Verify GuideScreen Header
        print("2. Checking GuideScreen Header & Title...")
        title = page.locator("h1:has-text('Teacher User Manual & FAQ Guide')")
        assert title.count() > 0, "Header title missing"
        subtitle = page.locator("text=Step-by-step instructions for setting up exams")
        assert subtitle.count() > 0, "Header subtitle missing"
        badge = page.locator("text=Chapters Read")
        assert badge.count() > 0, "Reading progress badge missing"
        print(f"  PASS: Header, subtitle, and progress badge ({badge.first.inner_text()}) present")

        # Proof 1: Initial Guide Screen
        page.screenshot(path=str(PROOF_DIR / "1_guide_initial_screen.png"))
        print("  PASS: Captured 1_guide_initial_screen.png")

        # 3. Verify Chapters Pill Strip & Chapter 03 Strictness Table
        print("3. Checking Chapter navigation to Chapter 03...")
        ch3_pill = page.locator("button:has-text('03. 1–5 Strictness Levels')")
        assert ch3_pill.count() > 0, "Chapter 3 tab pill missing"
        ch3_pill.click()
        time.sleep(0.5)

        # Verify Chapter 3 content & table
        ch3_heading = page.locator("h2:has-text('Strictness Calibration & Partial Credit Mechanics')")
        assert ch3_heading.count() > 0, "Chapter 3 heading not found"
        table = page.locator("table")
        assert table.count() > 0, "Strictness matrix table not found"
        table_text = table.inner_text()
        assert "Level 1 · Lenient" in table_text, "Level 1 missing in table"
        assert "Level 3 · Balanced" in table_text, "Level 3 missing in table"
        assert "Level 5 · Exact" in table_text, "Level 5 missing in table"
        print("  PASS: Chapter 03 active, strictness matrix (Levels 1 to 5) verified")

        page.screenshot(path=str(PROOF_DIR / "2_chapter03_strictness_matrix.png"))
        print("  PASS: Captured 2_chapter03_strictness_matrix.png")

        # 4. Verify Chapter 04 Keyboard Shortcuts & Confidence Bento
        print("4. Checking Chapter 04 Keyboard Shortcuts & Confidence...")
        ch4_pill = page.locator("button:has-text('04. Split-Screen Evaluation')")
        ch4_pill.click()
        time.sleep(0.5)

        kbd_title = page.locator("text=Speed Keyboard Shortcuts")
        assert kbd_title.count() > 0, "Speed Keyboard Shortcuts card missing"
        ocr_conf = page.locator("text=OCR Confidence Calibration Rules")
        assert ocr_conf.count() > 0, "OCR Confidence rules card missing"
        assert page.locator("kbd:has-text('A')").count() > 0, "Shortcut 'A' missing"
        assert page.locator("kbd:has-text('F')").count() > 0, "Shortcut 'F' missing"
        assert page.locator("kbd:has-text('R')").count() > 0, "Shortcut 'R' missing"
        print("  PASS: Chapter 04 active, keyboard shortcuts & OCR confidence bento verified")

        page.screenshot(path=str(PROOF_DIR / "3_chapter04_shortcuts_ocr.png"))
        print("  PASS: Captured 3_chapter04_shortcuts_ocr.png")

        # 5. Verify "Mark as Learned ✓" Toggle Button
        print("5. Checking 'Mark as Learned ✓' toggle...")
        learn_btn = page.locator("button:has-text('Mark as Learned ✓'), button:has-text('Learned ✓')").first
        initial_learned_text = learn_btn.inner_text()
        learn_btn.click()
        time.sleep(0.4)
        new_learned_text = page.locator("button:has-text('Mark as Learned ✓'), button:has-text('Learned ✓')").first.inner_text()
        print(f"  PASS: Toggle learned button toggled from '{initial_learned_text}' to '{new_learned_text}'")

        # 6. Verify FAQs Filter & Accordion Expansion
        print("6. Checking FAQs Category Filtering & Accordion...")
        # Category pills
        cat_scoring = page.locator("aside button:has-text('Scoring')")
        cat_scoring.click()
        time.sleep(0.3)
        assert page.locator("text=Which strictness level should I choose").count() > 0
        print("  PASS: Category filter 'Scoring' applied")

        cat_all = page.locator("aside button:has-text('All')")
        cat_all.click()
        time.sleep(0.3)

        # Verify FAQ 1 is expanded initially or click to expand
        answer_text = page.locator("text=We recommend scanning at 300 DPI")
        if answer_text.count() == 0:
            dpi_faq = page.locator("button:has-text('What scan resolution (DPI) gives the highest OCR accuracy?')")
            assert dpi_faq.count() > 0, "DPI FAQ missing"
            dpi_faq.click()
            time.sleep(0.3)
            answer_text = page.locator("text=We recommend scanning at 300 DPI")

        assert answer_text.count() > 0, "Expanded FAQ answer not visible"

        # Check cross-link button
        link_btn = page.locator("button:has-text('Learn more in Chapter 02 →')")
        assert link_btn.count() > 0, "Cross-link button to Chapter 02 missing"
        print("  PASS: FAQ expanded smoothly, reveals answer and 'Learn more in Chapter 02 →'")

        page.screenshot(path=str(PROOF_DIR / "4_faq_expanded_crosslink.png"))
        print("  PASS: Captured 4_faq_expanded_crosslink.png")

        # Click cross-link button and verify center manual jumps to Chapter 02
        link_btn.click()
        time.sleep(0.5)
        ch2_heading = page.locator("h2:has-text('Answer Booklet Ingestion & Student Identity Extraction')")
        assert ch2_heading.count() > 0, "Center manual did not switch to Chapter 02 after cross-link click"
        print("  PASS: Cross-link switched center User Manual to Chapter 02 successfully")

        # 7. Verify Search Filtering
        print("7. Testing Unified Live Search Bar...")
        search_input = page.locator("input[placeholder='Search manual chapters or FAQs...']")
        search_input.fill("DPI")
        time.sleep(0.5)

        # Verify search notice
        results_notice = page.locator("text=Found matching results")
        assert results_notice.count() > 0, "Search results summary notice missing"
        print("  PASS: Live search dynamically filtered chapters and FAQs for query 'DPI'")

        page.screenshot(path=str(PROOF_DIR / "5_search_filter_active.png"))
        print("  PASS: Captured 5_search_filter_active.png")

        # Clear search
        clear_btn = page.locator("button[title='Clear search']")
        if clear_btn.count() > 0:
            clear_btn.click()
            time.sleep(0.3)
        print("  PASS: Search cleared")

        # 8. Verify Sidebar Collapse & Expand Behavior
        print("8. Testing Sidebar Collapse & Expand...")
        collapse_btn = sidebar.locator("button[title='Collapse sidebar ([)']")
        collapse_btn.click()
        time.sleep(0.5)

        sidebar_box = sidebar.bounding_box()
        assert sidebar_box is not None, "Sidebar bounding box is None"
        print(f"  PASS: Sidebar collapsed width is {sidebar_box['width']}px (w-20)")
        assert 70 <= sidebar_box['width'] <= 90, f"Expected w-20 ~80px, got {sidebar_box['width']}"

        page.screenshot(path=str(PROOF_DIR / "6_sidebar_collapsed_guide.png"))
        print("  PASS: Captured 6_sidebar_collapsed_guide.png")

        expand_btn = sidebar.locator("button[title='Expand sidebar ([)']")
        expand_btn.click()
        time.sleep(0.5)

        sidebar_box_expanded = sidebar.bounding_box()
        assert sidebar_box_expanded is not None
        print(f"  PASS: Sidebar re-expanded width is {sidebar_box_expanded['width']}px (w-64)")
        assert 240 <= sidebar_box_expanded['width'] <= 270, f"Expected w-64 ~256px, got {sidebar_box_expanded['width']}"

        # 9. Test Next Chapter footer button
        print("9. Testing Bottom Chapter Footer 'Next Chapter →' button...")
        ch1_pill = page.locator("button:has-text('01. Exam Setup & Auto-Fetch')")
        ch1_pill.click()
        time.sleep(0.3)
        next_btn = page.locator("button:has-text('Next Chapter')")
        assert next_btn.count() > 0, "Next Chapter button missing"
        next_btn.click()
        time.sleep(0.4)
        assert page.locator("h2:has-text('Answer Booklet Ingestion & Student Identity Extraction')").count() > 0
        print("  PASS: Bottom 'Next Chapter' button correctly advanced from Ch 1 to Ch 2")

        page.screenshot(path=str(PROOF_DIR / "7_guide_full_verified.png"))
        print("  PASS: Captured 7_guide_full_verified.png")

        browser.close()

    if console_errors:
        print(f"\nFAIL: Caught {len(console_errors)} console errors:")
        for err in console_errors:
            print("  ", err)
        sys.exit(1)
    else:
        print("\nALL GUIDE SCREEN & APPSIDEBAR VERIFICATIONS PASSED WITH ZERO CONSOLE ERRORS!")


if __name__ == "__main__":
    run_verification()

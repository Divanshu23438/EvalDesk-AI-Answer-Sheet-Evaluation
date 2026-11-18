#!/usr/bin/env python3
"""
Verification script for UI fixes:
1. Clean Compact Icon Rail when Question Panel is collapsed (EvaluateScreen.tsx)
2. Auto-Sized Student Answer (OCR) & Expected Answer Cards (ReportScreen.tsx - Question-wise Marks)
3. Text Wrapping & Card Border Clipping in Analytics & Charts (ReportScreen.tsx - Analytics Tab)
"""
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PROOF_DIR = ROOT / "docs" / "proof" / "ui" / "fixes"
PROOF_DIR.mkdir(parents=True, exist_ok=True)

SHEET_ID = "7e2972d1-e4b6-455b-bf82-c07655b2936e"


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


def main():
    print("=== Verifying UI Layout & Text-Wrapping Fixes ===")
    backend_proc = ensure_backend_server()
    frontend_url = get_frontend_url()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # -------------------------------------------------------------
        # 1. EVALUATE SCREEN: COLLAPSED QUESTION RAIL
        # -------------------------------------------------------------
        print("\n--- 1. Testing Collapsed Question Rail (EvaluateScreen) ---")
        page.goto(f"{frontend_url}/#/evaluate/{SHEET_ID}", wait_until="networkidle")
        page.wait_for_timeout(1500)

        # Ensure panel is collapsed
        collapse_btn = page.locator("button[data-testid='collapse-question-panel']")
        if collapse_btn.is_visible():
            collapse_btn.click()
            page.wait_for_timeout(400)

        rail = page.locator("aside[aria-label='Question Navigation Rail']")
        rail.wait_for(state="visible", timeout=5000)

        # Check rail width (w-12 = 48px)
        rail_box = rail.bounding_box()
        assert rail_box is not None, "Failed to get rail bounding box"
        print(f"  Rail width: {rail_box['width']}px (expected 48px)")
        assert abs(rail_box["width"] - 48.0) <= 1.0, f"Rail width is {rail_box['width']}, expected 48px"

        # Check expand button
        expand_btn = page.locator("button[data-testid='expand-question-panel']")
        assert expand_btn.is_visible(), "Expand button not visible"
        assert expand_btn.get_attribute("title") == "Expand question panel", "Expand button title mismatch"
        expand_box = expand_btn.bounding_box()
        assert expand_box is not None
        print(f"  Expand button size: {expand_box['width']}x{expand_box['height']}px (expected 32x32px)")
        assert abs(expand_box["width"] - 32.0) <= 1.0 and abs(expand_box["height"] - 32.0) <= 1.0

        # Check question badge buttons in rail
        badges = rail.locator("button[aria-label^='Question']")
        badge_count = badges.count()
        print(f"  Question badges in rail: {badge_count}")
        assert badge_count == 19, f"Expected 19 badges, found {badge_count}"

        # Verify badge 1
        first_badge = badges.first
        b1_text = first_badge.inner_text().strip()
        print(f"  First badge text: '{b1_text}' (expected '1')")
        assert b1_text == "1", f"Badge text is '{b1_text}', expected '1'"
        assert "Q." not in b1_text and "(" not in b1_text, "Badge contains long multi-part string"

        b1_title = first_badge.get_attribute("title") or ""
        print(f"  First badge tooltip title: '{b1_title}'")
        assert "Question" in b1_title and "/" in b1_title, "Badge title missing question details or marks"

        b1_box = first_badge.bounding_box()
        assert b1_box is not None
        print(f"  Badge size: {b1_box['width']}x{b1_box['height']}px (expected 32x32px)")
        assert abs(b1_box["width"] - 32.0) <= 1.0 and abs(b1_box["height"] - 32.0) <= 1.0

        # Check active ring on selected question
        active_badge = rail.locator("button.ring-2.ring-indigo-600.ring-offset-1")
        assert active_badge.count() == 1, f"Expected exactly 1 active badge with ring, found {active_badge.count()}"
        print(f"  Active question badge: {active_badge.inner_text().strip()}")

        # Click badge 1 to explicitly make question 1 active and verify its ring
        first_badge.click()
        page.wait_for_timeout(200)
        b1_class = first_badge.get_attribute("class") or ""
        assert "ring-2 ring-indigo-600 ring-offset-1" in b1_class, f"Active ring class missing in: {b1_class}"
        print("  [PASS] Active ring confirmed on Question 1 after click")

        rail_screenshot = PROOF_DIR / "evaluate_collapsed_rail.png"
        page.screenshot(path=str(rail_screenshot))
        print(f"  [PASS] Collapsed rail verified. Screenshot: {rail_screenshot.name}")

        # -------------------------------------------------------------
        # 2. REPORT SCREEN: QUESTION-WISE MARKS AUTO-SIZED CARDS
        # -------------------------------------------------------------
        print("\n--- 2. Testing Question-wise Marks Auto-Sized Cards (ReportScreen) ---")
        page.goto(f"{frontend_url}/#/report/{SHEET_ID}", wait_until="networkidle")

        # Wait for loading spinner to detach
        page.locator("text=Loading evaluation report...").wait_for(state="detached", timeout=10000)
        page.wait_for_timeout(500)

        # Click "Question-wise Marks" tab
        q_tab = page.locator("button:has-text('Question-wise Marks')")
        q_tab.wait_for(state="visible", timeout=5000)
        q_tab.click()

        # Check Student Answer (OCR) and Expected Answer headers
        student_header = page.locator("span:has-text('Student Answer (OCR)')").first
        expected_header = page.locator("span:has-text('Expected Answer')").first
        student_header.wait_for(state="visible", timeout=10000)
        expected_header.wait_for(state="visible", timeout=10000)

        # Check 2-column grid layout
        grid_parent = page.locator(".grid.grid-cols-1.md\\:grid-cols-2").first
        assert grid_parent.is_visible(), "Comparison grid not visible"

        # Check card elements
        cards = grid_parent.locator("> div")
        assert cards.count() == 2, f"Expected 2 cards in comparison grid, found {cards.count()}"

        card1_class = cards.nth(0).get_attribute("class") or ""
        card2_class = cards.nth(1).get_attribute("class") or ""
        print(f"  Card 1 classes: {card1_class}")
        print(f"  Card 2 classes: {card2_class}")
        assert "rounded-xl bg-slate-50/90 border border-slate-200/80 p-3.5 flex flex-col justify-start" in card1_class
        assert "rounded-xl bg-indigo-50/35 border border-indigo-100 p-3.5 flex flex-col justify-start" in card2_class

        # Check height is auto and natural (no min-h-[120px] or max-h-56)
        assert "min-h-[120px]" not in card1_class and "max-h-56" not in card1_class
        assert "min-h-[120px]" not in card2_class and "max-h-56" not in card2_class

        q_tab_screenshot = PROOF_DIR / "report_question_cards.png"
        page.screenshot(path=str(q_tab_screenshot))
        print(f"  [PASS] Auto-sized question cards verified. Screenshot: {q_tab_screenshot.name}")

        # -------------------------------------------------------------
        # 3. REPORT SCREEN: ANALYTICS & CHARTS SECTION 3
        # -------------------------------------------------------------
        print("\n--- 3. Testing Analytics & Charts Section 3 (ReportScreen) ---")
        analytics_tab = page.locator("button:has-text('Analytics & Charts')")
        analytics_tab.wait_for(state="visible", timeout=5000)
        analytics_tab.click()
        page.wait_for_timeout(500)

        # Check Section 3: Question Format & Attempt Performance
        sec3_header = page.locator("h3:has-text('3. Question Format')")
        sec3_header.scroll_into_view_if_needed()
        page.wait_for_timeout(300)
        assert sec3_header.is_visible(), "Section 3 header not visible"

        # 3.1 Marks Earned vs Lost header legend
        legend_container = page.locator("div:has(h4:has-text('Marks Earned vs Lost by Question Format')) > div.flex.items-center.gap-3.shrink-0")
        assert legend_container.count() > 0, "Earned/Lost legend container missing gap-3 shrink-0"

        earned_legend = legend_container.locator("span.inline-flex:has-text('Earned %')")
        lost_legend = legend_container.locator("span.inline-flex:has-text('Lost %')")
        assert earned_legend.is_visible() and lost_legend.is_visible()
        assert "whitespace-nowrap" in (earned_legend.get_attribute("class") or "")
        assert "whitespace-nowrap" in (lost_legend.get_attribute("class") or "")
        print("  [PASS] Marks Earned vs Lost legend: whitespace-nowrap and gap-3 verified")

        # 3.2 Total Qs badge
        total_qs_badge = page.locator("span:has-text('Total Qs')")
        assert total_qs_badge.is_visible()
        b_class = total_qs_badge.get_attribute("class") or ""
        assert "whitespace-nowrap" in b_class and "shrink-0" in b_class
        print(f"  [PASS] Total Qs badge has whitespace-nowrap shrink-0: '{total_qs_badge.inner_text()}'")

        # 3.3 Mastery rows stacked below donut chart
        mastery_card = page.locator("div.p-4.rounded-xl.bg-white:has(h4:has-text('Question Attempt & Mastery Breakdown'))")
        donut_container = mastery_card.locator(".relative.w-32.h-32")
        assert donut_container.is_visible(), "Donut chart not visible"

        legend_rows_container = mastery_card.locator(".w-full.space-y-2.mt-4")
        assert legend_rows_container.is_visible(), "Stacked mastery legend container not visible"

        legend_rows = legend_rows_container.locator("> div")
        print(f"  Mastery legend rows count: {legend_rows.count()}")
        assert legend_rows.count() == 4, f"Expected 4 mastery rows, found {legend_rows.count()}"

        for i in range(4):
            row = legend_rows.nth(i)
            row_text = row.inner_text().strip()
            print(f"    Row {i+1}: {row_text}")
            assert "Qs" in row_text and "%" in row_text

        analytics_screenshot = PROOF_DIR / "report_analytics_section3.png"
        page.screenshot(path=str(analytics_screenshot))
        print(f"  [PASS] Analytics Section 3 layout verified. Screenshot: {analytics_screenshot.name}")

        context.close()
        browser.close()

    if backend_proc:
        backend_proc.terminate()

    print("\n=== ALL UI FIXES VERIFIED SUCCESSFULLY ✓ ===")


if __name__ == "__main__":
    main()

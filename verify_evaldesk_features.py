import asyncio
import os
import sys
from playwright.async_api import async_playwright

async def verify_evaldesk_features():
    os.makedirs("docs/proof/ui/screenshots", exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()

        print("=== 1. VERIFY DASHBOARD TOP PERFORMERS LEADERBOARD ===")
        await page.goto("http://localhost:3000/#/dashboard")
        await page.wait_for_timeout(3000)

        # Assert Leaderboard header
        leaderboard_title = await page.locator("text=Top Performers Leaderboard").first.is_visible()
        print(f"Top Performers Leaderboard visible: {leaderboard_title}")
        assert leaderboard_title, "Top Performers Leaderboard should be visible on dashboard"

        # Check subtext
        subtext = await page.locator("text=Cross-subject & cross-stream academic excellence").first.is_visible()
        print(f"Leaderboard subtext visible: {subtext}")

        # Check rank badges
        rank1 = await page.locator("text=#1").first.is_visible()
        print(f"Rank #1 badge visible: {rank1}")
        assert rank1, "Rank #1 badge should be visible in leaderboard"

        await page.screenshot(path="docs/proof/ui/screenshots/proof_dashboard_leaderboard.png")
        print("Captured docs/proof/ui/screenshots/proof_dashboard_leaderboard.png")

        print("\n=== 2. VERIFY REPORT CARD SEARCH & DIRECTORY ===")
        await page.goto("http://localhost:3000/#/reports")
        await page.wait_for_timeout(3000)

        search_header = await page.locator("text=Search Student Report Card").first.is_visible()
        print(f"Search Student Report Card visible: {search_header}")
        assert search_header, "Search Student Report Card heading must be visible"

        # Check directory student cards
        cards = await page.locator("text=View Report Card").all()
        print(f"Found {len(cards)} student cards with 'View Report Card' button")
        assert len(cards) > 0, "Should list evaluated student cards"

        await page.screenshot(path="docs/proof/ui/screenshots/proof_report_card_directory.png")
        print("Captured docs/proof/ui/screenshots/proof_report_card_directory.png")

        print("\n=== 3. VERIFY MULTI-SELECT CHECKBOXES & BULK ACTIONS BAR ===")
        checkboxes = await page.locator("button[title='Select candidate']").all()
        print(f"Found {len(checkboxes)} student candidate checkboxes")
        assert len(checkboxes) >= 2, "Expected at least 2 student checkboxes"

        # Select first 2 candidates
        await checkboxes[0].click()
        await page.wait_for_timeout(500)
        await checkboxes[1].click()
        await page.wait_for_timeout(500)

        # Check action bar appearance
        action_bar_text = await page.locator("text=Candidates Selected").first.is_visible()
        print(f"Action bar visible: {action_bar_text}")
        assert action_bar_text, "Action bar should appear when candidates are selected"

        compare_btn = await page.locator("text=Compare Selected").first.is_visible()
        print(f"Compare Selected button visible: {compare_btn}")
        assert compare_btn, "Compare Selected button should be visible"

        bulk_download_btn = await page.locator("text=Download Bulk Reports").first.is_visible()
        print(f"Download Bulk Reports button visible: {bulk_download_btn}")
        assert bulk_download_btn, "Download Bulk Reports button should be visible"

        await page.screenshot(path="docs/proof/ui/screenshots/proof_report_card_multi_select.png")
        print("Captured docs/proof/ui/screenshots/proof_report_card_multi_select.png")

        print("\n=== 4. VERIFY SIDE-BY-SIDE COMPARISON VIEW ===")
        await page.locator("button:has-text('Compare Selected')").first.click()
        await page.wait_for_timeout(3000)

        compare_heading = await page.locator("text=Student Performance Comparison").first.is_visible()
        print(f"Comparison heading visible: {compare_heading}")
        assert compare_heading, "Comparison view heading must be visible"

        pct_chart = await page.locator("text=Overall Percentage Comparison").first.is_visible()
        print(f"Percentage comparison chart visible: {pct_chart}")
        assert pct_chart, "Score comparison bar chart must be visible"

        matrix_table = await page.locator("text=Question & Section Marks Matrix").first.is_visible()
        print(f"Matrix table visible: {matrix_table}")
        assert matrix_table, "Comparison matrix table must be visible"

        excel_export_btn = await page.locator("text=Export Comparison (.xlsx)").first.is_visible()
        print(f"Export Comparison Excel button visible: {excel_export_btn}")
        assert excel_export_btn, "Export Comparison (.xlsx) button must be visible"

        await page.screenshot(path="docs/proof/ui/screenshots/proof_report_card_compare_view.png")
        print("Captured docs/proof/ui/screenshots/proof_report_card_compare_view.png")

        # Click Back to Selection
        await page.locator("button:has-text('Back to Selection')").first.click()
        await page.wait_for_timeout(1000)

        print("\n=== 5. VERIFY ONE-BY-ONE STEPPER VIEW (HIDDEN ANSWER SHEET) ===")
        # Click View Report Cards One-by-One
        await page.locator("button:has-text('View Report Cards')").first.click()
        await page.wait_for_timeout(3000)

        stepper_label = await page.locator("text=Student 1 of").first.is_visible()
        print(f"Stepper label visible: {stepper_label}")
        assert stepper_label, "Stepper label 'Student 1 of N' must be visible"

        prev_btn = await page.locator("button[title='Previous Student']").first.is_visible()
        next_btn = await page.locator("button[title='Next Student']").first.is_visible()
        print(f"Previous button visible: {prev_btn}, Next button visible: {next_btn}")
        assert prev_btn and next_btn, "Previous and Next stepper buttons must be visible"

        # Check tabs in report view
        overview_tab = await page.locator("role=tab[name='Overview']").first.is_visible()
        q_tab = await page.locator("role=tab[name='Question-wise Marks']").first.is_visible()
        analytics_tab = await page.locator("role=tab[name='Analytics & Charts']").first.is_visible()
        print(f"Overview: {overview_tab}, Question-wise: {q_tab}, Analytics: {analytics_tab}")
        assert overview_tab and q_tab and analytics_tab, "All 3 tabs must be present"

        # Crucial check: Booklet preview must NOT be present in #/reports (hidden answer sheet)
        booklet_canvas = await page.locator("canvas").all()
        # In hideAnswerSheet={true}, there is no booklet canvas for PDF pages
        booklet_header = await page.locator("text=Answer Booklet").is_visible()
        print(f"Booklet preview header visible in #/reports: {booklet_header} (should be False)")
        assert not booklet_header, "Scanned Answer Booklet must be HIDDEN in #/reports"

        await page.screenshot(path="docs/proof/ui/screenshots/proof_report_card_stepper_view.png")
        print("Captured docs/proof/ui/screenshots/proof_report_card_stepper_view.png")

        # Test Stepper Next button
        await page.locator("button[title='Next Student']").first.click()
        await page.wait_for_timeout(1500)
        stepper_label2 = await page.locator("text=Student 2 of").first.is_visible()
        print(f"Stepper stepped to Student 2: {stepper_label2}")
        assert stepper_label2, "Should step to Student 2 of N"

        print("\n=== 6. VERIFY POST-EVALUATION REPORT ROUTE (#/report/:sheetId) ===")
        # Get sheet id from current stepper or URL
        first_sheet_id = "18d9bb88-1585-4c8e-85d3-212381a85c4a"
        await page.goto(f"http://localhost:3000/#/report/{first_sheet_id}")
        await page.wait_for_timeout(3000)

        # In #/report/:sheetId, the answer booklet preview MUST BE PRESENT alongside report
        stepper_workflow = await page.locator("text=3. Report (ACTIVE)").first.is_visible()
        print(f"Post-evaluation 3-step workflow visible: {stepper_workflow}")
        assert stepper_workflow, "3. Report (ACTIVE) workflow header should be present"

        booklet_present = await page.locator("text=Answer Booklet").first.is_visible()
        print(f"Scanned booklet present in #/report/:id: {booklet_present} (should be True)")
        assert booklet_present, "Scanned Answer Booklet must remain visible in #/report/:id"

        await page.screenshot(path="docs/proof/ui/screenshots/proof_report_post_evaluation_intact.png")
        print("Captured docs/proof/ui/screenshots/proof_report_post_evaluation_intact.png")

        print("\n=== ALL BROWSER CHECKS PASSED 100% ===")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_evaldesk_features())

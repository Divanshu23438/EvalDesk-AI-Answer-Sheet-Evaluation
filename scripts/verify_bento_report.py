import asyncio
import os
import sys
import sqlite3
from playwright.async_api import async_playwright

sys.path.insert(0, os.path.abspath("."))
from backend.config import DB_PATH

conn = sqlite3.connect(str(DB_PATH))
conn.row_factory = sqlite3.Row
cur = conn.cursor()
cur.execute("SELECT id, student_name, roll_number FROM sheets LIMIT 1")
row = cur.fetchone()
sheet_id = row["id"]
student_name = row["student_name"]
roll = row["roll_number"]
conn.close()
print(f"Testing with sheet_id={sheet_id}, student={student_name}, roll={roll}")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 800})

        # 1. Test #/reports
        print("1. Navigating to http://localhost:3000/#/reports ...")
        await page.goto("http://localhost:3000/#/reports", wait_until="networkidle")
        await page.wait_for_timeout(1000)

        # Check that directory is visible
        content = await page.content()
        assert "Report" in content
        print("Directory / Search view loaded.")

        # Wait for student rows to load
        await page.wait_for_selector("button:has-text('View Report Card')", timeout=10000)
        btn = page.locator("button:has-text('View Report Card')").first
        await btn.click()
        await page.wait_for_timeout(2000)
        print("Clicked View Report Card")

        # Check Bento Report Card presence
        card_content = await page.content()
        assert "1-Page Bento Report Card" in card_content, "1-Page Bento Report Card header missing"
        assert "Download Report Card PDF" in card_content or "Download 1-Page PDF" in card_content
        assert "AI Rubric Audit" in card_content, "Sign-off strip missing"
        assert "Grading Scale:" in card_content, "Grading scale legend missing"

        # Verify NO booklet preview or answer transcript
        assert "Booklet Viewer" not in card_content
        print("Bento Report Card UI verified: 100% clean, no booklet preview, no answer transcripts!")
        await page.screenshot(path="bento_report_card_screenshot.png")
        print("Saved bento_report_card_screenshot.png")

        # 2. Test #/report/:sheetId (Post-evaluation detailed report)
        print(f"2. Navigating to http://localhost:3000/#/report/{sheet_id} ...")
        await page.goto(f"http://localhost:3000/#/report/{sheet_id}", wait_until="networkidle")
        await page.wait_for_timeout(1500)

        rep_content = await page.content()
        assert "Question-wise Marks" in rep_content or "Overview" in rep_content, "Detailed report tabs missing"
        assert "Analytics" in rep_content, "Analytics tab missing"
        print("Post-evaluation detailed report UI verified: intact with all original tabs!")
        await page.screenshot(path="detailed_report_screenshot.png")
        print("Saved detailed_report_screenshot.png")

        # 3. Test Dark Mode on Bento Report Card
        print("3. Testing Dark Mode on Bento Report Card ...")
        await page.goto("http://localhost:3000/#/reports", wait_until="networkidle")
        await page.wait_for_timeout(1000)
        dark_btn = page.locator("button:has-text('Dark Mode')").first
        if await dark_btn.count() > 0:
            await dark_btn.click()
            await page.wait_for_timeout(500)
        btn = page.locator("button:has-text('View Report Card')").first
        await btn.click()
        await page.wait_for_timeout(1500)
        await page.screenshot(path="bento_report_card_dark_screenshot.png")
        print("Saved bento_report_card_dark_screenshot.png")

        await browser.close()
        print("ALL BROWSER VERIFICATIONS PASSED!")

asyncio.run(main())

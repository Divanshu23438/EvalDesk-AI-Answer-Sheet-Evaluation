import asyncio
import urllib.request
from playwright.async_api import async_playwright

async def verify():
    print("Testing Bento Marksheet and Reports...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1400, "height": 900})
        page = await context.new_page()

        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))

        # 1. Navigate to #/reports
        print("\n--- 1. Testing #/reports ---")
        await page.goto("http://localhost:3000/#/reports", wait_until="networkidle")
        await asyncio.sleep(2)

        # Check for control bar
        control_bar = page.locator("text=Exam:")
        await control_bar.wait_for(timeout=10000)
        print("Control bar found.")

        # Check for student pills
        pills = page.locator("button:has-text('SGSU250489')")
        pill_count = await pills.count()
        print(f"Candidate pill count: {pill_count}")
        assert pill_count > 0, "No candidate pill found for Kanak Patel"

        # Check Bento Hero Title
        hero_title = page.locator("text=OFFICIAL STATEMENT OF MARKS & RUBRIC AUDIT")
        await hero_title.wait_for(timeout=10000)
        print("Bento Hero Title visible.")

        # Check 12-column bento score tile
        pct_elem = page.locator("text=65.7%").first
        await pct_elem.wait_for(timeout=5000)
        print("Score percentage 65.7% verified.")

        # 2. Test 3D Flip to Back Side
        print("\n--- 2. Testing 3D Flip to Back Side ---")
        flip_btn = page.locator("button:has-text('Rotate Page'), button:has-text('Back')").first
        await flip_btn.click()
        await asyncio.sleep(1)

        # Check back side content
        back_title = page.locator("text=Institutional Grading Scale & Strictness Calibration")
        await back_title.wait_for(timeout=5000)
        print("Back Side title visible.")

        # Check grading table and achieved grade badge
        achieved_badge = page.locator("text=Candidate's Achieved Grade")
        await achieved_badge.wait_for(timeout=5000)
        print("Candidate's Achieved Grade badge visible.")

        # Check strictness badge
        strictness_badge = page.locator("text=Applied to This Sheet")
        await strictness_badge.wait_for(timeout=5000)
        print("Strictness 'Applied to This Sheet' badge visible.")

        # Flip back to Front
        flip_back = page.locator("button:has-text('Return to Front Marksheet'), button:has-text('Front')").first
        await flip_back.click()
        await asyncio.sleep(1)
        await hero_title.wait_for(timeout=5000)
        print("Successfully flipped back to Front Marksheet.")

        # 3. Test Direct Navigation to #/report/:sheetId
        print("\n--- 3. Testing #/report/:sheetId ---")
        sheet_id = "2de697eb-fd3b-4a41-9a39-1d268820ee60"
        await page.goto(f"http://localhost:3000/#/report/{sheet_id}", wait_until="networkidle")
        await asyncio.sleep(2)

        direct_hero = page.locator("text=OFFICIAL STATEMENT OF MARKS & RUBRIC AUDIT")
        await direct_hero.wait_for(timeout=10000)
        print(f"Direct #/report/{sheet_id} rendered hero successfully.")

        # 4. Check Print styles
        print("\n--- 4. Checking Print Styles ---")
        sidebar_visible = await page.evaluate("""() => {
            const el = document.querySelector('aside');
            if (!el) return 'no aside';
            return window.getComputedStyle(el).display;
        }""")
        print(f"Screen sidebar display: {sidebar_visible}")

        await page.emulate_media(media="print")
        sidebar_print = await page.evaluate("""() => {
            const el = document.querySelector('aside');
            if (!el) return 'no aside';
            return window.getComputedStyle(el).display;
        }""")
        print(f"Print sidebar display: {sidebar_print}")
        assert sidebar_print == 'none', f"Sidebar must be hidden in print, got {sidebar_print}"

        # Check front and back display in print
        front_print = await page.evaluate("""() => {
            const el = document.querySelector('.print-front-sheet');
            return el ? window.getComputedStyle(el).display : 'missing';
        }""")
        back_print = await page.evaluate("""() => {
            const el = document.querySelector('.print-back-sheet');
            return el ? window.getComputedStyle(el).display : 'missing';
        }""")
        print(f"Print front sheet display: {front_print}")
        print(f"Print back sheet display: {back_print}")
        assert front_print != 'none' and front_print != 'missing', "Front sheet should be displayed in print"
        assert back_print != 'none' and back_print != 'missing', "Back sheet should be displayed in print"

        print(f"\nCaptured page errors: {len(errors)}")
        assert len(errors) == 0, f"Page errors found: {errors}"

        await browser.close()
        print("\nALL BENTO MARKSHEET & REPORTS VERIFICATIONS PASSED 100%!")

if __name__ == '__main__':
    asyncio.run(verify())

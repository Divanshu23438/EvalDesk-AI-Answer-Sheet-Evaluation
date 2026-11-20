import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        await page.goto("http://localhost:3000/#/reports", wait_until="networkidle")
        await page.wait_for_timeout(1000)
        btn = page.locator("button:has-text('View Report Card')").first
        await btn.click()
        await page.wait_for_timeout(2000)

        # Verify all elements from Screenshot 1 & 2
        content = await page.content()
        assert "Question &amp; Section Marks Telemetry" in content
        assert "Teacher Deductions &amp; Error Taxonomy" in content
        assert "Question Format &amp; Attempt Performance" in content
        assert "Pareto" in content
        assert "Attempt Mastery" in content
        print("All 3 Telemetry sections verified successfully!")

        await page.screenshot(path="docs/proof/ui/screenshots/proof_bento_report_card_light.png")
        print("Saved proof_bento_report_card_light.png")

        # Test Dark Mode
        dark_btn = page.locator("button:has-text('Dark Mode')").first
        if await dark_btn.count() > 0:
            await dark_btn.click()
            await page.wait_for_timeout(1000)
            await page.screenshot(path="docs/proof/ui/screenshots/proof_bento_report_card_dark.png")
            print("Saved proof_bento_report_card_dark.png")

        await browser.close()

asyncio.run(main())

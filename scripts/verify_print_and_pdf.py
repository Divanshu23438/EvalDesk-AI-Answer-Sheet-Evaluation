import asyncio
import json
import sqlite3
import urllib.request
from pathlib import Path
import fitz # PyMuPDF
from playwright.async_api import async_playwright

async def main():
    print("=== EvalDesk Print & Backend PDF Verification ===")
    
    # 1. Fetch valid sheet from SQLite
    conn = sqlite3.connect("data/app.db")
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    sheet = c.execute("SELECT id, student_name, roll_number FROM sheets LIMIT 1").fetchone()
    if not sheet:
        raise RuntimeError("No sheets found in database!")
    sheet_id = sheet["id"]
    print(f"Testing sheet: {sheet['student_name']} ({sheet['roll_number']}) -> ID: {sheet_id}")

    # 2. Test Backend PDF Generation via API
    print("\n--- Testing Backend Report Card PDF (GET /api/sheets/{sheet_id}/export/pdf) ---")
    regen_url = f"http://127.0.0.1:8000/api/sheets/{sheet_id}/report/regenerate"
    req = urllib.request.Request(regen_url, method="POST", data=b"")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200, f"Regenerate failed: {resp.status}"
    
    pdf_url = f"http://127.0.0.1:8000/api/sheets/{sheet_id}/export/pdf"
    with urllib.request.urlopen(pdf_url) as resp:
        assert resp.status == 200, f"Export PDF failed: {resp.status}"
        content_type = resp.headers.get("Content-Type")
        assert "application/pdf" in content_type, f"Unexpected content type: {content_type}"
        pdf_bytes = resp.read()
    
    assert len(pdf_bytes) > 20000, f"PDF too small: {len(pdf_bytes)} bytes"
    print(f"Backend PDF successfully exported: {len(pdf_bytes)} bytes")

    # Inspect PDF contents with PyMuPDF
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page_count = len(doc)
    print(f"Backend PDF page count: {page_count} pages")
    assert page_count >= 2, f"Expected at least 2 pages, got {page_count}"

    page1_text = doc[0].get_text()
    assert "OFFICIAL EVALUATION REPORT CARD" in page1_text, "Missing header on Page 1"
    assert "CANDIDATE IDENTITY" in page1_text, "Missing Candidate Identity on Page 1"
    assert "AGGREGATE SCORE" in page1_text, "Missing Aggregate Score on Page 1"
    assert "OCR LEGIBILITY" in page1_text, "Missing OCR Legibility on Page 1"
    assert "EVALUATION STRICTNESS" in page1_text, "Missing Evaluation Strictness on Page 1"
    assert "Section & Topic Mastery" in page1_text, "Missing Section Mastery on Page 1"
    print("✔ Page 1 verified: Executive Bento Summary & Section Breakdown present")

    final_page_text = doc[-1].get_text()
    assert "10-Point Academic Grade Scale" in final_page_text, "Missing 10-Point Grade Scale on Final Page"
    assert "AI Strictness Calibration" in final_page_text, "Missing Strictness Calibration on Final Page"
    assert "AI Rubric Verification Engine" in final_page_text, "Missing signature footer on Final Page"
    print("✔ Final Page verified: Institutional Grading Scale, AI Strictness & Signatures present")

    # 3. Test Browser Print Layout with Playwright
    print("\n--- Testing Browser Print Layout with Playwright ---")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # Open student marksheet page
        marksheet_url = f"http://localhost:3000/#/report/{sheet_id}"
        print(f"Navigating to {marksheet_url}...")
        await page.goto(marksheet_url, wait_until="networkidle")
        await page.wait_for_timeout(1000)

        # Emulate print media
        print("Emulating print media (page.emulate_media(media='print'))...")
        await page.emulate_media(media="print")
        await page.wait_for_timeout(500)

        # 3a. Verify sidebar is hidden in print
        sidebar = page.locator("aside")
        if await sidebar.count() > 0:
            is_visible = await sidebar.is_visible()
            # In print emulation, check computed style display
            display = await sidebar.evaluate("el => window.getComputedStyle(el).display")
            assert display == "none", f"Sidebar should have display:none in print, got {display}"
            print(f"✔ AppSidebar is hidden in print: display={display}")

        # 3b. Verify header action bar is hidden in print
        top_header = page.locator("header:has-text('Student Marksheet')")
        if await top_header.count() > 0:
            display = await top_header.evaluate("el => window.getComputedStyle(el).display")
            assert display == "none", f"Top toolbar should have display:none in print, got {display}"
            print(f"✔ Top action toolbar is hidden in print: display={display}")

        # 3c. Verify both front and back sheets exist and are displayed
        front_sheet = page.locator(".print-front-sheet")
        assert await front_sheet.count() > 0, "Missing .print-front-sheet element"
        front_display = await front_sheet.evaluate("el => window.getComputedStyle(el).display")
        assert front_display != "none", f"Front sheet should be displayed in print, got {front_display}"
        print(f"✔ Front Sheet rendered in print: display={front_display}")

        back_sheet = page.locator(".print-back-sheet")
        assert await back_sheet.count() > 0, "Missing .print-back-sheet element"
        back_display = await back_sheet.evaluate("el => window.getComputedStyle(el).display")
        assert back_display != "none", f"Back sheet should be displayed in print, got {back_display}"
        print(f"✔ Back Sheet rendered in print: display={back_display}")

        # 3d. Verify scroll containers unlocked in print
        body_overflow = await page.evaluate("() => window.getComputedStyle(document.body).overflow")
        assert body_overflow == "visible", f"body overflow in print should be visible, got {body_overflow}"
        print(f"✔ Body overflow in print is unlocked: {body_overflow}")

        # 3e. Generate browser PDF output
        pdf_path = Path("data/browser_print_output.pdf")
        await page.pdf(path=str(pdf_path), format="A4", print_background=True)
        assert pdf_path.exists(), "Browser PDF was not generated"
        pdf_size = pdf_path.stat().st_size
        assert pdf_size > 20000, f"Browser PDF too small: {pdf_size} bytes"
        print(f"✔ Browser Print PDF generated successfully: {pdf_size} bytes at {pdf_path}")

        # Inspect browser generated PDF
        b_doc = fitz.open(str(pdf_path))
        print(f"✔ Browser Print PDF page count: {len(b_doc)} pages")
        assert len(b_doc) >= 2, f"Expected multi-page browser PDF, got {len(b_doc)}"

        await browser.close()

    print("\n=======================================================")
    print("ALL PRINT AND BACKEND PDF VERIFICATIONS PASSED 100%!")
    print("=======================================================")

if __name__ == "__main__":
    asyncio.run(main())

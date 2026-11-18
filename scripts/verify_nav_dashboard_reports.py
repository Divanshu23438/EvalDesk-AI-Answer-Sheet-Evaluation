#!/usr/bin/env python3
"""
Verification script for:
1. Collapsible Left Navigation Sidebar (Dashboard, Evaluate Sheets, History, Reports)
2. Dashboard Screen & GET /api/dashboard/summary
3. History Screen & GET /api/sheets/history with teacher filters
4. Reports Center Screen & batch export endpoints (.xlsx, .pdf)
5. Upload Screen Auto-Fetch Exam Details & student class auto-fill
"""
import io
import json
import subprocess
import sys
import time
import urllib.request
import requests
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PROOF_DIR = ROOT / "docs" / "proof" / "ui" / "navigation"
PROOF_DIR.mkdir(parents=True, exist_ok=True)

BASE_BACKEND = "http://127.0.0.1:8000"


def ensure_backend_server():
    try:
        with urllib.request.urlopen(f"{BASE_BACKEND}/api/health", timeout=1) as resp:
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
            with urllib.request.urlopen(f"{BASE_BACKEND}/api/health", timeout=1) as resp:
                if resp.status == 200:
                    print("FastAPI backend ready.")
                    return proc
        except Exception:
            continue
    proc.terminate()
    raise RuntimeError("Failed to start FastAPI backend on port 8000")


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
                continue

    print("Starting Vite frontend server...")
    subprocess.Popen(
        ["npm.cmd" if sys.platform == "win32" else "npm", "run", "dev"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(30):
        time.sleep(1)
        for port in [3000, 3001, 5173]:
            url = f"http://localhost:{port}"
            try:
                with urllib.request.urlopen(url, timeout=1) as resp:
                    if resp.status in (200, 304):
                        print(f"Frontend ready at {url}")
                        return url
            except Exception:
                continue
    raise RuntimeError("Failed to connect to Vite dev server")


def verify_backend_endpoints():
    print("\n--- [BACKEND API VERIFICATION] ---")

    # 1. Dashboard summary
    dash_res = requests.get(f"{BASE_BACKEND}/api/dashboard/summary", timeout=10)
    assert dash_res.status_code == 200, f"Dashboard summary failed: {dash_res.text}"
    dash_data = dash_res.json()
    print("Dashboard summary response:", json.dumps({k: dash_data[k] for k in list(dash_data.keys())[:5]}, indent=2))
    assert "total_evaluated" in dash_data
    assert "needs_review_count" in dash_data
    assert "avg_score_pct" in dash_data
    assert "avg_ocr_confidence" in dash_data
    assert "total_papers" in dash_data
    assert "subject_performance" in dash_data
    assert "score_distribution" in dash_data
    assert "evaluation_history_trend" in dash_data
    assert "recent_sheets" in dash_data
    print("PASS: GET /api/dashboard/summary")

    # 2. History endpoint
    hist_res = requests.get(f"{BASE_BACKEND}/api/sheets/history", timeout=10)
    assert hist_res.status_code == 200, f"Sheets history failed: {hist_res.text}"
    hist_data = hist_res.json()
    assert "sheets" in hist_data
    assert "subjects" in hist_data
    assert "exams" in hist_data
    print(f"Sheets history returned {len(hist_data['sheets'])} sheets, {len(hist_data['subjects'])} subjects, {len(hist_data['exams'])} exams")

    # Filtered test
    if hist_data["subjects"]:
        test_sub = hist_data["subjects"][0]
        f_res = requests.get(f"{BASE_BACKEND}/api/sheets/history?subject={test_sub}", timeout=10)
        assert f_res.status_code == 200
        print(f"PASS: GET /api/sheets/history with subject filter ({test_sub})")

    # 3. Auto-fetch paper details
    af_res = requests.post(
        f"{BASE_BACKEND}/api/papers/auto-fetch-details",
        json={"title_hint": "Computer Networks Mid Term Exam CS-301 Class 10th Total Marks 50"},
        timeout=10,
    )
    assert af_res.status_code == 200, f"Auto-fetch failed: {af_res.text}"
    af_data = af_res.json()
    print("Auto-fetch result:", json.dumps(af_data, indent=2))
    assert af_data.get("status") == "success"
    assert "Computer Networks" in af_data.get("subject", "") or "CS-301" in af_data.get("subject_code", "")
    print("PASS: POST /api/papers/auto-fetch-details")

    # 4. Identity with class_name
    if hist_data["sheets"]:
        sample_sheet = hist_data["sheets"][0]
        sheet_id = sample_sheet["id"]
        paper_id = sample_sheet["paper_id"]

        id_res = requests.post(
            f"{BASE_BACKEND}/api/sheets/{sheet_id}/identity",
            json={
                "student_name": sample_sheet["student_name"] or "Student",
                "roll_number": sample_sheet["roll_number"] or "01",
                "class_name": "CS-A",
            },
            timeout=10,
        )
        assert id_res.status_code == 200, f"Set identity failed: {id_res.text}"
        id_data = id_res.json()
        assert id_data.get("class_name") == "CS-A"
        print("PASS: POST /api/sheets/{id}/identity with class_name")

        # 5. Whole class marksheet PDF export
        pdf_res = requests.get(f"{BASE_BACKEND}/api/papers/{paper_id}/export/class-pdf", timeout=15)
        assert pdf_res.status_code == 200, f"Class PDF export failed: {pdf_res.text}"
        assert pdf_res.content.startswith(b"%PDF-"), "Invalid PDF header on Class Marksheet"
        print(f"PASS: GET /api/papers/{paper_id}/export/class-pdf (bytes: {len(pdf_res.content)})")

        # 6. Whole class Excel export
        xlsx_res = requests.get(f"{BASE_BACKEND}/api/papers/{paper_id}/export/excel", timeout=15)
        assert xlsx_res.status_code == 200, f"Class Excel export failed: {xlsx_res.text}"
        assert len(xlsx_res.content) > 100
        print(f"PASS: GET /api/papers/{paper_id}/export/excel (bytes: {len(xlsx_res.content)})")

        # 7. Student report card PDF export
        stud_pdf_res = requests.get(f"{BASE_BACKEND}/api/sheets/{sheet_id}/export/pdf", timeout=15)
        assert stud_pdf_res.status_code == 200, f"Student PDF export failed: {stud_pdf_res.text}"
        assert stud_pdf_res.content.startswith(b"%PDF-")
        print(f"PASS: GET /api/sheets/{sheet_id}/export/pdf (bytes: {len(stud_pdf_res.content)})")


def verify_ui():
    frontend_url = get_frontend_url()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        print("\n--- [UI VERIFICATION 1: DASHBOARD & SIDEBAR] ---")
        page.goto(f"{frontend_url}/#/dashboard", wait_until="networkidle")
        time.sleep(1)

        # Check title
        assert page.locator("h1:has-text('Evaluation Dashboard')").count() > 0
        print("PASS: Dashboard header rendered")

        # Check 5 KPI cards
        assert page.locator("text='Sheets Evaluated'").count() > 0
        assert page.locator("text='Needs Review'").count() > 0
        assert page.locator("text='Class Average %'").count() > 0
        assert page.locator("text='Avg OCR Legibility'").count() > 0
        assert page.locator("text='Question Papers'").count() > 0
        print("PASS: 5 KPI Summary cards rendered")

        # Check graphs
        assert page.locator("text='Subject-Wise Average Performance'").count() > 0
        assert page.locator("text='Score Mastery & Evaluation Activity'").count() > 0
        print("PASS: Performance and Mastery graphs rendered")

        page.screenshot(path=str(PROOF_DIR / "1_dashboard_expanded.png"))

        # Test Sidebar Collapse
        collapse_btn = page.locator("button[aria-label='Collapse sidebar']")
        if collapse_btn.count() > 0:
            collapse_btn.click()
            time.sleep(0.5)
            # Verify collapsed rail
            aside = page.locator("aside")
            assert "w-16" in (aside.get_attribute("class") or "")
            print("PASS: Sidebar collapsed to w-16")
            page.screenshot(path=str(PROOF_DIR / "2_dashboard_sidebar_collapsed.png"))

            # Test Sidebar Expand
            expand_btn = page.locator("button[aria-label='Expand sidebar']")
            expand_btn.click()
            time.sleep(0.5)
            assert "w-60" in (aside.get_attribute("class") or "")
            print("PASS: Sidebar expanded back to w-60")

        print("\n--- [UI VERIFICATION 2: HISTORY SCREEN] ---")
        # Click History in sidebar
        hist_btn = page.locator("aside button:has-text('History')")
        hist_btn.click()
        page.wait_for_url("**/#/history", timeout=5000)
        time.sleep(1)

        assert page.locator("h1:has-text('Evaluation History')").count() > 0
        assert page.locator("text='Teacher Filters'").count() > 0
        assert page.locator("select").count() >= 2
        print("PASS: History Screen and Teacher Filters rendered")
        page.screenshot(path=str(PROOF_DIR / "3_history_screen.png"))

        print("\n--- [UI VERIFICATION 3: REPORTS CENTER SCREEN] ---")
        # Click Reports in sidebar
        reports_btn = page.locator("aside button:has-text('Reports')")
        reports_btn.click()
        page.wait_for_url("**/#/reports", timeout=5000)
        time.sleep(1)

        assert page.locator("h1:has-text('Reports & Results Center')").count() > 0
        assert page.locator("text='Whole-Class Performance Overview'").count() > 0
        assert page.locator("button:has-text('Download Class Result (.xlsx)')").count() > 0
        assert page.locator("button:has-text('Download Class Marksheet (.pdf)')").count() > 0
        print("PASS: Reports Center and Whole-Class export buttons rendered")
        page.screenshot(path=str(PROOF_DIR / "4_reports_center_screen.png"))

        print("\n--- [UI VERIFICATION 4: UPLOAD SCREEN AUTO-FETCH] ---")
        eval_btn = page.locator("aside button:has-text('Evaluate Sheets')")
        eval_btn.click()
        page.wait_for_url("**/#/upload", timeout=5000)
        time.sleep(1)

        assert page.locator("button:has-text('Auto-Fetch Exam Details')").count() > 0
        print("PASS: Upload Screen Card 1 Auto-Fetch Exam Details button rendered")
        page.screenshot(path=str(PROOF_DIR / "5_upload_auto_fetch.png"))

        # Click Auto-Fetch Exam Details
        page.locator("button:has-text('Auto-Fetch Exam Details')").click(force=True)
        time.sleep(1.5)
        page.screenshot(path=str(PROOF_DIR / "6_upload_auto_fetch_success.png"))

        print("\n--- [UI VERIFICATION 5: SINGLE-SHEET REPORT SCREEN] ---")
        # Go to sheet report
        page.goto(f"{frontend_url}/#/report/7e2972d1-e4b6-455b-bf82-c07655b2936e", wait_until="networkidle")
        time.sleep(1)

        # Check sidebar is present on left
        assert page.locator("aside").count() > 0
        print("PASS: AppSidebar present on left in Single-Sheet Report Screen")
        page.screenshot(path=str(PROOF_DIR / "7_single_sheet_report_with_sidebar.png"))

        browser.close()
        print("\nALL VERIFICATIONS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    b_proc = ensure_backend_server()
    try:
        verify_backend_endpoints()
        verify_ui()
    finally:
        if b_proc:
            b_proc.terminate()

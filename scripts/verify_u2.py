import os
import sys
import time
import json
import subprocess
import urllib.request
import urllib.parse
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
BASE_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://localhost:5173"
PROOF_DIR = ROOT / "docs" / "proof" / "ui"
SCREENSHOTS_DIR = PROOF_DIR / "screenshots"
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

def ensure_backend_server():
    try:
        with urllib.request.urlopen("http://127.0.0.1:8000/api/health", timeout=1) as resp:
            if resp.status == 200:
                return None
    except Exception:
        pass

    print("Starting FastAPI backend on port 8000...")
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--port", "8000"],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    for _ in range(30):
        time.sleep(0.5)
        try:
            with urllib.request.urlopen("http://127.0.0.1:8000/api/health", timeout=1) as resp:
                if resp.status == 200:
                    print("FastAPI backend server ready at http://127.0.0.1:8000")
                    return proc
        except Exception:
            continue
    proc.terminate()
    raise RuntimeError("Failed to start FastAPI backend server")

def ensure_frontend_server():
    try:
        with urllib.request.urlopen("http://localhost:5173", timeout=1) as resp:
            if resp.status in (200, 304):
                return None
    except Exception:
        pass

    npx = "npx.cmd" if sys.platform == "win32" else "npx"
    print("Starting Vite development server on port 5173...")
    proc = subprocess.Popen(
        [npx, "vite", "--port", "5173"],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        shell=(sys.platform == "win32")
    )
    for _ in range(30):
        time.sleep(0.5)
        try:
            with urllib.request.urlopen("http://localhost:5173", timeout=1) as resp:
                if resp.status in (200, 304):
                    print("Vite development server ready at http://localhost:5173")
                    return proc
        except Exception:
            continue
    proc.terminate()
    raise RuntimeError("Failed to start Vite dev server")

def request_json(method, path, data=None):
    url = f"{BASE_URL}{path}"
    headers = {"Accept": "application/json"}
    body = None
    if data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as he:
        err_body = he.read().decode("utf-8")
        try:
            return he.code, json.loads(err_body)
        except:
            return he.code, {"detail": err_body}

def main():
    b_proc = ensure_backend_server()
    f_proc = ensure_frontend_server()

    traces = []
    traces.append("=== PHASE U1 & U2: LIVE PROCESSING SCREEN & STAGE TRACKER PROOF ===\n")
    traces.append(f"Verification Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}\n")

    try:
        # 1. Fetch papers and find active locked paper
        st, data = request_json("GET", "/api/papers")
        papers = data.get("papers", [])
        if not papers:
            print("[FAIL] No papers found.")
            sys.exit(1)

        locked_paper = next((p for p in papers if p.get("is_locked")), papers[0])
        paper_id = locked_paper["id"]
        traces.append(f"Target Paper: {paper_id} ('{locked_paper['title']}')")

        # 2. Fetch sheets for paper
        st, s_data = request_json("GET", f"/api/papers/{paper_id}/sheets")
        sheets = s_data.get("sheets", [])
        if not sheets:
            print("[FAIL] No sheets found for paper.")
            sys.exit(1)

        target_sheet = sheets[0]
        sheet_id = target_sheet["id"]
        traces.append(f"Target Sheet: {sheet_id} (Student: '{target_sheet.get('student_name')}', Status: '{target_sheet.get('status')}')")

        # 3. Fetch sheet real status & history array
        st, status_data = request_json("GET", f"/api/sheets/{sheet_id}")
        assert st == 200, f"Failed to get sheet status: {status_data}"
        traces.append("\nLive Sheet Status Data from Server (Contract Section 9):")
        traces.append(f"  - status: {status_data.get('status')}")
        traces.append(f"  - current_stage: {status_data.get('current_stage')}")
        traces.append(f"  - pages_read / pages_total: {status_data.get('pages_read')} / {status_data.get('pages_total')}")
        traces.append(f"  - questions_marked / questions_total: {status_data.get('questions_marked')} / {status_data.get('questions_total')}")
        traces.append(f"  - retry_at: {status_data.get('retry_at')}")
        traces.append(f"  - failed_stage: {status_data.get('failed_stage')}")
        traces.append("  - history trace:")
        history = status_data.get("history", [])
        for h in history:
            traces.append(f"      * {h.get('stage')} at {h.get('at')}")

        # 4. Playwright Viewport & UI Assertions
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            for w, h in [(1366, 768), (1920, 1080)]:
                page = browser.new_page(viewport={"width": w, "height": h})
                console_errors = []
                page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
                page.on("pageerror", lambda err: console_errors.append(str(err)))

                page.goto(f"{FRONTEND_URL}/#/processing/{sheet_id}", wait_until="domcontentloaded")
                page.wait_for_selector('section[aria-label="Processing View"]', timeout=10000)

                # UI Element Checks immediately upon entering processing view
                proc_view = page.locator('section[aria-label="Processing View"]')
                assert proc_view.is_visible(), "Processing view section is not visible"

                batch_list = page.locator('aside[aria-label="Batch Sheets List"]')
                assert batch_list.is_visible(), "Batch sheets list sidebar is not visible"

                # Viewport scroll assertion: scrollHeight must be <= innerHeight
                scroll_h = page.evaluate("document.scrollingElement.scrollHeight")
                inner_h = page.evaluate("window.innerHeight")
                assert scroll_h <= inner_h, f"Page scrolls at {w}x{h}: scrollHeight={scroll_h} > innerHeight={inner_h}"

                screenshot_path = SCREENSHOTS_DIR / f"u2_processing_{w}x{h}.png"
                page.screenshot(path=str(screenshot_path))
                traces.append(f"\n[PASS] Viewport {w}x{h}: scrollHeight={scroll_h} <= innerHeight={inner_h} | Console Errors: {len(console_errors)} | Screenshot: {screenshot_path}")

                # Wait for auto-advance to #/evaluate for evaluated/needs_review sheet
                page.wait_for_timeout(2000)
                current_url = page.url
                traces.append(f"  [PASS] Auto-advance verification: navigated to {current_url}")
                assert "#/evaluate" in current_url, f"Expected auto-advance to #/evaluate, got {current_url}"
                page.close()
            browser.close()

        proof_file = PROOF_DIR / "u1_u2_proof.txt"
        with open(proof_file, "w", encoding="utf-8") as f:
            f.write("\n".join(traces))
        print(f"\n[ALL PASS] Phase U2 verified. Proof saved to: {proof_file}")

    finally:
        if f_proc:
            f_proc.terminate()
        if b_proc:
            b_proc.terminate()

if __name__ == "__main__":
    main()

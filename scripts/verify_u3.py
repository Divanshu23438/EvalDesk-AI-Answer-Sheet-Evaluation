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
    traces.append("=== PHASE U3: ONE-SCREEN EVALUATION WORKSPACE PROOF ===\n")
    traces.append(f"Verification Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}\n")

    try:
        # 1. Fetch papers & sheets
        st, data = request_json("GET", "/api/papers")
        papers = data.get("papers", [])
        assert papers, "No papers found"
        locked_paper = next((p for p in papers if p.get("is_locked")), papers[0])
        paper_id = locked_paper["id"]

        st, s_data = request_json("GET", f"/api/papers/{paper_id}/sheets")
        sheets = s_data.get("sheets", [])
        assert sheets, "No sheets found for paper"
        sheet_id = sheets[0]["id"]
        traces.append(f"Target Sheet: {sheet_id} under Paper: {paper_id}")

        # 2. Fetch Review Data: GET /api/sheets/{id}/review
        rev_st, rev_data = request_json("GET", f"/api/sheets/{sheet_id}/review")
        assert rev_st == 200, f"Failed to get review data: {rev_data}"
        questions = rev_data.get("questions", [])
        assert questions, "No questions found in review"
        target_q = questions[0]
        eval_id = target_q["eval_id"]
        q_key = target_q.get("question_key") or target_q.get("key")
        traces.append(f"Loaded {len(questions)} questions for evaluation review.")
        traces.append(f"Testing Question Q{target_q.get('q_no')} (Key: {q_key}, Eval ID: {eval_id})")

        # 3. Test API Trace: Save OCR & Marks Override (POST /api/evaluations/{id}/review)
        save_st, save_res = request_json("POST", f"/api/evaluations/{eval_id}/review", {
            "teacher_marks": target_q.get("max_marks", 2.0),
            "override_reason": "Verified complete answer text.",
            "accept_ai": False,
            "ocr_text": "Sample answer transcript verified by teacher.",
            "is_counted": True
        })
        traces.append(f"\n[API TRACE] Save OCR & Teacher Marks Override (POST /api/evaluations/{eval_id}/review):")
        traces.append(f"  HTTP {save_st} -> Response: {json.dumps(save_res)}")
        assert save_st == 200, f"Evaluation review save failed: {save_res}"

        # 4. Test API Trace: Recheck Question (POST /api/evaluations/{id}/recheck)
        recheck_st, recheck_res = request_json("POST", f"/api/evaluations/{eval_id}/recheck", {
            "edited_text": "Short-term scheduler selects from ready queue."
        })
        traces.append(f"\n[API TRACE] Live AI Recheck (POST /api/evaluations/{eval_id}/recheck):")
        traces.append(f"  HTTP {recheck_st} -> Marks: {recheck_res.get('final_marks')}, Resolved: {recheck_res.get('resolved')}")
        assert recheck_st == 200, f"Recheck failed: {recheck_res}"

        # 5. Test API Trace: Update Reference (PUT /api/papers/{paper_id}/questions/{key}/reference)
        ref_st, ref_res = request_json("PUT", f"/api/papers/{paper_id}/questions/{q_key}/reference", {
            "model_answer": "Short-term scheduler (CPU scheduler) selects processes from ready queue.",
            "key_points": [{"point": "Short-term scheduler definition", "marks": 2.0}]
        })
        traces.append(f"\n[API TRACE] Update Single Reference (PUT /api/papers/{paper_id}/questions/{q_key}/reference):")
        traces.append(f"  HTTP {ref_st} -> {ref_res}")
        assert ref_st == 200, f"Reference update failed: {ref_res}"

        # 6. Test API Trace: Approve All Unflagged (POST /api/sheets/{sheet_id}/approve-unflagged)
        appr_st, appr_res = request_json("POST", f"/api/sheets/{sheet_id}/approve-unflagged")
        traces.append(f"\n[API TRACE] Approve All Unflagged (POST /api/sheets/{sheet_id}/approve-unflagged):")
        traces.append(f"  HTTP {appr_st} -> {appr_res}")
        assert appr_st == 200, f"Approve all unflagged failed: {appr_res}"

        # 7. Playwright Browser Viewport & UI Assertions
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            for w, h in [(1366, 768), (1920, 1080)]:
                page = browser.new_page(viewport={"width": w, "height": h})
                console_errors = []
                page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
                page.on("pageerror", lambda err: console_errors.append(str(err)))

                page.goto(f"{FRONTEND_URL}/#/evaluate/{sheet_id}", wait_until="domcontentloaded")
                page.wait_for_selector('section[aria-label="Evaluation Details"]', timeout=10000)
                page.wait_for_timeout(1000)

                # Assert: Zero page scroll
                scroll_h = page.evaluate("document.scrollingElement.scrollHeight")
                inner_h = page.evaluate("window.innerHeight")
                assert scroll_h <= inner_h, f"Page scrolls at {w}x{h}: scrollHeight={scroll_h} > innerHeight={inner_h}"

                # Assert: All 3 panes visible
                sidebar = page.locator('aside[aria-label="Question Navigator"]')
                assert sidebar.is_visible(), "Question sidebar is not visible"

                viewer = page.locator('div[aria-label="Sheet Viewer"]')
                assert viewer.is_visible(), "Sheet viewer is not visible"

                details = page.locator('section[aria-label="Evaluation Details"]')
                assert details.is_visible(), "Evaluation details section is not visible"

                # Test keyboard shortcut '[' for sidebar collapse
                sidebar_initial_w = sidebar.bounding_box()["width"]
                page.keyboard.press("[")
                page.wait_for_timeout(300)
                sidebar_collapsed_w = sidebar.bounding_box()["width"]
                assert sidebar_collapsed_w < sidebar_initial_w, f"Sidebar failed to collapse on '[' key: {sidebar_collapsed_w} vs {sidebar_initial_w}"

                # Expand back
                page.keyboard.press("[")
                page.wait_for_timeout(300)

                screenshot_path = SCREENSHOTS_DIR / f"u3_evaluate_{w}x{h}.png"
                page.screenshot(path=str(screenshot_path))
                traces.append(f"\n[PASS] Viewport {w}x{h}: scrollHeight={scroll_h} <= innerHeight={inner_h} | Console Errors: {len(console_errors)} | Screenshot: {screenshot_path}")
                page.close()
            browser.close()

        proof_file = PROOF_DIR / "u3_proof.txt"
        with open(proof_file, "w", encoding="utf-8") as f:
            f.write("\n".join(traces))
        print(f"\n[ALL PASS] Phase U3 verified. Proof saved to: {proof_file}")

    finally:
        if f_proc:
            f_proc.terminate()
        if b_proc:
            b_proc.terminate()

if __name__ == "__main__":
    main()

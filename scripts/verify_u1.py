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

def upload_multipart(path, file_path, filename=None):
    url = f"{BASE_URL}{path}"
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    fname = filename or os.path.basename(file_path)
    with open(file_path, "rb") as f:
        file_bytes = f.read()

    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="files"; filename="{fname}"\r\n'
        f"Content-Type: image/jpeg\r\n\r\n"
    ).encode("utf-8") + file_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Accept": "application/json",
    }
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content)
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
    traces.append("=== PHASE U1: UPLOAD SCREEN & BATCH QUEUE VERIFICATION ===\n")
    traces.append(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}\n")

    try:
        # 1. Fetch papers and get or lock an active paper
        st, data = request_json("GET", "/api/papers")
        papers = data.get("papers", [])
        if not papers:
            print("[FAIL] No papers in database.")
            sys.exit(1)

        locked_paper = next((p for p in papers if p.get("is_locked")), None)
        if not locked_paper:
            paper_id = papers[0]["id"]
            request_json("POST", f"/api/papers/{paper_id}/lock")
            locked_paper = papers[0]
        paper_id = locked_paper["id"]
        traces.append(f"Using locked paper: {paper_id} ('{locked_paper['title']}')")

        # 2. Test Bad File Upload (minimum 500 bytes validation)
        dummy_bad_path = PROOF_DIR / "bad_file.jpg"
        with open(dummy_bad_path, "wb") as bf:
            bf.write(b"tiny")
        bad_st, bad_res = upload_multipart(f"/api/papers/{paper_id}/sheets", str(dummy_bad_path), "bad_file.jpg")
        if dummy_bad_path.exists():
            dummy_bad_path.unlink()
        traces.append(f"Bad File Test (expected HTTP 400): HTTP {bad_st} -> {bad_res}")
        assert bad_st == 400, f"Expected HTTP 400 on bad file, got {bad_st}"

        # 3. Test Valid File Upload
        sample_img = ROOT / "src" / "assets" / "images" / "handwritten_sheet_english_p1_1794626970104.jpg"
        if not sample_img.exists():
            from PIL import Image
            im = Image.new("RGB", (600, 800), color=(255, 255, 255))
            sample_img = PROOF_DIR / "temp_sheet.jpg"
            im.save(str(sample_img), "JPEG")

        up_st, up_res = upload_multipart(f"/api/papers/{paper_id}/sheets", str(sample_img), "student_sheet_p1.jpg")
        traces.append(f"Upload Valid Sheet: HTTP {up_st} -> {up_res}")
        assert up_st == 200, f"Expected HTTP 200 on valid sheet upload, got {up_st}"
        sheet_id = up_res["sheet_id"]

        # 4. Test Inline Identity Save (POST /api/sheets/{id}/identity)
        ident_st, ident_res = request_json("POST", f"/api/sheets/{sheet_id}/identity", {
            "student_name": "Arjun Sharma",
            "roll_number": "ROLL-409"
        })
        traces.append(f"Inline Identity Submission: HTTP {ident_st} -> {ident_res}")
        assert ident_st == 200 and ident_res.get("status") == "queued", f"Identity submission failed: {ident_res}"

        # 5. Verify GET /api/papers/{id}/sheets
        lst_st, lst_res = request_json("GET", f"/api/papers/{paper_id}/sheets")
        sheets = lst_res.get("sheets", [])
        sheet_match = next((s for s in sheets if s["id"] == sheet_id), None)
        assert sheet_match is not None, f"Uploaded sheet {sheet_id} not found in paper sheets queue."
        traces.append(f"Queue Verified: Sheet found with name='{sheet_match.get('student_name')}', roll='{sheet_match.get('roll')}', status='{sheet_match.get('status')}'")

        # 6. Playwright Viewport & UI Assertions
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            for w, h in [(1366, 768), (1920, 1080)]:
                page = browser.new_page(viewport={"width": w, "height": h})
                console_errors = []
                page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

                page.goto(f"{FRONTEND_URL}/#/upload", wait_until="domcontentloaded")
                page.wait_for_selector('section[aria-label="Upload Intake"]', timeout=10000)
                page.wait_for_timeout(1500)

                # Viewport scroll check
                scroll_h = page.evaluate("document.scrollingElement.scrollHeight")
                inner_h = page.evaluate("window.innerHeight")
                assert scroll_h <= inner_h, f"Page scrolls at {w}x{h}: scrollHeight={scroll_h} > innerHeight={inner_h}"

                # UI element checks
                drop_zone = page.locator('section[aria-label="Upload Intake"]')
                assert drop_zone.is_visible(), "Upload drop zone section is not visible"

                queue_zone = page.locator('section[aria-label="Upload Queue"]')
                assert queue_zone.is_visible(), "Upload queue section is not visible"

                screenshot_path = SCREENSHOTS_DIR / f"u1_upload_{w}x{h}.png"
                page.screenshot(path=str(screenshot_path))
                traces.append(f"[PASS] Viewport {w}x{h}: scrollHeight={scroll_h} <= innerHeight={inner_h} | Console Errors: {len(console_errors)} | Screenshot: {screenshot_path}")
                page.close()
            browser.close()

        proof_file = PROOF_DIR / "u1_upload_proof.txt"
        with open(proof_file, "w", encoding="utf-8") as f:
            f.write("\n".join(traces))
        print(f"\n[ALL PASS] Phase U1 verified. Proof saved to: {proof_file}")

    finally:
        if f_proc:
            f_proc.terminate()
        if b_proc:
            b_proc.terminate()

if __name__ == "__main__":
    main()

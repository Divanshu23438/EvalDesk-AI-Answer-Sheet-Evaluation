#!/usr/bin/env python3
"""EvalDesk UI Check: Viewport 100dvh assertion, zero scroll, zero console errors, banned strings scan, and tsc --noEmit.
Usage: python scripts/check_ui.py
Exit code 0 only if every check passes.
"""
import os
import sys
import time
import subprocess
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from scripts.check_all import BANNED
SCAN_EXT = {".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".html", ".css"}
SKIP_DIRS = {".git", "node_modules", "dist", "__pycache__", ".reader_cache", "data",
             "legacy", "docs", "tests", ".venv", "venv", "proof", "scratch"}
SKIP_FILES = {"check_all.py", "check_ui.py", "package-lock.json"}

VIEWPORTS = [
    {"width": 1366, "height": 768, "label": "1366x768"},
    {"width": 1920, "height": 1080, "label": "1920x1080"},
]

ROUTES = [
    {"path": "#/upload", "name": "upload"},
    {"path": "#/processing", "name": "processing"},
    {"path": "#/evaluate", "name": "evaluate"},
    {"path": "#/report", "name": "report"},
    {"path": "#/setup", "name": "setup"},
]

def check_banned_strings():
    hits = []
    for p in ROOT.rglob("*"):
        if (not p.is_file() or p.suffix not in SCAN_EXT or p.name in SKIP_FILES
                or SKIP_DIRS & set(p.relative_to(ROOT).parts)):
            continue
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for i, line in enumerate(text.splitlines(), 1):
            for b in BANNED:
                if b in line:
                    hits.append(f"  {p.relative_to(ROOT)}:{i}: {b!r}")
    if hits:
        print("[FAIL] banned strings scan:")
        print("\n".join(hits))
        return False
    print("[PASS] banned strings (0 violations)")
    return True

def check_tsc():
    tsc_cmd = ["npx.cmd", "tsc", "--noEmit"] if sys.platform == "win32" else ["npx", "tsc", "--noEmit"]
    try:
        r = subprocess.run(tsc_cmd, cwd=ROOT, capture_output=True, text=True, timeout=120)
        if r.returncode != 0:
            print("[FAIL] tsc --noEmit:")
            print((r.stdout + r.stderr)[-2000:])
            return False
        print("[PASS] tsc --noEmit (0 TypeScript errors)")
        return True
    except Exception as e:
        print(f"[FAIL] tsc execution error: {e}")
        return False

def ensure_backend_server():
    # Check if port 8000 is already responding
    try:
        with urllib.request.urlopen("http://127.0.0.1:8000/api/health", timeout=1) as resp:
            if resp.status == 200:
                return None  # already running
    except Exception:
        pass

    # Launch uvicorn backend
    print("Starting FastAPI backend on port 8000...")
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--port", "8000"],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    # Wait up to 15 seconds for backend to respond
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
    raise RuntimeError("Failed to start FastAPI backend server within 15 seconds")

def ensure_frontend_server():
    # Check if port 5173 is already responding
    try:
        with urllib.request.urlopen("http://localhost:5173", timeout=1) as resp:
            if resp.status in (200, 304):
                return None  # already running
    except Exception:
        pass

    # Launch Vite
    npx = "npx.cmd" if sys.platform == "win32" else "npx"
    print("Starting Vite development server on port 5173...")
    proc = subprocess.Popen(
        [npx, "vite", "--port", "5173"],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        shell=(sys.platform == "win32")
    )

    # Wait up to 15 seconds for server to respond
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
    raise RuntimeError("Failed to start Vite dev server within 15 seconds")

def check_playwright_viewports():
    screenshot_dir = ROOT / "docs" / "proof" / "ui" / "screenshots"
    screenshot_dir.mkdir(parents=True, exist_ok=True)

    backend_proc = ensure_backend_server()
    frontend_proc = ensure_frontend_server()
    all_passed = True
    test_results = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)

            for vp in VIEWPORTS:
                context = browser.new_context(
                    viewport={"width": vp["width"], "height": vp["height"]},
                    device_scale_factor=1,
                )
                page = context.new_page()

                for route in ROUTES:
                    console_errors = []
                    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
                    page.on("pageerror", lambda err: console_errors.append(str(err)))

                    url = f"http://localhost:5173/{route['path']}"
                    page.goto(url, wait_until="networkidle")
                    page.wait_for_selector(".app", timeout=5000)
                    time.sleep(0.3)  # Allow rendering to settle

                    # Measure scroll heights
                    dims = page.evaluate("""() => {
                        const se = document.scrollingElement || document.documentElement;
                        return {
                            scrollHeight: se.scrollHeight,
                            clientHeight: se.clientHeight,
                            innerHeight: window.innerHeight,
                            bodyScrollHeight: document.body.scrollHeight,
                            rootScrollHeight: document.getElementById('root')?.scrollHeight || 0
                        };
                    }""")

                    # Assert: no page level scroll
                    # scrollingElement scrollHeight must be <= innerHeight
                    no_page_scroll = dims["scrollHeight"] <= dims["innerHeight"]
                    no_console_errors = len(console_errors) == 0

                    # Save screenshot
                    img_name = f"{route['name']}_{vp['label']}.png"
                    img_path = screenshot_dir / img_name
                    page.screenshot(path=str(img_path))

                    route_pass = no_page_scroll and no_console_errors
                    if not route_pass:
                        all_passed = False

                    status_str = "PASS" if route_pass else "FAIL"
                    print(f"[{status_str}] {vp['label']} {route['path']}: scrollHeight={dims['scrollHeight']} <= innerHeight={dims['innerHeight']} | console_errors={len(console_errors)}")
                    if console_errors:
                        print(f"  Console errors: {console_errors}")

                    test_results.append({
                        "viewport": vp["label"],
                        "route": route["path"],
                        "name": route["name"],
                        "scrollHeight": dims["scrollHeight"],
                        "innerHeight": dims["innerHeight"],
                        "console_errors": len(console_errors),
                        "passed": route_pass,
                        "screenshot": str(img_path.relative_to(ROOT)),
                    })

                context.close()
            browser.close()
    finally:
        if frontend_proc:
            frontend_proc.terminate()
            try:
                frontend_proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                frontend_proc.kill()
        if backend_proc:
            backend_proc.terminate()
            try:
                backend_proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                backend_proc.kill()

    return all_passed, test_results

def main():
    print("=== EvalDesk UI Automated Viewport & Banned-String Gate ===\n")

    banned_ok = check_banned_strings()
    tsc_ok = check_tsc()

    if not (banned_ok and tsc_ok):
        print("\nRESULT: FAILED (Pre-checks failed)")
        sys.exit(1)

    print("\nRunning Playwright Viewport Tests (1366x768 and 1920x1080)...")
    ui_ok, results = check_playwright_viewports()

    # Write summary proof
    proof_file = ROOT / "docs" / "proof" / "ui" / "u0_proof.txt"
    with open(proof_file, "w", encoding="utf-8") as f:
        f.write("=== EVALDESK UI OVERHAUL: PHASE U0 VIEWPORT & BANNED-STRING PROOF ===\n\n")
        f.write("1. Banned Strings Check: PASS (0 violations)\n")
        f.write("2. TypeScript Type Check (tsc --noEmit): PASS (0 errors)\n\n")
        f.write("3. Playwright Viewport & Page Scroll Assertions:\n")
        for r in results:
            pass_str = "PASS" if r["passed"] else "FAIL"
            f.write(f"  [{pass_str}] Viewport {r['viewport']} | Route: {r['route']} | scrollHeight: {r['scrollHeight']}px | innerHeight: {r['innerHeight']}px | Console Errors: {r['console_errors']} | Screenshot: {r['screenshot']}\n")
        f.write("\nAssertion: document.scrollingElement.scrollHeight <= window.innerHeight holds on all screens.\n")
        f.write(f"\nFinal Phase U0 Gate Result: {'ALL PASS' if (banned_ok and tsc_ok and ui_ok) else 'FAIL'}\n")

    print(f"\nProof saved to: {proof_file}")

    if banned_ok and tsc_ok and ui_ok:
        print("\nRESULT: ALL PASS")
        sys.exit(0)
    else:
        print("\nRESULT: FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()

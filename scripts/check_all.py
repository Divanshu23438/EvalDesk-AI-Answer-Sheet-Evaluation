#!/usr/bin/env python3
"""EvalDesk gate: banned strings, secrets in git, pytest, tsc, live provider health.
Usage: python scripts/check_all.py [--no-live] [--base http://localhost:8000]
Exit code 0 only if every check passes."""
import argparse, json, subprocess, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BANNED = [
    "Linux kernel", "chmod", "Sarah", "Jenkins", "Rohan", "BCA-2026-44",
    "Sample extracted line text", "Comprehensive model explanation",
    "3ce9faec", "e8b6b996", 'key_ref = "Linux"', "max_m * 0.8",
    "Offline resilience", "Accurately answered all parts",
]
SCAN_EXT = {".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".html", ".css"}
SKIP_DIRS = {".git", "node_modules", "dist", "__pycache__", ".reader_cache", "data",
             "legacy", "docs", "tests", ".venv", "venv", "proof"}
SKIP_FILES = {"check_all.py", "check_ui.py", "verify_u1.py", "verify_u2.py", "package-lock.json"}
results = []

def record(name, ok, detail=""):
    results.append((name, ok))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f"\n{detail}" if detail and not ok else ""))

def check_banned():
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
    record("banned strings", not hits, "\n".join(hits))

def run(cmd, cwd=ROOT):
    try:
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=600)
        return r.returncode, (r.stdout + r.stderr)[-2000:]
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        return 1, str(e)

def check_git_secrets():
    code, out = run(["git", "ls-files"])
    if code:
        return record("git secrets", False, "  not a git repo or git missing: " + out)
    bad = [f for f in out.splitlines() if f == ".env" or f.endswith("/.env")
           or f.startswith(("dist/", "data/", ".reader_cache/")) or "__pycache__" in f]
    record("no .env/dist/data/cache tracked", not bad, "\n".join("  " + f for f in bad))

def check_pytest():
    code, out = run([sys.executable, "-m", "pytest", "-q"])
    record("pytest", code == 0, out)

def check_tsc():
    cmd = ["npx.cmd" if sys.platform == "win32" else "npx", "tsc", "--noEmit"]
    code, out = run(cmd)
    record("tsc --noEmit", code == 0, out)

def check_health(base):
    try:
        with urllib.request.urlopen(base + "/api/health/providers", timeout=120) as r:
            body = json.loads(r.read())
        print(json.dumps(body, indent=2)[:2000])
        record("live provider health (endpoint reachable)", True)
    except Exception as e:
        record("live provider health", False, f"  {e}")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-live", action="store_true")
    ap.add_argument("--base", default="http://localhost:8000")
    a = ap.parse_args()
    check_banned(); check_git_secrets(); check_pytest(); check_tsc()
    if not a.no_live:
        check_health(a.base)
    failed = [n for n, ok in results if not ok]
    print("\nRESULT:", "ALL PASS" if not failed else f"{len(failed)} FAILED: {failed}")
    sys.exit(1 if failed else 0)

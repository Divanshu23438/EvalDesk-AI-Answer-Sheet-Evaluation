import shutil
import zipfile
from pathlib import Path
from datetime import datetime
from backend.config import (
    DATA_DIR,
    STORAGE_DIR,
    PAPERS_STORAGE_DIR,
    SHEETS_STORAGE_DIR,
    REPORTS_STORAGE_DIR,
    EXPORTS_STORAGE_DIR,
)

def get_paper_dir(paper_id: str) -> Path:
    p = PAPERS_STORAGE_DIR / paper_id
    p.mkdir(parents=True, exist_ok=True)
    return p

def get_sheet_dir(sheet_id: str) -> Path:
    s = SHEETS_STORAGE_DIR / sheet_id
    (s / "original").mkdir(parents=True, exist_ok=True)
    (s / "regions").mkdir(parents=True, exist_ok=True)
    (s / "lines").mkdir(parents=True, exist_ok=True)
    return s

def get_reports_dir(paper_id: str) -> Path:
    r = REPORTS_STORAGE_DIR / paper_id
    r.mkdir(parents=True, exist_ok=True)
    return r

def delete_sheet_files(sheet_id: str):
    s = SHEETS_STORAGE_DIR / sheet_id
    if s.exists():
        shutil.rmtree(s, ignore_errors=True)

def delete_paper_files(paper_id: str):
    p = PAPERS_STORAGE_DIR / paper_id
    if p.exists():
        shutil.rmtree(p, ignore_errors=True)
    r = REPORTS_STORAGE_DIR / paper_id
    if r.exists():
        shutil.rmtree(r, ignore_errors=True)

def create_data_backup() -> Path:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = DATA_DIR / f"backup_{timestamp}.zip"
    
    with zipfile.ZipFile(backup_file, "w", zipfile.ZIP_DEFLATED) as zf:
        for file in DATA_DIR.rglob("*"):
            if "backup_" in file.name or ".git" in str(file):
                continue
            if file.is_file():
                arcname = file.relative_to(DATA_DIR)
                zf.write(file, arcname)
                
    return backup_file

import json
import shutil
import zipfile
from pathlib import Path
from typing import Any, Optional
from datetime import datetime
from backend.config import (
    BASE_DIR,
    DATA_DIR,
    STORAGE_DIR,
    PAPERS_STORAGE_DIR,
    SHEETS_STORAGE_DIR,
    REPORTS_STORAGE_DIR,
    EXPORTS_STORAGE_DIR,
)

def to_relative_posix(path: Path) -> str:
    """Converts a Path to relative POSIX string for reliable cross-platform DB storage."""
    try:
        rel = path.relative_to(BASE_DIR)
        return rel.as_posix()
    except Exception:
        return path.as_posix()

def from_relative_posix(path_str: str) -> Path:
    """Converts a stored relative POSIX string back to an absolute Path."""
    p = Path(path_str)
    if p.is_absolute():
        return p
    return BASE_DIR / p

def get_paper_dir(paper_id: str) -> Path:
    p = PAPERS_STORAGE_DIR / paper_id
    p.mkdir(parents=True, exist_ok=True)
    return p

def get_paper_draft_dir(draft_id: str) -> Path:
    p = PAPERS_STORAGE_DIR / "drafts" / draft_id
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

def get_or_create_answer_crop_path(
    sheet_id: str,
    eval_id: str,
    page_file_path: Optional[Path] = None,
    bbox_raw: Any = None,
    page_idx: int = 0,
) -> Optional[Path]:
    """
    Retrieves or generates a cropped JPEG snippet of the student's handwritten answer.
    Caches into data/storage/sheets/{sheet_id}/crops/{eval_id}.jpg.
    Returns the absolute Path if successful, or None.
    """
    if not sheet_id or not eval_id:
        return None

    crop_dir = SHEETS_STORAGE_DIR / sheet_id / "crops"
    crop_dir.mkdir(parents=True, exist_ok=True)
    crop_file = crop_dir / f"{eval_id}.jpg"

    if crop_file.exists() and crop_file.stat().st_size > 0:
        return crop_file

    if not page_file_path or not page_file_path.exists():
        return None

    try:
        from PIL import Image
        with Image.open(page_file_path) as img:
            w, h = img.size
            bboxes = []
            if isinstance(bbox_raw, str):
                try:
                    bboxes = json.loads(bbox_raw)
                except Exception:
                    bboxes = []
            elif isinstance(bbox_raw, list):
                bboxes = bbox_raw

            if bboxes and isinstance(bboxes, list) and len(bboxes) > 0:
                box = bboxes[0]
                if isinstance(box, dict) and "x" in box and "y" in box and "w" in box and "h" in box:
                    bx = box["x"] * w if box["x"] <= 1.0 else (box["x"] / 1000.0 * w if box["x"] <= 1000 and w > 1000 else box["x"])
                    by = box["y"] * h if box["y"] <= 1.0 else (box["y"] / 1000.0 * h if box["y"] <= 1000 and h > 1000 else box["y"])
                    bw = box["w"] * w if box["w"] <= 1.0 else (box["w"] / 1000.0 * w if box["w"] <= 1000 and w > 1000 else box["w"])
                    bh = box["h"] * h if box["h"] <= 1.0 else (box["h"] / 1000.0 * h if box["h"] <= 1000 and h > 1000 else box["h"])
                    crop_box = (
                        max(0, int(bx - 12)),
                        max(0, int(by - 12)),
                        min(w, int(bx + bw + 12)),
                        min(h, int(by + bh + 12)),
                    )
                elif isinstance(box, (list, tuple)) and len(box) == 4:
                    b0, b1, b2, b3 = box
                    if max(b0, b1, b2, b3) <= 1.0:
                        crop_box = (
                            max(0, int(b1 * w - 12)),
                            max(0, int(b0 * h - 12)),
                            min(w, int(b3 * w + 12)),
                            min(h, int(b2 * h + 12)),
                        )
                    elif max(b0, b1, b2, b3) <= 1000 and (w > 1000 or h > 1000):
                        crop_box = (
                            max(0, int((b1 / 1000.0) * w - 12)),
                            max(0, int((b0 / 1000.0) * h - 12)),
                            min(w, int((b3 / 1000.0) * w + 12)),
                            min(h, int((b2 / 1000.0) * h + 12)),
                        )
                    else:
                        crop_box = (
                            max(0, int(min(b1, b3) - 12)),
                            max(0, int(min(b0, b2) - 12)),
                            min(w, int(max(b1, b3) + 12)),
                            min(h, int(max(b0, b2) + 12)),
                        )
                else:
                    crop_box = (0, 0, w, min(h, int(h * 0.35)))
            else:
                crop_box = (0, 0, w, min(h, int(h * 0.35)))

            if crop_box[2] <= crop_box[0] or crop_box[3] <= crop_box[1]:
                crop_box = (0, 0, w, min(h, int(h * 0.35)))

            cropped = img.crop(crop_box)
            cropped.save(crop_file, format="JPEG", quality=90)
            return crop_file
    except Exception:
        return None

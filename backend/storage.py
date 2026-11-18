import json
import shutil
import zipfile
import hashlib
from pathlib import Path
from typing import Any, Optional, Tuple, List, Dict
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

def normalize_box_coords(box: Any, w: int, h: int) -> Optional[Tuple[int, int, int, int]]:
    """
    Normalizes and clamps bounding boxes across arbitrary nesting structures:
    - Dicts: {"x": ..., "y": ..., "w": ..., "h": ...}
    - Lists of 4 coords: [ymin, xmin, ymax, xmax] in 0..1, 0..1000, or pixel scale
    - Deeply nested structures: [[[ymin, ...]]]
    - Multiple sub-boxes on a page: computes bounding envelope
    Returns (left, top, right, bottom) clamped to image, or None if invalid.
    """
    if box is None:
        return None

    cur = box
    # Unwrap outer single-element wrappers
    while isinstance(cur, (list, tuple)) and len(cur) == 1 and isinstance(cur[0], (list, tuple, dict)):
        cur = cur[0]

    # Multiple sub-boxes on the same page: take bounding envelope
    if isinstance(cur, (list, tuple)) and len(cur) > 0 and isinstance(cur[0], (list, tuple)) and len(cur[0]) == 4:
        norm_subs = [normalize_box_coords(sb, w, h) for sb in cur]
        valid_subs = [b for b in norm_subs if b is not None]
        if valid_subs:
            min_l = min(b[0] for b in valid_subs)
            min_t = min(b[1] for b in valid_subs)
            max_r = max(b[2] for b in valid_subs)
            max_b = max(b[3] for b in valid_subs)
            return (min_l, min_t, max_r, max_b)
        return None

    # Dict format: x, y, w, h
    if isinstance(cur, dict) and "x" in cur and "y" in cur and "w" in cur and "h" in cur:
        raw_x = float(cur["x"])
        raw_y = float(cur["y"])
        raw_w = float(cur["w"])
        raw_h = float(cur["h"])
        if raw_x <= 1.0 and raw_w <= 1.0:
            left, top, right, bottom = raw_x * w, raw_y * h, (raw_x + raw_w) * w, (raw_y + raw_h) * h
        elif raw_x <= 1000 and (w > 1000 or h > 1000):
            left, top, right, bottom = (raw_x / 1000.0) * w, (raw_y / 1000.0) * h, ((raw_x + raw_w) / 1000.0) * w, ((raw_y + raw_h) / 1000.0) * h
        else:
            left, top, right, bottom = raw_x, raw_y, raw_x + raw_w, raw_y + raw_h
    elif isinstance(cur, (list, tuple)) and len(cur) == 4:
        # Standard object detection: [ymin, xmin, ymax, xmax]
        b0, b1, b2, b3 = float(cur[0]), float(cur[1]), float(cur[2]), float(cur[3])
        if max(b0, b1, b2, b3) <= 1.0:
            left, top, right, bottom = min(b1, b3) * w, min(b0, b2) * h, max(b1, b3) * w, max(b0, b2) * h
        elif max(b0, b1, b2, b3) <= 1000 and (w > 1000 or h > 1000):
            left = (min(b1, b3) / 1000.0) * w
            top = (min(b0, b2) / 1000.0) * h
            right = (max(b1, b3) / 1000.0) * w
            bottom = (max(b0, b2) / 1000.0) * h
        else:
            left = min(b1, b3)
            top = min(b0, b2)
            right = max(b1, b3)
            bottom = max(b0, b2)
    else:
        return None

    # Generous margin padding
    pad = 16
    left = max(0, int(left - pad))
    top = max(0, int(top - pad))
    right = min(w, int(right + pad))
    bottom = min(h, int(bottom + pad))

    if right <= left + 10 or bottom <= top + 10:
        return None

    return (left, top, right, bottom)

def clear_answer_crops(sheet_id: str, eval_id: Optional[str] = None) -> None:
    """Removes cached crop files for a sheet or specific evaluation."""
    crop_dir = SHEETS_STORAGE_DIR / sheet_id / "crops"
    if not crop_dir.exists():
        return
    if eval_id:
        for f in crop_dir.glob(f"{eval_id}*.jpg"):
            try:
                f.unlink(missing_ok=True)
            except Exception:
                pass
    else:
        for f in crop_dir.glob("*.jpg"):
            try:
                f.unlink(missing_ok=True)
            except Exception:
                pass

def get_or_create_answer_crop_path(
    sheet_id: str,
    eval_id: str,
    page_file_path: Optional[Path] = None,
    bbox_raw: Any = None,
    page_idx: int = 0,
    page_numbers: Optional[List[int]] = None,
    pages_map: Optional[Dict[int, Path]] = None,
) -> Optional[Path]:
    """
    Retrieves or generates a cropped JPEG snippet of the student's handwritten answer.
    Supports multi-page continuation stacking with page headers.
    Cached into data/storage/sheets/{sheet_id}/crops/{eval_id}_{hash}.jpg.
    Returns the absolute Path if successful, or None if unattempted / box not found.
    """
    if not sheet_id or not eval_id:
        return None

    crop_dir = SHEETS_STORAGE_DIR / sheet_id / "crops"
    crop_dir.mkdir(parents=True, exist_ok=True)

    # Compute content hash for cache key
    h_src = f"{eval_id}|{page_numbers}|{bbox_raw}"
    cache_tag = hashlib.sha256(h_src.encode("utf-8")).hexdigest()[:12]
    crop_file = crop_dir / f"{eval_id}_{cache_tag}.jpg"

    if crop_file.exists() and crop_file.stat().st_size > 0:
        return crop_file

    # Parse bboxes
    bboxes = []
    if isinstance(bbox_raw, str):
        try:
            bboxes = json.loads(bbox_raw)
        except Exception:
            bboxes = []
    elif isinstance(bbox_raw, list):
        bboxes = bbox_raw

    if not bboxes:
        return None

    if isinstance(bboxes[0], (int, float)) and len(bboxes) == 4:
        bboxes = [bboxes]

    try:
        from PIL import Image, ImageDraw

        segments: List[Tuple[int, Image.Image]] = []

        # Multi-page continuation path
        if pages_map and page_numbers and len(page_numbers) > 0:
            for idx, p_num in enumerate(page_numbers):
                p_path = pages_map.get(p_num)
                if not p_path or not p_path.exists():
                    continue
                box_item = bboxes[idx] if idx < len(bboxes) else (bboxes[0] if len(bboxes) == 1 else None)
                if not box_item:
                    continue
                with Image.open(p_path) as p_img:
                    w, h = p_img.size
                    crop_box = normalize_box_coords(box_item, w, h)
                    if crop_box:
                        cropped = p_img.crop(crop_box)
                        segments.append((p_num, cropped.copy()))
        elif page_file_path and page_file_path.exists():
            # Single-page path
            with Image.open(page_file_path) as p_img:
                w, h = p_img.size
                box_item = bboxes[0] if bboxes else None
                crop_box = normalize_box_coords(box_item, w, h) if box_item else None
                if crop_box:
                    cropped = p_img.crop(crop_box)
                    p_num = (page_numbers[0] if page_numbers else page_idx + 1)
                    segments.append((p_num, cropped.copy()))

        if not segments:
            return None

        if len(segments) == 1:
            final_img = segments[0][1]
        else:
            # Stack continuation segments vertically with clean divider banners
            max_w = max(s[1].width for s in segments)
            banner_h = 28
            total_h = sum(s[1].height + banner_h for s in segments)
            stacked = Image.new("RGB", (max_w, total_h), (248, 250, 252))
            draw = ImageDraw.Draw(stacked)

            y_cursor = 0
            for i, (p_num, s_img) in enumerate(segments):
                # Banner bar
                draw.rectangle([0, y_cursor, max_w, y_cursor + banner_h], fill=(226, 232, 240))
                label = f"Page {p_num}" if i == 0 else f"Page {p_num} (Continuation)"
                draw.text((12, y_cursor + 7), label, fill=(51, 65, 85))
                y_cursor += banner_h
                # Paste cropped content
                stacked.paste(s_img, (0, y_cursor))
                y_cursor += s_img.height

            final_img = stacked

        # Save to cached file
        final_img.save(crop_file, format="JPEG", quality=90)
        # Also maintain eval_id.jpg alias for legacy consumers
        legacy_file = crop_dir / f"{eval_id}.jpg"
        try:
            final_img.save(legacy_file, format="JPEG", quality=90)
        except Exception:
            pass

        return crop_file
    except Exception as exc:
        print(f"[Crops] Error generating crop for {eval_id}: {exc}")
        return None

import io
import csv
import zipfile
import random
from pathlib import Path
from typing import Optional
from backend.db import get_db
from backend.config import BASE_DIR, EXPORTS_STORAGE_DIR

def build_training_export_zip(
    only_human_verified: bool = True,
    dataset_version: str = "v1.0.0",
) -> Path:
    """
    Creates labels.csv and images/ in a ZIP export, split by sheet (never by line),
    respecting student consent flags, and filtering for human_verified lines.
    """
    EXPORTS_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = EXPORTS_STORAGE_DIR / f"training_export_{dataset_version}.zip"

    with get_db() as conn:
        # Fetch consenting sheets
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM sheets WHERE consent_flag = 1")
        consenting_sheets = [row["id"] for row in cursor.fetchall()]

        if not consenting_sheets:
            # Create an empty template export
            with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
                zf.writestr("labels.csv", "filename,text,page,sheet_id,provenance,split,dataset_version\n")
            return zip_path

        # Split consenting sheets into train (70%), val (15%), test (15% - frozen test set)
        shuffled = list(consenting_sheets)
        random.seed(42)  # Deterministic seed for reproducible splits
        random.shuffle(shuffled)

        n_total = len(shuffled)
        n_test = max(1, int(n_total * 0.15)) if n_total >= 3 else 0
        n_val = max(1, int(n_total * 0.15)) if n_total >= 3 else 0
        test_sheets = set(shuffled[:n_test])
        val_sheets = set(shuffled[n_test : n_test + n_val])
        train_sheets = set(shuffled[n_test + n_val :])

        # Fetch training lines for consented sheets
        query = """
            SELECT tl.*, sp.page_number
            FROM training_lines tl
            JOIN sheets s ON tl.sheet_id = s.id
            LEFT JOIN sheet_pages sp ON tl.sheet_id = sp.sheet_id
            WHERE s.consent_flag = 1
        """
        if only_human_verified:
            query += " AND tl.provenance = 'human_verified'"

        cursor.execute(query)
        rows = cursor.fetchall()

        # Build CSV and ZIP
        csv_buffer = io.StringIO()
        writer = csv.writer(csv_buffer)
        writer.writerow(["filename", "text", "page", "sheet_id", "provenance", "split", "dataset_version"])

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for r in rows:
                sheet_id = r["sheet_id"]
                split = "test" if sheet_id in test_sheets else "val" if sheet_id in val_sheets else "train"
                
                # Image relative path and content
                rel_img_path = r["image_path"]
                full_img_path = BASE_DIR / rel_img_path
                if not full_img_path.exists():
                    full_img_path = BASE_DIR / "data" / "storage" / rel_img_path
                if not full_img_path.exists():
                    full_img_path = Path(rel_img_path)
                archive_img_name = f"images/{Path(rel_img_path).name}"

                if full_img_path.exists():
                    zf.write(full_img_path, archive_img_name)
                    text_label = r["verified_text"] if r["provenance"] == "human_verified" else r["ai_text"]
                    page_num = r["page_number"] or 1
                    writer.writerow([archive_img_name, text_label, page_num, sheet_id, r["provenance"], split, dataset_version])

            zf.writestr("labels.csv", csv_buffer.getvalue())

    return zip_path

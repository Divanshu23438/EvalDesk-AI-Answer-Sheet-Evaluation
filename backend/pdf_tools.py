from pathlib import Path
from typing import List, Dict, Any, Optional
import pymupdf
from PIL import Image

def process_pdf(pdf_path: Path, output_image_dir: Optional[Path] = None, dpi: int = 200) -> Dict[str, Any]:
    """
    Processes a PDF file:
    - Extracts typed text if present.
    - If output_image_dir is provided or PDF is scanned, renders pages to JPG.
    """
    doc = pymupdf.open(str(pdf_path))
    page_count = len(doc)
    all_text = []
    page_images = []

    for page_num in range(page_count):
        page = doc[page_num]
        txt = page.get_text("text").strip()
        if txt:
            all_text.append(txt)

        if output_image_dir:
            output_image_dir.mkdir(parents=True, exist_ok=True)
            pix = page.get_pixmap(dpi=dpi)
            out_file = output_image_dir / f"page_{page_num + 1:02d}.jpg"
            pix.save(str(out_file))
            page_images.append(out_file)

    combined_text = "\n\n".join(all_text).strip()
    is_typed = len(combined_text) > 80  # Substantial text layer detected

    return {
        "is_typed": is_typed,
        "text": combined_text,
        "page_count": page_count,
        "page_images": page_images,
    }

def convert_single_image_to_standard_jpeg(image_path: Path, output_path: Path, max_dimension: int = 2000) -> Path:
    """
    Converts and normalizes an image (PNG, WebP, rotated camera JPG) to an upright standard JPEG.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.open(image_path)
    
    # Auto-orient based on EXIF
    from PIL import ImageOps
    img = ImageOps.exif_transpose(img)
    img = img.convert("RGB")

    w, h = img.size
    if max(w, h) > max_dimension:
        scale = max_dimension / float(max(w, h))
        img = img.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)

    img.save(output_path, "JPEG", quality=90)
    return output_path

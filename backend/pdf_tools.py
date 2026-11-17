import io
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import pymupdf
from PIL import Image, ImageOps

def process_pdf_bytes(
    pdf_bytes: bytes,
    output_image_dir: Optional[Path] = None,
    dpi: int = 200
) -> Dict[str, Any]:
    """
    Processes PDF bytes:
    - Verifies document integrity.
    - Extracts typed text layer if present.
    - Renders pages to standard JPEG images if output_image_dir is provided or text is absent.
    """
    if not pdf_bytes or len(pdf_bytes) < 100:
        raise ValueError("Corrupt or empty PDF data: file is empty or under 100 bytes.")

    try:
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        raise ValueError(f"Corrupt or invalid PDF document: {e}") from e

    page_count = len(doc)
    if page_count == 0:
        raise ValueError("Corrupt PDF document contains 0 pages.")

    all_text: List[str] = []
    page_images_bytes: List[bytes] = []
    page_image_paths: List[Path] = []

    for page_num in range(page_count):
        try:
            page = doc[page_num]
            txt = page.get_text("text").strip()
            if txt:
                all_text.append(txt)

            pix = page.get_pixmap(dpi=dpi)
            jpg_bytes = pix.tobytes(output="jpeg")
            page_images_bytes.append(jpg_bytes)

            if output_image_dir:
                output_image_dir.mkdir(parents=True, exist_ok=True)
                out_file = output_image_dir / f"page_{page_num + 1:02d}.jpg"
                out_file.write_bytes(jpg_bytes)
                page_image_paths.append(out_file)
        except Exception as e:
            raise ValueError(f"Failed to process page {page_num + 1} of PDF: {e}") from e

    combined_text = "\n\n".join(all_text).strip()
    is_typed = len(combined_text) > 80  # Substantial text layer detected

    return {
        "is_typed": is_typed,
        "text": combined_text,
        "page_count": page_count,
        "page_images_bytes": page_images_bytes,
        "page_images": page_image_paths,
    }

def process_pdf(pdf_path: Path, output_image_dir: Optional[Path] = None, dpi: int = 200) -> Dict[str, Any]:
    """
    Reads a PDF from disk and processes it.
    """
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF file does not exist: {pdf_path}")
    data = pdf_path.read_bytes()
    return process_pdf_bytes(data, output_image_dir=output_image_dir, dpi=dpi)

def normalize_image_bytes(
    image_bytes: bytes,
    max_dimension: int = 2000
) -> Tuple[bytes, str]:
    """
    Takes raw image bytes (JPEG, PNG, WebP, etc.):
    - Validates integrity.
    - Rejects blank / solid color images with clear error.
    - Applies EXIF orientation.
    - Converts to RGB standard JPEG.
    - Resizes to at most max_dimension on longest edge.
    Returns: (standard_jpeg_bytes, "image/jpeg")
    """
    if not image_bytes or len(image_bytes) < 100:
        raise ValueError("Corrupt or empty image data: file is empty or under 100 bytes.")

    try:
        img = Image.open(io.BytesIO(image_bytes))
        img.load()
    except Exception as e:
        raise ValueError(f"Corrupt or invalid image file: {e}") from e

    # Check for blank / solid color image
    rgb_img = img.convert("RGB")
    extrema = rgb_img.getextrema()  # [ (r_min, r_max), (g_min, g_max), (b_min, b_max) ]
    is_blank = all((b_max - b_min) <= 2 for b_min, b_max in extrema)
    if is_blank:
        raise ValueError("Input image is completely blank or contains no legible content.")

    # Auto-orient based on EXIF
    rgb_img = ImageOps.exif_transpose(rgb_img)

    w, h = rgb_img.size
    if max(w, h) > max_dimension:
        scale = max_dimension / float(max(w, h))
        new_w = max(1, int(w * scale))
        new_h = max(1, int(h * scale))
        rgb_img = rgb_img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    out_buf = io.BytesIO()
    rgb_img.save(out_buf, format="JPEG", quality=80)
    return out_buf.getvalue(), "image/jpeg"

def apply_rotation_degrees(image_bytes: bytes, rotation_degrees: int) -> bytes:
    """Rotates an image clockwise by 0, 90, 180, or 270 degrees locally without network overhead."""
    if not image_bytes or rotation_degrees not in (90, 180, 270):
        return image_bytes
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img.load()
        rotated = img.rotate(-rotation_degrees, expand=True)
        buf = io.BytesIO()
        rotated.convert("RGB").save(buf, format="JPEG", quality=85)
        return buf.getvalue()
    except Exception as e:
        print(f"[Rotation] Warning: failed to rotate image: {e}")
        return image_bytes

async def auto_orient_image_bytes(image_bytes: bytes, rotation_hint: int = 0) -> bytes:
    """
    Fast local auto-orientation:
    1. Transposes mobile/scanner EXIF orientation tags (1-8) instantly.
    2. Applies rotation_hint (0, 90, 180, 270) if provided without an expensive round-trip.
    """
    if not image_bytes or len(image_bytes) < 100:
        return image_bytes

    try:
        img = Image.open(io.BytesIO(image_bytes))
        img.load()
        img = ImageOps.exif_transpose(img)
        if rotation_hint in (90, 180, 270):
            img = img.rotate(-rotation_hint, expand=True)
        buf = io.BytesIO()
        img.convert("RGB").save(buf, format="JPEG", quality=85)
        return buf.getvalue()
    except Exception:
        return image_bytes

def convert_single_image_to_standard_jpeg(
    image_path: Path,
    output_path: Path,
    max_dimension: int = 2000
) -> Path:
    """
    Reads an image from disk, normalizes it, and saves to output_path.
    """
    if not image_path.exists():
        raise FileNotFoundError(f"Image file does not exist: {image_path}")
    raw_bytes = image_path.read_bytes()
    norm_bytes, _ = normalize_image_bytes(raw_bytes, max_dimension=max_dimension)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(norm_bytes)
    return output_path

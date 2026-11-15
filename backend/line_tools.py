import os
from pathlib import Path
from typing import List, Dict, Any
import cv2
import numpy as np

def segment_text_lines(image_path: Path, output_dir: Path) -> List[Dict[str, Any]]:
    """
    OpenCV line segmentation for handwritten answer sheets (OCR Label Studio standard):
    Uses Otsu thresholding, horizontal morphological dilation to join words into lines,
    finds external contours, filters noise, and sorts lines top-to-bottom.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    results = []

    img_bgr = cv2.imread(str(image_path))
    if img_bgr is None:
        print(f"[line_tools] Error: could not load image at {image_path}")
        return []

    h, w = img_bgr.shape[:2]
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    # 1. Gaussian blur to suppress fine paper noise
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # 2. Otsu thresholding (inverted: dark ink becomes white foreground 255)
    _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # 3. Morphological dilation horizontally to merge words on the same line
    # Width of kernel is proportional to page width to bridge inter-word gaps
    kernel_w = max(25, int(w * 0.035))
    kernel_h = max(2, int(h * 0.003))
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_w, kernel_h))
    dilated = cv2.dilate(binary, kernel, iterations=1)

    # 4. Find external contours
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    boxes = []
    min_line_width = int(w * 0.10)   # Line must span at least 10% of page width
    min_line_height = max(15, int(h * 0.010)) # Minimum 15px height

    for cnt in contours:
        x, y, bw, bh = cv2.boundingRect(cnt)
        if bw >= min_line_width and bh >= min_line_height:
            boxes.append((x, y, bw, bh))

    # 5. Sort lines strictly from top to bottom by y-coordinate
    boxes.sort(key=lambda b: b[1])

    # Fallback if no lines were detected (e.g. very faint ink)
    if not boxes:
        step_h = h // 6
        for i in range(1, 6):
            boxes.append((int(w * 0.05), int(i * step_h), int(w * 0.90), int(step_h * 0.85)))

    # 6. Crop and save lines
    for idx, (x, y, bw, bh) in enumerate(boxes):
        # Add 4px padding around line if within bounds
        pad_y = 4
        pad_x = 4
        y1 = max(0, y - pad_y)
        y2 = min(h, y + bh + pad_y)
        x1 = max(0, x - pad_x)
        x2 = min(w, x + bw + pad_x)

        line_crop = img_bgr[y1:y2, x1:x2]
        line_filename = f"line_{idx + 1:03d}.png"
        line_path = output_dir / line_filename
        cv2.imwrite(str(line_path), line_crop)

        results.append({
            "line_index": idx + 1,
            "x": x1,
            "y": y1,
            "width": x2 - x1,
            "height": y2 - y1,
            "image_path": line_path.relative_to(output_dir.parent.parent.parent).as_posix(),
            "full_path": str(line_path),
        })

    return results

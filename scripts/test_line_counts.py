import os
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.line_tools import segment_text_lines

pages = [
    ("English Literature Sheet", Path("src/assets/images/handwritten_sheet_english_p1_1794626970104.jpg")),
    ("Mathematics Sheet", Path("src/assets/images/handwritten_sheet_maths_p1_1794626970674.jpg")),
    ("Science Sheet", Path("src/assets/images/handwritten_sheet_science_p1_1794626969647.jpg")),
]

output_base = Path("data/storage/test_lines")
output_base.mkdir(parents=True, exist_ok=True)

print("=== OPENCV LINE SEGMENTATION (OCR LABEL STUDIO) ON 3 REAL PAGES ===")
for name, p in pages:
    out_dir = output_base / p.stem
    lines = segment_text_lines(p, out_dir)
    print(f"\n[Page]: {name}")
    print(f"  File: {p}")
    print(f"  Detected Text Lines: {len(lines)}")
    if lines:
        for idx, l in enumerate(lines[:3]):
            print(f"    Line {l['line_index']}: box=({l['x']}, {l['y']}, {l['width']}x{l['height']}) -> {l['full_path']}")
        if len(lines) > 3:
            print(f"    ... and {len(lines) - 3} more lines cropped.")

import sqlite3
import pymupdf

def main():
    conn = sqlite3.connect("data/app.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sheets WHERE id = ?", ("2ba84226-9a91-40ce-9b64-e91e967ed099",))
    sheet = dict(cursor.fetchone())

    pdf_path = "data/storage/reports/43922f58-dfb4-49ce-9248-fb7dc29e0d84/report_card_SGSU250489.pdf"
    doc = pymupdf.open(pdf_path)
    print("=== Report Card PDF Verification ===")
    print(f"File: {pdf_path}")
    print(f"Total Pages: {len(doc)}")

    total_images = sum(len(page.get_images()) for page in doc)
    print(f"Total Embedded Images: {total_images}")

    full_text = "\n".join(page.get_text() for page in doc)
    score_str = f"{sheet['total_score']:g}"
    max_str = f"{sheet['max_marks']:g}"
    pct_str = f"{sheet['percentage']:g}%"
    grade_str = f"Grade {sheet['grade']}"

    print(f"Student Name in PDF: {sheet['student_name'] in full_text}")
    print(f"Roll Number in PDF: {sheet['roll_number'] in full_text}")
    print(f"Total Score ({score_str}) in PDF: {score_str in full_text}")
    print(f"Max Marks ({max_str}) in PDF: {max_str in full_text}")
    print(f"Percentage ({pct_str}) in PDF: {pct_str in full_text}")
    print(f"Grade ({grade_str}) in PDF: {grade_str in full_text}")
    
    has_devanagari = any(ord(c) >= 0x0900 and ord(c) <= 0x097F for c in full_text)
    print(f"Contains Devanagari text: {has_devanagari}")

    has_part1 = "Part I" in full_text
    has_part2 = "Part II" in full_text
    has_part3 = "Part III" in full_text
    print(f"Section banners present: Part I: {has_part1}, Part II: {has_part2}, Part III: {has_part3}")

    assert sheet["student_name"] in full_text, "Student name missing"
    assert sheet["roll_number"] in full_text, "Roll number missing"
    assert score_str in full_text, "Score missing"
    assert max_str in full_text, "Max marks missing"
    assert pct_str in full_text, "Percentage missing"
    assert grade_str in full_text, "Grade missing"
    assert total_images >= 15, f"Expected at least 15 images, got {total_images}"
    assert has_devanagari, "Devanagari characters missing"
    assert has_part1 and has_part2 and has_part3, "Section banners missing"

    print("\nALL PHASE E REPORT CARD CRITERIA VERIFIED SUCCESSFULLY!")

if __name__ == "__main__":
    main()

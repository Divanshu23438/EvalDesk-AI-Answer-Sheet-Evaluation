import io
import json
import sys
import requests
import pymupdf
from pathlib import Path
from PIL import Image

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("=" * 60)
    print("P4.4 HOTFIX VERIFICATION: Sheet Upload & Identity Handling")
    print("=" * 60)

    # 1. Create a test paper and lock it
    paper_payload = {
        "title": "P4.4 Upload Fix Verification Exam",
        "subject": "Computer Science",
        "strictness": "lenient",
        "checking_medium": "ai_reference",
        "total_marks": 10.0,
        "instructions": "All questions are compulsory.",
        "questions": [
            {
                "key": "q_1",
                "q_no": "1",
                "question_text": "What is a process in operating systems?",
                "max_marks": 5.0,
                "question_type": "short",
                "section_name": "Section A",
                "options": [],
            },
            {
                "key": "q_2",
                "q_no": "2",
                "question_text": "Differentiate between process and thread.",
                "max_marks": 5.0,
                "question_type": "short",
                "section_name": "Section A",
                "options": [],
            }
        ]
    }

    create_res = requests.post(f"{BASE_URL}/api/papers", json=paper_payload)
    assert create_res.status_code == 200, f"Failed to create paper: {create_res.text}"
    paper_id = create_res.json()["paper_id"]
    print(f"[PASS] Created paper: {paper_id}")

    # Provide reference and lock
    ref_payload = {
        "references": [
            {
                "key": "q_1",
                "model_answer": "A process is a program in execution containing its own address space, code, and resources.",
                "key_points": [
                    {"text": "Program in execution", "marks": 2.5},
                    {"text": "Contains address space and resources", "marks": 2.5}
                ]
            },
            {
                "key": "q_2",
                "model_answer": "A process is a heavy-weight execution unit with independent memory, while a thread is a light-weight unit sharing memory.",
                "key_points": [
                    {"text": "Process has separate memory", "marks": 2.5},
                    {"text": "Thread shares memory with parent", "marks": 2.5}
                ]
            }
        ]
    }
    ref_res = requests.put(f"{BASE_URL}/api/papers/{paper_id}/reference", json=ref_payload)
    assert ref_res.status_code == 200, f"Failed to set reference: {ref_res.text}"
    print("[PASS] Set reference for paper")

    lock_res = requests.post(f"{BASE_URL}/api/papers/{paper_id}/lock")
    assert lock_res.status_code == 200, f"Failed to lock paper: {lock_res.text}"
    print("[PASS] Locked paper successfully")

    # 2. Test uploading 0-byte file (should return 400)
    print("\n--- Test A: 0-byte upload rejection ---")
    files_0 = [("files", ("empty.jpg", io.BytesIO(b""), "image/jpeg"))]
    res_0 = requests.post(f"{BASE_URL}/api/papers/{paper_id}/sheets", files=files_0, data={"consent_flag": "1"})
    print(f"Status: {res_0.status_code}, Response: {res_0.text}")
    assert res_0.status_code == 400, "Expected 400 for 0-byte file"
    assert "empty or corrupt" in res_0.text, "Expected clear error message for empty file"
    print("[PASS] 0-byte file rejected cleanly with HTTP 400")

    # 3. Test uploading < 500 byte file (should return 400)
    print("\n--- Test B: <500 bytes upload rejection ---")
    files_small = [("files", ("small.jpg", io.BytesIO(b"tiny invalid content"), "image/jpeg"))]
    res_small = requests.post(f"{BASE_URL}/api/papers/{paper_id}/sheets", files=files_small, data={"consent_flag": "1"})
    print(f"Status: {res_small.status_code}, Response: {res_small.text}")
    assert res_small.status_code == 400, "Expected 400 for small file"
    assert "minimum 500 bytes required" in res_small.text or "empty or corrupt" in res_small.text
    print("[PASS] <500-byte file rejected cleanly with HTTP 400")

    # 4. Test uploading a real JPEG image
    print("\n--- Test C: Real JPEG image upload ---")
    real_img_path = Path("src/assets/images/handwritten_sheet_english_p1_1794626970104.jpg")
    assert real_img_path.exists(), f"Image not found: {real_img_path}"
    real_img_bytes = real_img_path.read_bytes()
    print(f"Uploading image size: {len(real_img_bytes)} bytes")

    files_img = [("files", ("english_sheet.jpg", io.BytesIO(real_img_bytes), "image/jpeg"))]
    res_img = requests.post(f"{BASE_URL}/api/papers/{paper_id}/sheets", files=files_img, data={"consent_flag": "1"})
    print(f"Status: {res_img.status_code}, Response: {res_img.json()}")
    assert res_img.status_code == 200, f"Failed to upload image: {res_img.text}"
    img_sheet_data = res_img.json()
    assert "sheet_id" in img_sheet_data
    assert img_sheet_data["pages_count"] >= 1
    sheet_id_img = img_sheet_data["sheet_id"]
    print(f"[PASS] Real JPEG uploaded: sheet_id={sheet_id_img}, status={img_sheet_data['status']}")

    # 5. Test uploading a real PDF file
    print("\n--- Test D: Real PDF upload (converted via pdf_tools) ---")
    # Build a 1-page valid PDF document
    doc = pymupdf.open()
    # Add page with rendered image
    img_pix = pymupdf.Pixmap(str(real_img_path))
    rect = pymupdf.Rect(0, 0, 595, 842) # A4
    page = doc.new_page(width=595, height=842)
    page.insert_image(rect, pixmap=img_pix)
    pdf_bytes = doc.tobytes()
    doc.close()
    print(f"Generated test PDF size: {len(pdf_bytes)} bytes")

    files_pdf = [("files", ("student_submission.pdf", io.BytesIO(pdf_bytes), "application/pdf"))]
    res_pdf = requests.post(f"{BASE_URL}/api/papers/{paper_id}/sheets", files=files_pdf, data={"consent_flag": "1"})
    print(f"Status: {res_pdf.status_code}, Response: {res_pdf.json()}")
    assert res_pdf.status_code == 200, f"Failed to upload PDF: {res_pdf.text}"
    pdf_sheet_data = res_pdf.json()
    assert "sheet_id" in pdf_sheet_data
    assert pdf_sheet_data["pages_count"] >= 1
    sheet_id_pdf = pdf_sheet_data["sheet_id"]
    print(f"[PASS] Real PDF uploaded: sheet_id={sheet_id_pdf}, pages={pdf_sheet_data['pages_count']}, status={pdf_sheet_data['status']}")

    # 6. Test manual identity submission
    print("\n--- Test E: Manual Identity Submission ---")
    id_payload = {
        "student_name": "Aarav Sharma",
        "roll_number": "CS-2026-42"
    }
    id_res = requests.post(f"{BASE_URL}/api/sheets/{sheet_id_pdf}/identity", json=id_payload)
    print(f"Status: {id_res.status_code}, Response: {id_res.json()}")
    assert id_res.status_code == 200
    assert id_res.json()["status"] == "queued"
    assert id_res.json()["student_name"] == "Aarav Sharma"
    print("[PASS] Manual identity saved cleanly and sheet transitioned to queued")

    print("\n" + "=" * 60)
    print("ALL P4.4 HOTFIX TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()

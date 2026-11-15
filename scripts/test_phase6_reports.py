import io
import json
import time
import requests
import openpyxl
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"

def test_phase6():
    print("=" * 60)
    print("PHASE 6 VERIFICATION: Reports Generation (PDF & Excel)")
    print("=" * 60)

    # 1. Create a Paper with 2 questions
    paper_payload = {
        "title": "Operating Systems & Networking Midterm",
        "subject": "Computer Science",
        "strictness": "lenient",
        "checking_medium": "ai_reference",
        "total_marks": 10.0,
        "instructions": "All questions compulsory.",
        "questions": [
            {
                "key": "q_1",
                "q_no": "1",
                "question_text": "Explain the role of the OS kernel and system calls.",
                "max_marks": 5.0,
                "question_type": "short",
                "section_name": "Core",
                "options": []
            },
            {
                "key": "q_2",
                "q_no": "2",
                "question_text": "What is the function of the TCP three-way handshake?",
                "max_marks": 5.0,
                "question_type": "short",
                "section_name": "Core",
                "options": []
            }
        ]
    }
    cp_res = requests.post(f"{BASE_URL}/api/papers", json=paper_payload)
    assert cp_res.status_code == 200, f"Paper creation failed: {cp_res.text}"
    paper_id = cp_res.json()["paper_id"]
    print(f"[PASS] Created paper: {paper_id}")

    # Set reference answers
    ref_payload = {
        "references": [
            {
                "key": "q_1",
                "model_answer": "The kernel is the core of an OS that manages hardware and memory; system calls provide an interface between user applications and kernel space.",
                "key_points": [
                    {"text": "Kernel is central manager of hardware resources", "marks": 2.5},
                    {"text": "System calls interface user programs with kernel privileged services", "marks": 2.5}
                ]
            },
            {
                "key": "q_2",
                "model_answer": "The TCP three-way handshake synchronizes sequence numbers (SYN, SYN-ACK, ACK) to establish a reliable full-duplex network connection.",
                "key_points": [
                    {"text": "SYN, SYN-ACK, ACK sequence synchronization", "marks": 2.5},
                    {"text": "Establishes reliable full-duplex session", "marks": 2.5}
                ]
            }
        ]
    }
    rf_res = requests.put(f"{BASE_URL}/api/papers/{paper_id}/reference", json=ref_payload)
    assert rf_res.status_code == 200
    lock_res = requests.post(f"{BASE_URL}/api/papers/{paper_id}/lock")
    assert lock_res.status_code == 200
    print("[PASS] Paper locked")

    # 2. Upload student sheet
    img_path = Path("src/assets/images/handwritten_sheet_english_p1_1794626970104.jpg")
    assert img_path.exists(), f"Image not found: {img_path}"
    files = [("files", ("sheet_os.jpg", io.BytesIO(img_path.read_bytes()), "image/jpeg"))]
    up_res = requests.post(f"{BASE_URL}/api/papers/{paper_id}/sheets", files=files, data={"consent_flag": "1"})
    assert up_res.status_code == 200
    sheet_data = up_res.json()
    sheet_id = sheet_data["sheet_id"]

    id_res = requests.post(
        f"{BASE_URL}/api/sheets/{sheet_id}/identity",
        json={"student_name": "Priya Sharma", "roll_number": "CS-2026-88"}
    )
    assert id_res.status_code == 200
    print(f"[PASS] Student identity set: Priya Sharma (CS-2026-88), evaluation auto-queued")

    # Wait for evaluation
    print("Waiting for evaluation worker...")
    for _ in range(120):
        time.sleep(2)
        st = requests.get(f"{BASE_URL}/api/sheets/{sheet_id}").json()
        status = st.get("status")
        if status in ("evaluated", "needs_review"):
            print(f"[PASS] Sheet evaluated successfully (status: {status})")
            break
        elif status == "failed":
            raise RuntimeError(f"Evaluation failed: {st.get('error_message')}")
    else:
        raise TimeoutError("Evaluation timed out")

    # 3. Simulate a teacher review override on question 1
    rev_data = requests.get(f"{BASE_URL}/api/sheets/{sheet_id}/review").json()
    all_evals = rev_data["checked_questions"] + rev_data["flagged_questions"]
    q1_eval = next(e for e in all_evals if e["q_no"] == "1")
    eval_id = q1_eval["eval_id"]

    override_marks = 4.5
    requests.post(
        f"{BASE_URL}/api/evaluations/{eval_id}/review",
        json={"teacher_marks": override_marks, "comment": "Thorough system call diagrams.", "accept_ai": False}
    )
    print(f"[PASS] Recorded teacher override on Q.1: {override_marks} marks")

    # 4. Generate Reports via POST /api/papers/{paper_id}/reports/generate
    print("\n--- Generating Reports via POST /api/papers/{paper_id}/reports/generate ---")
    gen_res = requests.post(f"{BASE_URL}/api/papers/{paper_id}/reports/generate")
    print(f"Status: {gen_res.status_code}")
    assert gen_res.status_code == 200, f"Report generation failed: {gen_res.text}"
    rep_data = gen_res.json()

    print(f"Paper: {rep_data['paper_title']}")
    print(f"Total Students: {rep_data['total_students']}")
    print(f"Average Score: {rep_data['average_score']}")
    print(f"Excel URL: {rep_data['excel_report_url']}")
    print(f"Paper Summary PDF: {rep_data['paper_summary_pdf_url']}")
    print(f"Student Reports Count: {len(rep_data['student_reports'])}")

    assert rep_data["total_students"] == 1
    assert "excel_report_url" in rep_data
    assert "paper_summary_pdf_url" in rep_data
    assert len(rep_data["student_reports"]) == 1

    # 5. Check GET /api/papers/{paper_id}/reports returns matching data
    print("\n--- Verifying GET /api/papers/{paper_id}/reports ---")
    get_rep_res = requests.get(f"{BASE_URL}/api/papers/{paper_id}/reports")
    assert get_rep_res.status_code == 200
    get_rep = get_rep_res.json()
    assert get_rep["average_score"] == rep_data["average_score"]
    assert get_rep["excel_report_url"] == rep_data["excel_report_url"]
    print("[PASS] GET /api/papers/{id}/reports returned valid data matching POST generate")

    # 6. Verify Files on Disk and Content Integrity
    print("\n--- Verifying Physical Files on Disk & Content Accuracy ---")
    # A. Student Report Card PDF
    st_rep = rep_data["student_reports"][0]
    st_pdf_rel = st_rep["url"].replace("/storage/reports/", "")
    st_pdf_path = Path("data/storage/reports") / st_pdf_rel
    assert st_pdf_path.exists(), f"Student PDF missing: {st_pdf_path}"
    pdf_bytes_len = len(st_pdf_path.read_bytes())
    assert pdf_bytes_len > 1000, f"Student PDF unexpectedly small: {pdf_bytes_len} bytes"
    print(f"[PASS] Student Report Card PDF verified: {st_pdf_path.name} ({pdf_bytes_len} bytes)")

    # B. Paper Summary PDF
    summary_pdf_rel = rep_data["paper_summary_pdf_url"].replace("/storage/reports/", "")
    summary_pdf_path = Path("data/storage/reports") / summary_pdf_rel
    assert summary_pdf_path.exists(), f"Paper summary PDF missing: {summary_pdf_path}"
    sum_bytes_len = len(summary_pdf_path.read_bytes())
    assert sum_bytes_len > 1000, f"Paper Summary PDF unexpectedly small: {sum_bytes_len} bytes"
    print(f"[PASS] Paper Summary PDF verified: {summary_pdf_path.name} ({sum_bytes_len} bytes)")

    # C. Class Results Excel Workbook (.xlsx)
    excel_rel = rep_data["excel_report_url"].replace("/storage/reports/", "")
    excel_path = Path("data/storage/reports") / excel_rel
    assert excel_path.exists(), f"Excel missing: {excel_path}"
    print(f"[PASS] Class Excel Workbook verified: {excel_path.name} ({len(excel_path.read_bytes())} bytes)")

    # Verify Excel sheets and numbers match DB records exactly
    wb = openpyxl.load_workbook(str(excel_path))
    sheet_names = wb.sheetnames
    print(f"Workbook sheet names: {sheet_names}")
    assert "Class Results" in sheet_names
    assert "Question Breakdown" in sheet_names
    assert "Summary Analytics" in sheet_names

    # Check Class Results sheet values
    ws1 = wb["Class Results"]
    # Row 1 is header, Row 2 is Priya Sharma
    row2 = [cell.value for cell in ws1[2]]
    print(f"Class Results Row 2: {row2}")
    assert row2[0] == "CS-2026-88" # Roll No
    assert row2[1] == "Priya Sharma" # Student Name
    assert row2[2] == rep_data["average_score"] # Total Score equals student total
    assert row2[3] == 10.0 # Max Marks
    assert row2[6] == override_marks # Q1 score equals teacher override
    print("[PASS] Excel Class Results matches database scores exactly!")

    # Check Question Breakdown sheet values
    ws2 = wb["Question Breakdown"]
    q1_row = [cell.value for cell in ws2[2]]
    print(f"Question Breakdown Q.1: {q1_row}")
    assert q1_row[0] == "Q.1"
    assert q1_row[2] == 5.0 # Max marks
    assert q1_row[3] == override_marks # Class average for Q.1
    assert q1_row[6] == 1 # 1 Teacher override recorded
    print("[PASS] Excel Question Breakdown matches question averages and teacher override count exactly!")

    # Check Summary Analytics sheet values
    ws3 = wb["Summary Analytics"]
    metrics = {row[0]: row[1] for row in ws3.iter_rows(values_only=True) if row[0]}
    print(f"Summary Analytics: {metrics}")
    assert metrics["Total Evaluated Students"] == 1
    assert metrics["Class Average Score"] == rep_data["average_score"]
    assert metrics["Total Teacher Overrides"] == 1
    print("[PASS] Excel Summary Analytics matches class metrics and moderation counts exactly!")

    print("\n" + "=" * 60)
    print("ALL PHASE 6 REPORTS TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    test_phase6()

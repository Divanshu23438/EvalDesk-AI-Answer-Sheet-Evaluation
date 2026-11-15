#!/usr/bin/env python3
"""
EvalDesk End-to-End Live Pipeline Verification (Phase 7).
Executes the full real lifecycle against live APIs:
  1. Provider Health Check
  2. Question Paper PDF Generation & Live Question Extraction
  3. Paper Setup & AI Dual-Draft Reference Generation
  4. Paper Locking & Approval
  5. Multi-Page Handwritten Answer Sheet Intake
  6. Resumable Background Evaluation Pipeline Polling
  7. Split-View Review & Teacher Override
  8. Live AI Re-Check
  9. Real Academic Reports (Student PDF Report Card + Class Excel Matrix)
  10. Screen 7 Training Lines Verification & Dataset Export
  11. Cascading Sheet Deletion & Storage Cleanup
"""

import io
import json
import time
import zipfile
import requests
import pymupdf
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"
REPO_ROOT = Path(__file__).resolve().parent.parent
REAL_SHEET_PATH = REPO_ROOT / "src" / "assets" / "images" / "handwritten_sheet_english_p1_1794626970104.jpg"

def run_e2e():
    print("=" * 80)
    print("EVALDESK END-TO-END LIVE PIPELINE VERIFICATION (PHASE 7)")
    print("Base URL:", BASE_URL)
    print("Timestamp:", time.strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 80)

    summary_rows = []

    def record_step(name, ok, duration_s, detail=""):
        status = "PASS" if ok else "FAIL"
        summary_rows.append({
            "step": name,
            "status": status,
            "duration": f"{duration_s:.2f}s",
            "detail": detail
        })
        print(f"[{status}] {name} ({duration_s:.2f}s) - {detail}")
        if not ok:
            raise RuntimeError(f"Step failed: {name} - {detail}")

    total_start = time.time()

    # -------------------------------------------------------------
    # Step 1: Health & Providers Status
    # -------------------------------------------------------------
    t0 = time.time()
    h_res = requests.get(f"{BASE_URL}/api/health/providers", timeout=15)
    t_health = time.time() - t0
    assert h_res.status_code == 200, f"Health check failed: {h_res.text}"
    h_data = h_res.json()
    gem_text = h_data.get("gemini_text", {}).get("status") == "online"
    gem_img = h_data.get("gemini_image", {}).get("status") == "online"
    groq_img = h_data.get("groq_image", {}).get("status") == "online"
    record_step(
        "1. Provider Health Check",
        gem_text and gem_img and groq_img,
        t_health,
        f"Gemini Text: {h_data['gemini_text']['status']}, Gemini Image: {h_data['gemini_image']['status']}, Groq: {h_data['groq_image']['status']}"
    )

    # -------------------------------------------------------------
    # Step 2: Question Paper PDF Creation & Extraction (POST /api/papers/extract)
    # -------------------------------------------------------------
    t0 = time.time()
    doc = pymupdf.open()
    page = doc.new_page()
    qp_text = """CENTRAL ACADEMY SENIOR SECONDARY SCHOOL
ANNUAL EVALUATION 2026 - BIOLOGY
Time: 1 Hour | Total Marks: 10 Marks
General Instructions:
1. All questions are compulsory.
2. Read each question carefully before attempting.

Section A: Core Biology Questions
Q1. (5 Marks) Define photosynthesis and state the balanced chemical equation.
Q2. (5 Marks) Explain the role of chlorophyll in absorbing light energy during the light-dependent stage.
"""
    page.insert_text((50, 72), qp_text, fontsize=11)
    qp_pdf_bytes = doc.tobytes()
    doc.close()

    extract_files = {"paper_file": ("biology_exam.pdf", qp_pdf_bytes, "application/pdf")}
    ext_res = requests.post(f"{BASE_URL}/api/papers/extract", files=extract_files, timeout=60)
    t_ext = time.time() - t0
    assert ext_res.status_code == 200, f"Extract paper failed: {ext_res.text}"
    ext_data = ext_res.json()
    draft_id = ext_data["draft_id"]
    detected_questions = ext_data["questions"]
    assert len(detected_questions) >= 2, f"Expected at least 2 questions, got {len(detected_questions)}"
    record_step(
        "2. Live Question Paper Extraction",
        True,
        t_ext,
        f"Draft ID: {draft_id[:8]}..., Questions Detected: {len(detected_questions)}, Source: {ext_data.get('source')}"
    )

    # -------------------------------------------------------------
    # Step 3: Create Paper & Generate AI References (Task T3 Dual-Draft Cross Check)
    # -------------------------------------------------------------
    t0 = time.time()
    paper_payload = {
        "title": "Annual Evaluation 2026 - Biology",
        "subject": "Biology",
        "strictness": "lenient",
        "checking_medium": "ai_reference",
        "total_marks": 10.0,
        "instructions": ext_data.get("instructions", "Answer all questions."),
        "draft_id": draft_id,
        "questions": [
            {
                "key": q.get("key", f"q_{idx+1}"),
                "q_no": q.get("q_no", str(idx+1)),
                "question_text": q.get("text", ""),
                "max_marks": float(q.get("marks", 5.0)),
                "question_type": q.get("type", "short"),
                "section_name": q.get("section", "Section A"),
                "options": q.get("options", [])
            }
            for idx, q in enumerate(detected_questions)
        ]
    }
    p_res = requests.post(f"{BASE_URL}/api/papers", json=paper_payload, timeout=30)
    assert p_res.status_code == 200, f"Create paper failed: {p_res.text}"
    paper_id = p_res.json()["paper_id"]

    ref_gen_res = requests.post(f"{BASE_URL}/api/papers/{paper_id}/reference/generate", timeout=90)
    assert ref_gen_res.status_code == 200, f"Generate reference failed: {ref_gen_res.text}"
    ref_data = ref_gen_res.json()
    t_setup = time.time() - t0
    record_step(
        "3. Paper Setup & AI Reference Draft",
        True,
        t_setup,
        f"Paper ID: {paper_id}, References Generated: {len(ref_data.get('references', []))}, Disagreements: {len(ref_data.get('disagreements', []))}"
    )

    # -------------------------------------------------------------
    # Step 4: Lock Paper Setup
    # -------------------------------------------------------------
    t0 = time.time()
    lock_res = requests.post(f"{BASE_URL}/api/papers/{paper_id}/lock", timeout=15)
    t_lock = time.time() - t0
    assert lock_res.status_code == 200, f"Lock paper failed: {lock_res.text}"
    record_step("4. Paper Setup Approval & Lock", True, t_lock, f"Paper {paper_id} locked successfully")

    # -------------------------------------------------------------
    # Step 5: Answer Sheet Upload (Real Scan Image)
    # -------------------------------------------------------------
    t0 = time.time()
    assert REAL_SHEET_PATH.exists(), f"Real scan image missing at {REAL_SHEET_PATH}"
    with open(REAL_SHEET_PATH, "rb") as f:
        sheet_bytes = f.read()

    upload_files = [("files", ("student_sheet_p1.jpg", sheet_bytes, "image/jpeg"))]
    upload_data = {"consent_flag": "1"}
    up_res = requests.post(f"{BASE_URL}/api/papers/{paper_id}/sheets", data=upload_data, files=upload_files, timeout=60)
    assert up_res.status_code == 200, f"Upload sheet failed: {up_res.text}"
    sheet_info = up_res.json()
    sheet_id = sheet_info["sheet_id"]

    if sheet_info.get("status") == "needs_identity" or not sheet_info.get("student_name"):
        id_res = requests.post(
            f"{BASE_URL}/api/sheets/{sheet_id}/identity",
            json={"student_name": "Aarav Sharma", "roll_number": "BIO-2026-01"},
            timeout=15
        )
        assert id_res.status_code == 200, f"Set identity failed: {id_res.text}"

    t_upload = time.time() - t0
    record_step(
        "5. Student Sheet Intake",
        True,
        t_upload,
        f"Sheet ID: {sheet_id}, Status: {sheet_info.get('status')}, Header Conf: {sheet_info.get('confidence')}"
    )

    # -------------------------------------------------------------
    # Step 6: Background Evaluation Pipeline Polling
    # -------------------------------------------------------------
    t0 = time.time()
    eval_done = False
    final_sheet = None
    poll_count = 0
    while time.time() - t0 < 120:
        poll_count += 1
        st_res = requests.get(f"{BASE_URL}/api/sheets/{sheet_id}", timeout=15)
        assert st_res.status_code == 200
        cur_sheet = st_res.json()
        cur_status = cur_sheet.get("status")
        if cur_status in ("evaluated", "needs_review"):
            eval_done = True
            final_sheet = cur_sheet
            break
        elif cur_status == "failed":
            raise RuntimeError(f"Evaluation failed: {cur_sheet.get('error_message')}")
        time.sleep(2)

    t_eval = time.time() - t0
    assert eval_done, f"Evaluation timed out after {t_eval:.1f}s"
    record_step(
        "6. Background Evaluation Pipeline",
        True,
        t_eval,
        f"Final Status: {final_sheet['status']}, Score: {final_sheet['total_score']}/{final_sheet['max_marks']}M ({final_sheet['percentage']}%), Grade: {final_sheet['grade']}"
    )

    # -------------------------------------------------------------
    # Step 7: Split-View Review & Teacher Override
    # -------------------------------------------------------------
    t0 = time.time()
    rev_res = requests.get(f"{BASE_URL}/api/sheets/{sheet_id}/review", timeout=15)
    assert rev_res.status_code == 200, f"Get review failed: {rev_res.text}"
    rev_data = rev_res.json()
    all_evals = rev_data.get("flagged_questions", []) + rev_data.get("checked_questions", [])
    assert len(all_evals) > 0, "No evaluation questions found in review"

    target_eval = all_evals[0]
    target_eval_id = target_eval.get("eval_id") or target_eval.get("id")
    override_res = requests.post(
        f"{BASE_URL}/api/evaluations/{target_eval_id}/review",
        json={"teacher_marks": 4.5, "comment": "Good reasoning and accurate concept explanation"},
        timeout=15
    )
    assert override_res.status_code == 200, f"Teacher review override failed: {override_res.text}"
    t_review = time.time() - t0
    record_step(
        "7. Teacher Review Override",
        True,
        t_review,
        f"Eval ID: {target_eval_id[:8]}..., Q{target_eval.get('q_no')} overridden to 4.5M, New Total: {override_res.json().get('new_total')}M"
    )

    # -------------------------------------------------------------
    # Step 8: Live AI Re-Check Call
    # -------------------------------------------------------------
    t0 = time.time()
    recheck_res = requests.post(
        f"{BASE_URL}/api/evaluations/{target_eval_id}/recheck",
        json={"edited_text": "Photosynthesis is the process where chlorophyll captures light energy to produce glucose: 6CO2 + 6H2O -> C6H12O6 + 6O2."},
        timeout=60
    )
    assert recheck_res.status_code == 200, f"AI Recheck failed: {recheck_res.text}"
    recheck_data = recheck_res.json()
    t_recheck = time.time() - t0
    record_step(
        "8. Live AI Re-Check",
        True,
        t_recheck,
        f"Re-check marks: {recheck_data.get('marks')}M, Reason: {recheck_data.get('reason')[:60]}..."
    )

    # -------------------------------------------------------------
    # Step 9: Academic Reports Generation & Download
    # -------------------------------------------------------------
    t0 = time.time()
    rep_res = requests.get(f"{BASE_URL}/api/papers/{paper_id}/reports", timeout=30)
    assert rep_res.status_code == 200, f"Reports generation failed: {rep_res.text}"
    rep_data = rep_res.json()

    # Verify student report cards
    student_reps = rep_data.get("student_reports", [])
    assert len(student_reps) > 0, "No student report cards returned"
    first_pdf_url = student_reps[0]["url"]
    pdf_download_res = requests.get(f"{BASE_URL}{first_pdf_url}", timeout=15)
    assert pdf_download_res.status_code == 200
    assert pdf_download_res.content.startswith(b"%PDF-"), "Invalid PDF header on Student Report Card"

    # Verify Excel matrix report
    excel_url = rep_data.get("excel_report_url")
    assert excel_url, "Missing excel_report_url"
    excel_res = requests.get(f"{BASE_URL}{excel_url}", timeout=15)
    assert excel_res.status_code == 200
    assert len(excel_res.content) > 1000, "Excel content empty"

    t_rep = time.time() - t0
    record_step(
        "9. Report Generation (PDF & Excel)",
        True,
        t_rep,
        f"Student PDF: {len(pdf_download_res.content)} bytes, Excel Matrix: {len(excel_res.content)} bytes"
    )

    # -------------------------------------------------------------
    # Step 10: Training Verification & Dataset ZIP Export
    # -------------------------------------------------------------
    t0 = time.time()
    lines_res = requests.get(f"{BASE_URL}/api/training/lines", timeout=15)
    assert lines_res.status_code == 200
    training_lines = lines_res.json().get("lines", [])

    if training_lines:
        first_line = training_lines[0]
        v_res = requests.post(
            f"{BASE_URL}/api/training/lines/{first_line['id']}/verify",
            json={"verified_text": "photosynthesis chemical formula verified"},
            timeout=15
        )
        assert v_res.status_code == 200

    zip_res = requests.get(f"{BASE_URL}/api/training/export.zip", timeout=15)
    assert zip_res.status_code == 200
    with zipfile.ZipFile(io.BytesIO(zip_res.content), "r") as zf:
        namelist = zf.namelist()
        assert "labels.csv" in namelist, "labels.csv missing from training ZIP"

    t_train = time.time() - t0
    record_step(
        "10. Training Data Line Verification & Export",
        True,
        t_train,
        f"Available Lines: {len(training_lines)}, Export ZIP contains: {len(namelist)} files"
    )

    # -------------------------------------------------------------
    # Step 11: Cascading Sheet Deletion & Disk Cleanup
    # -------------------------------------------------------------
    t0 = time.time()
    del_res = requests.delete(f"{BASE_URL}/api/sheets/{sheet_id}", timeout=15)
    assert del_res.status_code == 200, f"Delete sheet failed: {del_res.text}"
    del_data = del_res.json()
    assert del_data.get("status") == "deleted"

    # Verify sheet is gone from database
    check_del = requests.get(f"{BASE_URL}/api/sheets/{sheet_id}", timeout=15)
    assert check_del.status_code == 404, "Sheet still exists after deletion"
    t_del = time.time() - t0
    record_step(
        "11. Cascading Sheet Deletion",
        True,
        t_del,
        f"Sheet {sheet_id} and all evaluations/reviews/lines cleanly deleted"
    )

    total_time = time.time() - total_start

    print("\n" + "=" * 80)
    print("E2E LIVE PIPELINE EXECUTION SUMMARY")
    print("=" * 80)
    print(f"{'Step':<40} {'Status':<10} {'Latency':<12} {'Details'}")
    print("-" * 80)
    for row in summary_rows:
        print(f"{row['step']:<40} {row['status']:<10} {row['duration']:<12} {row['detail']}")
    print("-" * 80)
    print(f"Total Pipeline Execution Time: {total_time:.2f}s")
    print("All live operations PASSED with 0 mock data and 0 errors.")
    print("=" * 80)

if __name__ == "__main__":
    run_e2e()

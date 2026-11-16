import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from starlette.testclient import TestClient
from backend.main import app
import sqlite3

def verify_u0_2():
    client = TestClient(app)

    conn = sqlite3.connect("data/app.db")
    # Find paper and sheet
    paper_row = conn.execute("SELECT id FROM papers ORDER BY rowid DESC LIMIT 1").fetchone()
    assert paper_row, "No paper found in data/app.db"
    paper_id = paper_row[0]

    sheet_row = conn.execute("SELECT id FROM sheets WHERE paper_id = ? LIMIT 1", (paper_id,)).fetchone()
    if not sheet_row:
        sheet_row = conn.execute("SELECT id, paper_id FROM sheets ORDER BY rowid DESC LIMIT 1").fetchone()
        assert sheet_row, "No sheet found in data/app.db"
        sheet_id = sheet_row[0]
        paper_id = sheet_row[1]
    else:
        sheet_id = sheet_row[0]

    print(f"Testing with Paper ID: {paper_id}, Sheet ID: {sheet_id}")

    # 1. GET /api/papers/{id}/sheets
    res_sheets = client.get(f"/api/papers/{paper_id}/sheets")
    assert res_sheets.status_code == 200, f"Failed GET /api/papers/{paper_id}/sheets: {res_sheets.text}"
    sheets_data = res_sheets.json().get("sheets", [])
    assert len(sheets_data) > 0, "No sheets returned"
    s0 = sheets_data[0]
    required_s_keys = ["id", "filename", "student_name", "roll", "status", "stage", "page_count", "flags_open", "updated_at"]
    for k in required_s_keys:
        assert k in s0, f"Missing key '{k}' in /api/papers/{paper_id}/sheets"
    print("PASS: 1. GET /api/papers/{id}/sheets has all Section 9 contract keys")

    # 2. GET /api/sheets/{id}
    res_sheet = client.get(f"/api/sheets/{sheet_id}")
    assert res_sheet.status_code == 200, f"Failed GET /api/sheets/{sheet_id}: {res_sheet.text}"
    sheet_data = res_sheet.json()
    required_sheet_keys = ["pages_read", "pages_total", "questions_marked", "questions_total", "failed_stage", "error_message", "retry_at", "history"]
    for k in required_sheet_keys:
        assert k in sheet_data, f"Missing key '{k}' in /api/sheets/{sheet_id}"
    assert isinstance(sheet_data["history"], list), "history must be a list"
    print("PASS: 2. GET /api/sheets/{id} has all Section 9 counters, stages & history")

    # 3. GET /api/sheets/{id}/pages/{n}/image
    res_img = client.get(f"/api/sheets/{sheet_id}/pages/1/image")
    assert res_img.status_code == 200, f"Failed GET /api/sheets/{sheet_id}/pages/1/image: {res_img.status_code}"
    assert "image/jpeg" in res_img.headers.get("content-type", ""), "Wrong content-type"
    assert "max-age" in res_img.headers.get("cache-control", ""), "Missing cache-control header"
    print("PASS: 3. GET /api/sheets/{id}/pages/{n}/image serves JPEG with cache headers")

    # 4. GET /api/sheets/{id}/review
    res_rev = client.get(f"/api/sheets/{sheet_id}/review")
    assert res_rev.status_code == 200, f"Failed GET /api/sheets/{sheet_id}/review: {res_rev.text}"
    rev_data = res_rev.json()
    questions = rev_data.get("questions") or rev_data.get("evaluations", [])
    assert len(questions) > 0, "No questions in review"
    q0 = questions[0]
    required_q_keys = [
        "key", "q_no", "text", "options", "max_marks", "status", "ocr_text",
        "reader_texts", "legibility", "page_numbers", "bbox", "continues",
        "reference", "ai_marks", "final_marks", "key_point_verdicts", "flags", "error_message"
    ]
    for k in required_q_keys:
        assert k in q0, f"Missing question key '{k}' in review response"
    assert "source" in q0["reference"], "Missing reference.source"
    assert "model_answer" in q0["reference"], "Missing reference.model_answer"
    assert "key_points" in q0["reference"], "Missing reference.key_points"
    print("PASS: 4. GET /api/sheets/{id}/review returns all per-question contract fields")

    # 5. POST /api/evaluations/{id}/review with ocr_text
    eval_id = q0["eval_id"]
    rev_payload = {
        "teacher_marks": float(q0["final_marks"] or 1.0),
        "comment": "Verified Section 9 contract",
        "accept_ai": False,
        "is_counted": True,
        "ocr_text": q0["ocr_text"] + " (edited)" if q0["ocr_text"] else "Student answer text"
    }
    res_eval_rev = client.post(f"/api/evaluations/{eval_id}/review", json=rev_payload)
    assert res_eval_rev.status_code == 200, f"Failed POST /api/evaluations/{eval_id}/review: {res_eval_rev.text}"
    eval_rev_data = res_eval_rev.json()
    assert "sheet_total" in eval_rev_data, "Missing sheet_total in review response"
    print("PASS: 5. POST /api/evaluations/{id}/review accepts OCR edits and returns sheet totals")

    # 6. POST /api/sheets/{id}/approve-unflagged
    res_app = client.post(f"/api/sheets/{sheet_id}/approve-unflagged")
    assert res_app.status_code == 200, f"Failed POST /api/sheets/{sheet_id}/approve-unflagged: {res_app.text}"
    app_data = res_app.json()
    assert "approved_count" in app_data, "Missing approved_count"
    print("PASS: 6. POST /api/sheets/{id}/approve-unflagged approves unflagged questions")

    # 7. POST /api/sheets/{id}/finish
    res_fin = client.post(f"/api/sheets/{sheet_id}/finish?force=true")
    assert res_fin.status_code == 200, f"Failed POST /api/sheets/{sheet_id}/finish: {res_fin.text}"
    fin_data = res_fin.json()
    assert fin_data.get("status") == "evaluated", "Status must be evaluated"
    assert "report_url" in fin_data, "Missing report_url"
    print("PASS: 7. POST /api/sheets/{id}/finish validates and returns report links")

    # 8. GET /api/sheets/{id}/report
    res_rep = client.get(f"/api/sheets/{sheet_id}/report")
    assert res_rep.status_code == 200, f"Failed GET /api/sheets/{sheet_id}/report: {res_rep.text}"
    rep_data = res_rep.json()
    required_rep_keys = ["student_name", "roll_number", "total_score", "max_marks", "percentage", "grade", "strengths", "improvements", "questions"]
    for k in required_rep_keys:
        assert k in rep_data, f"Missing report key '{k}'"
    print("PASS: 8. GET /api/sheets/{id}/report returns student report data")

    # 9. GET /api/papers/{id}/reports
    res_prep = client.get(f"/api/papers/{paper_id}/reports")
    assert res_prep.status_code == 200, f"Failed GET /api/papers/{paper_id}/reports: {res_prep.text}"
    prep_data = res_prep.json()
    assert "excel_report_url" in prep_data, "Missing excel_report_url"
    assert "paper_summary_pdf_url" in prep_data, "Missing paper_summary_pdf_url"
    print("PASS: 9. GET /api/papers/{id}/reports returns paper report and export links")

    print("\nALL SECTION 9 BACKEND CONTRACT ENDPOINTS VERIFIED SUCCESSFULLY!")

if __name__ == "__main__":
    verify_u0_2()

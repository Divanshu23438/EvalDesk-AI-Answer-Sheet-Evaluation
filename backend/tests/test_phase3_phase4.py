import io
import json
import uuid
import pytest
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from backend.main import app
from backend.db import init_db, get_db
from backend.marking_engine import (
    evaluate_mcq_or_one_word,
    verify_evidence_quote,
    round_to_half_step,
    calculate_section_choice_totals,
)

@pytest.fixture(autouse=True)
def setup_database():
    init_db()

@pytest.fixture
def client():
    return TestClient(app)

def create_sample_locked_paper(client):
    payload = {
        "title": "Operating Systems Exam",
        "subject": "CS",
        "strictness": "strict",
        "checking_medium": "answer_key",
        "total_marks": 10.0,
        "instructions": "Answer all questions",
        "questions": [
            {
                "key": "q_mcq",
                "q_no": "1",
                "question_text": "Which scheduler selects from the ready queue? (A) Long-term (B) Short-term",
                "max_marks": 2.0,
                "question_type": "mcq",
                "section_name": "Section A",
                "options": ["A", "B"],
            },
            {
                "key": "q_short",
                "q_no": "2",
                "question_text": "Define process starvation and prevention.",
                "max_marks": 8.0,
                "question_type": "short",
                "section_name": "Section B",
                "options": [],
            },
        ],
    }
    p_res = client.post("/api/papers", json=payload)
    paper_id = p_res.json()["paper_id"]

    # Provide reference items
    ref_payload = {
        "references": [
            {
                "key": "q_mcq",
                "model_answer": "B",
                "correct_option": "B",
                "key_points": [{"text": "Short-term scheduler", "marks": 2.0}],
            },
            {
                "key": "q_short",
                "model_answer": "Starvation is indefinite waiting. Prevention is aging.",
                "correct_option": None,
                "key_points": [
                    {"text": "Starvation definition (indefinite postponement)", "marks": 4.0},
                    {"text": "Prevention technique (aging mechanism)", "marks": 4.0},
                ],
            },
        ]
    }
    client.put(f"/api/papers/{paper_id}/reference", json=ref_payload)
    lock_res = client.post(f"/api/papers/{paper_id}/lock")
    assert lock_res.status_code == 200
    return paper_id

def test_sheet_upload_requires_locked_paper(client):
    # Create unlocked paper
    payload = {
        "title": "Unlocked Paper",
        "total_marks": 5.0,
        "questions": [
            {
                "key": "q_1",
                "q_no": "1",
                "question_text": "Question 1",
                "max_marks": 5.0,
                "question_type": "short",
            }
        ],
    }
    p_res = client.post("/api/papers", json=payload)
    paper_id = p_res.json()["paper_id"]

    img = Image.new("RGB", (200, 200), color=(240, 240, 240))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    files = [("files", ("page1.jpg", buf, "image/jpeg"))]
    res = client.post(f"/api/papers/{paper_id}/sheets", files=files)
    assert res.status_code == 400
    assert "approved and locked" in res.json()["detail"].lower()

def test_sheet_upload_rejects_blank_image(client):
    paper_id = create_sample_locked_paper(client)
    img = Image.new("RGB", (300, 300), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    files = [("files", ("blank_page.jpg", buf, "image/jpeg"))]
    res = client.post(f"/api/papers/{paper_id}/sheets", files=files)
    assert res.status_code == 400
    assert "blank" in res.json()["detail"].lower() or "legible" in res.json()["detail"].lower()

def test_sheet_upload_and_manual_identity_flow(client):
    paper_id = create_sample_locked_paper(client)

    # Create image with drawn handwriting-like lines
    img = Image.new("RGB", (300, 400), color=(250, 250, 250))
    draw = ImageDraw.Draw(img)
    draw.rectangle([20, 20, 280, 50], fill=(230, 230, 230), outline=(50, 50, 50))
    draw.text((30, 30), "Section B - Process Starvation Answer", fill=(0, 0, 0))
    draw.line([30, 80, 250, 80], fill=(0, 0, 0), width=2)
    draw.line([30, 110, 270, 110], fill=(0, 0, 0), width=2)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    files = [("files", ("page1.jpg", buf, "image/jpeg"))]
    res = client.post(f"/api/papers/{paper_id}/sheets", files=files)
    assert res.status_code == 200
    data = res.json()
    sheet_id = data["sheet_id"]
    assert "sheet_id" in data
    assert data["status"] in ["needs_identity", "queued"]

    if data["status"] == "needs_identity":
        assert data["needs_manual_name"] is True
        # Set identity
        id_res = client.post(
            f"/api/sheets/{sheet_id}/identity",
            json={"student_name": "Alice Smith", "roll_number": "CS-2026-101"},
        )
        assert id_res.status_code == 200
        assert id_res.json()["status"] == "queued"

    # Status check
    st_res = client.get(f"/api/sheets/{sheet_id}")
    assert st_res.status_code == 200
    st_data = st_res.json()
    assert st_data["id"] == sheet_id
    assert st_data["pages_count"] == 1

def test_mcq_exact_matching():
    # Correct answer exact match
    res_correct = evaluate_mcq_or_one_word("B", "B", 2.0)
    assert res_correct["marks"] == 2.0
    assert res_correct["verdict"] == "full"
    assert len(res_correct["flags"]) == 0

    # Option prefix format like '(B)' or 'B.'
    res_prefix = evaluate_mcq_or_one_word("(b)", "B", 2.0)
    assert res_prefix["marks"] == 2.0
    assert res_prefix["verdict"] == "full"

    # Wrong answer
    res_wrong = evaluate_mcq_or_one_word("A", "B", 2.0)
    assert res_wrong["marks"] == 0.0
    assert res_wrong["verdict"] == "none"

    # Unattempted
    res_unattempted = evaluate_mcq_or_one_word("", "B", 2.0)
    assert res_unattempted["marks"] == 0.0
    assert "missing or unattempted" in res_unattempted["flags"][0].lower()

def test_quote_verification_logic():
    student_text = "Starvation happens when a process waits indefinitely. It can be prevented by aging."

    # Substring quote exists
    assert verify_evidence_quote("waits indefinitely", student_text) is True
    assert verify_evidence_quote("prevented by aging", student_text) is True

    # Quote does NOT exist (hallucinated or fabricated quote)
    assert verify_evidence_quote("round robin priority queues", student_text) is False
    assert verify_evidence_quote("operating system kernel allocates 512 bytes", student_text) is False

def test_section_choice_rules():
    # Paper where Section A has 3 questions but allows 'Attempt any 2'
    questions = [
        {"q_no": "1", "section_name": "Part A", "attempted": True, "final_marks": 4.0, "resolved": True},
        {"q_no": "2", "section_name": "Part A", "attempted": True, "final_marks": 2.0, "resolved": True},
        {"q_no": "3", "section_name": "Part A", "attempted": True, "final_marks": 5.0, "resolved": True},
    ]
    sections = [{"section_name": "Part A", "attempt_limit": 2}]
    res = calculate_section_choice_totals(questions, sections, 10.0)

    # Should take top 2 scoring questions (5.0 and 4.0 = 9.0)
    assert res["total_score"] == 9.0
    counted = [q for q in res["questions"] if q["is_counted"]]
    uncounted = [q for q in res["questions"] if not q["is_counted"]]
    assert len(counted) == 2
    assert len(uncounted) == 1
    assert uncounted[0]["q_no"] == "2"

def test_retry_endpoint(client):
    paper_id = create_sample_locked_paper(client)
    img = Image.new("RGB", (300, 300), color=(250, 250, 250))
    draw = ImageDraw.Draw(img)
    draw.rectangle([10, 10, 280, 50], fill=(220, 220, 220), outline=(0, 0, 0))
    draw.text((20, 20), "Answer to Question 1", fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    files = [("files", ("page1.jpg", buf, "image/jpeg"))]
    res = client.post(f"/api/papers/{paper_id}/sheets", files=files)
    sheet_id = res.json()["sheet_id"]

    # Call retry
    retry_res = client.post(f"/api/sheets/{sheet_id}/retry")
    assert retry_res.status_code == 200
    assert retry_res.json()["status"] == "queued"

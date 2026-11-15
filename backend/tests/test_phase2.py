import io
import json
import pytest
from PIL import Image
from fastapi.testclient import TestClient

from backend.main import app
from backend.db import init_db, get_db

@pytest.fixture(autouse=True)
def setup_database():
    init_db()

@pytest.fixture
def client():
    return TestClient(app)

def test_extract_rejects_blank_image(client):
    img = Image.new("RGB", (100, 100), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    files = {"paper_file": ("blank.jpg", buf, "image/jpeg")}
    response = client.post("/api/papers/extract", files=files)
    assert response.status_code == 400
    assert "blank" in response.json()["detail"].lower()

def test_extract_rejects_corrupt_pdf(client):
    corrupt_bytes = io.BytesIO(b"%PDF-corrupt junk not valid")
    files = {"paper_file": ("corrupt.pdf", corrupt_bytes, "application/pdf")}
    response = client.post("/api/papers/extract", files=files)
    assert response.status_code == 400
    assert "corrupt" in response.json()["detail"].lower() or "pdf" in response.json()["detail"].lower()

def test_create_paper_json_and_questions(client):
    payload = {
        "title": "Data Structures Test",
        "subject": "CS",
        "strictness": "strict",
        "checking_medium": "ai_reference",
        "total_marks": 10.0,
        "instructions": "Attempt all questions",
        "questions": [
            {
                "key": "q_1",
                "q_no": "1",
                "question_text": "What is a binary search tree?",
                "max_marks": 5.0,
                "question_type": "short",
                "section_name": "Part A",
                "options": [],
                "strictness_override": "lenient",
            },
            {
                "key": "q_2",
                "q_no": "2",
                "question_text": "Which operation is O(1) in a stack? A) push B) sort",
                "max_marks": 5.0,
                "question_type": "mcq",
                "section_name": "Part A",
                "options": ["push", "sort"],
            }
        ]
    }
    res = client.post("/api/papers", json=payload)
    assert res.status_code == 200
    data = res.json()
    paper_id = data["paper_id"]
    assert data["questions_count"] == 2
    assert data["total_marks"] == 10.0

    # Retrieve paper
    get_res = client.get(f"/api/papers/{paper_id}")
    assert get_res.status_code == 200
    detail = get_res.json()
    assert detail["paper"]["title"] == "Data Structures Test"
    assert detail["paper"]["strictness"] == "strict"
    assert len(detail["questions"]) == 2
    assert detail["questions"][0]["key"] == "q_1"
    assert detail["questions"][0]["strictness_override"] == "lenient"
    assert detail["questions"][1]["options"] == ["push", "sort"]

def test_update_questions_unlocked_and_locked(client):
    payload = {
        "title": "Operating Systems",
        "subject": "CS",
        "strictness": "lenient",
        "checking_medium": "ai_reference",
        "total_marks": 5.0,
        "questions": [
            {
                "key": "q_1",
                "q_no": "1",
                "question_text": "Define process scheduling.",
                "max_marks": 5.0,
                "question_type": "short",
                "section_name": "General",
                "options": [],
            }
        ]
    }
    res = client.post("/api/papers", json=payload)
    paper_id = res.json()["paper_id"]

    # Update while unlocked
    update_payload = {
        "questions": [
            {
                "key": "q_1",
                "q_no": "1",
                "question_text": "Define process scheduling in modern OS.",
                "max_marks": 6.0,
                "question_type": "short",
                "section_name": "General",
                "options": [],
            }
        ]
    }
    up_res = client.put(f"/api/papers/{paper_id}/questions", json=update_payload)
    assert up_res.status_code == 200
    assert up_res.json()["total_marks"] == 6.0

    # Cannot lock without references
    lock_res = client.post(f"/api/papers/{paper_id}/lock")
    assert lock_res.status_code == 400
    assert "reference" in lock_res.json()["detail"].lower()

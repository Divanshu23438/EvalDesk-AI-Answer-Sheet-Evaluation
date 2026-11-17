import json
import pytest
from fastapi.testclient import TestClient
import backend.main as main
import backend.db as db

@pytest.fixture
def client(tmp_path, monkeypatch):
    test_db = tmp_path / "test_p91.db"
    monkeypatch.setattr(db, "DB_PATH", test_db)
    db.init_db()
    return TestClient(main.app)

def test_patch_on_locked_paper(client):
    # 1. Create a paper
    res = client.post("/api/papers", json={
        "title": "Initial Title",
        "subject": "CS",
        "strictness_level": 3,
        "subject_domain": "cs_it"
    })
    assert res.status_code == 200
    paper_id = res.json()["paper_id"]

    # 2. Add question and reference, then lock the paper
    client.put(f"/api/papers/{paper_id}/questions", json={
        "questions": [{
            "q_no": "1",
            "question_text": "What is Linux?",
            "max_marks": 5.0,
            "question_type": "short",
            "section_name": "General"
        }]
    })
    client.put(f"/api/papers/{paper_id}/reference", json={
        "references": [{
            "key": "G-Q1",
            "model_answer": "Linux is an open-source operating system kernel.",
            "key_points": [{"text": "OS kernel", "marks": 5.0}]
        }]
    })
    lock_res = client.post(f"/api/papers/{paper_id}/lock")
    assert lock_res.status_code == 200
    assert lock_res.json()["is_locked"] is True

    # 3. PATCH paper while locked: updates subject_code, exam_name, and strictness_level
    patch_res = client.patch(f"/api/papers/{paper_id}", json={
        "subject_code": "CS-402",
        "exam_name": "Midterm Exam 2026",
        "strictness_level": 4,
        "subject_domain": "cs_it"
    })
    assert patch_res.status_code == 200
    data = patch_res.json()
    assert data["subject_code"] == "CS-402"
    assert data["exam_name"] == "Midterm Exam 2026"
    assert data["strictness_level"] == 4
    assert data["subject_domain"] == "cs_it"

    # Verify GET returns updated metadata on locked paper
    get_res = client.get(f"/api/papers/{paper_id}")
    assert get_res.status_code == 200
    p = get_res.json()["paper"]
    assert p["is_locked"] == 1
    assert p["subject_code"] == "CS-402"
    assert p["exam_name"] == "Midterm Exam 2026"
    assert p["strictness_level"] == 4

def test_patch_validation(client):
    res = client.post("/api/papers", json={"title": "Test Paper"})
    paper_id = res.json()["paper_id"]

    # Empty title -> 422
    assert client.patch(f"/api/papers/{paper_id}", json={"title": "   "}).status_code == 422

    # Invalid strictness_level -> 422
    assert client.patch(f"/api/papers/{paper_id}", json={"strictness_level": 0}).status_code == 422
    assert client.patch(f"/api/papers/{paper_id}", json={"strictness_level": 6}).status_code == 422

    # Invalid domain -> 422
    assert client.patch(f"/api/papers/{paper_id}", json={"subject_domain": "invalid_domain"}).status_code == 422

def test_put_questions_with_integer_strictness_override(client):
    res = client.post("/api/papers", json={"title": "Test Paper"})
    paper_id = res.json()["paper_id"]

    # PUT questions with integer strictness_override (A2 fix)
    put_res = client.put(f"/api/papers/{paper_id}/questions", json={
        "questions": [{
            "q_no": "1",
            "question_text": "What is Python?",
            "max_marks": 5.0,
            "strictness_override": 5
        }, {
            "q_no": "2",
            "question_text": "What is SQL?",
            "max_marks": 5.0,
            "strictness_override": 2
        }]
    })
    assert put_res.status_code == 200

    # Verify persisted in DB and returned in GET
    get_res = client.get(f"/api/papers/{paper_id}")
    assert get_res.status_code == 200
    qs = get_res.json()["questions"]
    assert qs[0]["strictness_level_override"] == 5
    assert qs[0]["strictness_override"] == 5
    assert qs[1]["strictness_level_override"] == 2
    assert qs[1]["strictness_override"] == 2

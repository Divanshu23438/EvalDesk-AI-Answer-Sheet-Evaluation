import io
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.db import get_db

@pytest.fixture
def client():
    return TestClient(app)

def test_upload_unique_section_ids_across_papers(client, monkeypatch):
    # 1. Create two papers
    res1 = client.post("/api/papers", json={"title": "Paper 1", "subject": "Math", "total_marks": 20.0, "questions": []})
    assert res1.status_code == 200, res1.text
    p1_id = res1.json()["paper_id"]

    res2 = client.post("/api/papers", json={"title": "Paper 2", "subject": "Math", "total_marks": 20.0, "questions": []})
    assert res2.status_code == 200, res2.text
    p2_id = res2.json()["paper_id"]

    # 2. Mock extraction function to simulate cached result with pre-existing section ID
    fixed_sec_id = "cached-section-id-12345"
    sample_file_bytes = b"dummy file content of at least ten bytes"

    async def mock_extract(content, filename):
        return {
            "paper_title": "Common Exam",
            "total_marks": 10.0,
            "sections": [
                {
                    "id": fixed_sec_id,
                    "name": "Section A",
                    "instructions": "",
                    "attempt_n": 1,
                    "total_questions": 1,
                    "marks_each": 10.0,
                    "section_marks": 10.0,
                    "policy": "best_n",
                }
            ],
            "questions": [
                {"q_no": "1", "text": "Question 1", "marks": 10.0, "type": "short", "section": "Section A"}
            ],
            "processed_content": content,
        }

    monkeypatch.setattr("backend.main._extract_questions_from_file_bytes", mock_extract)

    # 3. Upload to paper 1
    r1 = client.post(f"/api/papers/{p1_id}/upload", files={"paper_file": ("exam.pdf", io.BytesIO(sample_file_bytes), "application/pdf")})
    assert r1.status_code == 200, f"Upload 1 failed: {r1.text}"
    sec1_id = r1.json()["sections"][0]["id"]
    q1_sec_id = r1.json()["questions"][0]["section_id"]
    assert sec1_id == q1_sec_id, "Question section_id must match section id"

    # 4. Upload to paper 2 (previously triggered UNIQUE constraint failed: sections.id)
    r2 = client.post(f"/api/papers/{p2_id}/upload", files={"paper_file": ("exam.pdf", io.BytesIO(sample_file_bytes), "application/pdf")})
    assert r2.status_code == 200, f"Upload 2 failed: {r2.text}"
    sec2_id = r2.json()["sections"][0]["id"]
    q2_sec_id = r2.json()["questions"][0]["section_id"]
    assert sec2_id == q2_sec_id, "Question section_id must match section id"

    # 5. Verify section IDs are unique and neither reused the cached ID
    assert sec1_id != sec2_id, "Section IDs must be distinct across papers"
    assert sec1_id != fixed_sec_id, "Must never reuse cached section ID"
    assert sec2_id != fixed_sec_id, "Must never reuse cached section ID"

    # 6. Verify database contains both sections without collisions
    with get_db() as conn:
        rows = conn.execute("SELECT id, paper_id FROM sections WHERE paper_id IN (?, ?)", (p1_id, p2_id)).fetchall()
        assert len(rows) == 2
        sec_ids_in_db = {r["id"] for r in rows}
        assert sec1_id in sec_ids_in_db
        assert sec2_id in sec_ids_in_db

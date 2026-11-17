import json
import uuid
import pytest
from unittest.mock import patch, AsyncMock
from starlette.testclient import TestClient
from backend.main import app, get_db
from backend.ai_gateway import ai_gateway, AIError


@pytest.fixture
def client():
    return TestClient(app)


def test_p9_4_sheet_status_and_pages_payload(client):
    """
    Verify GET /api/sheets/{id} returns real pages[] and pages_read
    matching count of ocr_status='done' (no fake //2).
    """
    paper_id = str(uuid.uuid4())
    sheet_id = str(uuid.uuid4())
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO papers (id, title, total_marks, is_locked, strictness_level, subject_domain)
            VALUES (?, ?, ?, 1, 3, 'general')
            """,
            (paper_id, "Test Paper P9.4", 50.0),
        )
        cursor.execute(
            """
            INSERT INTO sheets (id, paper_id, student_name, roll_number, status, stage_key, current_stage)
            VALUES (?, ?, 'Alice', 'R101', 'evaluating', 'reading', 'Reading pages')
            """,
            (sheet_id, paper_id),
        )
        # 3 pages: 1 done, 1 reading, 1 pending
        cursor.execute(
            """
            INSERT INTO sheet_pages (id, sheet_id, page_number, file_path, ocr_status, ocr_legibility, ocr_error)
            VALUES (?, ?, 1, 'data/sheets/p1.jpg', 'done', 0.94, NULL)
            """,
            (str(uuid.uuid4()), sheet_id),
        )
        cursor.execute(
            """
            INSERT INTO sheet_pages (id, sheet_id, page_number, file_path, ocr_status, ocr_legibility, ocr_error)
            VALUES (?, ?, 2, 'data/sheets/p2.jpg', 'reading', NULL, NULL)
            """,
            (str(uuid.uuid4()), sheet_id),
        )
        cursor.execute(
            """
            INSERT INTO sheet_pages (id, sheet_id, page_number, file_path, ocr_status, ocr_legibility, ocr_error)
            VALUES (?, ?, 3, 'data/sheets/p3.jpg', 'pending', NULL, NULL)
            """,
            (str(uuid.uuid4()), sheet_id),
        )

    res = client.get(f"/api/sheets/{sheet_id}")
    assert res.status_code == 200
    data = res.json()

    assert data["pages_total"] == 3
    # Real pages_read is 1 (only page 1 is 'done'), never 3//2 or fake
    assert data["pages_read"] == 1
    assert data["stage_key"] == "reading"
    assert data["status"] == "evaluating"
    assert len(data["pages"]) == 3

    assert data["pages"][0]["n"] == 1
    assert data["pages"][0]["status"] == "done"
    assert data["pages"][0]["legibility"] == 0.94
    assert data["pages"][0]["error"] is None
    assert f"/api/sheets/{sheet_id}/pages/1/image" in data["pages"][0]["image_url"]

    assert data["pages"][1]["n"] == 2
    assert data["pages"][1]["status"] == "reading"

    assert data["pages"][2]["n"] == 3
    assert data["pages"][2]["status"] == "pending"


def test_p9_4_list_paper_sheets_contract(client):
    """
    Verify GET /api/papers/{id}/sheets returns real pages[] and pages_read for each sheet.
    """
    paper_id = str(uuid.uuid4())
    sheet_id = str(uuid.uuid4())
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO papers (id, title, total_marks, is_locked) VALUES (?, ?, ?, 1)",
            (paper_id, "Paper P9.4 List", 20.0),
        )
        cursor.execute(
            """
            INSERT INTO sheets (id, paper_id, student_name, roll_number, status, stage_key, current_stage, raw_filename)
            VALUES (?, ?, 'Bob', 'R102', 'evaluating', 'reading', 'Reading pages', 'bob_sheet.pdf')
            """,
            (sheet_id, paper_id),
        )
        # 2 pages: both done
        for p_num in (1, 2):
            cursor.execute(
                """
                INSERT INTO sheet_pages (id, sheet_id, page_number, file_path, ocr_status, ocr_legibility)
                VALUES (?, ?, ?, 'data/p.jpg', 'done', 0.88)
                """,
                (str(uuid.uuid4()), sheet_id, p_num),
            )

    res = client.get(f"/api/papers/{paper_id}/sheets")
    assert res.status_code == 200
    data = res.json()
    sheets = data.get("sheets", [])
    matching = next((s for s in sheets if s["id"] == sheet_id), None)
    assert matching is not None
    assert matching["pages_total"] == 2
    assert matching["pages_read"] == 2
    assert matching["stage_key"] == "reading"
    assert len(matching["pages"]) == 2
    assert matching["pages"][0]["status"] == "done"
    assert matching["pages"][1]["status"] == "done"


def test_p9_4_retry_resets_page_statuses(client):
    """
    Verify POST /api/sheets/{id}/retry resets sheet_pages to ocr_status='pending',
    ocr_error=NULL, and ocr_legibility=NULL.
    """
    paper_id = str(uuid.uuid4())
    sheet_id = str(uuid.uuid4())
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO papers (id, title, total_marks, is_locked) VALUES (?, ?, ?, 1)",
            (paper_id, "Paper Retry", 20.0),
        )
        cursor.execute(
            """
            INSERT INTO sheets (id, paper_id, student_name, roll_number, status, stage_key, current_stage, error_message)
            VALUES (?, ?, 'Charlie', 'R103', 'failed', 'failed', 'Reading pages', 'Network error')
            """,
            (sheet_id, paper_id),
        )
        cursor.execute(
            """
            INSERT INTO sheet_pages (id, sheet_id, page_number, file_path, ocr_status, ocr_legibility, ocr_error)
            VALUES (?, ?, 1, 'data/p1.jpg', 'failed', NULL, 'OCR connection timeout')
            """,
            (str(uuid.uuid4()), sheet_id),
        )

    with patch("fastapi.BackgroundTasks.add_task"):
        res = client.post(f"/api/sheets/{sheet_id}/retry")
        assert res.status_code == 200
        assert res.json()["status"] == "queued"

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT ocr_status, ocr_error, ocr_legibility FROM sheet_pages WHERE sheet_id = ?", (sheet_id,))
        sp = cursor.fetchone()
        assert sp["ocr_status"] == "pending"
        assert sp["ocr_error"] is None
        assert sp["ocr_legibility"] is None

        cursor.execute("SELECT status, stage_key FROM sheets WHERE id = ?", (sheet_id,))
        sh = cursor.fetchone()
        assert sh["status"] == "queued"
        assert sh["stage_key"] == "queued"


@pytest.mark.anyio
async def test_p9_4_pipeline_page_progression_and_error(tmp_path):
    """
    Simulate page reading in run_sheet_evaluation_pipeline:
    - Page 1 succeeds: marked 'done' with real legibility.
    - Page 2 fails: marked 'failed' with error recorded.
    """
    from backend.main import run_sheet_evaluation_pipeline

    paper_id = str(uuid.uuid4())
    sheet_id = str(uuid.uuid4())

    # Create dummy images on disk for 2 pages
    p1_file = tmp_path / "page_1.jpg"
    p2_file = tmp_path / "page_2.jpg"
    p1_file.write_bytes(b"dummy_image_page_1")
    p2_file.write_bytes(b"dummy_image_page_2")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO papers (id, title, total_marks, is_locked) VALUES (?, ?, ?, 1)",
            (paper_id, "Paper Pipeline", 10.0),
        )
        cursor.execute(
            "INSERT INTO questions (id, paper_id, q_no, question_text, max_marks) VALUES (?, ?, '1', 'Define thread', 10.0)",
            (str(uuid.uuid4()), paper_id),
        )
        cursor.execute(
            """
            INSERT INTO sheets (id, paper_id, student_name, roll_number, status, stage_key, current_stage)
            VALUES (?, ?, 'Diana', 'R104', 'queued', 'queued', 'Queued for evaluation')
            """,
            (sheet_id, paper_id),
        )
        cursor.execute(
            """
            INSERT INTO sheet_pages (id, sheet_id, page_number, file_path, ocr_status)
            VALUES (?, ?, 1, ?, 'pending')
            """,
            (str(uuid.uuid4()), sheet_id, str(p1_file)),
        )
        cursor.execute(
            """
            INSERT INTO sheet_pages (id, sheet_id, page_number, file_path, ocr_status)
            VALUES (?, ?, 2, ?, 'pending')
            """,
            (str(uuid.uuid4()), sheet_id, str(p2_file)),
        )

    # Mock ai_gateway.call_gemini: Page 1 succeeds, Page 2 fails
    async def mock_call_gemini(prompt, image_bytes=None, task=None, **kwargs):
        if image_bytes == b"dummy_image_page_1":
            return {
                "data": {
                    "answers": [
                        {"key": "1", "text": "A thread is a lightweight process.", "legibility": 0.91, "box": [0.1, 0.1, 0.3, 0.9]}
                    ]
                }
            }
        else:
            raise AIError(kind="service_unavailable", message="Vision API network failure", status_code=503)

    with patch.object(ai_gateway, "call_gemini", side_effect=mock_call_gemini):
        with patch.object(ai_gateway, "call_groq", side_effect=AIError(kind="service_unavailable", message="Groq vision unavailable", status_code=503)):
            # Pipeline will catch the exception and mark sheet failed
            await run_sheet_evaluation_pipeline(sheet_id)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT page_number, ocr_status, ocr_legibility, ocr_error FROM sheet_pages WHERE sheet_id = ? ORDER BY page_number", (sheet_id,))
        pages = cursor.fetchall()

        # Page 1 should be done
        assert pages[0]["ocr_status"] == "done"
        assert pages[0]["ocr_legibility"] == 0.91
        assert pages[0]["ocr_error"] is None

        # Page 2 should be failed with readable error
        assert pages[1]["ocr_status"] == "failed"
        assert pages[1]["ocr_error"] is not None
        assert "Vision API network failure" in pages[1]["ocr_error"] or "unavailable" in pages[1]["ocr_error"]

        # Sheet should be marked failed
        cursor.execute("SELECT status, stage_key, failed_stage FROM sheets WHERE id = ?", (sheet_id,))
        sh = cursor.fetchone()
        assert sh["status"] == "failed"
        assert sh["stage_key"] == "failed"
        assert sh["failed_stage"] == "reading"

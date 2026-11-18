import io
import uuid
import pytest
from pathlib import Path
from PIL import Image
from fastapi.testclient import TestClient
from backend.main import app
from backend.db import get_db, fetchone

client = TestClient(app)

def test_p1_page_progress_fields_and_finished_at(tmp_path):
    paper_id = f"p1_paper_{uuid.uuid4().hex[:8]}"
    sheet_id = f"p1_sheet_{uuid.uuid4().hex[:8]}"

    with get_db() as conn:
        conn.execute("INSERT INTO papers (id, title, total_marks) VALUES (?, 'Test Paper P1', 50)", (paper_id,))
        conn.execute("INSERT INTO sheets (id, paper_id, status, stage_key, current_stage) VALUES (?, ?, 'evaluating', 'reading', 'Reading pages')", (sheet_id, paper_id))
        
        # 3 pages
        conn.execute(
            "INSERT INTO sheet_pages (id, sheet_id, page_number, file_path, ocr_status, ocr_legibility, finished_at) VALUES (?, ?, 1, 'dummy/p1.jpg', 'done', 0.94, '2026-11-18T10:00:00Z')",
            (str(uuid.uuid4()), sheet_id)
        )
        conn.execute(
            "INSERT INTO sheet_pages (id, sheet_id, page_number, file_path, ocr_status, ocr_legibility, finished_at) VALUES (?, ?, 2, 'dummy/p2.jpg', 'reading', NULL, NULL)",
            (str(uuid.uuid4()), sheet_id)
        )
        conn.execute(
            "INSERT INTO sheet_pages (id, sheet_id, page_number, file_path, ocr_status, ocr_legibility, finished_at) VALUES (?, ?, 3, 'dummy/p3.jpg', 'pending', NULL, NULL)",
            (str(uuid.uuid4()), sheet_id)
        )

    try:
        res = client.get(f"/api/sheets/{sheet_id}")
        assert res.status_code == 200
        data = res.json()
        assert data["pages_total"] == 3
        assert data["pages_count"] == 3
        assert data["pages_done"] == 1
        assert data["pages_read"] == 1

        pages = data["pages"]
        assert len(pages) == 3
        assert pages[0]["n"] == 1
        assert pages[0]["status"] == "done"
        assert pages[0]["legibility"] == 0.94
        assert pages[0]["finished_at"] == "2026-11-18T10:00:00Z"
        assert f"/api/sheets/{sheet_id}/pages/1/image" in pages[0]["image_url"]

        assert pages[1]["n"] == 2
        assert pages[1]["status"] == "reading"
        assert pages[1]["finished_at"] is None

        assert pages[2]["n"] == 3
        assert pages[2]["status"] == "pending"
        assert pages[2]["finished_at"] is None
    finally:
        with get_db() as conn:
            conn.execute("DELETE FROM sheet_pages WHERE sheet_id = ?", (sheet_id,))
            conn.execute("DELETE FROM sheets WHERE id = ?", (sheet_id,))
            conn.execute("DELETE FROM papers WHERE id = ?", (paper_id,))


def test_p1_page_image_endpoint_and_resize(tmp_path):
    paper_id = f"p1_paper_{uuid.uuid4().hex[:8]}"
    sheet_id = f"p1_sheet_{uuid.uuid4().hex[:8]}"

    # Create dummy 1600x1200 image on disk
    img_dir = tmp_path / "sheet_images"
    img_dir.mkdir(parents=True, exist_ok=True)
    img_file = img_dir / "p1_orig.jpg"
    im = Image.new("RGB", (1600, 1200), color=(200, 220, 240))
    im.save(img_file, format="JPEG")

    with get_db() as conn:
        conn.execute("INSERT INTO papers (id, title, total_marks) VALUES (?, 'Test Paper P1 Img', 50)", (paper_id,))
        conn.execute("INSERT INTO sheets (id, paper_id, status) VALUES (?, ?, 'evaluating')", (sheet_id, paper_id))
        conn.execute(
            "INSERT INTO sheet_pages (id, sheet_id, page_number, file_path, ocr_status) VALUES (?, ?, 1, ?, 'done')",
            (str(uuid.uuid4()), sheet_id, str(img_file))
        )

    try:
        # 1. Fetch with w=1200
        res = client.get(f"/api/sheets/{sheet_id}/pages/1/image?w=1200")
        assert res.status_code == 200
        assert res.headers["content-type"] == "image/jpeg"
        res_im = Image.open(io.BytesIO(res.content))
        assert res_im.width == 1200
        assert res_im.height == 900  # 1600x1200 scaled to width 1200

        # 2. Fetch without w (original size)
        res_orig = client.get(f"/api/sheets/{sheet_id}/pages/1/image")
        assert res_orig.status_code == 200
        assert res_orig.headers["content-type"] == "image/jpeg"
        res_orig_im = Image.open(io.BytesIO(res_orig.content))
        assert res_orig_im.width == 1600
        assert res_orig_im.height == 1200
    finally:
        with get_db() as conn:
            conn.execute("DELETE FROM sheet_pages WHERE sheet_id = ?", (sheet_id,))
            conn.execute("DELETE FROM sheets WHERE id = ?", (sheet_id,))
            conn.execute("DELETE FROM papers WHERE id = ?", (paper_id,))


def test_p1_per_page_retry_endpoint(tmp_path, monkeypatch):
    paper_id = f"p1_paper_{uuid.uuid4().hex[:8]}"
    sheet_id = f"p1_sheet_{uuid.uuid4().hex[:8]}"
    q_id = f"p1_q_{uuid.uuid4().hex[:8]}"

    # Create dummy image on disk
    img_file = tmp_path / "page_retry.jpg"
    im = Image.new("RGB", (400, 400), color=(240, 240, 240))
    im.save(img_file, format="JPEG")

    # Mock ai_gateway.call_gemini so OCR succeeds
    async def mock_call_gemini(*args, **kwargs):
        return {
            "status": "success",
            "data": {
                "answers": [
                    {
                        "key": "Q1",
                        "text": "Answer text after retry",
                        "legibility": 0.95,
                        "box": [0.1, 0.1, 0.4, 0.9],
                        "continues": False,
                    }
                ]
            }
        }
    from backend.ai_gateway import ai_gateway
    monkeypatch.setattr(ai_gateway, "call_gemini", mock_call_gemini)

    with get_db() as conn:
        conn.execute("INSERT INTO papers (id, title, total_marks) VALUES (?, 'Test Paper Retry', 50)", (paper_id,))
        conn.execute("INSERT INTO questions (id, paper_id, q_no, question_text, max_marks) VALUES (?, ?, '1', 'Sample Q?', 10)", (q_id, paper_id))
        conn.execute("INSERT INTO sheets (id, paper_id, status) VALUES (?, ?, 'failed')", (sheet_id, paper_id))
        conn.execute(
            "INSERT INTO sheet_pages (id, sheet_id, page_number, file_path, ocr_status, ocr_error, finished_at) VALUES (?, ?, 2, ?, 'failed', 'Timeout error', '2026-11-18T09:00:00Z')",
            (str(uuid.uuid4()), sheet_id, str(img_file))
        )

    try:
        res = client.post(f"/api/sheets/{sheet_id}/pages/2/retry")
        assert res.status_code == 200
        data = res.json()
        assert data["code"] == "OK"
        assert data["sheet_id"] == sheet_id
        assert data["page_number"] == 2
        assert data["status"] == "reading"
        assert data["retryable"] is True

        with get_db() as conn:
            page_row = fetchone(conn, "SELECT ocr_status, ocr_error, finished_at, ocr_legibility FROM sheet_pages WHERE sheet_id = ? AND page_number = 2", (sheet_id,))
            assert page_row["ocr_status"] == "done"
            assert page_row["ocr_error"] is None
            assert page_row["finished_at"] is not None
            assert page_row["ocr_legibility"] == 0.95
    finally:
        with get_db() as conn:
            conn.execute("DELETE FROM sheet_pages WHERE sheet_id = ?", (sheet_id,))
            conn.execute("DELETE FROM sheets WHERE id = ?", (sheet_id,))
            conn.execute("DELETE FROM questions WHERE paper_id = ?", (paper_id,))
            conn.execute("DELETE FROM papers WHERE id = ?", (paper_id,))


def test_p1_typed_errors_contract():
    # 404 Not Found
    res = client.get("/api/sheets/nonexistent-uuid-1234")
    assert res.status_code == 404
    data = res.json()
    assert "code" in data
    assert "message" in data
    assert "stage" in data
    assert "retryable" in data
    assert data["code"] == "HTTP_404"
    assert data["retryable"] is False

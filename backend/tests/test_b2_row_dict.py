import pytest
import sqlite3
import uuid
from backend.db import get_db, get_db_connection, fetchone, fetchall, DictRow
from fastapi.testclient import TestClient
from backend.main import app

def test_b2_get_db_connection_row_factory():
    """Verify that get_db_connection sets DictRow and supports row['x'] and row.get('x')."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT 'alpha' as name, 123 as val")
        row = cur.fetchone()
        assert isinstance(row, DictRow)
        # 1. bracket access
        assert row["name"] == "alpha"
        assert row["val"] == 123
        assert row[0] == "alpha"
        assert row[1] == 123
        # 2. .get() access
        assert row.get("name") == "alpha"
        assert row.get("val") == 123
        assert row.get("missing") is None
        assert row.get("missing", "default_val") == "default_val"
        # 3. dict conversion
        d = dict(row)
        assert isinstance(d, dict)
        assert d == {"name": "alpha", "val": 123}
    finally:
        conn.close()

def test_b2_get_db_context_manager():
    """Verify get_db context manager returns rows with both bracket and .get() methods."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT 'test_str' as str_col, 3.14 as float_col")
        row = cur.fetchone()
        assert row["str_col"] == "test_str"
        assert row.get("str_col") == "test_str"
        assert row.get("float_col") == 3.14
        assert row.get("nonexistent") is None

        rows = cur.execute("SELECT 1 as x UNION ALL SELECT 2 as x").fetchall()
        for idx, r in enumerate(rows, 1):
            assert r["x"] == idx
            assert r.get("x") == idx
            assert r.get("other", 99) == 99

def test_b2_fetchone_and_fetchall_helpers():
    """Verify fetchone and fetchall helpers return plain dicts."""
    with get_db() as conn:
        row = fetchone(conn, "SELECT 'foo' as bar, 999 as count")
        assert type(row) is dict
        assert row["bar"] == "foo"
        assert row.get("bar") == "foo"
        assert row.get("unknown") is None

        rows = fetchall(conn, "SELECT 10 as num UNION ALL SELECT 20 as num")
        assert isinstance(rows, list)
        for r in rows:
            assert type(r) is dict
            assert "num" in r
            assert r.get("num") in (10, 20)

def test_b2_table_query_paths_support_get():
    """Verify that querying each major database table yields rows that support .get()."""
    paper_id = f"test_paper_{uuid.uuid4().hex[:8]}"
    sheet_id = f"test_sheet_{uuid.uuid4().hex[:8]}"
    q_id = f"test_q_{uuid.uuid4().hex[:8]}"

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO papers (id, title, total_marks) VALUES (?, 'Test Paper', 50)",
            (paper_id,)
        )
        cur.execute(
            "INSERT INTO sheets (id, paper_id, status) VALUES (?, ?, 'queued')",
            (sheet_id, paper_id)
        )
        cur.execute(
            "INSERT INTO sheet_pages (id, sheet_id, page_number, file_path) VALUES (?, ?, 1, 'pages/p1.jpg')",
            (str(uuid.uuid4()), sheet_id)
        )
        cur.execute(
            "INSERT INTO questions (id, paper_id, q_no, question_text, max_marks) VALUES (?, ?, '1', 'Sample question?', 5)",
            (q_id, paper_id)
        )

        # Test querying papers
        cur.execute("SELECT * FROM papers WHERE id = ?", (paper_id,))
        p_row = cur.fetchone()
        assert p_row["title"] == "Test Paper"
        assert p_row.get("title") == "Test Paper"
        assert p_row.get("missing_field") is None

        # Test querying sheets
        cur.execute("SELECT * FROM sheets WHERE id = ?", (sheet_id,))
        s_row = cur.fetchone()
        assert s_row["status"] == "queued"
        assert s_row.get("status") == "queued"
        assert s_row.get("stage_key") is None

        # Test querying sheet_pages
        cur.execute("SELECT * FROM sheet_pages WHERE sheet_id = ?", (sheet_id,))
        sp_rows = cur.fetchall()
        assert len(sp_rows) == 1
        assert sp_rows[0]["page_number"] == 1
        assert sp_rows[0].get("page_number") == 1
        assert sp_rows[0].get("ocr_error") is None

        # Test querying questions
        cur.execute("SELECT * FROM questions WHERE id = ?", (q_id,))
        q_row = cur.fetchone()
        assert q_row["q_no"] == "1"
        assert q_row.get("q_no") == "1"
        assert q_row.get("nonexistent") is None

        # Clean up
        cur.execute("DELETE FROM sheet_pages WHERE sheet_id = ?", (sheet_id,))
        cur.execute("DELETE FROM sheets WHERE id = ?", (sheet_id,))
        cur.execute("DELETE FROM questions WHERE paper_id = ?", (paper_id,))
        cur.execute("DELETE FROM papers WHERE id = ?", (paper_id,))

def test_b2_fastapi_endpoints_no_row_attribute_error():
    """Verify that FastAPI endpoints return valid payloads without 'sqlite3.Row' errors."""
    client = TestClient(app)
    paper_id = f"test_paper_{uuid.uuid4().hex[:8]}"

    with get_db() as conn:
        conn.execute("INSERT INTO papers (id, title, total_marks, is_locked) VALUES (?, 'Test locked paper', 100, 1)", (paper_id,))

    try:
        # GET paper
        res = client.get(f"/api/papers/{paper_id}")
        assert res.status_code == 200
        p_data = res.json()
        assert p_data["paper"]["id"] == paper_id

        # GET paper sheets
        res_sheets = client.get(f"/api/papers/{paper_id}/sheets")
        assert res_sheets.status_code == 200
        assert isinstance(res_sheets.json()["sheets"], list)
    finally:
        with get_db() as conn:
            conn.execute("DELETE FROM papers WHERE id = ?", (paper_id,))

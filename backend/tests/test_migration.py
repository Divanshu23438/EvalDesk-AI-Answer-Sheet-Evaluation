import pytest
import sqlite3
import backend.db as db

def test_migration_idempotent_and_backfill(tmp_path, monkeypatch):
    test_db = tmp_path / "test_migration.db"
    monkeypatch.setattr(db, "DB_PATH", test_db)

    # 1. Run init_db once
    db.init_db()

    # Insert a dummy paper with legacy text strictness
    with db.get_db() as conn:
        conn.execute("""
            INSERT INTO papers (id, title, subject, total_marks, strictness, checking_medium, has_answer_key, is_locked)
            VALUES ('p_lenient', 'Lenient Paper', 'Test Subj', 10.0, 'lenient', 'ai_reference', 0, 0)
        """)
        conn.execute("""
            INSERT INTO papers (id, title, subject, total_marks, strictness, checking_medium, has_answer_key, is_locked)
            VALUES ('p_strict', 'Strict Paper', 'Test Subj', 10.0, 'strict', 'ai_reference', 0, 0)
        """)
        conn.execute("""
            INSERT INTO questions (id, paper_id, q_no, question_text, max_marks, strictness_override)
            VALUES ('q1', 'p_lenient', '1', 'Sample Q', 5.0, 'strict')
        """)
        conn.execute("""
            INSERT INTO questions (id, paper_id, q_no, question_text, max_marks, strictness_override)
            VALUES ('q2', 'p_lenient', '2', 'Sample Q2', 5.0, 'lenient')
        """)

    # 2. Run init_db a second time (should be idempotent and backfill values)
    db.init_db()

    with db.get_db() as conn:
        p_lenient = conn.execute("SELECT strictness_level FROM papers WHERE id = 'p_lenient'").fetchone()
        assert p_lenient["strictness_level"] == 1

        p_strict = conn.execute("SELECT strictness_level FROM papers WHERE id = 'p_strict'").fetchone()
        assert p_strict["strictness_level"] == 5

        q1 = conn.execute("SELECT strictness_level_override FROM questions WHERE id = 'q1'").fetchone()
        assert q1["strictness_level_override"] == 5

        q2 = conn.execute("SELECT strictness_level_override FROM questions WHERE id = 'q2'").fetchone()
        assert q2["strictness_level_override"] == 1

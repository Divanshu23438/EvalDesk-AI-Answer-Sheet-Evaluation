import sqlite3
from typing import Generator
from contextlib import contextmanager
from backend.config import DB_PATH

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()

        # 1. papers
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS papers (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                subject TEXT DEFAULT '',
                total_marks REAL NOT NULL DEFAULT 0.0,
                strictness TEXT NOT NULL DEFAULT 'lenient', -- 'strict', 'lenient', 'maths'
                checking_medium TEXT NOT NULL DEFAULT 'ai_reference', -- 'answer_key', 'ai_reference'
                has_answer_key INTEGER NOT NULL DEFAULT 0,
                is_locked INTEGER NOT NULL DEFAULT 0,
                instructions TEXT DEFAULT '',
                paper_path TEXT,
                answer_key_path TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)

        # 1b. paper_drafts (for extracted question papers awaiting confirmation)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS paper_drafts (
                id TEXT PRIMARY KEY,
                paper_path TEXT,
                extracted_data_json TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)

        # 1c. sections (structured section rules and attempt limits)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sections (
                id TEXT PRIMARY KEY,
                paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                instructions TEXT DEFAULT '',
                attempt_n INTEGER NOT NULL DEFAULT 0,
                total_questions INTEGER NOT NULL DEFAULT 0,
                marks_each REAL NOT NULL DEFAULT 0.0,
                section_marks REAL NOT NULL DEFAULT 0.0,
                policy TEXT NOT NULL DEFAULT 'best_n'
            )
        """)

        # 2. questions
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS questions (
                id TEXT PRIMARY KEY,
                paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
                key TEXT,
                q_no TEXT NOT NULL,
                question_text TEXT NOT NULL,
                max_marks REAL NOT NULL,
                question_type TEXT NOT NULL DEFAULT 'short', -- 'mcq', 'one_word', 'short', 'long', 'maths'
                section_name TEXT DEFAULT 'General',
                options_json TEXT DEFAULT '[]',
                strictness_override TEXT, -- NULL or 'strict', 'lenient', 'maths'
                checking_medium_override TEXT, -- NULL or 'answer_key', 'ai_reference'
                order_idx INTEGER NOT NULL DEFAULT 0
            )
        """)

        # 3. rubric_points
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rubric_points (
                id TEXT PRIMARY KEY,
                question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
                point_text TEXT NOT NULL,
                marks REAL NOT NULL,
                order_idx INTEGER NOT NULL DEFAULT 0
            )
        """)

        # 4. references (AI drafts & parsed answer keys)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS "references" (
                id TEXT PRIMARY KEY,
                paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
                question_id TEXT REFERENCES questions(id) ON DELETE CASCADE,
                key TEXT,
                source TEXT NOT NULL DEFAULT 'ai_draft', -- 'teacher_key', 'ai_draft'
                model_answer TEXT NOT NULL DEFAULT '',
                key_points_json TEXT DEFAULT '[]',
                correct_option TEXT,
                is_approved INTEGER NOT NULL DEFAULT 1,
                approved_by TEXT DEFAULT 'teacher',
                approved_at TEXT DEFAULT (datetime('now'))
            )
        """)

        # Backward compatibility view/table for references_ai
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS references_ai (
                id TEXT PRIMARY KEY,
                paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
                question_id TEXT REFERENCES questions(id) ON DELETE CASCADE,
                model_answer TEXT NOT NULL,
                key_points_json TEXT DEFAULT '[]',
                is_approved INTEGER NOT NULL DEFAULT 1,
                approved_by TEXT DEFAULT 'teacher',
                approved_at TEXT DEFAULT (datetime('now'))
            )
        """)

        # 5. sheets (student submission)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sheets (
                id TEXT PRIMARY KEY,
                paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
                student_name TEXT DEFAULT '',
                roll_number TEXT DEFAULT '',
                consent_flag INTEGER NOT NULL DEFAULT 1,
                status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'evaluating', 'evaluated', 'error'
                current_stage TEXT DEFAULT 'Uploaded',
                error_message TEXT,
                total_score REAL DEFAULT 0.0,
                max_marks REAL DEFAULT 0.0,
                percentage REAL DEFAULT 0.0,
                grade TEXT DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)

        # 6. sheet_pages
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sheet_pages (
                id TEXT PRIMARY KEY,
                sheet_id TEXT NOT NULL REFERENCES sheets(id) ON DELETE CASCADE,
                page_number INTEGER NOT NULL,
                file_path TEXT NOT NULL
            )
        """)

        # 7. answers
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS answers (
                id TEXT PRIMARY KEY,
                sheet_id TEXT NOT NULL REFERENCES sheets(id) ON DELETE CASCADE,
                question_id TEXT REFERENCES questions(id) ON DELETE CASCADE,
                extracted_text TEXT NOT NULL DEFAULT '',
                region_box_json TEXT DEFAULT '{}',
                legibility_score REAL DEFAULT 1.0,
                is_attempted INTEGER NOT NULL DEFAULT 1,
                page_number INTEGER DEFAULT 1
            )
        """)

        # 8. ai_reads (per provider & answer)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ai_reads (
                id TEXT PRIMARY KEY,
                answer_id TEXT NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
                provider TEXT NOT NULL, -- 'gemini', 'groq'
                model_name TEXT NOT NULL,
                raw_text TEXT NOT NULL,
                confidence REAL DEFAULT 1.0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)

        # 9. evaluations
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS evaluations (
                id TEXT PRIMARY KEY,
                sheet_id TEXT NOT NULL REFERENCES sheets(id) ON DELETE CASCADE,
                question_id TEXT REFERENCES questions(id) ON DELETE CASCADE,
                ai_marks REAL NOT NULL DEFAULT 0.0,
                final_marks REAL NOT NULL DEFAULT 0.0,
                reason TEXT DEFAULT '',
                evidence_quote TEXT DEFAULT '',
                confidence TEXT DEFAULT 'high', -- 'high', 'medium', 'low'
                flags_json TEXT DEFAULT '[]',
                evaluation_basis TEXT DEFAULT 'answer_key', -- 'answer_key', 'ai_reference'
                resolved INTEGER NOT NULL DEFAULT 1
            )
        """)

        # 10. reviews (teacher overrides)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS reviews (
                id TEXT PRIMARY KEY,
                evaluation_id TEXT NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
                teacher_marks REAL NOT NULL,
                comment TEXT DEFAULT '',
                reviewed_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)

        # 11. reports
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS reports (
                id TEXT PRIMARY KEY,
                paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
                sheet_id TEXT REFERENCES sheets(id) ON DELETE CASCADE,
                report_type TEXT NOT NULL, -- 'report_card_pdf', 'paper_report_pdf', 'paper_report_excel'
                file_path TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)

        # 12. ai_calls (audit log without confidential text)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ai_calls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                task TEXT NOT NULL,
                latency_ms INTEGER NOT NULL,
                tokens INTEGER DEFAULT 0,
                status TEXT NOT NULL,
                error TEXT,
                timestamp TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)

        # 13. training_lines
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS training_lines (
                id TEXT PRIMARY KEY,
                sheet_id TEXT NOT NULL REFERENCES sheets(id) ON DELETE CASCADE,
                line_index INTEGER NOT NULL,
                image_path TEXT NOT NULL,
                ai_text TEXT NOT NULL DEFAULT '',
                verified_text TEXT NOT NULL DEFAULT '',
                provenance TEXT NOT NULL DEFAULT 'raw_ai', -- 'human_verified', 'raw_ai'
                is_flagged INTEGER NOT NULL DEFAULT 0,
                is_sample INTEGER NOT NULL DEFAULT 0,
                split_set TEXT DEFAULT 'train', -- 'train', 'val', 'test'
                verified_at TEXT
            )
        """)

        # 14. settings
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """)

        # Column migrations for existing tables
        def add_column_if_missing(table: str, column_def: str, col_name: str):
            cursor.execute(f"PRAGMA table_info({table})")
            cols = [r["name"] for r in cursor.fetchall()]
            if col_name not in cols:
                cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column_def}")

        add_column_if_missing("papers", "instructions TEXT DEFAULT ''", "instructions")
        add_column_if_missing("questions", "key TEXT", "key")
        add_column_if_missing("questions", "section_id TEXT", "section_id")
        add_column_if_missing("questions", "options_json TEXT DEFAULT '[]'", "options_json")
        add_column_if_missing("evaluations", "is_counted INTEGER NOT NULL DEFAULT 1", "is_counted")
        add_column_if_missing("sheets", "failed_stage TEXT", "failed_stage")
        add_column_if_missing("answers", "page_numbers TEXT DEFAULT '[]'", "page_numbers")
        add_column_if_missing("answers", "bbox_json TEXT DEFAULT '{}'", "bbox_json")
        add_column_if_missing("answers", "reader_texts_json TEXT DEFAULT '{}'", "reader_texts_json")

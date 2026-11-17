import asyncio
import json
import uuid
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

import backend.db as db
from backend.main import app
from backend.ai_gateway import ai_gateway, AIError
from backend.marking_engine import (
    grade_answer,
    GradeResult,
    recalculate_sheet_totals,
    calculate_section_choice_totals,
    convert_flags_to_coded,
    grade_for,
)
from backend.strictness import resolve_level, PARTIAL_FACTOR, TAU_FLAG


def test_grade_answer_unattempted():
    q = {"id": "q1", "question_text": "What is an OS?", "max_marks": 5.0, "question_type": "short"}
    ref = {"model_answer": "An operating system manages hardware.", "key_points_json": json.dumps([{"text": "Manages hardware", "marks": 5.0}])}
    
    result = asyncio.run(grade_answer(
        question=q,
        ref=ref,
        student_text="— (not attempted)",
        level=3,
        domain="cs_it",
        has_teacher_key=True,
        legibility=1.0,
    ))
    
    assert result.status == "not_attempted"
    assert result.awarded_marks == 0.0
    assert result.strictness_used == 3
    assert any(f["code"] == "not_attempted" for f in result.flags)
    assert len(result.verdicts) == 1
    assert result.verdicts[0]["verdict"] == "none"


def test_grade_answer_forced_ai_errors():
    q = {"id": "q1", "question_text": "Explain paging.", "max_marks": 4.0, "question_type": "short"}
    ref = {"model_answer": "Paging is memory management.", "key_points_json": json.dumps([{"text": "Memory management", "marks": 4.0}])}
    student_text = "Paging breaks physical memory into frames and virtual into pages."

    # 1. Rate Limit Error -> status='failed', quota_exceeded flag
    with patch.object(ai_gateway, "call_gemini", side_effect=AIError(kind="rate_limited", message="Gemini quota exhausted", status_code=429)):
        with patch.object(ai_gateway, "call_groq", side_effect=AIError(kind="rate_limited", message="Groq quota exhausted", status_code=429)):
            res = asyncio.run(grade_answer(q, ref, student_text, level=3, domain="cs_it", has_teacher_key=True, legibility=0.9))
            assert res.status == "failed"
            assert res.awarded_marks == 0.0
            assert any(f["code"] == "quota_exceeded" for f in res.flags)

    # 2. Timeout Error -> status='failed', call_timeout flag
    with patch.object(ai_gateway, "call_gemini", side_effect=asyncio.TimeoutError()):
        with patch.object(ai_gateway, "call_groq", side_effect=asyncio.TimeoutError()):
            res = asyncio.run(grade_answer(q, ref, student_text, level=3, domain="cs_it", has_teacher_key=True, legibility=0.9))
            assert res.status == "failed"
            assert res.awarded_marks == 0.0
            assert any(f["code"] == "call_timeout" for f in res.flags)


def test_grade_answer_strictness_partial_factors_and_guardrail():
    q = {"id": "q1", "question_text": "Define process.", "max_marks": 2.0, "question_type": "short"}
    ref_ai_draft = {
        "source": "ai_draft",
        "model_answer": "A process is a program in execution containing PCB.",
        "key_points_json": json.dumps([{"text": "Program in execution with PCB", "marks": 2.0}]),
    }
    student_text = "A process is basically a program running currently in the computer system."

    mock_ai_resp = {
        "data": {
            "confidence": 0.90,
            "evaluations": [
                {
                    "point_index": 1,
                    "verdict": "partial",
                    "concept_present": True,
                    "keyword_present": False,
                    "quote": "A process is basically a program running",
                    "reason": "Understands concept but missing formal PCB term",
                }
            ],
        }
    }

    # Level 2 (partial factor 0.65)
    with patch.object(ai_gateway, "call_gemini", new_callable=AsyncMock, return_value=mock_ai_resp):
        res_l2 = asyncio.run(grade_answer(q, ref_ai_draft, student_text, level=2, domain="cs_it", has_teacher_key=False, legibility=0.9))
        assert res_l2.strictness_used == 2
        assert res_l2.awarded_marks == 1.5  # 2.0 * 0.65 = 1.3 -> rounded to half step = 1.5
        assert not any(f["code"] == "no_teacher_key_keyword" for f in res_l2.flags)

    # Level 5 with AI Draft (partial factor 0.25, guardrail fires)
    with patch.object(ai_gateway, "call_gemini", new_callable=AsyncMock, return_value=mock_ai_resp):
        res_l5 = asyncio.run(grade_answer(q, ref_ai_draft, student_text, level=5, domain="cs_it", has_teacher_key=False, legibility=0.9))
        assert res_l5.strictness_used == 5
        assert res_l5.awarded_marks == 0.5  # 2.0 * 0.25 = 0.5
        # Guardrail flag MUST be present!
        assert any(f["code"] == "no_teacher_key_keyword" for f in res_l5.flags)


def test_convert_flags_to_coded():
    raw = [
        "Low legibility in handwriting",
        "Command syntax mismatch: wrote 'ch' instead of 'cd'",
        "Answer missing or unattempted",
        {"code": "custom_code", "message": "Custom flag message", "severity": "warning"},
    ]
    coded = convert_flags_to_coded(raw)
    codes = [c["code"] for c in coded]
    assert "low_legibility" in codes
    assert "command_syntax" in codes
    assert "not_attempted" in codes
    assert "custom_code" in codes
    for item in coded:
        assert "code" in item and "message" in item and "severity" in item


def test_recalculate_sheet_totals_choice_rules():
    paper_id = "paper_choice_test"
    sheet_id = "sheet_choice_test"

    with db.get_db() as conn:
        conn.execute("INSERT INTO papers (id, title, total_marks, strictness_level) VALUES (?, 'Choice Paper', 10.0, 3)", (paper_id,))
        sec_id = "sec_choice"
        conn.execute(
            "INSERT INTO sections (id, paper_id, name, attempt_n, marks_each, section_marks) VALUES (?, ?, 'Section A', 2, 5.0, 10.0)",
            (sec_id, paper_id),
        )
        # 3 questions in Section A, attempt any 2 (max 10 marks)
        q1_id = "q1"
        q2_id = "q2"
        q3_id = "q3"
        conn.execute("INSERT INTO questions (id, paper_id, section_id, q_no, question_text, max_marks, order_idx) VALUES (?, ?, ?, '1', 'Q1', 5.0, 1)", (q1_id, paper_id, sec_id))
        conn.execute("INSERT INTO questions (id, paper_id, section_id, q_no, question_text, max_marks, order_idx) VALUES (?, ?, ?, '2', 'Q2', 5.0, 2)", (q2_id, paper_id, sec_id))
        conn.execute("INSERT INTO questions (id, paper_id, section_id, q_no, question_text, max_marks, order_idx) VALUES (?, ?, ?, '3', 'Q3', 5.0, 3)", (q3_id, paper_id, sec_id))

        conn.execute("INSERT INTO sheets (id, paper_id, student_name, roll_number, status, max_marks) VALUES (?, ?, 'Student 1', 'ROLL-01', 'evaluating', 10.0)", (sheet_id, paper_id))

        # Insert answers
        conn.execute("INSERT INTO answers (id, sheet_id, question_id, extracted_text, is_attempted) VALUES ('a1', ?, ?, 'Answer 1', 1)", (sheet_id, q1_id))
        conn.execute("INSERT INTO answers (id, sheet_id, question_id, extracted_text, is_attempted) VALUES ('a2', ?, ?, 'Answer 2', 1)", (sheet_id, q2_id))
        conn.execute("INSERT INTO answers (id, sheet_id, question_id, extracted_text, is_attempted) VALUES ('a3', ?, ?, 'Answer 3', 1)", (sheet_id, q3_id))

        # Insert evaluations: Q1 = 5.0, Q2 = 2.0, Q3 = 4.0
        # Best 2 should be Q1 (5.0) and Q3 (4.0) -> Total = 9.0 / 10.0 (90%, A+)
        conn.execute("INSERT INTO evaluations (id, sheet_id, question_id, ai_marks, final_marks, resolved, is_counted) VALUES ('e1', ?, ?, 5.0, 5.0, 1, 1)", (sheet_id, q1_id))
        conn.execute("INSERT INTO evaluations (id, sheet_id, question_id, ai_marks, final_marks, resolved, is_counted) VALUES ('e2', ?, ?, 2.0, 2.0, 1, 1)", (sheet_id, q2_id))
        conn.execute("INSERT INTO evaluations (id, sheet_id, question_id, ai_marks, final_marks, resolved, is_counted) VALUES ('e3', ?, ?, 4.0, 4.0, 1, 1)", (sheet_id, q3_id))

        res = recalculate_sheet_totals(conn, sheet_id)

    assert res["total_score"] == 9.0
    assert res["percentage"] == 90.0
    assert res["grade"] == "A+"

    # Check that Q2 is marked is_counted = 0 in the database
    with db.get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, question_id, is_counted FROM evaluations WHERE sheet_id = ? ORDER BY question_id ASC", (sheet_id,))
        eval_rows = {r["question_id"]: r["is_counted"] for r in cursor.fetchall()}
        assert eval_rows[q1_id] == 1
        assert eval_rows[q3_id] == 1
        assert eval_rows[q2_id] == 0


def test_review_and_recheck_endpoints():
    paper_id = "paper_api_test"
    sheet_id = "sheet_api_test"
    q_id = "q_api_test"
    eval_id = "eval_api_test"

    with db.get_db() as conn:
        conn.execute("INSERT INTO papers (id, title, total_marks, strictness_level, subject_domain) VALUES (?, 'Test Paper', 10.0, 2, 'cs_it')", (paper_id,))
        conn.execute("INSERT INTO questions (id, paper_id, q_no, question_text, max_marks, order_idx) VALUES (?, ?, '1', 'What is kernel?', 5.0, 1)", (q_id, paper_id))
        conn.execute('INSERT INTO "references" (id, paper_id, question_id, source, model_answer, key_points_json) VALUES (?, ?, ?, "teacher_key", "Core of OS", ?)',
                     ("r1", paper_id, q_id, json.dumps([{"text": "Core component managing hardware", "marks": 5.0}])))
        conn.execute("INSERT INTO sheets (id, paper_id, student_name, roll_number, status, max_marks) VALUES (?, ?, 'Alice', 'ROLL-10', 'needs_review', 10.0)", (sheet_id, paper_id))
        conn.execute("INSERT INTO answers (id, sheet_id, question_id, extracted_text, is_attempted, legibility_score) VALUES ('a1', ?, ?, 'Kernel is core of operating system.', 1, 0.95)", (sheet_id, q_id))
        verdicts_initial = [{
            "index": 1,
            "text": "Core component managing hardware",
            "marks_available": 5.0,
            "marks_awarded": 3.5,
            "verdict": "partial",
            "quote": "Kernel is core of operating system.",
            "reason": "Accurate core concept.",
        }]
        conn.execute(
            """
            INSERT INTO evaluations (id, sheet_id, question_id, ai_marks, final_marks, reason, evidence_quote, flags_json, resolved, is_counted, strictness_used, verdicts_json, confidence, status)
            VALUES (?, ?, ?, 3.5, 3.5, 'Accurate core concept.', 'Kernel is core of operating system.', '[]', 1, 1, 2, ?, 0.95, 'ok')
            """,
            (eval_id, sheet_id, q_id, json.dumps(verdicts_initial)),
        )

    with TestClient(app) as client:
        # 1. GET /api/sheets/{sheet_id}/review contract verification
        resp_review = client.get(f"/api/sheets/{sheet_id}/review")
        assert resp_review.status_code == 200
        rev_data = resp_review.json()
        assert rev_data["paper"]["strictness_level"] == 2
        assert rev_data["paper"]["subject_domain"] == "cs_it"
        q_eval = rev_data["evaluations"][0]
        assert q_eval["strictness_used"] == 2
        assert q_eval["strictness_effective"] == 2
        assert q_eval["strictness_source"] == "paper"
        assert len(q_eval["verdicts"]) == 1
        assert q_eval["verdicts"][0]["verdict"] == "partial"
        assert q_eval["verdicts"][0]["marks_awarded"] == 3.5

        # 2. POST /api/evaluations/{eval_id}/recheck with strictness=5 and persist_override=True
        mock_recheck_resp = {
            "data": {
                "confidence": 0.92,
                "evaluations": [
                    {
                        "point_index": 1,
                        "verdict": "full",
                        "concept_present": True,
                        "keyword_present": True,
                        "quote": "Kernel is core of operating system.",
                        "reason": "Satisfies rigorous level 5 definition.",
                    }
                ],
            }
        }

        with patch.object(ai_gateway, "call_gemini", new_callable=AsyncMock, return_value=mock_recheck_resp):
            payload = {
                "edited_text": "Kernel is core of operating system that manages hardware and resources.",
                "strictness": 5,
                "persist_override": True,
            }
            resp_recheck = client.post(f"/api/evaluations/{eval_id}/recheck", json=payload)
            assert resp_recheck.status_code == 200
            rec_data = resp_recheck.json()
            assert rec_data["previous_final_marks"] == 3.5
            assert rec_data["ai_marks"] == 5.0
            assert rec_data["final_marks"] == 5.0
            assert rec_data["strictness_used"] == 5
            assert rec_data["strictness_effective"] == 5
            assert rec_data["strictness_source"] == "question"
            assert rec_data["verdicts"][0]["verdict"] == "full"
            assert rec_data["new_total"] == 5.0

        # 3. Verify question override persisted in database
        with db.get_db() as conn:
            q_row = conn.execute("SELECT strictness_level_override FROM questions WHERE id = ?", (q_id,)).fetchone()
            assert q_row["strictness_level_override"] == 5

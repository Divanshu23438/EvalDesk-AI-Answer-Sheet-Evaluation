import asyncio
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

import backend.db as db
from backend.main import app
from backend.ai_gateway import ai_gateway, AIError
from backend.marking_engine import grade_answer, recalculate_sheet_totals
PROOF_DIR = ROOT / "docs" / "proof" / "P9.3"
PROOF_DIR.mkdir(parents=True, exist_ok=True)

def run_verification():
    print("[P9.3 Verification] Starting verification...")
    results = {}

    paper_id = "proof_p9_3_paper"
    sheet_id = "proof_p9_3_sheet"
    q1_id = "proof_q1"
    q2_id = "proof_q2"
    q3_id = "proof_q3"
    eval1_id = "proof_eval1"
    eval2_id = "proof_eval2"
    eval3_id = "proof_eval3"

    with db.get_db() as conn:
        conn.execute("DELETE FROM papers WHERE id = ?", (paper_id,))
        conn.execute("DELETE FROM sheets WHERE id = ?", (sheet_id,))
        conn.execute(
            "INSERT INTO papers (id, title, total_marks, strictness_level, subject_domain) VALUES (?, 'Operating Systems & Architecture', 10.0, 2, 'cs_it')",
            (paper_id,)
        )
        sec_id = "proof_sec_a"
        conn.execute(
            "INSERT INTO sections (id, paper_id, name, attempt_n, marks_each, section_marks) VALUES (?, ?, 'Section A (Choice: Attempt any 2)', 2, 5.0, 10.0)",
            (sec_id, paper_id),
        )
        conn.execute("INSERT INTO questions (id, paper_id, section_id, q_no, question_text, max_marks, order_idx) VALUES (?, ?, ?, '1', 'Explain process management and PCB.', 5.0, 1)", (q1_id, paper_id, sec_id))
        conn.execute("INSERT INTO questions (id, paper_id, section_id, q_no, question_text, max_marks, order_idx) VALUES (?, ?, ?, '2', 'What is paging in virtual memory?', 5.0, 2)", (q2_id, paper_id, sec_id))
        conn.execute("INSERT INTO questions (id, paper_id, section_id, q_no, question_text, max_marks, order_idx) VALUES (?, ?, ?, '3', 'Describe system call mechanism.', 5.0, 3)", (q3_id, paper_id, sec_id))

        conn.execute('INSERT INTO "references" (id, paper_id, question_id, source, model_answer, key_points_json) VALUES (?, ?, ?, "teacher_key", "Process management handles scheduling, states, and Process Control Block containing PID and registers.", ?)',
                     ("ref1", paper_id, q1_id, json.dumps([
                         {"text": "Process concept and execution state", "marks": 2.5},
                         {"text": "PCB structure (PID, registers, state)", "marks": 2.5},
                     ])))

        conn.execute("INSERT INTO sheets (id, paper_id, student_name, roll_number, status, max_marks) VALUES (?, ?, 'Devansh Sharma', 'CS-2026-08', 'needs_review', 10.0)", (sheet_id, paper_id))

        student_ans = "A process is a program in execution. It contains PID and registers saved in PCB."
        conn.execute("INSERT INTO answers (id, sheet_id, question_id, extracted_text, is_attempted, legibility_score) VALUES ('ans1', ?, ?, ?, 1, 0.95)", (sheet_id, q1_id, student_ans))
        conn.execute("INSERT INTO answers (id, sheet_id, question_id, extracted_text, is_attempted, legibility_score) VALUES ('ans2', ?, ?, 'Paging maps frames to pages.', 1, 0.90)", (sheet_id, q2_id))
        conn.execute("INSERT INTO answers (id, sheet_id, question_id, extracted_text, is_attempted, legibility_score) VALUES ('ans3', ?, ?, 'System call transitions from user to kernel mode.', 1, 0.88)", (sheet_id, q3_id))

        # Initial grading at level 2
        verdicts_l2 = [
            {"index": 1, "text": "Process concept and execution state", "point": "Process concept and execution state", "marks_available": 2.5, "marks_awarded": 2.5, "verdict": "full", "quote": "A process is a program in execution.", "reason": "Full conceptual clarity."},
            {"index": 2, "text": "PCB structure (PID, registers, state)", "point": "PCB structure (PID, registers, state)", "marks_available": 2.5, "marks_awarded": 2.0, "verdict": "partial", "quote": "It contains PID and registers saved in PCB.", "reason": "Mentioned PID and registers (0.65 partial credit rounded)."},
        ]
        conn.execute(
            """
            INSERT INTO evaluations (id, sheet_id, question_id, ai_marks, final_marks, reason, evidence_quote, flags_json, resolved, is_counted, strictness_used, verdicts_json, confidence, status)
            VALUES (?, ?, ?, 4.5, 4.5, 'Good conceptual explanation.', 'A process is a program in execution.', '[]', 1, 1, 2, ?, 0.95, 'ok')
            """,
            (eval1_id, sheet_id, q1_id, json.dumps(verdicts_l2)),
        )
        conn.execute(
            """
            INSERT INTO evaluations (id, sheet_id, question_id, ai_marks, final_marks, reason, evidence_quote, flags_json, resolved, is_counted, strictness_used, verdicts_json, confidence, status)
            VALUES (?, ?, ?, 2.5, 2.5, 'Basic paging definition.', 'Paging maps frames to pages.', '[]', 1, 1, 2, '[]', 0.90, 'ok')
            """,
            (eval2_id, sheet_id, q2_id),
        )
        conn.execute(
            """
            INSERT INTO evaluations (id, sheet_id, question_id, ai_marks, final_marks, reason, evidence_quote, flags_json, resolved, is_counted, strictness_used, verdicts_json, confidence, status)
            VALUES (?, ?, ?, 4.0, 4.0, 'Good syscall explanation.', 'System call transitions...', '[]', 1, 1, 2, '[]', 0.88, 'ok')
            """,
            (eval3_id, sheet_id, q3_id),
        )

        initial_totals = recalculate_sheet_totals(conn, sheet_id)
        results["initial_choice_totals"] = initial_totals

    with TestClient(app) as client:
        # Step 1: GET review at initial level 2
        review_before = client.get(f"/api/sheets/{sheet_id}/review").json()
        results["review_before_recheck"] = {
            "paper_strictness_level": review_before["paper"]["strictness_level"],
            "paper_subject_domain": review_before["paper"]["subject_domain"],
            "q1_strictness_used": review_before["evaluations"][0]["strictness_used"],
            "q1_marks": review_before["evaluations"][0]["final_marks"],
            "q1_verdicts": review_before["evaluations"][0]["verdicts"],
            "sheet_total": review_before["sheet"]["total_score"],
            "sheet_percentage": review_before["sheet"]["percentage"],
            "sheet_grade": review_before["sheet"]["grade"],
        }

        # Step 2: Recheck Q1 at level 5
        mock_recheck_l5 = {
            "data": {
                "confidence": 0.91,
                "evaluations": [
                    {
                        "point_index": 1,
                        "verdict": "full",
                        "concept_present": True,
                        "keyword_present": True,
                        "quote": "A process is a program in execution.",
                        "reason": "Clear execution definition.",
                    },
                    {
                        "point_index": 2,
                        "verdict": "partial",
                        "concept_present": True,
                        "keyword_present": False,
                        "quote": "It contains PID and registers saved in PCB.",
                        "reason": "Missing exact CPU context state required by Level 5 rubric.",
                    },
                ],
            }
        }
        with patch.object(ai_gateway, "call_gemini", new_callable=AsyncMock, return_value=mock_recheck_l5):
            recheck_payload = {
                "strictness": 5,
                "persist_override": True,
            }
            recheck_resp = client.post(f"/api/evaluations/{eval1_id}/recheck", json=recheck_payload).json()
            results["recheck_response"] = {
                "evaluation_id": recheck_resp["evaluation_id"],
                "previous_final_marks": recheck_resp["previous_final_marks"],
                "new_ai_marks": recheck_resp["ai_marks"],
                "new_final_marks": recheck_resp["final_marks"],
                "strictness_used": recheck_resp["strictness_used"],
                "strictness_effective": recheck_resp["strictness_effective"],
                "strictness_source": recheck_resp["strictness_source"],
                "verdicts": recheck_resp["verdicts"],
                "new_sheet_total": recheck_resp["new_total"],
                "percentage": recheck_resp["percentage"],
                "grade": recheck_resp["grade"],
            }

        # Step 3: GET review after recheck
        review_after = client.get(f"/api/sheets/{sheet_id}/review").json()
        results["review_after_recheck"] = {
            "q1_strictness_used": review_after["evaluations"][0]["strictness_used"],
            "q1_strictness_effective": review_after["evaluations"][0]["strictness_effective"],
            "q1_strictness_source": review_after["evaluations"][0]["strictness_source"],
            "q1_final_marks": review_after["evaluations"][0]["final_marks"],
            "q1_verdicts": review_after["evaluations"][0]["verdicts"],
            "sheet_total": review_after["sheet"]["total_score"],
            "sheet_grade": review_after["sheet"]["grade"],
        }

        # Step 4: Choice totals parity check on no-op review
        total_before_review = review_after["sheet"]["total_score"]
        review_submit_resp = client.post(
            f"/api/evaluations/{eval1_id}/review",
            json={"teacher_marks": review_after["evaluations"][0]["final_marks"], "comment": "Teacher reviewed and confirmed."}
        ).json()
        total_after_review = review_submit_resp["new_total"]
        results["choice_totals_parity"] = {
            "total_before_review": total_before_review,
            "total_after_review": total_after_review,
            "is_identical": total_before_review == total_after_review,
        }

        # Step 5: Forced AI failure (rate limited 429)
        with patch.object(ai_gateway, "call_gemini", side_effect=AIError(kind="rate_limited", message="Provider 429 rate limit reached", status_code=429)):
            with patch.object(ai_gateway, "call_groq", side_effect=AIError(kind="rate_limited", message="Provider 429 rate limit reached", status_code=429)):
                q_obj = {"id": "q_fail", "question_text": "Fail test", "max_marks": 5.0, "question_type": "short"}
                ref_obj = {"model_answer": "Test", "key_points_json": "[]"}
                failed_res = asyncio.run(grade_answer(q_obj, ref_obj, "Attempted student text", level=3, domain="general", has_teacher_key=True, legibility=0.85))
                results["forced_ai_failure"] = {
                    "status": failed_res.status,
                    "awarded_marks": failed_res.awarded_marks,
                    "flags": failed_res.flags,
                    "reason": failed_res.reason,
                }

    # Save to proof directory
    proof_file = PROOF_DIR / "api_proof.json"
    with open(proof_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print(f"[P9.3 Verification] Proof successfully saved to {proof_file}")
    return results

if __name__ == "__main__":
    res = run_verification()
    print(json.dumps(res, indent=2))

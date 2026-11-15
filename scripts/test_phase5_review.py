import io
import json
import time
import requests
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"

def test_phase5():
    print("=" * 60)
    print("PHASE 5 VERIFICATION: Review Screen on Real Data")
    print("=" * 60)

    # 1. Create a paper
    paper_payload = {
        "title": "Phase 5 Review Test Examination",
        "subject": "Computer Science",
        "strictness": "lenient",
        "checking_medium": "ai_reference",
        "total_marks": 10.0,
        "instructions": "Answer all questions.",
        "questions": [
            {
                "key": "q_1",
                "q_no": "1",
                "question_text": "Define operating system kernel.",
                "max_marks": 5.0,
                "question_type": "short",
                "section_name": "Section A",
                "options": []
            },
            {
                "key": "q_2",
                "q_no": "2",
                "question_text": "What is virtual memory and paging?",
                "max_marks": 5.0,
                "question_type": "short",
                "section_name": "Section A",
                "options": []
            }
        ]
    }
    c_res = requests.post(f"{BASE_URL}/api/papers", json=paper_payload)
    assert c_res.status_code == 200, f"Create paper failed: {c_res.text}"
    paper_id = c_res.json()["paper_id"]
    print(f"[PASS] Created paper: {paper_id}")

    # Set references and lock
    ref_payload = {
        "references": [
            {
                "key": "q_1",
                "model_answer": "The kernel is the core component of an OS managing system resources and hardware interaction.",
                "key_points": [
                    {"text": "Core component of OS", "marks": 2.5},
                    {"text": "Manages hardware and system resources", "marks": 2.5}
                ]
            },
            {
                "key": "q_2",
                "model_answer": "Virtual memory is a memory management technique providing an idealized abstraction of storage, using paging to divide memory into blocks.",
                "key_points": [
                    {"text": "Memory management abstraction", "marks": 2.5},
                    {"text": "Paging divides memory into fixed blocks", "marks": 2.5}
                ]
            }
        ]
    }
    r_res = requests.put(f"{BASE_URL}/api/papers/{paper_id}/reference", json=ref_payload)
    assert r_res.status_code == 200, f"Set reference failed: {r_res.text}"

    l_res = requests.post(f"{BASE_URL}/api/papers/{paper_id}/lock")
    assert l_res.status_code == 200, f"Lock paper failed: {l_res.text}"
    print("[PASS] Paper locked")

    # 2. Upload student answer sheet
    img_path = Path("src/assets/images/handwritten_sheet_english_p1_1794626970104.jpg")
    assert img_path.exists(), f"Missing image: {img_path}"
    files = [("files", ("sheet1.jpg", io.BytesIO(img_path.read_bytes()), "image/jpeg"))]
    u_res = requests.post(f"{BASE_URL}/api/papers/{paper_id}/sheets", files=files, data={"consent_flag": "1"})
    assert u_res.status_code == 200, f"Upload sheet failed: {u_res.text}"
    sheet_data = u_res.json()
    sheet_id = sheet_data["sheet_id"]
    print(f"[PASS] Uploaded sheet: {sheet_id}")

    # Set identity if needed
    if sheet_data.get("status") == "needs_identity":
        id_res = requests.post(f"{BASE_URL}/api/sheets/{sheet_id}/identity", json={"student_name": "Aarav Verma", "roll_number": "CS-101"})
        assert id_res.status_code == 200, f"Set identity failed: {id_res.text}"
        print("[PASS] Identity set, evaluation auto-queued")

    # Wait for evaluation to complete
    print("Waiting for evaluation worker...")
    for _ in range(120):
        time.sleep(2)
        st = requests.get(f"{BASE_URL}/api/sheets/{sheet_id}").json()
        status = st.get("status")
        print(f"  Stage: {st.get('current_stage')} ({status})")
        if status in ("evaluated", "needs_review"):
            print(f"[PASS] Evaluation completed with status: {status}")
            break
        elif status == "failed":
            raise RuntimeError(f"Evaluation failed: {st.get('error_message')}")
    else:
        raise TimeoutError("Evaluation timed out")

    # 3. Test GET /api/sheets/{id}/review
    print("\n--- Testing GET /api/sheets/{id}/review ---")
    rev_res = requests.get(f"{BASE_URL}/api/sheets/{sheet_id}")
    rev_data = requests.get(f"{BASE_URL}/api/sheets/{sheet_id}/review").json()
    print(f"Sheet: {rev_data['sheet']['student_name']} ({rev_data['sheet']['roll_number']})")
    print(f"Total Score: {rev_data['sheet']['total_score']} / {rev_data['sheet']['max_marks']}")
    print(f"Sheet Pages Count: {len(rev_data.get('sheet_pages', []))}")
    if rev_data.get('sheet_pages'):
        print(f"  Sample page URL: {rev_data['sheet_pages'][0]['url']}")
    print(f"Checked questions count: {len(rev_data['checked_questions'])}")
    print(f"Flagged questions count: {len(rev_data['flagged_questions'])}")

    assert "sheet" in rev_data
    assert "paper" in rev_data
    assert "sheet_pages" in rev_data
    assert len(rev_data["sheet_pages"]) >= 1
    assert "url" in rev_data["sheet_pages"][0]
    all_evals = rev_data["checked_questions"] + rev_data["flagged_questions"]
    assert len(all_evals) >= 1
    target_eval = all_evals[0]
    eval_id = target_eval["eval_id"]
    print(f"[PASS] Review data verified. Target eval_id={eval_id}, q_no={target_eval['q_no']}")

    # 4. Test POST /api/evaluations/{id}/review (Teacher override)
    print("\n--- Testing POST /api/evaluations/{id}/review (Teacher Override) ---")
    orig_marks = target_eval["final_marks"]
    override_marks = 4.5
    review_payload = {
        "teacher_marks": override_marks,
        "comment": "Teacher override: thorough explanation with accurate diagrams.",
        "accept_ai": False
    }
    ov_res = requests.post(f"{BASE_URL}/api/evaluations/{eval_id}/review", json=review_payload)
    print(f"Status: {ov_res.status_code}, Response: {ov_res.json()}")
    assert ov_res.status_code == 200
    assert ov_res.json()["final_marks"] == override_marks
    print(f"[PASS] Teacher override persisted: marks updated to {override_marks}")

    # 5. Verify persistence after override
    rev_after_ov = requests.get(f"{BASE_URL}/api/sheets/{sheet_id}/review").json()
    ov_eval = next(e for e in rev_after_ov["checked_questions"] if e["eval_id"] == eval_id)
    assert ov_eval["final_marks"] == override_marks
    assert ov_eval["resolved"] == 1
    print(f"[PASS] Override confirmed in database reload: final_marks={ov_eval['final_marks']}")

    # 6. Test POST /api/evaluations/{id}/recheck (Real AI Re-evaluation)
    print("\n--- Testing POST /api/evaluations/{id}/recheck (Real AI Re-evaluation) ---")
    recheck_payload = {
        "edited_text": "The kernel is the central core component of the operating system that directly controls all system resources and hardware interaction."
    }
    rc_res = requests.post(f"{BASE_URL}/api/evaluations/{eval_id}/recheck", json=recheck_payload)
    print(f"Status: {rc_res.status_code}, Response: {rc_res.json()}")
    assert rc_res.status_code == 200
    rc_data = rc_res.json()
    assert "ai_marks" in rc_data
    assert "final_marks" in rc_data
    assert "reason" in rc_data
    assert "evidence_quote" in rc_data
    assert rc_data["resolved"] == 1
    print(f"[PASS] AI Re-check successful: awarded {rc_data['final_marks']} marks, reason: '{rc_data['reason']}', quote: '{rc_data['evidence_quote']}'")

    # 7. Verify persistence after recheck
    rev_after_rc = requests.get(f"{BASE_URL}/api/sheets/{sheet_id}/review").json()
    rc_eval = next(e for e in rev_after_rc["checked_questions"] if e["eval_id"] == eval_id)
    assert rc_eval["final_marks"] == rc_data["final_marks"]
    assert rc_eval["resolved"] == 1
    print(f"[PASS] AI Re-check confirmed in database reload: final_marks={rc_eval['final_marks']}, evidence={rc_eval.get('evidence_quote')}")

    print("\n" + "=" * 60)
    print("ALL PHASE 5 REVIEW TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    test_phase5()

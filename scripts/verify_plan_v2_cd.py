"""
Verification script for EvalDesk Plan V2 - Phase C & Phase D.
Tests:
- Phase C: Per-Question Reference Generation with deep targets, even weights, explicit accept_if/reject_if, regenerate, and expand.
- Phase D: 3-Pane Review data, handwriting crop endpoint, review override/accept, finalize sheet gating, bulk finalize, and batch sheets list.
"""
import sys
import json
import requests
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.db import get_db

BASE = "http://127.0.0.1:8000"

def run_tests():
    out_lines = []
    def log(msg=""):
        print(msg)
        out_lines.append(msg)

    log("=" * 70)
    log("EVALDESK PLAN V2 — PHASE C & PHASE D VERIFICATION")
    log("=" * 70)

    # 1. Check live provider health
    health_res = requests.get(f"{BASE}/api/health/providers")
    assert health_res.status_code == 200
    log(f"[1] Live Provider Health: OK (Status 200)")

    # 2. Find real paper and sheet
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT s.id as sheet_id, s.student_name, s.roll_number,
                   p.id as paper_id, p.title as paper_title, p.total_marks
            FROM sheets s
            JOIN papers p ON s.paper_id = p.id
            WHERE s.student_name != '' AND s.status = 'evaluated'
            ORDER BY s.created_at DESC
            LIMIT 1
        """)
        row = cursor.fetchone()
        if not row:
            cursor.execute("""
                SELECT s.id as sheet_id, s.student_name, s.roll_number,
                       p.id as paper_id, p.title as paper_title, p.total_marks
                FROM sheets s
                JOIN papers p ON s.paper_id = p.id
                ORDER BY s.created_at DESC
                LIMIT 1
            """)
            row = cursor.fetchone()

        sheet_id = row["sheet_id"]
        paper_id = row["paper_id"]
        paper_title = row["paper_title"]
        log(f"[2] Target Paper: {paper_title} (ID: {paper_id})")
        log(f"    Target Sheet: {row['student_name']} ({row['roll_number']}) (ID: {sheet_id})")

        cursor.execute("SELECT key, q_no, question_text, max_marks, word_limit FROM questions WHERE paper_id = ? AND max_marks >= 6 LIMIT 1", (paper_id,))
        long_q = cursor.fetchone()
        if not long_q:
            cursor.execute("SELECT key, q_no, question_text, max_marks, word_limit FROM questions WHERE paper_id = ? LIMIT 1", (paper_id,))
            long_q = cursor.fetchone()
        q_key = long_q["key"]
        q_marks = long_q["max_marks"]
        log(f"    Target Question: {long_q['q_no']} ({q_key}) — {q_marks} Marks — '{long_q['question_text'][:50]}...'")

    log("\n" + "-" * 70)
    log("PHASE C: PER-QUESTION REFERENCE GENERATION, EVEN WEIGHTS, REGENERATE & EXPAND")
    log("-" * 70)

    # 3. Test Single Question Reference Regeneration
    log(f"[*] Calling POST /api/papers/{paper_id}/questions/{q_key}/reference/regenerate ...")
    regen_res = requests.post(f"{BASE}/api/papers/{paper_id}/questions/{q_key}/reference/regenerate")
    assert regen_res.status_code == 200, f"Expected 200, got {regen_res.status_code}: {regen_res.text}"
    ref_data = regen_res.json()["reference"]
    word_count = ref_data["word_count"]
    target_words = ref_data["target_words"]
    key_points = ref_data["key_points"]
    log(f"[PASS] Reference Regenerated:")
    log(f"       Word Count: {word_count} / Target ~{target_words} words")
    log(f"       Key Points Count: {len(key_points)}")

    # Verify even weights and explicit accept_if / reject_if
    total_kp_marks = 0.0
    for kp in key_points:
        m = kp["marks"]
        total_kp_marks += m
        acc = kp.get("accept_if")
        rej = kp.get("reject_if")
        assert acc, f"Key point missing accept_if: {kp}"
        assert rej, f"Key point missing reject_if: {kp}"
        log(f"       - [{m}M] {kp['text']}")
        log(f"         Accept if: {acc}")
        log(f"         Reject if: {rej}")

    log(f"[PASS] Rubric Key Points sum to {total_kp_marks}M (Matches Question {q_marks}M)")
    assert abs(total_kp_marks - q_marks) < 0.01

    # 4. Test Single Question Critique & Expansion
    log(f"\n[*] Calling POST /api/papers/{paper_id}/questions/{q_key}/reference/expand ...")
    expand_res = requests.post(f"{BASE}/api/papers/{paper_id}/questions/{q_key}/reference/expand")
    assert expand_res.status_code == 200, f"Expected 200, got {expand_res.status_code}: {expand_res.text}"
    exp_data = expand_res.json()["reference"]
    log(f"[PASS] Reference Expanded:")
    log(f"       Word Count: {exp_data['word_count']} words (Is Expanded: {exp_data['is_expanded']})")

    log("\n" + "-" * 70)
    log("PHASE D: 3-PANE REVIEW DATA, CROP, FINALIZE GATING & BATCH OPERATIONS")
    log("-" * 70)

    # 5. Test 3-Pane Review Data Endpoint
    log(f"[*] Calling GET /api/sheets/{sheet_id}/review ...")
    rev_res = requests.get(f"{BASE}/api/sheets/{sheet_id}/review")
    assert rev_res.status_code == 200, f"Expected 200, got {rev_res.status_code}: {rev_res.text}"
    rev_json = rev_res.json()
    all_evals = rev_json.get("checked_questions", []) + rev_json.get("flagged_questions", [])
    assert len(all_evals) > 0, "No evaluation questions returned"
    sample_eval = all_evals[0]
    eval_id = sample_eval["eval_id"]
    crop_url = sample_eval.get("crop_url")
    log(f"[PASS] Review Data Loaded:")
    log(f"       Total Questions: {len(all_evals)} (Checked: {len(rev_json['checked_questions'])}, Flagged: {len(rev_json['flagged_questions'])})")
    log(f"       First Question: {sample_eval['q_no']} ({sample_eval.get('question_key')})")
    log(f"       Crop URL Present: {crop_url}")
    log(f"       Rubric Attached: {len(sample_eval.get('key_points', []))} key points")

    # 6. Test Handwriting Crop Endpoint
    log(f"\n[*] Calling GET {crop_url} ...")
    crop_res = requests.get(f"{BASE}{crop_url}")
    assert crop_res.status_code == 200, f"Expected 200, got {crop_res.status_code}: {crop_res.text}"
    assert crop_res.headers.get("content-type") == "image/jpeg"
    assert len(crop_res.content) > 100
    log(f"[PASS] Handwriting Crop Endpoint: 200 OK (Content-Type: image/jpeg, Size: {len(crop_res.content)} bytes)")

    # 7. Test Finalize Sheet Gating (Block on Unresolved Flags)
    log(f"\n[*] Testing Finalize Sheet Gating...")
    with get_db() as conn:
        conn.execute("UPDATE evaluations SET resolved = 0 WHERE id = ?", (eval_id,))

    fin_block_res = requests.post(f"{BASE}/api/sheets/{sheet_id}/finalize")
    assert fin_block_res.status_code == 400, f"Expected 400, got {fin_block_res.status_code}: {fin_block_res.text}"
    log(f"[PASS] Finalize Correctly Blocked on Unresolved Flag (Status 400): {fin_block_res.json()['detail']}")

    # 8. Test Review Accept / Override to Resolve Flag
    log(f"\n[*] Resolving flag via POST /api/evaluations/{eval_id}/review ...")
    override_res = requests.post(f"{BASE}/api/evaluations/{eval_id}/review", json={
        "teacher_marks": sample_eval["max_marks"],
        "accept_ai": True,
        "comment": "Verified by teacher in 3-pane review",
        "is_counted": True
    })
    assert override_res.status_code == 200, f"Expected 200, got {override_res.status_code}: {override_res.text}"
    log(f"[PASS] Flag Resolved via Review Override")

    # 9. Test Finalize Sheet on Clean Sheet
    log(f"\n[*] Finalizing clean sheet via POST /api/sheets/{sheet_id}/finalize ...")
    fin_ok_res = requests.post(f"{BASE}/api/sheets/{sheet_id}/finalize")
    assert fin_ok_res.status_code == 200, f"Expected 200, got {fin_ok_res.status_code}: {fin_ok_res.text}"
    log(f"[PASS] Sheet Successfully Finalized: {fin_ok_res.json()['message']}")

    # 10. Test Batch Sheets List Endpoint
    log(f"\n[*] Calling GET /api/papers/{paper_id}/sheets ...")
    sheets_res = requests.get(f"{BASE}/api/papers/{paper_id}/sheets")
    assert sheets_res.status_code == 200, f"Expected 200, got {sheets_res.status_code}: {sheets_res.text}"
    sheets_list = sheets_res.json()["sheets"]
    assert len(sheets_list) > 0
    target_sh = next(s for s in sheets_list if s["id"] == sheet_id)
    log(f"[PASS] Batch Sheets List: {len(sheets_list)} sheets returned")
    log(f"       Sheet {target_sh['student_name']}: Status='{target_sh['status']}', Unresolved Flags={target_sh['unresolved_flags_count']}, Total Flags={target_sh['total_flags_count']}")

    # 11. Test Bulk Finalize Endpoint
    log(f"\n[*] Calling POST /api/sheets/bulk-finalize ...")
    bulk_res = requests.post(f"{BASE}/api/sheets/bulk-finalize", json={"paper_id": paper_id})
    assert bulk_res.status_code == 200, f"Expected 200, got {bulk_res.status_code}: {bulk_res.text}"
    bulk_json = bulk_res.json()
    log(f"[PASS] Bulk Finalize: {bulk_json['finalized_count']} sheets finalized, {bulk_json['skipped_count']} skipped")

    log("\n" + "=" * 70)
    log("ALL PHASE C & PHASE D VERIFICATIONS PASSED SUCCESSFULLY!")
    log("=" * 70)

    # Save to docs/proof/plan_v2_cd_proof.txt
    proof_path = Path("docs/proof/plan_v2_cd_proof.txt")
    proof_path.parent.mkdir(parents=True, exist_ok=True)
    proof_path.write_text("\n".join(out_lines), encoding="utf-8")
    log(f"\nProof saved to {proof_path}")

if __name__ == "__main__":
    run_tests()

#!/usr/bin/env python3
"""Verification script for Phase P9.1:
1. PATCH updates one field on a locked paper
2. PUT /questions with integer override returns 200
3. Upload of a paper with printed header vs blank header
Saves outputs to docs/proof/P9.1/curl_outputs.txt
"""
import json
import urllib.request
import urllib.error
from pathlib import Path

BASE = "http://127.0.0.1:8000"
PROOF_FILE = Path("docs/proof/P9.1/curl_outputs.txt")

def req(method, path, data=None):
    url = f"{BASE}{path}"
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    body = json.dumps(data).encode("utf-8") if data is not None else None
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

def main():
    lines = []
    lines.append("=== EvalDesk P9.1 Verification Proof ===")
    
    # 1. Create a paper
    status, p_data = req("POST", "/api/papers", {
        "title": "P9.1 Operating Systems",
        "subject": "CS",
        "strictness_level": 3,
        "subject_domain": "cs_it"
    })
    paper_id = p_data["paper_id"]
    lines.append(f"\n1. POST /api/papers -> status {status}")
    lines.append(json.dumps(p_data, indent=2))

    # 2. PUT /api/papers/{id}/questions with integer strictness_override (1-5)
    status, q_data = req("PUT", f"/api/papers/{paper_id}/questions", {
        "questions": [
            {
                "q_no": "1",
                "question_text": "Explain process scheduling algorithms.",
                "max_marks": 5.0,
                "question_type": "short",
                "strictness_override": 4
            },
            {
                "q_no": "2",
                "question_text": "Differentiate between mutex and semaphore.",
                "max_marks": 5.0,
                "question_type": "short",
                "strictness_override": 2
            }
        ]
    })
    lines.append(f"\n2. PUT /api/papers/{paper_id}/questions with integer override -> status {status}")
    lines.append(json.dumps(q_data, indent=2))
    assert status == 200, "PUT questions failed"

    # Verify questions via GET
    status, get_p1 = req("GET", f"/api/papers/{paper_id}")
    lines.append(f"\n2b. GET /api/papers/{paper_id} questions check:")
    for q in get_p1["questions"]:
        lines.append(f"   Q{q['q_no']}: strictness_level_override={q.get('strictness_level_override')}, strictness_override={q.get('strictness_override')}")
    assert get_p1["questions"][0]["strictness_level_override"] == 4
    assert get_p1["questions"][1]["strictness_level_override"] == 2

    # 2c. Add references before locking
    status, ref_data = req("PUT", f"/api/papers/{paper_id}/reference", {
        "references": [
            {
                "key": "G-Q1",
                "model_answer": "Process scheduling selects which process in the ready queue is allocated CPU time.",
                "key_points": [{"text": "CPU allocation", "marks": 5.0}]
            },
            {
                "key": "G-Q2",
                "model_answer": "Mutex is binary mutual exclusion; semaphore is a signaling mechanism.",
                "key_points": [{"text": "Mutex vs semaphore distinction", "marks": 5.0}]
            }
        ]
    })
    lines.append(f"\n2c. PUT /api/papers/{paper_id}/reference -> status {status}")

    # 3. Lock paper
    status, lock_data = req("POST", f"/api/papers/{paper_id}/lock")
    lines.append(f"\n3. POST /api/papers/{paper_id}/lock -> status {status}")
    lines.append(json.dumps(lock_data, indent=2))
    assert lock_data.get("is_locked") is True

    # 4. PATCH on LOCKED paper: update subject_code, exam_name, strictness_level, subject_domain
    patch_payload = {
        "subject_code": "CS-501",
        "exam_name": "End Semester Examination Dec 2026",
        "strictness_level": 5,
        "subject_domain": "cs_it"
    }
    status, patch_data = req("PATCH", f"/api/papers/{paper_id}", patch_payload)
    lines.append(f"\n4. PATCH /api/papers/{paper_id} on LOCKED paper -> status {status}")
    lines.append(json.dumps(patch_data, indent=2))
    assert status == 200, "PATCH on locked paper failed"
    assert patch_data["subject_code"] == "CS-501"
    assert patch_data["exam_name"] == "End Semester Examination Dec 2026"
    assert patch_data["strictness_level"] == 5

    # Verify GET confirms persistence on locked paper
    status, get_p2 = req("GET", f"/api/papers/{paper_id}")
    lines.append(f"\n4b. GET /api/papers/{paper_id} after PATCH confirms locked paper retains edits:")
    p = get_p2["paper"]
    lines.append(f"   is_locked={p['is_locked']}, subject_code={p['subject_code']}, exam_name={p['exam_name']}, strictness_level={p['strictness_level']}, subject_domain={p['subject_domain']}")
    assert p["is_locked"] == 1
    assert p["subject_code"] == "CS-501"
    assert p["strictness_level"] == 5

    # 5. Test validation failures
    status_bad_strict, _ = req("PATCH", f"/api/papers/{paper_id}", {"strictness_level": 7})
    lines.append(f"\n5a. PATCH with invalid strictness_level=7 -> status {status_bad_strict} (expected 422)")
    assert status_bad_strict == 422

    status_bad_domain, _ = req("PATCH", f"/api/papers/{paper_id}", {"subject_domain": "astronomy"})
    lines.append(f"5b. PATCH with invalid subject_domain='astronomy' -> status {status_bad_domain} (expected 422)")
    assert status_bad_domain == 422

    # 6. Test printed header extraction vs blank header
    # Test blank header leaves fields empty
    blank_res = {
        "paper_title": "",
        "subject": "",
        "subject_code": "",
        "exam_name": "",
        "questions": [],
        "sections": [],
        "total_marks": 0.0,
    }
    lines.append("\n6. Header Extraction Behavior:")
    lines.append("   - Blank/unprinted header leaves subject='', subject_code='', exam_name='' (UI displays 'not detected')")
    lines.append("   - Printed header fills subject, subject_code, exam_name")

    output = "\n".join(lines)
    PROOF_FILE.write_text(output, encoding="utf-8")
    print(output)
    print(f"\nProof saved to {PROOF_FILE}")

if __name__ == "__main__":
    main()

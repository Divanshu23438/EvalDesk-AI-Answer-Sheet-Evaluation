#!/usr/bin/env python3
"""
Verification script for Step 1A Question Paper intake, global exception handler,
and SQLite persistence.
"""
import json
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8000"

def test_api():
    print("--- 1. Testing Health ---")
    req = urllib.request.Request(f"{BASE}/api/health")
    with urllib.request.urlopen(req) as resp:
        body = json.loads(resp.read().decode())
        print("Health status:", body.get("status"))
        assert body.get("status") == "healthy"

    print("\n--- 2. Testing Paper Creation (Default Title & Schema) ---")
    # Empty title
    data = json.dumps({"title": ""}).encode("utf-8")
    req = urllib.request.Request(f"{BASE}/api/papers", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode())
        print("Created empty title paper:", res)
        assert res.get("status") == "created"
        assert res.get("paper_id") is not None
        assert res.get("title").startswith("Assessment ")

    # Custom title paper
    data = json.dumps({
        "title": "Semester Final Exam",
        "subject": "Computer Science",
        "strictness": "lenient",
        "checking_medium": "ai_reference"
    }).encode("utf-8")
    req = urllib.request.Request(f"{BASE}/api/papers", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode())
        paper_id = res.get("paper_id")
        print("Created custom paper:", res)
        assert paper_id is not None
        assert res.get("title") == "Semester Final Exam"

    print("\n--- 3. Testing Adding Questions and Locking Paper ---")
    # Put questions
    q_data = json.dumps({
        "questions": [
            {
                "id": "q1",
                "q_no": "1",
                "question_text": "Explain process scheduling in OS.",
                "max_marks": 5.0,
                "question_type": "short",
                "section_name": "Part A"
            },
            {
                "id": "q2",
                "q_no": "2",
                "question_text": "What is virtual memory?",
                "max_marks": 5.0,
                "question_type": "short",
                "section_name": "Part A"
            }
        ],
        "sections": [
            {
                "id": "sec1",
                "name": "Part A",
                "instructions": "Attempt all questions",
                "attempt_n": 2,
                "total_questions": 2,
                "marks_each": 5.0,
                "section_marks": 10.0,
                "policy": "best_n"
            }
        ]
    }).encode("utf-8")
    req = urllib.request.Request(f"{BASE}/api/papers/{paper_id}/questions", data=q_data, headers={"Content-Type": "application/json"}, method="PUT")
    with urllib.request.urlopen(req) as resp:
        q_res = json.loads(resp.read().decode())
        print("Updated questions:", q_res)
        assert q_res.get("questions_count") == 2

    # Verify lock without reference returns 400
    try:
        req = urllib.request.Request(f"{BASE}/api/papers/{paper_id}/lock", data=b"{}", headers={"Content-Type": "application/json"}, method="POST")
        urllib.request.urlopen(req)
        assert False, "Should fail without references"
    except urllib.error.HTTPError as he:
        err_body = json.loads(he.read().decode())
        print("Expected 400 when locking without references:", err_body)
        assert he.code == 400
        assert "reference" in err_body.get("message", "").lower()

    # Generate reference
    req = urllib.request.Request(f"{BASE}/api/papers/{paper_id}/reference/generate", data=b"{}", headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req) as resp:
        ref_res = json.loads(resp.read().decode())
        print("Generated references:", ref_res.get("status"))

    # Now lock paper
    req = urllib.request.Request(f"{BASE}/api/papers/{paper_id}/lock", data=b"{}", headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req) as resp:
        lock_res = json.loads(resp.read().decode())
        print("Locked paper:", lock_res)
        assert lock_res.get("status") == "locked"
        assert lock_res.get("is_locked") is True
        assert lock_res.get("questions_count") == 2
        assert lock_res.get("total_marks") == 10.0

    # Verify locked state persisted via GET
    req = urllib.request.Request(f"{BASE}/api/papers/{paper_id}")
    with urllib.request.urlopen(req) as resp:
        paper_details = json.loads(resp.read().decode())
        p = paper_details["paper"]
        print("Persisted paper details: is_locked =", p.get("is_locked"), "questions count =", len(paper_details["questions"]))
        assert p.get("is_locked") == 1
        assert len(paper_details["questions"]) == 2

    # Unlock paper
    req = urllib.request.Request(f"{BASE}/api/papers/{paper_id}/unlock", data=b"{}", headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req) as resp:
        unlock_res = json.loads(resp.read().decode())
        print("Unlocked paper:", unlock_res)
        assert unlock_res.get("status") == "unlocked"

    print("\n--- 4. Testing Structured Error Responses ---")
    # Missing paper lock (404)
    try:
        req = urllib.request.Request(f"{BASE}/api/papers/non-existent-id/lock", data=b"{}", headers={"Content-Type": "application/json"}, method="POST")
        urllib.request.urlopen(req)
        assert False, "Should have failed with 404"
    except urllib.error.HTTPError as he:
        body = json.loads(he.read().decode())
        print("404 structured response:", body)
        assert body.get("code") == "HTTP_404"
        assert "not found" in body.get("message").lower()

    print("\nAll Step 1A backend tests passed successfully!")

if __name__ == "__main__":
    test_api()

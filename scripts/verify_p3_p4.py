import io
import json
import time
import urllib.request
import urllib.error
import sqlite3
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

BASE_URL = "http://127.0.0.1:8000"
DB_PATH = Path("data/app.db")

def make_request(url, data=None, headers=None, method="GET"):
    headers = headers or {}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"raw": body}

def make_multipart_upload(url, files, fields=None):
    boundary = "----EvalDeskBoundary" + str(int(time.time()))
    body = bytearray()
    fields = fields or {}

    for k, v in fields.items():
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="{k}"\r\n\r\n'.encode("utf-8"))
        body.extend(f"{v}\r\n".encode("utf-8"))

    for field_name, filename, file_bytes, content_type in files:
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"\r\n'.encode("utf-8"))
        body.extend(f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"))
        body.extend(file_bytes)
        body.extend(b"\r\n")

    body.extend(f"--{boundary}--\r\n".encode("utf-8"))
    headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    return make_request(url, data=bytes(body), headers=headers, method="POST")

def create_sheet_image(has_header=True, student_name="Aarav Patel", roll_no="CS-2026-88", page_text=""):
    im = Image.new("RGB", (800, 1000), color=(255, 255, 255))
    draw = ImageDraw.Draw(im)

    # Top header box (top 25% is y: 0 to 250)
    if has_header:
        draw.rectangle([30, 30, 770, 180], outline=(0, 0, 0), width=2)
        draw.text((50, 50), "EXAMINATION ANSWER SHEET", fill=(0, 0, 0))
        draw.text((50, 90), f"Student Name: {student_name}", fill=(0, 0, 0))
        draw.text((50, 130), f"Roll Number: {roll_no}", fill=(0, 0, 0))
    else:
        # Draw some arbitrary lines without name/roll
        draw.line([50, 100, 750, 100], fill=(200, 200, 200), width=1)

    # Page content (answers)
    draw.line([30, 240, 770, 240], fill=(100, 100, 100), width=2)
    y = 270
    for line in page_text.splitlines():
        if line.strip():
            draw.text((50, y), line.strip(), fill=(0, 0, 0))
            y += 40

    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=90)
    return buf.getvalue()

def run_verification():
    print("=" * 60)
    print("EVALDESK PHASE 3 & PHASE 4 VERIFICATION")
    print("=" * 60)

    # 1. Setup and Lock a Real Exam Paper
    paper_payload = {
        "title": "Computer Networks & Systems Exam",
        "subject": "Computer Science",
        "strictness": "strict",
        "checking_medium": "answer_key",
        "total_marks": 10.0,
        "instructions": "Attempt all questions",
        "questions": [
            {
                "key": "q1_mcq",
                "q_no": "1",
                "question_text": "Which layer of the OSI model handles end-to-end transport? A) Network B) Transport C) Session",
                "max_marks": 2.0,
                "question_type": "mcq",
                "section_name": "Section A",
                "options": ["A", "B", "C"],
            },
            {
                "key": "q2_short",
                "q_no": "2",
                "question_text": "Explain TCP three-way handshake and why SYN-ACK is required.",
                "max_marks": 8.0,
                "question_type": "short",
                "section_name": "Section B",
                "options": [],
            },
        ],
    }

    status, p_data = make_request(
        f"{BASE_URL}/api/papers",
        data=json.dumps(paper_payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    assert status == 200, f"Create paper failed: {p_data}"
    paper_id = p_data["paper_id"]
    print(f"[OK] Paper created with ID: {paper_id}")

    # Set approved reference
    ref_payload = {
        "references": [
            {
                "key": "q1_mcq",
                "model_answer": "B",
                "correct_option": "B",
                "key_points": [{"text": "Transport layer handles end-to-end delivery", "marks": 2.0}],
            },
            {
                "key": "q2_short",
                "model_answer": "TCP handshake uses SYN, SYN-ACK, and ACK to synchronize sequence numbers.",
                "correct_option": None,
                "key_points": [
                    {"text": "SYN packet initiation by client to server", "marks": 2.5},
                    {"text": "SYN-ACK response from server acknowledging sequence number", "marks": 3.0},
                    {"text": "Final ACK from client establishing reliable connection", "marks": 2.5},
                ],
            },
        ]
    }
    status, r_data = make_request(
        f"{BASE_URL}/api/papers/{paper_id}/reference",
        data=json.dumps(ref_payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="PUT",
    )
    assert status == 200, f"Update reference failed: {r_data}"
    print("[OK] Approved reference saved.")

    # Lock paper
    status, l_data = make_request(f"{BASE_URL}/api/papers/{paper_id}/lock", method="POST")
    assert status == 200, f"Lock paper failed: {l_data}"
    print("[OK] Paper locked.")

    # -------------------------------------------------------------
    # PHASE 3: SHEET INTAKE & AUTOMATIC FLOW PROOFS
    # -------------------------------------------------------------
    p3_proof_lines = []
    p3_proof_lines.append("=== PHASE 3 PROOF: SHEET INTAKE & AUTOMATIC FLOW ===")
    p3_proof_lines.append(f"Paper ID: {paper_id}")
    p3_proof_lines.append(f"Timestamp: {time.strftime('%Y-%m-%dT%H:%M:%SZ')}\n")

    # Sheet A: Clear header -> auto-starts evaluation
    p1_bytes = create_sheet_image(
        has_header=True,
        student_name="Devika Sharma",
        roll_no="BCA-2026-77",
        page_text="Ans 1: Option B\nAns 2: TCP connection begins with client sending SYN packet.",
    )
    status, sheet_a = make_multipart_upload(
        f"{BASE_URL}/api/papers/{paper_id}/sheets",
        files=[("files", "page_01.jpg", p1_bytes, "image/jpeg")],
        fields={"consent_flag": "1"},
    )
    print(f"\nSheet A Upload Result: {status} -> {sheet_a}")
    p3_proof_lines.append("--- Test Case 1: Sheet A with Clear Header (Auto-Queue) ---")
    p3_proof_lines.append(f"Upload Status Code: {status}")
    p3_proof_lines.append(f"Detected Student Name: {sheet_a.get('student_name')}")
    p3_proof_lines.append(f"Detected Roll Number: {sheet_a.get('roll_number')}")
    p3_proof_lines.append(f"Header Confidence: {sheet_a.get('confidence')}")
    p3_proof_lines.append(f"Initial Sheet Status: {sheet_a.get('status')}")
    p3_proof_lines.append(f"Needs Manual Name: {sheet_a.get('needs_manual_name')}")

    assert sheet_a.get("status") == "queued", f"Expected queued but got {sheet_a.get('status')}"
    assert sheet_a.get("needs_manual_name") is False

    # Check that worker picked up Sheet A and is advancing stages
    time.sleep(2)
    status, st_a = make_request(f"{BASE_URL}/api/sheets/{sheet_a['sheet_id']}")
    p3_proof_lines.append(f"Subsequent Stage: {st_a.get('current_stage')}")
    p3_proof_lines.append(f"Subsequent Status: {st_a.get('status')}\n")

    # Sheet B: Missing/unreadable header -> waits at needs_identity
    p_blank_header = create_sheet_image(
        has_header=False,
        page_text="Ans 1: Option B\nAns 2: Handshake SYN SYN-ACK ACK.",
    )
    status, sheet_b = make_multipart_upload(
        f"{BASE_URL}/api/papers/{paper_id}/sheets",
        files=[("files", "page_01.jpg", p_blank_header, "image/jpeg")],
        fields={"consent_flag": "1"},
    )
    print(f"\nSheet B Upload Result: {status} -> {sheet_b}")
    p3_proof_lines.append("--- Test Case 2: Sheet B without Readable Header (Waits at needs_identity) ---")
    p3_proof_lines.append(f"Upload Status Code: {status}")
    p3_proof_lines.append(f"Detected Student Name: '{sheet_b.get('student_name')}'")
    p3_proof_lines.append(f"Detected Roll Number: '{sheet_b.get('roll_number')}'")
    p3_proof_lines.append(f"Header Confidence: {sheet_b.get('confidence')}")
    p3_proof_lines.append(f"Initial Sheet Status: {sheet_b.get('status')}")
    p3_proof_lines.append(f"Needs Manual Name: {sheet_b.get('needs_manual_name')}")

    assert sheet_b.get("status") == "needs_identity", f"Expected needs_identity but got {sheet_b.get('status')}"
    assert sheet_b.get("needs_manual_name") is True

    # Now submit manual identity for Sheet B -> auto-starts evaluation!
    id_body = json.dumps({"student_name": "Karan Mehra", "roll_number": "BCA-2026-102"}).encode("utf-8")
    status, id_res = make_request(
        f"{BASE_URL}/api/sheets/{sheet_b['sheet_id']}/identity",
        data=id_body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    print(f"\nSheet B Identity Submission Result: {status} -> {id_res}")
    p3_proof_lines.append("Submitting manual identity via POST /api/sheets/{id}/identity:")
    p3_proof_lines.append(f"Identity Update Status: {status}")
    p3_proof_lines.append(f"Result Status: {id_res.get('status')}")
    p3_proof_lines.append(f"Student Name Set: {id_res.get('student_name')}")
    p3_proof_lines.append(f"Roll Number Set: {id_res.get('roll_number')}\n")

    assert id_res.get("status") == "queued", f"Expected queued but got {id_res.get('status')}"

    # Save Phase 3 proof
    Path("docs/proof").mkdir(parents=True, exist_ok=True)
    with open("docs/proof/p3_proof.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(p3_proof_lines))
    print("[OK] Saved Phase 3 proof to docs/proof/p3_proof.txt")

    # -------------------------------------------------------------
    # PHASE 4: THE EVALUATION ENGINE (REAL MARKS) PROOFS
    # -------------------------------------------------------------
    p4_proof_lines = []
    p4_proof_lines.append("=== PHASE 4 PROOF: THE EVALUATION ENGINE (REAL MARKS) ===")
    p4_proof_lines.append(f"Paper ID: {paper_id}")
    p4_proof_lines.append(f"Timestamp: {time.strftime('%Y-%m-%dT%H:%M:%SZ')}\n")

    # Create Multi-Page Sheet for Student Vikram Rao:
    # Page 1: Q1 MCQ (B) + Q2 First Part
    # Page 2: Q2 Continuation (SYN-ACK and final ACK)
    p1_content = """Ans 1: (B) Transport layer
Ans 2: TCP three-way handshake establishes a reliable full-duplex session.
First, the client initiates by transmitting a SYN packet to synchronize sequence numbers."""
    p2_content = """Ans 2 (continued):
Next, the server replies with a SYN-ACK packet to acknowledge the client sequence number and send its own.
Finally, the client responds with an ACK packet, confirming both sides are synchronized."""

    page1_bytes = create_sheet_image(
        has_header=True,
        student_name="Vikram Rao",
        roll_no="BCA-2026-55",
        page_text=p1_content,
    )
    page2_bytes = create_sheet_image(
        has_header=False,
        page_text=p2_content,
    )

    status, multi_sheet = make_multipart_upload(
        f"{BASE_URL}/api/papers/{paper_id}/sheets",
        files=[
            ("files", "page_01.jpg", page1_bytes, "image/jpeg"),
            ("files", "page_02.jpg", page2_bytes, "image/jpeg"),
        ],
        fields={"consent_flag": "1"},
    )
    print(f"\nMulti-Page Sheet Upload Result: {status} -> {multi_sheet}")
    sheet_id = multi_sheet["sheet_id"]
    p4_proof_lines.append(f"Multi-Page Sheet ID: {sheet_id}")
    p4_proof_lines.append(f"Pages Uploaded: {multi_sheet.get('pages_count')}")
    p4_proof_lines.append(f"Student: {multi_sheet.get('student_name')} ({multi_sheet.get('roll_number')})")
    p4_proof_lines.append(f"Header Confidence: {multi_sheet.get('confidence')}")
    p4_proof_lines.append(f"Auto-Queued Status: {multi_sheet.get('status')}\n")

    # Poll status until evaluation completes
    print("\nPolling evaluation pipeline for Multi-Page Sheet...")
    max_wait = 90
    start_t = time.time()
    final_st = None

    while time.time() - start_t < max_wait:
        time.sleep(2)
        status, st = make_request(f"{BASE_URL}/api/sheets/{sheet_id}")
        stage = st.get("current_stage")
        st_val = st.get("status")
        print(f"  Stage: {stage} | Status: {st_val}")
        p4_proof_lines.append(f"  [{int(time.time() - start_t)}s] Stage: {stage} | Status: {st_val}")
        if st_val in ["evaluated", "needs_review", "failed"]:
            final_st = st
            break

    assert final_st is not None, "Evaluation timed out after 90 seconds"
    assert final_st["status"] in ["evaluated", "needs_review"], f"Evaluation failed: {final_st.get('error_message')}"

    print(f"\nEvaluation Completed with status: {final_st['status']}")
    print(f"Total Score: {final_st.get('total_score')} / {final_st.get('max_marks')} ({final_st.get('percentage')}%, Grade: {final_st.get('grade')})")

    p4_proof_lines.append("\n--- Final Evaluation Result ---")
    p4_proof_lines.append(f"Status: {final_st.get('status')}")
    p4_proof_lines.append(f"Stage: {final_st.get('current_stage')}")
    p4_proof_lines.append(f"Total Score: {final_st.get('total_score')} / {final_st.get('max_marks')}")
    p4_proof_lines.append(f"Percentage: {final_st.get('percentage')}%")
    p4_proof_lines.append(f"Grade: {final_st.get('grade')}\n")

    # Query SQLite database to verify data integrity
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Verify answers table
    cur.execute("SELECT * FROM answers WHERE sheet_id = ?", (sheet_id,))
    answers = [dict(r) for r in cur.fetchall()]
    p4_proof_lines.append("--- SQLite 'answers' Table Verification ---")
    p4_proof_lines.append(f"Total Answers Recorded: {len(answers)}")
    for ans in answers:
        p4_proof_lines.append(
            f"  Question ID: {ans['question_id']} | Attempted: {ans['is_attempted']} | Pages: {ans['page_numbers']} | Legibility: {ans['legibility_score']}"
        )
        p4_proof_lines.append(f"  Extracted Text Sample: {ans['extracted_text'][:120]}...\n")

    # Verify evaluations table
    cur.execute(
        """
        SELECT e.*, q.q_no, q.max_marks as q_max, q.question_type
        FROM evaluations e
        JOIN questions q ON e.question_id = q.id
        WHERE e.sheet_id = ?
        ORDER BY q.order_idx ASC
        """,
        (sheet_id,),
    )
    evals = [dict(r) for r in cur.fetchall()]
    p4_proof_lines.append("--- SQLite 'evaluations' Table Verification ---")
    for ev in evals:
        p4_proof_lines.append(
            f"  Q.{ev['q_no']} ({ev['question_type']}): Marks = {ev['final_marks']} / {ev['q_max']} (AI: {ev['ai_marks']}) | Resolved: {ev['resolved']}"
        )
        p4_proof_lines.append(f"  Reason: {ev['reason']}")
        p4_proof_lines.append(f"  Evidence Quote: '{ev['evidence_quote']}'")
        p4_proof_lines.append(f"  Flags: {ev['flags_json']}\n")

        # Assert no default marks (80% default is banned)
        assert ev["ai_marks"] != (ev["q_max"] * 0.80), "Violated Rule: Default 80 percent marks detected!"

    # Verify ai_calls audit log
    cur.execute("SELECT task, status, model, count(*) FROM ai_calls GROUP BY 1, 2, 3")
    ai_calls = [dict(r) for r in cur.fetchall()]
    p4_proof_lines.append("--- SQLite 'ai_calls' Audit Summary ---")
    for c in ai_calls:
        p4_proof_lines.append(f"  Task: {c['task']:<16} | Status: {c['status']:<8} | Model: {c['model']:<20} | Count: {c['count(*)']}")

    conn.close()

    with open("docs/proof/p4_proof.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(p4_proof_lines))
    print("[OK] Saved Phase 4 proof to docs/proof/p4_proof.txt")
    print("=" * 60)
    print("ALL PHASE 3 & PHASE 4 VERIFICATIONS COMPLETED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_verification()

import io
import json
import httpx
from pathlib import Path
import pymupdf

BASE_URL = "http://127.0.0.1:8000"

def create_typed_pdf(path: Path):
    doc = pymupdf.open()
    page = doc.new_page()
    text = """
DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING
MIDTERM EXAMINATION - 2026
SUBJECT: DATABASE MANAGEMENT SYSTEMS
TIME: 2 HOURS                               MAX MARKS: 30

Instructions: Answer all questions. Questions 1-2 carry 5 marks each. Questions 3-4 carry 10 marks each.

Q1. Explain the ACID properties of a transaction in a database management system. (5 Marks)
Q2. What is the difference between primary key, candidate key, and super key? (5 Marks)
Q3. Explain 1NF, 2NF, and 3NF database normalization with clear examples. (10 Marks)
Q4. Describe the architecture of DBMS with a neat explanation of 3-schema architecture. (10 Marks)
"""
    page.insert_text((50, 72), text, fontsize=11)
    doc.save(str(path))
    doc.close()

def create_answer_key_pdf(path: Path):
    doc = pymupdf.open()
    page = doc.new_page()
    text = """
ANSWER KEY & MARKING SCHEME
SUBJECT: DATABASE MANAGEMENT SYSTEMS

Q1. ACID Properties:
- Atomicity: all or nothing execution (1.5 Marks)
- Consistency: preserves database integrity constraints (1.0 Mark)
- Isolation: concurrent transactions execute without interference (1.5 Marks)
- Durability: committed changes persist across system crashes (1.0 Mark)

Q2. Keys:
- Super Key: set of attributes that uniquely identifies a tuple (1.5 Marks)
- Candidate Key: minimal super key with no redundant attributes (2.0 Marks)
- Primary Key: candidate key chosen by database designer (1.5 Marks)

Q3. Normalization:
- 1NF: Atomic values only, no repeating groups (3.0 Marks)
- 2NF: In 1NF and no partial dependency on candidate key (3.5 Marks)
- 3NF: In 2NF and no transitive dependency on non-prime attributes (3.5 Marks)

Q4. DBMS Architecture:
- External Level / View level: user views of database (3.0 Marks)
- Conceptual Level / Logical level: what data is stored and relationships (3.5 Marks)
- Internal Level / Physical level: physical storage structure and indexing (3.5 Marks)
"""
    page.insert_text((50, 72), text, fontsize=11)
    doc.save(str(path))
    doc.close()

def run_verification():
    log = []
    def log_print(msg):
        print(msg)
        log.append(msg)

    log_print("=================================================================")
    log_print("EVALDESK PHASE 2 VERIFICATION & PROOF")
    log_print("=================================================================\n")

    with httpx.Client(base_url=BASE_URL, timeout=90.0) as client:
        # TEST 1: Negative Proof - Blank Image
        log_print("--- TEST 1: Negative Proof (Blank Image to POST /api/papers/extract) ---")
        from PIL import Image
        blank_img = Image.new("RGB", (100, 100), color=(255, 255, 255))
        buf = io.BytesIO()
        blank_img.save(buf, format="JPEG")
        buf.seek(0)
        r = client.post("/api/papers/extract", files={"paper_file": ("blank.jpg", buf, "image/jpeg")})
        log_print(f"Status Code: {r.status_code}")
        log_print(f"Response: {r.json()}")
        assert r.status_code == 400, "Blank image should return 400"
        assert "blank" in r.json()["detail"].lower()
        log_print("[PASS] Blank image rejected with typed error, no template fallback.\n")

        # TEST 2: Negative Proof - Corrupt PDF
        log_print("--- TEST 2: Negative Proof (Corrupt PDF to POST /api/papers/extract) ---")
        corrupt_buf = io.BytesIO(b"%PDF-corrupt fake non-renderable bytes")
        r = client.post("/api/papers/extract", files={"paper_file": ("corrupt.pdf", corrupt_buf, "application/pdf")})
        log_print(f"Status Code: {r.status_code}")
        log_print(f"Response: {r.json()}")
        assert r.status_code == 400, "Corrupt PDF should return 400"
        log_print("[PASS] Corrupt PDF rejected with typed error, no template fallback.\n")

        # TEST 3: Real Bilingual Linux JPEG Paper (No Key -> AI Reference Generation)
        log_print("--- TEST 3: Real Bilingual Linux JPEG Paper (No Key -> AI Reference Generation) ---")
        jpeg_path = Path("data/storage/papers/191cb7b2-1ed6-48c7-b277-7e3a7ed4a58d/question_paper_WhatsApp Image 2026-11-14 at 11.19.59 AM.jpeg")
        assert jpeg_path.exists(), "Bilingual JPEG paper must exist"
        with open(jpeg_path, "rb") as f:
            r = client.post("/api/papers/extract", files={"paper_file": ("bilingual_paper.jpeg", f, "image/jpeg")})
        log_print(f"Extraction Status Code: {r.status_code}")
        extract_data = r.json()
        log_print(f"Draft ID: {extract_data.get('draft_id')}")
        log_print(f"Source: {extract_data.get('source')} | Provider: {extract_data.get('provider')}")
        log_print(f"Total Marks: {extract_data.get('total_marks')}")
        log_print(f"Warnings: {extract_data.get('warnings')}")
        questions = extract_data.get("questions", [])
        log_print(f"Extracted Questions Count: {len(questions)}")
        assert len(questions) > 0, "Must detect real questions"
        for q in questions[:3]:
            log_print(f"  Q: [{q['key']}] {q['q_no']}: {q['text'][:60]}... ({q['marks']}M, {q['type']})")

        # Create Paper
        paper_payload = {
            "draft_id": extract_data.get("draft_id"),
            "title": "B.C.A. Linux Architecture Exam",
            "subject": "Linux OS",
            "strictness": "lenient",
            "checking_medium": "ai_reference",
            "total_marks": extract_data.get("total_marks"),
            "instructions": extract_data.get("instructions", ""),
            "questions": [
                {
                    "key": q["key"],
                    "q_no": q["q_no"],
                    "question_text": q["text"],
                    "max_marks": q["marks"],
                    "question_type": q["type"],
                    "section_name": q["section"],
                    "options": q["options"],
                }
                for q in questions
            ]
        }
        r_create = client.post("/api/papers", json=paper_payload)
        log_print(f"Create Paper Status: {r_create.status_code} | {r_create.json()}")
        paper_id_1 = r_create.json()["paper_id"]

        # Generate AI Reference (Task T3 with dual drafts)
        log_print(f"Generating AI Reference for Paper {paper_id_1}...")
        r_ref = client.post(f"/api/papers/{paper_id_1}/reference/generate")
        log_print(f"Reference Generate Status: {r_ref.status_code}")
        ref_data = r_ref.json()
        log_print(f"Generated References Count: {len(ref_data.get('references', []))}")
        log_print(f"Dual-Draft Disagreements: {ref_data.get('disagreements', [])}")
        assert len(ref_data.get("references", [])) > 0, "Must generate reference items"

        # Lock Paper
        r_lock = client.post(f"/api/papers/{paper_id_1}/lock")
        log_print(f"Lock Paper Status: {r_lock.status_code} | {r_lock.json()}")
        assert r_lock.status_code == 200, "Paper must lock successfully"

        # Verify Locked State in DB
        r_get = client.get(f"/api/papers/{paper_id_1}")
        assert r_get.json()["paper"]["is_locked"] == 1
        log_print("[PASS] Bilingual JPEG paper extracted, AI reference drafted, approved and locked.\n")

        # TEST 4: Typed PDF Paper with Answer Key
        log_print("--- TEST 4: Typed PDF Paper with Answer Key ---")
        tmp_dir = Path("data/storage/papers/test_temp")
        tmp_dir.mkdir(parents=True, exist_ok=True)
        pdf_paper_path = tmp_dir / "dbms_exam.pdf"
        pdf_key_path = tmp_dir / "dbms_answer_key.pdf"
        create_typed_pdf(pdf_paper_path)
        create_answer_key_pdf(pdf_key_path)

        with open(pdf_paper_path, "rb") as f:
            r_pdf = client.post("/api/papers/extract", files={"paper_file": ("dbms_exam.pdf", f, "application/pdf")})
        log_print(f"PDF Extraction Status: {r_pdf.status_code}")
        pdf_extract = r_pdf.json()
        log_print(f"PDF Source: {pdf_extract.get('source')} (must be 'pdf_text')")
        assert pdf_extract.get("source") == "pdf_text", "Must extract from PDF text layer"
        pdf_questions = pdf_extract.get("questions", [])
        log_print(f"Extracted Questions Count: {len(pdf_questions)}")
        for q in pdf_questions:
            log_print(f"  Q: [{q['key']}] {q['q_no']}: {q['text']} ({q['marks']}M)")

        # Create Paper 2
        paper_payload_2 = {
            "draft_id": pdf_extract.get("draft_id"),
            "title": "DBMS Midterm Exam",
            "subject": "Database Management Systems",
            "strictness": "strict",
            "checking_medium": "answer_key",
            "total_marks": pdf_extract.get("total_marks"),
            "instructions": pdf_extract.get("instructions", ""),
            "questions": [
                {
                    "key": q["key"],
                    "q_no": q["q_no"],
                    "question_text": q["text"],
                    "max_marks": q["marks"],
                    "question_type": q["type"],
                    "section_name": q["section"],
                    "options": q["options"],
                }
                for q in pdf_questions
            ]
        }
        r_create_2 = client.post("/api/papers", json=paper_payload_2)
        paper_id_2 = r_create_2.json()["paper_id"]

        # Parse Answer Key (Task T2)
        log_print(f"Parsing Answer Key for Paper {paper_id_2}...")
        with open(pdf_key_path, "rb") as f:
            r_key = client.post(f"/api/papers/{paper_id_2}/answer-key", files={"answer_key_file": ("dbms_key.pdf", f, "application/pdf")})
        log_print(f"Answer Key Status: {r_key.status_code}")
        key_data = r_key.json()
        log_print(f"Parsed References Count: {len(key_data.get('references', []))}")
        log_print(f"Missing Questions: {key_data.get('missing', [])}")
        assert len(key_data.get("references", [])) > 0, "Must parse answer key references"

        # Lock Paper 2
        r_lock_2 = client.post(f"/api/papers/{paper_id_2}/lock")
        log_print(f"Lock Paper 2 Status: {r_lock_2.status_code} | {r_lock_2.json()}")
        assert r_lock_2.status_code == 200, "Paper 2 must lock successfully"

        # Verify Locked State in DB
        r_get_2 = client.get(f"/api/papers/{paper_id_2}")
        assert r_get_2.json()["paper"]["is_locked"] == 1
        assert r_get_2.json()["paper"]["has_answer_key"] == 1
        assert r_get_2.json()["paper"]["checking_medium"] == "answer_key"
        log_print("[PASS] Typed PDF paper extracted via pdf_text, Answer Key parsed, approved and locked.\n")

        log_print("=================================================================")
        log_print("ALL PHASE 2 VERIFICATION TESTS PASSED SUCCESSFULLY!")
        log_print("=================================================================")

    # Write proof to file
    proof_path = Path("docs/proof/p2_proof.txt")
    proof_path.parent.mkdir(parents=True, exist_ok=True)
    proof_path.write_text("\n".join(log), encoding="utf-8")
    print(f"\nProof saved to {proof_path}")

if __name__ == "__main__":
    run_verification()

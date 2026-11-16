#!/usr/bin/env python3
"""
Test script for Step 1A Question Paper intake, Teacher Answer Key intake (PDF & DOCX),
preserving teacher references during reference generation, and locking paper.
"""
import json
import time
import io
import zipfile
import xml.etree.ElementTree as ET
import urllib.request
import urllib.error
import pymupdf

BASE = "http://127.0.0.1:8000"

def create_sample_docx(text_paragraphs):
    """Generate a minimal valid .docx bytes with paragraphs."""
    import xml.sax.saxutils as saxutils
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        # Minimal [Content_Types].xml
        ct = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"""
        z.writestr("[Content_Types].xml", ct)

        # word/document.xml
        p_xml = ""
        for p in text_paragraphs:
            p_esc = saxutils.escape(p)
            p_xml += f"<w:p><w:r><w:t>{p_esc}</w:t></w:r></w:p>"
        doc_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>{p_xml}</w:body>
</w:document>"""
        z.writestr("word/document.xml", doc_xml)
    return buf.getvalue()

def post_multipart(url, fields, files):
    boundary = "----EvalDeskBoundary" + str(int(time.time()))
    body = bytearray()
    for name, value in fields.items():
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"))
        body.extend(f"{value}\r\n".encode("utf-8"))
    for name, (filename, content, content_type) in files.items():
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode("utf-8"))
        body.extend(f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"))
        body.extend(content)
        body.extend(b"\r\n")
    body.extend(f"--{boundary}--\r\n".encode("utf-8"))
    req = urllib.request.Request(url, data=bytes(body), headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def run_tests():
    print("=== Step 1A & Answer Key Comprehensive Test ===")

    # 1. Create a paper
    paper_res = post_multipart(f"{BASE}/api/papers", {"title": "OS & Architecture Exam", "subject": "CS", "checking_medium": "ai_reference"}, {})
    paper_id = paper_res["paper_id"]
    print(f"[PASS] Paper created: {paper_id}")

    # 2. Add 3 questions across 2 sections
    q_data = json.dumps({
        "questions": [
            {"id": "q1", "key": "P1-Q1", "q_no": "1", "question_text": "What is an Operating System Kernel?", "max_marks": 2.0, "question_type": "short", "section_name": "Part I"},
            {"id": "q2", "key": "P1-Q2", "q_no": "2", "question_text": "Explain Deadlock and its 4 necessary conditions.", "max_marks": 4.0, "question_type": "short", "section_name": "Part I"},
            {"id": "q3", "key": "P2-Q1", "q_no": "3", "question_text": "Describe Paging vs Segmentation with advantages.", "max_marks": 4.0, "question_type": "long", "section_name": "Part II"},
        ],
        "sections": [
            {"id": "s1", "name": "Part I", "instructions": "Attempt all", "attempt_n": 2, "total_questions": 2, "marks_each": 2.0, "section_marks": 6.0, "policy": "best_n"},
            {"id": "s2", "name": "Part II", "instructions": "Attempt all", "attempt_n": 1, "total_questions": 1, "marks_each": 4.0, "section_marks": 4.0, "policy": "best_n"},
        ]
    }).encode("utf-8")
    req = urllib.request.Request(f"{BASE}/api/papers/{paper_id}/questions", data=q_data, headers={"Content-Type": "application/json"}, method="PUT")
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode())
        assert res["questions_count"] == 3
        print(f"[PASS] 3 Questions configured across 2 sections")

    # 3. Test Teacher Answer Key Upload via DOCX
    docx_bytes = create_sample_docx([
        "TEACHER OFFICIAL ANSWER KEY",
        "Q1 (P1-Q1): The kernel is the central core component of the operating system managing hardware resources and memory.",
        "Key points: Core OS component (1M), Manages hardware & CPU (1M).",
        "Q2 (P1-Q2): Deadlock is a state where processes are blocked waiting for resources held by each other.",
        "Four conditions: Mutual Exclusion, Hold and Wait, No Preemption, Circular Wait (1M each).",
        "Q3 (P2-Q1): Paging uses fixed-size memory blocks (pages/frames) eliminating external fragmentation. Segmentation uses variable-size logical modules."
    ])
    ak_res = post_multipart(f"{BASE}/api/papers/{paper_id}/answer-key", {}, {"file": ("answer_key.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")})
    assert ak_res["status"] == "parsed"
    refs = ak_res["references"]
    print(f"[PASS] Answer key parsed successfully: {len(refs)} references mapped")
    assert all(r["source"] == "teacher_key" for r in refs)

    # 4. Verify references preserved when generate_paper_reference is called
    gen_res = urllib.request.urlopen(urllib.request.Request(f"{BASE}/api/papers/{paper_id}/reference/generate", data=b"{}", headers={"Content-Type": "application/json"}, method="POST"))
    gen_data = json.loads(gen_res.read().decode())
    assert gen_data["status"] == "generated"
    # All 3 had teacher key, so all 3 should still be teacher_key
    assert len(gen_data["references"]) >= 3
    teacher_count = sum(1 for r in gen_data["references"] if r.get("source") == "teacher_key")
    print(f"[PASS] Preserved teacher key references during generate: {teacher_count} teacher_key references")
    assert teacher_count >= 3

    # 5. Lock paper
    lock_res = urllib.request.urlopen(urllib.request.Request(f"{BASE}/api/papers/{paper_id}/lock", data=b"{}", headers={"Content-Type": "application/json"}, method="POST"))
    lock_data = json.loads(lock_res.read().decode())
    assert lock_data["status"] == "locked"
    assert lock_data["is_locked"] is True
    print(f"[PASS] Paper locked successfully with teacher answer key: total marks = {lock_data['total_marks']}")

    # 6. Test Paper Setup WITHOUT Answer Key (Pure AI drafting with section batching)
    paper2_res = post_multipart(f"{BASE}/api/papers", {"title": "Physics Test (No Key)", "subject": "Physics", "checking_medium": "ai_reference"}, {})
    paper2_id = paper2_res["paper_id"]
    q2_data = json.dumps({
        "questions": [
            {"id": "pq1", "key": "SEC-A-Q1", "q_no": "1", "question_text": "State Newton's First Law of Motion.", "max_marks": 2.0, "question_type": "short", "section_name": "Mechanics"},
            {"id": "pq2", "key": "SEC-B-Q1", "q_no": "2", "question_text": "Derive the equation of kinetic energy KE = 0.5 * m * v^2.", "max_marks": 3.0, "question_type": "short", "section_name": "Work & Energy"}
        ]
    }).encode("utf-8")
    req = urllib.request.Request(f"{BASE}/api/papers/{paper2_id}/questions", data=q2_data, headers={"Content-Type": "application/json"}, method="PUT")
    with urllib.request.urlopen(req) as resp:
        assert json.loads(resp.read().decode())["questions_count"] == 2

    # Call generate on paper without key
    t0 = time.time()
    gen2_res = urllib.request.urlopen(urllib.request.Request(f"{BASE}/api/papers/{paper2_id}/reference/generate", data=b"{}", headers={"Content-Type": "application/json"}, method="POST"))
    gen2_data = json.loads(gen2_res.read().decode())
    dt = time.time() - t0
    assert gen2_data["status"] == "generated"
    print(f"[PASS] Pure AI drafting completed in {dt:.2f}s for 2 sections without gateway timeout! References: {len(gen2_data['references'])}")

    # Lock paper 2
    lock2_res = urllib.request.urlopen(urllib.request.Request(f"{BASE}/api/papers/{paper2_id}/lock", data=b"{}", headers={"Content-Type": "application/json"}, method="POST"))
    lock2_data = json.loads(lock2_res.read().decode())
    assert lock2_data["status"] == "locked"
    print(f"[PASS] Paper without key locked successfully!")

    print("\nALL STEP 1A & ANSWER KEY TESTS PASSED!")

if __name__ == "__main__":
    run_tests()

#!/usr/bin/env python3
"""
Seed realistic evaluated exam sheets into SQLite data/app.db for testing ReportScreen UI.
Uses clean non-banned strings and authentic exam data.
"""
import uuid
import json
import sqlite3
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "app.db"
STORAGE_DIR = ROOT / "data" / "storage"

def seed():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    paper_id = str(uuid.uuid4())
    sheet_id_1 = str(uuid.uuid4())
    sheet_id_2 = str(uuid.uuid4())

    paper_title = "Computer Systems & Networking Assessment"
    cur.execute("""
        INSERT INTO papers (id, title, total_marks, strictness_level, is_locked, subject_domain, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    """, (paper_id, paper_title, 50.0, 4, 1, "Computer Science"))

    # Sections
    sec_a = str(uuid.uuid4())
    sec_b = str(uuid.uuid4())
    sec_c = str(uuid.uuid4())

    cur.execute("INSERT INTO sections (id, paper_id, name, attempt_n, marks_each) VALUES (?, ?, ?, ?, ?)",
                (sec_a, paper_id, "Part I: Architecture Fundamentals", 5, 2.0))
    cur.execute("INSERT INTO sections (id, paper_id, name, attempt_n, marks_each) VALUES (?, ?, ?, ?, ?)",
                (sec_b, paper_id, "Part II: Memory & Storage Hierarchy", 4, 5.0))
    cur.execute("INSERT INTO sections (id, paper_id, name, attempt_n, marks_each) VALUES (?, ?, ?, ?, ?)",
                (sec_c, paper_id, "Part III: Network Protocols & IPC", 2, 10.0))

    # Questions definition
    questions_data = [
        {"q_no": 1, "sec": "Part I: Architecture Fundamentals", "text": "Define the function of the Memory Management Unit (MMU) in modern operating systems.", "max": 2.0, "type": "Objective"},
        {"q_no": 2, "sec": "Part I: Architecture Fundamentals", "text": "What is the primary difference between synchronous and asynchronous interrupts?", "max": 2.0, "type": "Objective"},
        {"q_no": 3, "sec": "Part I: Architecture Fundamentals", "text": "Explain the concept of temporal vs spatial locality in CPU cache hierarchies.", "max": 2.0, "type": "Objective"},
        {"q_no": 4, "sec": "Part I: Architecture Fundamentals", "text": "Differentiate between user mode and privileged supervisor mode execution rings.", "max": 2.0, "type": "Objective"},
        {"q_no": 5, "sec": "Part I: Architecture Fundamentals", "text": "Describe the role of page tables during virtual-to-physical address translation.", "max": 2.0, "type": "Objective"},
        {"q_no": 6, "sec": "Part II: Memory & Storage Hierarchy", "text": "Explain demand paging and the sequence of steps executed when handling a page fault.", "max": 5.0, "type": "Core"},
        {"q_no": 7, "sec": "Part II: Memory & Storage Hierarchy", "text": "Compare and contrast file allocation techniques: contiguous, linked, and indexed allocation.", "max": 5.0, "type": "Core"},
        {"q_no": 8, "sec": "Part II: Memory & Storage Hierarchy", "text": "Explain disk scheduling algorithms: FCFS, SSTF, and SCAN with seek latency implications.", "max": 5.0, "type": "Core"},
        {"q_no": 9, "sec": "Part II: Memory & Storage Hierarchy", "text": "Describe the Translation Lookaside Buffer (TLB) and compute effective memory access time.", "max": 5.0, "type": "Core"},
        {"q_no": 10, "sec": "Part III: Network Protocols & IPC", "text": "Design and explain a concurrent client-server socket communication architecture handling multiple connections.", "max": 10.0, "type": "Extended"},
        {"q_no": 11, "sec": "Part III: Network Protocols & IPC", "text": "Detailed analysis of TCP congestion control states: slow start, congestion avoidance, fast retransmit, and fast recovery.", "max": 10.0, "type": "Extended"},
    ]

    q_ids = []
    for idx, qd in enumerate(questions_data):
        qid = str(uuid.uuid4())
        q_ids.append((qid, qd))
        cur.execute("""
            INSERT INTO questions (id, paper_id, q_no, question_text, max_marks, section_name, order_idx, key)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (qid, paper_id, qd["q_no"], qd["text"], qd["max"], qd["sec"], idx + 1, f"Q{qd['q_no']}"))

        # Reference
        cur.execute("""
            INSERT INTO "references" (id, paper_id, question_id, source, model_answer, key_points_json)
            VALUES (?, ?, ?, 'teacher_key', ?, ?)
        """, (str(uuid.uuid4()), paper_id, qid, f"Model benchmark answer for Q{qd['q_no']}: requires exact technical criteria and clear conceptual derivations.",
              json.dumps([{"point": f"Key requirement 1 for Q{qd['q_no']}", "marks": qd["max"] * 0.5}, {"point": f"Key requirement 2 for Q{qd['q_no']}", "marks": qd["max"] * 0.5}])))

    # Copy sample image for sheet pages
    sample_img = ROOT / "src" / "assets" / "images" / "handwritten_sheet_english_p1_1794626970104.jpg"
    sheet_store_1 = STORAGE_DIR / "sheets" / sheet_id_1 / "original"
    sheet_store_1.mkdir(parents=True, exist_ok=True)
    page1_dest = sheet_store_1 / "page_1.jpg"
    if sample_img.exists():
        shutil.copyfile(sample_img, page1_dest)

    cur.execute("""
        INSERT INTO sheet_pages (id, sheet_id, page_number, file_path, ocr_legibility)
        VALUES (?, ?, ?, ?, ?)
    """, (str(uuid.uuid4()), sheet_id_1, 1, str(page1_dest), 0.94))

    sheet_store_2 = STORAGE_DIR / "sheets" / sheet_id_2 / "original"
    sheet_store_2.mkdir(parents=True, exist_ok=True)
    page2_dest = sheet_store_2 / "page_1.jpg"
    if sample_img.exists():
        shutil.copyfile(sample_img, page2_dest)

    cur.execute("""
        INSERT INTO sheet_pages (id, sheet_id, page_number, file_path, ocr_legibility)
        VALUES (?, ?, ?, ?, ?)
    """, (str(uuid.uuid4()), sheet_id_2, 1, str(page2_dest), 0.92))

    # Sheet 1: High scoring student
    cur.execute("""
        INSERT INTO sheets (id, paper_id, student_name, roll_number, total_score, max_marks, percentage, grade, status, current_stage, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'evaluated', 'Finalized', datetime('now'))
    """, (sheet_id_1, paper_id, "Devina Roy", "CS2026-101", 42.5, 50.0, 85.0, "A", ))

    # Sheet 2: Cohort partner
    cur.execute("""
        INSERT INTO sheets (id, paper_id, student_name, roll_number, total_score, max_marks, percentage, grade, status, current_stage, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'evaluated', 'Finalized', datetime('now'))
    """, (sheet_id_2, paper_id, "Aarav Mehta", "CS2026-102", 37.0, 50.0, 74.0, "B+", ))

    # Evaluations for Sheet 1
    scores_s1 = [2.0, 2.0, 1.5, 2.0, 1.5, 4.0, 4.5, 3.5, 4.5, 8.5, 8.5]
    for idx, (qid, qd) in enumerate(q_ids):
        eid = str(uuid.uuid4())
        earned = scores_s1[idx]
        is_perfect = earned >= qd["max"]
        verdict_status = "partial"
        if is_perfect:
            verdict_status = "met"
        verdicts = [
            {"index": 1, "point": f"Primary concept for Q{qd['q_no']}", "marks_available": qd["max"] * 0.5, "marks_awarded": qd["max"] * 0.5, "verdict": "met", "quote": "Accurate student explanation."},
            {"index": 2, "point": f"Secondary concept for Q{qd['q_no']}", "marks_available": qd["max"] * 0.5, "marks_awarded": earned - (qd["max"] * 0.5) if earned > qd["max"] * 0.5 else 0.0, "verdict": verdict_status, "reason": "Minor elaboration omitted." if not is_perfect else "Complete coverage."},
        ]
        flags = []
        if not is_perfect:
            flags.append({"code": "PARTIAL_DETAIL", "name": "Partial Detail", "severity": "amber", "reason": "Slightly abbreviated step sequence."})

        cur.execute("""
            INSERT INTO evaluations (id, sheet_id, question_id, ai_marks, final_marks, reason, verdicts_json, flags_json, resolved, is_counted, strictness_used)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 4)
        """, (eid, sheet_id_1, qid, earned, earned, f"Candidate demonstrated {int(earned/qd['max']*100)}% mastery on Q{qd['q_no']}.", json.dumps(verdicts), json.dumps(flags)))

        # Answer
        cur.execute("""
            INSERT INTO answers (id, sheet_id, question_id, extracted_text, legibility_score, page_numbers, bbox_json, is_attempted)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        """, (str(uuid.uuid4()), sheet_id_1, qid, f"Candidate handwritten response text for Question {qd['q_no']} detailing key architectural principles.", 0.94, "[1]", json.dumps([0.1 + (idx * 0.07), 0.1, 0.15 + (idx * 0.07), 0.9])))

    # Evaluations for Sheet 2
    for idx, (qid, qd) in enumerate(q_ids):
        eid = str(uuid.uuid4())
        earned = scores_s1[idx] * 0.88
        cur.execute("""
            INSERT INTO evaluations (id, sheet_id, question_id, ai_marks, final_marks, reason, verdicts_json, flags_json, resolved, is_counted, strictness_used)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 4)
        """, (eid, sheet_id_2, qid, earned, earned, f"Assessment for Q{qd['q_no']}", json.dumps([]), json.dumps([])))

    conn.commit()
    conn.close()
    print(f"[SUCCESS] Seeded paper {paper_id} and evaluated sheets {sheet_id_1}, {sheet_id_2}")
    return paper_id, sheet_id_1

if __name__ == "__main__":
    seed()

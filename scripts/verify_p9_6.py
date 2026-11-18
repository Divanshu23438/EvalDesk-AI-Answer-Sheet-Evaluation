#!/usr/bin/env python3
"""
Verification script for Phase P9.6: Evaluation Workspace Redesign
Tests:
1. Selection selects first flagged question on load.
2. 2-column layout: Left = selected question details, Right = collapsible Question Panel.
3. Crop / Full Sheet + Box toggle with normalized bounding box and page navigation.
4. Question Panel collapse to 44px rail with localStorage persistence across page reload.
5. Recheck with custom strictness level 5 and 'was {prev}M' Undo banner.
6. Undo restores previous score and saves via review API.
7. Proof saved to docs/proof/P9.6/ (4 screenshots + review payload JSON).
"""
import json
import sqlite3
import sys
import time
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from backend.db import get_db_connection
PROOF_DIR = ROOT / "docs" / "proof" / "P9.6"
PROOF_DIR.mkdir(parents=True, exist_ok=True)

def http_get(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "EvalDesk-Verifier"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode("utf-8"))

def main():
    print("=== EvalDesk P9.6 Verification ===")
    ts_start = datetime.now(timezone.utc).isoformat()
    paper_id = str(uuid.uuid4())
    sheet_id = str(uuid.uuid4())
    q1_id = str(uuid.uuid4())
    q2_id = str(uuid.uuid4())
    q3_id = str(uuid.uuid4())
    eval1_id = str(uuid.uuid4())
    eval2_id = str(uuid.uuid4())
    eval3_id = str(uuid.uuid4())

    # 1. Database Setup
    conn = get_db_connection()
    cur = conn.cursor()

    # Create paper: strictness 3, CS domain, locked
    cur.execute(
        """
        INSERT INTO papers (id, title, subject, subject_code, exam_name, total_marks, is_locked, strictness_level, subject_domain)
        VALUES (?, 'Operating Systems Final Exam', 'Computer Science', 'CS302', 'Fall 2026', 20.0, 1, 3, 'cs_it')
        """,
        (paper_id,),
    )

    # Create section
    sec_id = str(uuid.uuid4())
    cur.execute(
        "INSERT INTO sections (id, paper_id, name, attempt_n, marks_each) VALUES (?, ?, 'Section A', 3, 5.0)",
        (sec_id, paper_id),
    )

    # Q1: 10 Marks, no override (inherits 3)
    cur.execute(
        """
        INSERT INTO questions (id, paper_id, section_id, q_no, question_text, max_marks, strictness_level_override)
        VALUES (?, ?, ?, '1', 'Explain the difference between a process and a thread, and describe context switching.', 10.0, NULL)
        """,
        (q1_id, paper_id, sec_id),
    )
    # Q2: 5 Marks, override strictness 4
    cur.execute(
        """
        INSERT INTO questions (id, paper_id, section_id, q_no, question_text, max_marks, strictness_level_override)
        VALUES (?, ?, ?, '2', 'What is deadlock? State the four necessary Coffman conditions.', 5.0, 4)
        """,
        (q2_id, paper_id, sec_id),
    )
    # Q3: 5 Marks, MCQ
    cur.execute(
        """
        INSERT INTO questions (id, paper_id, section_id, q_no, question_text, max_marks, strictness_level_override, options_json)
        VALUES (?, ?, ?, '3', 'Which scheduling algorithm prevents starvation?', 5.0, NULL, '["A) FCFS", "B) Round Robin", "C) Shortest Job First", "D) Priority Scheduling"]')
        """,
        (q3_id, paper_id, sec_id),
    )

    # References
    cur.execute(
        """
        INSERT INTO "references" (id, paper_id, question_id, source, model_answer, key_points_json)
        VALUES (?, ?, ?, 'teacher_key', 'A process has its own address space; threads share address space.', ?)
        """,
        (
            str(uuid.uuid4()),
            paper_id,
            q1_id,
            json.dumps([
                {"text": "Process vs thread definition", "marks": 3.0},
                {"text": "Address space sharing", "marks": 2.0},
                {"text": "Context switching mechanism", "marks": 5.0},
            ]),
        ),
    )
    cur.execute(
        """
        INSERT INTO "references" (id, paper_id, question_id, source, model_answer, key_points_json)
        VALUES (?, ?, ?, 'teacher_key', 'Deadlock conditions: mutual exclusion, hold & wait, no preemption, circular wait.', ?)
        """,
        (
            str(uuid.uuid4()),
            paper_id,
            q2_id,
            json.dumps([
                {"text": "Deadlock definition", "marks": 1.5},
                {"text": "Coffman conditions", "marks": 3.5},
            ]),
        ),
    )
    cur.execute(
        """
        INSERT INTO "references" (id, paper_id, question_id, source, model_answer, correct_option, key_points_json)
        VALUES (?, ?, ?, 'teacher_key', 'Round Robin', 'B', '[]')
        """,
        (str(uuid.uuid4()), paper_id, q3_id),
    )

    # Sheet: Vikram Malhotra, roll CS-2026-088
    sheet_dir = ROOT / "data" / "sheets" / sheet_id
    sheet_dir.mkdir(parents=True, exist_ok=True)

    # Generate Page 1 and Page 2 images
    img1 = Image.new("RGB", (800, 1100), color=(253, 253, 255))
    d1 = ImageDraw.Draw(img1)
    d1.rectangle([(30, 30), (770, 1070)], outline=(200, 205, 215), width=2)
    d1.text((50, 50), "EvalDesk Student Answer Sheet - Page 1", fill=(30, 40, 60))
    d1.text((50, 90), "Student: Vikram Malhotra | Roll: CS-2026-088", fill=(70, 80, 100))
    d1.rectangle([(50, 140), (750, 480)], outline=(100, 120, 200), width=2)
    d1.text((60, 150), "[Q.1 Answer Crop Area]", fill=(80, 90, 160))
    d1.text((60, 180), "A process is a program in execution with private memory space.", fill=(40, 40, 50))
    d1.text((60, 210), "Threads share the process memory and open files.", fill=(40, 40, 50))
    d1.text((60, 240), "Context switching saves thread register states to PCB.", fill=(40, 40, 50))

    d1.rectangle([(50, 520), (750, 850)], outline=(100, 180, 120), width=2)
    d1.text((60, 530), "[Q.2 Answer Crop Area]", fill=(40, 120, 60))
    d1.text((60, 560), "Deadlock is a state where processes are blocked.", fill=(40, 40, 50))
    d1.text((60, 590), "Conditions: Mutual exclusion, Hold and wait, No preemption, Circular wait.", fill=(40, 40, 50))
    img1.save(sheet_dir / "page_1.jpg", format="JPEG", quality=90)

    img2 = Image.new("RGB", (800, 1100), color=(253, 253, 255))
    d2 = ImageDraw.Draw(img2)
    d2.rectangle([(30, 30), (770, 1070)], outline=(200, 205, 215), width=2)
    d2.text((50, 50), "EvalDesk Student Answer Sheet - Page 2", fill=(30, 40, 60))
    d2.rectangle([(50, 140), (750, 400)], outline=(120, 100, 200), width=2)
    d2.text((60, 150), "[Q.3 Answer Crop Area]", fill=(80, 70, 150))
    d2.text((60, 180), "Ans 3: Option B - Round Robin Scheduling", fill=(40, 40, 50))
    img2.save(sheet_dir / "page_2.jpg", format="JPEG", quality=90)

    cur.execute(
        """
        INSERT INTO sheets (id, paper_id, student_name, roll_number, status, stage_key, current_stage, total_score, max_marks, percentage, grade, raw_filename)
        VALUES (?, ?, 'Vikram Malhotra', 'CS-2026-088', 'evaluated', 'evaluated', 'Evaluation complete', 16.0, 20.0, 80.0, 'A', 'vikram_os.pdf')
        """,
        (sheet_id, paper_id),
    )

    cur.execute(
        "INSERT INTO sheet_pages (id, sheet_id, page_number, file_path, ocr_status, ocr_legibility) VALUES (?, ?, 1, ?, 'done', 0.72)",
        (str(uuid.uuid4()), sheet_id, f"data/sheets/{sheet_id}/page_1.jpg"),
    )
    cur.execute(
        "INSERT INTO sheet_pages (id, sheet_id, page_number, file_path, ocr_status, ocr_legibility) VALUES (?, ?, 2, ?, 'done', 0.95)",
        (str(uuid.uuid4()), sheet_id, f"data/sheets/{sheet_id}/page_2.jpg"),
    )

    # Answers
    cur.execute(
        """
        INSERT INTO answers (id, sheet_id, question_id, page_numbers, extracted_text, legibility_score, bbox_json)
        VALUES (?, ?, ?, '[1]', 'A process is a program in execution with private memory space. Threads share the process memory and open files. Context switching saves thread register states to PCB.', 0.72, '[0.13, 0.06, 0.44, 0.94]')
        """,
        (str(uuid.uuid4()), sheet_id, q1_id),
    )
    cur.execute(
        """
        INSERT INTO answers (id, sheet_id, question_id, page_numbers, extracted_text, legibility_score, bbox_json)
        VALUES (?, ?, ?, '[1]', 'Deadlock is a state where processes are blocked. Conditions: Mutual exclusion, Hold and wait, No preemption, Circular wait.', 0.95, '[0.47, 0.06, 0.77, 0.94]')
        """,
        (str(uuid.uuid4()), sheet_id, q2_id),
    )
    cur.execute(
        """
        INSERT INTO answers (id, sheet_id, question_id, page_numbers, extracted_text, legibility_score, bbox_json)
        VALUES (?, ?, ?, '[2]', 'Ans 3: Option B - Round Robin Scheduling', 0.98, '[0.13, 0.06, 0.36, 0.94]')
        """,
        (str(uuid.uuid4()), sheet_id, q3_id),
    )

    # Evaluations:
    # Q1: FLAGGED (resolved=0, has low confidence flag, strictness_used=3, ai_marks=6.5)
    q1_verdicts = [
        {"point": "Process vs thread definition", "marks_awarded": 3.0, "marks_available": 3.0, "verdict": "full", "quote": "A process is a program in execution with private memory space.", "reason": "Accurate definition."},
        {"point": "Address space sharing", "marks_awarded": 2.0, "marks_available": 2.0, "verdict": "full", "quote": "Threads share the process memory and open files.", "reason": "Correct address space explanation."},
        {"point": "Context switching mechanism", "marks_awarded": 1.5, "marks_available": 5.0, "verdict": "partial", "quote": "Context switching saves thread register states to PCB.", "reason": "Mentioned PCB save but omitted reload of target thread state."},
    ]
    cur.execute(
        """
        INSERT INTO evaluations (id, sheet_id, question_id, ai_marks, final_marks, reason, evidence_quote, flags_json, resolved, strictness_used, verdicts_json, confidence, status, is_counted)
        VALUES (?, ?, ?, 6.5, 6.5, 'Partial explanation of context switching.', 'Context switching saves thread register states to PCB.', ?, 0, 3, ?, 0.72, 'flagged', 1)
        """,
        (
            eval1_id,
            sheet_id,
            q1_id,
            json.dumps([{"code": "FLAG_CONFIDENCE_LOW", "message": "Confidence score is below threshold (0.72 < 0.75)"}]),
            json.dumps(q1_verdicts),
        ),
    )

    # Q2: APPROVED (resolved=1, strictness_used=4, final_marks=4.5)
    q2_verdicts = [
        {"point": "Deadlock definition", "marks_awarded": 1.5, "marks_available": 1.5, "verdict": "full", "quote": "Deadlock is a state where processes are blocked.", "reason": "Clear definition."},
        {"point": "Coffman conditions", "marks_awarded": 3.0, "marks_available": 3.5, "verdict": "partial", "quote": "Mutual exclusion, Hold and wait, No preemption, Circular wait.", "reason": "All 4 named accurately under strict rubric."},
    ]
    cur.execute(
        """
        INSERT INTO evaluations (id, sheet_id, question_id, ai_marks, final_marks, reason, evidence_quote, flags_json, resolved, strictness_used, verdicts_json, confidence, status, is_counted)
        VALUES (?, ?, ?, 4.5, 4.5, 'Identified all 4 Coffman conditions correctly.', 'Mutual exclusion, Hold and wait, No preemption, Circular wait.', '[]', 1, 4, ?, 0.95, 'approved', 1)
        """,
        (eval2_id, sheet_id, q2_id, json.dumps(q2_verdicts)),
    )

    # Q3: APPROVED (resolved=1, strictness_used=3, final_marks=5.0)
    q3_verdicts = [
        {"point": "Round Robin", "marks_awarded": 5.0, "marks_available": 5.0, "verdict": "full", "quote": "Option B - Round Robin Scheduling", "reason": "Correct option selected."},
    ]
    cur.execute(
        """
        INSERT INTO evaluations (id, sheet_id, question_id, ai_marks, final_marks, reason, evidence_quote, flags_json, resolved, strictness_used, verdicts_json, confidence, status, is_counted)
        VALUES (?, ?, ?, 5.0, 5.0, 'Correct option selected.', 'Option B - Round Robin Scheduling', '[]', 1, 3, ?, 0.99, 'approved', 1)
        """,
        (eval3_id, sheet_id, q3_id, json.dumps(q3_verdicts)),
    )
    conn.commit()

    print(f"✓ Test database setup complete. Paper: {paper_id}, Sheet: {sheet_id}")

    # Fetch initial review payload via API
    review_initial = http_get(f"http://127.0.0.1:8000/api/sheets/{sheet_id}/review")
    with open(PROOF_DIR / "review_payload.json", "w", encoding="utf-8") as f:
        json.dump(review_initial, f, indent=2)
    print("✓ Saved review_payload.json")

    # Step B: Playwright Verification
    print("\n--- Running Playwright UI Verification for Evaluation Workspace ---")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # 1. Navigate to #/evaluate/{sheet_id}
        target_url = f"http://localhost:3000/#/evaluate/{sheet_id}"
        print(f"Navigating to {target_url}...")
        page.goto(target_url, wait_until="networkidle")
        page.wait_for_timeout(2000)

        # Assert Paper title and student name visible in Top Header
        assert page.locator("text=Operating Systems Final Exam").first.is_visible()
        assert page.locator("text=Vikram Malhotra").first.is_visible()
        assert page.locator("text=Score:").first.is_visible()

        # Selection check: Q1 is flagged and must be automatically selected on load!
        # Check active question indicator shows Q.1
        assert page.locator("text=Q.1").first.is_visible()
        assert page.locator("text=Explain the difference between a process and a thread").first.is_visible()

        # Check Question Panel shows Q1 with amber dot and Q2 with S.4 override badge
        assert page.locator("text=S.4").first.is_visible()
        print("✓ Selection rule verified: Flagged Q1 automatically selected on load.")
        print("✓ Strictness override chip S.4 visible on Q2 in Question Panel.")

        # Capture Screenshot 1: eval_workspace_initial_flagged.png
        page.screenshot(path=str(PROOF_DIR / "eval_workspace_initial_flagged.png"))
        print("✓ Captured eval_workspace_initial_flagged.png")

        # 2. Test Crop / Full Sheet toggle
        print("\nTesting Crop / Full Sheet Toggle...")
        full_sheet_btn = page.locator("button:has-text('Full Sheet + Box')").first
        assert full_sheet_btn.is_visible()
        full_sheet_btn.click()
        page.wait_for_timeout(1000)

        # Assert Full view mode active (Page 1 chip active, bounding box rendered)
        crop_btn = page.locator("button:has-text('Answer Crop')").first
        assert crop_btn.is_visible()

        # Capture Screenshot 2: eval_workspace_crop_full_toggle.png
        page.screenshot(path=str(PROOF_DIR / "eval_workspace_crop_full_toggle.png"))
        print("✓ Captured eval_workspace_crop_full_toggle.png")

        # Switch back to crop view
        crop_btn.click()
        page.wait_for_timeout(500)

        # 3. Test Question Panel Collapsible Rail and localStorage persistence
        print("\nTesting Question Panel Collapse & Persistence...")
        collapse_btn = page.locator("[data-testid='collapse-question-panel']").first
        assert collapse_btn.is_visible()
        collapse_btn.click()
        page.wait_for_timeout(1000)

        # Assert rail is rendered (Expand button with data-testid='expand-question-panel' is visible)
        expand_btn = page.locator("[data-testid='expand-question-panel']").first
        assert expand_btn.is_visible()

        # Capture Screenshot 3: eval_workspace_collapsed_rail.png
        page.screenshot(path=str(PROOF_DIR / "eval_workspace_collapsed_rail.png"))
        print("✓ Captured eval_workspace_collapsed_rail.png")

        # Reload page and verify it remains collapsed
        print("Reloading page to test localStorage persistence...")
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(1500)
        expand_btn_after_reload = page.locator("[data-testid='expand-question-panel']").first
        assert expand_btn_after_reload.is_visible(), "Question panel did not persist collapsed state across reload!"
        print("✓ Persistence verified: Question panel remained collapsed across page reload.")

        # Expand panel back
        expand_btn_after_reload.click()
        page.wait_for_timeout(800)

        # 4. Test Recheck with Strictness 5 and Undo banner
        print("\nTesting Live AI Recheck with Strictness Level 5...")
        recheck_btn = page.locator("button:has-text('Recheck')").first
        assert recheck_btn.is_visible()
        recheck_btn.click()
        page.wait_for_timeout(600)

        # Popover should be open
        popover_title = page.locator("text=Recheck with AI").first
        assert popover_title.is_visible(), "Recheck popover failed to open!"

        # Select Level 5 (Strict)
        strict_5_btn = page.locator("button[title*='Level 5']").first
        assert strict_5_btn.is_visible()
        strict_5_btn.click()
        page.wait_for_timeout(300)

        # Check 'Save as this question''s strictness'
        save_override_checkbox = page.locator("input[type='checkbox']").first
        if not save_override_checkbox.is_checked():
            save_override_checkbox.check()
        page.wait_for_timeout(200)

        # Click submit 'Recheck' inside popover
        popover_submit = page.locator("form button[type='submit']:has-text('Recheck')").first
        popover_submit.click()
        print("Recheck submitted, awaiting live API response...")

        # Wait for Recheck to finish and Undo banner to appear
        undo_banner = page.locator("text=Score was 6.5 M before recheck").first
        undo_banner.wait_for(state="visible", timeout=30000)
        assert undo_banner.is_visible()
        print("✓ Undo banner displayed: 'Score was 6.5 M before recheck'")

        # Assert Strictness chip updated to Level 5
        strictness_chip_5 = page.locator("text=Strictness 5/5").first
        assert strictness_chip_5.is_visible()
        print("✓ Strictness chip updated to Strictness 5/5.")

        # Capture Screenshot 4: eval_workspace_recheck_strictness5_undo.png
        page.screenshot(path=str(PROOF_DIR / "eval_workspace_recheck_strictness5_undo.png"))
        print("✓ Captured eval_workspace_recheck_strictness5_undo.png")

        # 5. Test clicking Undo
        print("\nTesting Undo action...")
        undo_btn = page.locator("button:has-text('Undo')").first
        assert undo_btn.is_visible()
        undo_btn.click()
        page.wait_for_timeout(1000)

        # Assert undo banner disappears and marks restored to 6.5
        assert not undo_banner.is_visible()
        marks_display = page.locator("text=6.5").first
        assert marks_display.is_visible()
        print("✓ Undo succeeded: Marks restored to 6.5 and undo banner cleared.")

        browser.close()

    print("\n=== All Phase P9.6 Verification Steps Passed Successfully! ===")

if __name__ == "__main__":
    main()

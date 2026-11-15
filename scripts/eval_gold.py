#!/usr/bin/env python3
"""
EvalDesk AI — Gold Accuracy Evaluation Script
Compares automated AI grading marks against gold teacher marks.
Computes Mean Absolute Error (MAE), % within 0.5 marks, flag precision, and recall.
"""
import os
import sys
import json
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

GOLD_DIR = BASE_DIR / "gold"
DB_PATH = BASE_DIR / "data" / "app.db"


def evaluate_against_gold():
    if not GOLD_DIR.exists():
        print(f"Gold directory not found: {GOLD_DIR}")
        return

    gold_files = list(GOLD_DIR.glob("*.json"))
    if not gold_files:
        print("No gold files found in gold/")
        return

    if not DB_PATH.exists():
        print(f"Database not found: {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    all_diffs = []
    within_half_mark_count = 0
    total_questions = 0
    flagged_wrong_count = 0
    total_wrong_count = 0
    auto_accepted_correct_count = 0
    total_auto_accepted_count = 0

    print("=" * 80)
    print("EVALDESK AI — GOLD STANDARD MARKING ACCURACY REPORT")
    print("=" * 80)

    for gold_file in gold_files:
        with open(gold_file, "r", encoding="utf-8") as f:
            gold_data = json.load(f)

        student_name = gold_data.get("student_name", "")
        roll_number = gold_data.get("roll_number", "")
        gold_marks = gold_data.get("marks", {})

        # Find matching sheet in DB
        cursor.execute(
            """
            SELECT id, student_name, roll_number, total_score, max_marks
            FROM sheets
            WHERE student_name LIKE ? OR roll_number = ?
            ORDER BY created_at DESC LIMIT 1
            """,
            (f"%{student_name}%", str(roll_number)),
        )
        sheet = cursor.fetchone()

        if not sheet:
            print(f"[-] No evaluated sheet found matching gold record: {student_name} ({roll_number})")
            continue

        sheet_id = sheet["id"]
        print(f"\nEvaluating Sheet: {sheet['student_name']} (Roll: {sheet['roll_number']}) [ID: {sheet_id[:8]}...]")
        print("-" * 80)
        print(f"{'Q #':<6} | {'Max':<5} | {'Gold':<6} | {'AI':<6} | {'Diff':<6} | {'Verdict / Status':<20} | {'Flags'}")
        print("-" * 80)

        cursor.execute(
            """
            SELECT q.q_no, q.max_marks, e.ai_marks, e.final_marks, e.resolved, e.flags_json, e.reason
            FROM evaluations e
            JOIN questions q ON e.question_id = q.id
            WHERE e.sheet_id = ?
            ORDER BY q.order_idx ASC
            """,
            (sheet_id,),
        )
        evals = cursor.fetchall()

        for ev in evals:
            q_no = str(ev["q_no"])
            max_m = float(ev["max_marks"])
            ai_m = float(ev["final_marks"])
            flags = json.loads(ev["flags_json"] or "[]")
            resolved = bool(ev["resolved"])

            if q_no not in gold_marks:
                continue

            gold_m = float(gold_marks[q_no])
            diff = abs(ai_m - gold_m)
            all_diffs.append(diff)
            total_questions += 1

            if diff <= 0.5:
                within_half_mark_count += 1

            is_wrong_answer = (gold_m < max_m * 0.7)
            is_flagged = len(flags) > 0

            if is_wrong_answer:
                total_wrong_count += 1
                if is_flagged:
                    flagged_wrong_count += 1

            if not is_flagged:
                total_auto_accepted_count += 1
                if not is_wrong_answer:
                    auto_accepted_correct_count += 1

            status_desc = "Auto-Accepted" if not is_flagged else "FLAGGED"
            flag_desc = "; ".join(flags[:2]) if flags else "None"
            print(f"Q.{q_no:<4} | {max_m:<5.1f} | {gold_m:<6.1f} | {ai_m:<6.1f} | {diff:<6.1f} | {status_desc:<20} | {flag_desc}")

    conn.close()

    if total_questions == 0:
        print("\nNo overlapping questions found between database evaluations and gold files.")
        return

    mae = sum(all_diffs) / total_questions
    pct_within_half = (within_half_mark_count / total_questions) * 100
    flag_recall = (flagged_wrong_count / total_wrong_count * 100) if total_wrong_count > 0 else 100.0
    auto_accept_precision = (auto_accepted_correct_count / total_auto_accepted_count * 100) if total_auto_accepted_count > 0 else 100.0

    print("\n" + "=" * 80)
    print("METRICS SUMMARY")
    print("=" * 80)
    print(f"Total Evaluated Questions Compared : {total_questions}")
    print(f"Mean Absolute Error (MAE)          : {mae:.2f} marks")
    print(f"Share within 0.5 mark              : {pct_within_half:.1f}%")
    print(f"Share of wrong answers flagged     : {flag_recall:.1f}% ({flagged_wrong_count}/{total_wrong_count})")
    print(f"Auto-accept precision              : {auto_accept_precision:.1f}% ({auto_accepted_correct_count}/{total_auto_accepted_count})")
    print("=" * 80)


if __name__ == "__main__":
    evaluate_against_gold()

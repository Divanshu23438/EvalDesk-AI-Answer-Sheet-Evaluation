import pytest
from backend.marking_engine import calculate_section_choice_totals
from backend.main import generate_scoped_key

def test_scoped_key_generation():
    # Part I, II, III Q.1 should never collide
    k1 = generate_scoped_key("Part I", "Q.1", 0)
    k2 = generate_scoped_key("Part II", "Q.1", 10)
    k3 = generate_scoped_key("Part III", "Q.1", 16)
    assert k1 == "P1-Q1"
    assert k2 == "P2-Q1"
    assert k3 == "P3-Q1"
    assert len({k1, k2, k3}) == 3

    # Sub-questions in Part I
    k_sub1 = generate_scoped_key("Part I", "Q.1 (A) (i)", 0)
    k_sub2 = generate_scoped_key("Part I", "Q.1 (B) (v)", 9)
    assert k_sub1 == "P1-Q1-A-i"
    assert k_sub2 == "P1-Q1-B-v"

def test_bilingual_linux_totals_attempt_4_and_5():
    # Mock questions matching the real bilingual Linux exam
    # Part I: 10 questions (each 1M or 2M)
    part1_questions = [
        {"question_id": f"p1_{i}", "order_idx": i, "section_name": "Part I", "max_marks": 1.0, "final_marks": 1.0, "attempted": True, "resolved": True}
        for i in range(1, 11)
    ]
    # Part II: 6 questions (6 marks each). Student attempted 5 questions (all full 6.0M), 1 unattempted (0.0M)
    part2_questions = [
        {"question_id": f"p2_{i}", "order_idx": 10 + i, "section_name": "Part II", "max_marks": 6.0, "final_marks": 6.0, "attempted": True, "resolved": True}
        for i in range(1, 6)
    ] + [
        {"question_id": "p2_6", "order_idx": 16, "section_name": "Part II", "max_marks": 6.0, "final_marks": 0.0, "attempted": False, "resolved": True}
    ]
    # Part III: 3 questions (10 marks each). Student attempted 2 questions (10.0M each), 1 unattempted (0.0M)
    part3_questions = [
        {"question_id": "p3_1", "order_idx": 17, "section_name": "Part III", "max_marks": 10.0, "final_marks": 0.0, "attempted": False, "resolved": True},
        {"question_id": "p3_2", "order_idx": 18, "section_name": "Part III", "max_marks": 10.0, "final_marks": 10.0, "attempted": True, "resolved": True},
        {"question_id": "p3_3", "order_idx": 19, "section_name": "Part III", "max_marks": 10.0, "final_marks": 10.0, "attempted": True, "resolved": True},
    ]

    all_questions = part1_questions + part2_questions + part3_questions

    # 1. Under attempt_n = 4 for Part II:
    sections_attempt_4 = [
        {"name": "Part I", "instructions": "All compulsory", "attempt_n": 10, "total_questions": 10, "marks_each": 1.0, "section_marks": 10.0, "policy": "best_n"},
        {"name": "Part II", "instructions": "Attempt any four", "attempt_n": 4, "total_questions": 6, "marks_each": 6.0, "section_marks": 24.0, "policy": "best_n"},
        {"name": "Part III", "instructions": "Attempt any two", "attempt_n": 2, "total_questions": 3, "marks_each": 10.0, "section_marks": 20.0, "policy": "best_n"},
    ]

    res_4 = calculate_section_choice_totals(all_questions, sections_attempt_4, paper_max_marks=60.0)
    # Effective max marks: 10*1 + 4*6 + 2*10 = 54 marks!
    assert res_4["effective_max_marks"] == 54.0
    # Score: Part I (10) + Part II (4*6 = 24) + Part III (2*10 = 20) = 54.0
    assert res_4["total_score"] == 54.0
    # Exactly one Part II attempted question must be marked not counted
    p2_counted = [q for q in res_4["questions"] if q["section_name"] == "Part II" and q["is_counted"]]
    p2_uncounted = [q for q in res_4["questions"] if q["section_name"] == "Part II" and not q["is_counted"]]
    assert len(p2_counted) == 4
    assert len(p2_uncounted) == 2  # 1 unattempted + 1 extra attempted

    # 2. Under attempt_n = 5 for Part II:
    sections_attempt_5 = [
        {"name": "Part I", "instructions": "All compulsory", "attempt_n": 10, "total_questions": 10, "marks_each": 1.0, "section_marks": 10.0, "policy": "best_n"},
        {"name": "Part II", "instructions": "Attempt any five", "attempt_n": 5, "total_questions": 6, "marks_each": 6.0, "section_marks": 30.0, "policy": "best_n"},
        {"name": "Part III", "instructions": "Attempt any two", "attempt_n": 2, "total_questions": 3, "marks_each": 10.0, "section_marks": 20.0, "policy": "best_n"},
    ]

    res_5 = calculate_section_choice_totals(all_questions, sections_attempt_5, paper_max_marks=60.0)
    # Effective max marks: 10*1 + 5*6 + 2*10 = 60 marks!
    assert res_5["effective_max_marks"] == 60.0
    # Score: Part I (10) + Part II (5*6 = 30) + Part III (2*10 = 20) = 60.0
    assert res_5["total_score"] == 60.0
    p2_counted_5 = [q for q in res_5["questions"] if q["section_name"] == "Part II" and q["is_counted"]]
    assert len(p2_counted_5) == 5

def test_contradiction_warning_detection():
    # If instructions say attempt 4 of 6 marks = 24 marks, but section marks is 30:
    sec = {
        "name": "Part II",
        "instructions": "Attempt any four questions",
        "attempt_n": 4,
        "total_questions": 6,
        "marks_each": 6.0,
        "section_marks": 30.0,
    }
    calc_marks = round(sec["attempt_n"] * sec["marks_each"], 2)
    assert abs(calc_marks - sec["section_marks"]) > 0.01
    warning = (
        f"Contradiction in {sec['name']}: '{sec['instructions']}' states attempt {sec['attempt_n']} questions "
        f"at {sec['marks_each']:g} marks each (= {calc_marks:g} marks), but section marks is listed as {sec['section_marks']:g} marks."
    )
    assert "Contradiction in Part II" in warning
    assert "24 marks" in warning
    assert "30 marks" in warning

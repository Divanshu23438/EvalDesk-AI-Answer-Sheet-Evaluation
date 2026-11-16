import pytest
from pathlib import Path
from backend.marking_engine import (
    evaluate_mcq_or_one_word,
    verify_evidence_quote,
    build_task_t6_grading_prompt,
    check_command_tokens,
)
from backend.reports_generator import (
    format_q_number,
    generate_student_report_card_pdf,
)

def test_mcq_deterministic_grading_variations():
    # 1. Option text only against bilingual option key
    res1 = evaluate_mcq_or_one_word("Operating System", "B) Operating system / ऑपरेटिंग सिस्टम", 1.0)
    assert res1["marks"] == 1.0
    assert res1["verdict"] == "full"
    assert res1["reason"] == "Correct option selected"

    # 2. Option letter only
    res2 = evaluate_mcq_or_one_word("C", "C) pwd", 1.0)
    assert res2["marks"] == 1.0
    assert res2["reason"] == "Correct option selected"

    # 3. Option letter in parens
    res3 = evaluate_mcq_or_one_word("(C)", "C) pwd", 1.0)
    assert res3["marks"] == 1.0
    assert res3["reason"] == "Correct option selected"

    # 4. Command text match
    res4 = evaluate_mcq_or_one_word("pwd", "C) pwd", 1.0)
    assert res4["marks"] == 1.0
    assert res4["reason"] == "Correct option selected"

    # 5. Sentence text match with trailing period
    res5 = evaluate_mcq_or_one_word(
        "Stores command search directories.",
        "C) Stores command search directories / कमांड खोजने के पथ स्टोर करता है",
        1.0,
    )
    assert res5["marks"] == 1.0
    assert res5["reason"] == "Correct option selected"

    # 6. Special symbol match (..)
    res6 = evaluate_mcq_or_one_word("..", "B) ..", 1.0)
    assert res6["marks"] == 1.0
    assert res6["reason"] == "Correct option selected"

    # 7. Unattempted
    res_un = evaluate_mcq_or_one_word("", "B) ..", 1.0)
    assert res_un["marks"] == 0.0
    assert "not_attempted" in res_un["flags"]

    # 8. Incorrect answer
    res_wrong = evaluate_mcq_or_one_word("cd", "C) pwd", 1.0)
    assert res_wrong["marks"] == 0.0
    assert "Incorrect option selected" in res_wrong["reason"]

def test_quote_verification_robustness():
    student_text = """Internal Commands:-
Internal Commands are built inside shell.
Eg - A phone calculator it runs internally.

Commands likes ls, pwd are built inside shell.

External Commands:-
External Commands are saved in the file system.
Eg - YouTube application is a file it takes time to run.

Commands like date, cal are external commands."""

    # Exact substring
    assert verify_evidence_quote("Internal Commands are built inside shell", student_text) is True

    # Trailing period and capitalization variations
    assert verify_evidence_quote("Internal Commands are built inside shell.", student_text) is True
    assert verify_evidence_quote("internal commands are built inside shell", student_text) is True

    # Punctuation in text vs quote
    assert verify_evidence_quote("Internal Commands: Internal Commands are built inside shell.", student_text) is True

    # Multi-clause semicolon / newline separated quote
    multi_clause = "Internal Commands are built inside shell. ; External Commands are saved in the file system."
    assert verify_evidence_quote(multi_clause, student_text) is True

    # Fuzzy match with slight variation
    assert verify_evidence_quote("Internal Commands are built inside the shell", student_text) is True

    # Fabricated / hallucinated quote
    assert verify_evidence_quote("Quantum entanglement in UNIX filesystem", student_text) is False

def test_t6_grading_prompt_principles():
    prompt = build_task_t6_grading_prompt(
        question_text="Write any four features of UNIX with examples.",
        max_marks=6.0,
        key_points=[
            {"text": "Feature 1: Multi-user", "marks": 1.5},
            {"text": "Feature 2: Multi-tasking", "marks": 1.5},
        ],
        student_text="Security and Open Source with ATM example",
    )
    assert "OPEN-ENDED QUESTIONS" in prompt
    assert "any N features" in prompt
    assert "CONCEPTUAL ACCURACY" in prompt
    assert "bridge between user and kernel" in prompt

def test_format_q_number_cleans_prefixes():
    assert format_q_number("Q.1 (A) (i)") == "Q.1 (A) (i)"
    assert format_q_number("1 (A) (i)") == "Q.1 (A) (i)"
    assert format_q_number("Q.Q.1 (A) (i)") == "Q.1 (A) (i)"
    assert format_q_number("Q.3") == "Q.3"
    assert format_q_number("3") == "Q.3"
    assert format_q_number("q.4") == "Q.4"

def test_report_card_pdf_generation_with_not_attempted(tmp_path):
    pdf_out = tmp_path / "test_report.pdf"
    questions = [
        {
            "q_no": "Q.1 (A) (i)",
            "final_marks": 1.0,
            "max_marks": 1.0,
            "reason": "Correct option selected",
            "evidence_quote": "Operating System",
            "attempted": True,
        },
        {
            "q_no": "Q.Q.6",
            "final_marks": 0.0,
            "max_marks": 6.0,
            "reason": "Question not attempted.",
            "evidence_quote": "",
            "attempted": False,
            "flags": ["not_attempted"],
        },
    ]

    generate_student_report_card_pdf(
        output_path=pdf_out,
        student_name="Kanak Patel",
        roll_number="SGSU250489",
        paper_title="UNIX Fundamentals",
        questions=questions,
        total_score=1.0,
        max_marks=7.0,
        percentage=14.3,
        grade="Needs Support",
        strengths=["Demonstrated understanding of OS concepts."],
        improvements=["Attempt all questions."],
    )

    assert pdf_out.exists()
    assert pdf_out.stat().st_size > 1000

def test_check_command_tokens_detects_ch_instead_of_cd():
    # 1. Detects 'ch directoryname' from student answer
    text1 = """-> To see inside the directory
- ch directoryname Eg - cd Linux"""
    res1 = check_command_tokens(text1, question_text="Explain directory management in UNIX.")
    assert res1["valid"] is False
    assert "Command syntax mismatch: wrote 'ch' instead of 'cd'" in res1["flags"]
    assert res1["penalty_marks"] == 1.0

    # 2. Detects 'ch ..'
    text2 = "cd home then ch .. to go back"
    res2 = check_command_tokens(text2, question_text="Explain navigating directories")
    assert res2["valid"] is False
    assert "Command syntax mismatch: wrote 'ch' instead of 'cd'" in res2["flags"]

    # 3. Clean when student writes valid commands
    text3 = """mkdir mydir
cd mydir
pwd
ls -l
rmdir mydir"""
    res3 = check_command_tokens(text3, question_text="Explain directory management in UNIX.")
    assert res3["valid"] is True
    assert len(res3["flags"]) == 0
    assert res3["penalty_marks"] == 0.0

    # 4. Valid chmod/chown is not misidentified as 'ch'
    text4 = "chmod 755 script.sh and chown user:group file"
    res4 = check_command_tokens(text4, question_text="File permissions in UNIX")
    assert res4["valid"] is True
    assert len(res4["flags"]) == 0

def test_rubric_accept_reject_in_prompt():
    prompt = build_task_t6_grading_prompt(
        question_text="Explain directory management in UNIX.",
        max_marks=10.0,
        key_points=[
            {
                "text": "Directory navigation commands",
                "marks": 2.0,
                "accept_if": "Must use real UNIX commands (cd, pwd) with valid paths",
                "reject_if": "Everyday analogies or invalid command syntax earn zero or partial marks",
            }
        ],
        student_text="Use ch dirname to navigate",
    )
    assert "accept_if: Must use real UNIX commands" in prompt
    assert "reject_if: Everyday analogies" in prompt
    assert "Real-life analogies without valid OS examples earn at most 50%" in prompt

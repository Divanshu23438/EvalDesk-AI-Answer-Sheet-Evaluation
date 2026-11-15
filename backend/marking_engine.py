import re
import difflib
from typing import Dict, Any, List, Optional, Tuple

def verify_evidence_quote(quote: str, full_text: str) -> bool:
    """
    Verifies that the quoted evidence string actually exists in the student's text.
    Uses normalized whitespace and case-insensitive substring search.
    """
    if not quote or not full_text:
        return False
    norm_quote = re.sub(r"\s+", " ", quote.strip().lower())
    norm_text = re.sub(r"\s+", " ", full_text.strip().lower())
    if norm_quote in norm_text:
        return True
    # Allow minor OCR fuzzy match (similarity > 0.85 for the quote segment)
    if len(norm_quote) > 10:
        words = norm_quote.split()
        q_len = len(words)
        text_words = norm_text.split()
        for i in range(len(text_words) - q_len + 1):
            window = " ".join(text_words[i : i + q_len])
            if difflib.SequenceMatcher(None, norm_quote, window).ratio() >= 0.85:
                return True
    return False

def round_to_half_step(val: float) -> float:
    return round(val * 2) / 2.0

def evaluate_mcq_or_one_word(
    student_text: str,
    key_text: str,
    max_marks: float,
    negative_marking: bool = False,
    negative_penalty: float = 0.25,
) -> Dict[str, Any]:
    norm_student = student_text.strip().lower()
    norm_key = key_text.strip().lower()

    if not norm_student:
        return {
            "marks": 0.0,
            "verdict": "none",
            "reason": "Not attempted",
            "evidence": "",
            "quote_valid": True,
            "flags": ["Answer missing or unattempted"],
        }

    is_correct = norm_student == norm_key or norm_student.startswith(f"({norm_key})") or norm_student.startswith(f"{norm_key}.")
    if is_correct:
        return {
            "marks": max_marks,
            "verdict": "full",
            "reason": f"Exact match with answer key ('{key_text}')",
            "evidence": student_text.strip(),
            "quote_valid": True,
            "flags": [],
        }
    else:
        deduction = negative_penalty if negative_marking else 0.0
        awarded = max(0.0, -deduction)
        return {
            "marks": awarded,
            "verdict": "none",
            "reason": f"Incorrect answer (expected '{key_text}')",
            "evidence": student_text.strip(),
            "quote_valid": True,
            "flags": [],
        }

def evaluate_rubric_point(
    point_text: str,
    allocated_marks: float,
    student_text: str,
    judgment_primary: Dict[str, Any],
    judgment_secondary: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    flags = []
    quote = judgment_primary.get("evidence", "").strip()
    reason = judgment_primary.get("reason", "").strip()
    verdict = judgment_primary.get("verdict", "none").lower()

    # 1. Verify that quote actually occurs in the student's extracted text
    quote_valid = verify_evidence_quote(quote, student_text)
    if not quote_valid and verdict in ["full", "partial"]:
        flags.append("Evidence quote not found in extracted text")
        verdict = "none"
        reason = "Rejected: AI quoted evidence that does not appear in the student's text."

    # 2. Compute marks from verdict
    if verdict == "full":
        marks = allocated_marks
    elif verdict == "partial":
        marks = round_to_half_step(allocated_marks * 0.5)
    else:
        marks = 0.0

    # 3. Agreement check with second judge if available
    if judgment_secondary:
        sec_verdict = judgment_secondary.get("verdict", "").lower()
        if sec_verdict != verdict:
            flags.append(f"Graders disagree on key point ('{verdict}' vs '{sec_verdict}')")

    return {
        "point": point_text,
        "max_marks": allocated_marks,
        "awarded_marks": marks,
        "verdict": verdict,
        "reason": reason,
        "evidence": quote,
        "quote_valid": quote_valid,
        "flags": flags,
    }

def calculate_section_choice_totals(
    questions: List[Dict[str, Any]],
    sections: List[Dict[str, Any]],
    paper_max_marks: float,
) -> Dict[str, Any]:
    """
    Enforces 'Attempt any N questions' choice rules per section:
    Counts the top N highest-scoring answers, marking unattempted/extra questions cleanly.
    """
    total_score = 0.0
    evaluated_questions = []

    # Map questions to sections
    sec_map: Dict[str, List[Dict[str, Any]]] = {}
    for q in questions:
        sec = q.get("section_name", "General")
        sec_map.setdefault(sec, []).append(q)

    for sec_name, q_list in sec_map.items():
        sec_rule = next((s for s in sections if s.get("section_name", "").lower() == sec_name.lower()), None)
        attempt_limit = sec_rule.get("attempt_limit", len(q_list)) if sec_rule else len(q_list)

        # Sort attempted questions by marks descending
        attempted = [q for q in q_list if q.get("attempted", False)]
        unattempted = [q for q in q_list if not q.get("attempted", False)]

        attempted.sort(key=lambda x: x.get("final_marks", 0.0), reverse=True)

        is_choice = len(q_list) > attempt_limit

        for i, q in enumerate(attempted):
            if is_choice and i >= attempt_limit:
                q["is_counted"] = False
                q["status_label"] = "Optional / Extra — Not Counted"
            else:
                q["is_counted"] = True
                q["status_label"] = "Checked" if q.get("resolved", True) else "Flagged for Review"
                total_score += q.get("final_marks", 0.0)
            evaluated_questions.append(q)

        for q in unattempted:
            q["is_counted"] = False
            q["final_marks"] = 0.0
            q["status_label"] = "Optional — Not Attempted" if is_choice else "Unattempted (0 Marks)"
            q["resolved"] = True
            evaluated_questions.append(q)

    percentage = min(100.0, round((total_score / (paper_max_marks or 1.0)) * 100.0, 1))
    grade = "A+" if percentage >= 90 else "A" if percentage >= 80 else "B" if percentage >= 70 else "C" if percentage >= 60 else "Needs Support"

    return {
        "total_score": round_to_half_step(total_score),
        "paper_max_marks": paper_max_marks,
        "percentage": percentage,
        "grade": grade,
        "questions": evaluated_questions,
    }

import pytest
from backend.strictness import (
    resolve_level,
    TAU_FLAG,
    PARTIAL_FACTOR,
    TIER_NAMES,
    extract_question_anchors,
    confidence_gate,
    ai_draft_guardrail,
    build_strictness_instructions,
    calculate_overall_confidence,
)

def test_resolve_level():
    assert resolve_level(None, 3) == (3, "paper")
    assert resolve_level(None, None) == (3, "paper")
    assert resolve_level(5, 2) == (5, "question")
    assert resolve_level(1, 5) == (1, "question")
    assert resolve_level("lenient", 5) == (1, "question")
    assert resolve_level("strict", 1) == (5, "question")
    assert resolve_level(None, "strict") == (5, "paper")
    assert resolve_level(None, "supportive") == (2, "paper")
    assert resolve_level(None, "rigorous") == (4, "paper")


def test_tau_and_partial_constants():
    assert TAU_FLAG == {1: 0.45, 2: 0.55, 3: 0.70, 4: 0.80, 5: 0.88}
    assert PARTIAL_FACTOR == {1: 0.75, 2: 0.65, 3: 0.50, 4: 0.40, 5: 0.25}
    assert TIER_NAMES[1] == "Lenient"
    assert TIER_NAMES[5] == "Strict"


@pytest.mark.parametrize("level", [1, 2, 3, 4, 5])
@pytest.mark.parametrize("has_key", [True, False])
def test_build_strictness_instructions_table(level, has_key):
    instr = build_strictness_instructions(level, subject_domain="cs_it", has_teacher_key=has_key)
    assert f"LEVEL {level}" in instr
    assert TIER_NAMES[level].upper() in instr
    assert f"{TAU_FLAG[level]}" in instr

    # Must contain no hardcoded example answers or example marks
    for banned in ["Linux kernel", "chmod 777", "Sarah", "Sample answer"]:
        assert banned not in instr

    if not has_key:
        assert "no_teacher_key_keyword" in instr
        assert "SAFEGUARD (NO TEACHER ANSWER KEY UPLOADED)" in instr


def test_extract_question_anchors_english():
    q1 = "Explain any 4 process states in an Operating System."
    a1 = extract_question_anchors(q1)
    assert a1["explicit_count"] == 4
    assert "explain" in a1["action_verbs"]

    q2 = "State 3 differences between a mutex and a semaphore."
    a2 = extract_question_anchors(q2)
    assert a2["explicit_count"] == 3
    assert "state" in a2["action_verbs"]
    assert any(x in a2["action_verbs"] for x in ["difference", "differences", "differentiate"])

    q3 = "What is the purpose of 'fork()' and 'exec' system calls?"
    a3 = extract_question_anchors(q3)
    assert "fork()" in a3["mandatory_terms"]
    assert "exec" in a3["mandatory_terms"]


def test_extract_question_anchors_hindi():
    q = "ऑपरेटिंग सिस्टम की किन्हीं तीन विशेषताओं का वर्णन कीजिए।"
    a = extract_question_anchors(q)
    assert a["explicit_count"] == 3
    assert "वर्णन" in a["action_verbs"]


def test_confidence_gate():
    # Level 3 tau is 0.70
    assert confidence_gate(3, 0.75) is None
    assert confidence_gate(3, 0.70) is None
    gate3 = confidence_gate(3, 0.69)
    assert gate3 is not None
    assert gate3["code"] == "low_confidence"
    assert "0.69" in gate3["message"]

    # Level 1 tau is 0.45
    assert confidence_gate(1, 0.46) is None
    assert confidence_gate(1, 0.44)["code"] == "low_confidence"

    # Level 5 tau is 0.88
    assert confidence_gate(5, 0.85)["code"] == "low_confidence"
    assert confidence_gate(5, 0.89) is None


def test_ai_draft_guardrail():
    # Level 4 with AI draft: conceptual match without exact keyword must NOT get 0
    # PARTIAL_FACTOR[4] is 0.40 -> 2.0 * 0.40 = 0.80
    marks, verdict, flag = ai_draft_guardrail(
        level=4,
        source="ai_draft",
        concept_present=True,
        keyword_present=False,
        marks_available=2.0
    )
    assert marks == 0.80
    assert verdict == "partial"
    assert flag is not None
    assert flag["code"] == "no_teacher_key_keyword"
    assert flag["message"] == "No Teacher Answer Key uploaded: verify whether student's phrasing satisfies Level 4 terminology requirements."

    # Level 5 with AI draft: PARTIAL_FACTOR[5] is 0.25 -> 4.0 * 0.25 = 1.00
    marks5, verdict5, flag5 = ai_draft_guardrail(
        level=5,
        source="ai_draft",
        concept_present=True,
        keyword_present=False,
        marks_available=4.0
    )
    assert marks5 == 1.00
    assert verdict5 == "partial"
    assert flag5 is not None
    assert flag5["code"] == "no_teacher_key_keyword"
    assert "Level 5" in flag5["message"]

    # Level 4 with Teacher Key: no AI draft warning flag
    marks_tk, verdict_tk, flag_tk = ai_draft_guardrail(
        level=4,
        source="teacher_key",
        concept_present=True,
        keyword_present=False,
        marks_available=2.0
    )
    assert marks_tk == 0.80
    assert verdict_tk == "partial"
    assert flag_tk is None

    # Full match: concept=True, keyword=True
    marks_full, verdict_full, flag_full = ai_draft_guardrail(
        level=4,
        source="ai_draft",
        concept_present=True,
        keyword_present=True,
        marks_available=2.0
    )
    assert marks_full == 2.0
    assert verdict_full == "full"
    assert flag_full is None

    # Off-topic: concept=False, keyword=False
    marks_none, verdict_none, flag_none = ai_draft_guardrail(
        level=4,
        source="ai_draft",
        concept_present=False,
        keyword_present=False,
        marks_available=2.0
    )
    assert marks_none == 0.0
    assert verdict_none == "none"
    assert flag_none is None


def test_calculate_overall_confidence():
    assert calculate_overall_confidence(0.9, 0.8) == 0.8
    assert calculate_overall_confidence(0.75, 0.95) == 0.75
    assert calculate_overall_confidence(None, 0.85) == 0.85
    assert calculate_overall_confidence(0.92, None) == 0.92
    assert calculate_overall_confidence(None, None) == 1.0

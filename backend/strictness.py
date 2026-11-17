"""
EvalDesk Strictness Grading Engine
Pure Python implementation of the 1-to-5 strictness scale, confidence thresholds,
partial-credit calibration, question anchor extraction, and AI draft guardrails.

Source of truth: docs/STRICTNESS_SPEC.md and docs/PLAN_UPGRADE.md Section 2 & 5.2.
"""
import re
from typing import Optional, Tuple, Dict, Any, List, Union

TAU_FLAG: Dict[int, float] = {
    1: 0.45,
    2: 0.55,
    3: 0.70,
    4: 0.80,
    5: 0.88,
}

PARTIAL_FACTOR: Dict[int, float] = {
    1: 0.75,
    2: 0.65,
    3: 0.50,
    4: 0.40,
    5: 0.25,
}

TIER_NAMES: Dict[int, str] = {
    1: "Lenient",
    2: "Supportive",
    3: "Balanced",
    4: "Rigorous",
    5: "Strict",
}

VALID_DOMAINS = {
    "general",
    "cs_it",
    "math_quant",
    "science_bio_chem",
    "humanities_law",
    "languages",
}

NUM_WORD_MAP: Dict[str, int] = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पाँच": 5,
    "पांच": 5, "छह": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
}

ACTION_VERBS = [
    "define", "list", "differentiate", "difference", "differences", "distinguish", "compare",
    "explain", "derive", "describe", "write syntax", "write",
    "illustrate", "calculate", "evaluate", "state", "discuss",
    "summarize", "prove", "mention", "name",
    "परिभाषित", "अंतर", "वर्णन", "व्याख्या", "तुलना",
    "उदाहरण", "गणना", "सिद्ध", "समझाइए", "लिखिए",
]


def resolve_level(
    question_override: Optional[Union[int, str, None]],
    paper_level: Optional[Union[int, str, None]] = 3,
) -> Tuple[int, str]:
    """
    Resolves effective 1-5 strictness level for a question.
    Returns (level: int, source: "question" | "paper").
    """
    def _to_int(val: Any) -> Optional[int]:
        if val is None or val == "":
            return None
        if isinstance(val, int) and 1 <= val <= 5:
            return val
        if isinstance(val, str):
            s = val.strip().lower()
            if s.isdigit():
                iv = int(s)
                if 1 <= iv <= 5:
                    return iv
            text_map = {
                "lenient": 1, "supportive": 2, "balanced": 3,
                "standard": 3, "rigorous": 4, "strict": 5, "maths": 3
            }
            return text_map.get(s)
        return None

    q_lvl = _to_int(question_override)
    if q_lvl is not None:
        return q_lvl, "question"

    p_lvl = _to_int(paper_level)
    if p_lvl is not None:
        return p_lvl, "paper"

    return 3, "paper"


def extract_question_anchors(question_text: str) -> Dict[str, Any]:
    """
    Extracts structural constraints directly from the question prompt text:
    - action_verbs: e.g. ["define", "differentiate"]
    - explicit_count: integer N (e.g. 4 for "any 4" or "give 2 examples")
    - mandatory_terms: explicitly quoted terms or named commands/formulas
    """
    text = question_text or ""
    text_lower = text.lower()

    # 1. Action verbs present
    found_verbs = []
    for v in ACTION_VERBS:
        if re.search(r"\b" + re.escape(v) + r"\b", text_lower):
            found_verbs.append(v)
    # Also check Hindi sub-strings
    for v in ["परिभाषित", "अंतर", "वर्णन", "व्याख्या", "तुलना", "उदाहरण", "गणना", "सिद्ध", "समझाइए", "लिखिए"]:
        if v in text and v not in found_verbs:
            found_verbs.append(v)

    # 2. Explicit count N
    explicit_count = None
    count_patterns = [
        r"(?:any|give|state|list|write|mention|name)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b",
        r"(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:examples|differences|points|types|reasons|features|advantages|disadvantages|methods)\b",
        r"(?:किन्हीं|कोई)\s+(\d+|एक|दो|तीन|चार|पाँच|पांच|छह|सात|आठ|नौ|दस)\b",
        r"(\d+|एक|दो|तीन|चार|पाँच|पांच)\s+(?:उदाहरण|अंतर|बिंदु|प्रकार|लाभ|विशेषताएँ|विशेषताएं)\b",
    ]
    for cp in count_patterns:
        m = re.search(cp, text_lower)
        if m:
            token = m.group(1)
            if token.isdigit():
                explicit_count = int(token)
            else:
                explicit_count = NUM_WORD_MAP.get(token)
            if explicit_count and explicit_count > 0:
                break

    # 3. Mandatory terms (e.g. quoted text 'fork()', "exec", `ls`, or technical tokens)
    mandatory_terms = []
    quoted_matches = re.findall(r"['\"`“”]([^'\"`“”]+)['\"`“”]", text)
    for qm in quoted_matches:
        cleaned = qm.strip()
        if len(cleaned) >= 2 and cleaned not in mandatory_terms:
            mandatory_terms.append(cleaned)

    return {
        "action_verbs": found_verbs,
        "explicit_count": explicit_count,
        "mandatory_terms": mandatory_terms,
    }


def confidence_gate(level: int, confidence: float) -> Optional[Dict[str, Any]]:
    """
    Checks if evaluation confidence is below the strictness tier's tau_flag threshold.
    Returns structured flag dict or None.
    """
    threshold = TAU_FLAG.get(level, 0.70)
    if confidence < threshold:
        return {
            "code": "low_confidence",
            "message": f"Evaluation confidence ({confidence:.2f}) is below Level {level} threshold ({threshold:.2f}).",
            "severity": "warning",
        }
    return None


def ai_draft_guardrail(
    level: int,
    source: str,
    concept_present: bool,
    keyword_present: bool,
    marks_available: float,
) -> Tuple[float, str, Optional[Dict[str, Any]]]:
    """
    Rule 3 from STRICTNESS_SPEC.md Section 3:
    When reference_source == 'ai_draft' and strictness_level >= 4:
    If a student's answer is conceptually correct but lacks a specific keyword
    from the AI-drafted reference, the grader MUST NOT silently award 0.
    Instead, it awards PARTIAL_FACTOR[level] credit and sets flag:
    'No Teacher Answer Key uploaded: verify whether student's phrasing satisfies Level {N} terminology requirements.'
    
    Returns (marks_awarded: float, verdict: "full"|"partial"|"none", flag: Optional[Dict[str, Any]]).
    """
    factor = PARTIAL_FACTOR.get(level, 0.50)

    if concept_present and keyword_present:
        return round(marks_available, 2), "full", None

    if concept_present and not keyword_present:
        partial_marks = round(marks_available * factor, 2)
        if source == "ai_draft" and level >= 4:
            flag = {
                "code": "no_teacher_key_keyword",
                "message": f"No Teacher Answer Key uploaded: verify whether student's phrasing satisfies Level {level} terminology requirements.",
                "severity": "warning",
            }
            return partial_marks, "partial", flag
        return partial_marks, "partial", None

    # Concept not present
    return 0.0, "none", None


def calculate_overall_confidence(
    model_confidence: Optional[float],
    avg_legibility: Optional[float],
) -> float:
    """
    Calculates final evaluation confidence bounded to [0.0, 1.0]:
    confidence = min(model_confidence, avg_legibility).
    """
    mc = 1.0 if model_confidence is None else float(model_confidence)
    leg = 1.0 if avg_legibility is None else float(avg_legibility)
    res = min(mc, leg)
    return max(0.0, min(1.0, round(res, 2)))


def build_strictness_instructions(
    level: int,
    subject_domain: str = "general",
    has_teacher_key: bool = True,
) -> str:
    """
    Builds deterministic prompt instructions for the grading LLM based on:
    - Level (1-5)
    - Subject domain calibration
    - Whether a verified teacher key exists (has_teacher_key)
    Contains NO example answers or example marks.
    """
    tier_name = TIER_NAMES.get(level, "Balanced")
    tau = TAU_FLAG.get(level, 0.70)
    factor = PARTIAL_FACTOR.get(level, 0.50)
    domain = subject_domain if subject_domain in VALID_DOMAINS else "general"

    level_descriptions = {
        1: (
            "LEVEL 1 (Lenient - Concept-First):\n"
            "- Reward broad conceptual grasp and everyday analogies even when formal textbook terms are absent.\n"
            f"- Award partial marks ({int(factor * 100)}% of point marks) for any valid conceptual approach.\n"
            "- High tolerance: forgive messy handwriting, phonetic spelling, and OCR artifacts.\n"
            f"- Flag threshold: confidence < {tau}."
        ),
        2: (
            "LEVEL 2 (Supportive - Guided Partial):\n"
            "- Accept close synonyms and informal explanations if underlying logic is sound.\n"
            f"- Generous step-marking: award partial credit ({int(factor * 100)}% of point marks) for valid approach.\n"
            "- Ignore minor spelling, grammar, or formatting mistakes when intent is unambiguous.\n"
            f"- Flag threshold: confidence < {tau}."
        ),
        3: (
            "LEVEL 3 (Balanced - Standard Rubric):\n"
            "- Require substantive coverage of each rubric key point using accurate subject terminology.\n"
            f"- Proportional step-marking: award {int(factor * 100)}% for partial conceptual coverage.\n"
            "- Deduct only for genuinely missing, contradictory, or incorrect statements.\n"
            f"- Flag threshold: confidence < {tau}."
        ),
        4: (
            "LEVEL 4 (Rigorous - Technical Precision):\n"
            "- Demand exact technical terms, formal definitions, and complete stepwise reasoning.\n"
            f"- Vague paraphrases or everyday analogies earn partial credit ({int(factor * 100)}%) only if core concept is accurate.\n"
            "- Penalize incorrect units, wrong command syntax, and imprecise notation.\n"
            f"- Flag threshold: confidence < {tau}."
        ),
        5: (
            "LEVEL 5 (Strict - Exact-Match):\n"
            "- Require textbook-exact definitions, formulas, and mandatory key points in proper sequence.\n"
            f"- Strict deduction: missing keywords receive minimal partial credit ({int(factor * 100)}%) or 0.\n"
            "- Only verified OCR artifacts are excused; student spelling and syntax mistakes lose marks.\n"
            f"- Flag threshold: confidence < {tau}."
        ),
    }

    domain_guidelines = {
        "cs_it": (
            "DOMAIN CALIBRATION: Computer Science & IT:\n"
            "- Core entities: technical definitions, system calls, command names, flags, syntax, and time complexity.\n"
            "- At Levels 1-2, reward valid algorithm logic or pseudocode even if punctuation/flags slip.\n"
            "- At Level 3, require valid command structure and accurate technical terminology.\n"
            "- At Levels 4-5, penalize invalid syntax, wrong command flags, or misclassified technical concepts."
        ),
        "math_quant": (
            "DOMAIN CALIBRATION: Mathematics & Quantitative Sciences:\n"
            "- Core entities: governing laws, theorems, intermediate steps, final numerical/symbolic value, units.\n"
            "- At Levels 1-2, prioritize method; an arithmetic slip at the end loses at most 10-15% of marks.\n"
            "- At Level 3, mark step-wise (formula + substitution + final answer with unit).\n"
            "- At Levels 4-5, require complete rigorous derivations, justification, and mandatory SI units."
        ),
        "science_bio_chem": (
            "DOMAIN CALIBRATION: Life Sciences & Chemistry:\n"
            "- Core entities: scientific nomenclature, balanced equations, catalysts, and process sequences.\n"
            "- At Levels 1-2, accept descriptive explanations even without formal IUPAC or Latin nomenclature.\n"
            "- At Level 3, require core scientific terminology and balanced reactions.\n"
            "- At Levels 4-5, require balanced equations with state symbols and exact biochemical terms."
        ),
        "humanities_law": (
            "DOMAIN CALIBRATION: Humanities, Commerce & Law:\n"
            "- Core entities: statutory articles, legal sections, economic frameworks, and structured arguments.\n"
            "- At Levels 1-2, reward coherent reasoning and practical examples.\n"
            "- At Level 3, require structured points and relevant framework references.\n"
            "- At Levels 4-5, demand exact statutory sections, case citations, and formal models."
        ),
        "languages": (
            "DOMAIN CALIBRATION: Languages & Literature:\n"
            "- Core entities: comprehension accuracy, literary devices, grammar, and vocabulary register.\n"
            "- At Levels 1-2, evaluate meaning and comprehension only; ignore spelling or matra errors.\n"
            "- At Level 3, balance content accuracy (75%) with grammatical and spelling correctness (25%).\n"
            "- At Levels 4-5, apply strict deductions for spelling, matra errors, and grammar agreement."
        ),
        "general": (
            "DOMAIN CALIBRATION: General Domain:\n"
            "- Evaluate clarity of communication, accuracy of factual claims, and relevance to the prompt."
        ),
    }

    parts = [
        f"GRADING STRICTNESS CALIBRATION: LEVEL {level} ({tier_name.upper()})",
        level_descriptions.get(level, level_descriptions[3]),
        domain_guidelines.get(domain, domain_guidelines["general"]),
        "BILINGUAL EQUIVALENCE:\n"
        "- Hindi (Devanagari) or bilingual English-Hindi answers with accurate technical concepts carry full equivalence.",
    ]

    if not has_teacher_key:
        parts.append(
            "SAFEGUARD (NO TEACHER ANSWER KEY UPLOADED):\n"
            "- The reference is an AI draft. Enforce canonical domain consensus rather than locking onto verbatim reference phrasing.\n"
            f"- If an answer is conceptually correct but uses different phrasing than the draft, do NOT award 0 marks.\n"
            f"- At Levels 4 and 5, award {int(factor * 100)}% partial credit and flag with code 'no_teacher_key_keyword'."
        )

    return "\n\n".join(parts)

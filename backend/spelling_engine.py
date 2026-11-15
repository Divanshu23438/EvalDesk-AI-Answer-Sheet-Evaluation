import re
from typing import List, Set
from rapidfuzz import fuzz

def evaluate_spelling_tolerance(
    student_word: str,
    target_word: str,
    protected_vocab: Set[str],
    strict_mode: bool = False
) -> bool:
    """
    Evaluates word match under strict vs lenient tolerance.
    In lenient mode, technical keywords from question/answer key are protected vocabulary.
    """
    s_norm = re.sub(r"[^\w]", "", student_word.lower())
    t_norm = re.sub(r"[^\w]", "", target_word.lower())

    if s_norm == t_norm:
        return True

    if strict_mode:
        return False  # Strict requires exact character match

    # Lenient mode: rapidfuzz token similarity >= 85%
    ratio = fuzz.ratio(s_norm, t_norm)
    if ratio >= 85:
        return True

    # If target is in protected technical vocabulary, allow minor typo (e.g. 'kernal' -> 'kernel')
    if t_norm in protected_vocab and ratio >= 80:
        return True

    return False

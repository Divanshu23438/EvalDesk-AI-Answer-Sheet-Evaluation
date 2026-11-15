import re
from typing import Dict, Any, Tuple
import sympy as sp

def check_math_equivalence(student_expr_str: str, key_expr_str: str) -> Tuple[bool, str]:
    """
    Checks mathematical equivalence using SymPy.
    Handles numeric values, fractions, algebra, and calculus expressions.
    """
    clean_s = re.sub(r"[^\w\s\+\-\*\/\^\(\)\.\=]", "", student_expr_str).strip()
    clean_k = re.sub(r"[^\w\s\+\-\*\/\^\(\)\.\=]", "", key_expr_str).strip()

    # If expressions contain '=', split to right-hand side
    if "=" in clean_s:
        clean_s = clean_s.split("=")[-1].strip()
    if "=" in clean_k:
        clean_k = clean_k.split("=")[-1].strip()

    # Convert ^ to ** for Python power syntax
    clean_s = clean_s.replace("^", "**")
    clean_k = clean_k.replace("^", "**")

    if not clean_s or not clean_k:
        return False, "Empty mathematical expression"

    try:
        s_sym = sp.sympify(clean_s)
        k_sym = sp.sympify(clean_k)
        diff = sp.simplify(s_sym - k_sym)
        if diff == 0:
            return True, f"SymPy verified algebraic equivalence: {clean_s} == {clean_k}"
        # Check numerical equality
        if abs(float(s_sym.evalf()) - float(k_sym.evalf())) < 1e-4:
            return True, f"SymPy verified numerical equivalence: {s_sym.evalf()} == {k_sym.evalf()}"
    except Exception as e:
        # Fallback to direct string match
        if clean_s.lower() == clean_k.lower():
            return True, "Direct string match"

    return False, f"Expressions differ: student='{clean_s}', expected='{clean_k}'"

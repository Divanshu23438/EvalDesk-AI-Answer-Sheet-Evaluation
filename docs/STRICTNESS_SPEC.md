# EvalDesk — 1-to-5 Grading Strictness Scale & Subject Calibration Specification

## 1. Overview & Architectural Purpose

EvalDesk allows teachers to calibrate how strictly the AI evaluator grades handwritten student answer sheets on an integer scale from **1 (Lenient)** to **5 (Strict)**, with **Level 3 (Balanced)** as the system default.

Rather than relying on vague adjectives, each strictness level deterministically controls four grading levers in the backend evaluation pipeline:

1. **Semantic vs. Keyword Matching:** How closely student phrasing must align with canonical definitions, technical terms, and rubric key points.
2. **Partial Credit & Step-Marking Generosity:** How fractional marks are awarded or deducted for incomplete derivations, missing sub-points, or minor logical slips.
3. **OCR, Spelling & Syntax Tolerance:** How forgiving the grader is toward handwriting recognition noise, phonetic spelling, and minor syntax/notation errors.
4. **Auto-Flagging Sensitivity ($\tau_{\text{flag}}$):** The confidence threshold below which an evaluation is automatically flagged (`flagged = true`) for human teacher verification.

---

## 2. The 1-to-5 Strictness Scale Matrix

| Level | Tier Name | Keyword & Definition Matching | Partial Credit & Deductions | OCR, Spelling & Syntax Tolerance | Auto-Flag Threshold ($\tau_{\text{flag}}$) | Recommended Exam Context |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Lenient** *(Concept-First)* | Rewards broad conceptual grasp and everyday analogies even when formal textbook terms are absent. | Awards full or near-full marks if core intent is right; no deductions for missing minor sub-details. | **Very High:** Forgives messy handwriting, phonetic spelling, and minor OCR character errors. | $\text{confidence} < 0.45$ (Flags only blank, illegible, or totally off-topic answers). | Practice quizzes, homework, diagnostic tests. |
| **2** | **Supportive** *(Guided Partial)* | Accepts close synonyms and informal explanations if underlying logic is sound. | Generous step-marking; awards credit for valid approach even if final conclusion or value slips. | **High:** Ignores minor spelling, grammar, or formatting mistakes when intent is unambiguous. | $\text{confidence} < 0.55$ (Flags severely low legibility or ambiguous partial answers). | Mid-semester tests (MSTs), introductory courses. |
| **3** | **Balanced** *(Standard Rubric)* | Requires substantive coverage of each rubric key point using accurate subject terminology. | Proportional step-marking per matched key point; deducts only for genuinely missing or wrong points. | **Medium:** Tolerates minor OCR/spelling noise if technical meaning remains clear. | $\text{confidence} < 0.70$ (Flags borderline partial credit or conflicting statements). | **Default** for standard university semester exams. |
| **4** | **Rigorous** *(Technical Precision)* | Demands exact technical terms, formal definitions, and complete stepwise reasoning. | Strict step-credit; vague paraphrases or everyday analogies earn $0$ marks for that rubric point. | **Low:** Penalizes wrong units, command/code syntax mistakes, and imprecise notation. | $\text{confidence} < 0.80$ (Flags any answer missing a primary anchor or showing confusion). | Core engineering, programming, maths, lab exams. |
| **5** | **Strict** *(Exact-Match)* | Requires textbook-exact definitions, formulas, and all mandatory key points in proper sequence. | Near binary per rubric point; deducts marks for any missing keyword, condition, or incomplete step. | **Minimal:** Only verified OCR artifacts are excused; student spelling/syntax errors lose marks. | $\text{confidence} < 0.88$ (Flags any deviation from the reference key for teacher review). | Final end-semester exams, high-stakes boards. |

---

## 3. Exception Handling: Grading When No Teacher Answer Key Is Uploaded

A critical edge case occurs when a teacher uploads **only the Question Paper** (`reference_source == "ai_draft"`) without uploading a Teacher Answer Key (`reference_source == "teacher_key"`).

### The Risk Without Safeguards
If Strictness **Level 4** or **Level 5** enforces "exact keyword and definition matching" against an **unverified AI-generated reference**, a student who writes a valid textbook definition using slightly different phrasing than the AI's draft could be unfairly penalized.

### Four Mandatory Fallback Rules (`reference_source == "ai_draft"`)

1. **Question-Prompt Anchor Extraction:**
   * Before grading, the evaluator parses mandatory constraints directly from the question text itself:
     * **Action Verbs:** *Define*, *List*, *Differentiate*, *Derive*, *Write syntax*, *Explain with example*.
     * **Explicit Counts:** Phrases like *"any 4"*, *"give 2 examples"*, or *"state 3 differences"* establish hard structural denominators (e.g., each difference carries $\frac{M}{3}$ marks).
     * **Explicit Terms:** Any term, command, or formula named inside the question prompt becomes a mandatory anchor.

2. **Canonical Domain Consensus Instead of String Lock:**
   * When no Teacher Answer Key exists, **Levels 4 and 5** enforce **canonical domain accuracy** (universally accepted scientific/technical definitions, valid executable syntax, mathematically equivalent expressions) rather than locking onto the exact wording of the AI-drafted reference.
   * Valid synonyms and alternative textbook formulations that preserve technical precision are awarded full marks.

3. **Strictness Level 4–5 Flag Escalation Guardrail:**
   * Whenever `reference_source == "ai_draft"` and `strictness_level >= 4`:
     * If a student's answer is conceptually correct but lacks a specific keyword from the AI-drafted reference, the grader **must not silently award $0$**; instead, it awards tentative partial credit and sets `flagged = true` with an explicit flag reason:
       > *"No Teacher Answer Key uploaded: verify whether student's phrasing satisfies Level {N} terminology requirements."*
   * In the UI (Step 1A on `#/upload`), selecting **Level 4** or **Level 5** while no Answer Key is attached displays a non-blocking amber helper note:
     > *"Tip: Upload a Teacher Answer Key for exact keyword enforcement at Level {N}, or borderline keyword matches will be flagged for your review."*

4. **Cross-Lingual & Bilingual Equivalence (English / Hindi Devanagari):**
   * Without a Teacher Answer Key, students writing in Hindi (Devanagari) or mixed Hinglish who use accurate Hindi conceptual explanations paired with standard English technical terms (e.g., *kernel*, *process*, *osmosis*, *algorithm*) receive full keyword credit across Levels 1–4, and are flagged rather than penalized at Level 5.

---

## 4. Subject-Aware Strictness Calibration

Different academic disciplines evaluate correctness differently. EvalDesk pairs the `1–5` strictness level with a `subject_domain` selector (`general`, `cs_it`, `math_quant`, `science_bio_chem`, `humanities_law`, `languages`) so keyword and definition matching reflects real faculty expectations.

### 4.1 Computer Science, IT & Operating Systems (e.g., Linux, Programming, DBMS)
* **What Counts as a Keyword/Definition:** Technical definitions (e.g., *Kernel*, *Deadlock*, *Normalization*), command names, flags, SQL clauses, and algorithmic time complexity ($O(n \log n)$).
* **Behavior Across Scale:**
  * **Levels 1–2:** Rewards correct logic, flow, or pseudocode even if command flags, semicolons, or minor syntax details are imperfect.
  * **Level 3:** Requires valid command/syntax structure and accurate technical definitions; minor typos in non-critical identifiers are tolerated.
  * **Levels 4–5:** Strictly penalizes wrong command flags (e.g., confusing `chmod` modes), invalid syntax, or misclassifying technical concepts (e.g., labeling an external binary as a shell built-in).

### 4.2 Mathematics, Physics & Quantitative Engineering
* **What Counts as a Keyword/Definition:** Governing laws/theorems, boundary conditions, intermediate algebraic/calculus steps, final numerical/symbolic value, and physical units.
* **Behavior Across Scale:**
  * **Levels 1–2:** Method-heavy marking; if the formula and substitution are right, an arithmetic slip at the end loses at most $10\%$–$15\%$ of question marks.
  * **Level 3:** Awards step-marks proportionally ($\text{Formula} + \text{Substitution} + \text{Final Answer with Unit}$); deducts for skipped critical steps or missing units.
  * **Levels 4–5:** Demands rigorous step-by-step derivation, explicit theorem justification, exact significant figures/simplification, and mandatory SI units.

### 4.3 Life Sciences, Chemistry & Applied Sciences
* **What Counts as a Keyword/Definition:** Scientific nomenclature, balanced chemical equations, catalysts/reaction conditions, and labeled diagram components.
* **Behavior Across Scale:**
  * **Levels 1–2:** Accepts descriptive explanations of biological or chemical mechanisms even without formal IUPAC or Latin terms.
  * **Level 3:** Requires core scientific terminology and balanced chemical equations; minor spelling variations in complex biological names are forgiven if phonetically clear.
  * **Levels 4–5:** Requires balanced equations with state symbols/conditions, exact anatomical or biochemical terminology, and complete process sequences.

### 4.4 Humanities, Commerce, Management & Law
* **What Counts as a Keyword/Definition:** Constitutional articles, legal sections/case laws, named economic/management frameworks, structured arguments, and contextual examples.
* **Behavior Across Scale:**
  * **Levels 1–2:** Rewards coherent reasoning, structured points, and practical examples even without citing exact section numbers or theorist names.
  * **Level 3:** Requires accurate use of domain concepts, structured headings/points, and at least one relevant example or framework reference.
  * **Levels 4–5:** Demands exact statutory sections, case citations, named theoretical models, and balanced critical analysis.

### 4.5 Languages & Bilingual Literature (English / Hindi Devanagari)
* **What Counts as a Keyword/Definition:** Comprehension accuracy, literary devices, theme identification, grammatical tense/gender agreement, and vocabulary register.
* **Behavior Across Scale:**
  * **Levels 1–2:** Evaluates meaning and comprehension only; ignores spelling, punctuation, or matra errors.
  * **Level 3:** Balances content accuracy ($75\%$) with grammatical and spelling correctness ($25\%$).
  * **Levels 4–5:** Applies strict deductions for spelling/matra errors, grammatical agreement, punctuation, and formal register.

---

## 5. Data Model, Backend & UI Integration Blueprint

### 5.1 Database Schema (`SQLite`)
* Add two columns to `papers` (with safe `ALTER TABLE` migration on startup):
  * `strictness_level INTEGER NOT NULL DEFAULT 3` (validated to $1 \le \text{strictness\_level} \le 5$)
  * `subject_domain TEXT NOT NULL DEFAULT 'general'`
* Store `strictness_used INTEGER` on each `evaluations` row so teachers can see which strictness level produced a score and recheck individual questions at a different level if needed.

### 5.2 Backend Prompt & Scoring Integration
* Build a deterministic helper `build_strictness_instructions(level: int, subject_domain: str, has_teacher_key: bool) -> str` in the evaluation service.
* Append its output to the grading prompt alongside `question.text`, `question.max_marks`, `reference.model_answer`, and `reference.key_points`.
* Enforce the post-LLM confidence threshold $\tau_{\text{flag}}$ from Section 2 and the `not has_teacher_key` Level 4–5 flag guardrail from Section 3 in Python after receiving the structured grading JSON.

### 5.3 Stitch UI Placement (Zero Hardcoding)
1. **Step 1A (`UploadScreen.tsx` — Question Paper Card):**
   * Add a compact **Subject Domain** dropdown (`General`, `CS / IT`, `Maths / Engineering`, `Sciences`, `Humanities / Law`, `Languages`) and a **Strictness (1–5)** segmented pill selector (`1 Lenient` · `2` · `3 Balanced` · `4` · `5 Strict`) with a dynamic 1-line description below it.
   * Persist changes immediately via `PATCH /api/papers/{id}`.
2. **Evaluate Workspace (`MarksCard.tsx`):**
   * Display a subtle chip showing the active strictness (`Strictness 3/5 · Balanced`) and allow the teacher to adjust strictness when clicking **`[Recheck]`** on a specific question.
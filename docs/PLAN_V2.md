# EvalDesk Plan V2: Accuracy, UI and UX

Follow-up to the Recovery Plan. Based on the project zip, the question paper (Linux.jpeg), the handwritten sheet and the generated report card.

## 1. What is wrong, with evidence

| # | Problem | Evidence | Cause |
| --- | --- | --- | --- |
| 1 | "Attempt any N" is ignored | `main.py:1639` calls `calculate_section_choice_totals(evaluated_questions, [], ...)`. The empty list means no section rules exist, so nothing is ever excluded. | `instructions` is saved as free text and never parsed into rules. There is no `sections` table. |
| 2 | The paper contradicts itself | Part II says "any four" but also "6 marks × 5 = 30" and prints 6 questions. 4×6 is 24, not 30. | Nothing checks this or asks the teacher. The 59/60 total came from counting every attempted answer. |
| 3 | Long references are too short | The T3 prompt asks for a "concise model answer", sends all questions in one call, and uses temperature 0. It never uses the 50, 200 and 300 word limits printed on the paper. Weights come out uneven (1.5 / 2.0 / 2.0 / 0.5). | Prompt design and no per-question length target. |
| 4 | The grader over-scores | Part III Q3: the student wrote `ch directoryname`, `ch Linux`, `ch ..`. The report quotes `cd..` and gives 2.5/2.5. Part II Q2 and Q3 accept life analogies (eating while studying, phone calculator, ATM) as UNIX examples and give full marks. | Transcription silently corrects the student's mistakes. The rubric has no "acceptable example" criteria. |
| 5 | Page breaks lose content | The `date` output is on the next page, but the report only shows `Eg - date`. | The continuation merge from T5 is weak. |
| 6 | Report looks messy and the sheet seems missing | There are no page images or crops. Remarks are a raw "Pt 1 … \| Pt 2 …" dump. "Q.1" appears three times with no Part label. The title is the filename (`WhatsApp Image…`). Unattempted optional questions show as 0/6 and 0/10. A quote overflows into the next row. | `reports_generator.py` is plain text tables. The default fonts also cannot render Hindi. |
| 7 | Review UI is thin | `TeacherPrototypeWorkspace.tsx` is 2,525 lines. `TeacherWorkspace.tsx`, `admin/*` and `seedData.ts` are still in the repo, so Phase 0 cleanup is unfinished. | Everything lives in one file, with no real sheet viewer. |
| 8 | Rotated paper | `Linux.jpeg` is physically rotated 90°. EXIF correction will not fix that. | There is no orientation detection. |

## 2. Plan, in order

Start with Phases A and B. They fix the marks themselves. Phases D and E only change how those marks are shown.

## Phase A: Section rules (the correctness bug)

- Add a `sections` table: `name, instructions, attempt_n, total_questions, marks_each, policy (best_n | first_n_answered)`.
- Have T1 extract these rules. The UI shows an editable "Section rules" card per Part and warns when `attempt_n × marks_each ≠ section marks`, as in this paper.
- Give questions a `section_id`, so keys become `P2-Q1` and the repeated "Q.1" labels go away.
- Pass the real sections into the totals function. Mark excluded questions "Not counted" and let the teacher pick which ones count.

**Done when:** the Linux paper totals correctly under both "any 4" and "any 5", and the conflict warning appears.

## Phase B: Grading accuracy

- Split transcription from grading. Transcribe in a separate call with "copy exactly, never correct, mark unsure words `[?]`". Grade only from that raw text.
- Give every key point `accept_if` and `reject_if` criteria. For example: "examples must be UNIX commands or file paths; real-life analogies earn at most half marks".
- Add a deterministic command check. Tokens such as `cd`, `ls` and `mkdir` are compared against a whitelist, and a mismatch such as `ch` raises a flag.
- Run the second judge on every long answer. If the two judges differ by more than 1 mark, or the quote check fails, flag it. Only auto-accept when both agree.
- Join text across page breaks using `continues`.
- Auto-rotate pages by trying 0/90/180/270 on thumbnails before reading.
- Run the gold check. The teacher marks Kanak's sheet by hand (a real, consented sheet), then runs `eval_gold.py`. After that, add 2 to 3 more sheets.

**Done when:** the `ch` vs `cd` case is flagged, analogy-only examples lose marks, and the gold table is produced from the teacher's own marks.

## Phase C: Better references without an answer key

- Generate per question, not per paper.
- Extract `word_limit` per section. Tell the model "target ~200 words, cover definition, working, example, diagram, conclusion".
- Run two passes: draft, then critique and expand if the result is under 70% of the target length.
- Use even weights such as 2 / 2 / 1 / 1, and avoid values like 0.5.
- Add `accept_if` and `reject_if` text per key point.
- In the UI, add "Regenerate this question" and "Expand" per card. Show where the two drafts disagree.

**Done when:** a 6-mark answer reference is close to 200 words and a 10-mark one close to 300, with even rubric weights.

## Phase D: Teacher review workspace

- **Left:** questions grouped by Part, with status chips (Checked, Flagged, Not counted, Failed) and a "Flagged only" filter.
- **Centre:** a sheet viewer with zoom, rotate and page thumbnails. Selecting a question jumps to its page and highlights its box from `bbox_json`.
- **Right:** the answer card, with:
  - the transcript, editable, next to the original crop;
  - rubric rows with a marks stepper per key point;
  - evidence highlighted in the text;
  - flag reasons;
  - Accept, Override (with reason) and Recheck.
- Keyboard shortcuts: J/K to move, A to accept, F for the next flag.
- A section panel shows "Attempt any 4 of 6: counted Q1 to Q4", with a toggle to choose which count.
- A live total bar. Finalize is blocked while flags are unresolved.
- Sheets list: filters, batch upload, flag counts, bulk finalize.

**Done when:** a teacher can clear every flag on a sheet using only the keyboard and the viewer, and edits persist after reload.

## Phase E: Report card

- Use the paper title, not the filename.
- Group by Part, with section subtotals and an "optional, not counted" label.
- Each row has the answer crop image, the typed transcript, marks, and 1 to 2 lines of plain feedback instead of the rubric dump.
- Use Noto Sans Devanagari so the bilingual text renders.
- Use `KeepTogether` so rows cannot overflow.
- Add a page-1 summary with total, grade, and the flagged and overridden counts.

**Done when:** every number in the PDF equals the database, and each answer shows its handwriting crop.

## Phase F: Cleanup

- Delete `TeacherWorkspace.tsx`, `admin/*`, `seedData.ts` and `src/server/`.
- Split `TeacherPrototypeWorkspace.tsx` into Setup, Intake, Review and Reports modules.

**Done when:** `scripts/check_all.py` passes and no unused screens or sample data remain.

## 3. Open decision

For "attempt any N", the default policy is best N answers. Some exams count the first N answered instead. This should be a per-section teacher setting in Phase A.

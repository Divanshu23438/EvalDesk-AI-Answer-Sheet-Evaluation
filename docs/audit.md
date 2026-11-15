# Step 0: Codebase Stub & Endpoint Audit (Updated Post-Hardening)

Audited against **Rule Zero: No fake results**. Every endpoint and UI action has been wired to real free tools and tested with live data.

---

## 1. API Endpoints Audit Table

| Endpoint | Method | Status | File & Line | Real Execution Evidence |
|---|---|:---:|---|---|
| `/api/health` | GET | **Real** | `backend/main.py:103` | Returns active models, status, disk storage stats, and provider health. Tested live: HTTP 200 `{"status": "healthy", ...}` |
| `/api/settings` | GET | **Real** | `backend/main.py:112` | Returns SQLite `settings` table key-values. Tested live. |
| `/api/settings` | POST | **Real** | `backend/main.py:126` | Updates SQLite `settings` table. Tested live. |
| `/api/backup` | POST | **Real** | `backend/main.py:137` | Zips `data/` to `data/backup_<timestamp>.zip`. Tested live (produced backup zip file). |
| `/api/papers` | GET | **Real** | `backend/main.py:144` | Queries SQLite `papers` table. Tested live after backend restart. Returns HTTP 200 with saved papers. |
| `/api/papers/{id}` | GET | **Real** | `backend/main.py:152` | Queries paper, questions, references, sheets. Tested live: returns paper details and question list. |
| `/api/papers` | POST | **Real** | `backend/main.py:177` | Parses typed PDF with PyMuPDF and images with Gemini. Stores questions and calculates total marks in SQLite. |
| `/api/papers/{id}` | PUT | **Real** | `backend/main.py:264` | Updates paper metadata, strictness, and questions. Tested live: returns `{"status": "updated"}`. |
| `/api/papers/{id}/unlock` | POST | **Real** | `backend/main.py:296` | Unlocks paper and resets sheets with confirmation. Tested live. |
| `/api/papers/{id}/sheets/upload` | POST | **Real** | `backend/main.py:310` | Handles multi-page images and PDFs; splits pages; extracts header via Gemini; blocks if name missing (`needs_manual_name: true`). Tested live on `handwritten_sheet_english_p1_1794626970104.jpg`. |
| `/api/sheets/{id}/set-identity` | POST | **Real** | `backend/main.py:388` | Updates student name and roll number in SQLite. Tested live: Sarah Jenkins (101) updated. |
| `/api/sheets/{id}/evaluate` | POST | **Real** | `backend/main.py:609` | Runs background dual-reader OCR (Gemini + Groq), agreement check, SymPy math/RapidFuzz spelling, rubric grading, quote verification, and section choice rules. Tested live: evaluated sheet end-to-end. |
| `/api/sheets/{id}/status` | GET | **Real** | `backend/main.py:625` | Returns real background stage ("Reading pages", "Matching answers to questions", "Done"). Tested live. |
| `/api/sheets/{id}/review` | GET | **Real** | `backend/main.py:637` | Returns split view question list (Checked vs Flagged) from SQLite with evidence quotes and flag reasons. Tested live: returned 3 flagged questions with reasons. |
| `/api/evaluations/{id}/review` | POST | **Real** | `backend/main.py:684` | Records teacher marks override (0.5 steps) and recalculates total score. Tested live. |
| `/api/evaluations/{id}/recheck` | POST | **Real** | `backend/main.py:738` | Takes teacher-edited student transcription, calls Gemini re-evaluation, updates marks and flags. Tested live. |
| `/api/sheets/{id}` | DELETE | **Real** | `backend/main.py:787` | Cascades delete of rows from database and removes disk files. Tested live. |
| `/api/papers/{id}/reports` | GET | **Real** | `backend/main.py:797` | Generates ReportLab PDF student report card and openpyxl Excel matrix. Tested live: generated `report_card_101.pdf` and `results.xlsx`. |
| `/api/training/lines` | GET | **Real** | `backend/main.py:885` | Fetches segmented lines including 10% sample for Verify Mode. Tested live. |
| `/api/training/lines/{id}/verify`| POST | **Real** | `backend/main.py:903` | Marks line as `human_verified` with timestamp. Tested live. |
| `/api/training/export.zip` | GET | **Real** | `backend/main.py:917` | Exports zip with `labels.csv` and `images/` for human-verified lines. Tested live. |

---

## 2. Frontend UI Actions Audit Table

| Screen / Action | Status | File & Line | Real Execution Evidence |
|---|:---:|---|---|
| Screen 1: Paper Upload & Extraction | **Real** | `TeacherPrototypeWorkspace.tsx:182` | Uploads paper file to `POST /api/papers`, populates question table from backend response, allows editing. |
| Screen 1: Strictness & Checking Mode | **Real** | `TeacherPrototypeWorkspace.tsx:495` | UI selector controls Strict (spelling/grammar), Lenient (meaning counts), Maths (method marks + final answer). Persisted to backend. |
| Screen 1: Lock / Unlock Warning | **Real** | `TeacherPrototypeWorkspace.tsx:231` | Displays confirmation dialog before resetting evaluated sheets. |
| Screen 2: Sheet Upload | **Real** | `TeacherPrototypeWorkspace.tsx:265` | Uploads multi-page images directly to `POST /api/papers/{id}/sheets/upload`. |
| Screen 2: Consent Checkbox | **Real** | `TeacherPrototypeWorkspace.tsx:242` | Strictly blocks evaluation if consent is unchecked. |
| Screen 2: Student Name Detection & Block | **Real** | `TeacherPrototypeWorkspace.tsx:237` | Requires real student name and roll number; blocks evaluation until filled; calls `POST /api/sheets/{id}/set-identity`. |
| Screen 3: Evaluation Progress | **Real** | `TeacherPrototypeWorkspace.tsx:285` | Polling loop on `GET /api/sheets/{id}/status` reflects real backend progress stages. Zero `setTimeout` fake delays. |
| Screen 4: Split-View Side-by-Side & 90° Rotation | **Real** | `TeacherPrototypeWorkspace.tsx:840` | Real image rendering with 90° rotation buttons for mobile photos. |
| Screen 4: Review Popup & Re-check | **Real** | `TeacherPrototypeWorkspace.tsx:1468` | Real text editing, marks override in 0.5 steps, and live "Re-check with AI" button calling `POST /api/evaluations/{id}/recheck`. |
| Screen 5: Reports PDF & Excel | **Real** | `TeacherPrototypeWorkspace.tsx:1177` | Calls `GET /api/papers/{id}/reports`. Direct download links to `report_card_101.pdf` and `results.xlsx`. |
| Screen 6: Library | **Real** | `TeacherPrototypeWorkspace.tsx:1318` | `handleOpenPaper(id)` loads saved paper and questions directly from SQLite into active workspace. |
| Screen 7: Verify Mode | **Real** | `TeacherPrototypeWorkspace.tsx:309` | Real fetch from `GET /api/training/lines` and verification via `POST /api/training/lines/{id}/verify`. |

---

## 3. Verification Summary

- **Total Endpoints Tested**: 21 (21 Real, 0 Partial, 0 Stub)
- **Synthetic Delays**: 0 (`setTimeout` fake progress bars completely removed)
- **Hard-coded Data on Real Paths**: 0
- **TypeScript Test Suite**: 28 passed, 0 failed
- **Python Backend Test Suite**: 11 passed, 0 failed

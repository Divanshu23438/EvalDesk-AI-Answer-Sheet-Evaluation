# EvalDesk AI — Teacher Evaluation System Prototype

An AI-assisted handwritten answer sheet evaluation tool built for manager demonstration. 
The system is designed strictly for a **Teacher** (no Admin or Student portals) to evaluate handwritten student exams quickly, accurately, and with full transparency.

---

## 🌟 Key Capabilities

1. **Dual-Reader Verification (Gemini + Groq)**:
   - **Gemini (`gemini-3.5-flash-lite`)** serves as the primary reader, extractor, and grader.
   - **Groq (`qwen/qwen3.8-27b`)** runs in parallel as a secondary vision reader and judge.
   - Dual-reader text similarity agreement check automatically flags discrepancies below the configurable threshold (default 70%).

2. **Grounded Key-Point Rubric Grading & Evidence Verification**:
   - Short and long answers are evaluated one rubric point at a time.
   - The AI must quote verbatim student text as evidence. The marking engine programmatically validates that the quoted string exists in the student's handwritten transcription. If the quote is missing or hallucinated, the question is rejected and flagged for teacher review.

3. **Section Choice Rules ("Attempt Any $N$ Questions")**:
   - Automatically supports multi-tier Indian exam papers (e.g., Part I compulsory, Part II attempt any 4 of 6, Part III attempt any 2 of 3).
   - Counts the top $N$ highest-scoring attempted questions toward the true paper maximum marks (e.g., 60 marks).

4. **Persistent SQLite Database & Disk Storage**:
   - Stores papers, questions, rubric points, references, sheets, page images, segmented line crops, and evaluation records in `data/app.db` and `data/storage/`.
   - All data survives app restarts.

5. **Handwriting Training-Data Capture & Export**:
   - Segments handwritten answer sheets into lines using OpenCV contour analysis (`backend/line_tools.py`).
   - Screen 7 (**Verify Mode**) lets the teacher confirm or correct transcription (`provenance = human_verified`), including a 10% random unflagged sample.
   - One-click export to a machine-learning-ready ZIP dataset containing `labels.csv` + `images/` partitioned by sheet with a frozen test set.

6. **Offline Demo Mode**:
   - Caches all AI calls via SHA256 input hashes in `data/cache/`.
   - Replays previous evaluations instantly offline without internet or paid API calls.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 2. Environment Setup
Copy the example environment file and add your API keys:
```bash
cp .env.example .env
```
Edit `.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite

GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=qwen/qwen3.8-27b

PORT=3000
BACKEND_PORT=8000
```

### 3. Install Dependencies
```bash
# Install Python dependencies
pip install -r requirements.txt

# Install Frontend dependencies
npm install
```

### 4. Run the Prototype (2 Commands)

**Terminal 1 — Backend (FastAPI on Port 8000):**
```bash
npm run backend
# or: python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Frontend (Vite on Port 3000):**
```bash
npm run dev
```

Open your browser to: **`http://localhost:3000`**

---

## 🖥️ Teacher Flow (7 Screens)

1. **Screen 1: Paper Setup**:
   - Upload question paper (PDF/image) and optional answer key.
   - Questions extract into an editable table: number, question text, max marks, question type, and section rules.
   - Set paper strictness (Strict, Lenient, Maths).
   - If no answer key is provided, the AI drafts a reference answer rubric labeled *"No answer key used (AI Reference)"*.
   - Lock paper setup to prevent accidental rubric changes.

2. **Screen 2: Upload Answer Sheets**:
   - Batch-queue student answer sheets (1 upload = 1 student).
   - Confirm processing consent checkbox.
   - AI extracts student name and roll number; flags manual input if confidence is low, blocking evaluation until provided.

3. **Screen 3: Evaluation Status Tracker**:
   - Center 5-stage progress bar:
     *Reading Pages → Matching Answers → Marking Rubric → Checking Flags → Done*
   - Includes automatic error handling and a **Retry Evaluation** button.

4. **Screen 4: Center Split-View & Review**:
   - Question paper on the left, student answer sheet on the right, with **Rotate 90°** buttons for mobile photos.
   - Right panel separates **Checked** from **Flagged for Review**.
   - Review popup displays: extracted text (editable), AI marks, quoted evidence, flag reason, teacher marks box (0 to max, 0.5 steps), *Accept AI Marks*, and *Save My Marks*.

5. **Screen 5: Reports**:
   - Student Report Card with question breakdown, percentage, grade, and AI-grounded strengths/improvements.
   - Evaluation report with score distributions.
   - **Download as PDF** (`reportlab`) and **Excel Class Matrix** (`openpyxl`).

6. **Screen 6: Library**:
   - Browse, inspect, and reopen saved papers and evaluation records directly from SQLite.

7. **Screen 7: Verify Mode**:
   - Line-by-line transcription verification interface.
   - Download Training Export ZIP (`/api/training/export.zip`).

---

## 🧪 Running Automated Tests

Run the full Python test suite (offline mock responses):
```bash
npm test
# or: python -m pytest backend/tests/test_backend.py -v
```

Run the TypeScript grading and section choice test suite:
```bash
npm run test:ts
```

Check frontend bundle security:
```bash
npm run build
```
*(Confirms 0 API keys exist in the built client bundle)*

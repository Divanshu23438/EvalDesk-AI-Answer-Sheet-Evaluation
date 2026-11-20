---
title: EvalDesk
emoji: 📝
colorFrom: green
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

# EvalDesk AI — Teacher Evaluation System

An AI-assisted handwritten answer sheet evaluation platform. EvalDesk evaluates handwritten student exams with speed, objective rubric accuracy, and full transparency.

Every extraction, OCR transcription, rubric evaluation, and report is executed live against real backend and AI APIs.

---

## Key Capabilities

1. **Dual-Reader Verification (Gemini + Groq)**:
   - **Gemini (`gemini-3.5-flash-lite`)** serves as the primary reader, extractor, and grader.
   - **Groq (`qwen/qwen3.8-27b`)** runs in parallel as a secondary vision reader and judge.
   - Discrepancy checks flag disagreements for human teacher inspection.

2. **Grounded Key-Point Rubric Grading & Evidence Verification**:
   - Short and long answers are evaluated one rubric point at a time.
   - The AI must quote verbatim student text as evidence. The marking engine programmatically validates that the quoted string exists in the student's handwritten transcription. If the quote is missing, the verdict is flagged for teacher review.

3. **Section Choice Rules ("Attempt Any N Questions")**:
   - Automatically supports multi-tier exam papers (e.g. Part I compulsory, Part II attempt any 4 of 6, Part III attempt any 2 of 3).
   - Dynamically counts the top $N$ highest-scoring attempted questions toward the true paper maximum marks.

4. **Persistent SQLite Database & Disk Storage**:
   - Stores papers, questions, rubric points, references, sheets, page images, and evaluation records in `data/app.db` and `data/storage/`.
   - Data persists across app restarts and browser reloads.

5. **Split-View Review & Live AI Re-check**:
   - Center split-view displays real question paper pages alongside handwritten student sheet pages with independent 90° rotation.
   - Interactive review modal allows editing student text, reviewing quotes, overriding marks (0.5 steps), and triggering live AI re-evaluations.

6. **Academic Reports & Analytics (PDF & Excel)**:
   - **Student Report Card (PDF)**: Student marks, question breakdown, and Task T7 strengths and areas to improve derived strictly from database rubric results.
   - **Paper Summary Report (PDF)**: Class statistics, question drop-off analysis, most-missed key points, and override counts.
   - **Class Results Matrix (Excel `.xlsx`)**: Multi-sheet workbook (`Class Results`, `Question Breakdown`, and `Summary Analytics`) matching database numbers exactly.

---

## Quick Start Guide

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 2. Environment Setup
Copy the example environment file and add your API keys:
```bash
cp .env.example .env
```
Ensure your `.env` contains:
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
# Python backend dependencies
pip install -r requirements.txt

# Node frontend dependencies
npm install
```

### 4. Run with One Command

**Windows (PowerShell):**
```powershell
.\start_dev.ps1
```

**Windows (Command Prompt):**
```cmd
start_dev.bat
```

**Linux / macOS:**
```bash
chmod +x start_dev.sh
./start_dev.sh
```

Or run manually in separate terminals:
- **Terminal 1 (Backend):** `python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000`
- **Terminal 2 (Frontend):** `npm run dev`

Open your browser to: **`http://localhost:3000`**

---

## Database Backup & Restore

EvalDesk includes a backup and restore utility that performs online SQLite snapshots and verifies file integrity using `PRAGMA integrity_check`:

```bash
# Create a verified backup in backups/backup_YYYYMMDD_HHMMSS/
python scripts/backup_db.py

# Restore from a previous backup
python scripts/backup_db.py --restore backups/backup_20261115_165523/
```

---

## Verification & Master Gate Check

Run the comprehensive master gate check to verify banned strings, git clean state, pytest test suite, TypeScript compilation, and live AI provider health:

```bash
python scripts/check_all.py --base http://127.0.0.1:8000
```

To run the full end-to-end live pipeline verification:
```bash
python scripts/e2e_real.py
```

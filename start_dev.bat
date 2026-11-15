@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo Starting EvalDesk AI System (Live Production Dev)
echo ===================================================

:: Check for .env file
if not exist ".env" (
    echo [WARNING] .env file not found. Creating from .env.example...
    copy .env.example .env
    echo Please make sure GEMINI_API_KEY and GROQ_API_KEY are configured in .env.
)

:: Start FastAPI Backend in background window
echo Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "EvalDesk Backend (FastAPI)" python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000

:: Wait 2 seconds for backend initialization
timeout /t 2 /nobreak >nul

:: Start Vite Frontend
echo Starting Vite Frontend on http://localhost:3000 ...
npm run dev

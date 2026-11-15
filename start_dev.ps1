# EvalDesk Unified Startup Script (PowerShell)
# Launches both FastAPI Backend and Vite Frontend concurrently with graceful shutdown

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "Starting EvalDesk AI System (Live Production Dev)" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

# Check for .env file
if (-not (Test-Path ".env")) {
    Write-Host "[WARNING] .env file not found. Creating from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "Please ensure GEMINI_API_KEY and GROQ_API_KEY are configured in .env." -ForegroundColor Yellow
}

# Start backend job
Write-Host "Starting FastAPI Backend on http://127.0.0.1:8000 ..." -ForegroundColor Green
$backendProc = Start-Process python -ArgumentList "-m uvicorn backend.main:app --host 127.0.0.1 --port 8000" -PassThru

# Give backend a moment to bind port
Start-Sleep -Seconds 2

try {
    Write-Host "Starting Vite Frontend on http://localhost:3000 ..." -ForegroundColor Green
    npm run dev
}
finally {
    Write-Host "`nStopping background FastAPI server (PID: $($backendProc.Id))..." -ForegroundColor Yellow
    if ($backendProc -and -not $backendProc.HasExited) {
        Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "EvalDesk processes stopped cleanly." -ForegroundColor Green
}

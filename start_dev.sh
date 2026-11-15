#!/usr/bin/env bash
# EvalDesk Unified Startup Script (Linux/macOS)
set -e

echo "==================================================="
echo "Starting EvalDesk AI System (Live Production Dev)"
echo "==================================================="

if [ ! -f ".env" ]; then
    echo "[WARNING] .env file not found. Creating from .env.example..."
    cp .env.example .env
fi

cleanup() {
    echo -e "\nShutting down backend and frontend..."
    kill "$BACKEND_PID" 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

echo "Starting FastAPI Backend on http://127.0.0.1:8000 ..."
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

sleep 2

echo "Starting Vite Frontend on http://localhost:3000 ..."
npm run dev

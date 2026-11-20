# Stage 1: Build Vite React frontend
FROM node:20-slim AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install npm dependencies
RUN npm ci

# Copy frontend source files and configuration
COPY index.html tsconfig.json vite.config.ts metadata.json ./
COPY src/ ./src/
COPY public/ ./public/

# Build production bundle to dist/
RUN npm run build

# Stage 2: Python FastAPI + SQLite backend
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=7860

WORKDIR /app

# Install required system packages for Pillow, OpenCV, PyMuPDF, ReportLab, and PDF generation
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    libfreetype6 \
    libjpeg62-turbo-dev \
    zlib1g-dev \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code, scripts, entrypoint, and database (if present)
COPY backend/ ./backend/
COPY scripts/ ./scripts/
COPY main.py ./
COPY evaldesk.db* ./

# Copy built frontend from Stage 1
COPY --from=builder /app/dist ./dist

# Create writable upload and storage directories for Hugging Face Spaces user (UID 1000)
RUN mkdir -p /app/uploads /app/data /app/data/storage && chmod -R 777 /app

# Expose Hugging Face Spaces port
EXPOSE 7860

# Start unified server serving both API and static frontend
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]

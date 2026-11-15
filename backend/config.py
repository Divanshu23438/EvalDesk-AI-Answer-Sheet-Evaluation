import os
from pathlib import Path
from dotenv import load_dotenv

# Base directory of the repository
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env
load_dotenv(BASE_DIR / ".env")

# API Keys
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()

# Models
GEMINI_PRIMARY_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite").strip()
GEMINI_FALLBACK_MODEL = "gemini-3.6-flash"
GROQ_VISION_MODEL = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b").strip()
GROQ_TEXT_MODEL = "openai/gpt-oss-120b"

# Directories
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "app.db"
STORAGE_DIR = DATA_DIR / "storage"
PAPERS_STORAGE_DIR = STORAGE_DIR / "papers"
SHEETS_STORAGE_DIR = STORAGE_DIR / "sheets"
REPORTS_STORAGE_DIR = STORAGE_DIR / "reports"
EXPORTS_STORAGE_DIR = STORAGE_DIR / "exports"
CACHE_DIR = DATA_DIR / "cache"

# Ensure essential directories exist
for path in [
    DATA_DIR,
    STORAGE_DIR,
    PAPERS_STORAGE_DIR,
    SHEETS_STORAGE_DIR,
    REPORTS_STORAGE_DIR,
    EXPORTS_STORAGE_DIR,
    CACHE_DIR,
]:
    path.mkdir(parents=True, exist_ok=True)

# System Settings
DEFAULT_SETTINGS = {
    "read_names_with_ai": True,
    "demo_mode": False,
    "agreement_threshold": 0.70,
    "unflagged_sample_rate": 0.10,
    "negative_marking": False,
    "attempt_best_n": True,
}

import os
from pathlib import Path
from dotenv import load_dotenv

# Base directory of the repository
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env
load_dotenv(BASE_DIR / ".env")
load_dotenv()

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
STORAGE_DIR = DATA_DIR / "storage"
PAPERS_STORAGE_DIR = STORAGE_DIR / "papers"
SHEETS_STORAGE_DIR = STORAGE_DIR / "sheets"
REPORTS_STORAGE_DIR = STORAGE_DIR / "reports"
EXPORTS_STORAGE_DIR = STORAGE_DIR / "exports"
CACHE_DIR = DATA_DIR / "cache"
UPLOADS_DIR = BASE_DIR / "uploads"

# Database Configuration: prioritize evaldesk.db (Hugging Face Spaces standard), env override, or data/app.db
_custom_db = os.getenv("EVALDESK_DB_PATH") or os.getenv("DATABASE_PATH")
if _custom_db:
    DB_PATH = Path(_custom_db)
elif (BASE_DIR / "evaldesk.db").exists():
    DB_PATH = BASE_DIR / "evaldesk.db"
elif (DATA_DIR / "app.db").exists():
    DB_PATH = DATA_DIR / "app.db"
else:
    DB_PATH = BASE_DIR / "evaldesk.db"

# Ensure essential directories exist
for path in [
    DATA_DIR,
    STORAGE_DIR,
    PAPERS_STORAGE_DIR,
    SHEETS_STORAGE_DIR,
    REPORTS_STORAGE_DIR,
    EXPORTS_STORAGE_DIR,
    CACHE_DIR,
    UPLOADS_DIR,
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

# Security Audit & Key Rotation Note

## 1. Key Compromise & Rotation Alert
The original zip archive included a live `.env` file containing API keys for:
- Google Gemini API (`GEMINI_API_KEY`)
- Groq Cloud API (`GROQ_API_KEY`)

**Action Required**:
These keys must be rotated immediately in:
1. Google AI Studio Console (https://aistudio.google.com/app/apikey)
2. Groq Cloud Console (https://console.groq.com/keys)

## 2. Git Tracking Hygiene
- `.gitignore` has been updated to strictly ignore:
  - `.env*` (except `!.env.example`)
  - `dist/`
  - `data/`
  - `__pycache__/`
  - `*.pyc`
  - `.pytest_cache/`
  - `.reader_cache/`
  - `legacy/`
- `.env.example` is retained as the template with placeholders.
- Verified that `git ls-files` tracks zero secret, build, or cache files.

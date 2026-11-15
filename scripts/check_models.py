import os
import json
import time
import base64
import httpx
from dotenv import load_dotenv

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
IMAGE_PATH = "src/assets/images/handwritten_sheet_english_p1_1794626970104.jpg"

with open(IMAGE_PATH, "rb") as f:
    b64_data = base64.b64encode(f.read()).decode("utf-8")

# Let's test with gemini-2.5-flash-lite / gemini-2.0-flash / gemini-1.5-flash / gemini-2.5-flash
# Let's check which models are available by calling v1beta/models
url_models = f"https://generativelanguage.googleapis.com/v1beta/models?key={GEMINI_API_KEY}"
with httpx.Client(timeout=15.0) as client:
    resp = client.get(url_models)
    print(f"List models status: {resp.status_code}")
    if resp.status_code == 200:
        models = [m["name"] for m in resp.json().get("models", []) if "generateContent" in m.get("supportedGenerationMethods", [])]
        print("Available Gemini models with generateContent:")
        for m in models:
            if "flash" in m:
                print("  ", m)
    else:
        print(f"Failed to list models: {resp.text}")

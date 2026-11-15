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

payload = {
    "contents": [
        {
            "parts": [
                {
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": b64_data
                    }
                },
                {
                    "text": "Transcribe the student name and the text under Q1 verbatim in JSON format: {\"student_name\": \"...\", \"q1_text\": \"...\"}"
                }
            ]
        }
    ],
    "generationConfig": {
        "response_mime_type": "application/json",
        "temperature": 0.0
    }
}

for model in ["gemini-3.5-flash-lite", "gemini-3.8-flash"]:
    print(f"\n--- Testing Live Gemini API ({model}) ---")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
    t0 = time.time()
    with httpx.Client(timeout=30.0) as client:
        resp = client.post(url, json=payload)
        dt = time.time() - t0
        print(f"Status Code: {resp.status_code} | Latency: {dt:.2f}s")
        if resp.status_code == 200:
            text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            print(f"[Gemini Output]:\n{text}")
            break
        else:
            print(f"[Gemini Error]: {resp.text}")

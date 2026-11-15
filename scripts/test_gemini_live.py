import os
import json
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
IMAGE_PATH = "src/assets/images/handwritten_sheet_english_p1_1794626970104.jpg"

with open(IMAGE_PATH, "rb") as f:
    img_bytes = f.read()

client = genai.Client(api_key=GEMINI_API_KEY)

for model in ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.6-flash"]:
    print(f"\n--- Testing Gemini Model: {model} ---")
    t0 = time.time()
    try:
        res = client.models.generate_content(
            model=model,
            contents=[
                types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg"),
                "Extract the student name and roll number from this handwritten exam paper. Return JSON: {\"student_name\": \"...\", \"date\": \"...\"}"
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.0
            )
        )
        dt = time.time() - t0
        print(f"[Gemini SUCCESS] Model: {model} | Latency: {dt:.2f}s")
        print(f"Output: {res.text.strip()}")
        break
    except Exception as e:
        print(f"[Gemini ERROR with {model}]: {e}")

import os
import sys
import json
import time
import base64
import httpx
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
IMAGE_PATH = "src/assets/images/handwritten_sheet_english_p1_1794626970104.jpg"

print(f"=== TESTING LIVE GEMINI & GROQ CALLS WITH IMAGE ===")
print(f"Sample Image: {IMAGE_PATH}")
print(f"Image exists: {os.path.exists(IMAGE_PATH)}")
with open(IMAGE_PATH, "rb") as f:
    img_bytes = f.read()
print(f"Image size: {len(img_bytes)} bytes")

# 1. Live Gemini Call
print("\n--- 1. Testing Live Gemini Call ---")
gemini_model = "gemini-2.5-flash-lite" if "gemini-2.5-flash-lite" in os.getenv("GEMINI_MODEL", "") else "gemini-2.5-flash-lite"
# Or let's test gemini-2.5-flash-lite / gemini-2.5-flash
try:
    g_client = genai.Client(api_key=GEMINI_API_KEY)
    t0 = time.time()
    res = g_client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg"),
            "Read the student handwriting on this exam sheet. Transcribe the first 2 sentences verbatim in JSON format: {\"transcription\": \"...\"}"
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.0
        )
    )
    dt = time.time() - t0
    print(f"[Gemini SUCCESS] Model: gemini-2.5-flash | Latency: {dt:.2f}s")
    print(f"[Gemini Output]: {res.text.strip()}")
except Exception as e:
    print(f"[Gemini ERROR]: {e}")

# 2. Live Groq Call
print("\n--- 2. Testing Live Groq Call with Vision Model ---")
# Groq vision model: qwen/qwen-2.5-vl-72b or meta-llama/llama-4-scout or llama-3.2-11b-vision-preview
# Let's test the Groq model configured
groq_models_to_test = ["llama-3.2-11b-vision-preview", "llama-3.2-90b-vision-preview", "qwen/qwen3.8-27b"]
b64_img = base64.b64encode(img_bytes).decode("utf-8")

for model in groq_models_to_test:
    print(f"\nTesting Groq model: {model}")
    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Describe the handwritten text in this image in one brief sentence."},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_img}"}}
                ]
            }
        ],
        "temperature": 0.0
    }
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    t0 = time.time()
    try:
        r = httpx.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload, timeout=30.0)
        dt = time.time() - t0
        print(f"Status Code: {r.status_code}")
        if r.status_code == 200:
            content = r.json()["choices"][0]["message"]["content"]
            print(f"[Groq SUCCESS] Model: {model} | Latency: {dt:.2f}s")
            print(f"[Groq Output]: {content.strip()}")
            break
        else:
            print(f"[Groq Response Error]: {r.text}")
    except Exception as e:
        print(f"[Groq Exception]: {e}")

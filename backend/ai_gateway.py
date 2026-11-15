import os
import json
import time
import base64
import hashlib
import difflib
import re
from pathlib import Path
from typing import Dict, Any, List, Optional
import httpx

from backend.config import (
    GEMINI_API_KEY,
    GROQ_API_KEY,
    GEMINI_PRIMARY_MODEL,
    GEMINI_FALLBACK_MODEL,
    GROQ_VISION_MODEL,
    GROQ_TEXT_MODEL,
    CACHE_DIR,
)
from backend.db import get_db
from backend.rate_limiter import rate_limiters

SUSPICIOUS_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior)\s+instructions",
    r"give\s+me\s+full\s+marks?",
    r"award\s+(me\s+)?(full|\d+%?|\d+)\s+marks?",
    r"system\s*prompt",
    r"disregard\s+(the\s+)?rubric",
    r"bypass\s+grading",
]

def check_suspicious_text(text: str) -> bool:
    if not text:
        return False
    lower = text.lower()
    for pat in SUSPICIOUS_PATTERNS:
        if re.search(pat, lower):
            return True
    return False

def calculate_text_similarity(a: str, b: str) -> float:
    norm_a = re.sub(r"\s+", " ", a.lower().strip())
    norm_b = re.sub(r"\s+", " ", b.lower().strip())
    if not norm_a and not norm_b:
        return 1.0
    if not norm_a or not norm_b:
        return 0.0
    return difflib.SequenceMatcher(None, norm_a, norm_b).ratio()

def get_cache_key(provider: str, task: str, payload_str: str) -> str:
    h = hashlib.sha256()
    h.update(provider.encode())
    h.update(task.encode())
    h.update(payload_str.encode())
    return h.hexdigest()

def get_cached_response(cache_key: str) -> Optional[Dict[str, Any]]:
    path = CACHE_DIR / f"{cache_key}.json"
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None
    return None

def set_cached_response(cache_key: str, data: Dict[str, Any]):
    path = CACHE_DIR / f"{cache_key}.json"
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Failed to write cache: {e}")

def log_ai_call(provider: str, model: str, task: str, latency_ms: int, tokens: int, status: str, error: Optional[str] = None):
    try:
        with get_db() as conn:
            conn.execute(
                """
                INSERT INTO ai_calls (provider, model, task, latency_ms, tokens, status, error)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (provider, model, task, latency_ms, tokens, status, error),
            )
    except Exception as e:
        print(f"Failed to log AI call: {e}")

class AIGateway:
    async def ping_providers(self) -> Dict[str, Any]:
        """
        Runs a tiny live call to each provider to verify connectivity and confirms Groq image support.
        """
        status_res = {
            "gemini": {"status": "untested", "model": GEMINI_PRIMARY_MODEL},
            "groq": {"status": "untested", "model": GROQ_VISION_MODEL, "accepts_images": False},
        }

        # 1. Ping Gemini
        if GEMINI_API_KEY:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_PRIMARY_MODEL}:generateContent?key={GEMINI_API_KEY}"
                payload = {"contents": [{"parts": [{"text": "Respond with JSON: {\"ping\": \"pong\"}"}]}], "generationConfig": {"response_mime_type": "application/json"}}
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 200:
                        status_res["gemini"]["status"] = "online"
                    else:
                        status_res["gemini"]["status"] = f"error: {resp.status_code}"
            except Exception as e:
                status_res["gemini"]["status"] = f"error: {str(e)[:100]}"
        else:
            status_res["gemini"]["status"] = "missing_api_key"

        # 2. Ping Groq with image
        if GROQ_API_KEY:
            try:
                tiny_png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAA"
                headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
                payload = {
                    "model": GROQ_VISION_MODEL,
                    "messages": [
                        {"role": "user", "content": [
                            {"type": "text", "text": "Is this a dot? Reply JSON: {\"is_dot\": true}"},
                            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{tiny_png_b64}"}}
                        ]}
                    ],
                    "temperature": 0.0,
                    "response_format": {"type": "json_object"}
                }
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
                    if resp.status_code == 200:
                        status_res["groq"]["status"] = "online"
                        status_res["groq"]["accepts_images"] = True
                    else:
                        status_res["groq"]["status"] = f"error: {resp.status_code}"
            except Exception as e:
                status_res["groq"]["status"] = f"error: {str(e)[:100]}"
        else:
            status_res["groq"]["status"] = "missing_api_key"

        return status_res

    async def call_gemini(
        self,
        prompt: str,
        image_bytes: Optional[bytes] = None,
        mime_type: str = "image/jpeg",
        task: str = "general",
        demo_mode: bool = False,
    ) -> Dict[str, Any]:
        cache_key = get_cache_key("gemini", task, prompt + (str(len(image_bytes)) if image_bytes else ""))
        cached = get_cached_response(cache_key)
        if demo_mode or cached:
            if cached:
                cached["from_cache"] = True
                return cached
            if demo_mode:
                return {"error": "Demo mode active and no cached response found for this call."}

        if not GEMINI_API_KEY:
            return {"error": "GEMINI_API_KEY is not configured on the server."}

        await rate_limiters["gemini"].acquire()

        models_to_try = [GEMINI_PRIMARY_MODEL, GEMINI_FALLBACK_MODEL]
        last_error = None
        start_time = time.time()

        parts = []
        if image_bytes:
            b64_data = base64.b64encode(image_bytes).decode("utf-8")
            parts.append({
                "inline_data": {
                    "mime_type": mime_type,
                    "data": b64_data
                }
            })
        parts.append({"text": prompt})

        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.0
            }
        }

        async with httpx.AsyncClient(timeout=35.0) as client:
            for model in models_to_try:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 200:
                        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                        parsed = json.loads(text)
                        latency_ms = int((time.time() - start_time) * 1000)
                        log_ai_call("gemini", model, task, latency_ms, 0, "success")
                        result = {"provider": "gemini", "model": model, "data": parsed, "from_cache": False}
                        set_cached_response(cache_key, result)
                        return result
                    else:
                        last_error = f"HTTP {resp.status_code}: {resp.text}"
                        print(f"[Gemini Error] Model {model} returned {last_error}")
                except Exception as err:
                    last_error = str(err)
                    print(f"[Gemini Error] Model {model} exception: {err}")

        latency_ms = int((time.time() - start_time) * 1000)
        log_ai_call("gemini", GEMINI_PRIMARY_MODEL, task, latency_ms, 0, "error", last_error)
        return {"error": f"Gemini calls failed: {last_error}"}

    async def call_groq(
        self,
        prompt: str,
        image_bytes: Optional[bytes] = None,
        mime_type: str = "image/jpeg",
        task: str = "general",
        demo_mode: bool = False,
    ) -> Dict[str, Any]:
        cache_key = get_cache_key("groq", task, prompt + (str(len(image_bytes)) if image_bytes else ""))
        cached = get_cached_response(cache_key)
        if demo_mode or cached:
            if cached:
                cached["from_cache"] = True
                return cached
            if demo_mode:
                return {"error": "Demo mode active and no cached response found for this call."}

        if not GROQ_API_KEY:
            return {"error": "GROQ_API_KEY is not configured on the server."}

        await rate_limiters["groq"].acquire()

        model = GROQ_VISION_MODEL if image_bytes else GROQ_TEXT_MODEL
        start_time = time.time()

        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
        }

        messages = []
        if image_bytes:
            b64_img = base64.b64encode(image_bytes).decode("utf-8")
            content = [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64_img}"}},
            ]
            messages.append({"role": "user", "content": content})
        else:
            messages.append({"role": "user", "content": prompt})

        payload = {
            "model": model,
            "messages": messages,
            "temperature": 0.0,
            "response_format": {"type": "json_object"},
        }

        async with httpx.AsyncClient(timeout=35.0) as client:
            try:
                resp = await client.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                latency_ms = int((time.time() - start_time) * 1000)
                tokens = data.get("usage", {}).get("total_tokens", 0)
                log_ai_call("groq", model, task, latency_ms, tokens, "success")

                result = {"provider": "groq", "model": model, "data": parsed, "from_cache": False}
                set_cached_response(cache_key, result)
                return result
            except Exception as err:
                latency_ms = int((time.time() - start_time) * 1000)
                log_ai_call("groq", model, task, latency_ms, 0, "error", str(err))
                print(f"[Groq Error] {err}")
                return {"error": f"Groq call failed: {err}"}

ai_gateway = AIGateway()

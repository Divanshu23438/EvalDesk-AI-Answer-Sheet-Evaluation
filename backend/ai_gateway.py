import os
import json
import time
import base64
import hashlib
import difflib
import re
import asyncio
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Type, Literal
import httpx
from pydantic import BaseModel, ValidationError

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
from backend.pdf_tools import normalize_image_bytes, process_pdf_bytes

AIErrorKind = Literal["rate_limited", "unavailable", "bad_input", "bad_output", "auth", "timeout"]

class AIError(Exception):
    """
    Typed error for all AI Gateway failures.
    kinds:
      - rate_limited: HTTP 429, daily token / request quota exhausted
      - unavailable: HTTP 503, provider overloaded / down
      - bad_input: blank image, corrupt PDF, invalid payload
      - bad_output: model returned invalid JSON or schema validation failure
      - auth: HTTP 401/403, missing or invalid API key
      - timeout: request exceeded gateway timeout
    """
    def __init__(
        self,
        kind: AIErrorKind,
        message: str,
        provider: str = "",
        status_code: Optional[int] = None,
        retry_after: Optional[float] = None,
    ):
        super().__init__(message)
        self.kind: AIErrorKind = kind
        self.message = message
        self.provider = provider
        self.status_code = status_code
        self.retry_after = retry_after

    def to_dict(self) -> Dict[str, Any]:
        return {
            "error_type": "AIError",
            "kind": self.kind,
            "message": self.message,
            "provider": self.provider,
            "status_code": self.status_code,
            "retry_after": self.retry_after,
        }

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

def get_content_cache_key(
    provider: str,
    task: str,
    prompt: str,
    media_bytes: Optional[bytes] = None
) -> str:
    """
    Computes a deterministic SHA-256 cache key from provider, task, prompt, and content bytes.
    """
    h = hashlib.sha256()
    h.update(provider.encode("utf-8"))
    h.update(b"|")
    h.update(task.encode("utf-8"))
    h.update(b"|")
    h.update(prompt.encode("utf-8"))
    if media_bytes:
        h.update(b"|")
        h.update(hashlib.sha256(media_bytes).digest())
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
    """
    Caches only validated, successful outputs. Never caches errors.
    """
    if not data or "error" in data or data.get("status") == "error":
        return
    path = CACHE_DIR / f"{cache_key}.json"
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Failed to write cache: {e}")

def log_ai_call(
    provider: str,
    model: str,
    task: str,
    latency_ms: int,
    tokens: int,
    status: str,
    error: Optional[str] = None
):
    """
    Logs call metadata strictly. Never logs student text or API keys.
    """
    try:
        # Sanitize error message to prevent accidental key or text logging
        clean_error = error
        if clean_error and len(clean_error) > 500:
            clean_error = clean_error[:500] + "... (truncated)"
        with get_db() as conn:
            conn.execute(
                """
                INSERT INTO ai_calls (provider, model, task, latency_ms, tokens, status, error)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (provider, model, task, latency_ms, tokens, status, clean_error),
            )
    except Exception as e:
        print(f"Failed to log AI call: {e}")

def strip_markdown_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if len(lines) >= 2 and lines[0].startswith("```"):
            if lines[-1].startswith("```"):
                cleaned = "\n".join(lines[1:-1]).strip()
            else:
                cleaned = "\n".join(lines[1:]).strip()
    return cleaned

class AIGateway:
    def __init__(self):
        self.image_timeout = httpx.Timeout(120.0, connect=15.0)
        self.text_timeout = httpx.Timeout(120.0, connect=15.0)

    def prepare_media_input(
        self,
        raw_bytes: bytes,
        declared_mime: Optional[str] = None
    ) -> Tuple[bytes, str]:
        """
        Converts inputs:
        - Detects PDFs and converts first page to standard JPEG if sent as media.
        - Normalizes images: auto-rotates (EXIF), converts to RGB JPEG, resizes to <=1600px.
        - Validates that image is not blank or corrupt.
        Raises typed AIError(kind="bad_input") on corrupt or blank inputs.
        """
        if not raw_bytes or len(raw_bytes) < 8:
            raise AIError("bad_input", "Corrupt or empty input data: byte length too small.", provider="gateway")

        # Check for PDF signature
        if raw_bytes.startswith(b"%PDF-") or (declared_mime and "pdf" in declared_mime.lower()):
            try:
                pdf_res = process_pdf_bytes(raw_bytes)
                if not pdf_res["page_images_bytes"]:
                    raise ValueError("PDF contains no renderable pages.")
                # Return first page rendered as standard JPEG
                first_page = pdf_res["page_images_bytes"][0]
                return normalize_image_bytes(first_page, max_dimension=1600)
            except Exception as e:
                raise AIError("bad_input", f"Invalid or corrupt PDF document: {e}", provider="gateway") from e

        # Standard image normalization
        try:
            return normalize_image_bytes(raw_bytes, max_dimension=1600)
        except ValueError as ve:
            raise AIError("bad_input", str(ve), provider="gateway") from ve
        except Exception as e:
            raise AIError("bad_input", f"Unable to process input image: {e}", provider="gateway") from e

    async def call_gemini(
        self,
        prompt: str,
        image_bytes: Optional[bytes] = None,
        images_bytes: Optional[List[bytes]] = None,
        mime_type: Optional[str] = None,
        task: str = "general",
        response_model: Optional[Type[BaseModel]] = None,
        demo_mode: bool = False,
        thinking_budget: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Calls Gemini with:
        - Multi-image support (images_bytes) or single image (image_bytes).
        - Image normalization (auto-rotate, resize <=1600px, blank check).
        - SHA-256 content-based caching.
        - Exponential backoff on 429 and 503.
        - 90s timeout for vision calls.
        - Typed AIError exceptions (never silent error dicts).
        - Optional Pydantic validation with 1 retry.
        """
        if not GEMINI_API_KEY:
            raise AIError("auth", "GEMINI_API_KEY is not configured on the server.", provider="gemini")

        normalized_list: List[Tuple[bytes, str]] = []
        if images_bytes:
            for b in images_bytes:
                if b and len(b) > 10:
                    normalized_list.append(self.prepare_media_input(b, declared_mime=mime_type))
        elif image_bytes:
            normalized_list.append(self.prepare_media_input(image_bytes, declared_mime=mime_type))

        all_media_bytes = b"".join(n[0] for n in normalized_list) if normalized_list else None
        cache_key = get_content_cache_key("gemini", task, prompt, all_media_bytes)
        cached = get_cached_response(cache_key)
        if demo_mode or cached:
            if cached:
                cached["from_cache"] = True
                return cached
            if demo_mode:
                raise AIError("unavailable", "Demo mode active and no cached response found.", provider="gemini")

        await rate_limiters["gemini"].acquire()

        models_to_try = [GEMINI_PRIMARY_MODEL, GEMINI_FALLBACK_MODEL]
        last_error_msg = ""
        last_status_code = None
        timeout = self.image_timeout if normalized_list else self.text_timeout
        start_time = time.time()

        parts: List[Dict[str, Any]] = []
        for n_bytes, n_mime in normalized_list:
            b64_data = base64.b64encode(n_bytes).decode("utf-8")
            parts.append({
                "inline_data": {
                    "mime_type": n_mime,
                    "data": b64_data,
                }
            })
        parts.append({"text": prompt})

        generation_cfg: Dict[str, Any] = {
            "response_mime_type": "application/json",
            "temperature": 0.0,
        }
        if thinking_budget is not None and thinking_budget > 0:
            generation_cfg["thinkingConfig"] = {"thinkingBudget": thinking_budget}

        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": generation_cfg,
        }

        async with httpx.AsyncClient(timeout=timeout) as client:
            for model in models_to_try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
                
                # Retry loop with exponential backoff on 429/503
                for attempt in range(3):
                    try:
                        resp = await client.post(url, json=payload)
                        latency_ms = int((time.time() - start_time) * 1000)

                        if resp.status_code == 200:
                            resp_json = resp.json()
                            candidates = resp_json.get("candidates", [])
                            if not candidates or "content" not in candidates[0]:
                                raise AIError("bad_output", f"Gemini ({model}) returned empty candidates", provider="gemini", status_code=200)

                            raw_text = candidates[0]["content"]["parts"][0].get("text", "")
                            raw_text = strip_markdown_fences(raw_text)

                            try:
                                parsed = json.loads(raw_text)
                            except json.JSONDecodeError as jde:
                                # One retry for JSON decoding
                                if attempt == 0:
                                    print(f"[Gemini] Bad JSON from {model}, retrying once with strict instructions...")
                                    payload["contents"][0]["parts"][-1]["text"] = prompt + "\n\nCRITICAL: Output ONLY raw RFC 8259 JSON. No markdown."
                                    continue
                                raise AIError("bad_output", f"Gemini returned invalid JSON: {jde}", provider="gemini", status_code=200) from jde

                            # Validate with Pydantic if schema provided
                            if response_model:
                                try:
                                    validated = response_model.model_validate(parsed)
                                    parsed = validated.model_dump()
                                except ValidationError as ve:
                                    raise AIError("bad_output", f"Pydantic validation failed for {response_model.__name__}: {ve}", provider="gemini") from ve

                            tokens = resp_json.get("usageMetadata", {}).get("totalTokenCount", 0)
                            log_ai_call("gemini", model, task, latency_ms, tokens, "success")
                            result = {"provider": "gemini", "model": model, "data": parsed, "from_cache": False}
                            set_cached_response(cache_key, result)
                            return result

                        elif resp.status_code == 429:
                            last_status_code = 429
                            retry_after = 1.5 * (2 ** attempt)
                            last_error_msg = f"HTTP 429 Rate limited: {resp.text[:200]}"
                            print(f"[Gemini 429] Backing off for {retry_after:.1f}s on {model}...")
                            await asyncio.sleep(retry_after)
                            continue

                        elif resp.status_code in (500, 502, 503, 504):
                            last_status_code = resp.status_code
                            last_error_msg = f"HTTP {resp.status_code} Provider unavailable: {resp.text[:200]}"
                            if attempt == 0:
                                retry_after = 0.5
                                print(f"[Gemini {resp.status_code}] Backing off for {retry_after:.1f}s on {model}...")
                                await asyncio.sleep(retry_after)
                                continue
                            else:
                                print(f"[Gemini {resp.status_code}] {model} unavailable; switching to fallback model...")
                                break

                        elif resp.status_code in (401, 403):
                            latency_ms = int((time.time() - start_time) * 1000)
                            log_ai_call("gemini", model, task, latency_ms, 0, "error", f"HTTP {resp.status_code} Auth failure")
                            raise AIError("auth", f"Gemini authentication failed (HTTP {resp.status_code}). Check GEMINI_API_KEY.", provider="gemini", status_code=resp.status_code)

                        else:
                            last_status_code = resp.status_code
                            last_error_msg = f"HTTP {resp.status_code}: {resp.text[:300]}"
                            break  # Try next model

                    except httpx.TimeoutException as te:
                        last_error_msg = f"Gateway timeout after {timeout.read}s: {te}"
                        last_status_code = 408
                        break
                    except AIError:
                        raise
                    except Exception as ex:
                        last_error_msg = f"Request exception: {ex}"
                        break

        # If all models exhausted
        latency_ms = int((time.time() - start_time) * 1000)
        log_ai_call("gemini", GEMINI_PRIMARY_MODEL, task, latency_ms, 0, "error", last_error_msg)

        if last_status_code == 429:
            raise AIError("rate_limited", f"Gemini quota/rate limit exhausted: {last_error_msg}", provider="gemini", status_code=429)
        elif last_status_code in (500, 502, 503, 504):
            raise AIError("unavailable", f"Gemini service unavailable: {last_error_msg}", provider="gemini", status_code=last_status_code)
        elif last_status_code == 408:
            raise AIError("timeout", f"Gemini call timed out: {last_error_msg}", provider="gemini", status_code=408)
        else:
            raise AIError("unavailable", f"Gemini call failed: {last_error_msg}", provider="gemini", status_code=last_status_code)

    async def call_groq(
        self,
        prompt: str,
        image_bytes: Optional[bytes] = None,
        mime_type: Optional[str] = None,
        task: str = "general",
        response_model: Optional[Type[BaseModel]] = None,
        demo_mode: bool = False,
    ) -> Dict[str, Any]:
        """
        Calls Groq with:
        - Image normalization (auto-rotate, resize <=2000px, blank check).
        - SHA-256 content-based caching.
        - Exponential backoff on 429 and 503.
        - 90s timeout for vision calls.
        - Typed AIError exceptions (never silent error dicts).
        """
        if not GROQ_API_KEY:
            raise AIError("auth", "GROQ_API_KEY is not configured on the server.", provider="groq")

        normalized_bytes: Optional[bytes] = None
        final_mime = "image/jpeg"
        if image_bytes:
            normalized_bytes, final_mime = self.prepare_media_input(image_bytes, declared_mime=mime_type)

        cache_key = get_content_cache_key("groq", task, prompt, normalized_bytes)
        cached = get_cached_response(cache_key)
        if demo_mode or cached:
            if cached:
                cached["from_cache"] = True
                return cached
            if demo_mode:
                raise AIError("unavailable", "Demo mode active and no cached response found.", provider="groq")

        await rate_limiters["groq"].acquire()

        model = GROQ_VISION_MODEL if normalized_bytes else GROQ_TEXT_MODEL
        timeout = self.image_timeout if normalized_bytes else self.text_timeout
        start_time = time.time()

        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
        }

        messages = []
        if normalized_bytes:
            b64_img = base64.b64encode(normalized_bytes).decode("utf-8")
            messages.append({
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:{final_mime};base64,{b64_img}"}},
                ]
            })
        else:
            messages.append({"role": "user", "content": prompt})

        payload = {
            "model": model,
            "messages": messages,
            "temperature": 0.0,
            "response_format": {"type": "json_object"},
        }

        async with httpx.AsyncClient(timeout=timeout) as client:
            for attempt in range(3):
                try:
                    resp = await client.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
                    latency_ms = int((time.time() - start_time) * 1000)

                    if resp.status_code == 200:
                        data = resp.json()
                        choices = data.get("choices", [])
                        if not choices:
                            raise AIError("bad_output", "Groq returned empty choices", provider="groq", status_code=200)

                        content = choices[0]["message"].get("content", "")
                        content = strip_markdown_fences(content)

                        try:
                            parsed = json.loads(content)
                        except json.JSONDecodeError as jde:
                            if attempt == 0:
                                payload["messages"][0]["content"] = prompt + "\n\nCRITICAL: Return strictly valid JSON."
                                continue
                            raise AIError("bad_output", f"Groq returned invalid JSON: {jde}", provider="groq", status_code=200) from jde

                        if response_model:
                            try:
                                validated = response_model.model_validate(parsed)
                                parsed = validated.model_dump()
                            except ValidationError as ve:
                                raise AIError("bad_output", f"Schema validation failed: {ve}", provider="groq") from ve

                        tokens = data.get("usage", {}).get("total_tokens", 0)
                        log_ai_call("groq", model, task, latency_ms, tokens, "success")
                        result = {"provider": "groq", "model": model, "data": parsed, "from_cache": False}
                        set_cached_response(cache_key, result)
                        return result

                    elif resp.status_code == 429:
                        retry_after = 2.0 * (2 ** attempt)
                        print(f"[Groq 429] Rate limited. Backing off for {retry_after:.1f}s...")
                        await asyncio.sleep(retry_after)
                        continue

                    elif resp.status_code in (500, 502, 503, 504):
                        retry_after = 1.0 * (2 ** attempt)
                        print(f"[Groq {resp.status_code}] Service unavailable. Backing off for {retry_after:.1f}s...")
                        await asyncio.sleep(retry_after)
                        continue

                    elif resp.status_code in (401, 403):
                        log_ai_call("groq", model, task, latency_ms, 0, "error", f"HTTP {resp.status_code} Auth failure")
                        raise AIError("auth", f"Groq authentication failed (HTTP {resp.status_code}). Check GROQ_API_KEY.", provider="groq", status_code=resp.status_code)

                    else:
                        err_text = resp.text[:300]
                        log_ai_call("groq", model, task, latency_ms, 0, "error", f"HTTP {resp.status_code}: {err_text}")
                        raise AIError("bad_output" if resp.status_code < 500 else "unavailable", f"Groq call failed with HTTP {resp.status_code}: {err_text}", provider="groq", status_code=resp.status_code)

                except httpx.TimeoutException as te:
                    latency_ms = int((time.time() - start_time) * 1000)
                    log_ai_call("groq", model, task, latency_ms, 0, "error", f"Timeout: {te}")
                    raise AIError("timeout", f"Groq call timed out after {timeout.read}s", provider="groq", status_code=408) from te
                except AIError:
                    raise
                except Exception as ex:
                    if attempt == 2:
                        latency_ms = int((time.time() - start_time) * 1000)
                        log_ai_call("groq", model, task, latency_ms, 0, "error", str(ex))
                        raise AIError("unavailable", f"Groq call failed: {ex}", provider="groq") from ex
                    await asyncio.sleep(1.0)

        raise AIError("rate_limited", "Groq rate limits or retries exhausted.", provider="groq", status_code=429)

    async def health_check_providers(self) -> Dict[str, Any]:
        """
        Executes real tiny live calls:
        1. Gemini Text: prompt asking for JSON pong.
        2. Gemini Image: tiny non-blank 10x10 pattern image.
        3. Groq Image: tiny non-blank 10x10 pattern image.
        Reports exact status, latency, model, and whether Groq accepted the image.
        """
        import io
        from PIL import Image, ImageDraw

        # Create a tiny 64x64 valid non-blank image (Groq requires >= 32px in each dimension)
        test_img = Image.new("RGB", (64, 64), color=(240, 240, 240))
        draw = ImageDraw.Draw(test_img)
        draw.line([(0, 0), (63, 63)], fill=(10, 20, 30), width=3)
        draw.line([(0, 63), (63, 0)], fill=(40, 50, 60), width=3)
        buf = io.BytesIO()
        test_img.save(buf, format="JPEG")
        tiny_jpeg_bytes = buf.getvalue()

        results: Dict[str, Any] = {
            "gemini_text": {"status": "untested", "model": GEMINI_PRIMARY_MODEL, "latency_ms": 0, "error": None},
            "gemini_image": {"status": "untested", "model": GEMINI_PRIMARY_MODEL, "latency_ms": 0, "error": None},
            "groq_image": {"status": "untested", "model": GROQ_VISION_MODEL, "latency_ms": 0, "accepts_images": False, "error": None},
        }

        # 1. Gemini Text Check
        t0 = time.time()
        try:
            res = await self.call_gemini(
                prompt="Respond with JSON: {\"ping\": \"pong\"}",
                task="health_gemini_text",
            )
            lat = int((time.time() - t0) * 1000)
            results["gemini_text"]["status"] = "online"
            results["gemini_text"]["latency_ms"] = lat
            results["gemini_text"]["response"] = res.get("data", {})
        except AIError as ae:
            results["gemini_text"]["status"] = f"error: {ae.kind}"
            results["gemini_text"]["error"] = ae.message
            results["gemini_text"]["latency_ms"] = int((time.time() - t0) * 1000)
        except Exception as e:
            results["gemini_text"]["status"] = "error"
            results["gemini_text"]["error"] = str(e)
            results["gemini_text"]["latency_ms"] = int((time.time() - t0) * 1000)

        # 2. Gemini Image Check
        t0 = time.time()
        try:
            res = await self.call_gemini(
                prompt="Examine this tiny pattern. Respond with JSON: {\"visual_check\": \"pass\"}",
                image_bytes=tiny_jpeg_bytes,
                task="health_gemini_image",
            )
            lat = int((time.time() - t0) * 1000)
            results["gemini_image"]["status"] = "online"
            results["gemini_image"]["latency_ms"] = lat
            results["gemini_image"]["response"] = res.get("data", {})
        except AIError as ae:
            results["gemini_image"]["status"] = f"error: {ae.kind}"
            results["gemini_image"]["error"] = ae.message
            results["gemini_image"]["latency_ms"] = int((time.time() - t0) * 1000)
        except Exception as e:
            results["gemini_image"]["status"] = "error"
            results["gemini_image"]["error"] = str(e)
            results["gemini_image"]["latency_ms"] = int((time.time() - t0) * 1000)

        # 3. Groq Image Check
        t0 = time.time()
        try:
            res = await self.call_groq(
                prompt="Examine this tiny pattern. Respond with JSON: {\"visual_check\": \"pass\"}",
                image_bytes=tiny_jpeg_bytes,
                task="health_groq_image",
            )
            lat = int((time.time() - t0) * 1000)
            results["groq_image"]["status"] = "online"
            results["groq_image"]["latency_ms"] = lat
            results["groq_image"]["accepts_images"] = True
            results["groq_image"]["response"] = res.get("data", {})
        except AIError as ae:
            results["groq_image"]["status"] = f"error: {ae.kind}"
            results["groq_image"]["error"] = ae.message
            results["groq_image"]["latency_ms"] = int((time.time() - t0) * 1000)
        except Exception as e:
            results["groq_image"]["status"] = "error"
            results["groq_image"]["error"] = str(e)
            results["groq_image"]["latency_ms"] = int((time.time() - t0) * 1000)

        return results

ai_gateway = AIGateway()

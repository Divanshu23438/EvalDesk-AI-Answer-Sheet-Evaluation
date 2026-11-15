import time
import asyncio
from typing import Dict, Any

class ProviderRateLimiter:
    def __init__(self, provider_name: str, rpm: int = 10, rpd: int = 1500):
        self.provider_name = provider_name
        self.rpm = rpm
        self.rpd = rpd
        self.min_interval = 60.0 / max(1, rpm)
        self.last_call_time = 0.0
        self.daily_calls = 0
        self.lock = asyncio.Lock()

    async def acquire(self):
        async with self.lock:
            now = time.time()
            elapsed = now - self.last_call_time
            if elapsed < self.min_interval:
                wait_time = self.min_interval - elapsed
                await asyncio.sleep(wait_time)
            self.last_call_time = time.time()
            self.daily_calls += 1

rate_limiters = {
    "gemini": ProviderRateLimiter("gemini", rpm=12, rpd=1500),
    "groq": ProviderRateLimiter("groq", rpm=25, rpd=14400),
}

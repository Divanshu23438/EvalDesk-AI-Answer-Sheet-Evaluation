import asyncio
import base64
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

async def test_live_providers():
    gemini_key = os.getenv('GEMINI_API_KEY')
    groq_key = os.getenv('GROQ_API_KEY')
    gemini_model = os.getenv('GEMINI_MODEL', 'gemini-3.5-flash-lite')
    groq_model = os.getenv('GROQ_MODEL', 'qwen/qwen3.8-27b')

    tiny_png_b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAA'

    print('=== 1. LIVE GEMINI CALL WITH IMAGE ===')
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={gemini_key}'
    payload = {
        'contents': [{
            'parts': [
                {'text': 'Identify this image and reply with JSON: {"color": "white", "is_image": true}'},
                {'inline_data': {'mime_type': 'image/png', 'data': tiny_png_b64}}
            ]
        }],
        'generationConfig': {'response_mime_type': 'application/json'}
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        r_gemini = await client.post(url, json=payload)
        print('Gemini HTTP Status:', r_gemini.status_code)
        if r_gemini.status_code == 200:
            print('Gemini Response Body:', r_gemini.json()['candidates'][0]['content']['parts'][0]['text'].strip())
        else:
            print('Gemini Response Body:', r_gemini.text)

    print('\n=== 2. LIVE GROQ CALL WITH IMAGE ===')
    headers = {'Authorization': f'Bearer {groq_key}', 'Content-Type': 'application/json'}
    payload_groq = {
        'model': groq_model,
        'messages': [{
            'role': 'user',
            'content': [
                {'type': 'text', 'text': 'Identify this image pixel. Reply with JSON: {"pixel": "1x1"}'},
                {'type': 'image_url', 'image_url': {'url': f'data:image/png;base64,{tiny_png_b64}'}}
            ]
        }],
        'response_format': {'type': 'json_object'}
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        r_groq = await client.post('https://api.groq.com/openai/v1/chat/completions', headers=headers, json=payload_groq)
        print('Groq HTTP Status:', r_groq.status_code)
        if r_groq.status_code == 200:
            print('Groq Response Body:', r_groq.json()['choices'][0]['message']['content'].strip())
            print(f'Confirmation: Groq model {groq_model} accepts images: YES (HTTP 200 OK)')
        else:
            print('Groq Response Body:', r_groq.text)

if __name__ == '__main__':
    asyncio.run(test_live_providers())


import asyncio
import base64
import json
import os
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Iterator
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from google import genai
from pydantic import BaseModel, Field

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env", override=True)

GEMINI_MODEL = "gemini-3.5-flash-lite"
LOCAL_TIMEZONE = ZoneInfo("Asia/Kolkata")

SUPPORTED_LANGUAGES = {
    "en": {"name": "English", "tts": "en-IN"},
    "hi": {"name": "Hindi", "tts": "hi-IN"},
    "hinglish": {"name": "Hinglish", "tts": "hi-IN"},
    "gu": {"name": "Gujarati", "tts": "gu-IN"},
    "ta": {"name": "Tamil", "tts": "ta-IN"},
    "te": {"name": "Telugu", "tts": "te-IN"},
    "bn": {"name": "Bengali", "tts": "bn-IN"},
    "mr": {"name": "Marathi", "tts": "mr-IN"},
    "fr": {"name": "French", "tts": "fr-FR"},
    "es": {"name": "Spanish", "tts": "es-ES"},
    "de": {"name": "German", "tts": "de-DE"},
}

SYSTEM_INSTRUCTIONS = """
You are MANAV, Aryan Gupta's personal AI assistant.

Your creator and founder is Aryan Gupta.

LANGUAGE RULES:
- The backend provides a detected response language.
- Respond in that language.
- English is the fallback when language detection is uncertain.
- Hindi means natural, grammatically correct Hindi in Devanagari.
- Hinglish means natural Hindi-English mixed conversation.
- Gujarati, Tamil, Telugu, Bengali and Marathi should use their
  native scripts.
- French, Spanish and German should use their normal scripts.
- Do not mix languages unless the selected language is Hinglish.
- Do not announce the detected language unless asked.

CLOCK RULES:
- The current date and time are supplied in every request.
- Use the supplied timestamp for date and time questions.
- Timezone is Asia/Kolkata (IST, UTC+05:30).
- Never invent a different time.

Be conversational, useful and concise.
Explain technical subjects step by step when needed.
Never claim to have performed an action you have not performed.
You do not have direct Windows computer access.
Never reveal API keys, passwords or private secrets.
"""


app = FastAPI(
    title="MANAV AI",
    description="MANAV multilingual personal assistant",
    version="0.9.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str
    content: str = Field(default="", max_length=12000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=12000)
    history: list[ChatMessage] = Field(default_factory=list)
    preferred_language: str = "auto"


class SpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4500)
    language: str = "en"


def current_clock() -> str:
    now = datetime.now(LOCAL_TIMEZONE)
    return (
        f"Date: {now.strftime('%A, %d %B %Y')}\n"
        f"Time: {now.strftime('%I:%M:%S %p')}\n"
        f"Timezone: India Standard Time (IST, UTC+05:30)\n"
        f"ISO: {now.isoformat()}"
    )


def detect_language(text: str) -> str:
    """Detect supported languages using script and text heuristics."""
    sample = text.strip()

    if not sample:
        return "en"

    # Native-script detection is more reliable than guessing from English letters.
    script_patterns = [
        ("gu", r"[\u0A80-\u0AFF]"),
        ("ta", r"[\u0B80-\u0BFF]"),
        ("te", r"[\u0C00-\u0C7F]"),
        ("bn", r"[\u0980-\u09FF]"),
        ("mr", r"[\u0900-\u097F]"),
        ("hi", r"[\u0900-\u097F]"),
    ]

    for language, pattern in script_patterns:
        if re.search(pattern, sample):
            # Devanagari is shared by Hindi and Marathi.
            if language == "mr":
                return "hi"
            return language

    # Detect common Romanized Hindi/Hinglish expressions.
    hinglish_words = {
        "hai", "hain", "kya", "kaise", "kaisa", "kaisi",
        "kyu", "kyun", "nahi", "nahin", "mera", "meri",
        "aap", "tum", "mujhe", "mujhko", "batao", " bataiye",
        "karna", "karo", "karta", "karte", "ho", "tha",
        "the", "acha", "achha", "abhi", "kal", "aaj",
        "ka", "ki", "ke", "aur", "haan", "han",
    }

    words = set(re.findall(r"[a-zA-Z']+", sample.lower()))
    hindi_hits = len(words.intersection(hinglish_words))

    if hindi_hits >= 2 or (
        hindi_hits >= 1 and len(words) <= 5
    ):
        return "hinglish"

    # Optional language detection for Latin-script languages.
    try:
        from langdetect import detect

        detected = detect(sample)
        if detected in {"en", "fr", "es", "de"}:
            return detected
    except Exception:
        pass

    return "en"


def choose_language(message: str, preference: str) -> str:
    if preference != "auto" and preference in SUPPORTED_LANGUAGES:
        return preference
    return detect_language(message)


def get_gemini_client():
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is missing from backend/.env",
        )
    return genai.Client(api_key=key)


def build_prompt(request: ChatRequest, language: str) -> str:
    history = []

    for item in request.history[-10:]:
        content = item.content.strip()
        if not content:
            continue

        role = "User" if item.role == "user" else "MANAV"
        history.append(f"{role}: {content}")

    history.append(f"User: {request.message.strip()}")

    language_name = SUPPORTED_LANGUAGES[language]["name"]

    return (
        "LIVE SYSTEM CONTEXT:\n"
        f"{current_clock()}\n\n"
        f"RESPONSE LANGUAGE: {language_name}\n"
        f"Language code: {language}\n"
        "Respond in the specified response language.\n\n"
        "CONVERSATION:\n"
        + "\n\n".join(history)
    )


def sse_event(name: str, payload: dict) -> str:
    return (
        f"event: {name}\n"
        f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
    )


@app.get("/")
async def root():
    return {
        "name": "MANAV",
        "status": "online",
        "version": "0.9.0",
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "assistant": "MANAV",
        "model": GEMINI_MODEL,
        "version": "0.9.0",
        "timezone": "Asia/Kolkata",
        "languages": list(SUPPORTED_LANGUAGES.keys()),
        "google_tts_configured": bool(
            os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        ),
    }


@app.get("/time")
async def get_time():
    now = datetime.now(LOCAL_TIMEZONE)
    return {
        "date": now.strftime("%A, %d %B %Y"),
        "time": now.strftime("%I:%M:%S %p"),
        "timezone": "IST",
        "iso": now.isoformat(),
    }


@app.post("/chat")
async def chat(request: ChatRequest):
    started = time.perf_counter()
    client = get_gemini_client()

    language = choose_language(
        request.message,
        request.preferred_language,
    )

    prompt = build_prompt(request, language)

    print(
        f"MANAV: Gemini={GEMINI_MODEL}, "
        f"language={language}, prompt={len(prompt)} chars"
    )

    def generate_events() -> Iterator[str]:
        full_reply = ""

        try:
            stream = client.models.generate_content_stream(
                model=GEMINI_MODEL,
                contents=prompt,
                config={
                    "system_instruction": SYSTEM_INSTRUCTIONS,
                },
            )

            for chunk in stream:
                text = getattr(chunk, "text", None)
                if text:
                    full_reply += text
                    yield sse_event("chunk", {"text": text})

            elapsed = time.perf_counter() - started

            if not full_reply.strip():
                yield sse_event(
                    "error",
                    {"message": "Gemini returned an empty response."},
                )
                return

            yield sse_event(
                "done",
                {
                    "assistant": "MANAV",
                    "model": GEMINI_MODEL,
                    "language": language,
                    "language_name": SUPPORTED_LANGUAGES[language]["name"],
                    "response_time_seconds": round(elapsed, 2),
                },
            )

            print(
                f"MANAV completed in {elapsed:.2f}s; "
                f"language={language}"
            )

        except Exception as error:
            print(
                f"MANAV Gemini error: {type(error).__name__}: {error}"
            )
            yield sse_event(
                "error",
                {"message": "Gemini request failed. Check backend terminal."},
            )

    return StreamingResponse(
        generate_events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


def google_synthesize(text: str, language: str) -> bytes:
    """Synthesize audio with Google Cloud Text-to-Speech."""
    from google.cloud import texttospeech

    tts_language = SUPPORTED_LANGUAGES.get(
        language,
        SUPPORTED_LANGUAGES["en"],
    )["tts"]

    client = texttospeech.TextToSpeechClient()

    response = client.synthesize_speech(
        input=texttospeech.SynthesisInput(text=text),
        voice=texttospeech.VoiceSelectionParams(
            language_code=tts_language,
            ssml_gender=texttospeech.SsmlVoiceGender.NEUTRAL,
        ),
        audio_config=texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=0.96,
        ),
    )

    return response.audio_content


@app.post("/speak")
async def speak(request: SpeechRequest):
    language = request.language
    if language not in SUPPORTED_LANGUAGES:
        language = detect_language(request.text)

    try:
        audio = await asyncio.to_thread(
            google_synthesize,
            request.text,
            language,
        )

        return {
            "success": True,
            "provider": "google-cloud-tts",
            "language": language,
            "audio_base64": base64.b64encode(audio).decode("ascii"),
            "content_type": "audio/mpeg",
        }

    except Exception as error:
        print(
            f"Google TTS unavailable: {type(error).__name__}: {error}"
        )
        return {
            "success": False,
            "provider": "browser-fallback",
            "language": language,
            "message": "Google TTS unavailable. Use browser speech fallback.",
        }

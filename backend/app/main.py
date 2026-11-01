
import json
import os
import re
import time
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from google import genai
from pydantic import BaseModel, Field


# --------------------------------------------------
# 1. CONFIGURATION
# --------------------------------------------------

BACKEND_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BACKEND_DIR / ".env"

load_dotenv(ENV_FILE, override=True)

GEMINI_MODEL = "gemini-3.5-flash-lite"

MANAV_INSTRUCTIONS = """
You are MANAV, Aryan Gupta's personal AI assistant.

IDENTITY:
- Your creator and founder is Aryan Gupta.
- Aryan has shared that he has 8.5 years of coding experience.
- Aryan's best friend is Ankit Kumar.
- Never invent personal information.

PERSONALITY:
- Be intelligent, friendly, calm and conversational.
- Understand English, Hindi and Hinglish.
- Reply in the language used by the user.
- Sound natural when spoken aloud.
- Keep ordinary answers concise.
- Explain difficult technical subjects step by step.

BEHAVIOUR:
- Give useful and accurate answers.
- Avoid unnecessary introductions.
- Do not repeat the user's question.
- Never claim to perform actions you cannot perform.
- You do not currently have direct Windows computer access.
- Never reveal API keys or private credentials.
"""


# --------------------------------------------------
# 2. FASTAPI APPLICATION
# --------------------------------------------------

app = FastAPI(
    title="MANAV AI",
    description="Personal AI Assistant Backend",
    version="0.8.0",
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


# --------------------------------------------------
# 3. REQUEST MODELS
# --------------------------------------------------

class ChatMessage(BaseModel):
    role: Literal["user", "model"]
    content: str = Field(
        min_length=1,
        max_length=12000,
    )


class ChatRequest(BaseModel):
    message: str = Field(
        min_length=1,
        max_length=12000,
    )

    history: list[ChatMessage] = Field(
        default_factory=list,
    )


# --------------------------------------------------
# 4. GEMINI CLIENT
# --------------------------------------------------

def get_gemini_client():

    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise RuntimeError(
            "Gemini API key missing from backend/.env"
        )

    return genai.Client(api_key=api_key)


# --------------------------------------------------
# 5. BASIC ROUTES
# --------------------------------------------------

@app.get("/")
async def root():

    return {
        "name": "MANAV",
        "status": "online",
        "version": "0.8.0",
    }


@app.get("/health")
async def health():

    return {
        "status": "healthy",
        "assistant": "MANAV",
        "model": GEMINI_MODEL,
        "version": "0.8.0",
        "streaming": True,
    }


@app.get("/config-check")
async def config_check():

    return {
        "env_file_exists": ENV_FILE.is_file(),
        "api_key_loaded": bool(
            os.getenv("GEMINI_API_KEY")
        ),
    }


# --------------------------------------------------
# 6. LOCAL IDENTITY RESPONSES
# --------------------------------------------------

def get_identity_reply(message: str):

    normalized = re.sub(
        r"[^a-z0-9 ]+",
        " ",
        message.lower(),
    )

    normalized = " ".join(normalized.split())

    creator_patterns = [
        r"who is your father",
        r"who is your dad",
        r"who is your creator",
        r"who is your founder",
        r"who is your owner",
        r"who created you",
        r"who made you",
        r"who built you",
        r"who developed you",
        r"who founded you",
        r"who made manav",
        r"who created manav",
        r"who is manav founder",
    ]

    for pattern in creator_patterns:

        if re.search(pattern, normalized):

            return (
                "My creator and founder is Aryan Gupta. "
                "He built MANAV, and I am his personal "
                "AI assistant."
            )

    if re.search(
        r"who is aryans best friend|who is your best friend",
        normalized,
    ):

        return "Aryan's best friend is Ankit Kumar."

    if re.search(
        r"how many years.*(coding|programming)|aryan.*coding experience",
        normalized,
    ):

        return (
            "Aryan has shared that he has "
            "8.5 years of coding experience."
        )

    return None


# --------------------------------------------------
# 7. CONVERSATION HISTORY
# --------------------------------------------------

def build_prompt(request: ChatRequest):

    messages = []

    for item in request.history[-4:]:

        speaker = (
            "User"
            if item.role == "user"
            else "MANAV"
        )

        messages.append(
            f"{speaker}: {item.content}"
        )

    messages.append(
        f"User: {request.message}"
    )

    return "\n\n".join(messages)


# --------------------------------------------------
# 8. SSE EVENT FORMATTER
# --------------------------------------------------

def make_event(event_name: str, data: dict):

    payload = json.dumps(
        data,
        ensure_ascii=False,
    )

    return (
        f"event: {event_name}\n"
        f"data: {payload}\n\n"
    )


# --------------------------------------------------
# 9. STREAMING GEMINI RESPONSE
# --------------------------------------------------

def stream_gemini_response(prompt: str):

    client = get_gemini_client()

    response_stream = client.models.generate_content_stream(
        model=GEMINI_MODEL,
        contents=prompt,
        config={
            "system_instruction": MANAV_INSTRUCTIONS,
        },
    )

    for chunk in response_stream:

        text = getattr(chunk, "text", None)

        if text:
            yield text


# --------------------------------------------------
# 10. MAIN STREAMING CHAT ENDPOINT
# --------------------------------------------------

@app.post("/chat")
async def chat(request: ChatRequest):

    request_started = time.perf_counter()

    # Check for instant local answers first.
    identity_reply = get_identity_reply(
        request.message
    )

    if identity_reply:

        async def local_stream():

            yield make_event(
                "chunk",
                {"text": identity_reply},
            )

            yield make_event(
                "done",
                {
                    "model": "local-identity",
                    "assistant": "MANAV",
                },
            )

        return StreamingResponse(
            local_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    prompt = build_prompt(request)

    async def generate_stream():

        full_response = ""

        try:

            print(
                f"MANAV: Streaming with {GEMINI_MODEL}"
            )

            gemini_started = time.perf_counter()

            # Iterate over Gemini's response as it arrives.
            for text in stream_gemini_response(prompt):

                full_response += text

                yield make_event(
                    "chunk",
                    {"text": text},
                )

            gemini_elapsed = (
                time.perf_counter() - gemini_started
            )

            total_elapsed = (
                time.perf_counter() - request_started
            )

            print(
                "MANAV streaming timing: "
                f"gemini={gemini_elapsed:.2f}s, "
                f"total={total_elapsed:.2f}s"
            )

            yield make_event(
                "done",
                {
                    "model": GEMINI_MODEL,
                    "assistant": "MANAV",
                    "response_time_seconds": round(
                        total_elapsed, 2
                    ),
                    "generation_time_seconds": round(
                        gemini_elapsed, 2
                    ),
                },
            )

        except Exception as error:

            print(
                "MANAV STREAM ERROR: "
                f"{type(error).__name__}: {error}"
            )

            yield make_event(
                "error",
                {
                    "message": (
                        "MANAV could not complete "
                        "the Gemini request."
                    )
                },
            )

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

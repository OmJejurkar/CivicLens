"""Whisper speech-to-text service.

Fallback chain:
  1. Local OpenAI Whisper (requires ffmpeg in PATH)
  2. Groq Whisper API      (requires GROQ_API_KEY)
  3. OpenAI Whisper API    (requires OPENAI_API_KEY)
"""
import os
import logging
import shutil
from typing import List

logger = logging.getLogger(__name__)


def _check_ffmpeg() -> bool:
    """Return True if ffmpeg is available in PATH."""
    return shutil.which("ffmpeg") is not None


async def transcribe_audio(
    audio_path: str,
    language: str = "en"
) -> List[dict]:
    """
    Transcribe audio file using OpenAI Whisper.
    Returns list of segments: [{"text": ..., "start": ..., "end": ..., "language": ...}]
    Falls back from local Whisper → Groq API → OpenAI API automatically.
    """
    from app.config import settings

    # --- 1. Try local Whisper (only if ffmpeg is available) ---
    if _check_ffmpeg():
        try:
            logger.info("Attempting local Whisper transcription...")
            return await _whisper_local(audio_path, language, settings.whisper_model, settings.whisper_device)
        except Exception as e:
            logger.warning(f"Local Whisper failed: {e}. Falling back to API...")
    else:
        logger.info("ffmpeg not found in PATH — skipping local Whisper, using API fallback.")

    # --- 2. Fallback: Groq Whisper API ---
    if settings.groq_api_key:
        try:
            logger.info("Using Groq Whisper API for transcription...")
            return await _whisper_groq(audio_path, language, settings.groq_api_key)
        except Exception as e:
            logger.warning(f"Groq Whisper failed: {e}. Trying OpenAI...")

    # --- 3. Fallback: OpenAI Whisper API ---
    if settings.openai_api_key:
        try:
            logger.info("Using OpenAI Whisper API for transcription...")
            return await _whisper_api(audio_path, language, settings.openai_api_key)
        except Exception as e:
            logger.error(f"OpenAI Whisper failed: {e}")

    raise RuntimeError(
        "No transcription engine available. "
        "Either install ffmpeg (for local Whisper) or provide GROQ_API_KEY / OPENAI_API_KEY in .env"
    )


async def _whisper_local(
    audio_path: str,
    language: str,
    model_name: str,
    device: str
) -> List[dict]:
    """Use locally installed OpenAI Whisper."""
    import whisper

    model = whisper.load_model(model_name, device=device)

    # Detect language if 'auto'
    lang = None if language == "auto" else language

    result = model.transcribe(
        audio_path,
        language=lang,
        verbose=False,
        word_timestamps=False,
    )

    segments = []
    for seg in result.get("segments", []):
        segments.append({
            "text": seg["text"].strip(),
            "start": seg["start"],
            "end": seg["end"],
            "language": result.get("language", language),
            "speaker": "Unknown",
            "speaker_label": "",
        })

    return segments


def _get_audio_mime_type(audio_path: str) -> str:
    """Return the correct MIME type for common audio formats."""
    ext = os.path.splitext(audio_path)[1].lower()
    mime_map = {
        ".ogg": "audio/ogg",
        ".oga": "audio/ogg",
        ".mp3": "audio/mpeg",
        ".mp4": "audio/mp4",
        ".m4a": "audio/mp4",
        ".wav": "audio/wav",
        ".webm": "audio/webm",
        ".flac": "audio/flac",
        ".opus": "audio/opus",
    }
    return mime_map.get(ext, "audio/mpeg")


async def _whisper_groq(
    audio_path: str,
    language: str,
    api_key: str
) -> List[dict]:
    """Use Groq Whisper API (supports ogg, mp3, wav, webm, etc.)."""
    import httpx

    mime_type = _get_audio_mime_type(audio_path)
    filename = os.path.basename(audio_path)

    async with httpx.AsyncClient(timeout=600) as client:
        with open(audio_path, "rb") as f:
            files = {"file": (filename, f, mime_type)}
            data = {
                "model": "whisper-large-v3",
                "response_format": "verbose_json",
            }
            if language and language != "auto":
                data["language"] = language

            response = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {api_key}"},
                files=files,
                data=data,
            )
            response.raise_for_status()
            result = response.json()

    segments = []
    for seg in result.get("segments", []):
        segments.append({
            "text": seg.get("text", "").strip(),
            "start": seg.get("start", 0),
            "end": seg.get("end", 0),
            "language": result.get("language", language),
            "speaker": "Unknown",
            "speaker_label": "",
        })

    # If Groq doesn't return segments (text-only response), make one segment
    if not segments and result.get("text"):
        segments.append({
            "text": result["text"].strip(),
            "start": 0,
            "end": 0,
            "language": result.get("language", language),
            "speaker": "Unknown",
            "speaker_label": "",
        })

    return segments


async def _whisper_api(
    audio_path: str,
    language: str,
    api_key: str
) -> List[dict]:
    """Use OpenAI Whisper API."""
    import httpx

    mime_type = _get_audio_mime_type(audio_path)
    filename = os.path.basename(audio_path)

    async with httpx.AsyncClient(timeout=600) as client:
        with open(audio_path, "rb") as f:
            files = {"file": (filename, f, mime_type)}
            data = {
                "model": "whisper-1",
                "response_format": "verbose_json",
                "timestamp_granularities[]": "segment",
            }
            if language and language != "auto":
                data["language"] = language

            response = await client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {api_key}"},
                files=files,
                data=data,
            )
            response.raise_for_status()
            result = response.json()

    segments = []
    for seg in result.get("segments", []):
        segments.append({
            "text": seg.get("text", "").strip(),
            "start": seg.get("start", 0),
            "end": seg.get("end", 0),
            "language": result.get("language", language),
            "speaker": "Unknown",
            "speaker_label": "",
        })

    return segments

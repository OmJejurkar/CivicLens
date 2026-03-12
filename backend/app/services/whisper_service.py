"""Whisper speech-to-text service."""
import os
from typing import List, Optional


async def transcribe_audio(
    audio_path: str,
    language: str = "en"
) -> List[dict]:
    """
    Transcribe audio file using OpenAI Whisper.
    Returns list of segments: [{"text": ..., "start": ..., "end": ..., "language": ...}]
    """
    from app.config import settings

    # Try self-hosted Whisper first
    try:
        return await _whisper_local(audio_path, language, settings.whisper_model, settings.whisper_device)
    except ImportError:
        pass

    # Fallback: OpenAI Whisper API
    if settings.openai_api_key:
        return await _whisper_api(audio_path, language, settings.openai_api_key)

    # Fallback: Groq Whisper
    if settings.groq_api_key:
        return await _whisper_groq(audio_path, language, settings.groq_api_key)

    raise RuntimeError("No transcription engine available. Install whisper or provide API keys.")


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


async def _whisper_api(
    audio_path: str,
    language: str,
    api_key: str
) -> List[dict]:
    """Use OpenAI Whisper API."""
    import httpx

    async with httpx.AsyncClient(timeout=600) as client:
        with open(audio_path, "rb") as f:
            files = {"file": (os.path.basename(audio_path), f, "audio/mpeg")}
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


async def _whisper_groq(
    audio_path: str,
    language: str,
    api_key: str
) -> List[dict]:
    """Use Groq Whisper API."""
    import httpx

    async with httpx.AsyncClient(timeout=600) as client:
        with open(audio_path, "rb") as f:
            files = {"file": (os.path.basename(audio_path), f, "audio/mpeg")}
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

    return segments

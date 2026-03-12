"""Audio preprocessing utilities."""
import os
import subprocess
from typing import Optional


def extract_audio_from_video(video_path: str, output_path: Optional[str] = None) -> str:
    """Extract audio from video file using ffmpeg."""
    if not output_path:
        base = os.path.splitext(video_path)[0]
        output_path = f"{base}.wav"

    cmd = [
        "ffmpeg", "-i", video_path,
        "-vn",  # No video
        "-acodec", "pcm_s16le",  # PCM 16-bit
        "-ar", "16000",  # 16kHz sample rate (Whisper optimal)
        "-ac", "1",  # Mono
        "-y",  # Overwrite
        output_path
    ]
    subprocess.run(cmd, capture_output=True, check=True)
    return output_path


def convert_to_wav(audio_path: str) -> str:
    """Convert any audio format to WAV for Whisper."""
    base = os.path.splitext(audio_path)[0]
    output_path = f"{base}_converted.wav"

    if audio_path.lower().endswith(".wav"):
        return audio_path

    cmd = [
        "ffmpeg", "-i", audio_path,
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        "-y",
        output_path
    ]
    subprocess.run(cmd, capture_output=True, check=True)
    return output_path

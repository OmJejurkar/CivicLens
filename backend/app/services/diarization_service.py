"""Speaker diarization service using pyannote.audio."""
from typing import List


async def diarize_and_merge(
    audio_path: str,
    transcript_segments: List[dict]
) -> List[dict]:
    """
    Run speaker diarization and merge with Whisper transcript segments.
    Falls back gracefully if pyannote is not available.
    """
    try:
        diarization_result = await _run_diarization(audio_path)
    except (ImportError, Exception):
        # If diarization is not available, assign generic speaker labels
        for i, seg in enumerate(transcript_segments):
            seg["speaker_label"] = f"SPEAKER_00"
            seg["speaker"] = "Speaker"
        return transcript_segments

    # Merge: assign each transcript segment to the speaker active at that time
    for seg in transcript_segments:
        seg_mid = (seg.get("start", 0) + seg.get("end", 0)) / 2
        best_speaker = "Unknown"
        best_overlap = 0

        for turn in diarization_result:
            overlap = _overlap(
                seg.get("start", 0), seg.get("end", 0),
                turn["start"], turn["end"]
            )
            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = turn["speaker"]

        seg["speaker_label"] = best_speaker
        seg["speaker"] = best_speaker

    return transcript_segments


async def _run_diarization(audio_path: str) -> List[dict]:
    """Run pyannote.audio diarization pipeline."""
    try:
        from pyannote.audio import Pipeline
        import torch
    except ImportError:
        raise ImportError("pyannote.audio not installed")

    pipeline = Pipeline.from_pretrained(
        "pyannote/speaker-diarization-3.1",
        use_auth_token=True,  # Requires HuggingFace token
    )

    # Use GPU if available
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    pipeline.to(device)

    diarization = pipeline(audio_path)

    turns = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        turns.append({
            "start": turn.start,
            "end": turn.end,
            "speaker": speaker,
        })

    return turns


def _overlap(s1: float, e1: float, s2: float, e2: float) -> float:
    """Calculate overlap duration between two time ranges."""
    start = max(s1, s2)
    end = min(e1, e2)
    return max(0, end - start)

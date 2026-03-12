"""Transcription router: trigger transcription, get transcript, map speakers."""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.models import Meeting, MeetingStatus, TranscriptSegment, User
from app.schemas import TranscriptSegmentOut, SpeakerMapping
from app.middleware.auth import get_current_user
from app.middleware.audit import log_action
from app.services.whisper_service import transcribe_audio
from app.services.diarization_service import diarize_and_merge

router = APIRouter(prefix="/meetings", tags=["Transcription"])


async def _run_transcription(meeting_id: str, db_url: str):
    """Background task: transcribe audio and store segments."""
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if not meeting or not meeting.audio_file_path:
            return

        meeting.status = MeetingStatus.TRANSCRIBING
        db.commit()

        # Step 1: Transcribe with Whisper
        raw_segments = await transcribe_audio(meeting.audio_file_path, meeting.language)

        # Step 2: Speaker diarization (if available)
        try:
            segments = await diarize_and_merge(meeting.audio_file_path, raw_segments)
        except Exception:
            # If diarization fails, use raw segments with no speaker info
            segments = raw_segments

        # Step 3: Store segments
        for idx, seg in enumerate(segments):
            ts = TranscriptSegment(
                meeting_id=meeting_id,
                speaker=seg.get("speaker", "Unknown"),
                speaker_label=seg.get("speaker_label", f"SPEAKER_{idx:02d}"),
                text=seg.get("text", ""),
                timestamp_start=seg.get("start"),
                timestamp_end=seg.get("end"),
                language=seg.get("language", meeting.language),
                segment_index=idx,
            )
            db.add(ts)

        meeting.status = MeetingStatus.TRANSCRIBED
        # Calculate duration from last segment
        if segments:
            last_end = max(s.get("end", 0) for s in segments)
            meeting.duration_seconds = int(last_end)

        db.commit()
    except Exception as e:
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if meeting:
            meeting.status = MeetingStatus.FAILED
            db.commit()
        raise e
    finally:
        db.close()


@router.post("/{meeting_id}/transcribe")
async def trigger_transcription(
    meeting_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if not meeting.audio_file_path:
        raise HTTPException(status_code=400, detail="No audio file uploaded")

    # Clear existing transcript if re-transcribing
    db.query(TranscriptSegment).filter(TranscriptSegment.meeting_id == meeting_id).delete()
    db.commit()

    background_tasks.add_task(_run_transcription, meeting_id, str(meeting_id))
    meeting.status = MeetingStatus.TRANSCRIBING
    db.commit()

    log_action(db, current_user.id, "TRANSCRIBE", "meeting", meeting_id)
    return {"detail": "Transcription started", "status": "transcribing"}


@router.get("/{meeting_id}/transcript", response_model=List[TranscriptSegmentOut])
async def get_transcript(
    meeting_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    segments = (
        db.query(TranscriptSegment)
        .filter(TranscriptSegment.meeting_id == meeting_id)
        .order_by(TranscriptSegment.segment_index)
        .all()
    )
    log_action(db, current_user.id, "READ", "transcript", meeting_id)
    return [TranscriptSegmentOut.model_validate(s) for s in segments]


@router.put("/{meeting_id}/speakers")
async def map_speakers(
    meeting_id: str,
    mapping: SpeakerMapping,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Map speaker labels to real names (e.g. SPEAKER_00 → 'Minister Sharma')."""
    segments = (
        db.query(TranscriptSegment)
        .filter(TranscriptSegment.meeting_id == meeting_id)
        .all()
    )
    if not segments:
        raise HTTPException(status_code=404, detail="No transcript found")

    updated = 0
    for seg in segments:
        if seg.speaker_label in mapping.mappings:
            seg.speaker = mapping.mappings[seg.speaker_label]
            updated += 1

    db.commit()
    log_action(db, current_user.id, "UPDATE_SPEAKERS", "transcript", meeting_id,
               {"mappings": mapping.mappings})
    return {"detail": f"Updated {updated} segments with speaker names"}

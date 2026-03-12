"""Summary router: generate, get, and edit meeting summaries."""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.models import Meeting, MeetingStatus, Summary, TranscriptSegment, User, SummaryType
from app.schemas import SummaryOut, SummaryEdit, SummarizeRequest
from app.middleware.auth import get_current_user
from app.middleware.audit import log_action
from app.services.summarization_service import generate_summary

router = APIRouter(prefix="/meetings", tags=["Summary"])


async def _run_summarization(meeting_id: str, summary_type: str, language: str):
    """Background task: generate meeting summary using LLM."""
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if not meeting:
            return

        meeting.status = MeetingStatus.SUMMARIZING
        db.commit()

        # Fetch transcript
        segments = (
            db.query(TranscriptSegment)
            .filter(TranscriptSegment.meeting_id == meeting_id)
            .order_by(TranscriptSegment.segment_index)
            .all()
        )

        transcript_text = "\n".join(
            f"[{s.speaker}] ({s.timestamp_start:.1f}s - {s.timestamp_end:.1f}s): {s.text}"
            if s.timestamp_start else f"[{s.speaker}]: {s.text}"
            for s in segments
        )

        # Generate summary
        result = await generate_summary(
            transcript=transcript_text,
            meeting_title=meeting.title,
            meeting_date=str(meeting.date),
            venue=meeting.venue,
            attendees=meeting.attendees or [],
            summary_type=summary_type,
            language=language,
        )

        # Store summary
        summary = Summary(
            meeting_id=meeting_id,
            summary_type=SummaryType(summary_type),
            language=language,
            content=result.get("structured", {}),
            raw_text=result.get("raw_text", ""),
        )
        db.add(summary)

        # Update meeting sentiment
        sentiment_val = result.get("structured", {}).get("sentiment")
        if sentiment_val:
            from app.models.models import Sentiment
            try:
                meeting.sentiment = Sentiment(sentiment_val.lower())
            except ValueError:
                pass

        meeting.status = MeetingStatus.COMPLETED
        db.commit()
    except Exception as e:
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if meeting:
            meeting.status = MeetingStatus.TRANSCRIBED  # Revert
            db.commit()
        raise e
    finally:
        db.close()


@router.post("/{meeting_id}/summarize")
async def trigger_summarization(
    meeting_id: str,
    req: SummarizeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Check transcript exists
    seg_count = db.query(TranscriptSegment).filter(
        TranscriptSegment.meeting_id == meeting_id
    ).count()
    if seg_count == 0:
        raise HTTPException(status_code=400, detail="No transcript found. Transcribe first.")

    background_tasks.add_task(_run_summarization, meeting_id, req.summary_type, req.language)
    log_action(db, current_user.id, "SUMMARIZE", "meeting", meeting_id)
    return {"detail": "Summarization started", "summary_type": req.summary_type}


@router.get("/{meeting_id}/summary", response_model=List[SummaryOut])
async def get_summaries(
    meeting_id: str,
    summary_type: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Summary).filter(Summary.meeting_id == meeting_id)
    if summary_type:
        query = query.filter(Summary.summary_type == summary_type)
    summaries = query.all()
    log_action(db, current_user.id, "READ", "summary", meeting_id)
    return [SummaryOut.model_validate(s) for s in summaries]


@router.put("/{meeting_id}/summary/{summary_id}", response_model=SummaryOut)
async def edit_summary(
    meeting_id: str,
    summary_id: str,
    edit: SummaryEdit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    summary = db.query(Summary).filter(
        Summary.id == summary_id, Summary.meeting_id == meeting_id
    ).first()
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    if edit.content is not None:
        summary.content = edit.content
    if edit.raw_text is not None:
        summary.raw_text = edit.raw_text
    if edit.is_finalized is not None:
        summary.is_finalized = edit.is_finalized
        if edit.is_finalized:
            summary.finalized_by = current_user.id

    db.commit()
    db.refresh(summary)
    log_action(db, current_user.id, "UPDATE", "summary", summary_id)
    return SummaryOut.model_validate(summary)

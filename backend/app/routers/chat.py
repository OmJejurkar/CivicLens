"""Chat router: Q&A over meeting transcript via RAG."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Meeting, TranscriptSegment, User
from app.schemas import ChatRequest, ChatResponse
from app.middleware.auth import get_current_user
from app.middleware.audit import log_action
from app.services.rag_service import ask_question

router = APIRouter(prefix="/meetings", tags=["Chat Q&A"])


@router.post("/{meeting_id}/chat", response_model=ChatResponse)
async def chat_about_meeting(
    meeting_id: str,
    req: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Get transcript
    segments = (
        db.query(TranscriptSegment)
        .filter(TranscriptSegment.meeting_id == meeting_id)
        .order_by(TranscriptSegment.segment_index)
        .all()
    )
    if not segments:
        raise HTTPException(status_code=400, detail="No transcript available")

    transcript_chunks = [
        {
            "text": s.text,
            "speaker": s.speaker,
            "start": s.timestamp_start,
            "end": s.timestamp_end,
        }
        for s in segments
    ]

    result = await ask_question(
        question=req.question,
        transcript_chunks=transcript_chunks,
        meeting_title=meeting.title,
        language=req.language,
    )

    log_action(db, current_user.id, "CHAT", "meeting", meeting_id,
               {"question": req.question})

    return ChatResponse(
        answer=result.get("answer", ""),
        sources=result.get("sources", []),
    )

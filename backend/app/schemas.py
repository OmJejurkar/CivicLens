"""Pydantic schemas for API request/response validation."""
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field


# ── Auth ──

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    full_name: str
    designation: str = ""
    department: str = ""
    role: str = "secretary"
    contact: str = ""


# ── User ──

class UserOut(BaseModel):
    id: str
    username: str
    email: str
    full_name: str
    designation: str
    department: str
    role: str
    contact: str

    class Config:
        from_attributes = True


# ── Meeting ──

class MeetingCreate(BaseModel):
    title: str
    description: str = ""
    date: Optional[datetime] = None
    venue: str = ""
    platform: str = ""
    confidentiality: str = "internal"
    language: str = "en"
    attendees: List[dict] = Field(default_factory=list)
    # Each attendee: {"name": "X", "designation": "Y", "department": "Z"}

class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[datetime] = None
    venue: Optional[str] = None
    platform: Optional[str] = None
    confidentiality: Optional[str] = None
    language: Optional[str] = None
    attendees: Optional[List[dict]] = None

class MeetingOut(BaseModel):
    id: str
    title: str
    description: str
    date: datetime
    venue: str
    platform: str
    status: str
    confidentiality: str
    sentiment: Optional[str] = None
    language: str
    duration_seconds: Optional[int] = None
    original_filename: Optional[str] = None
    attendees: List[Any] = Field(default_factory=list)
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    action_items_count: Optional[int] = 0
    has_summary: Optional[bool] = False

    class Config:
        from_attributes = True


# ── Transcript ──

class TranscriptSegmentOut(BaseModel):
    id: str
    speaker: str
    speaker_label: str
    text: str
    timestamp_start: Optional[float] = None
    timestamp_end: Optional[float] = None
    language: str
    agenda_item: Optional[str] = None
    segment_index: int

    class Config:
        from_attributes = True

class SpeakerMapping(BaseModel):
    mappings: dict  # {"SPEAKER_00": "Minister X", "SPEAKER_01": "Collector Y"}


# ── Summary ──

class SummaryOut(BaseModel):
    id: str
    meeting_id: str
    summary_type: str
    language: str
    content: dict
    raw_text: str
    is_finalized: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SummaryEdit(BaseModel):
    content: Optional[dict] = None
    raw_text: Optional[str] = None
    is_finalized: Optional[bool] = None

class SummarizeRequest(BaseModel):
    summary_type: str = "detailed"  # executive, detailed, verbatim
    language: str = "en"


# ── Action Items ──

class ActionItemOut(BaseModel):
    id: str
    meeting_id: str
    description: str
    assigned_to: str
    assigned_to_designation: str
    deadline: Optional[datetime] = None
    status: str
    priority: str
    notes: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ActionItemUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    deadline: Optional[datetime] = None
    priority: Optional[str] = None


# ── Documents ──

class DocumentBase(BaseModel):
    title: Optional[str] = None
    language: str = "en"

class DocumentCreate(DocumentBase):
    pass

class DocumentOut(DocumentBase):
    id: str
    filename: str
    file_type: str
    status: str
    summary: Optional[str] = None
    uploaded_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentChatRequest(BaseModel):
    question: str
    language: str = "en"


class DocumentChatResponse(BaseModel):
    answer: str
    sources: List[dict] = Field(default_factory=list)


# ── Chat ──

class ChatRequest(BaseModel):
    question: str
    language: str = "en"

class ChatResponse(BaseModel):
    answer: str
    sources: List[dict] = Field(default_factory=list)
    # Each source: {"text": "...", "speaker": "...", "timestamp": "..."}


# ── Export ──

class ExportRequest(BaseModel):
    format: str = "pdf"  # pdf, docx, json, text
    language: str = "en"


# Fix forward references
TokenResponse.model_rebuild()

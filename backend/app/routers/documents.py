"""Router for Document Upload, Summarization, and Q&A (RAG)."""
import os
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import User, Document, DocumentStatus
from app.middleware.auth import get_current_user
from app.schemas import DocumentOut, DocumentChatRequest, DocumentChatResponse
from app.services.document_service import save_and_extract_document
from app.services.rag_service import index_document, ask_document_question, ask_global_document_question
from app.services.summarization_service import _call_llm

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/documents", tags=["Documents"])


async def process_document_background(db: Session, document_id: str, extracted_text: str):
    """Background task to vectorize document and generate a summary."""
    # Use a fresh DB session for background task to avoid session closed errors
    from app.database import SessionLocal
    bg_db = SessionLocal()
    try:
        doc = bg_db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            logger.error(f"Background task: document {document_id} not found")
            return

        # 1. Mark as PROCESSING
        doc.status = DocumentStatus.PROCESSING
        bg_db.commit()
        logger.info(f"Document {document_id} ({doc.filename}): Starting processing...")

        # 2. Generate Summary
        logger.info(f"Document {document_id}: Generating AI summary...")
        system_prompt = "You are an expert at summarizing complex governance documents. Provide a clear, structured executive summary."
        user_prompt = f"Please provide a comprehensive executive summary of this document, highlighting key findings, decisions, action items, and recommendations:\n\n{extracted_text[:25000]}"
        summary = await _call_llm(system_prompt, user_prompt)
        
        doc.summary = summary
        bg_db.commit()
        logger.info(f"Document {document_id}: Summary generated ({len(summary)} chars)")

        # 3. Vectorize for RAG
        logger.info(f"Document {document_id}: Indexing for RAG...")
        meta = {"filename": doc.filename, "file_type": doc.file_type, "title": doc.title or doc.filename}
        num_chunks = await index_document(document_id, extracted_text, doc_metadata=meta)
        logger.info(f"Document {document_id}: Indexed {num_chunks} chunks")

        # 4. Mark as READY
        doc.status = DocumentStatus.READY
        bg_db.commit()
        logger.info(f"Document {document_id}: Processing complete ✅")

    except Exception as e:
        logger.exception(f"Document {document_id}: Background processing failed: {e}")
        try:
            doc = bg_db.query(Document).filter(Document.id == document_id).first()
            if doc:
                doc.status = DocumentStatus.FAILED
                doc.summary = f"Processing failed: {str(e)}"
                bg_db.commit()
        except Exception as inner:
            logger.error(f"Could not update failure status: {inner}")
    finally:
        bg_db.close()


# ── IMPORTANT: literal routes must come BEFORE parameterized routes ──

@router.post("/upload", response_model=DocumentOut)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    language: str = Form("en"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a document (PDF, DOCX, TXT) and process it for summarization and Q&A."""
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".pdf", ".docx", ".txt"]:
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, and TXT files are supported")
    
    db_doc, extracted_text = await save_and_extract_document(
        db=db,
        upload_file=file,
        uploaded_by=current_user.id,
        title=title,
        language=language
    )
    
    if extracted_text:
        background_tasks.add_task(process_document_background, db, db_doc.id, extracted_text)
    else:
        db_doc.status = DocumentStatus.FAILED
        db_doc.summary = "No text could be extracted from the document."
        db.commit()

    return db_doc


@router.get("/", response_model=List[DocumentOut])
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all documents uploaded."""
    return db.query(Document).order_by(Document.created_at.desc()).all()


@router.post("/assistant/chat", response_model=DocumentChatResponse)
async def global_assistant_chat(
    request: DocumentChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Ask questions across ALL processed documents (global RAG assistant)."""
    try:
        answer_data = await ask_global_document_question(
            question=request.question,
            language=request.language
        )
        return answer_data
    except Exception as e:
        logger.exception(f"Global assistant chat failed: {e}")
        raise HTTPException(status_code=500, detail=f"Assistant error: {str(e)}")


# ── Parameterized routes below ──

@router.get("/{document_id}", response_model=DocumentOut)
async def get_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get metadata and summary of an uploaded document."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.post("/{document_id}/chat", response_model=DocumentChatResponse)
async def chat_with_document(
    document_id: str,
    request: DocumentChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Ask questions about a specific document using RAG."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if doc.status.value != "ready":
        raise HTTPException(
            status_code=400,
            detail=f"Document is not ready for Q&A. Current status: {doc.status.value}"
        )
    
    try:
        answer_data = await ask_document_question(
            document_id=document_id,
            question=request.question,
            language=request.language
        )
        return answer_data
    except Exception as e:
        logger.exception(f"Document chat failed for {document_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")

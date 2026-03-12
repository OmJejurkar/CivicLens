"""RAG service: Q&A over meeting transcripts."""
from typing import List
from app.config import settings


async def ask_question(
    question: str,
    transcript_chunks: List[dict],
    meeting_title: str,
    language: str = "en",
) -> dict:
    """
    Answer a question about a meeting using the transcript as context.
    Uses a simple context-stuffing approach (suitable for most meetings).
    For very long transcripts, this can be upgraded to full ChromaDB RAG.
    """
    # Build context from transcript
    context_parts = []
    for chunk in transcript_chunks:
        speaker = chunk.get("speaker", "Unknown")
        text = chunk.get("text", "")
        start = chunk.get("start", 0)
        context_parts.append(f"[{speaker}] ({start:.0f}s): {text}")

    context = "\n".join(context_parts)

    # Limit context length
    if len(context) > 12000:
        # Simple relevance: search for chunks containing question keywords
        keywords = set(question.lower().split())
        relevant = []
        for chunk in transcript_chunks:
            text_lower = chunk.get("text", "").lower()
            score = sum(1 for kw in keywords if kw in text_lower)
            if score > 0:
                relevant.append((score, chunk))
        relevant.sort(key=lambda x: x[0], reverse=True)

        context_parts = []
        for _, chunk in relevant[:30]:
            speaker = chunk.get("speaker", "Unknown")
            text = chunk.get("text", "")
            start = chunk.get("start", 0)
            context_parts.append(f"[{speaker}] ({start:.0f}s): {text}")
        context = "\n".join(context_parts)

    system_prompt = """You are an AI assistant that answers questions about government meetings.
Use ONLY the provided transcript context to answer. If the answer is not in the context, say so.
Always cite the speaker and approximate timestamp when referencing specific statements.
Be precise and formal in your responses."""

    user_prompt = f"""Meeting: {meeting_title}

TRANSCRIPT CONTEXT:
{context}

QUESTION: {question}

Provide a clear, sourced answer. Cite specific speakers and what they said."""

    # Call LLM
    from app.services.summarization_service import _call_llm
    answer = await _call_llm(system_prompt, user_prompt)

    # Build source references
    sources = []
    keywords = set(question.lower().split())
    for chunk in transcript_chunks:
        text_lower = chunk.get("text", "").lower()
        if any(kw in text_lower for kw in keywords if len(kw) > 3):
            sources.append({
                "text": chunk.get("text", ""),
                "speaker": chunk.get("speaker", ""),
                "timestamp": f"{chunk.get('start', 0):.0f}s",
            })
            if len(sources) >= 5:
                break

    return {
        "answer": answer,
        "sources": sources,
    }

# ── Document RAG (LangChain + ChromaDB) ──

import os
import logging
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_core.prompts import PromptTemplate

logger = logging.getLogger(__name__)

# Initialize embeddings model locally
embeddings_model = HuggingFaceEmbeddings(
    model_name="all-MiniLM-L6-v2",
    model_kwargs={'device': 'cpu'},
    encode_kwargs={'normalize_embeddings': True}
)

def get_chroma_db(collection_name: str = "documents") -> Chroma:
    """Get the ChromaDB vector store instance."""
    persist_dir = settings.chroma_persist_dir
    os.makedirs(persist_dir, exist_ok=True)
    return Chroma(
        collection_name=collection_name,
        embedding_function=embeddings_model,
        persist_directory=persist_dir
    )

async def index_document(document_id: str, text: str, doc_metadata: dict = None) -> int:
    """Split extracted text into chunks and store in ChromaDB."""
    if not text.strip():
        logger.warning(f"No text to index for document {document_id}")
        return 0

    # 1. Chunking
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len
    )
    chunks = text_splitter.split_text(text)
    
    # 2. Add metadata
    metadatas = []
    base_meta = {"document_id": document_id}
    if doc_metadata:
        base_meta.update(doc_metadata)
        
    for i, _ in enumerate(chunks):
        chunk_meta = base_meta.copy()
        chunk_meta["chunk_index"] = i
        metadatas.append(chunk_meta)

    # 3. Store in Vector DB
    vector_db = get_chroma_db()
    vector_db.add_texts(texts=chunks, metadatas=metadatas)
    
    return len(chunks)


async def ask_document_question(
    document_id: str,
    question: str,
    language: str = "en",
    top_k: int = 4
) -> dict:
    """Retrieve relevant chunks from ChromaDB and answer a question."""
    
    # 1. Retrieve context
    vector_db = get_chroma_db()
    
    # Filter by document_id
    search_kwargs = {
        "k": top_k, 
        "filter": {"document_id": document_id}
    }
    
    retriever = vector_db.as_retriever(search_kwargs=search_kwargs)
    docs = retriever.invoke(question)
    
    if not docs:
        return {
            "answer": "I could not find relevant information in this document to answer your question.",
            "sources": []
        }
    
    context = "\n\n".join([f"--- Chunk {i+1} ---\n{doc.page_content}" for i, doc in enumerate(docs)])
    
    # 2. Build Prompt
    system_prompt = "You are a highly capable AI assistant helping analyze an uploaded document."
    user_prompt = f"""Use the following pieces of retrieved context to answer the question at the end. 
Keep the answer concise but thorough. If you don't know the answer based on the context, just say that you don't know, don't try to make up an answer.

CONTEXT:
{context}

QUESTION: {question}

Helpful Answer:"""

    # 3. Call LLM
    from app.services.summarization_service import _call_llm
    answer = await _call_llm(system_prompt, user_prompt)
    
    # 4. Format Sources
    sources = []
    for i, doc in enumerate(docs):
        sources.append({
            "text": doc.page_content[:200] + "...",  # truncated snippet
            "chunk_index": doc.metadata.get("chunk_index", i),
            "relevance": "High"
        })
        
    return {
        "answer": answer,
        "sources": sources
    }


async def ask_global_document_question(
    question: str,
    language: str = "en",
    top_k: int = 5
) -> dict:
    """Retrieve relevant chunks from ALL documents in ChromaDB and answer a question."""
    
    # 1. Retrieve context
    vector_db = get_chroma_db()
    
    # No filter, search across all documents
    search_kwargs = {
        "k": top_k
    }
    
    retriever = vector_db.as_retriever(search_kwargs=search_kwargs)
    docs = retriever.invoke(question)
    
    if not docs:
        return {
            "answer": "I could not find any information in your documents to answer your question. Please ensure you have uploaded and processed some documents first.",
            "sources": []
        }
    
    # Context with document source info
    context_parts = []
    for i, doc in enumerate(docs):
        filename = doc.metadata.get("filename", "Unknown Document")
        context_parts.append(f"--- Context Segment {i+1} (Source: {filename}) ---\n{doc.page_content}")
    
    context = "\n\n".join(context_parts)
    
    # 2. Build Prompt
    system_prompt = "You are a professional Governance Assistant. Answer questions based on the provided document context from multiple official files."
    user_prompt = f"""You are analyzing a set of government documents. Use the provided context segments to answer the question.
If the information is not present, clearly state that. If different documents say different things, please highlight that.

CONTEXT:
{context}

QUESTION: {question}

Detailed Answer:"""

    # 3. Call LLM
    from app.services.summarization_service import _call_llm
    answer = await _call_llm(system_prompt, user_prompt)
    
    # 4. Format Sources
    sources = []
    for i, doc in enumerate(docs):
        sources.append({
            "text": doc.page_content[:200] + "...",
            "filename": doc.metadata.get("filename", "Unknown"),
            "document_id": doc.metadata.get("document_id"),
            "relevance": "High"
        })
        
    return {
        "answer": answer,
        "sources": sources
    }

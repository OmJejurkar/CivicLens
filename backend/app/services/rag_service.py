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

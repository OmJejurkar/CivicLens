'use client';
import { useState, useEffect, useRef } from 'react';
import { Bot, Send, Sparkles, User, Loader2, BrainCircuit, FileSearch, MessageCircle } from 'lucide-react';
import api from '@/lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
  mode?: 'document' | 'general';
}

const SUGGESTION_PROMPTS = [
  "What are the key findings in the uploaded reports?",
  "Summarize the pending action items from all meetings.",
  "What decisions were taken in recent consultations?",
  "Identify any budget-related information in the documents."
];

// Detect if the question is conversational (greeting, general, etc.)
const isConversational = (q: string) => {
  const patterns = /^(hi|hello|hey|namaste|how are you|what is|who are you|what can you|help me|thanks|thank you|good morning|good evening)\b/i;
  return patterns.test(q.trim()) || q.trim().split(' ').length <= 3;
};

const generalAnswer = (question: string): string | null => {
  const q = question.toLowerCase().trim();
  if (/^(hi|hello|hey|namaste)/.test(q)) {
    return "Hello! I'm CivicLens AI, your governance intelligence assistant. I can answer questions based on your uploaded documents and meeting records. How can I help you today?";
  }
  if (/how are you/.test(q)) {
    return "I'm functioning well, thank you! I'm ready to assist you with governance insights. Would you like me to analyze one of your uploaded documents?";
  }
  if (/who are you|what are you/.test(q)) {
    return "I'm CivicLens AI — an intelligent governance assistant built to help public administrators analyze documents, extract key decisions, and search across all your official records instantly.";
  }
  if (/what can you|help/.test(q)) {
    return "I can:\n• Summarize uploaded governance documents (PDFs, Reports, Memos)\n• Answer questions about meeting transcripts\n• Find specific data, decisions, and action items across all records\n• Compare information across multiple documents\n\nTry asking: \"What are the key findings in my uploaded reports?\"";
  }
  if (/thank/.test(q)) {
    return "You're welcome! Feel free to ask anything else about your governance data.";
  }
  return null;
};

export default function AssistantPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (question: string) => {
    const q = question || input;
    if (!q.trim() || loading) return;
    setInput('');

    const userMsg: Message = { role: 'user', content: q };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Check for general conversational queries first
    const localAnswer = generalAnswer(q);
    if (localAnswer) {
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'assistant', content: localAnswer, mode: 'general' }]);
        setLoading(false);
      }, 500);
      return;
    }

    // Otherwise go to document RAG
    try {
      const res = await api.globalAssistantChat(q);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.answer,
        sources: res.sources,
        mode: 'document'
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `I encountered an error: ${err.message}. Please ensure you have uploaded and processed some documents first.`,
        mode: 'general'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a1628' }}>
      {/* Header */}
      <div style={{ padding: '20px 32px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(11,29,53,0.4)' }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(212,168,67,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f0d078' }}>
          <Bot size={24} />
        </div>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>CivicLens AI Assistant</h1>
          <p style={{ color: '#64748b', fontSize: 12 }}>Powered by document intelligence & meeting analysis</p>
        </div>
      </div>

      {/* Chat body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center', gap: 20 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(212,168,67,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f0d078' }}>
              <Sparkles size={36} />
            </div>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>Hello! How can I help you?</h2>
              <p style={{ color: '#64748b', fontSize: 14, maxWidth: 440, lineHeight: 1.6 }}>
                I can answer general questions, summarize your documents, or find specific information across all uploaded governance records.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8, maxWidth: 640 }}>
              {SUGGESTION_PROMPTS.map((hint, i) => (
                <button key={i} onClick={() => handleSend(hint)}
                  style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, color: '#94a3b8', fontSize: 13, textAlign: 'left', cursor: 'pointer', lineHeight: 1.4, transition: 'all 0.2s' }}
                  onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(212,168,67,0.3)'; }}
                  onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.07)'; }}>
                  {hint}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 12, alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              {msg.role === 'assistant' && (
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(212,168,67,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f0d078', flexShrink: 0 }}>
                  <Bot size={18} />
                </div>
              )}
              <div style={{
                padding: '12px 18px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: msg.role === 'user' ? '#f0d078' : 'rgba(255,255,255,0.05)',
                color: msg.role === 'user' ? '#0a1628' : '#e2e8f0',
                fontSize: 14, lineHeight: 1.7, fontWeight: msg.role === 'user' ? 500 : 400,
                border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                whiteSpace: 'pre-wrap'
              }}>
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', flexShrink: 0 }}>
                  <User size={18} />
                </div>
              )}
            </div>

            {/* Source badges */}
            {msg.sources && msg.sources.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 44 }}>
                {msg.sources.slice(0, 4).map((src, i) => (
                  <span key={i} style={{ fontSize: 11, background: 'rgba(212,168,67,0.08)', color: '#d4a843', padding: '3px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5, border: '1px solid rgba(212,168,67,0.15)' }}>
                    <FileSearch size={11} /> {src.filename || 'Document'}
                  </span>
                ))}
                <span style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <BrainCircuit size={11} /> Based on indexed documents
                </span>
              </div>
            )}
            {msg.mode === 'general' && msg.role === 'assistant' && (
              <div style={{ paddingLeft: 44 }}>
                <span style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MessageCircle size={11} /> General response
                </span>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 12, alignSelf: 'flex-start' }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(212,168,67,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f0d078' }}>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
            <div style={{ padding: '12px 18px', borderRadius: '18px 18px 18px 4px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BrainCircuit size={16} /> Searching documents...
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input area */}
      <div style={{ padding: '20px 32px 36px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(11,29,53,0.2)' }}>
        <form onSubmit={handleSubmit} style={{ maxWidth: 860, margin: '0 auto', position: 'relative' }}>
          <input
            className="input-field"
            placeholder="Ask anything — documents, meetings, or just say hello..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
            style={{ height: 56, padding: '0 60px 0 22px', fontSize: 15, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <button type="submit" disabled={!input.trim() || loading}
            style={{ position: 'absolute', right: 10, top: 10, width: 36, height: 36, borderRadius: 10, background: input.trim() ? '#f0d078' : '#334155', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() ? 'pointer' : 'default', color: '#0a1628', transition: 'all 0.2s' }}>
            <Send size={16} />
          </button>
        </form>
        <p style={{ textAlign: 'center', color: '#475569', fontSize: 11, marginTop: 10 }}>
          CivicLens AI · Responses grounded in your governance records
        </p>
      </div>
    </div>
  );
}

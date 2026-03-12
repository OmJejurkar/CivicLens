'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { 
  ChevronLeft, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MessageSquare, 
  Send, 
  BrainCircuit,
  Loader2,
  RefreshCw,
  FileText
} from 'lucide-react';

const statusIs = (docStatus: string, target: string) =>
  docStatus?.toLowerCase() === target.toLowerCase();

const isProcessing = (docStatus: string) =>
  ['uploaded', 'processing', 'pending'].includes(docStatus?.toLowerCase());

const isReady = (docStatus: string) => statusIs(docStatus, 'ready');
const isFailed = (docStatus: string) => statusIs(docStatus, 'failed');

export default function DocumentDetail() {
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;

  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDoc = useCallback(async () => {
    try {
      const data = await api.getDocument(docId);
      setDoc(data);
      return data;
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [docId]);

  const startPolling = useCallback(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(async () => {
      try {
        const updated = await api.getDocument(docId);
        setDoc(updated);
        if (isReady(updated.status) || isFailed(updated.status)) {
          if (pollTimer.current) clearInterval(pollTimer.current);
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 2500);
  }, [docId]);

  useEffect(() => {
    loadDoc().then((data) => {
      if (data && isProcessing(data.status)) {
        startPolling();
      }
    });
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [docId]);

  // Start polling if doc status changes to processing
  useEffect(() => {
    if (doc && isProcessing(doc.status)) {
      startPolling();
    }
  }, [doc?.status]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMsg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatLoading(true);

    try {
      const res = await api.chatWithDocument(docId, userMsg);
      setChatMessages(prev => [...prev, { role: 'assistant', content: res.answer }]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <Loader2 size={36} style={{ color: '#f0d078', animation: 'spin 1s linear infinite' }} />
      <p style={{ color: '#94a3b8' }}>Loading document...</p>
    </div>
  );

  if (!doc) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <h2 style={{ color: '#f1f5f9', marginBottom: 16 }}>Document not found</h2>
      <button className="btn-secondary" onClick={() => router.push('/documents')}>
        Back to Documents
      </button>
    </div>
  );

  const docIsReady = isReady(doc.status);
  const docIsFailed = isFailed(doc.status);
  const docIsProcessing = isProcessing(doc.status);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a1628' }}>
      {/* Header */}
      <header style={{ 
        padding: '16px 32px', 
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(10, 22, 40, 0.8)',
        backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', gap: 16
      }}>
        <button onClick={() => router.push('/documents')} className="btn-icon">
          <ChevronLeft size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>
            {doc.title || doc.filename}
          </h1>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={14} /> {new Date(doc.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span style={{ 
              fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
              background: docIsReady ? 'rgba(16,185,129,0.15)' : docIsFailed ? 'rgba(244,63,94,0.15)' : 'rgba(245,158,11,0.15)',
              color: docIsReady ? '#10b981' : docIsFailed ? '#f43f5e' : '#f59e0b',
              display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.05em'
            }}>
              {docIsReady && <CheckCircle2 size={12} />}
              {docIsFailed && <AlertCircle size={12} />}
              {docIsProcessing && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
              {doc.status}
            </span>
          </div>
        </div>
        {docIsProcessing && (
          <button onClick={() => loadDoc()} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        )}
      </header>

      {/* Content Split View */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.2fr 1fr', overflow: 'hidden' }}>
        {/* Left: Summary & Metadata */}
        <div style={{ padding: 32, overflowY: 'auto', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
          {/* AI Summary */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BrainCircuit size={18} color="#f0d078" /> AI Executive Summary
            </h2>
            <div className="glass-card" style={{ padding: 24, minHeight: 200 }}>
              {docIsReady && doc.summary ? (
                <div style={{ fontSize: 14, color: '#e2e8f0', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
                  {doc.summary}
                </div>
              ) : docIsReady && !doc.summary ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                  <BrainCircuit size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                  <p>Summary not generated yet. This document has been indexed for chat.</p>
                </div>
              ) : docIsFailed ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <AlertCircle size={32} color="#f43f5e" style={{ margin: '0 auto 12px' }} />
                  <p style={{ color: '#fb7185' }}>
                    {doc.summary?.includes('failed') ? doc.summary : 'Processing failed. Please try re-uploading.'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 180, gap: 16 }}>
                  <Loader2 size={32} style={{ color: '#f0d078', animation: 'spin 1s linear infinite' }} />
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#f0d078', fontWeight: 600, marginBottom: 4 }}>Generating AI Summary...</p>
                    <p style={{ color: '#64748b', fontSize: 13 }}>This might take 30-60 seconds. The page will auto-update.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Document Metadata */}
          <div>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
              Document Information
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { label: 'FILE NAME', value: doc.filename },
                { label: 'FILE TYPE', value: doc.file_type?.toUpperCase() },
                { label: 'LANGUAGE', value: doc.language === 'en' ? 'English' : doc.language },
                { label: 'STATUS', value: doc.status?.toUpperCase() },
              ].map((item, i) => (
                <div key={i} className="glass-card" style={{ padding: 16 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: AI Chat */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.1)' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <MessageSquare size={18} color="#d4a843" />
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>Ask this Document</h2>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {chatMessages.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(212,168,67,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f0d078', margin: '0 auto 16px' }}>
                  <FileText size={24} />
                </div>
                {docIsReady ? (
                  <p style={{ color: '#64748b', fontSize: 13 }}>
                    I've indexed this document. Ask me about specific details, figures, or policies mentioned in it.
                  </p>
                ) : (
                  <p style={{ color: '#64748b', fontSize: 13 }}>
                    Chat will be enabled once the document finishes processing.
                  </p>
                )}
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} style={{ 
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%', padding: '12px 16px', borderRadius: 16,
                background: msg.role === 'user' ? 'rgba(212, 168, 67, 0.2)' : 'rgba(255,255,255,0.05)',
                border: '1px solid ' + (msg.role === 'user' ? 'rgba(212, 168, 67, 0.2)' : 'rgba(255,255,255,0.08)'),
                fontSize: 14, lineHeight: 1.6, color: '#e2e8f0'
              }}>
                {msg.content}
              </div>
            ))}
            {chatLoading && (
              <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.05)', padding: '14px 18px', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 14 }}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />  Analyzing document...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleChat} style={{ padding: 24, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {!docIsReady && (
              <div style={{ textAlign: 'center', color: '#64748b', fontSize: 12, marginBottom: 12 }}>
                {docIsProcessing ? '⏳ Waiting for processing to complete...' : '📄 Document must be ready to enable chat.'}
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <input 
                className="input-field" 
                placeholder={docIsReady ? "Ask about this document..." : "Chat available after processing..."} 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                disabled={!docIsReady || chatLoading}
                style={{ height: 48, paddingRight: 50 }}
              />
              <button 
                type="submit" 
                disabled={!chatInput.trim() || chatLoading || !docIsReady}
                style={{ 
                  position: 'absolute', right: 8, top: 8, width: 32, height: 32, 
                  borderRadius: 8, background: docIsReady ? '#f0d078' : '#334155', border: 'none', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: docIsReady ? 'pointer' : 'not-allowed', color: '#0a1628'
                }}
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

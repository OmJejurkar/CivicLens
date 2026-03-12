'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/api';
import { 
  FileText, FileUp, BrainCircuit, Loader2, CheckCircle2, 
  AlertCircle, RefreshCw, MessageSquare, Send, ChevronRight, X
} from 'lucide-react';

const statusColor = (s: string) => {
  const l = s?.toLowerCase();
  if (l === 'ready') return { bg: 'rgba(16,185,129,0.15)', color: '#10b981' };
  if (l === 'failed') return { bg: 'rgba(244,63,94,0.15)', color: '#f43f5e' };
  return { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' };
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>|null>(null);

  useEffect(() => { loadDocs(); }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Poll selectedDoc status if processing
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (selectedDoc && ['uploaded','processing','pending'].includes(selectedDoc.status?.toLowerCase())) {
      pollRef.current = setInterval(async () => {
        try {
          const updated = await api.getDocument(selectedDoc.id);
          setSelectedDoc(updated);
          setDocuments(prev => prev.map(d => d.id === updated.id ? updated : d));
          if (['ready','failed'].includes(updated.status?.toLowerCase())) {
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch (e) { console.error(e); }
      }, 2500);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedDoc?.id, selectedDoc?.status]);

  const loadDocs = async () => {
    try {
      const docs = await api.getDocuments();
      setDocuments(docs);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  const handleSelectDoc = async (doc: any) => {
    setChatMessages([]);
    setChatInput('');
    if (doc.status?.toLowerCase() === 'ready' && !doc.summary) {
      const fresh = await api.getDocument(doc.id).catch(() => doc);
      setSelectedDoc(fresh);
    } else {
      setSelectedDoc(doc);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.uploadDocument(file);
      await loadDocs();
      setSelectedDoc(res);
    } catch (err: any) { alert(err.message); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading || !selectedDoc) return;
    const msg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: msg }]);
    setChatLoading(true);
    try {
      const res = await api.chatWithDocument(selectedDoc.id, msg);
      setChatMessages(prev => [...prev, { role: 'assistant', content: res.answer }]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally { setChatLoading(false); }
  };

  const isReady = selectedDoc?.status?.toLowerCase() === 'ready';
  const isProcessing = ['uploaded','processing','pending'].includes(selectedDoc?.status?.toLowerCase());

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a1628' }}>
      {/* Header */}
      <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>Document Intelligence</h1>
          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>Upload, summarize, and interrogate governance documents.</p>
        </div>
        <label className="btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          {uploading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <FileUp size={16} />}
          {uploading ? 'Uploading...' : 'Upload Document'}
          <input type="file" hidden accept=".pdf,.docx,.txt" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {/* Main 2-column layout */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '320px 1fr', overflow: 'hidden' }}>
        {/* Left: Document List */}
        <div style={{ borderRight: '1px solid rgba(255,255,255,0.05)', overflowY: 'auto', padding: 16 }}>
          {loading ? (
            [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12, marginBottom: 8 }} />)
          ) : documents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
              <FileText size={32} style={{ margin: '0 auto 12px' }} />
              <p>No documents yet. Upload one to get started.</p>
            </div>
          ) : documents.map(doc => {
            const sc = statusColor(doc.status);
            const isSelected = selectedDoc?.id === doc.id;
            return (
              <div
                key={doc.id}
                onClick={() => handleSelectDoc(doc)}
                style={{
                  padding: '14px 16px', borderRadius: 12, marginBottom: 6, cursor: 'pointer',
                  background: isSelected ? 'rgba(212,168,67,0.1)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isSelected ? 'rgba(212,168,67,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0 }}>
                      <FileText size={16} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {doc.title || doc.filename}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {doc.file_type?.toUpperCase()} · {new Date(doc.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: sc.bg, color: sc.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {doc.status?.toUpperCase()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Document Detail / Summary / Chat */}
        {!selectedDoc ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, color: '#64748b' }}>
            <BrainCircuit size={48} style={{ opacity: 0.3 }} />
            <p style={{ fontSize: 15 }}>Select a document to view summary and AI insights</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Doc header */}
            <div style={{ padding: '16px 28px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{selectedDoc.title || selectedDoc.filename}</h2>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{selectedDoc.file_type?.toUpperCase()}</span>
                  <span style={{ fontSize: 12, color: statusColor(selectedDoc.status).color, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isReady && <CheckCircle2 size={12} />}
                    {isProcessing && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                    {selectedDoc?.status?.toLowerCase() === 'failed' && <AlertCircle size={12} />}
                    {selectedDoc.status?.toUpperCase()}
                  </span>
                </div>
              </div>
              {isProcessing && (
                <button onClick={() => handleSelectDoc(selectedDoc)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <RefreshCw size={14} /> Refresh
                </button>
              )}
            </div>

            {/* Summary + Chat split */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>
              {/* Summary */}
              <div style={{ padding: 28, overflowY: 'auto', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BrainCircuit size={16} color="#f0d078" /> AI Executive Summary
                </h3>
                <div className="glass-card" style={{ padding: 20, minHeight: 200 }}>
                  {isReady && selectedDoc.summary ? (
                    <p style={{ fontSize: 14, color: '#e2e8f0', lineHeight: 1.9, whiteSpace: 'pre-wrap', margin: 0 }}>
                      {selectedDoc.summary}
                    </p>
                  ) : isReady && !selectedDoc.summary ? (
                    <p style={{ color: '#64748b', fontSize: 13 }}>Summary not available for this document.</p>
                  ) : selectedDoc?.status?.toLowerCase() === 'failed' ? (
                    <div style={{ textAlign: 'center', padding: 20 }}>
                      <AlertCircle size={28} color="#f43f5e" style={{ margin: '0 auto 10px' }} />
                      <p style={{ color: '#fb7185', fontSize: 13 }}>Processing failed. Please re-upload.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, gap: 12 }}>
                      <Loader2 size={28} style={{ color: '#f0d078', animation: 'spin 1s linear infinite' }} />
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ color: '#f0d078', fontWeight: 600, marginBottom: 4, fontSize: 14 }}>Generating AI Summary...</p>
                        <p style={{ color: '#64748b', fontSize: 12 }}>Auto-refreshes every 2.5 seconds. This may take 1-2 minutes.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Chat */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MessageSquare size={16} color="#d4a843" />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Ask this Document</span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {chatMessages.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 30, color: '#64748b', fontSize: 13 }}>
                      {isReady ? 'Ask anything about the content of this document.' : 'Chat enabled once processing is complete.'}
                    </div>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div key={i} style={{
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%',
                      padding: '10px 14px', borderRadius: 14, fontSize: 13, lineHeight: 1.6,
                      background: msg.role === 'user' ? 'rgba(212,168,67,0.2)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${msg.role === 'user' ? 'rgba(212,168,67,0.2)' : 'rgba(255,255,255,0.06)'}`,
                      color: '#e2e8f0'
                    }}>
                      {msg.content}
                    </div>
                  ))}
                  {chatLoading && (
                    <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.04)', padding: '10px 14px', borderRadius: 14, display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#94a3b8' }}>
                      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Analyzing...
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={handleChat} style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="input-field"
                      placeholder={isReady ? 'Ask about this document...' : 'Available after processing...'}
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      disabled={!isReady || chatLoading}
                      style={{ height: 44, paddingRight: 48, fontSize: 13 }}
                    />
                    <button type="submit" disabled={!isReady || !chatInput.trim() || chatLoading}
                      style={{ position: 'absolute', right: 8, top: 8, width: 28, height: 28, borderRadius: 8, background: isReady ? '#f0d078' : '#334155', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isReady ? 'pointer' : 'default', color: '#0a1628' }}>
                      <Send size={14} />
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

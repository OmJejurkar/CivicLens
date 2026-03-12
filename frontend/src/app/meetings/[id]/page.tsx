'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function MeetingDetail() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.id as string;

  const [meeting, setMeeting] = useState<any>(null);
  const [transcript, setTranscript] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'chat' | 'actions' | 'export'>('summary');

  // Upload
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Summary editing
  const [editingSummary, setEditingSummary] = useState(false);
  const [editedContent, setEditedContent] = useState('');

  // Speaker mapping
  const [showSpeakerModal, setShowSpeakerModal] = useState(false);
  const [speakerMappings, setSpeakerMappings] = useState<Record<string, string>>({});

  useEffect(() => {
    loadMeetingData();
  }, [meetingId]);

  const loadMeetingData = async () => {
    setLoading(true);
    try {
      const [meetingData, transcriptData, summaryData, actionData] = await Promise.all([
        api.getMeeting(meetingId),
        api.getTranscript(meetingId).catch(() => []),
        api.getSummaries(meetingId).catch(() => []),
        api.getActions(meetingId).catch(() => []),
      ]);
      setMeeting(meetingData);
      setTranscript(transcriptData);
      setSummaries(summaryData);
      setActions(actionData);

      // Extract unique speakers for mapping
      const speakers = new Set(transcriptData.map((s: any) => s.speaker_label).filter(Boolean));
      const existing: Record<string, string> = {};
      speakers.forEach((s: any) => { existing[s] = ''; });
      setSpeakerMappings(existing);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadAudio(meetingId, file);
      await loadMeetingData();
    } catch (err: any) {
      alert(err.message);
    }
    setUploading(false);
  };

  const handleTranscribe = async () => {
    try {
      await api.transcribe(meetingId);
      // Poll for status changes
      const poll = setInterval(async () => {
        const m = await api.getMeeting(meetingId);
        setMeeting(m);
        if (!['transcribing', 'summarizing'].includes(m.status)) {
          clearInterval(poll);
          loadMeetingData();
        }
      }, 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSummarize = async (type: string = 'detailed') => {
    try {
      await api.summarize(meetingId, type);
      const poll = setInterval(async () => {
        const m = await api.getMeeting(meetingId);
        setMeeting(m);
        if (!['summarizing'].includes(m.status)) {
          clearInterval(poll);
          loadMeetingData();
        }
      }, 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const question = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: question }]);
    setChatLoading(true);

    try {
      const res = await api.chat(meetingId, question);
      setChatMessages(prev => [...prev, {
        role: 'assistant', content: res.answer, sources: res.sources
      }]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    }
    setChatLoading(false);
  };

  const handleSpeakerMap = async () => {
    const validMappings: Record<string, string> = {};
    Object.entries(speakerMappings).forEach(([label, name]) => {
      if (name.trim()) validMappings[label] = name.trim();
    });
    if (Object.keys(validMappings).length === 0) return;
    try {
      await api.mapSpeakers(meetingId, validMappings);
      setShowSpeakerModal(false);
      loadMeetingData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExport = async (format: string) => {
    try {
      const data = await api.exportMeeting(meetingId, format);
      if (data instanceof Blob) {
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meeting_${meetingId.slice(0, 8)}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // JSON
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meeting_${meetingId.slice(0, 8)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleActionStatusUpdate = async (actionId: string, newStatus: string) => {
    try {
      await api.updateAction(actionId, { status: newStatus });
      loadMeetingData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const formatTimestamp = (seconds: number) => {
    if (!seconds && seconds !== 0) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Speaker color map
  const speakerColors: Record<string, string> = {};
  const colors = ['#8b5cf6', '#0d9488', '#f59e0b', '#f43f5e', '#3b82f6', '#10b981', '#ec4899', '#06b6d4'];
  const uniqueSpeakers = [...new Set(transcript.map(s => s.speaker))];
  uniqueSpeakers.forEach((s, i) => { speakerColors[s] = colors[i % colors.length]; });

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="skeleton" style={{ width: 200, height: 30, borderRadius: 8 }} />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Meeting not found</p>
      </div>
    );
  }

  const currentSummary = summaries[0];

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <header style={{
        background: 'rgba(10, 22, 40, 0.85)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(212, 168, 67, 0.1)',
        padding: '12px 32px', display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <button onClick={() => router.push('/')} className="btn-icon" style={{ fontSize: 20 }}>
          ←
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: '#f0d078' }}>{meeting.title}</h1>
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
            <span>📅 {new Date(meeting.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            {meeting.venue && <span>📍 {meeting.venue}</span>}
            <span className={`badge badge-${meeting.status}`} style={{ fontSize: 10 }}>{meeting.status}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {!meeting.audio_file_path && (
            <>
              <input ref={fileInputRef} type="file" accept="audio/*,video/*" onChange={handleFileUpload} style={{ display: 'none' }} />
              <button className="btn-primary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? '⏳ Uploading...' : '📁 Upload Audio/Video'}
              </button>
            </>
          )}
          {meeting.status === 'uploaded' && (
            <button className="btn-primary" onClick={handleTranscribe}>
              🎙️ Transcribe
            </button>
          )}
          {(meeting.status === 'transcribed' || meeting.status === 'completed') && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn-primary" onClick={() => handleSummarize('detailed')}>
                📝 Summarize
              </button>
              <button className="btn-secondary" onClick={() => handleSummarize('executive')}>
                📋 Executive
              </button>
            </div>
          )}
          {transcript.length > 0 && (
            <button className="btn-secondary" onClick={() => setShowSpeakerModal(true)}>
              👥 Map Speakers
            </button>
          )}
        </div>
      </header>

      {/* Processing indicator */}
      {['transcribing', 'summarizing'].includes(meeting.status) && (
        <div style={{
          background: 'rgba(59, 130, 246, 0.1)', borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
          padding: '10px 32px', display: 'flex', alignItems: 'center', gap: 12,
          animation: 'pulse-badge 2s infinite',
        }}>
          <span style={{ fontSize: 20 }}>⚙️</span>
          <span style={{ color: '#60a5fa', fontSize: 14 }}>
            {meeting.status === 'transcribing' ? 'Transcribing audio with AI...' : 'Generating AI summary...'}
          </span>
        </div>
      )}

      {/* Main content: Split view */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: 'calc(100vh - 80px)' }}>

        {/* LEFT: Transcript */}
        <div style={{
          borderRight: '1px solid rgba(255,255,255,0.06)', overflowY: 'auto', padding: 24,
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#94a3b8', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            🎙️ Transcript
            <span style={{ fontSize: 12, color: '#64748b' }}>({transcript.length} segments)</span>
          </h2>

          {transcript.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎧</div>
              <p>No transcript yet. Upload audio and click Transcribe.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {transcript.map((seg, i) => (
                <div key={seg.id} className="animate-fade-in" style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.02)',
                  borderLeft: `3px solid ${speakerColors[seg.speaker] || '#64748b'}`,
                  transition: 'background 0.2s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: speakerColors[seg.speaker] || '#94a3b8',
                    }}>
                      {seg.speaker}
                    </span>
                    <span style={{ fontSize: 11, color: '#475569' }}>
                      {formatTimestamp(seg.timestamp_start)} - {formatTimestamp(seg.timestamp_end)}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.6 }}>{seg.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: Summary / Chat / Actions / Export */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Tabs */}
          <div style={{
            display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.06)',
            padding: '0 24px', position: 'sticky', top: 0,
            background: 'rgba(10, 22, 40, 0.95)', backdropFilter: 'blur(12px)', zIndex: 10,
          }}>
            {[
              { key: 'summary', icon: '📝', label: 'Summary' },
              { key: 'chat', icon: '💬', label: 'Ask AI' },
              { key: 'actions', icon: '📌', label: `Actions (${actions.length})` },
              { key: 'export', icon: '📤', label: 'Export' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                style={{
                  padding: '14px 20px', fontSize: 13, fontWeight: 500,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: activeTab === tab.key ? '#f0d078' : '#64748b',
                  borderBottom: activeTab === tab.key ? '2px solid #d4a843' : '2px solid transparent',
                  display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <div style={{ padding: 24, flex: 1 }}>
            {/* Summary Tab */}
            {activeTab === 'summary' && (
              <div className="animate-fade-in">
                {currentSummary ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                      <span className={`badge badge-${currentSummary.summary_type}`}>
                        {currentSummary.summary_type} summary
                      </span>
                      <button
                        className="btn-secondary"
                        onClick={() => { setEditingSummary(!editingSummary); setEditedContent(currentSummary.raw_text); }}
                        style={{ fontSize: 12, padding: '6px 14px' }}
                      >
                        {editingSummary ? '✕ Cancel' : '✏️ Edit'}
                      </button>
                    </div>

                    {editingSummary ? (
                      <div>
                        <textarea
                          className="input-field"
                          value={editedContent}
                          onChange={e => setEditedContent(e.target.value)}
                          rows={20}
                          style={{ fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <button className="btn-primary" onClick={async () => {
                            await api.editSummary(meetingId, currentSummary.id, { raw_text: editedContent });
                            setEditingSummary(false);
                            loadMeetingData();
                          }}>
                            💾 Save
                          </button>
                          <button className="btn-primary" onClick={async () => {
                            await api.editSummary(meetingId, currentSummary.id, { raw_text: editedContent, is_finalized: true });
                            setEditingSummary(false);
                            loadMeetingData();
                          }}>
                            ✅ Finalize
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="glass-card" style={{ padding: 24 }}>
                        {/* Structured summary display */}
                        {currentSummary.content?.agenda_items && (
                          <div style={{ marginBottom: 20 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#d4a843', marginBottom: 10 }}>🗂 Agenda Items</h3>
                            <ol style={{ paddingLeft: 20, fontSize: 13, color: '#e2e8f0', lineHeight: 1.8 }}>
                              {currentSummary.content.agenda_items.map((item: string, i: number) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {currentSummary.content?.key_points && (
                          <div style={{ marginBottom: 20 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#d4a843', marginBottom: 10 }}>📝 Key Points</h3>
                            <ul style={{ paddingLeft: 20, fontSize: 13, color: '#e2e8f0', lineHeight: 1.8 }}>
                              {currentSummary.content.key_points.map((point: string, i: number) => (
                                <li key={i}>{point}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {currentSummary.content?.decisions && (
                          <div style={{ marginBottom: 20 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#10b981', marginBottom: 10 }}>✅ Decisions</h3>
                            <ul style={{ paddingLeft: 20, fontSize: 13, color: '#e2e8f0', lineHeight: 1.8 }}>
                              {currentSummary.content.decisions.map((dec: string, i: number) => (
                                <li key={i}>{dec}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {currentSummary.content?.flagged_items?.length > 0 && (
                          <div style={{ marginBottom: 20 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#f43f5e', marginBottom: 10 }}>⚠️ Flagged Items</h3>
                            <ul style={{ paddingLeft: 20, fontSize: 13, color: '#fb7185', lineHeight: 1.8 }}>
                              {currentSummary.content.flagged_items.map((item: string, i: number) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {currentSummary.content?.sentiment && (
                          <div style={{
                            display: 'flex', gap: 16, marginTop: 16, paddingTop: 16,
                            borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 13,
                          }}>
                            <span>📊 Tone: <strong style={{ color: '#d4a843' }}>{currentSummary.content.sentiment}</strong></span>
                            {currentSummary.is_finalized && <span style={{ color: '#10b981' }}>✅ Finalized</span>}
                          </div>
                        )}

                        {/* Raw text fallback */}
                        {!currentSummary.content?.key_points && currentSummary.raw_text && (
                          <pre style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                            {currentSummary.raw_text}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
                    <p>No summary generated yet.</p>
                    {transcript.length > 0 && (
                      <button className="btn-primary" onClick={() => handleSummarize('detailed')} style={{ marginTop: 16 }}>
                        Generate Summary
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Chat Tab */}
            {activeTab === 'chat' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>
                <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
                  {chatMessages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                      <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
                      <p style={{ marginBottom: 8 }}>Ask anything about this meeting</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360, margin: '20px auto' }}>
                        {[
                          "What were the main decisions?",
                          "What did the PWD officer commit to?",
                          "Summarize the budget discussion",
                        ].map(q => (
                          <button
                            key={q}
                            className="btn-secondary"
                            onClick={() => { setChatInput(q); }}
                            style={{ fontSize: 13, textAlign: 'left' }}
                          >
                            &quot;{q}&quot;
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {chatMessages.map((msg, i) => (
                        <div key={i} style={{
                          display: 'flex',
                          justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        }}>
                          <div style={{
                            maxWidth: '85%', padding: '12px 16px', borderRadius: 12,
                            background: msg.role === 'user'
                              ? 'linear-gradient(135deg, rgba(212,168,67,0.2), rgba(212,168,67,0.1))'
                              : 'rgba(255,255,255,0.04)',
                            border: msg.role === 'user'
                              ? '1px solid rgba(212,168,67,0.2)'
                              : '1px solid rgba(255,255,255,0.06)',
                          }}>
                            <p style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                              {msg.content}
                            </p>
                            {msg.sources?.length > 0 && (
                              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Sources:</div>
                                {msg.sources.map((src: any, j: number) => (
                                  <div key={j} style={{
                                    fontSize: 11, color: '#94a3b8', padding: '4px 8px', marginBottom: 2,
                                    background: 'rgba(255,255,255,0.03)', borderRadius: 4,
                                  }}>
                                    <strong>{src.speaker}</strong> ({src.timestamp}): {src.text?.slice(0, 100)}...
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {chatLoading && (
                        <div style={{ display: 'flex', gap: 6, padding: 12 }}>
                          <div className="skeleton" style={{ width: 8, height: 8, borderRadius: '50%' }} />
                          <div className="skeleton" style={{ width: 8, height: 8, borderRadius: '50%' }} />
                          <div className="skeleton" style={{ width: 8, height: 8, borderRadius: '50%' }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <form onSubmit={handleChat} style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input-field"
                    placeholder="Ask about this meeting..."
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    disabled={chatLoading || transcript.length === 0}
                  />
                  <button type="submit" className="btn-primary" disabled={chatLoading || !chatInput.trim()}>
                    ➤
                  </button>
                </form>
              </div>
            )}

            {/* Actions Tab */}
            {activeTab === 'actions' && (
              <div className="animate-fade-in">
                {actions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📌</div>
                    <p>No action items extracted yet. Generate a summary first.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {actions.map(action => (
                      <div key={action.id} className="glass-card" style={{ padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <p style={{ fontSize: 14, color: '#e2e8f0', flex: 1, lineHeight: 1.5 }}>
                            {action.description}
                          </p>
                          <select
                            className="input-field"
                            value={action.status}
                            onChange={e => handleActionStatusUpdate(action.id, e.target.value)}
                            style={{ width: 140, fontSize: 12, padding: '6px 10px' }}
                          >
                            <option value="pending">⏳ Pending</option>
                            <option value="in_progress">🔄 In Progress</option>
                            <option value="completed">✅ Completed</option>
                            <option value="escalated">🚨 Escalated</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#94a3b8' }}>
                          <span>👤 {action.assigned_to || 'Unassigned'}</span>
                          {action.deadline && (
                            <span>📅 {new Date(action.deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                          )}
                          <span className={`badge badge-${action.status}`} style={{ fontSize: 10 }}>
                            {action.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Export Tab */}
            {activeTab === 'export' && (
              <div className="animate-fade-in">
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, color: '#d4a843' }}>
                  📤 Export Meeting Summary
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { format: 'pdf', icon: '📄', label: 'PDF Report', desc: 'Official formatted MoM' },
                    { format: 'docx', icon: '📃', label: 'Word Document', desc: 'Editable before distribution' },
                    { format: 'json', icon: '{ }', label: 'JSON Data', desc: 'For system integration' },
                    { format: 'text', icon: '📋', label: 'Plain Text', desc: 'WhatsApp/Telegram ready' },
                  ].map(exp => (
                    <button
                      key={exp.format}
                      className="glass-card"
                      onClick={() => handleExport(exp.format)}
                      style={{
                        padding: 24, textAlign: 'center', cursor: 'pointer',
                        border: '1px solid rgba(255,255,255,0.06)',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ fontSize: 32, marginBottom: 8 }}>{exp.icon}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{exp.label}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{exp.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Speaker Mapping Modal */}
      {showSpeakerModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onClick={e => e.target === e.currentTarget && setShowSpeakerModal(false)}
        >
          <div className="glass-card animate-slide-up" style={{ padding: 36, width: 480 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#f0d078' }}>
              👥 Map Speaker Identities
            </h2>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
              Assign real names to detected speakers
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Object.keys(speakerMappings).map(label => (
                <div key={label} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#94a3b8', width: 120 }}>{label}</span>
                  <span style={{ color: '#64748b' }}>→</span>
                  <input
                    className="input-field"
                    placeholder="e.g. Minister Sharma"
                    value={speakerMappings[label]}
                    onChange={e => setSpeakerMappings({ ...speakerMappings, [label]: e.target.value })}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn-secondary" onClick={() => setShowSpeakerModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn-primary" onClick={handleSpeakerMap} style={{ flex: 1 }}>Apply Mapping</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

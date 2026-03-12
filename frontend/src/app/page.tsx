'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Login form
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // Create meeting form
  const [createForm, setCreateForm] = useState({
    title: '', description: '', venue: '', platform: '', language: 'en', confidentiality: 'internal'
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setShowLogin(true);
      setLoading(false);
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profile, meetingsList] = await Promise.all([
        api.getProfile(),
        api.getMeetings({ search: searchQuery, status: statusFilter || undefined }),
      ]);
      setUser(profile);
      setMeetings(meetingsList);
    } catch (e) {
      localStorage.removeItem('token');
      setShowLogin(true);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await api.login(loginForm.username, loginForm.password);
      localStorage.setItem('token', res.access_token);
      setUser(res.user);
      setShowLogin(false);
      loadData();
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setShowLogin(true);
    setMeetings([]);
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newMeeting = await api.createMeeting(createForm);
      setMeetings([newMeeting, ...meetings]);
      setShowCreateModal(false);
      setCreateForm({ title: '', description: '', venue: '', platform: '', language: 'en', confidentiality: 'internal' });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const results = await api.getMeetings({ search: searchQuery, status: statusFilter || undefined });
      setMeetings(results);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      const timer = setTimeout(handleSearch, 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, statusFilter]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  // ── Login Screen ──
  if (showLogin) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a1628, #111d35, #0f172a)',
      }}>
        <div className="glass-card animate-slide-up" style={{ padding: 48, width: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏛️</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, color: '#f0d078' }}>
            AI Meeting Co-Pilot
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 32 }}>
            Government Leaders & Administrators Dashboard
          </p>

          <form onSubmit={handleLogin}>
            <input
              className="input-field"
              placeholder="Username"
              value={loginForm.username}
              onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
              style={{ marginBottom: 12 }}
              required
            />
            <input
              className="input-field"
              type="password"
              placeholder="Password"
              value={loginForm.password}
              onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
              style={{ marginBottom: 20 }}
              required
            />
            {loginError && (
              <p style={{ color: '#fb7185', fontSize: 13, marginBottom: 12 }}>{loginError}</p>
            )}
            <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px 0' }}>
              Sign In
            </button>
          </form>

          <p style={{ color: '#64748b', fontSize: 12, marginTop: 24 }}>
            Default: admin / admin123
          </p>
        </div>
      </div>
    );
  }

  // ── Main Dashboard ──
  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10, 22, 40, 0.85)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(212, 168, 67, 0.1)',
        padding: '12px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 28 }}>🏛️</span>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#f0d078', lineHeight: 1.2 }}>
              AI Meeting Co-Pilot
            </h1>
            <p style={{ fontSize: 11, color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Government Leaders Dashboard
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(255,255,255,0.04)', padding: '8px 16px', borderRadius: 10,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #d4a843, #e4bc5a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#0a1628', fontWeight: 700, fontSize: 14,
            }}>
              {user?.full_name?.charAt(0) || 'A'}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.full_name}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{user?.designation}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-icon" title="Logout" style={{ fontSize: 18 }}>
            ⏻
          </button>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="container" style={{ marginTop: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          {[
            { icon: '📋', label: 'Total Meetings', value: meetings.length, color: '#8b5cf6' },
            { icon: '✅', label: 'Completed', value: meetings.filter(m => m.status === 'completed').length, color: '#10b981' },
            { icon: '⏳', label: 'Pending Summary', value: meetings.filter(m => ['uploaded', 'transcribed'].includes(m.status)).length, color: '#f59e0b' },
            { icon: '📌', label: 'Action Items', value: meetings.reduce((a, m) => a + (m.action_items_count || 0), 0), color: '#f43f5e' },
          ].map((stat, i) => (
            <div key={i} className="glass-card animate-slide-up" style={{
              padding: 20, animationDelay: `${i * 0.1}s`,
              display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: `${stat.color}15`, display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 22,
              }}>
                {stat.icon}
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{
          display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <input
            className="input-field"
            placeholder="🔍 Search meetings..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ maxWidth: 320, flex: 1 }}
          />
          <select
            className="input-field"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ maxWidth: 180 }}
          >
            <option value="">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="uploaded">Uploaded</option>
            <option value="transcribed">Transcribed</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <div style={{ flex: 1 }} />
          <button
            className="btn-primary"
            onClick={() => setShowCreateModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span style={{ fontSize: 18 }}>＋</span> New Meeting
          </button>
        </div>

        {/* Meeting Cards */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
            {[1,2,3].map(i => (
              <div key={i} className="skeleton" style={{ height: 180, borderRadius: 16 }} />
            ))}
          </div>
        ) : meetings.length === 0 ? (
          <div className="glass-card" style={{
            padding: 60, textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Meetings Yet</h3>
            <p style={{ color: '#64748b', marginBottom: 20 }}>Create your first meeting to get started</p>
            <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
              ＋ Create Meeting
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16, paddingBottom: 40 }}>
            {meetings.map((meeting, i) => (
              <div
                key={meeting.id}
                className="glass-card animate-slide-up"
                style={{ padding: 24, cursor: 'pointer', animationDelay: `${i * 0.05}s` }}
                onClick={() => router.push(`/meetings/${meeting.id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, flex: 1, marginRight: 12, lineHeight: 1.4 }}>
                    {meeting.title}
                  </h3>
                  <span className={`badge badge-${meeting.status}`}>
                    {meeting.status}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#94a3b8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>📅</span> {formatDate(meeting.date)}
                  </div>
                  {meeting.venue && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>📍</span> {meeting.venue || meeting.platform}
                    </div>
                  )}
                  {meeting.duration_seconds > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>⏱️</span> {formatDuration(meeting.duration_seconds)}
                    </div>
                  )}
                </div>

                <div style={{
                  display: 'flex', gap: 12, marginTop: 16, paddingTop: 12,
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                }}>
                  {meeting.has_summary && (
                    <span style={{ fontSize: 12, color: '#34d399', display: 'flex', alignItems: 'center', gap: 4 }}>
                      ✅ Summary
                    </span>
                  )}
                  {meeting.action_items_count > 0 && (
                    <span style={{ fontSize: 12, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 4 }}>
                      📌 {meeting.action_items_count} Actions
                    </span>
                  )}
                  <span style={{
                    fontSize: 11, color: '#64748b', marginLeft: 'auto',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {meeting.confidentiality}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Meeting Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onClick={e => e.target === e.currentTarget && setShowCreateModal(false)}
        >
          <div className="glass-card animate-slide-up" style={{ padding: 36, width: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, color: '#f0d078' }}>
              📋 New Meeting
            </h2>

            <form onSubmit={handleCreateMeeting}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Meeting Title *</label>
                  <input
                    className="input-field"
                    placeholder="e.g. District Development Review"
                    value={createForm.title}
                    onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Description</label>
                  <textarea
                    className="input-field"
                    placeholder="Brief description of the meeting..."
                    value={createForm.description}
                    onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                    rows={3}
                    style={{ resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Venue</label>
                    <input
                      className="input-field"
                      placeholder="Conference Room A"
                      value={createForm.venue}
                      onChange={e => setCreateForm({ ...createForm, venue: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Platform</label>
                    <select
                      className="input-field"
                      value={createForm.platform}
                      onChange={e => setCreateForm({ ...createForm, platform: e.target.value })}
                    >
                      <option value="">In-Person</option>
                      <option value="Microsoft Teams">Microsoft Teams</option>
                      <option value="Zoom">Zoom</option>
                      <option value="Google Meet">Google Meet</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Language</label>
                    <select
                      className="input-field"
                      value={createForm.language}
                      onChange={e => setCreateForm({ ...createForm, language: e.target.value })}
                    >
                      <option value="en">English</option>
                      <option value="hi">Hindi</option>
                      <option value="ta">Tamil</option>
                      <option value="te">Telugu</option>
                      <option value="mr">Marathi</option>
                      <option value="bn">Bengali</option>
                      <option value="kn">Kannada</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Confidentiality</label>
                    <select
                      className="input-field"
                      value={createForm.confidentiality}
                      onChange={e => setCreateForm({ ...createForm, confidentiality: e.target.value })}
                    >
                      <option value="public">🌐 Public</option>
                      <option value="internal">🏢 Internal</option>
                      <option value="confidential">🔒 Confidential</option>
                      <option value="restricted">🔴 Restricted</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                  Create Meeting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

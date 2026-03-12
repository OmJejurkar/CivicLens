'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { 
  FileText, 
  Video, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Upload, 
  Search, 
  LogOut, 
  TrendingUp, 
  BarChart3,
  FileUp,
  MessageSquare
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // PDF Upload State
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

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
      const profile = await api.getProfile();
      setUser(profile);
      
      // Parallel fetch for dashboard data
      const [meetingsList, documentsList] = await Promise.all([
        api.getMeetings({ search: searchQuery, status: statusFilter || undefined }).catch(e => { console.error(e); return []; }),
        api.getDocuments().catch(e => { console.error(e); return []; }),
      ]);
      
      setMeetings(meetingsList);
      setDocuments(documentsList);
    } catch (e: any) {
      console.error('Data load failed:', e);
      const isAuthError = e.message?.includes('401') || e.message?.includes('Unauthorized') || e.message?.includes('403');
      if (isAuthError) {
        localStorage.removeItem('token');
        window.dispatchEvent(new Event('auth-change'));
        setShowLogin(true);
      }
      // For other errors (500, network), we stay logged in but show state
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
      window.dispatchEvent(new Event('auth-change'));
      setShowLogin(false);
      loadData();
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.dispatchEvent(new Event('auth-change'));
    setUser(null);
    setShowLogin(true);
    setMeetings([]);
    setDocuments([]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingDoc(true);
    try {
      const res = await api.uploadDocument(file);
      router.push(`/documents/${res.id}`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingDoc(false);
    }
  };

  const chartData = [
    { name: 'Mon', apps: 4, mtgs: 2 },
    { name: 'Tue', apps: 7, mtgs: 5 },
    { name: 'Wed', apps: 5, mtgs: 3 },
    { name: 'Thu', apps: 8, mtgs: 4 },
    { name: 'Fri', apps: 6, mtgs: 6 },
    { name: 'Sat', apps: 2, mtgs: 1 },
    { name: 'Sun', apps: 3, mtgs: 2 },
  ];

  if (showLogin) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a1628, #111d35, #0f172a)',
      }}>
        <div className="glass-card animate-slide-up" style={{ padding: 48, width: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏛️</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, color: '#f0d078' }}>
            CivicLens AI
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
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px' }}>
      {/* Welcome Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>
            Welcome back, {user?.full_name?.split(' ')[0]}
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 14 }}>
            Here's what's happening with your governance projects today.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={handleLogout} className="btn-icon" title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 32 }}>
        {[
          { label: 'Total Meetings', value: meetings.length, icon: Video, color: '#8b5cf6', trend: '+2 this week' },
          { label: 'Docs Processed', value: documents.length, icon: FileText, color: '#10b981', trend: '+5 new docs' },
          { label: 'AI Insights', value: '124', icon: MessageSquare, color: '#f59e0b', trend: 'High activity' },
          { label: 'Success Rate', value: '98%', icon: CheckCircle2, color: '#3b82f6', trend: 'Stable' },
        ].map((stat, i) => (
          <div key={i} className="glass-card" style={{ padding: 24, position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ 
                width: 48, height: 48, borderRadius: 12, 
                background: stat.color + '15', display: 'flex', 
                alignItems: 'center', justifyContent: 'center', color: stat.color 
              }}>
                <stat.icon size={24} />
              </div>
              <span style={{ fontSize: 11, color: '#64748b', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: 4 }}>
                {stat.trend}
              </span>
            </div>
            <h3 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{stat.value}</h3>
            <p style={{ color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Charts & Actions Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 32 }}>
        {/* Activity Chart */}
        <div className="glass-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
              <TrendingUp size={20} color="#f0d078" /> Activity Overview
            </h2>
            <div style={{ fontSize: 12, color: '#64748b', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: 8 }}>
              Past 7 Days
            </div>
          </div>
          <div style={{ height: 250, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d4a843" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#d4a843" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ background: '#111d35', border: '1px solid rgba(212, 168, 67, 0.2)', borderRadius: 12 }}
                  itemStyle={{ color: '#f0d078' }}
                />
                <Area type="monotone" dataKey="apps" stroke="#d4a843" strokeWidth={3} fillOpacity={1} fill="url(#colorApps)" />
                <Area type="monotone" dataKey="mtgs" stroke="#8b5cf6" strokeWidth={3} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions / Document Upload */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Quick PDF Upload */}
          <div className="glass-card" style={{ 
            padding: 24, flex: 1, border: '2px dashed rgba(212, 168, 67, 0.2)', 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center'
          }}>
            <div style={{ 
              width: 56, height: 56, borderRadius: '50%', background: 'rgba(212, 168, 67, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f0d078',
              marginBottom: 16
            }}>
              <FileUp size={28} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Quick PDF Upload</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
              Process reports, memos, or official documents instantly.
            </p>
            <label className="btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              {uploadingDoc ? 'Uploading...' : 'Choose File'}
              <input type="file" hidden accept=".pdf,.docx,.txt" onChange={handleFileUpload} disabled={uploadingDoc} />
            </label>
          </div>

          {/* New Meeting Shortcut */}
          <button 
            className="glass-card" 
            onClick={() => setShowCreateModal(true)}
            style={{ 
              padding: 20, width: '100%', cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 16, border: '1px solid rgba(255,255,255,0.05)'
            }}
          >
            <div style={{ 
              width: 44, height: 44, borderRadius: 12, background: 'rgba(139, 92, 246, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6'
            }}>
              <Plus size={20} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Create New Meeting</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Start a fresh transcription</div>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Meetings / Documents List */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Recent Activities</h2>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input 
                className="input-field" 
                placeholder="Search..." 
                style={{ paddingLeft: 36, width: 240, height: 38 }}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 16 }} />)}
          </div>
        ) : meetings.length === 0 ? (
          <div className="glass-card" style={{ padding: 60, textAlign: 'center' }}>
             <p>No recent activities found.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
            {meetings.slice(0, 6).map((meeting) => (
              <div 
                key={meeting.id} 
                className="glass-card" 
                style={{ padding: 20, cursor: 'pointer' }}
                onClick={() => router.push(`/meetings/${meeting.id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span className={`badge badge-${meeting.status}`}>{meeting.status}</span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{new Date(meeting.date).toLocaleDateString()}</span>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, lineHeight: 1.4 }}>{meeting.title}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#94a3b8' }}>
                    <Clock size={14} /> {meeting.duration_seconds ? `${Math.floor(meeting.duration_seconds/60)}m` : '--'}
                  </div>
                  {meeting.has_summary && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#10b981' }}>
                      <CheckCircle2 size={14} /> Summarized
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full Modal for New Meeting */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onClick={e => e.target === e.currentTarget && setShowCreateModal(false)}
        >
          <div className="glass-card" style={{ padding: 32, width: 500 }}>
             <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, color: '#f0d078' }}>
                📋 New Meeting
              </h2>
              {/* Form implementation simplified for brevity */}
              <button 
                className="btn-primary" 
                style={{ width: '100%' }}
                onClick={() => setShowCreateModal(false)}
              >
                Close Modal
              </button>
          </div>
        </div>
      )}
    </div>
  );
}

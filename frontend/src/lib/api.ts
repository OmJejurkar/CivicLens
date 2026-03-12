/* API client utility for the frontend. */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface RequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  }

  private getHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extra,
    };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers } = options;
    const url = `${this.baseUrl}${endpoint}`;

    const fetchOptions: RequestInit = {
      method,
      headers: body instanceof FormData
        ? { Authorization: `Bearer ${this.getToken() || ''}` }
        : this.getHeaders(headers),
    };

    if (body) {
      fetchOptions.body = body instanceof FormData ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    // Handle blob responses for file downloads
    const contentType = response.headers.get('content-type');
    if (contentType && (contentType.includes('pdf') || contentType.includes('octet') || contentType.includes('word'))) {
      return response.blob() as any;
    }

    return response.json();
  }

  // ── Auth ──
  async login(username: string, password: string) {
    return this.request<{access_token: string; user: any}>('/auth/login', {
      method: 'POST',
      body: { username, password },
    });
  }

  async getProfile() {
    return this.request<any>('/auth/me');
  }

  // ── Meetings ──
  async getMeetings(params?: { status?: string; search?: string }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request<any[]>(`/meetings/${query ? '?' + query : ''}`);
  }

  async getMeeting(id: string) {
    return this.request<any>(`/meetings/${id}`);
  }

  async createMeeting(data: any) {
    return this.request<any>('/meetings/', { method: 'POST', body: data });
  }

  async updateMeeting(id: string, data: any) {
    return this.request<any>(`/meetings/${id}`, { method: 'PUT', body: data });
  }

  async deleteMeeting(id: string) {
    return this.request<any>(`/meetings/${id}`, { method: 'DELETE' });
  }

  async uploadAudio(meetingId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<any>(`/meetings/${meetingId}/upload`, {
      method: 'POST',
      body: formData,
    });
  }

  async uploadAgenda(meetingId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<any>(`/meetings/${meetingId}/upload-agenda`, {
      method: 'POST',
      body: formData,
    });
  }

  // ── Transcription ──
  async transcribe(meetingId: string) {
    return this.request<any>(`/meetings/${meetingId}/transcribe`, { method: 'POST' });
  }

  async getTranscript(meetingId: string) {
    return this.request<any[]>(`/meetings/${meetingId}/transcript`);
  }

  async mapSpeakers(meetingId: string, mappings: Record<string, string>) {
    return this.request<any>(`/meetings/${meetingId}/speakers`, {
      method: 'PUT',
      body: { mappings },
    });
  }

  // ── Summary ──
  async summarize(meetingId: string, summaryType: string = 'detailed', language: string = 'en') {
    return this.request<any>(`/meetings/${meetingId}/summarize`, {
      method: 'POST',
      body: { summary_type: summaryType, language },
    });
  }

  async getSummaries(meetingId: string) {
    return this.request<any[]>(`/meetings/${meetingId}/summary`);
  }

  async editSummary(meetingId: string, summaryId: string, data: any) {
    return this.request<any>(`/meetings/${meetingId}/summary/${summaryId}`, {
      method: 'PUT',
      body: data,
    });
  }

  // ── Actions ──
  async getActions(meetingId: string) {
    return this.request<any[]>(`/meetings/${meetingId}/actions`);
  }

  async updateAction(actionId: string, data: any) {
    return this.request<any>(`/actions/${actionId}`, { method: 'PUT', body: data });
  }

  async getActionsDashboard() {
    return this.request<any[]>('/actions/dashboard');
  }

  // ── Chat ──
  async chat(meetingId: string, question: string, language: string = 'en') {
    return this.request<{answer: string; sources: any[]}>(`/meetings/${meetingId}/chat`, {
      method: 'POST',
      body: { question, language },
    });
  }

  // ── Export ──
  async exportMeeting(meetingId: string, format: string = 'json') {
    return this.request<any>(`/meetings/${meetingId}/export?format=${format}`);
  }
}

export const api = new ApiClient(API_BASE);
export default api;

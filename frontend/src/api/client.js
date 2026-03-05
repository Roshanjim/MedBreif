const API_BASE = '/api';

async function request(endpoint, options = {}) {
    const token = localStorage.getItem('medbrief_token');

    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers,
        },
        ...options,
    };

    // Don't set Content-Type for FormData
    if (options.body instanceof FormData) {
        delete config.headers['Content-Type'];
    }

    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }

    return data;
}

export const api = {
    // Auth
    register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    getProfile: () => request('/auth/me'),

    // Visits
    getVisits: () => request('/visits'),
    getVisit: (id) => request(`/visits/${id}`),
    createVisit: (data) => request('/visits', { method: 'POST', body: JSON.stringify(data) }),
    updateVisit: (id, data) => request(`/visits/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteVisit: (id) => request(`/visits/${id}`, { method: 'DELETE' }),

    // Audio
    uploadAudio: (formData) => request('/audio/upload', { method: 'POST', body: formData, headers: {} }),

    // AI Pipeline
    transcribe: (visitId) => request(`/ai/transcribe/${visitId}`, { method: 'POST' }),
    extract: (visitId) => request(`/ai/extract/${visitId}`, { method: 'POST' }),
    summarize: (visitId) => request(`/ai/summarize/${visitId}`, { method: 'POST' }),

    // PDF
    getPdfUrl: (visitId) => `${API_BASE}/pdf/${visitId}`,
};

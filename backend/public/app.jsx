/* MedBrief AI — Full Application (CDN React) */
const { useState, useEffect, useRef, createContext, useContext } = React;

// ─── API Client ───
const API = '/api';
async function req(endpoint, opts = {}) {
    const token = localStorage.getItem('medbrief_token');
    const cfg = { ...opts, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }), ...opts.headers } };
    if (opts.body instanceof FormData) delete cfg.headers['Content-Type'];
    const res = await fetch(`${API}${endpoint}`, cfg);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}
const api = {
    register: d => req('/auth/register', { method: 'POST', body: JSON.stringify(d) }),
    login: d => req('/auth/login', { method: 'POST', body: JSON.stringify(d) }),
    getProfile: () => req('/auth/me'),
    getVisits: () => req('/visits'),
    getVisit: id => req(`/visits/${id}`),
    createVisit: d => req('/visits', { method: 'POST', body: JSON.stringify(d) }),
    updateVisit: (id, d) => req(`/visits/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    deleteVisit: id => req(`/visits/${id}`, { method: 'DELETE' }),
    uploadAudio: fd => req('/audio/upload', { method: 'POST', body: fd, headers: {} }),
    transcribe: id => req(`/ai/transcribe/${id}`, { method: 'POST' }),
    extract: id => req(`/ai/extract/${id}`, { method: 'POST' }),
    summarize: id => req(`/ai/summarize/${id}`, { method: 'POST' }),
    // New endpoints
    diagnose: id => req(`/ai/diagnose/${id}`, { method: 'POST' }),
    generateSOAP: id => req(`/ai/soap/${id}`, { method: 'POST' }),
    updateDoctorSOAP: (id, soap) => req(`/ai/soap/${id}`, { method: 'PUT', body: JSON.stringify({ doctorSoap: soap }) }),
    uploadReport: (visitId, fd) => req(`/reports/upload/${visitId}`, { method: 'POST', body: fd, headers: {} }),
    getVisitReports: id => req(`/reports/visit/${id}`),
    deleteReport: id => req(`/reports/${id}`, { method: 'DELETE' }),
    submitFeedback: (visitId, fb) => req('/ai-feedback', { method: 'POST', body: JSON.stringify({ visitId, feedback: fb }) }),
    getFeedback: id => req(`/ai-feedback/${id}`),
};

// ─── Auth Context ───
const AuthCtx = createContext(null);
function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const t = localStorage.getItem('medbrief_token');
        if (t) { api.getProfile().then(d => { setUser(d.user); setLoading(false); }).catch(() => { localStorage.removeItem('medbrief_token'); setLoading(false); }); }
        else setLoading(false);
    }, []);
    const login = async (email, password) => { const d = await api.login({ email, password }); localStorage.setItem('medbrief_token', d.token); setUser(d.user); };
    const register = async (name, email, password, role) => { const d = await api.register({ name, email, password, role }); localStorage.setItem('medbrief_token', d.token); setUser(d.user); };
    const logout = () => { localStorage.removeItem('medbrief_token'); setUser(null); };
    return React.createElement(AuthCtx.Provider, { value: { user, loading, login, register, logout } }, children);
}
function useAuth() { return useContext(AuthCtx); }

// ─── Simple Router ───
function useRouter() {
    const [path, setPath] = useState(window.location.hash.slice(1) || '/');
    useEffect(() => {
        const h = () => setPath(window.location.hash.slice(1) || '/');
        window.addEventListener('hashchange', h);
        return () => window.removeEventListener('hashchange', h);
    }, []);
    const navigate = p => { window.location.hash = p; };
    const params = {};
    const match = path.match(/^\/visit\/(\d+)\/(transcript|summary|review)$/);
    if (match) { params.id = match[1]; params.section = match[2]; }
    return { path, navigate, params };
}

// ─── Login Page ───
function LoginPage({ onAuth }) {
    const { login, register } = useAuth();
    const [isReg, setIsReg] = useState(false);
    const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [role, setRole] = useState('doctor');
    const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
    const submit = async e => {
        e.preventDefault(); setError(''); setLoading(true);
        try { isReg ? await register(name, email, pw, role) : await login(email, pw); }
        catch (err) { setError(err.message); }
        setLoading(false);
    };
    return React.createElement('div', { className: 'login-page' },
        React.createElement('div', { className: 'login-card fade-in' },
            React.createElement('div', { className: 'login-header' },
                React.createElement('div', { className: 'login-icon' }, '🏥'),
                React.createElement('h1', null, 'MedBrief AI'),
                React.createElement('p', null, isReg ? 'Create your account' : 'Sign in to your account')
            ),
            error && React.createElement('div', { className: 'disclaimer-banner', style: { marginBottom: 16, borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)' } }, '⚠️ ', error),
            React.createElement('form', { className: 'login-form', onSubmit: submit },
                isReg && React.createElement('div', { className: 'input-group' },
                    React.createElement('label', null, 'Full Name'),
                    React.createElement('input', { type: 'text', className: 'input', placeholder: 'Dr. John Doe', value: name, onChange: e => setName(e.target.value), required: true })
                ),
                React.createElement('div', { className: 'input-group' },
                    React.createElement('label', null, 'Email'),
                    React.createElement('input', { type: 'email', className: 'input', placeholder: 'doctor@hospital.com', value: email, onChange: e => setEmail(e.target.value), required: true })
                ),
                React.createElement('div', { className: 'input-group' },
                    React.createElement('label', null, 'Password'),
                    React.createElement('input', { type: 'password', className: 'input', placeholder: '••••••••', value: pw, onChange: e => setPw(e.target.value), required: true, minLength: 6 })
                ),
                isReg && React.createElement('div', { className: 'input-group' },
                    React.createElement('label', null, 'Role'),
                    React.createElement('select', { className: 'input', value: role, onChange: e => setRole(e.target.value) },
                        React.createElement('option', { value: 'doctor' }, 'Doctor'),
                        React.createElement('option', { value: 'admin' }, 'Admin')
                    )
                ),
                React.createElement('button', { type: 'submit', className: 'btn btn-primary btn-lg', disabled: loading },
                    loading ? '⏳ Processing...' : (isReg ? '🚀 Create Account' : '🔐 Sign In'))
            ),
            React.createElement('div', { className: 'login-toggle' },
                isReg ? 'Already have an account? ' : "Don't have an account? ",
                React.createElement('a', { href: '#', onClick: e => { e.preventDefault(); setIsReg(!isReg); setError(''); } }, isReg ? 'Sign In' : 'Sign Up')
            )
        )
    );
}

// ─── Sidebar ───
function Sidebar({ currentPath, navigate }) {
    const { user, logout } = useAuth();
    const [open, setOpen] = useState(false);
    const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
    const navLink = (to, icon, label) => React.createElement('a', {
        href: '#' + to, className: `nav-link ${currentPath === to ? 'active' : ''}`,
        onClick: () => setOpen(false)
    }, React.createElement('span', { className: 'nav-icon' }, icon), ` ${label}`);
    return React.createElement(React.Fragment, null,
        React.createElement('button', { className: 'mobile-menu-btn', onClick: () => setOpen(!open), style: { display: window.innerWidth <= 768 ? 'flex' : 'none' } }, '☰'),
        React.createElement('aside', { className: `sidebar ${open ? 'open' : ''}` },
            React.createElement('div', { className: 'sidebar-logo' },
                React.createElement('div', { className: 'sidebar-logo-icon' }, 'M'),
                React.createElement('div', null,
                    React.createElement('h1', null, 'MedBrief AI'),
                    React.createElement('span', null, 'Medical Summarizer')
                )
            ),
            React.createElement('nav', { className: 'sidebar-nav' },
                navLink('/', '📊', 'Dashboard'),
                navLink('/new', '🎙️', 'New Consultation'),
                navLink('/settings', '⚙️', 'Settings')
            ),
            React.createElement('div', { className: 'sidebar-footer' },
                React.createElement('div', { className: 'user-info' },
                    React.createElement('div', { className: 'user-avatar' }, initials),
                    React.createElement('div', { className: 'user-details' },
                        React.createElement('div', { className: 'user-name' }, user?.name || 'Doctor'),
                        React.createElement('div', { className: 'user-role' }, user?.role || 'doctor')
                    ),
                    React.createElement('button', { className: 'btn btn-ghost btn-sm', onClick: () => { logout(); navigate('/'); }, title: 'Logout' }, '↪')
                )
            )
        )
    );
}

// ─── Dashboard ───
function Dashboard({ navigate }) {
    const [visits, setVisits] = useState([]); const [loading, setLoading] = useState(true);
    useEffect(() => { api.getVisits().then(d => { setVisits(d.visits); setLoading(false); }).catch(() => setLoading(false)); }, []);
    const statusColors = { recording: 'badge-primary', transcribing: 'badge-warning', reviewing: 'badge-success', finalized: 'badge-success' };
    const statusIcons = { recording: '🎙️', transcribing: '⏳', reviewing: '📝', finalized: '✅' };
    const getLink = v => {
        if (v.status === 'recording') return '/new';
        if (v.status === 'transcribing') return `/visit/${v.id}/transcript`;
        if (v.status === 'finalized') return `/visit/${v.id}/review`;
        return `/visit/${v.id}/summary`;
    };
    const total = visits.length, fin = visits.filter(v => v.status === 'finalized').length, prog = total - fin;
    const avgC = visits.filter(v => v.confidence_score).length > 0 ? Math.round(visits.filter(v => v.confidence_score).reduce((a, v) => a + v.confidence_score, 0) / visits.filter(v => v.confidence_score).length) : 0;
    if (loading) return React.createElement('div', { className: 'loading-overlay' }, React.createElement('div', { className: 'spinner' }), React.createElement('p', null, 'Loading...'));
    return React.createElement('div', null,
        React.createElement('div', { className: 'page-header' },
            React.createElement('div', null, React.createElement('h1', { className: 'page-title' }, 'Dashboard'), React.createElement('p', { className: 'page-subtitle' }, 'Manage your consultation summaries')),
            React.createElement('button', { className: 'btn btn-primary', onClick: () => navigate('/new') }, '➕ New Consultation')
        ),
        React.createElement('div', { className: 'stats-grid' },
            React.createElement('div', { className: 'stat-card' }, React.createElement('div', { className: 'stat-icon blue' }, '📋'), React.createElement('div', null, React.createElement('div', { className: 'stat-value' }, total), React.createElement('div', { className: 'stat-label' }, 'Total Visits'))),
            React.createElement('div', { className: 'stat-card' }, React.createElement('div', { className: 'stat-icon green' }, '✅'), React.createElement('div', null, React.createElement('div', { className: 'stat-value' }, fin), React.createElement('div', { className: 'stat-label' }, 'Finalized'))),
            React.createElement('div', { className: 'stat-card' }, React.createElement('div', { className: 'stat-icon yellow' }, '⏳'), React.createElement('div', null, React.createElement('div', { className: 'stat-value' }, prog), React.createElement('div', { className: 'stat-label' }, 'In Progress'))),
            React.createElement('div', { className: 'stat-card' }, React.createElement('div', { className: 'stat-icon purple' }, '🎯'), React.createElement('div', null, React.createElement('div', { className: 'stat-value' }, avgC + '%'), React.createElement('div', { className: 'stat-label' }, 'Avg Confidence')))
        ),
        React.createElement('h2', { style: { marginBottom: 16 } }, 'Recent Consultations'),
        visits.length === 0
            ? React.createElement('div', { className: 'empty-state card' },
                React.createElement('div', { className: 'empty-state-icon' }, '🩺'),
                React.createElement('h3', null, 'No consultations yet'),
                React.createElement('p', { style: { marginBottom: 20 } }, 'Start your first AI-powered consultation'),
                React.createElement('button', { className: 'btn btn-primary', onClick: () => navigate('/new') }, '🎙️ Start Recording'))
            : React.createElement('div', { className: 'visits-list' },
                visits.map(v => React.createElement('a', { key: v.id, href: '#' + getLink(v), className: 'visit-card' },
                    React.createElement('div', { className: 'visit-icon' }, statusIcons[v.status] || '📋'),
                    React.createElement('div', { className: 'visit-info' },
                        React.createElement('div', { className: 'visit-patient' }, v.patient_name),
                        React.createElement('div', { className: 'visit-date' }, v.visit_date)),
                    React.createElement('div', { className: 'visit-meta' },
                        v.confidence_score > 0 && React.createElement('span', { className: `confidence-badge ${v.confidence_score >= 80 ? 'confidence-high' : 'confidence-medium'}` }, `🎯 ${v.confidence_score}%`),
                        React.createElement('span', { className: `badge ${statusColors[v.status]}` }, v.status))
                )))
    );
}

// ─── New Consultation ───
function NewConsultation({ navigate }) {
    const [patientName, setPatientName] = useState(''); const [isRec, setIsRec] = useState(false); const [recTime, setRecTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState(null); const [uploadFile, setUploadFile] = useState(null);
    const [processing, setProcessing] = useState(false); const [error, setError] = useState('');
    const [bars, setBars] = useState(Array(40).fill(8));
    const [createdVisitId, setCreatedVisitId] = useState(null); const [showReportUpload, setShowReportUpload] = useState(false);
    const mrRef = useRef(null); const chunks = useRef([]); const timer = useRef(null); const anim = useRef(null); const analyser = useRef(null);
    const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    const startRec = async () => {
        try {
            setError('');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mr = new MediaRecorder(stream); mrRef.current = mr; chunks.current = [];
            const actx = new AudioContext(); const src = actx.createMediaStreamSource(stream);
            const an = actx.createAnalyser(); an.fftSize = 128; src.connect(an); analyser.current = an;
            const upd = () => {
                const d = new Uint8Array(an.frequencyBinCount); an.getByteFrequencyData(d);
                setBars(Array.from({ length: 40 }, (_, i) => Math.max(8, (d[Math.floor(i / 40 * d.length)] / 255) * 80)));
                anim.current = requestAnimationFrame(upd);
            }; upd();
            mr.ondataavailable = e => { if (e.data.size > 0) chunks.current.push(e.data); };
            mr.onstop = () => { setAudioBlob(new Blob(chunks.current, { type: 'audio/webm' })); stream.getTracks().forEach(t => t.stop()); cancelAnimationFrame(anim.current); actx.close(); setBars(Array(40).fill(8)); };
            mr.start(100); setIsRec(true); setRecTime(0); timer.current = setInterval(() => setRecTime(t => t + 1), 1000);
        } catch (e) { setError('Microphone access denied'); }
    };
    const stopRec = () => { if (mrRef.current && isRec) { mrRef.current.stop(); setIsRec(false); clearInterval(timer.current); } };
    const startPipeline = async () => {
        setProcessing(true); setError('');
        try {
            const { visit } = await api.createVisit({ patient_name: patientName || 'Unknown Patient' });
            setCreatedVisitId(visit.id);
            const audio = audioBlob || uploadFile;
            if (audio) { const fd = new FormData(); fd.append('audio', audio, audioBlob ? 'rec.webm' : uploadFile.name); fd.append('visitId', visit.id); await api.uploadAudio(fd); }
            await api.transcribe(visit.id);
            navigate(`/visit/${visit.id}/transcript`);
        } catch (e) { setError(e.message); setProcessing(false); }
    };
    useEffect(() => () => { clearInterval(timer.current); cancelAnimationFrame(anim.current); }, []);
    const hasAudio = audioBlob || uploadFile;
    return React.createElement('div', null,
        React.createElement('div', { className: 'page-header' }, React.createElement('div', null, React.createElement('h1', { className: 'page-title' }, 'New Consultation'), React.createElement('p', { className: 'page-subtitle' }, 'Record or upload a doctor-patient conversation'))),
        React.createElement('div', { className: 'disclaimer-banner' }, React.createElement('span', { className: 'disclaimer-icon' }, '⚕️'), ' AI-generated summary. Doctor verification required.'),
        error && React.createElement('div', { className: 'disclaimer-banner', style: { borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', marginBottom: 24 } }, '⚠️ ', error),
        React.createElement('div', { className: 'card', style: { marginBottom: 24 } },
            React.createElement('div', { className: 'input-group' }, React.createElement('label', null, 'Patient Name'),
                React.createElement('input', { type: 'text', className: 'input', placeholder: 'Enter patient name', value: patientName, onChange: e => setPatientName(e.target.value) }))),
        React.createElement('div', { className: 'recorder-container' },
            React.createElement('h2', { style: { marginBottom: 8 } }, '🎙️ Audio Recorder'),
            React.createElement('p', { style: { color: 'var(--text-secondary)', fontSize: '0.9rem' } }, 'Record in Malayalam, English, or Hindi'),
            React.createElement('div', { className: 'waveform-container' },
                bars.map((h, i) => React.createElement('div', { key: i, className: `waveform-bar ${isRec ? 'active' : ''}`, style: { height: h + 'px', '--wave-height': h + 'px', animationDelay: i * 0.03 + 's', background: isRec ? `hsl(${200 + i * 3},80%,60%)` : 'var(--text-muted)' } }))),
            (isRec || recTime > 0) && React.createElement('div', { className: 'recorder-time' }, fmt(recTime)),
            React.createElement('button', { className: `record-btn ${isRec ? 'recording' : ''}`, onClick: isRec ? stopRec : startRec, disabled: processing }),
            React.createElement('div', { className: 'recorder-status' }, isRec ? '🔴 Recording... Click to stop' : audioBlob ? '✅ Recording saved' : 'Click to start recording'),
            React.createElement('div', { style: { marginTop: 24, textAlign: 'center' } }, React.createElement('span', { style: { color: 'var(--text-muted)' } }, '— or —')),
            React.createElement('div', { className: 'upload-area', style: { marginTop: 16 }, onClick: () => document.getElementById('audio-up').click() },
                React.createElement('div', { className: 'upload-icon' }, '📁'),
                React.createElement('p', { style: { fontWeight: 500 } }, uploadFile ? `📎 ${uploadFile.name}` : 'Click to upload audio file'),
                React.createElement('p', { style: { fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 } }, 'Supports MP3, WAV, M4A, WEBM'),
                React.createElement('input', { id: 'audio-up', type: 'file', accept: 'audio/*', style: { display: 'none' }, onChange: e => { if (e.target.files[0]) { setUploadFile(e.target.files[0]); setAudioBlob(null); } } }))),
        React.createElement('div', { className: 'card', style: { marginTop: 24 } },
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showReportUpload ? 16 : 0 } },
                React.createElement('div', null, React.createElement('h2', { style: { marginBottom: 4 } }, '📎 Medical Reports'), React.createElement('p', { style: { color: 'var(--text-muted)', fontSize: '0.85rem' } }, 'Upload lab results, blood tests, scans (optional)')),
                React.createElement('button', { className: 'btn btn-ghost', style: { fontSize: '0.85rem' }, onClick: () => setShowReportUpload(!showReportUpload) }, showReportUpload ? '▲ Hide' : '▼ Show Upload')),
            showReportUpload && (createdVisitId
                ? React.createElement(UploadReport, { visitId: createdVisitId })
                : React.createElement('p', { style: { color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: 16 } }, 'Reports available after starting the AI pipeline (a visit is created automatically).'))),
        hasAudio && React.createElement('div', { style: { textAlign: 'center', marginTop: 32 } },
            React.createElement('button', { className: 'btn btn-primary btn-lg', onClick: startPipeline, disabled: processing }, processing ? '⏳ Processing AI Pipeline...' : '🚀 Start AI Analysis')),
        processing && React.createElement('div', { className: 'pipeline-steps', style: { marginTop: 32 } },
            React.createElement('div', { className: 'pipeline-step active' }, React.createElement('div', { className: 'pipeline-step-icon' }, '🎙️'), React.createElement('div', { className: 'pipeline-step-label' }, 'Upload')),
            React.createElement('span', { className: 'pipeline-arrow' }, '→'),
            React.createElement('div', { className: 'pipeline-step active' }, React.createElement('div', { className: 'pipeline-step-icon' }, '📝'), React.createElement('div', { className: 'pipeline-step-label' }, 'Transcribe')),
            React.createElement('span', { className: 'pipeline-arrow' }, '→'),
            React.createElement('div', { className: 'pipeline-step' }, React.createElement('div', { className: 'pipeline-step-icon' }, '🧠'), React.createElement('div', { className: 'pipeline-step-label' }, 'Extract')),
            React.createElement('span', { className: 'pipeline-arrow' }, '→'),
            React.createElement('div', { className: 'pipeline-step' }, React.createElement('div', { className: 'pipeline-step-icon' }, '📋'), React.createElement('div', { className: 'pipeline-step-label' }, 'Summary')))
    );
}

// ─── Transcript Review ───
function TranscriptReview({ id, navigate }) {
    const [visit, setVisit] = useState(null); const [transcript, setTranscript] = useState(null);
    const [loading, setLoading] = useState(true); const [extracting, setExtracting] = useState(false);
    useEffect(() => {
        api.getVisit(id).then(d => {
            setVisit(d.visit);
            if (d.visit.transcript) { const t = typeof d.visit.transcript === 'string' ? JSON.parse(d.visit.transcript) : d.visit.transcript; setTranscript(t); }
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [id]);
    const extract = async () => { setExtracting(true); try { await api.extract(id); await api.summarize(id); navigate(`/visit/${id}/summary`); } catch (e) { alert(e.message); setExtracting(false); } };
    const parseLines = t => { if (!t) return []; return t.split('\n\n').filter(Boolean).map(b => { const m = b.match(/^(Doctor|Patient):\s*(.*)/s); return m ? { speaker: m[1], text: m[2].trim() } : { speaker: 'Unknown', text: b.trim() }; }); };
    if (loading) return React.createElement('div', { className: 'loading-overlay' }, React.createElement('div', { className: 'spinner' }), React.createElement('p', null, 'Loading...'));
    const lines = transcript ? parseLines(transcript.text) : [];
    const PipelineSteps = (steps) => React.createElement('div', { className: 'pipeline-steps' },
        steps.map((s, i) => React.createElement(React.Fragment, { key: i },
            i > 0 && React.createElement('span', { className: 'pipeline-arrow' }, '→'),
            React.createElement('div', { className: `pipeline-step ${s.state}` }, React.createElement('div', { className: 'pipeline-step-icon' }, s.icon), React.createElement('div', { className: 'pipeline-step-label' }, s.label))
        )));
    return React.createElement('div', null,
        React.createElement('div', { className: 'page-header' },
            React.createElement('div', null, React.createElement('h1', { className: 'page-title' }, 'Transcript Review'), React.createElement('p', { className: 'page-subtitle' }, `${visit?.patient_name} – ${visit?.visit_date}`)),
            React.createElement('button', { className: 'btn btn-primary', onClick: extract, disabled: extracting }, extracting ? '⏳ Extracting...' : '🧠 Extract Medical Data')),
        PipelineSteps([{ icon: '🎙️', label: 'Recorded', state: 'completed' }, { icon: '📝', label: 'Transcribed', state: 'completed' }, { icon: '🧠', label: 'Extract', state: 'active' }, { icon: '📋', label: 'Summary', state: '' }]),
        transcript && React.createElement('div', { style: { display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' } },
            React.createElement('span', { className: 'badge badge-primary' }, '🌐 ' + transcript.language),
            React.createElement('span', { className: 'badge badge-success' }, '⏱️ ' + transcript.duration),
            React.createElement('span', { className: `confidence-badge ${transcript.confidence >= 0.8 ? 'confidence-high' : 'confidence-medium'}` }, `🎯 ${Math.round(transcript.confidence * 100)}%`)),
        React.createElement('div', { className: 'transcript-viewer' },
            lines.map((l, i) => React.createElement('div', { key: i, className: `transcript-line ${l.speaker.toLowerCase()}` },
                React.createElement('div', { className: 'transcript-speaker' }, (l.speaker === 'Doctor' ? '🩺' : '🧑') + ' ' + l.speaker),
                React.createElement('div', null, l.text))))
    );
}

// ─── AI Summary ───
function AISummary({ id, navigate }) {
    const [visit, setVisit] = useState(null); const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true); const [tab, setTab] = useState('structured');
    // Lifted AI Diagnosis state — persists across tab switches
    const [diagData, setDiagData] = useState(null); const [diagLoading, setDiagLoading] = useState(false);
    const [diagError, setDiagError] = useState(''); const [diagMethod, setDiagMethod] = useState('');
    useEffect(() => { api.getVisit(id).then(r => { setVisit(r.visit); setData(r.visit.extracted_data); setLoading(false); }).catch(() => setLoading(false)); }, [id]);
    const runDiagnosis = async () => { setDiagLoading(true); setDiagError(''); try { const d = await api.diagnose(id); setDiagData(d.analysis); setDiagMethod(d.method || ''); } catch (e) { setDiagError(e.message); } setDiagLoading(false); };
    if (loading) return React.createElement('div', { className: 'loading-overlay' }, React.createElement('div', { className: 'spinner' }));
    if (!data) return React.createElement('div', { className: 'empty-state', style: { marginTop: 60 } }, React.createElement('h3', null, 'No data. Run extraction first.'), React.createElement('button', { className: 'btn btn-primary', style: { marginTop: 16 }, onClick: () => navigate(`/visit/${id}/transcript`) }, 'Go to Transcript'));
    const cv = parseFloat(data.ConfidenceScore) || 0;
    const Section = (icon, title, items, style) => React.createElement('div', { className: 'summary-section' },
        React.createElement('div', { className: 'summary-section-title', style }, icon + ' ' + title),
        React.createElement('div', { className: 'summary-items' }, items?.map((s, i) => React.createElement('div', { key: i, className: 'summary-item', style }, React.createElement('span', { className: 'summary-item-icon' }, '•'), React.createElement('span', null, s)))));
    // Helper: render a summary string as SOAP sections
    const renderSOAP = (text) => {
        if (!text) return React.createElement('p', { style: { color: 'var(--text-muted)', fontStyle: 'italic' } }, 'No summary available');
        const soapLabels = [{ key: 'S', label: 'Subjective', icon: '🗣️' }, { key: 'O', label: 'Objective', icon: '📊' }, { key: 'A', label: 'Assessment', icon: '🔍' }, { key: 'P', label: 'Plan', icon: '📋' }];
        // Try to parse SOAP sections from text
        const parts = {}; let current = null;
        for (const line of text.split('\n')) {
            const sMatch = line.match(/^(?:\*\*)?[SOAP][\s\-–—:]+(.+)/i) || line.match(/^(?:\*\*)?(Subjective|Objective|Assessment|Plan)[\s\-–—:]*(.*)$/i);
            if (sMatch) { const l = line.trim().charAt(0).toUpperCase(); if ('SOAP'.includes(l)) { current = l; parts[current] = (parts[current] || '') + (sMatch[2] || sMatch[1] || '') + '\n'; } else { if (current) parts[current] = (parts[current] || '') + line + '\n'; } }
            else if (current) { parts[current] = (parts[current] || '') + line + '\n'; }
        }
        if (Object.keys(parts).length === 0) {
            // If no SOAP structure found, just render as plain text
            return React.createElement('pre', { style: { whiteSpace: 'pre-wrap', fontFamily: 'var(--font-family)', fontSize: '0.9rem', lineHeight: 1.8, color: 'var(--text-secondary)' } }, text);
        }
        return React.createElement('div', null, soapLabels.map(s =>
            React.createElement('div', { key: s.key, className: 'card', style: { marginBottom: 12, borderLeft: '3px solid var(--accent-primary)' } },
                React.createElement('h4', { style: { marginBottom: 6, color: 'var(--accent-primary)' } }, s.icon + ' ' + s.key + ' — ' + s.label),
                React.createElement('pre', { style: { whiteSpace: 'pre-wrap', fontFamily: 'var(--font-family)', fontSize: '0.85rem', lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 } }, (parts[s.key] || '').trim() || 'Not specified'))));
    };
    // Diagnosis list section
    const ListSection = (icon, title, items, dangerStyle) => React.createElement('div', { className: 'summary-section', style: { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 20, marginBottom: 12 } },
        React.createElement('div', { className: 'summary-section-title', style: dangerStyle }, icon + ' ' + title),
        React.createElement('div', { className: 'summary-items' }, items?.map((s, i) => React.createElement('div', { key: i, className: 'summary-item', style: dangerStyle }, React.createElement('span', { className: 'summary-item-icon' }, dangerStyle ? '⚠️' : (i + 1) + '.'), React.createElement('span', null, s)))));
    return React.createElement('div', null,
        React.createElement('div', { className: 'page-header' },
            React.createElement('div', null, React.createElement('h1', { className: 'page-title' }, 'AI Summary'), React.createElement('p', { className: 'page-subtitle' }, `${visit?.patient_name} – ${visit?.visit_date}`)),
            React.createElement('button', { className: 'btn btn-primary', onClick: () => navigate(`/visit/${id}/review`) }, '✏️ Edit & Finalize')),
        React.createElement('div', { className: 'disclaimer-banner' }, React.createElement('span', { className: 'disclaimer-icon' }, '⚕️'), ' AI-generated summary. Doctor verification required.'),
        React.createElement('div', { style: { display: 'flex', gap: 12, marginBottom: 24 } },
            React.createElement('span', { className: `confidence-badge ${cv >= 80 ? 'confidence-high' : cv >= 60 ? 'confidence-medium' : 'confidence-low'}` }, '🎯 AI Confidence: ' + data.ConfidenceScore)),
        React.createElement('div', { className: 'tab-switcher' },
            ['structured', 'doctor', 'patient', 'lab', 'diagnosis'].map(t => React.createElement('button', { key: t, className: `tab-btn ${tab === t ? 'active' : ''}`, onClick: () => setTab(t) },
                t === 'structured' ? '📋 Structured Data' : t === 'doctor' ? '🩺 Doctor Summary (SOAP)' : t === 'patient' ? '🧑 Patient Summary' : t === 'lab' ? '🔬 Lab Results' : '🩻 AI Diagnosis'))),
        tab === 'structured' && React.createElement('div', { className: 'fade-in two-col' },
            React.createElement('div', null,
                Section('🤒', 'Symptoms', data.Symptoms),
                Section('⏱️', 'Duration', data.Duration),
                Section('🔬', 'Diagnosis', data.Diagnosis),
                Section('🧪', 'Tests Advised', data.TestsAdvised)),
            React.createElement('div', null,
                React.createElement('div', { className: 'summary-section' },
                    React.createElement('div', { className: 'summary-section-title' }, '💊 Prescriptions'),
                    React.createElement('table', { className: 'medicine-table' },
                        React.createElement('thead', null, React.createElement('tr', null, ['Medicine', 'Dosage', 'Frequency', 'Duration'].map(h => React.createElement('th', { key: h }, h)))),
                        React.createElement('tbody', null, data.Prescriptions?.map((rx, i) => React.createElement('tr', { key: i },
                            React.createElement('td', { style: { fontWeight: 600 } }, rx.Medicine), React.createElement('td', null, rx.Dosage), React.createElement('td', null, rx.Frequency), React.createElement('td', null, rx.Duration)))))),
                Section('🏃', 'Lifestyle Advice', data.LifestyleAdvice),
                React.createElement('div', { className: 'summary-section' },
                    React.createElement('div', { className: 'summary-section-title' }, '📅 Follow-Up'),
                    React.createElement('div', { className: 'summary-item' }, React.createElement('span', null, data.FollowUp || 'Not specified'))),
                data.RedFlags?.length > 0 && Section('🚨', 'Red Flags', data.RedFlags, { color: 'var(--accent-danger)' }),
                data.UnclearItems?.length > 0 && Section('❓', 'Unclear Items', data.UnclearItems, { color: 'var(--accent-warning)' }))),
        tab === 'structured' && React.createElement('div', { style: { marginTop: 24 } }, React.createElement(DoctorFeedback, { visitId: id })),
        tab === 'doctor' && React.createElement('div', { className: 'fade-in' }, renderSOAP(visit?.doctor_summary)),
        tab === 'patient' && React.createElement('div', { className: 'card fade-in' },
            React.createElement('pre', { style: { whiteSpace: 'pre-wrap', fontFamily: 'var(--font-family)', fontSize: '0.9rem', lineHeight: 1.8, color: 'var(--text-secondary)' } }, visit?.patient_summary || 'No summary')),
        tab === 'lab' && React.createElement('div', { className: 'fade-in' }, React.createElement(LabResults, { visitId: id }), React.createElement('div', { style: { marginTop: 16 } }, React.createElement(UploadReport, { visitId: id }))),
        tab === 'diagnosis' && React.createElement('div', { className: 'fade-in' },
            React.createElement('div', { className: 'disclaimer-banner', style: { borderColor: 'rgba(239,68,68,0.3)', background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(245,158,11,0.08))', marginBottom: 20 } },
                React.createElement('span', { className: 'disclaimer-icon' }, '⚠️'), React.createElement('span', null, React.createElement('strong', null, 'Clinical Decision Support Only: '), 'Final diagnosis must be made by the physician.')),
            !diagData && !diagLoading && React.createElement('div', { style: { textAlign: 'center', padding: 32 } },
                React.createElement('div', { style: { fontSize: '3rem', marginBottom: 12 } }, '🩻'),
                React.createElement('h3', null, 'AI Differential Diagnosis'),
                React.createElement('p', { style: { color: 'var(--text-muted)', marginBottom: 20 } }, 'Analyze symptoms, lab results, and consultation data.'),
                React.createElement('button', { className: 'btn btn-primary btn-lg', onClick: runDiagnosis }, '🧠 Generate AI Diagnosis')),
            diagLoading && React.createElement('div', { style: { textAlign: 'center', padding: 40 } }, React.createElement('div', { className: 'spinner' }), React.createElement('p', { style: { marginTop: 12 } }, 'Analyzing patient data...')),
            diagError && React.createElement('div', { className: 'disclaimer-banner', style: { borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', marginTop: 12 } }, '⚠️ ', diagError, React.createElement('button', { className: 'btn btn-ghost', style: { marginLeft: 12, fontSize: '0.8rem' }, onClick: runDiagnosis }, 'Retry')),
            diagData && React.createElement('div', null,
                diagMethod && React.createElement('div', { style: { marginBottom: 16, display: 'flex', gap: 8 } }, React.createElement('span', { className: 'badge badge-primary' }, '🧠 ' + diagMethod), React.createElement('button', { className: 'btn btn-ghost', style: { fontSize: '0.8rem', padding: '4px 10px' }, onClick: runDiagnosis }, '🔄 Regenerate')),
                React.createElement('div', { className: 'two-col' },
                    React.createElement('div', null, ListSection('🔍', 'Assessment (Differential Diagnosis)', diagData.possibleConditions), ListSection('🚨', 'Assessment (Risk Flags)', diagData.riskFlags, { color: 'var(--accent-danger)' })),
                    React.createElement('div', null, ListSection('🧪', 'Plan (Investigations)', diagData.suggestedTests), ListSection('💊', 'Plan (Treatments)', diagData.treatmentConsiderations))),
                React.createElement('div', { style: { marginTop: 24 } }, React.createElement(DoctorFeedback, { visitId: id }))))
    );
}

// ─── Edit Review ───
function EditReview({ id, navigate }) {
    const [visit, setVisit] = useState(null); const [ds, setDs] = useState(''); const [ps, setPs] = useState('');
    const [signed, setSigned] = useState(false); const [saving, setSaving] = useState(false); const [loading, setLoading] = useState(true);
    useEffect(() => { api.getVisit(id).then(r => { setVisit(r.visit); setDs(r.visit.doctor_summary || ''); setPs(r.visit.patient_summary || ''); setSigned(!!r.visit.doctor_signature); setLoading(false); }).catch(() => setLoading(false)); }, [id]);
    const save = async () => { setSaving(true); try { await api.updateVisit(id, { doctor_summary: ds, patient_summary: ps, status: 'reviewing' }); alert('Saved!'); } catch (e) { alert(e.message); } setSaving(false); };
    const finalize = async () => { setSaving(true); try { await api.updateVisit(id, { doctor_summary: ds, patient_summary: ps, doctor_signature: `signed-${Date.now()}`, status: 'finalized' }); setSigned(true); alert('Finalized!'); } catch (e) { alert(e.message); } setSaving(false); };
    const downloadPdf = () => { const t = localStorage.getItem('medbrief_token'); fetch(`/api/pdf/${id}`, { headers: { Authorization: `Bearer ${t}` } }).then(r => r.blob()).then(b => { const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `MedBrief_Visit_${id}.pdf`; a.click(); URL.revokeObjectURL(u); }).catch(e => alert('PDF failed')); };
    if (loading) return React.createElement('div', { className: 'loading-overlay' }, React.createElement('div', { className: 'spinner' }));
    return React.createElement('div', null,
        React.createElement('div', { className: 'page-header' },
            React.createElement('div', null, React.createElement('h1', { className: 'page-title' }, 'Edit & Review'), React.createElement('p', { className: 'page-subtitle' }, `${visit?.patient_name} – ${visit?.visit_date}`)),
            React.createElement('div', { style: { display: 'flex', gap: 12 } },
                React.createElement('button', { className: 'btn btn-ghost', onClick: () => navigate(`/visit/${id}/summary`) }, '← Summary'),
                React.createElement('button', { className: 'btn btn-secondary', onClick: downloadPdf }, '📄 Download PDF'))),
        React.createElement('div', { className: 'disclaimer-banner' }, React.createElement('span', { className: 'disclaimer-icon' }, '⚕️'), ' AI-generated summary. Doctor verification required.'),
        React.createElement('div', { className: 'two-col', style: { marginTop: 24 } },
            React.createElement('div', null, React.createElement('div', { className: 'card' },
                React.createElement('h3', { style: { marginBottom: 16 } }, '🩺 Doctor Summary'),
                React.createElement('div', { className: 'editable-field' }, React.createElement('textarea', { value: ds, onChange: e => setDs(e.target.value), style: { minHeight: 300 } })))),
            React.createElement('div', null, React.createElement('div', { className: 'card' },
                React.createElement('h3', { style: { marginBottom: 16 } }, '🧑 Patient Summary'),
                React.createElement('div', { className: 'editable-field' }, React.createElement('textarea', { value: ps, onChange: e => setPs(e.target.value), style: { minHeight: 300 } }))))),
        React.createElement('div', { className: 'card', style: { marginTop: 24 } },
            React.createElement('h3', { style: { marginBottom: 16 } }, '✍️ Digital Signature'),
            React.createElement('div', { className: `signature-area ${signed ? 'signed' : ''}`, onClick: () => !signed && finalize() },
                signed ? React.createElement(React.Fragment, null, React.createElement('div', { style: { fontSize: '2rem', marginBottom: 8 } }, '✅'), React.createElement('div', { style: { fontWeight: 600 } }, 'Digitally Signed & Finalized'))
                    : React.createElement(React.Fragment, null, React.createElement('div', { style: { fontSize: '2rem', marginBottom: 8 } }, '✍️'), React.createElement('div', { style: { fontWeight: 500 } }, 'Click to sign and finalize')))),
        React.createElement('div', { style: { display: 'flex', gap: 16, marginTop: 24, justifyContent: 'flex-end' } },
            React.createElement('button', { className: 'btn btn-ghost', onClick: () => navigate('/') }, '🏠 Dashboard'),
            React.createElement('button', { className: 'btn btn-secondary', onClick: save, disabled: saving }, saving ? '⏳ Saving...' : '💾 Save'),
            !signed && React.createElement('button', { className: 'btn btn-success', onClick: finalize, disabled: saving }, saving ? '⏳ ...' : '✅ Sign & Finalize'))
    );
}

// ─── Upload Report ───
function UploadReport({ visitId, onDone }) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);
    const doUpload = async (file) => {
        if (!file) return;
        const ok = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
        if (!ok.includes(file.type)) { setError('Only PDF/PNG/JPG/WEBP supported'); return; }
        if (file.size > 20 * 1024 * 1024) { setError('Max 20 MB'); return; }
        setUploading(true); setError('');
        try { const fd = new FormData(); fd.append('report', file); const d = await api.uploadReport(visitId, fd); setResult(d.report); if (onDone) onDone(d.report); }
        catch (e) { setError(e.message); }
        setUploading(false);
    };
    return React.createElement('div', null,
        React.createElement('h3', { style: { marginBottom: 8 } }, '📎 Upload Medical Report'),
        React.createElement('p', { style: { color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 12 } }, 'Upload blood tests, radiology, lab results (PDF/Images)'),
        React.createElement('div', { className: 'upload-area', onClick: () => document.getElementById('report-up-' + visitId)?.click() },
            React.createElement('div', { className: 'upload-icon' }, uploading ? '⏳' : '📄'),
            React.createElement('p', { style: { fontWeight: 500 } }, uploading ? 'Parsing report...' : 'Click to upload report'),
            React.createElement('p', { style: { fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 } }, 'PDF, PNG, JPG, WEBP — max 20 MB'),
            React.createElement('input', { id: 'report-up-' + visitId, type: 'file', accept: '.pdf,image/png,image/jpeg,image/webp', style: { display: 'none' }, onChange: e => doUpload(e.target.files[0]) })),
        error && React.createElement('div', { className: 'disclaimer-banner', style: { borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', marginTop: 12 } }, '⚠️ ', error),
        result && React.createElement('div', { className: 'card fade-in', style: { marginTop: 12 } },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 } }, React.createElement('span', { style: { fontSize: '1.2rem' } }, '✅'), React.createElement('strong', null, 'Report Parsed')),
            React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
                React.createElement('span', { className: 'badge badge-primary' }, '📋 ' + result.reportType),
                React.createElement('span', { className: 'badge badge-success' }, '🔍 ' + (result.testResults?.length || 0) + ' tests'),
                React.createElement('span', { className: 'badge', style: { background: 'var(--bg-secondary)' } }, result.filename)))
    );
}

// ─── Lab Results ───
function LabResults({ visitId }) {
    const [reports, setReports] = useState([]); const [loading, setLoading] = useState(true); const [expanded, setExpanded] = useState(null);
    useEffect(() => { api.getVisitReports(visitId).then(d => { setReports(d.reports || []); setLoading(false); }).catch(() => setLoading(false)); }, [visitId]);
    const delReport = async (rid) => { if (!confirm('Delete this report?')) return; try { await api.deleteReport(rid); setReports(reports.filter(r => r.id !== rid)); } catch (e) { alert(e.message); } };
    const flagBadge = f => f === 'high' ? React.createElement('span', { className: 'badge', style: { background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: '0.7rem' } }, '↑ HIGH')
        : f === 'low' ? React.createElement('span', { className: 'badge', style: { background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: '0.7rem' } }, '↓ LOW')
            : React.createElement('span', { className: 'badge', style: { background: 'rgba(34,197,94,0.15)', color: '#22c55e', fontSize: '0.7rem' } }, '✓ Normal');
    if (loading) return React.createElement('div', { style: { textAlign: 'center', padding: 32 } }, React.createElement('div', { className: 'spinner' }));
    if (!reports.length) return React.createElement('div', { className: 'empty-state', style: { padding: 32 } }, React.createElement('div', { className: 'empty-state-icon' }, '🔬'), React.createElement('h3', null, 'No Lab Reports'), React.createElement('p', { style: { color: 'var(--text-muted)' } }, 'Upload reports from the consultation page.'));
    return React.createElement('div', { className: 'fade-in' }, reports.map(r => {
        const tests = r.parsedData?.testResults || []; const isExp = expanded === r.id;
        const abnormal = tests.filter(t => t.flag === 'high' || t.flag === 'low').length;
        return React.createElement('div', { key: r.id, className: 'card', style: { marginBottom: 16 } },
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 } },
                React.createElement('div', null,
                    React.createElement('h4', { style: { marginBottom: 4 } }, '📋 ' + (r.parsedData?.reportType || r.reportType)),
                    React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
                        React.createElement('span', { className: 'badge badge-primary', style: { fontSize: '0.7rem' } }, r.filename),
                        React.createElement('span', { className: 'badge badge-success', style: { fontSize: '0.7rem' } }, tests.length + ' tests'),
                        abnormal > 0 && React.createElement('span', { className: 'badge', style: { background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: '0.7rem' } }, '⚠️ ' + abnormal + ' abnormal'))),
                React.createElement('div', { style: { display: 'flex', gap: 8 } },
                    React.createElement('button', { className: 'btn btn-ghost', style: { fontSize: '0.8rem', padding: '4px 10px' }, onClick: () => setExpanded(isExp ? null : r.id) }, isExp ? '▲' : '▼'),
                    React.createElement('button', { className: 'btn btn-ghost', style: { fontSize: '0.8rem', padding: '4px 10px', color: 'var(--accent-danger)' }, onClick: () => delReport(r.id) }, '🗑️'))),
            isExp && tests.length > 0 && React.createElement('table', { className: 'medicine-table', style: { marginTop: 8 } },
                React.createElement('thead', null, React.createElement('tr', null, ['Test', 'Value', 'Unit', 'Reference', 'Status'].map(h => React.createElement('th', { key: h }, h)))),
                React.createElement('tbody', null, tests.map((t, i) => React.createElement('tr', { key: i, style: (t.flag === 'high' || t.flag === 'low') ? { background: 'rgba(239,68,68,0.03)' } : {} },
                    React.createElement('td', { style: { fontWeight: 500 } }, t.testName),
                    React.createElement('td', { style: { fontWeight: 600, color: t.flag === 'high' ? '#ef4444' : t.flag === 'low' ? '#f59e0b' : '#22c55e' } }, t.value),
                    React.createElement('td', { style: { color: 'var(--text-muted)' } }, t.unit),
                    React.createElement('td', { style: { color: 'var(--text-muted)', fontSize: '0.85rem' } }, t.referenceRange),
                    React.createElement('td', null, flagBadge(t.flag)))))),
            isExp && tests.length === 0 && React.createElement('p', { style: { color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 8 } }, 'No structured test results extracted. Raw text captured for reference.'));
    }));
}

// ─── AI Diagnosis Panel ───
function AIDiagnosisPanel({ visitId }) {
    const [analysis, setAnalysis] = useState(null); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [method, setMethod] = useState('');
    const generate = async () => { setLoading(true); setError(''); try { const d = await api.diagnose(visitId); setAnalysis(d.analysis); setMethod(d.method || ''); } catch (e) { setError(e.message); } setLoading(false); };
    const ListSection = (icon, title, items, dangerStyle) => React.createElement('div', { className: 'summary-section', style: { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 20, marginBottom: 12 } },
        React.createElement('div', { className: 'summary-section-title', style: dangerStyle }, icon + ' ' + title),
        React.createElement('div', { className: 'summary-items' }, items?.map((s, i) => React.createElement('div', { key: i, className: 'summary-item', style: dangerStyle }, React.createElement('span', { className: 'summary-item-icon' }, dangerStyle ? '⚠️' : (i + 1) + '.'), React.createElement('span', null, s)))));
    return React.createElement('div', null,
        React.createElement('div', { className: 'disclaimer-banner', style: { borderColor: 'rgba(239,68,68,0.3)', background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(245,158,11,0.08))', marginBottom: 20 } },
            React.createElement('span', { className: 'disclaimer-icon' }, '⚠️'), React.createElement('span', null, React.createElement('strong', null, 'Clinical Decision Support Only: '), 'Final diagnosis must be made by the physician.')),
        !analysis && !loading && React.createElement('div', { style: { textAlign: 'center', padding: 32 } },
            React.createElement('div', { style: { fontSize: '3rem', marginBottom: 12 } }, '🩻'),
            React.createElement('h3', null, 'AI Differential Diagnosis'),
            React.createElement('p', { style: { color: 'var(--text-muted)', marginBottom: 20 } }, 'Analyze symptoms, lab results, and consultation data for differential diagnoses.'),
            React.createElement('button', { className: 'btn btn-primary btn-lg', onClick: generate }, '🧠 Generate AI Diagnosis')),
        loading && React.createElement('div', { style: { textAlign: 'center', padding: 40 } }, React.createElement('div', { className: 'spinner' }), React.createElement('p', { style: { marginTop: 12 } }, 'Analyzing patient data...')),
        error && React.createElement('div', { className: 'disclaimer-banner', style: { borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', marginTop: 12 } }, '⚠️ ', error, React.createElement('button', { className: 'btn btn-ghost', style: { marginLeft: 12, fontSize: '0.8rem' }, onClick: generate }, 'Retry')),
        analysis && React.createElement('div', { className: 'fade-in' },
            method && React.createElement('div', { style: { marginBottom: 16, display: 'flex', gap: 8 } }, React.createElement('span', { className: 'badge badge-primary' }, '🧠 Method: ' + method), React.createElement('button', { className: 'btn btn-ghost', style: { fontSize: '0.8rem', padding: '4px 10px' }, onClick: generate }, '🔄 Regenerate')),
            React.createElement('div', { className: 'two-col' },
                React.createElement('div', null, ListSection('🔍', 'Possible Conditions', analysis.possibleConditions), ListSection('🧪', 'Suggested Tests', analysis.suggestedTests)),
                React.createElement('div', null, ListSection('💊', 'Treatment Considerations', analysis.treatmentConsiderations), ListSection('🚨', 'Risk Flags', analysis.riskFlags, { color: 'var(--accent-danger)' }))),
            React.createElement('div', { style: { marginTop: 24 } }, React.createElement(DoctorFeedback, { visitId }))));
}

// ─── SOAP Summary ───
function SOAPSummary({ visitId }) {
    const [aiSoap, setAiSoap] = useState(null); const [docSoap, setDocSoap] = useState({ Subjective: '', Objective: '', Assessment: '', Plan: '' });
    const [loading, setLoading] = useState(false); const [saving, setSaving] = useState(false); const [generated, setGenerated] = useState(false); const [saved, setSaved] = useState(false);
    const generate = async () => { setLoading(true); try { const d = await api.generateSOAP(visitId); setAiSoap(d.aiSoap); setDocSoap(d.doctorSoap || { Subjective: '', Objective: '', Assessment: '', Plan: '' }); setGenerated(true); } catch (e) { alert(e.message); } setLoading(false); };
    const save = async () => { setSaving(true); setSaved(false); try { await api.updateDoctorSOAP(visitId, docSoap); setSaved(true); setTimeout(() => setSaved(false), 3000); } catch (e) { alert(e.message); } setSaving(false); };
    const sections = [{ k: 'Subjective', l: 'S – Subjective', i: '🗣️', d: "Patient's symptoms & history" }, { k: 'Objective', l: 'O – Objective', i: '📊', d: 'Exam findings, vitals, labs' }, { k: 'Assessment', l: 'A – Assessment', i: '🔍', d: 'Diagnosis & evaluation' }, { k: 'Plan', l: 'P – Plan', i: '📋', d: 'Treatment & follow-up' }];
    if (!generated && !loading) return React.createElement('div', { style: { textAlign: 'center', padding: 32 } }, React.createElement('div', { style: { fontSize: '3rem', marginBottom: 12 } }, '📋'), React.createElement('h3', null, 'SOAP Summary'), React.createElement('p', { style: { color: 'var(--text-muted)', marginBottom: 20 } }, 'Generate SOAP notes from consultation data.'), React.createElement('button', { className: 'btn btn-primary btn-lg', onClick: generate }, '📋 Generate SOAP Notes'));
    if (loading) return React.createElement('div', { style: { textAlign: 'center', padding: 40 } }, React.createElement('div', { className: 'spinner' }), React.createElement('p', { style: { marginTop: 12 } }, 'Generating SOAP notes...'));
    return React.createElement('div', { className: 'fade-in' },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 } },
            React.createElement('div', null, React.createElement('h3', { style: { marginBottom: 4 } }, '📋 SOAP Summary'), React.createElement('p', { style: { color: 'var(--text-muted)', fontSize: '0.85rem' } }, 'AI-generated (left) is read-only. Doctor notes (right) are editable.')),
            React.createElement('div', { style: { display: 'flex', gap: 8 } }, React.createElement('button', { className: 'btn btn-ghost', onClick: generate, style: { fontSize: '0.85rem' } }, '🔄 Regenerate'), React.createElement('button', { className: 'btn btn-primary', onClick: save, disabled: saving, style: { fontSize: '0.85rem' } }, saving ? '⏳ Saving...' : saved ? '✅ Saved!' : '💾 Save Doctor Notes'))),
        sections.map(s => React.createElement('div', { key: s.k, style: { marginBottom: 20 } },
            React.createElement('h4', { style: { marginBottom: 4 } }, s.i + ' ' + s.l),
            React.createElement('p', { style: { color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 8 } }, s.d),
            React.createElement('div', { className: 'two-col', style: { gap: 12 } },
                React.createElement('div', { className: 'card', style: { background: 'var(--bg-secondary)' } },
                    React.createElement('div', { style: { display: 'flex', gap: 6, marginBottom: 8 } }, React.createElement('span', { className: 'badge badge-primary', style: { fontSize: '0.7rem' } }, '🤖 AI'), React.createElement('span', { className: 'badge badge-warning', style: { fontSize: '0.7rem' } }, 'Read-only')),
                    React.createElement('pre', { style: { whiteSpace: 'pre-wrap', fontFamily: 'var(--font-family)', fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 } }, aiSoap?.[s.k] || 'Not generated')),
                React.createElement('div', { className: 'card', style: { borderColor: 'rgba(96,165,250,0.3)' } },
                    React.createElement('div', { style: { display: 'flex', gap: 6, marginBottom: 8 } }, React.createElement('span', { className: 'badge badge-success', style: { fontSize: '0.7rem' } }, '🩺 Doctor'), React.createElement('span', { className: 'badge', style: { background: 'rgba(34,197,94,0.15)', color: '#22c55e', fontSize: '0.7rem' } }, 'Editable')),
                    React.createElement('textarea', { value: docSoap[s.k], onChange: e => setDocSoap({ ...docSoap, [s.k]: e.target.value }), placeholder: 'Enter your ' + s.l.split(' – ')[1] + ' notes...', style: { width: '100%', minHeight: 100, background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 8, padding: 12, fontFamily: 'var(--font-family)', fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--text-primary)', resize: 'vertical', outline: 'none' } }))))));
}

// ─── Doctor Feedback ───
function DoctorFeedback({ visitId }) {
    const [selected, setSelected] = useState(null); const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false);
    useEffect(() => { api.getFeedback(visitId).then(d => { if (d.feedback?.rating) { setSelected(d.feedback.rating); setSaved(true); } }).catch(() => { }); }, [visitId]);
    const submit = async (val) => { setSaving(true); try { await api.submitFeedback(visitId, val); setSelected(val); setSaved(true); } catch (e) { alert(e.message); } setSaving(false); };
    const opts = [{ v: 'good', icon: '👍', label: 'Good', c: '#22c55e' }, { v: 'okay', icon: '👌', label: 'Okay', c: '#f59e0b' }, { v: 'bad', icon: '👎', label: 'Bad', c: '#ef4444' }];
    return React.createElement('div', { className: 'doctor-feedback-container' },
        React.createElement('h4', { style: { marginBottom: 8 } }, 'Rate AI Recommendations'),
        React.createElement('p', { style: { color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 12 } }, 'Your feedback helps improve AI accuracy'),
        React.createElement('div', { style: { display: 'flex', gap: 12 } },
            opts.map(o => React.createElement('button', {
                key: o.v, className: 'feedback-btn', disabled: saving,
                style: { background: selected === o.v ? o.c + '20' : 'var(--bg-secondary)', border: '2px solid ' + (selected === o.v ? o.c : 'var(--border-color)'), borderRadius: 12, padding: '10px 20px', cursor: saving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem', fontWeight: selected === o.v ? 600 : 400, color: selected === o.v ? o.c : 'var(--text-secondary)', transition: 'all 0.2s ease' },
                onClick: () => submit(o.v)
            }, React.createElement('span', { style: { fontSize: '1.2rem' } }, o.icon), o.label))),
        saved && React.createElement('p', { style: { color: 'var(--accent-success)', fontSize: '0.8rem', marginTop: 8 } }, '✅ Feedback saved'));
}

// ─── Settings ───
function SettingsPage() {
    const { user } = useAuth();
    const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
    return React.createElement('div', null,
        React.createElement('div', { className: 'page-header' }, React.createElement('div', null, React.createElement('h1', { className: 'page-title' }, 'Settings'), React.createElement('p', { className: 'page-subtitle' }, 'Configure preferences'))),
        React.createElement('div', { className: 'settings-section' }, React.createElement('h3', null, '👤 Profile'),
            React.createElement('div', { className: 'card' },
                React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 20 } },
                    React.createElement('div', { className: 'user-avatar', style: { width: 64, height: 64, fontSize: '1.4rem' } }, initials),
                    React.createElement('div', null, React.createElement('h2', null, user?.name), React.createElement('p', { style: { color: 'var(--text-secondary)' } }, user?.email), React.createElement('span', { className: 'badge badge-primary', style: { marginTop: 4 } }, user?.role))))),
        React.createElement('div', { className: 'settings-section' }, React.createElement('h3', null, '🔒 Security'),
            React.createElement('div', { className: 'card' },
                React.createElement('p', { style: { color: 'var(--text-secondary)', marginBottom: 12 } }, 'All medical data is encrypted and stored securely.'),
                React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
                    React.createElement('span', { className: 'badge badge-success' }, '🔐 Encrypted'),
                    React.createElement('span', { className: 'badge badge-success' }, '🛡️ JWT Auth'),
                    React.createElement('span', { className: 'badge badge-primary' }, '📋 Audit Log')))),
        React.createElement('div', { className: 'settings-section' }, React.createElement('h3', null, '🔮 Future Features'),
            React.createElement('div', { className: 'card' },
                React.createElement('div', { className: 'summary-items' },
                    ['🏷️ ICD-10 Auto-Detection', '💊 Drug Interaction', '🏥 EHR Integration', '🔔 Follow-up Reminders', '📊 Analytics Dashboard'].map((f, i) =>
                        React.createElement('div', { key: i, className: 'summary-item' }, React.createElement('span', null, f)))))),
        React.createElement('div', { className: 'disclaimer-banner', style: { marginTop: 32 } }, React.createElement('span', { className: 'disclaimer-icon' }, '⚕️'), ' MedBrief AI v1.0 Prototype')
    );
}

// ─── App Root ───
function App() {
    const { user, loading } = useAuth();
    const { path, navigate, params } = useRouter();
    if (loading) return React.createElement('div', { className: 'loading-overlay', style: { minHeight: '100vh' } }, React.createElement('div', { className: 'spinner' }), React.createElement('p', null, 'Loading MedBrief AI...'));
    if (!user) return React.createElement(LoginPage, null);
    let page;
    if (path === '/new') page = React.createElement(NewConsultation, { navigate });
    else if (path === '/settings') page = React.createElement(SettingsPage, null);
    else if (params.section === 'transcript') page = React.createElement(TranscriptReview, { id: params.id, navigate });
    else if (params.section === 'summary') page = React.createElement(AISummary, { id: params.id, navigate });
    else if (params.section === 'review') page = React.createElement(EditReview, { id: params.id, navigate });
    else page = React.createElement(Dashboard, { navigate });
    return React.createElement('div', { className: 'app-layout' },
        React.createElement(Sidebar, { currentPath: path, navigate }),
        React.createElement('main', { className: 'main-content fade-in' }, page));
}

// ─── Mount ───
ReactDOM.createRoot(document.getElementById('root')).render(
    React.createElement(AuthProvider, null, React.createElement(App, null))
);

import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import UploadReport from '../components/UploadReport';

export default function NewConsultation() {
    const location = useLocation();
    const [patients, setPatients] = useState([]);
    const [selectedPatientId, setSelectedPatientId] = useState(location.state?.patientId || '');
    const [patientName, setPatientName] = useState(location.state?.patientName || '');
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState(null);
    const [uploadFile, setUploadFile] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const [waveformBars, setWaveformBars] = useState(Array(40).fill(8));
    const [createdVisitId, setCreatedVisitId] = useState(null);
    const [showReportUpload, setShowReportUpload] = useState(false);

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);
    const analyserRef = useRef(null);
    const animFrameRef = useRef(null);
    const navigate = useNavigate();

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const startRecording = async () => {
        try {
            setError('');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            // Set up analyser for waveform
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 128;
            source.connect(analyser);
            analyserRef.current = analyser;

            const updateWaveform = () => {
                const data = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(data);
                const bars = Array.from({ length: 40 }, (_, i) => {
                    const idx = Math.floor((i / 40) * data.length);
                    return Math.max(8, (data[idx] / 255) * 80);
                });
                setWaveformBars(bars);
                animFrameRef.current = requestAnimationFrame(updateWaveform);
            };
            updateWaveform();

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                stream.getTracks().forEach(t => t.stop());
                cancelAnimationFrame(animFrameRef.current);
                audioContext.close();
                setWaveformBars(Array(40).fill(8));
            };

            mediaRecorder.start(100);
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(t => t + 1);
            }, 1000);
        } catch (err) {
            setError('Microphone access denied. Please allow microphone access.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(timerRef.current);
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setUploadFile(file);
            setAudioBlob(null);
        }
    };

    const handleStartPipeline = async () => {
        setProcessing(true);
        setError('');

        try {
            // 1. Create visit
            const { visit } = await api.createVisit({
                patient_id: selectedPatientId || null,
                patient_name: patientName || 'Unknown Patient'
            });

            setCreatedVisitId(visit.id);

            // 2. Upload audio (if available)
            const audioToUpload = audioBlob || uploadFile;
            if (audioToUpload) {
                const formData = new FormData();
                formData.append('audio', audioToUpload, audioBlob ? 'recording.webm' : uploadFile.name);
                formData.append('visitId', visit.id);
                await api.uploadAudio(formData);
            }

            // 3. Run transcription
            await api.transcribe(visit.id);

            // Navigate to transcript review
            navigate(`/visit/${visit.id}/transcript`);
        } catch (err) {
            setError(err.message || 'Pipeline failed');
            setProcessing(false);
        }
    };

    useEffect(() => {
        api.getPatients().then(data => setPatients(data.patients)).catch(console.error);
        return () => {
            clearInterval(timerRef.current);
            cancelAnimationFrame(animFrameRef.current);
        };
    }, []);

    const hasAudio = audioBlob || uploadFile;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">New Consultation</h1>
                    <p className="page-subtitle">Record or upload a doctor-patient conversation</p>
                </div>
            </div>

            <div className="disclaimer-banner">
                <span className="disclaimer-icon">⚕️</span>
                <span>AI-generated summary. Doctor verification required before clinical use.</span>
            </div>

            {error && (
                <div className="disclaimer-banner" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', marginBottom: 24 }}>
                    <span>⚠️</span> {error}
                </div>
            )}

            <div className="card" style={{ marginBottom: 24 }}>
                <div className="input-group">
                    <label>Select Patient</label>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <select
                            className="input"
                            value={selectedPatientId}
                            onChange={e => {
                                setSelectedPatientId(e.target.value);
                                const p = patients.find(p => p.id.toString() === e.target.value);
                                if (p) setPatientName(p.name);
                            }}
                            style={{ flex: 1 }}
                        >
                            <option value="">-- Select Registered Patient --</option>
                            {patients.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.patient_uid})</option>
                            ))}
                        </select>
                    </div>
                    {!selectedPatientId && (
                        <div style={{ marginTop: 12 }}>
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Or enter name manually (Unregistered)</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="Enter patient name"
                                value={patientName}
                                onChange={e => setPatientName(e.target.value)}
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="recorder-container">
                <h2 style={{ marginBottom: 8 }}>🎙️ Audio Recorder</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: '0.9rem' }}>
                    Record the consultation in Malayalam, English, or Hindi
                </p>

                <div className="waveform-container">
                    {waveformBars.map((height, i) => (
                        <div
                            key={i}
                            className={`waveform-bar ${isRecording ? 'active' : ''}`}
                            style={{
                                height: `${height}px`,
                                '--wave-height': `${height}px`,
                                animationDelay: `${i * 0.03}s`,
                                background: isRecording
                                    ? `hsl(${200 + i * 3}, 80%, 60%)`
                                    : 'var(--text-muted)'
                            }}
                        />
                    ))}
                </div>

                {(isRecording || recordingTime > 0) && (
                    <div className="recorder-time">{formatTime(recordingTime)}</div>
                )}

                <button
                    className={`record-btn ${isRecording ? 'recording' : ''}`}
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={processing}
                />

                <div className="recorder-status">
                    {isRecording ? '🔴 Recording... Click to stop' : audioBlob ? '✅ Recording saved' : 'Click to start recording'}
                </div>

                <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>or</span>
                </div>

                <div className="upload-area" style={{ marginTop: 16 }} onClick={() => document.getElementById('audio-upload').click()}>
                    <div className="upload-icon">📁</div>
                    <p style={{ fontWeight: 500 }}>{uploadFile ? `📎 ${uploadFile.name}` : 'Click to upload audio file'}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>Supports MP3, WAV, M4A, MP4, WEBM</p>
                    <input
                        id="audio-upload"
                        type="file"
                        accept="audio/*,.mp4,video/mp4"
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                    />
                </div>
            </div>

            {/* Medical Report Upload */}
            <div className="card" style={{ marginTop: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                        <h2 style={{ marginBottom: 4 }}>📎 Medical Reports</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            Upload lab results, blood tests, scans (optional — can also upload later)
                        </p>
                    </div>
                    <button
                        className="btn btn-ghost"
                        onClick={() => setShowReportUpload(!showReportUpload)}
                        style={{ fontSize: '0.85rem' }}
                    >
                        {showReportUpload ? '▲ Hide' : '▼ Show Upload'}
                    </button>
                </div>
                {showReportUpload && (
                    createdVisitId ? (
                        <UploadReport visitId={createdVisitId} />
                    ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: 16 }}>
                            Reports will be available after starting the AI pipeline (visit is created automatically).
                        </p>
                    )
                )}
            </div>

            {hasAudio && (
                <div style={{ textAlign: 'center', marginTop: 32 }}>
                    <button
                        className="btn btn-primary btn-lg"
                        onClick={handleStartPipeline}
                        disabled={processing}
                    >
                        {processing ? (
                            <>⏳ Processing AI Pipeline...</>
                        ) : (
                            <>🚀 Start AI Analysis</>
                        )}
                    </button>
                </div>
            )}

            {processing && (
                <div className="pipeline-steps" style={{ marginTop: 32 }}>
                    <div className="pipeline-step active">
                        <div className="pipeline-step-icon">🎙️</div>
                        <div className="pipeline-step-label">Upload</div>
                    </div>
                    <div className="pipeline-arrow">→</div>
                    <div className="pipeline-step active">
                        <div className="pipeline-step-icon">📝</div>
                        <div className="pipeline-step-label">Transcribe</div>
                    </div>
                    <div className="pipeline-arrow">→</div>
                    <div className="pipeline-step">
                        <div className="pipeline-step-icon">🧠</div>
                        <div className="pipeline-step-label">Extract</div>
                    </div>
                    <div className="pipeline-arrow">→</div>
                    <div className="pipeline-step">
                        <div className="pipeline-step-icon">📋</div>
                        <div className="pipeline-step-label">Summary</div>
                    </div>
                </div>
            )}
        </div>
    );
}

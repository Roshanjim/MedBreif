import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function TranscriptReview() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [visit, setVisit] = useState(null);
    const [transcript, setTranscript] = useState(null);
    const [loading, setLoading] = useState(true);
    const [extracting, setExtracting] = useState(false);

    useEffect(() => {
        api.getVisit(id).then(data => {
            setVisit(data.visit);
            if (data.visit.transcript) {
                const t = typeof data.visit.transcript === 'string'
                    ? JSON.parse(data.visit.transcript) : data.visit.transcript;
                setTranscript(t);
            }
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [id]);

    const handleExtract = async () => {
        setExtracting(true);
        try {
            await api.extract(id);
            await api.summarize(id);
            navigate(`/visit/${id}/summary`);
        } catch (err) {
            alert(err.message);
            setExtracting(false);
        }
    };

    const parseTranscript = (text) => {
        if (!text) return [];
        return text.split('\n\n').filter(Boolean).map(block => {
            const match = block.match(/^(Doctor|Patient):\s*(.*)/s);
            if (match) {
                return { speaker: match[1], text: match[2].trim() };
            }
            return { speaker: 'Unknown', text: block.trim() };
        });
    };

    if (loading) {
        return <div className="loading-overlay"><div className="spinner"></div><p>Loading transcript...</p></div>;
    }

    const lines = transcript ? parseTranscript(transcript.text) : [];

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Transcript Review</h1>
                    <p className="page-subtitle">{visit?.patient_name} – {visit?.visit_date}</p>
                </div>
                <button className="btn btn-primary" onClick={handleExtract} disabled={extracting}>
                    {extracting ? '⏳ Extracting...' : '🧠 Extract Medical Data'}
                </button>
            </div>

            <div className="pipeline-steps">
                <div className="pipeline-step completed">
                    <div className="pipeline-step-icon">🎙️</div>
                    <div className="pipeline-step-label">Recorded</div>
                </div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-step completed">
                    <div className="pipeline-step-icon">📝</div>
                    <div className="pipeline-step-label">Transcribed</div>
                </div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-step active">
                    <div className="pipeline-step-icon">🧠</div>
                    <div className="pipeline-step-label">Extract</div>
                </div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-step">
                    <div className="pipeline-step-icon">📋</div>
                    <div className="pipeline-step-label">Summary</div>
                </div>
            </div>

            {transcript && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                    <span className="badge badge-primary">🌐 {transcript.language}</span>
                    <span className="badge badge-success">⏱️ {transcript.duration}</span>
                    <span className={`confidence-badge ${transcript.confidence >= 0.8 ? 'confidence-high' : 'confidence-medium'}`}>
                        🎯 {Math.round(transcript.confidence * 100)}% confidence
                    </span>
                </div>
            )}

            <div className="transcript-viewer">
                {lines.length > 0 ? lines.map((line, i) => (
                    <div key={i} className={`transcript-line ${line.speaker.toLowerCase()}`}>
                        <div className="transcript-speaker">{line.speaker === 'Doctor' ? '🩺' : '🧑'} {line.speaker}</div>
                        <div>{line.text}</div>
                    </div>
                )) : (
                    <div className="empty-state">
                        <p>No transcript available</p>
                    </div>
                )}
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function AISummary() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [visit, setVisit] = useState(null);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('structured');

    useEffect(() => {
        api.getVisit(id).then(res => {
            setVisit(res.visit);
            setData(res.visit.extracted_data);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [id]);

    if (loading) {
        return <div className="loading-overlay"><div className="spinner"></div><p>Loading summary...</p></div>;
    }

    if (!data) {
        return (
            <div className="empty-state" style={{ marginTop: 60 }}>
                <div className="empty-state-icon">🧠</div>
                <h3>No extracted data</h3>
                <p>Run extraction first from the transcript page</p>
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate(`/visit/${id}/transcript`)}>
                    Go to Transcript
                </button>
            </div>
        );
    }

    const confidenceValue = parseFloat(data.ConfidenceScore) || 0;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">AI Summary</h1>
                    <p className="page-subtitle">{visit?.patient_name} – {visit?.visit_date}</p>
                </div>
                <button className="btn btn-primary" onClick={() => navigate(`/visit/${id}/review`)}>
                    ✏️ Edit & Finalize
                </button>
            </div>

            <div className="disclaimer-banner">
                <span className="disclaimer-icon">⚕️</span>
                <span>AI-generated summary. Doctor verification required before clinical use.</span>
            </div>

            <div className="pipeline-steps">
                <div className="pipeline-step completed"><div className="pipeline-step-icon">🎙️</div><div className="pipeline-step-label">Recorded</div></div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-step completed"><div className="pipeline-step-icon">📝</div><div className="pipeline-step-label">Transcribed</div></div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-step completed"><div className="pipeline-step-icon">🧠</div><div className="pipeline-step-label">Extracted</div></div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-step active"><div className="pipeline-step-icon">📋</div><div className="pipeline-step-label">Summary</div></div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
                <span className={`confidence-badge ${confidenceValue >= 80 ? 'confidence-high' : confidenceValue >= 60 ? 'confidence-medium' : 'confidence-low'}`}>
                    🎯 AI Confidence: {data.ConfidenceScore}
                </span>
            </div>

            <div className="tab-switcher">
                <button className={`tab-btn ${tab === 'structured' ? 'active' : ''}`} onClick={() => setTab('structured')}>
                    📋 Structured Data
                </button>
                <button className={`tab-btn ${tab === 'doctor' ? 'active' : ''}`} onClick={() => setTab('doctor')}>
                    🩺 Doctor Summary
                </button>
                <button className={`tab-btn ${tab === 'patient' ? 'active' : ''}`} onClick={() => setTab('patient')}>
                    🧑 Patient Summary
                </button>
            </div>

            {tab === 'structured' && (
                <div className="fade-in">
                    <div className="two-col">
                        <div>
                            <div className="summary-section">
                                <div className="summary-section-title">🤒 Symptoms</div>
                                <div className="summary-items">
                                    {data.Symptoms?.map((s, i) => (
                                        <div key={i} className="summary-item">
                                            <span className="summary-item-icon">•</span>
                                            <span>{s}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="summary-section">
                                <div className="summary-section-title">⏱️ Duration</div>
                                <div className="summary-items">
                                    {data.Duration?.map((d, i) => (
                                        <div key={i} className="summary-item">
                                            <span className="summary-item-icon">🕐</span>
                                            <span>{d}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="summary-section">
                                <div className="summary-section-title">🔬 Diagnosis</div>
                                <div className="summary-items">
                                    {data.Diagnosis?.map((d, i) => (
                                        <div key={i} className="summary-item">
                                            <span className="summary-item-icon">🏥</span>
                                            <span>{d}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="summary-section">
                                <div className="summary-section-title">🧪 Tests Advised</div>
                                <div className="summary-items">
                                    {data.TestsAdvised?.map((t, i) => (
                                        <div key={i} className="summary-item">
                                            <span className="summary-item-icon">🔬</span>
                                            <span>{t}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="summary-section">
                                <div className="summary-section-title">💊 Prescriptions</div>
                                <table className="medicine-table">
                                    <thead>
                                        <tr>
                                            <th>Medicine</th>
                                            <th>Dosage</th>
                                            <th>Frequency</th>
                                            <th>Duration</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.Prescriptions?.map((rx, i) => (
                                            <tr key={i}>
                                                <td style={{ fontWeight: 600 }}>{rx.Medicine}</td>
                                                <td>{rx.Dosage}</td>
                                                <td>{rx.Frequency}</td>
                                                <td>{rx.Duration}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="summary-section">
                                <div className="summary-section-title">🏃 Lifestyle Advice</div>
                                <div className="summary-items">
                                    {data.LifestyleAdvice?.map((l, i) => (
                                        <div key={i} className="summary-item">
                                            <span className="summary-item-icon">✅</span>
                                            <span>{l}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="summary-section">
                                <div className="summary-section-title">📅 Follow-Up</div>
                                <div className="summary-item">
                                    <span className="summary-item-icon">📋</span>
                                    <span>{data.FollowUp || 'Not specified'}</span>
                                </div>
                            </div>

                            {data.RedFlags?.length > 0 && (
                                <div className="summary-section">
                                    <div className="summary-section-title" style={{ color: 'var(--accent-danger)' }}>🚨 Red Flags</div>
                                    <div className="summary-items">
                                        {data.RedFlags.map((r, i) => (
                                            <div key={i} className="summary-item" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}>
                                                <span className="summary-item-icon">⚠️</span>
                                                <span style={{ color: 'var(--accent-danger)' }}>{r}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {data.UnclearItems?.length > 0 && (
                                <div className="summary-section">
                                    <div className="summary-section-title">❓ Unclear Items</div>
                                    <div className="summary-items">
                                        {data.UnclearItems.map((u, i) => (
                                            <div key={i} className="summary-item" style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)' }}>
                                                <span className="summary-item-icon">❔</span>
                                                <span style={{ color: 'var(--accent-warning)' }}>{u}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {tab === 'doctor' && (
                <div className="card fade-in">
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-family)', fontSize: '0.9rem', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                        {visit?.doctor_summary || 'No doctor summary available'}
                    </pre>
                </div>
            )}

            {tab === 'patient' && (
                <div className="card fade-in">
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-family)', fontSize: '0.9rem', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                        {visit?.patient_summary || 'No patient summary available'}
                    </pre>
                </div>
            )}
        </div>
    );
}

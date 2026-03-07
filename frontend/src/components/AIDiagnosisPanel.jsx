import { useState, useEffect } from 'react';
import { api } from '../api/client';
import DoctorFeedback from './DoctorFeedback';

export default function AIDiagnosisPanel({ visitId }) {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [method, setMethod] = useState('');

    const handleGenerate = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await api.diagnose(visitId);
            setAnalysis(data.analysis);
            setMethod(data.method || '');
        } catch (err) {
            setError(err.message || 'Diagnosis generation failed');
        }
        setLoading(false);
    };

    return (
        <div className="ai-diagnosis-panel fade-in">
            {/* Safety Disclaimer */}
            <div className="disclaimer-banner" style={{
                borderColor: 'rgba(239,68,68,0.3)',
                background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(245,158,11,0.08))',
                marginBottom: 20
            }}>
                <span className="disclaimer-icon">⚠️</span>
                <span><strong>Clinical Decision Support Only:</strong> AI suggestions are for clinical decision support only. Final diagnosis must be made by the physician.</span>
            </div>

            {!analysis && !loading && (
                <div style={{ textAlign: 'center', padding: 32 }}>
                    <div style={{ fontSize: '3rem', marginBottom: 12 }}>🩻</div>
                    <h3>AI Differential Diagnosis</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
                        Analyze consultation data, symptoms, and lab results to generate differential diagnoses, suggested tests, and treatment considerations.
                    </p>
                    <button className="btn btn-primary btn-lg" onClick={handleGenerate}>
                        🧠 Generate AI Diagnosis
                    </button>
                </div>
            )}

            {loading && (
                <div style={{ textAlign: 'center', padding: 40 }}>
                    <div className="spinner"></div>
                    <p style={{ marginTop: 12 }}>Analyzing patient data...</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>This may take a moment</p>
                </div>
            )}

            {error && (
                <div className="disclaimer-banner" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', marginTop: 12 }}>
                    <span>⚠️</span> {error}
                    <button className="btn btn-ghost" style={{ marginLeft: 12, fontSize: '0.8rem' }} onClick={handleGenerate}>Retry</button>
                </div>
            )}

            {analysis && (
                <div className="fade-in">
                    {method && (
                        <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>🧠 Method: {method}</span>
                            <button className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '4px 10px' }} onClick={handleGenerate}>🔄 Regenerate</button>
                        </div>
                    )}

                    <div className="two-col">
                        {/* Possible Conditions */}
                        <div className="summary-section">
                            <div className="summary-section-title">🔍 Possible Conditions</div>
                            <div className="summary-items">
                                {analysis.possibleConditions?.map((c, i) => (
                                    <div key={i} className="summary-item">
                                        <span className="summary-item-icon" style={{ fontWeight: 700 }}>{i + 1}.</span>
                                        <span>{c}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Suggested Tests */}
                        <div className="summary-section">
                            <div className="summary-section-title">🧪 Suggested Tests</div>
                            <div className="summary-items">
                                {analysis.suggestedTests?.map((t, i) => (
                                    <div key={i} className="summary-item">
                                        <span className="summary-item-icon">🔬</span>
                                        <span>{t}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Treatment Considerations */}
                        <div className="summary-section">
                            <div className="summary-section-title">💊 Treatment Considerations</div>
                            <div className="summary-items">
                                {analysis.treatmentConsiderations?.map((t, i) => (
                                    <div key={i} className="summary-item">
                                        <span className="summary-item-icon">✅</span>
                                        <span>{t}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Risk Flags */}
                        <div className="summary-section">
                            <div className="summary-section-title" style={{ color: 'var(--accent-danger)' }}>🚨 Risk Flags</div>
                            <div className="summary-items">
                                {analysis.riskFlags?.map((r, i) => (
                                    <div key={i} className="summary-item" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}>
                                        <span className="summary-item-icon">⚠️</span>
                                        <span style={{ color: 'var(--accent-danger)' }}>{r}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Doctor Feedback */}
                    <div style={{ marginTop: 24 }}>
                        <DoctorFeedback visitId={visitId} />
                    </div>
                </div>
            )}
        </div>
    );
}

import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function SOAPSummary({ visitId }) {
    const [aiSoap, setAiSoap] = useState(null);
    const [doctorSoap, setDoctorSoap] = useState({ Subjective: '', Objective: '', Assessment: '', Plan: '' });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [generated, setGenerated] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const data = await api.generateSOAP(visitId);
            setAiSoap(data.aiSoap);
            setDoctorSoap(data.doctorSoap || { Subjective: '', Objective: '', Assessment: '', Plan: '' });
            setGenerated(true);
        } catch (err) {
            alert('Failed to generate SOAP: ' + err.message);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            await api.updateDoctorSOAP(visitId, doctorSoap);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            alert('Failed to save: ' + err.message);
        }
        setSaving(false);
    };

    const sections = [
        { key: 'Subjective', label: 'S – Subjective', icon: '🗣️', desc: 'Patient\'s symptoms, history, and chief complaint' },
        { key: 'Objective', label: 'O – Objective', icon: '📊', desc: 'Examination findings, vitals, and lab results' },
        { key: 'Assessment', label: 'A – Assessment', icon: '🔍', desc: 'Diagnosis and clinical evaluation' },
        { key: 'Plan', label: 'P – Plan', icon: '📋', desc: 'Treatment plan, prescriptions, and follow-up' },
    ];

    if (!generated && !loading) {
        return (
            <div style={{ textAlign: 'center', padding: 32 }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>📋</div>
                <h3>SOAP Summary</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
                    Generate SOAP (Subjective, Objective, Assessment, Plan) notes from consultation data.
                </p>
                <button className="btn btn-primary btn-lg" onClick={handleGenerate}>
                    📋 Generate SOAP Notes
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 40 }}>
                <div className="spinner"></div>
                <p style={{ marginTop: 12 }}>Generating SOAP notes...</p>
            </div>
        );
    }

    return (
        <div className="soap-summary fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h3 style={{ marginBottom: 4 }}>📋 SOAP Summary</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        AI-generated (left) is read-only. Doctor notes (right) are editable.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost" onClick={handleGenerate} style={{ fontSize: '0.85rem' }}>
                        🔄 Regenerate AI SOAP
                    </button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ fontSize: '0.85rem' }}>
                        {saving ? '⏳ Saving...' : saved ? '✅ Saved!' : '💾 Save Doctor Notes'}
                    </button>
                </div>
            </div>

            {sections.map(({ key, label, icon, desc }) => (
                <div key={key} className="soap-section" style={{ marginBottom: 20 }}>
                    <div style={{ marginBottom: 8 }}>
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{icon}</span> {label}
                        </h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{desc}</p>
                    </div>
                    <div className="two-col" style={{ gap: 12 }}>
                        {/* AI SOAP — Read Only */}
                        <div className="card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>🤖 AI Generated</span>
                                <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: '0.7rem' }}>Read-only</span>
                            </div>
                            <pre style={{
                                whiteSpace: 'pre-wrap',
                                fontFamily: 'var(--font-family)',
                                fontSize: '0.85rem',
                                lineHeight: 1.6,
                                color: 'var(--text-secondary)',
                                margin: 0,
                            }}>
                                {aiSoap?.[key] || 'Not generated'}
                            </pre>
                        </div>

                        {/* Doctor SOAP — Editable */}
                        <div className="card" style={{ border: '1px solid var(--accent-primary)', borderColor: 'rgba(96,165,250,0.3)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>🩺 Doctor Notes</span>
                                <span className="badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', fontSize: '0.7rem' }}>Editable</span>
                            </div>
                            <textarea
                                value={doctorSoap[key]}
                                onChange={e => setDoctorSoap({ ...doctorSoap, [key]: e.target.value })}
                                placeholder={`Enter your ${label.split(' – ')[1]} notes...`}
                                style={{
                                    width: '100%',
                                    minHeight: 100,
                                    background: 'transparent',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 8,
                                    padding: 12,
                                    fontFamily: 'var(--font-family)',
                                    fontSize: '0.85rem',
                                    lineHeight: 1.6,
                                    color: 'var(--text-primary)',
                                    resize: 'vertical',
                                }}
                            />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

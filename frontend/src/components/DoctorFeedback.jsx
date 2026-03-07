import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function DoctorFeedback({ visitId }) {
    const [selected, setSelected] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!visitId) return;
        api.getFeedback(visitId)
            .then(data => {
                if (data.feedback?.rating) {
                    setSelected(data.feedback.rating);
                    setSaved(true);
                }
            })
            .catch(() => { });
    }, [visitId]);

    const handleFeedback = async (rating) => {
        setSaving(true);
        setSaved(false);
        try {
            await api.submitFeedback(visitId, rating);
            setSelected(rating);
            setSaved(true);
        } catch (err) {
            alert('Failed to save feedback: ' + err.message);
        }
        setSaving(false);
    };

    const options = [
        { value: 'good', icon: '👍', label: 'Good', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
        { value: 'okay', icon: '👌', label: 'Okay', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
        { value: 'bad', icon: '👎', label: 'Bad', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    ];

    return (
        <div className="doctor-feedback-container">
            <h4 style={{ marginBottom: 8 }}>Rate AI Recommendations</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 12 }}>
                Your feedback helps improve AI accuracy
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
                {options.map(opt => (
                    <button
                        key={opt.value}
                        className={`feedback-btn ${selected === opt.value ? 'active' : ''}`}
                        style={{
                            background: selected === opt.value ? opt.bg : 'var(--bg-secondary)',
                            borderColor: selected === opt.value ? opt.color : 'transparent',
                            color: selected === opt.value ? opt.color : 'var(--text-secondary)',
                            border: `2px solid ${selected === opt.value ? opt.color : 'var(--border-color)'}`,
                            borderRadius: 12,
                            padding: '10px 20px',
                            cursor: saving ? 'wait' : 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: '0.9rem',
                            fontWeight: selected === opt.value ? 600 : 400,
                        }}
                        onClick={() => handleFeedback(opt.value)}
                        disabled={saving}
                    >
                        <span style={{ fontSize: '1.2rem' }}>{opt.icon}</span>
                        {opt.label}
                    </button>
                ))}
            </div>
            {saved && (
                <p style={{ color: 'var(--accent-success)', fontSize: '0.8rem', marginTop: 8 }}>
                    ✅ Feedback saved
                </p>
            )}
        </div>
    );
}
